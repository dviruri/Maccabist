/**
 * Everything that changes a player's numbers: event effects, half-season and season
 * development, coach trust, in-team role, academy promotion and club moves.
 * All functions are pure - they take a Career and return a new Career.
 */

import { STAGE_LADDER, stageBand, stageConfig, stageLabel, stageOrder } from '../data/academy';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { getClub, MACCABI_ID, isMaccabiSenior } from '../data/clubs';
import { TRAITS_BY_ID } from '../data/traits';
import type {
  AcademyStage,
  Achievement,
  AttributeDelta,
  Career,
  CareerFlag,
  EventEffects,
  ProgressionResult,
  SeasonStats,
  TraitId,
} from '../types';
import { COACH_TRUST, PROGRESSION, PROMOTION, RECOVERY, SEASON, TRAITS } from './balance';
import { cohortLead, nextNaturalStage } from './cohort';
import { advanceArc, hasTrait, recordMemory, startArc } from './memory';
import { clamp, round, type Rng } from './random';
import { levelContext, roleFromValue } from './rules';

/* ------------------------------------------------------------------ */
/* Cloning                                                             */
/* ------------------------------------------------------------------ */

export function cloneCareer(career: Career): Career {
  return {
    ...career,
    hidden: { ...career.hidden },
    stats: { ...career.stats },
    maccabi: { ...career.maccabi },
    seasonHistory: [...career.seasonHistory],
    trophies: [...career.trophies],
    achievements: [...career.achievements],
    eventsHistory: [...career.eventsHistory],
    flags: [...career.flags],
    memories: [...career.memories],
    arcs: career.arcs.map((arc) => ({ ...arc })),
    completedArcs: [...career.completedArcs],
    traits: career.traits.map((trait) => ({ ...trait })),
    milestones: [...career.milestones],
    pendingEventIds: [...career.pendingEventIds],
    plannedEvents: career.plannedEvents.map((p) => ({ ...p })),
    pendingOffers: [...career.pendingOffers],
    lastSeasonDeltas: [...career.lastSeasonDeltas],
    lastAchievements: [...career.lastAchievements],
    firstHalfStats: career.firstHalfStats ? { ...career.firstHalfStats } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Visible attribute deltas                                            */
/* ------------------------------------------------------------------ */

const TRACKED: ReadonlyArray<{ key: string; label: string; read: (c: Career) => number }> = [
  { key: 'ability', label: 'יכולת', read: (c) => Math.round(c.ability) },
  { key: 'coachTrust', label: 'אמון המאמן', read: (c) => Math.round(c.coachTrust) },
  { key: 'maccabism', label: 'מכביסטיות', read: (c) => Math.round(c.maccabism) },
  { key: 'reputation', label: 'מוניטין', read: (c) => Math.round(c.reputation) },
  { key: 'roleValue', label: 'מעמד בקבוצה', read: (c) => Math.round(c.roleValue) },
];

export function diffCareer(before: Career, after: Career): AttributeDelta[] {
  const deltas: AttributeDelta[] = [];
  for (const field of TRACKED) {
    const from = field.read(before);
    const to = field.read(after);
    if (from !== to) deltas.push({ key: field.key, label: field.label, from, to });
  }
  return deltas;
}

/* ------------------------------------------------------------------ */
/* Club moves                                                          */
/* ------------------------------------------------------------------ */

export interface MoveOptions {
  loan?: boolean;
  loanSeasons?: number;
  returningFromLoan?: boolean;
}

/** Moves the player to a new club and keeps the Maccabi legacy bookkeeping straight. */
export function moveToClub(career: Career, clubId: string, options: MoveOptions = {}): Career {
  const next = cloneCareer(career);
  const wasMaccabiSenior =
    isMaccabiSenior(career.currentClubId) &&
    career.parentClubId === null &&
    career.academyStage === 'senior';
  const target = getClub(clubId);

  if (options.returningFromLoan) {
    next.parentClubId = null;
    next.loanSeasonsLeft = 0;
  } else if (options.loan) {
    next.parentClubId = career.parentClubId ?? career.currentClubId;
    next.loanSeasonsLeft = options.loanSeasons ?? 1;
  } else {
    next.parentClubId = null;
    next.loanSeasonsLeft = 0;
  }

  next.currentClubId = clubId;
  // Leaving the academy structure for any senior club means the youth ladder is over.
  if (target.isSenior) next.academyStage = 'senior';

  const permanent = !options.loan;
  if (permanent) {
    if (wasMaccabiSenior && clubId !== MACCABI_ID) {
      next.maccabi.everLeft = true;
      next.captain = false;
    }
    /*
     * A homecoming counts whether the player walked out of the senior team or was released
     * by the academy as a teenager. The second route used to be missed entirely - `everLeft`
     * is only set on a senior departure - so "released, developed elsewhere, bought back
     * years later" scored as if the player had simply always been here.
     */
    const wasAwayFromMaccabi =
      career.maccabi.everLeft || career.flags.includes('released_by_maccabi');
    if (clubId === MACCABI_ID && wasAwayFromMaccabi && !career.maccabi.returned) {
      next.maccabi.returned = true;
      next.maccabi.returnAge = career.age;
    }
  }

  // Re-seat the player in the new dressing room.
  const arrivalRole = clamp(48 + (career.ability - target.quality) * 1.5, 6, 88);
  const loyaltyKeep = target.id === MACCABI_ID ? career.maccabism * 0.18 : 0;
  next.roleValue = clamp(arrivalRole + loyaltyKeep, 5, 92);
  next.role = roleFromValue(next.roleValue);
  /*
   * Coach trust belongs to a coaching relationship, not to the player, so a move starts a new
   * one (v0.3.1). It is rebuilt from what the new staff can actually see - how good he is for
   * this level, what he is worth on the market, and whether he arrived as a signing or as a
   * homecoming - with only a trace of the old relationship carried over as reputation.
   *
   * Career memory keeps "there was a conflict with a coach"; the new coach does not inherit it.
   */
  const arrivingReputation = (career.reputation - 40) * COACH_TRUST.transferReputationWeight;
  const levelFit = (career.ability - target.quality) * COACH_TRUST.transferLevelWeight;
  // Coming home carries some goodwill that an ordinary signing does not.
  const homecomingGoodwill =
    target.id === MACCABI_ID && wasAwayFromMaccabiFor(career)
      ? COACH_TRUST.homecomingGoodwill
      : 0;
  next.coachTrust = clamp(
    COACH_TRUST.transferBaseline +
      levelFit +
      arrivingReputation +
      homecomingGoodwill +
      (career.coachTrust - 50) * COACH_TRUST.transferCarryover,
  );
  next.olderGroup = 'none';
  if (target.id !== MACCABI_ID) next.captain = false;

  return next;
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

export interface EffectsResult {
  career: Career;
  deltas: AttributeDelta[];
  achievements: Achievement[];
}

/** Applies a set of event/outcome/offer effects and reports the visible deltas. */
export function applyEffects(career: Career, effects: EventEffects, rng: Rng): EffectsResult {
  const before = career;
  let next = cloneCareer(career);

  if (effects.ability) next.ability = clamp(next.ability + effects.ability);
  if (effects.potential) next.hidden.potential = clamp(next.hidden.potential + effects.potential);
  if (effects.maccabism) next.maccabism = clamp(next.maccabism + effects.maccabism);
  if (effects.reputation) next.reputation = clamp(next.reputation + effects.reputation);
  if (effects.coachTrust) next.coachTrust = clamp(next.coachTrust + effects.coachTrust);
  if (effects.roleValue) next.roleValue = clamp(next.roleValue + effects.roleValue);
  if (effects.confidence) next.hidden.confidence = clamp(next.hidden.confidence + effects.confidence);
  if (effects.form) next.hidden.form = clamp(next.hidden.form + effects.form);
  if (effects.discipline) next.hidden.discipline = clamp(next.hidden.discipline + effects.discipline);
  if (effects.injuryRisk) next.hidden.injuryRisk = clamp(next.hidden.injuryRisk + effects.injuryRisk);
  if (effects.pressure) next.hidden.pressure = clamp(next.hidden.pressure + effects.pressure);
  /*
   * Minutes penalties stack multiplicatively, so two or three bad outcomes in one season used
   * to be able to drive playing time to almost nothing - and a season with no minutes means no
   * development and no way to change the coach's mind, which is how a single bad run turned
   * into a dead career. Floored so a bad season is bad, not terminal.
   */
  if (effects.minutesModifier) {
    next.hidden.minutesModifier = Math.max(
      RECOVERY.minutesModifierFloor,
      next.hidden.minutesModifier * effects.minutesModifier,
    );
  }
  if (effects.transferChance) next.hidden.transferBoost += effects.transferChance;
  if (effects.promotionBoost) next.hidden.promotionBoost += effects.promotionBoost;
  if (effects.olderGroup) next.olderGroup = effects.olderGroup;

  if (effects.injuryChance && rng.chance(effects.injuryChance)) {
    next.hidden.injuryRisk = clamp(next.hidden.injuryRisk + 18);
    next.hidden.minutesModifier *= 0.6;
    next.hidden.form = clamp(next.hidden.form - 8);
  }

  if (effects.flags?.length) {
    for (const flag of effects.flags) next = addFlag(next, flag);
  }
  if (effects.clearFlags?.length) {
    next.flags = next.flags.filter((f) => !effects.clearFlags?.includes(f));
  }

  if (effects.captain !== undefined) next.captain = effects.captain;
  if (effects.leadership) next.hidden.leadership = clamp(next.hidden.leadership + effects.leadership);

  /* ---------- v0.3: memory, arcs, traits, timeline ---------- */
  if (effects.remember) next.memories = recordMemory(next, effects.remember);

  if (effects.startArc) {
    next.arcs = startArc(next, effects.startArc, effects.arcBranch ?? 'default');
  } else if (effects.advanceArc) {
    next.arcs = advanceArc(next, effects.advanceArc, effects.arcBranch);
  }

  if (effects.completeArc) {
    const id = effects.completeArc;
    next.arcs = next.arcs.filter((arc) => arc.id !== id);
    if (!next.completedArcs.includes(id)) next.completedArcs = [...next.completedArcs, id];
  }

  if (effects.revealTrait) next = revealTrait(next, effects.revealTrait);

  if (effects.milestone) {
    next = addMilestone(next, {
      id: effects.milestone.id,
      icon: effects.milestone.icon,
      text: effects.milestone.text,
      major: effects.milestone.major ?? false,
    });
  }

  if (effects.transferTo && effects.transferTo !== next.currentClubId) {
    next = moveToClub(next, effects.transferTo);
  }

  next.role = roleFromValue(next.roleValue);
  next.peakAbility = Math.max(next.peakAbility, next.ability);

  const achievements: Achievement[] = [];
  if (effects.achievement) {
    const granted = grantAchievement(next, effects.achievement);
    if (granted) {
      next = granted.career;
      achievements.push(granted.achievement);
    }
  }

  return { career: next, deltas: diffCareer(before, next), achievements };
}

/* ------------------------------------------------------------------ */
/* Traits and milestones                                               */
/* ------------------------------------------------------------------ */

/** Reveals a trait the player actually has. Revealing one he lacks is a no-op. */
export function revealTrait(career: Career, id: TraitId): Career {
  if (!hasTrait(career, id)) return career;
  const existing = career.traits.find((t) => t.id === id);
  if (existing?.revealed) return career;

  const next = cloneCareer(career);
  next.traits = next.traits.map((t) =>
    t.id === id ? { ...t, revealed: true, revealedSeason: career.currentSeason } : t,
  );
  const def = TRAITS_BY_ID[id];
  return addMilestone(next, {
    id: `trait_${id}`,
    icon: def.icon,
    text: def.reveal,
    major: false,
  });
}

/**
 * Adds a story beat to the timeline. Milestones are deduplicated by id, so a "first senior
 * appearance" can be checked every season without piling up.
 */
export function addMilestone(
  career: Career,
  milestone: { id: string; icon: string; text: string; major: boolean },
): Career {
  if (career.milestones.some((m) => m.id === milestone.id)) return career;
  const next = cloneCareer(career);
  next.milestones = [
    ...next.milestones,
    {
      id: milestone.id,
      season: career.currentSeason,
      age: career.age,
      icon: milestone.icon,
      text: milestone.text,
      major: milestone.major,
    },
  ];
  return next;
}

/** Has this player got a Maccabi past to come back to? */
function wasAwayFromMaccabiFor(career: Career): boolean {
  return (
    career.maccabi.everLeft ||
    career.maccabi.academyGraduate ||
    career.flags.includes('released_by_maccabi')
  );
}

export function addFlag(career: Career, flag: CareerFlag): Career {
  const next = cloneCareer(career);
  if (!next.flags.includes(flag)) next.flags.push(flag);
  if (flag === 'loyalty_moment') next.maccabi.loyaltyMoments += 1;
  if (flag === 'betrayal_moment') next.maccabi.betrayalMoments += 1;
  return next;
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

function grantAchievement(
  career: Career,
  id: string,
): { career: Career; achievement: Achievement } | null {
  if (career.achievements.some((a) => a.id === id)) return null;
  const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
  if (!def) return null;
  const achievement: Achievement = {
    id: def.id,
    name: def.name,
    description: def.description,
    season: career.currentSeason,
    icon: def.icon,
  };
  const next = cloneCareer(career);
  next.achievements.push(achievement);
  return { career: next, achievement };
}

export function checkAchievements(career: Career): { career: Career; unlocked: Achievement[] } {
  let next = career;
  const unlocked: Achievement[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (!def.check) continue;
    if (next.achievements.some((a) => a.id === def.id)) continue;
    if (def.check(next)) {
      const granted = grantAchievement(next, def.id);
      if (granted) {
        next = granted.career;
        unlocked.push(granted.achievement);
      }
    }
  }
  return { career: next, unlocked };
}

/* ------------------------------------------------------------------ */
/* Half-season development                                             */
/* ------------------------------------------------------------------ */

function baseGrowthForAge(age: number): number {
  const band = PROGRESSION.growthByAge.find((b) => age <= b.maxAge);
  return band?.growth ?? -4;
}

export interface HalfContext {
  stats: SeasonStats;
  minutesShare: number;
  trophyPoints: number;
  /** 0.5 for each half of a season. */
  fraction: number;
}

/**
 * Coach trust reacts every half-season: performance and minutes push it up, a bad spell
 * pushes it down, and it always drifts gently back to the middle.
 */
export function updateCoachTrust(career: Career, ctx: HalfContext): number {
  const performance = (ctx.stats.rating - COACH_TRUST.ratingPivot) * COACH_TRUST.ratingWeight;
  const minutes = (ctx.minutesShare - 0.45) * COACH_TRUST.minutesWeight;
  const discipline =
    (career.hidden.discipline - COACH_TRUST.disciplinePivot) * COACH_TRUST.disciplineWeight;
  // Drift towards where this player's ability says he belongs, not a flat mid-table number,
  // so a good player who lost favour has a way back.
  const drift = (coachTrustBaseline(career) - career.coachTrust) * COACH_TRUST.drift;

  // Playing genuinely well is the fastest route back into a coach's plans.
  const earnedItBack =
    ctx.stats.rating >= RECOVERY.formRecoveryRating && ctx.stats.appearances >= 5
      ? RECOVERY.formRecoveryBonus
      : 0;

  const move = clamp(
    performance + minutes + discipline + drift + earnedItBack,
    -COACH_TRUST.maxMovePerHalf,
    COACH_TRUST.maxMovePerHalf,
  );
  return clamp(career.coachTrust + move * (ctx.fraction * 2));
}

/**
 * Applies half a season of development. Called after each half so the mid-season card can
 * show real movement and the second half responds to what happened in the first.
 */
export function applyHalfProgression(career: Career, ctx: HalfContext, rng: Rng): Career {
  const next = cloneCareer(career);
  const level = levelContext(career);
  const { stats, minutesShare, trophyPoints, fraction } = ctx;

  /* ---------- ability ---------- */
  const base = baseGrowthForAge(career.age) * fraction;
  let growth: number;
  if (base > 0) {
    const gap = next.hidden.potential - next.ability;
    const clubFactor = 1 + ((level.development - 65) / 100) * PROGRESSION.clubDevelopmentSwing * 2;
    const minutesFactor = 1 + (minutesShare - 0.45) * PROGRESSION.minutesSwing * 2;
    const ratingFactor = 1 + ((stats.rating - 55) / 45) * PROGRESSION.ratingSwing;
    const trustFactor = 1 + ((next.coachTrust - 50) / 100) * PROGRESSION.coachTrustSwing * 2;
    const disciplineFactor = 0.85 + (next.hidden.discipline / 100) * 0.3;
    const olderGroupFactor = SEASON.olderGroupDevelopment[next.olderGroup];

    // Traits bend the curve rather than replacing it.
    const traitFactor =
      (hasTrait(career, 'hard_worker') ? TRAITS.hardWorkerGrowth : 1) *
      (hasTrait(career, 'late_bloomer')
        ? career.age < TRAITS.lateBloomerTurnAge
          ? TRAITS.lateBloomerEarlyGrowth
          : TRAITS.lateBloomerLateGrowth
        : 1);

    const common =
      Math.max(0.35, clubFactor) *
      Math.max(0.3, minutesFactor) *
      Math.max(0.5, ratingFactor) *
      Math.max(0.6, trustFactor) *
      disciplineFactor *
      olderGroupFactor *
      traitFactor *
      rng.range(0.82, 1.2);

    if (gap > 0) {
      const potentialPull = clamp(gap / 22, 0, 1.4) ** PROGRESSION.potentialPullStrength;
      growth = base * potentialPull * common;
    } else {
      // Past the ceiling: only an exceptional spell keeps pushing, and only so far.
      const o = PROGRESSION.overshoot;
      const eligible =
        stats.rating >= o.minRating &&
        next.hidden.confidence >= o.minConfidence &&
        next.ability < next.hidden.potential + o.maxAbove;
      growth = eligible ? base * o.rate * common : 0;
    }
  } else {
    const wearFactor = 1 + (next.hidden.injuryRisk - 20) / 160;
    const minutesRelief = minutesShare > 0.4 ? 0.82 : 1.1;
    growth = base * Math.max(0.5, wearFactor) * minutesRelief * rng.range(0.8, 1.2);
  }
  next.ability = clamp(next.ability + growth);
  next.peakAbility = Math.max(next.peakAbility, next.ability);

  /* ---------- coach trust ---------- */
  next.coachTrust = updateCoachTrust(next, ctx);

  /* ---------- reputation ---------- */
  const prestigeFactor = 0.35 + level.prestige / 100;
  let repChange =
    ((stats.rating - 56) / 44) * SEASON.reputationGainMax * prestigeFactor * (0.3 + minutesShare) *
      fraction *
      2 +
    trophyPoints * 2.2;
  if (minutesShare < 0.15) repChange -= SEASON.reputationDecayNoMinutes * fraction * 2;
  const repCeiling = level.prestige + 22 + (next.ability - 70) * 0.5;
  if (next.reputation > repCeiling) repChange -= (next.reputation - repCeiling) * 0.22 * fraction * 2;
  next.reputation = clamp(next.reputation + repChange);

  /* ---------- maccabism ---------- */
  const club = getClub(next.currentClubId);
  let maccabismChange: number;
  if (club.isMaccabi) {
    maccabismChange = SEASON.maccabismPerSeasonAtMaccabi * (0.6 + minutesShare);
    if (trophyPoints > 0) maccabismChange += trophyPoints * 1.5;
  } else if (club.country !== 'ישראל') {
    maccabismChange = SEASON.maccabismPerSeasonAbroad;
  } else {
    maccabismChange = SEASON.maccabismPerSeasonOtherIsraeli;
  }
  if (career.parentClubId !== null) maccabismChange *= SEASON.maccabismLoanSoftening;
  next.maccabism = clamp(next.maccabism + maccabismChange * fraction * 2);

  /* ---------- role inside the team ---------- */
  const performance = (stats.rating - 57) / 40;
  const exposure = 0.35 + minutesShare;
  let roleChange = performance * SEASON.roleMoveMax * exposure + trophyPoints * 2;
  roleChange += clamp((next.ability - level.quality) * 0.35, -6, 6);
  roleChange += (next.coachTrust - 50) * COACH_TRUST.roleInfluence * 0.25;
  if (career.age >= 33) roleChange -= (career.age - 32) * 0.9;
  next.roleValue = clamp(next.roleValue + roleChange * fraction * 2, 2, 100);
  next.role = roleFromValue(next.roleValue);

  /* ---------- hidden ---------- */
  next.hidden.form = clamp(
    next.hidden.form +
      rng.gaussian(0, PROGRESSION.formVolatility * fraction * 2) +
      (stats.rating - 58) * 0.2 * fraction * 2,
  );
  const confidenceTarget =
    PROGRESSION.confidenceBaseline + (stats.rating - 58) * 0.8 + minutesShare * 12;
  next.hidden.confidence = clamp(
    next.hidden.confidence +
      (confidenceTarget - next.hidden.confidence) * PROGRESSION.confidenceRecovery * fraction * 2,
  );
  next.hidden.injuryRisk = clamp(
    next.hidden.injuryRisk +
      ((career.age > 30 ? 2.2 : 0) + (stats.injuredGames > 0 ? 4 : -1.5)) * fraction * 2,
  );
  next.hidden.pressure = clamp(next.hidden.pressure * 0.95 + (next.roleValue - 50) * 0.04);

  // A hot head keeps finding the referee.
  if (hasTrait(career, 'hot_headed')) {
    next.hidden.discipline = clamp(next.hidden.discipline + TRAITS.hotHeadedDiscipline * fraction * 2);
  }
  // A professional does not spiral - his form has a floor.
  if (hasTrait(career, 'professional')) {
    next.hidden.form = Math.max(next.hidden.form, TRAITS.professionalFormFloor + 30);
  }
  /*
   * Standing in the dressing room grows with age, status and time served, and is what the
   * armband actually keys off. Slow by design: it should take most of a career to become
   * the man everyone looks at.
   */
  const leadershipGain =
    (career.age >= 22 ? 0.9 : 0.35) +
    (next.roleValue - 55) * 0.035 +
    (stats.appearances >= 10 ? 0.5 : 0) +
    (hasTrait(career, 'leader') ? 0.7 : 0);
  next.hidden.leadership = clamp(next.hidden.leadership + leadershipGain * fraction * 2);

  next.ability = round(next.ability, 2);
  next.coachTrust = round(next.coachTrust, 2);
  next.maccabism = round(next.maccabism, 2);
  next.reputation = round(next.reputation, 2);
  next.roleValue = round(next.roleValue, 2);

  return next;
}

/* ------------------------------------------------------------------ */
/* Recovery (v0.3)                                                     */
/* ------------------------------------------------------------------ */

/**
 * The trust level a coach would land on for this player if he had no history with him:
 * driven by how good he actually is for the level, plus a little credit for years served.
 *
 * This is what stops the trust spiral. Previously a bad spell cut minutes, which cut
 * development, which cut trust again, with no floor - a single bad run could quietly end a
 * career. Now a genuinely good player pulls back towards where he belongs.
 */
export function coachTrustBaseline(career: Career): number {
  const level = levelContext(career);
  const edge = career.ability - level.quality;
  const seasons = Math.min(career.maccabi.seasons, RECOVERY.baselineSeasonsCap);
  return clamp(
    RECOVERY.baselineAnchor +
      edge * RECOVERY.baselineAbilityWeight +
      seasons * RECOVERY.baselineSeasonsWeight,
  );
}

/**
 * Applied at the start of every season. Deliberately partial - a player who lost the
 * dressing room does not arrive in August with a clean slate, he arrives closer to where his
 * ability says he should be.
 */
export function driftTrustTowardsBaseline(career: Career, strength: number): Career {
  const baseline = coachTrustBaseline(career);
  const next = cloneCareer(career);
  next.coachTrust = round(clamp(career.coachTrust + (baseline - career.coachTrust) * strength), 2);
  return next;
}

/**
 * The club changes coach. The single most useful thing that can happen to a player stuck
 * behind one bad relationship - and a real risk to a player who was the last coach's favourite.
 */
export function maybeChangeCoach(career: Career, rng: Rng): { career: Career; changed: boolean } {
  if (!rng.chance(RECOVERY.coachChangeChance)) return { career, changed: false };

  let next = driftTrustTowardsBaseline(career, RECOVERY.coachChangeDrift);
  next = cloneCareer(next);
  // A new man in charge does not inherit the old man's favourites.
  next.flags = next.flags.filter((f) => f !== 'coach_favourite');
  return { career: next, changed: true };
}

/** Clears the one-season modifiers once the season is fully over. */
export function endOfSeasonReset(career: Career): Career {
  const next = cloneCareer(career);
  next.hidden.minutesModifier = 1;
  next.hidden.promotionBoost = 0;
  next.hidden.transferBoost = Math.max(0, next.hidden.transferBoost - 0.35);
  return next;
}

/* ------------------------------------------------------------------ */
/* Academy promotion                                                   */
/* ------------------------------------------------------------------ */

/** The end-of-season score that decides whether the player moves up the ladder. */
export function promotionScore(career: Career, seasonRating: number, rng: Rng): number {
  const level = levelContext(career);
  return (
    career.coachTrust * PROMOTION.coachTrustWeight +
    career.roleValue * PROMOTION.roleWeight +
    (career.ability - level.quality) * PROMOTION.abilityEdgeWeight +
    (seasonRating - 55) * PROMOTION.ratingWeight +
    career.hidden.potential * PROMOTION.potentialWeight +
    PROMOTION.olderGroupBonus[career.olderGroup] +
    career.hidden.promotionBoost +
    rng.gaussian(0, PROMOTION.noise)
  );
}

/**
 * Decides what happens to an academy player at the end of a season.
 * The u19 -> senior step is handled separately by the transfer engine, which is why this
 * never returns 'senior'.
 */
/**
 * What happens to an academy player at the end of a season.
 *
 * The v0.3.1 rule: **an academy is organised by birth year.** The cohort moves up every
 * season regardless of how the season went, so a player registered with his own age group can
 * never repeat it. The only question the promotion roll answers is whether he goes up *faster*
 * than his cohort.
 *
 * A player already ahead of his cohort has a third possibility: staying in the same named
 * group while his own cohort catches up. That looks like standing still and is the opposite -
 * it is where an early promotion lands.
 */
export function resolveAcademyProgression(
  career: Career,
  seasonRating: number,
  rng: Rng,
): { career: Career; result: ProgressionResult } {
  const from = career.academyStage;
  const nextNatural = nextNaturalStage(career);
  const lead = cohortLead(career);

  const score = promotionScore(career, seasonRating, rng);
  const canSkip =
    career.maccabi.earlyPromotions < PROMOTION.maxEarlyPromotions &&
    lead < PROMOTION.maxCohortLead &&
    stageOrder(from) < stageOrder('u19');
  const earnedEarly = score >= PROMOTION.earlyThreshold && canSkip;

  /*
   * The floor is the cohort's stage for next season - never below it. A player who is already
   * ahead keeps his place; a player with his cohort moves up with them.
   */
  const naturalTarget = Math.max(stageOrder(nextNatural), stageOrder(from));
  const target = earnedEarly ? naturalTarget + 1 : naturalTarget;
  const to = STAGE_LADDER[Math.min(STAGE_LADDER.length - 1, target)] as AcademyStage;

  const movedUp = stageOrder(to) > stageOrder(from);
  const kind: ProgressionResult['kind'] = earnedEarly
    ? 'early'
    : movedUp
      ? 'normal'
      : // Same label as last season, because the cohort arrived. Not a repeat.
        'cohort_caught_up';

  const next = cloneCareer(career);
  next.academyStage = to;
  next.seasonsAtStage = movedUp ? 0 : career.seasonsAtStage + 1;
  next.maccabi.academySeasons += 1;
  if (earnedEarly) next.maccabi.earlyPromotions += 1;

  if (movedUp) {
    // A new age group means starting nearer the bottom of the pecking order again.
    const drop = earnedEarly ? 16 : 9;
    next.roleValue = clamp(next.roleValue - drop, 8, 96);
    next.role = roleFromValue(next.roleValue);
    next.coachTrust = clamp(next.coachTrust - (earnedEarly ? 7 : 4));
    // Playing up is reset by the promotion - you are the young one again.
    next.olderGroup = 'none';
  } else {
    /*
     * His cohort has arrived in the group he was already playing in. He is now one of the
     * older boys rather than the youngest, which is worth something.
     */
    next.olderGroup = 'none';
    next.roleValue = clamp(next.roleValue + PROMOTION.cohortCaughtUpRoleGain, 8, 96);
    next.role = roleFromValue(next.roleValue);
  }

  const result = buildProgressionResult(kind, from, to);
  return { career: next, result };
}

function buildProgressionResult(
  kind: ProgressionResult['kind'],
  from: AcademyStage,
  to: AcademyStage,
): ProgressionResult {
  const toLabel = stageLabel(to);
  switch (kind) {
    case 'early':
      return {
        kind,
        fromStage: from,
        toStage: to,
        title: 'הוקפצת שנתון!',
        detail: `דילגת על שלב שלם. בעונה הבאה אתה ב${toLabel}, עם שחקנים שגדולים ממך בשנה.`,
        icon: '⬆️',
        major: true,
      };
    case 'cohort_caught_up':
      /*
       * Critically NOT "you stayed back". He was playing above his age; now the boys born in
       * his own year have arrived in the same group. Same shirt, completely different meaning,
       * and the wording has to make that obvious.
       */
      return {
        kind,
        fromStage: from,
        toStage: to,
        title: `השנתון שלך הגיע ל${toLabel}`,
        detail: `שיחקת שם כשהיית צעיר מכולם. עכשיו זה פשוט השנתון שלך - ואתה כבר מהוותיקים בקבוצה.`,
        icon: '🎯',
        major: false,
      };
    default:
      return {
        kind: 'normal',
        fromStage: from,
        toStage: to,
        title: `עלית ל${toLabel}`,
        detail: `עוד שלב בסולם. בעונה הבאה אתה ב${toLabel}.`,
        icon: '💚',
        major: stageBand(from) !== stageBand(to),
      };
  }
}

/** Number of competitive games in the stage the player is about to enter. */
export function stageGames(stage: AcademyStage): number {
  return stageConfig(stage).seasonGames;
}

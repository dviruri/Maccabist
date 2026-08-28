/**
 * Everything that changes a player's numbers: event effects, half-season and season
 * development, coach trust, in-team role, academy promotion and club moves.
 * All functions are pure - they take a Career and return a new Career.
 */

import {
  LAST_YOUTH_STAGE,
  STAGE_LADDER,
  stageBand,
  stageConfig,
  stageLabel,
  stageOrder,
} from '../data/academy';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { getClub, MACCABI_ID, isMaccabiSenior } from '../data/clubs';
import { TRAITS_BY_ID } from '../data/traits';
import { guardedMaccabismDelta } from './truth';
import { EXTERNAL_YOUTH_CLUBS } from '../data/youthClubs';
import type {
  AcademyStage,
  Achievement,
  AttributeDelta,
  Career,
  CareerFlag,
  Club,
  EventEffects,
  ExpectedRole,
  MaccabiRelevance,
  MemoryKind,
  ProgressionResult,
  SeasonStats,
  TraitId,
} from '../types';
import { isDownwardMove, isUpwardMove, moveDirection } from './marketEngine';
import {
  COACH_TRUST,
  MARKET,
  POSITIONS,
  PROGRESSION,
  PROMOTION,
  RECOVERY,
  SEASON,
  TRAITS,
} from './balance';
import { cohortLead, nextNaturalStage } from './cohort';
import { advanceArc, hasMemory, hasTrait, recordMemory, startArc } from './memory';
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
    /*
     * Spread first, then override the mutable collections (v0.4.1).
     *
     * Listing the fields explicitly silently dropped `maccabiSeasons` the moment it was added -
     * every clone wiped the ambient Maccabi world, so it read as permanently empty. Any future
     * world field is now carried by default and only needs a line here if it must be copied
     * rather than shared.
     */
    world: {
      ...career.world,
      clubLeagues: { ...career.world.clubLeagues },
      clubSeasons: [...career.world.clubSeasons],
      ...(career.world.maccabiSeasons
        ? { maccabiSeasons: [...career.world.maccabiSeasons] }
        : {}),
    },
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
  /** What the club signed him to be (v0.4). Drives where he starts in the pecking order. */
  expectedRole?: ExpectedRole;
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

  /*
   * Re-seat the player in the new dressing room.
   *
   * v0.4: when the move came with an expected role, that is what he arrives as - signing for a
   * big club as a backup has to actually mean sitting on their bench, or the expected role is
   * decoration rather than a decision.
   */
  const arrivalRole =
    options.expectedRole !== undefined
      ? MARKET.arrivalRoleValue[options.expectedRole]
      : clamp(48 + (career.ability - target.quality) * 1.5, 6, 88);
  const loyaltyKeep = target.id === MACCABI_ID ? career.maccabism * 0.18 : 0;
  next.roleValue = clamp((arrivalRole ?? 48) + loyaltyKeep, 5, 92);
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

  return rememberTheMove(career, next, target, options);
}

/**
 * Records what kind of move this was (v0.4).
 *
 * The memories exist so that later events and homecoming archetypes can key off the shape of a
 * career rather than a snapshot of it - "he went abroad once and it worked" is a different player
 * from "he went abroad once and came straight back". Written here, at the one place every move
 * goes through, so no route into a club can skip them.
 */
function rememberTheMove(
  before: Career,
  after: Career,
  target: Club,
  options: MoveOptions,
): Career {
  // A loan is a spell, not a career direction; the loan's *return* is where the story is.
  if (options.loan) return after;

  let next = after;
  const remember = (kind: MemoryKind): void => {
    next = { ...next, memories: recordMemory(next, kind) };
  };

  const wasAbroad = getClub(before.currentClubId).country !== 'ישראל';
  const goingAbroad = target.country !== 'ישראל';

  if (goingAbroad && !wasAbroad) {
    if (!hasMemory(before, 'first_move_abroad')) remember('first_move_abroad');
    // Reaching Europe without ever having been a Maccabi senior player is its own route.
    if (before.maccabi.appearances === 0) remember('direct_europe_from_non_maccabi');
  }

  if (!goingAbroad && wasAbroad) {
    remember('returned_to_israel');
    /*
     * Whether the spell abroad worked is judged on football played, not on where he goes next -
     * a player who managed a handful of games in two seasons did not have a European career.
     */
    const abroadGames = before.seasonHistory
      .filter((s) => getClub(s.clubId).country !== 'ישראל')
      .reduce((total, s) => total + s.stats.appearances, 0);
    if (abroadGames < MARKET.failedAbroadAppearances) remember('failed_abroad');
  }

  if (before.academyStage === 'senior' && target.isSenior) {
    const direction = moveDirection(before, target);
    if (isUpwardMove(direction)) {
      remember('moved_up_a_level');
      // Climbing again after having dropped down is the story worth its own name.
      if (hasMemory(before, 'moved_down_a_level')) remember('rebuilt_career');
    } else if (isDownwardMove(direction)) {
      remember('moved_down_a_level');
    }
  }

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

/**
 * Turns an event's `transferTo` into a real club id (v0.4.1).
 *
 * Events may name a club, or name a *pool*. Naming a pool matters for two reasons found by
 * measurement: an academy event that hardcoded `hapoel_afula` accounted for 55% of all
 * second-division seasons in the game, and - worse - Hapoel Afula is a *senior* club, so a
 * fourteen year old who chose "move to the local club" was made a senior professional on the spot.
 */
function resolveDestination(target: string, rng: Rng): string | null {
  if (target === 'external_youth') {
    const club = rng.pick(EXTERNAL_YOUTH_CLUBS);
    return club?.id ?? null;
  }
  return target;
}

/**
 * Applies a set of event/outcome/offer effects and reports the visible deltas.
 *
 * `maccabiRelevance` is what licenses a Maccabism change (v0.4.8). Omitted means "not about
 * Maccabi", and the delta is dropped - see `guardedMaccabismDelta`. Defaulting to *permissive*
 * here would leave every existing and future caller free to move the number by accident, which is
 * exactly how it came to drift in the first place.
 */
export function applyEffects(
  career: Career,
  effects: EventEffects,
  rng: Rng,
  maccabiRelevance?: MaccabiRelevance,
): EffectsResult {
  const before = career;
  let next = cloneCareer(career);

  if (effects.ability) next.ability = clamp(next.ability + effects.ability);
  if (effects.potential) next.hidden.potential = clamp(next.hidden.potential + effects.potential);
  const maccabismDelta = guardedMaccabismDelta(effects.maccabism, maccabiRelevance);
  if (maccabismDelta) next.maccabism = clamp(next.maccabism + maccabismDelta);
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
  if (effects.remember) {
    for (const kind of Array.isArray(effects.remember) ? effects.remember : [effects.remember]) {
      next.memories = recordMemory(next, kind);
    }
  }

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

  if (effects.transferTo) {
    const destination = resolveDestination(effects.transferTo, rng);
    if (destination && destination !== next.currentClubId) next = moveToClub(next, destination);
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
/**
 * The rating an average player at a given level would post.
 *
 * The season rating is computed from absolute ability, so this converts a level into the
 * rating that counts as "par" there. At senior level it lands on ~57, which is the value the
 * pre-v0.3.1 constants were tuned around.
 */
export function expectedRatingForLevel(levelQuality: number): number {
  return SEASON.ratingBase + (levelQuality - 50) * SEASON.ratingAbilityWeight;
}

export function updateCoachTrust(career: Career, ctx: HalfContext): number {
  const level = levelContext(career);
  const performance =
    (ctx.stats.rating - expectedRatingForLevel(level.quality)) * COACH_TRUST.ratingWeight;
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
    /*
     * Decline. Position matters here (v0.4.1): goalkeeping depends less on the physical qualities
     * that fade first, so a keeper holds his level while an outfielder is already dropping. That
     * is what makes a longer goalkeeping career a consequence of the model rather than a
     * hard-coded exception to it.
     */
    const wearFactor = 1 + (next.hidden.injuryRisk - 20) / 160;
    const minutesRelief = minutesShare > 0.4 ? 0.82 : 1.1;
    const positionFactor = POSITIONS[career.position].declineFactor;
    growth =
      base * Math.max(0.5, wearFactor) * minutesRelief * positionFactor * rng.range(0.8, 1.2);
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

  /*
   * ---------- maccabism ----------
   *
   * REMOVED IN v0.4.8. Maccabism no longer drifts passively.
   *
   * This block ran every half-season and changed the number from nothing but which club the
   * player happened to be at: up at Maccabi, down abroad, sideways at another Israeli club, and
   * softened on loan. So a career at Maccabi Herzliya accumulated Maccabism for playing well at
   * Maccabi Herzliya, and a career at Utrecht lost it for existing.
   *
   * Maccabism is what the player feels about ONE club, and it is his to spend. Only an explicit
   * decision about that club may move it - see `maccabismDelta` in outcomeEffects, where an
   * outcome has to declare *what about Maccabi happened* before its delta is applied. Playing
   * abroad does not make a man less of a Maccabist; leaving does, and only if he chose to.
   */

  /* ---------- role inside the team ---------- */
  /*
   * Performance is measured against what an average player *at this level* rates, not against
   * a fixed number.
   *
   * The season rating is built from absolute ability, so a good nine year old rates ~37 simply
   * because he is nine. Against a flat pivot of 57 that reads as failure, and every academy
   * player's standing collapsed to the floor within a few seasons - which in turn made it
   * impossible for a boy at a smaller academy to stand out. Pivoting on the level reproduces
   * the old value at senior level (~57) while treating the academy sanely.
   */
  const performance = (stats.rating - expectedRatingForLevel(level.quality)) / 40;
  const exposure = 0.35 + minutesShare;
  let roleChange = performance * SEASON.roleMoveMax * exposure + trophyPoints * 2;
  roleChange += (next.coachTrust - 50) * COACH_TRUST.roleInfluence * 0.25;
  if (career.age >= 33) roleChange -= (career.age - 32) * 0.9;

  /*
   * Standing pulls towards a ceiling set by how good he is *for this club* (v0.4.5).
   *
   * Without this, roleChange accumulated every half-season with nothing pulling it back: a player
   * even slightly better than his club gained standing indefinitely, so roleValue ratcheted to
   * the clamp. Being the best player at your club is supposed to be an achievement, not the
   * default resting state of anyone competent.
   */
  const edge = next.ability - level.quality;

  /*
   * SENIOR AND ACADEMY ARE DIFFERENT MODELS (v0.4.6).
   *
   * The defect this version fixed is a senior-football one: the ladder was purely relative, so a
   * good player at a bad club came out a `star`, 97.8% of the time. The fix was a concave
   * ceiling, the removal of a double-counted edge push, stronger gravity and a cap set by the
   * club's own standing.
   *
   * Applying all of that to the academy as well was a mistake, and the simulation caught it:
   * academy standing fell by roughly thirteen points, and because two other systems read
   * roleValue as an absolute quantity the knock-on was severe -
   *
   *   early academy promotion            16.9%  ->  7.1% of careers
   *   rejected boys invited back          39.0%  -> 12.7% of that group
   *
   * The second is the road back for a boy Maccabi turned away, which is the question this whole
   * version of the game is built around. Rescaling the two thresholds did not recover it either,
   * because retrial eligibility is a *gate* on role being `starter` or better, not a score.
   *
   * An age group is not a club in a professional pyramid. Being the outstanding boy in נערים א׳
   * is exactly what the game is about, and nothing about the level diminishes it. So the academy
   * keeps the v0.4.5 model that was calibrated for it, and the new model applies where the defect
   * actually was.
   */
  if (level.isAcademy) {
    roleChange += clamp(edge * 0.35, -6, 6);
    const ceiling = clamp(SEASON.roleCeilingBase + edge * SEASON.roleCeilingPerPoint, 20, 100);
    const overshoot = next.roleValue - ceiling;
    if (overshoot > 0) roleChange -= overshoot * SEASON.roleCeilingPullAcademy;
  } else {
    /*
     * Concave above the club's level, linear below it. The tenth point of edge matters far less
     * than the first - "clearly our best" and "clearly our best by even more" are not different
     * squad roles - and the old linear form clamped at 100, pinning every good player at a weak
     * club to the top rung permanently.
     */
    const relative =
      edge <= 0
        ? clamp(SEASON.roleCeilingBase + edge * SEASON.roleCeilingPerPoint, 20, 100)
        : SEASON.roleCeilingBase +
          SEASON.roleCeilingSpan * (1 - Math.exp(-edge / SEASON.roleCeilingScale));

    // ...and capped by what the club itself can support. `star` means a standout at a club that
    // matters; below roughly quality 50 this lands under the star threshold, and the honest
    // answer for the best player there is `key`.
    const clubCap =
      SEASON.roleClubCapBase +
      SEASON.roleClubCapSpan *
        clamp((level.quality - SEASON.roleClubCapFloor) / SEASON.roleClubCapRange, 0, 1);

    const ceiling = Math.min(relative, clubCap);
    const overshoot = next.roleValue - ceiling;
    if (overshoot > 0) roleChange -= overshoot * SEASON.roleCeilingPull;
  }

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
  /*
   * The academy ladder stops at נוער (v0.4.1).
   *
   * 'senior' is the last entry in STAGE_LADDER, so clamping to the ladder's length let a נערים א׳
   * player with an early promotion land on 'senior' as an ordinary rung - skipping the youth
   * verdict, the senior offers and the club move entirely. The result was a player whose stage
   * said senior while his club was still maccabi_academy, so every screen for the rest of his
   * career read "מכבי חיפה - מחלקת ילדים". Reaching senior football is a transition with a
   * decision attached, never a step on this ladder.
   */
  const ceiling = stageOrder(LAST_YOUTH_STAGE);
  const to = STAGE_LADDER[Math.min(ceiling, target)] as AcademyStage;

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
    /*
     * Only an EARLY promotion resets the pecking order.
     *
     * When the whole cohort moves up together nobody becomes "the young one" - they are all
     * still the same relative ages, with the same coach, in a new age bracket. Applying the
     * knock-down to ordinary promotion was a v0.3.1 regression: promotion now happens every
     * single season, so a -9 role hit each time drove every player to the floor within three
     * seasons and no academy player could ever stand out.
     */
    if (earnedEarly) {
      next.roleValue = clamp(next.roleValue - PROMOTION.earlyPromotionRoleDrop, 8, 96);
      next.coachTrust = clamp(next.coachTrust - PROMOTION.earlyPromotionTrustDrop);
      // Playing up is reset by the promotion - you really are the young one now.
      next.olderGroup = 'none';
    } else {
      // A small step up in standard, not a change of standing.
      next.roleValue = clamp(next.roleValue - PROMOTION.normalPromotionRoleDrop, 8, 96);
      next.olderGroup = 'none';
    }
    next.role = roleFromValue(next.roleValue);
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

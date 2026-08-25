/**
 * Everything that changes a player's numbers: event effects, season growth,
 * status movement, achievements and club moves.
 * All functions are pure - they take a Career and return a new Career.
 */

import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { getClub, MACCABI_ID, isMaccabiSenior } from '../data/clubs';
import type {
  Achievement,
  AttributeDelta,
  Career,
  CareerFlag,
  EventEffects,
  SeasonStats,
} from '../types';
import { PROGRESSION, SEASON } from './balance';
import { clamp, round, type Rng } from './random';
import { statusFromValue } from './rules';

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
    seenEventIds: [...career.seenEventIds],
    flags: [...career.flags],
    pendingEventIds: [...career.pendingEventIds],
    pendingOffers: [...career.pendingOffers],
    lastSeasonDeltas: [...career.lastSeasonDeltas],
    lastAchievements: [...career.lastAchievements],
  };
}

/* ------------------------------------------------------------------ */
/* Visible attribute deltas                                            */
/* ------------------------------------------------------------------ */

const TRACKED: ReadonlyArray<{ key: string; label: string; read: (c: Career) => number }> = [
  { key: 'ability', label: 'יכולת', read: (c) => Math.round(c.ability) },
  { key: 'maccabism', label: 'מכביסטיות', read: (c) => Math.round(c.maccabism) },
  { key: 'reputation', label: 'מוניטין', read: (c) => Math.round(c.reputation) },
  { key: 'statusValue', label: 'מעמד', read: (c) => Math.round(c.statusValue) },
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
  /** The move is a loan - the player still belongs to `parentClubId`. */
  loan?: boolean;
  loanSeasons?: number;
  /** Loan is finished, the player goes back to his parent club. */
  returningFromLoan?: boolean;
}

/**
 * Moves the player to a new club and keeps the Maccabi legacy bookkeeping straight.
 * Status is re-evaluated: a step up means starting near the bottom of the pecking order.
 */
export function moveToClub(career: Career, clubId: string, options: MoveOptions = {}): Career {
  const next = cloneCareer(career);
  const wasMaccabiSenior = isMaccabiSenior(career.currentClubId) && career.parentClubId === null;
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

  const permanent = !options.loan;
  if (permanent) {
    if (wasMaccabiSenior && clubId !== MACCABI_ID) {
      next.maccabi.everLeft = true;
      next.captain = false;
    }
    if (clubId === MACCABI_ID && career.maccabi.everLeft && !career.maccabi.returned) {
      next.maccabi.returned = true;
      next.maccabi.returnAge = career.age;
    }
  }

  // Re-seat the player in the new dressing room.
  const arrivalStatus = clamp(48 + (career.ability - target.quality) * 1.5, 6, 88);
  // A homecoming legend keeps some of his standing.
  const loyaltyKeep = target.id === MACCABI_ID ? career.maccabism * 0.18 : 0;
  next.statusValue = clamp(arrivalStatus + loyaltyKeep, 5, 92);
  next.status = statusFromValue(next.statusValue);
  if (target.id !== MACCABI_ID) next.captain = false;

  return next;
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

export interface EffectsResult {
  career: Career;
  deltas: AttributeDelta[];
  /** Achievements unlocked as a direct result of the effects. */
  achievements: Achievement[];
}

/** Applies a set of event/offer effects and reports the visible deltas. */
export function applyEffects(career: Career, effects: EventEffects, rng: Rng): EffectsResult {
  const before = career;
  let next = cloneCareer(career);

  if (effects.ability) next.ability = clamp(next.ability + effects.ability);
  if (effects.potential) next.hidden.potential = clamp(next.hidden.potential + effects.potential);
  if (effects.maccabism) next.maccabism = clamp(next.maccabism + effects.maccabism);
  if (effects.reputation) next.reputation = clamp(next.reputation + effects.reputation);
  if (effects.statusValue) next.statusValue = clamp(next.statusValue + effects.statusValue);
  if (effects.confidence) next.hidden.confidence = clamp(next.hidden.confidence + effects.confidence);
  if (effects.form) next.hidden.form = clamp(next.hidden.form + effects.form);
  if (effects.discipline) next.hidden.discipline = clamp(next.hidden.discipline + effects.discipline);
  if (effects.injuryRisk) next.hidden.injuryRisk = clamp(next.hidden.injuryRisk + effects.injuryRisk);
  if (effects.pressure) next.hidden.pressure = clamp(next.hidden.pressure + effects.pressure);
  if (effects.minutesModifier) next.hidden.minutesModifier *= effects.minutesModifier;
  if (effects.transferChance) next.hidden.transferBoost += effects.transferChance;

  if (effects.injuryChance && rng.chance(effects.injuryChance)) {
    next.hidden.injuryRisk = clamp(next.hidden.injuryRisk + 18);
    next.hidden.minutesModifier *= 0.6;
    next.hidden.form = clamp(next.hidden.form - 8);
  }

  if (effects.flags?.length) {
    for (const flag of effects.flags) next = addFlag(next, flag);
  }

  if (effects.captain !== undefined) next.captain = effects.captain;

  if (effects.transferTo && effects.transferTo !== next.currentClubId) {
    next = moveToClub(next, effects.transferTo);
  }

  next.status = statusFromValue(next.statusValue);
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

/** Runs every achievement predicate and grants the ones that just became true. */
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
/* Season progression                                                  */
/* ------------------------------------------------------------------ */

function baseGrowthForAge(age: number): number {
  const band = PROGRESSION.growthByAge.find((b) => age <= b.maxAge);
  return band?.growth ?? -4;
}

export interface ProgressionContext {
  stats: SeasonStats;
  minutesShare: number;
  trophyPoints: number;
}

/**
 * Applies a season's worth of development: ability, reputation, maccabism, status and the
 * hidden attributes. Called by the season engine right after the season is simulated.
 */
export function applySeasonProgression(career: Career, ctx: ProgressionContext, rng: Rng): Career {
  const next = cloneCareer(career);
  const club = getClub(career.currentClubId);
  const { stats, minutesShare, trophyPoints } = ctx;

  /* ---------- ability ---------- */
  const base = baseGrowthForAge(career.age);
  let growth: number;
  if (base > 0) {
    const gap = next.hidden.potential - next.ability;
    const potentialPull = clamp(gap / 22, 0, 1.4) ** PROGRESSION.potentialPullStrength;
    const clubFactor = 1 + ((club.development - 65) / 100) * PROGRESSION.clubDevelopmentSwing * 2;
    const minutesFactor = 1 + (minutesShare - 0.45) * PROGRESSION.minutesSwing * 2;
    const ratingFactor = 1 + ((stats.rating - 55) / 45) * PROGRESSION.ratingSwing;
    const disciplineFactor = 0.85 + (next.hidden.discipline / 100) * 0.3;
    growth =
      base *
      potentialPull *
      Math.max(0.35, clubFactor) *
      Math.max(0.3, minutesFactor) *
      Math.max(0.5, ratingFactor) *
      disciplineFactor *
      rng.range(0.82, 1.2);
  } else {
    // Decline: playing regularly and staying disciplined slows it down.
    const wearFactor = 1 + (next.hidden.injuryRisk - 20) / 160;
    const minutesRelief = minutesShare > 0.4 ? 0.82 : 1.1;
    growth = base * Math.max(0.5, wearFactor) * minutesRelief * rng.range(0.8, 1.2);
  }
  next.ability = clamp(next.ability + growth);
  next.peakAbility = Math.max(next.peakAbility, next.ability);

  /* ---------- reputation ---------- */
  const prestigeFactor = 0.35 + club.prestige / 100;
  let repChange =
    ((stats.rating - 56) / 44) * SEASON.reputationGainMax * prestigeFactor * (0.3 + minutesShare) +
    trophyPoints * 2.2;
  if (minutesShare < 0.15) repChange -= SEASON.reputationDecayNoMinutes;
  // Reputation gravitates towards the level of football you are actually playing.
  const repCeiling = club.prestige + 22 + (next.ability - 70) * 0.5;
  if (next.reputation > repCeiling) repChange -= (next.reputation - repCeiling) * 0.22;
  next.reputation = clamp(next.reputation + repChange);

  /* ---------- maccabism ---------- */
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
  next.maccabism = clamp(next.maccabism + maccabismChange);

  /* ---------- status ---------- */
  const performance = (stats.rating - 57) / 40;
  const exposure = 0.35 + minutesShare;
  let statusChange = performance * SEASON.statusMoveMax * exposure + trophyPoints * 2;
  // Being clearly better (or worse) than the squad around you pulls status too.
  statusChange += clamp((next.ability - club.quality) * 0.35, -6, 6);
  if (career.age >= 33) statusChange -= (career.age - 32) * 0.9;
  next.statusValue = clamp(next.statusValue + statusChange, 2, 100);
  next.status = statusFromValue(next.statusValue);

  /* ---------- hidden ---------- */
  next.hidden.form = clamp(
    next.hidden.form + rng.gaussian(0, PROGRESSION.formVolatility) + (stats.rating - 58) * 0.2,
  );
  const confidenceTarget =
    PROGRESSION.confidenceBaseline + (stats.rating - 58) * 0.8 + minutesShare * 12;
  next.hidden.confidence = clamp(
    next.hidden.confidence +
      (confidenceTarget - next.hidden.confidence) * PROGRESSION.confidenceRecovery,
  );
  next.hidden.injuryRisk = clamp(
    next.hidden.injuryRisk + (career.age > 30 ? 2.2 : 0) + (stats.injuredGames > 0 ? 4 : -1.5),
  );
  next.hidden.pressure = clamp(next.hidden.pressure * 0.9 + (next.statusValue - 50) * 0.08);
  // One-season modifiers expire.
  next.hidden.minutesModifier = 1;
  next.hidden.transferBoost = Math.max(0, next.hidden.transferBoost - 0.35);

  next.ability = round(next.ability, 2);
  next.maccabism = round(next.maccabism, 2);
  next.reputation = round(next.reputation, 2);
  next.statusValue = round(next.statusValue, 2);

  return next;
}

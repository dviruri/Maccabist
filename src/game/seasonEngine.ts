/**
 * Season simulator.
 *
 * A season is played in two halves so the mid-season card can report real numbers and the
 * second half can respond to whatever the mid-season event did. We never simulate individual
 * matches - a half is generated from position, ability, role, coach trust, level and luck.
 */

import { getClub } from '../data/clubs';
import { TROPHY_DEFS } from '../data/trophies';
import type { Career, SeasonRecord, SeasonStats, Trophy } from '../types';
import { POSITIONS, SEASON } from './balance';
import {
  applyHalfProgression,
  checkAchievements,
  cloneCareer,
  type HalfContext,
} from './progressionEngine';
import { clamp, round, type Rng } from './random';
import { ageMinutesModifier, countsForMaccabiLegacy, levelContext, playerLevel } from './rules';

export const EMPTY_STATS: SeasonStats = {
  appearances: 0,
  starts: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  goalsConceded: 0,
  rating: 0,
  injuredGames: 0,
};

/** Share of the team's games the player is expected to feature in, 0-1. */
export function computeMinutesShare(career: Career, rng: Rng): number {
  const level = levelContext(career);
  const raw = SEASON.minutesBase + (playerLevel(career) - level.quality) / SEASON.minutesSpread;
  // The age curve models competing with grown men. Inside your own age group it does not apply.
  const withAge = level.isAcademy ? raw : raw * ageMinutesModifier(career.age);
  const withForm = withAge * (0.9 + career.hidden.form / 500 + career.hidden.confidence / 700);
  const withOlderGroup = withForm * SEASON.olderGroupMinutesPenalty[career.olderGroup];
  const withEvents = withOlderGroup * career.hidden.minutesModifier;
  const noisy = withEvents * rng.range(0.88, 1.12);
  const floor = level.isAcademy ? SEASON.youthMinutesFloor : SEASON.minutesMin;
  return clamp(noisy, floor, SEASON.minutesMax) as number;
}

function expectedOutputPerApp(career: Career, quality: number): number {
  const config = POSITIONS[career.position];
  const abilityFactor = clamp((career.ability / 70) ** 1.5, 0.2, 2.4) as number;
  const clubFactor = 0.7 + quality / 190;
  return (config.goalRate + config.assistRate * 0.7) * abilityFactor * clubFactor;
}

export interface SimulatedHalf {
  stats: SeasonStats;
  minutesShare: number;
}

/** Pure statistics generator for half a season - no career mutation. */
export function simulateHalfStats(career: Career, rng: Rng, games: number): SimulatedHalf {
  const level = levelContext(career);
  const config = POSITIONS[career.position];

  const injuryChance = clamp(career.hidden.injuryRisk / SEASON.injuryDivisor, 0.02, 0.6) as number;
  const injuredGames = rng.chance(injuryChance * 0.6)
    ? Math.min(games, rng.int(SEASON.injuryGamesMin, SEASON.injuryGamesMax))
    : 0;

  const minutesShare = computeMinutesShare(career, rng);
  const availableGames = Math.max(0, games - injuredGames);
  const appearances = Math.round(availableGames * minutesShare);
  const starts = Math.round(appearances * clamp(0.45 + minutesShare * 0.6, 0, 1));

  const abilityFactor = clamp((career.ability / 70) ** 1.5, 0.2, 2.4) as number;
  const formFactor = 0.75 + career.hidden.form / 220 + career.hidden.confidence / 400;
  const clubFactor = 0.7 + level.quality / 190;
  const scale = abilityFactor * formFactor * clubFactor;

  const expectedGoals = appearances * config.goalRate * scale;
  const expectedAssists = appearances * config.assistRate * scale;
  const goals = Math.max(0, Math.round(rng.gaussian(expectedGoals, expectedGoals * 0.55 + 0.9)));
  const assists = Math.max(0, Math.round(rng.gaussian(expectedAssists, expectedAssists * 0.55 + 0.8)));

  const cleanSheetBase = config.cleanSheetRate * (0.5 + level.quality / 140);
  const cleanSheets =
    config.cleanSheetRate > 0
      ? Math.max(0, Math.round(rng.gaussian(starts * cleanSheetBase, starts * 0.1 + 0.6)))
      : 0;

  // Goalkeepers are also judged on what goes past them.
  const concededPerGame = config.concededRate * (1.35 - level.quality / 150) * (1.25 - abilityFactor * 0.22);
  const goalsConceded =
    config.concededRate > 0
      ? Math.max(0, Math.round(rng.gaussian(starts * Math.max(0.25, concededPerGame), starts * 0.2 + 1)))
      : 0;

  /* ---------------- rating ---------------- */
  let rating =
    SEASON.ratingBase +
    (career.ability - 50) * SEASON.ratingAbilityWeight +
    (career.hidden.form - 55) * SEASON.ratingFormWeight +
    (career.hidden.confidence - 55) * SEASON.ratingConfidenceWeight;

  if (appearances >= 4) {
    const actualPerApp = (goals + assists * 0.7) / appearances;
    const expectedPerApp = expectedOutputPerApp(career, level.quality);
    const outputDelta = clamp(
      expectedPerApp > 0 ? (actualPerApp - expectedPerApp) / expectedPerApp : 0,
      -1,
      1.2,
    ) as number;
    rating += outputDelta * SEASON.ratingOutputWeight * config.outputWeight;

    if (career.position === 'GK' || career.position === 'CB' || career.position === 'FB') {
      const csRate = starts > 0 ? cleanSheets / starts : 0;
      rating += (csRate - config.cleanSheetRate) * 40;
    }
  } else {
    rating -= 6; // barely played - nobody rates you highly
  }

  rating += rng.gaussian(0, SEASON.ratingNoise);
  rating = clamp(rating, 20, 99) as number;

  return {
    stats: {
      appearances,
      starts,
      goals,
      assists,
      cleanSheets,
      goalsConceded,
      rating: round(rating, 1),
      injuredGames,
    },
    minutesShare: round(minutesShare, 3),
  };
}

export function mergeStats(a: SeasonStats, b: SeasonStats): SeasonStats {
  const totalApps = a.appearances + b.appearances;
  const rating =
    totalApps > 0
      ? (a.rating * a.appearances + b.rating * b.appearances) / totalApps
      : (a.rating + b.rating) / 2;
  return {
    appearances: totalApps,
    starts: a.starts + b.starts,
    goals: a.goals + b.goals,
    assists: a.assists + b.assists,
    cleanSheets: a.cleanSheets + b.cleanSheets,
    goalsConceded: a.goalsConceded + b.goalsConceded,
    rating: round(rating, 1),
    injuredGames: a.injuredGames + b.injuredGames,
  };
}

/* ------------------------------------------------------------------ */
/* Trophies                                                            */
/* ------------------------------------------------------------------ */

function rollTrophies(career: Career, stats: SeasonStats, rng: Rng): Trophy[] {
  const level = levelContext(career);
  const club = career.currentClubId;
  const trophies: Trophy[] = [];
  const minutesShare = level.seasonGames > 0 ? stats.appearances / level.seasonGames : 0;
  if (minutesShare < 0.15 || stats.appearances < 5) return trophies;

  const contribution = clamp(0.75 + (career.ability - level.quality) / 90, 0.7, 1.35) as number;
  const add = (defId: string): void => {
    const def = TROPHY_DEFS[defId];
    if (!def) return;
    trophies.push({
      id: def.id,
      name: def.name,
      season: career.currentSeason,
      clubId: club,
      clubName: level.teamName,
      weight: def.weight,
    });
  };

  const isIsraeli = level.isAcademy || level.league.includes('ליג');
  if (rng.chance(level.titleChance * contribution)) {
    add(level.isAcademy ? 'youth_championship' : isIsraeli ? 'championship' : 'foreign_championship');
  }
  if (rng.chance(level.cupChance * contribution)) {
    add(level.isAcademy ? 'youth_cup' : isIsraeli ? 'cup' : 'foreign_cup');
  }
  if (level.europeChance > 0 && rng.chance(level.europeChance * contribution)) {
    add(rng.chance(0.2) ? 'champions_league' : 'european_run');
  }

  return trophies;
}

/* ------------------------------------------------------------------ */
/* Half / season steps                                                 */
/* ------------------------------------------------------------------ */

function accumulateCareerTotals(career: Career, stats: SeasonStats): Career {
  const next = cloneCareer(career);
  next.stats.appearances += stats.appearances;
  next.stats.goals += stats.goals;
  next.stats.assists += stats.assists;
  next.stats.cleanSheets += stats.cleanSheets;

  if (countsForMaccabiLegacy(career)) {
    next.maccabi.appearances += stats.appearances;
    next.maccabi.goals += stats.goals;
    next.maccabi.assists += stats.assists;
    next.maccabi.cleanSheets += stats.cleanSheets;
    if (stats.appearances > 0 && next.maccabi.debutAge === null) {
      next.maccabi.debutAge = career.age;
    }
  }
  return next;
}

/** Simulates and applies the first half of the season. */
export function playFirstHalf(career: Career, rng: Rng): Career {
  const level = levelContext(career);
  const games = Math.round(level.seasonGames / 2);
  const half = simulateHalfStats(career, rng, games);

  let next = accumulateCareerTotals(career, half.stats);
  next = applyHalfProgression(
    next,
    { stats: half.stats, minutesShare: half.minutesShare, trophyPoints: 0, fraction: 0.5 },
    rng,
  );
  next = cloneCareer(next);
  next.firstHalfStats = half.stats;
  return next;
}

export interface SeasonEnd {
  career: Career;
  record: SeasonRecord;
}

/** Simulates the second half, then closes the season and writes the record. */
export function playSecondHalf(career: Career, rng: Rng): SeasonEnd {
  const level = levelContext(career);
  const games = level.seasonGames - Math.round(level.seasonGames / 2);
  const half = simulateHalfStats(career, rng, games);
  const first = career.firstHalfStats ?? EMPTY_STATS;
  const full = mergeStats(first, half.stats);

  const trophies = rollTrophies(career, full, rng);
  const trophyPoints = trophies.reduce((sum, t) => sum + t.weight, 0);

  let next = accumulateCareerTotals(career, half.stats);
  next.trophies.push(...trophies);

  /* ---------------- Maccabi legacy (season level) ---------------- */
  if (countsForMaccabiLegacy(career)) {
    if (full.appearances > 0 && next.captain) {
      next.maccabi.captainSeasons += 1;
      next.captainSeasons += 1;
    }
    if (full.appearances >= SEASON.minAppearancesForSeason) {
      next.maccabi.seasons += 1;
      if (next.maccabi.returned) next.maccabi.seasonsAfterReturn += 1;
    }
    for (const trophy of trophies) {
      if (trophy.id === 'championship') next.maccabi.championships += 1;
      if (trophy.id === 'cup') next.maccabi.cups += 1;
      if (trophy.id === 'european_run' || trophy.id === 'champions_league') {
        next.maccabi.europeanRuns += 1;
      }
    }
  } else if (next.captain && full.appearances > 0) {
    next.captainSeasons += 1;
  }

  const halfCtx: HalfContext = {
    stats: half.stats,
    minutesShare: half.minutesShare,
    trophyPoints,
    fraction: 0.5,
  };
  next = applyHalfProgression(next, halfCtx, rng);

  const record: SeasonRecord = {
    season: career.currentSeason,
    age: career.age,
    academyStage: career.academyStage,
    clubId: career.currentClubId,
    clubName: getClub(career.currentClubId).name,
    teamName: level.teamName,
    league: level.league,
    onLoan: career.parentClubId !== null,
    stats: full,
    firstHalf: first,
    ability: Math.round(next.ability),
    role: next.role,
    trophies,
    captain: career.captain,
    olderGroup: career.olderGroup,
  };

  next = cloneCareer(next);
  next.seasonHistory.push(record);
  next.lastSeasonRecord = record;
  next.firstHalfStats = null;

  const checked = checkAchievements(next);
  next = checked.career;
  next.lastAchievements = checked.unlocked;

  return { career: next, record };
}

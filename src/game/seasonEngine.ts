/**
 * Season simulator.
 * We do not simulate individual matches - we generate a believable season from
 * position, ability, status, club quality, age and a controlled dose of randomness.
 */

import { getClub } from '../data/clubs';
import { TROPHY_DEFS } from '../data/trophies';
import type { Career, SeasonRecord, SeasonStats, Trophy } from '../types';
import { POSITIONS, SEASON } from './balance';
import { applySeasonProgression, checkAchievements, cloneCareer } from './progressionEngine';
import { clamp, round, type Rng } from './random';
import { ageMinutesModifier, countsForMaccabiLegacy, playerLevel } from './rules';

/** Share of the club's games the player is expected to feature in, 0-1. */
export function computeMinutesShare(career: Career, rng: Rng): number {
  const club = getClub(career.currentClubId);
  const youthLevel = club.tier === 'academy' || club.tier === 'youth';
  const level = playerLevel(career);
  const raw = SEASON.minutesBase + (level - club.quality) / SEASON.minutesSpread;
  // The age curve models competing with grown men. Inside your own age group it does not apply.
  const withAge = youthLevel ? raw : raw * ageMinutesModifier(career.age);
  const withForm = withAge * (0.9 + career.hidden.form / 500 + career.hidden.confidence / 700);
  const withEvents = withForm * career.hidden.minutesModifier;
  const noisy = withEvents * rng.range(0.88, 1.12);
  // Everyone gets a run-out in the academy - that is the point of an academy.
  const floor = youthLevel ? SEASON.youthMinutesFloor : SEASON.minutesMin;
  return clamp(noisy, floor, SEASON.minutesMax) as number;
}

function expectedOutputPerApp(career: Career, clubQuality: number): number {
  const config = POSITIONS[career.position];
  const abilityFactor = clamp((career.ability / 70) ** 1.5, 0.2, 2.4) as number;
  const clubFactor = 0.7 + clubQuality / 190;
  return (config.goalRate + config.assistRate * 0.7) * abilityFactor * clubFactor;
}

export interface SimulatedSeason {
  stats: SeasonStats;
  minutesShare: number;
  trophies: Trophy[];
  trophyPoints: number;
}

/** Pure statistics generator - no career mutation. Handy for balancing sweeps. */
export function simulateSeasonStats(career: Career, rng: Rng): SimulatedSeason {
  const club = getClub(career.currentClubId);
  const config = POSITIONS[career.position];

  /* ---------------- injuries ---------------- */
  const injuryChance = clamp(career.hidden.injuryRisk / SEASON.injuryDivisor, 0.02, 0.6) as number;
  const injuredGames = rng.chance(injuryChance)
    ? rng.int(SEASON.injuryGamesMin, SEASON.injuryGamesMax)
    : 0;

  /* ---------------- playing time ---------------- */
  const minutesShare = computeMinutesShare(career, rng);
  const availableGames = Math.max(0, club.seasonGames - injuredGames);
  const appearances = Math.round(availableGames * minutesShare);
  const starts = Math.round(appearances * clamp(0.45 + minutesShare * 0.6, 0, 1));

  /* ---------------- output ---------------- */
  const abilityFactor = clamp((career.ability / 70) ** 1.5, 0.2, 2.4) as number;
  const formFactor = 0.75 + career.hidden.form / 220 + career.hidden.confidence / 400;
  const clubFactor = 0.7 + club.quality / 190;
  const scale = abilityFactor * formFactor * clubFactor;

  const expectedGoals = appearances * config.goalRate * scale;
  const expectedAssists = appearances * config.assistRate * scale;
  const goals = Math.max(0, Math.round(rng.gaussian(expectedGoals, expectedGoals * 0.55 + 1.2)));
  const assists = Math.max(0, Math.round(rng.gaussian(expectedAssists, expectedAssists * 0.55 + 1)));

  const cleanSheetBase = config.cleanSheetRate * (0.5 + club.quality / 140);
  const cleanSheets =
    config.cleanSheetRate > 0
      ? Math.max(0, Math.round(rng.gaussian(starts * cleanSheetBase, starts * 0.1 + 0.8)))
      : 0;

  /* ---------------- rating ---------------- */
  let rating =
    SEASON.ratingBase +
    (career.ability - 50) * SEASON.ratingAbilityWeight +
    (career.hidden.form - 55) * SEASON.ratingFormWeight;

  if (appearances >= 5) {
    const actualPerApp = (goals + assists * 0.7) / appearances;
    const expectedPerApp = expectedOutputPerApp(career, club.quality);
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

  /* ---------------- trophies ---------------- */
  const trophies: Trophy[] = [];
  const involved = minutesShare >= 0.15 && appearances >= 5;
  const contribution = clamp(0.75 + (career.ability - club.quality) / 90, 0.7, 1.35) as number;

  const addTrophy = (defId: string): void => {
    const def = TROPHY_DEFS[defId];
    if (!def) return;
    trophies.push({
      id: def.id,
      name: def.name,
      season: career.currentSeason,
      clubId: club.id,
      clubName: club.name,
      weight: def.weight,
    });
  };

  if (involved) {
    const isYouthLevel = club.tier === 'academy' || club.tier === 'youth';
    if (rng.chance(club.titleChance * contribution)) {
      addTrophy(isYouthLevel ? 'youth_championship' : club.isMaccabi || club.country === 'ישראל' ? 'championship' : 'foreign_championship');
    }
    if (rng.chance(club.cupChance * contribution)) {
      addTrophy(isYouthLevel ? 'youth_cup' : club.country === 'ישראל' ? 'cup' : 'foreign_cup');
    }
    if (club.europeChance > 0 && rng.chance(club.europeChance * contribution)) {
      addTrophy(club.tier === 'euro_top' && rng.chance(0.25) ? 'champions_league' : 'european_run');
    }
  }

  const trophyPoints = trophies.reduce((sum, t) => sum + t.weight, 0);

  return {
    stats: {
      appearances,
      starts,
      goals,
      assists,
      cleanSheets,
      rating: round(rating, 1),
      injuredGames,
    },
    minutesShare: round(minutesShare, 3),
    trophies,
    trophyPoints,
  };
}

export interface SeasonResult {
  career: Career;
  record: SeasonRecord;
}

/**
 * Full season step: simulate, fold the numbers into the career totals,
 * apply development, unlock achievements.
 */
export function playSeason(career: Career, rng: Rng): SeasonResult {
  const club = getClub(career.currentClubId);
  const sim = simulateSeasonStats(career, rng);
  const onLoan = career.parentClubId !== null;

  let next = cloneCareer(career);

  /* ---------------- career totals ---------------- */
  next.stats.appearances += sim.stats.appearances;
  next.stats.goals += sim.stats.goals;
  next.stats.assists += sim.stats.assists;
  next.stats.cleanSheets += sim.stats.cleanSheets;
  next.trophies.push(...sim.trophies);

  /* ---------------- Maccabi legacy ---------------- */
  if (countsForMaccabiLegacy(club.id, onLoan)) {
    next.maccabi.appearances += sim.stats.appearances;
    next.maccabi.goals += sim.stats.goals;
    next.maccabi.assists += sim.stats.assists;
    next.maccabi.cleanSheets += sim.stats.cleanSheets;
    if (sim.stats.appearances > 0) {
      if (next.maccabi.debutAge === null) next.maccabi.debutAge = career.age;
      if (next.captain) {
        next.maccabi.captainSeasons += 1;
        next.captainSeasons += 1;
      }
    }
    // A couple of cup cameos is not "a season in green".
    if (sim.stats.appearances >= SEASON.minAppearancesForSeason) {
      next.maccabi.seasons += 1;
      if (next.maccabi.returned) next.maccabi.seasonsAfterReturn += 1;
    }
    for (const trophy of sim.trophies) {
      if (trophy.id === 'championship') next.maccabi.championships += 1;
      if (trophy.id === 'cup') next.maccabi.cups += 1;
      if (trophy.id === 'european_run' || trophy.id === 'champions_league')
        next.maccabi.europeanRuns += 1;
    }
  } else if (next.captain && sim.stats.appearances > 0) {
    next.captainSeasons += 1;
  }

  /* ---------------- development ---------------- */
  next = applySeasonProgression(
    next,
    { stats: sim.stats, minutesShare: sim.minutesShare, trophyPoints: sim.trophyPoints },
    rng,
  );

  const record: SeasonRecord = {
    season: career.currentSeason,
    age: career.age,
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    onLoan,
    stats: sim.stats,
    ability: Math.round(next.ability),
    status: next.status,
    trophies: sim.trophies,
    captain: career.captain,
  };

  next.seasonHistory.push(record);
  next.lastSeasonRecord = record;

  const checked = checkAchievements(next);
  next = checked.career;
  next.lastAchievements = checked.unlocked;

  return { career: next, record };
}

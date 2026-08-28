/**
 * Season simulator.
 *
 * A season is played in two halves so the mid-season card can report real numbers and the
 * second half can respond to whatever the mid-season event did. We never simulate individual
 * matches - a half is generated from position, ability, role, coach trust, level and luck.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { clubDisplayName, currentTeamDisplay } from './identity';
import { TROPHY_DEFS } from '../data/trophies';
import type { Career, SeasonRecord, SeasonStats, Trophy } from '../types';
import { POSITIONS, SEASON, TRAITS } from './balance';
import { hasTrait } from './memory';
import { creditParticipation, needsAppearanceReconciliation } from './participation';
import { checkMilestones } from './milestones';
import { checkTraitReveals } from './traitReveal';
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

  const injuryProne = hasTrait(career, 'injury_prone') ? TRAITS.injuryProneRisk : 1;
  const injuryChance = clamp(
    (career.hidden.injuryRisk / SEASON.injuryDivisor) * injuryProne,
    0.02,
    0.6,
  ) as number;
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
  /*
   * Output uses a real normal (v0.4.5.1), so a striker can have the season nobody saw coming.
   *
   * `rng.gaussian` is the sum of three uniforms: it delivers about a third of its nominal spread
   * as standard deviation and is hard-capped at +/- that spread. With an expectation of 10 goals
   * it could not produce fewer than 4 or more than 16, ever - no freak seasons in either
   * direction.
   *
   * The multiplier matches the OLD *effective* spread, not the old nominal one. Bounded `gaussian`
   * delivers roughly a third of its parameter as standard deviation, so 0.55 there was about 0.18
   * in practice; carrying 0.55 across to a true normal tripled the variance and produced 103-goal
   * seasons. 0.2 reproduces the old central spread and adds the tail that was missing.
   */
  const goals = Math.max(0, Math.round(rng.normal(expectedGoals, expectedGoals * 0.2 + 0.6)));
  const assists = Math.max(0, Math.round(rng.normal(expectedAssists, expectedAssists * 0.2 + 0.5)));

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
    /*
     * Goal contribution is not how a goalkeeper is judged (v0.4.1).
     *
     * `outputWeight: 0.15` was meant to make output matter *less* for a keeper. In practice a
     * keeper records zero goals and assists while `expectedOutputPerApp` is non-zero, so
     * outputDelta clamped to -1 every single season and the "reduced weight" became a fixed
     * -2.4 rating tax for failing to do something the model never expected him to do. A keeper
     * is measured by the clean-sheet and conceded terms below instead.
     */
    if (config.outputWeight > 0) {
      const actualPerApp = (goals + assists * 0.7) / appearances;
      const expectedPerApp = expectedOutputPerApp(career, level.quality);
      const outputDelta = clamp(
        expectedPerApp > 0 ? (actualPerApp - expectedPerApp) / expectedPerApp : 0,
        -1,
        1.2,
      ) as number;
      rating += outputDelta * SEASON.ratingOutputWeight * config.outputWeight;
    }

    if (career.position === 'GK' || career.position === 'CB' || career.position === 'FB') {
      const csRate = starts > 0 ? cleanSheets / starts : 0;
      rating += (csRate - config.cleanSheetRate) * 40;
    }
  } else {
    rating -= 6; // barely played - nobody rates you highly
  }

  // The bigger the stage, the better some players get.
  if (hasTrait(career, 'big_game') && level.prestige >= 55) rating += TRAITS.bigGameRating;

  /*
   * A real normal (v0.4.5.1). The bounded `gaussian` turned SEASON.ratingNoise = 7 into an actual
   * standard deviation of 2.33 with a hard cap at +/-6.9, so a season could never land more than
   * seven rating points away from what ability, form and confidence already predicted. There were
   * no breakthrough seasons and no collapses - only the state, plus a small wobble.
   */
  rating += rng.normal(0, SEASON.ratingNoise);
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

/**
 * Did the club win its league this season, according to the only system that decides that?
 *
 * Reads the season projection, which v0.4.6 commits at preseason and derives from the final table
 * position. Returns false when there is no projection at all, which is the right answer: a club
 * whose league has no modelled table cannot be its champion.
 */
function wonLeagueThisSeason(career: Career): boolean {
  const projection = career.world.projection;
  if (!projection || projection.season !== career.currentSeason) return false;
  if (projection.clubId !== career.currentClubId) return false;
  return projection.finalOutcome === 'champion';
}

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
      clubName: clubDisplayName(club),
      weight: def.weight,
    });
  };

  /*
   * v0.4.8: Israeli-or-not comes from the club's country, not from the league's Hebrew name.
   *
   * This was `level.league.includes('ליג')`, which is a substring test on a display string. It is
   * the same class of mistake that made the retirement screen count academy seasons as European
   * football, and it decided whether a trophy was an Israeli championship or a foreign one.
   */
  const isIsraeli = level.isAcademy || getClub(club).country === 'ישראל';

  /*
   * THE LEAGUE TITLE IS NOT ROLLED (v0.4.8).
   *
   * It was: `rng.chance(level.titleChance * contribution)`, where titleChance is a fixed number
   * on the club record. That is a second opinion about a fact the league table already owns, and
   * the two disagreed - a Maccabi Herzliya career finished 5th in Liga Leumit and was handed a
   * championship celebration.
   *
   * The season's outcome is committed at preseason by `projectSeason` and cannot leave its band,
   * so `finalOutcome` here is the outcome that will be recorded. One source, read rather than
   * re-rolled.
   *
   * Age-group football keeps a roll, because an age group has no league table to read - and its
   * trophy is a `youth_championship`, which is a different competition rather than the same one
   * decided differently.
   */
  if (level.isAcademy) {
    if (rng.chance(level.titleChance * contribution)) add('youth_championship');
  } else if (wonLeagueThisSeason(career)) {
    add(isIsraeli ? 'championship' : 'foreign_championship');
  }

  /*
   * The cup stays a roll, and that is deliberate: no cup competition is modelled, so there is no
   * authoritative table to read it from. What matters is that it keeps its own identity - a cup is
   * never labelled אליפות.
   */
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
  /*
   * The participation ledger (v0.4.8). From here on, the mid and late slots can ask a factual
   * question instead of a projected one: did he actually play?
   */
  next.seasonParticipation = creditParticipation(next, half.stats.appearances, half.stats.starts);
  return next;
}

export interface SeasonEnd {
  career: Career;
  record: SeasonRecord;
}

/**
 * How many of these trophies the career holds for Maccabi Haifa.
 *
 * Read over the trophy list, which is the authoritative record of what was actually won.
 */
function countMaccabiTrophies(career: Career, ...ids: string[]): number {
  return career.trophies.filter((t) => t.clubId === MACCABI_ID && ids.includes(t.id)).length;
}

/** Simulates the second half, then closes the season and writes the record. */
export function playSecondHalf(career: Career, rng: Rng): SeasonEnd {
  const level = levelContext(career);
  const games = level.seasonGames - Math.round(level.seasonGames / 2);
  const half = simulateHalfStats(career, rng, games);
  const first = career.firstHalfStats ?? EMPTY_STATS;
  let full = mergeStats(first, half.stats);

  /*
   * Reconciliation (v0.4.8, Phase 3.4).
   *
   * If an on-field event fired this season, the player has already been told he was on the pitch.
   * When the statistics then come out at zero the statistics are the thing that is wrong, and the
   * season is credited with the appearance the event described rather than settling into a
   * summary that contradicts what he just read.
   *
   * The gate makes this rare - it should only happen when the noise-free projection said "he will
   * play" and the noisy roll disagreed - but rare is not never, and a contradiction a player can
   * see is worth one appearance.
   */
  if (needsAppearanceReconciliation(career, full.appearances)) {
    full = { ...full, appearances: 1, starts: Math.max(full.starts, 0) };
  }

  const trophies = rollTrophies(career, full, rng);
  const trophyPoints = trophies.reduce((sum, t) => sum + t.weight, 0);

  let next = accumulateCareerTotals(career, half.stats);
  // The ledger closes on the full season's football, reconciliation included.
  next.seasonParticipation = {
    ...creditParticipation(next, half.stats.appearances, half.stats.starts),
    appearances: full.appearances,
    starts: full.starts,
  };
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
  } else if (next.captain && full.appearances > 0) {
    next.captainSeasons += 1;
  }

  /*
   * The Maccabi trophy counters, recomputed from the trophy list rather than incremented (v0.4.8).
   *
   * They used to be incremented inside the `countsForMaccabiLegacy` branch, which requires
   * `parentClubId === null` - so a title won *on loan at Maccabi* awarded a trophy with
   * `clubId: maccabi_haifa` and incremented nothing. The 50,000-career scan found 8 careers like
   * it; seed 3119 spends 2045 at Maccabi between two Benfica seasons, wins the league, and the
   * counter stayed at zero while the trophy list held one.
   *
   * Recomputing removes the class of bug rather than the instance: the trophy list is the
   * authoritative record, and a derived counter that is *recalculated* from it cannot drift from
   * it, whereas one that is incremented can drift in any branch anyone adds later.
   *
   * Whether a loan spell counts toward `maccabi.seasons` is a separate judgement and is left
   * alone - a medal is a fact, "a season of his Maccabi career" is a design decision.
   */
  next.maccabi.championships = countMaccabiTrophies(next, 'championship');
  next.maccabi.cups = countMaccabiTrophies(next, 'cup');
  next.maccabi.europeanRuns = countMaccabiTrophies(next, 'european_run', 'champions_league');

  const halfCtx: HalfContext = {
    stats: half.stats,
    minutesShare: half.minutesShare,
    trophyPoints,
    fraction: 0.5,
  };
  next = applyHalfProgression(next, halfCtx, rng);

  const identity = currentTeamDisplay(career);

  const record: SeasonRecord = {
    season: career.currentSeason,
    age: career.age,
    academyStage: career.academyStage,
    clubId: career.currentClubId,
    /*
     * Both names come from the identity module (v0.4.1), so a record stores the club without an
     * age-group suffix baked into it and the age group separately. A history row can then be
     * rendered with the wording that was correct for that season without re-deriving anything.
     */
    clubName: identity.club,
    teamName: identity.team ?? identity.club,
    league: level.league,
    onLoan: career.parentClubId !== null,
    stats: full,
    firstHalf: first,
    ability: Math.round(next.ability),
    role: next.role,
    coachTrust: Math.round(next.coachTrust),
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
  // The structural story beats fall out of the season, not out of events.
  next = checkMilestones(next).career;
  // ...and so does noticing what kind of player he turned out to be.
  next = checkTraitReveals(next);

  return { career: next, record };
}

/**
 * The football world outside the player (v0.4).
 *
 * A season-level simulation, not a match engine. Every season the player's club gets a
 * *category* of finish, drawn from its strength against its league, with the player nudging
 * the odds in proportion to how important he actually was. That is enough to give a career
 * real context - a relegation to fight out of, a promotion to be part of, a European place
 * that changes what offers arrive - without running fixtures for leagues nobody sees.
 *
 * Cheap by design: a handful of RNG calls per season, so 100,000 careers stay practical.
 */

import { getClub } from '../data/clubs';
import { defaultLeagueFor, getLeague, type League } from '../data/leagues';
import type { Career, ClubSeasonOutcome, ClubSeasonResult, SeasonRecord, WorldState } from '../types';
import { WORLD } from './balance';
import { clamp, type Rng } from './random';

/* ------------------------------------------------------------------ */
/* League lookup                                                       */
/* ------------------------------------------------------------------ */

export function emptyWorld(): WorldState {
  return { clubLeagues: {}, clubSeasons: [] };
}

/** Which league a club is in right now, after any promotions or relegations this career. */
export function leagueOf(world: WorldState, clubId: string): League {
  const moved = world.clubLeagues[clubId];
  if (moved) return getLeague(moved);
  const club = getClub(clubId);
  return getLeague(defaultLeagueFor(club.tier, club.country));
}

export function playerLeague(career: Career): League {
  return leagueOf(career.world, career.currentClubId);
}

/* ------------------------------------------------------------------ */
/* How good is this club, for this league?                             */
/* ------------------------------------------------------------------ */

/**
 * A club's standing relative to the division it is in, roughly -1..+1.
 *
 * This is what makes promotion and relegation matter: the same club is a title contender in
 * the second division and a relegation candidate in the first.
 */
export function clubStrengthVsLeague(world: WorldState, clubId: string): number {
  const club = getClub(clubId);
  const league = leagueOf(world, clubId);
  return clamp((club.quality - league.quality) / WORLD.strengthSpread, -1, 1);
}

/**
 * How much the player moved his club's season, 0-1.
 *
 * A backup barely registers; a star who played almost every game and performed clearly does.
 * Deliberately reads role, minutes and performance together, so a big name who sat out the
 * season does not get credit for the title.
 */
export function playerImpact(career: Career, record: SeasonRecord | null): number {
  if (!record) return 0;
  const league = leagueOf(career.world, record.clubId);
  const games = Math.max(1, getClub(record.clubId).seasonGames);

  const share = clamp(record.stats.appearances / games, 0, 1);
  if (share < WORLD.impactMinShare) return 0;

  // How far above the level he actually is.
  const edge = clamp((record.ability - league.quality) / WORLD.impactEdgeSpread, -0.5, 1);
  const performance = clamp((record.stats.rating - 58) / 30, -0.5, 1);
  const standing = clamp((record.coachTrust - 45) / 60, -0.3, 0.6);

  const raw = share * (edge * 0.55 + performance * 0.3 + standing * 0.15);
  return clamp(raw * WORLD.impactScale, 0, WORLD.impactMax);
}

/* ------------------------------------------------------------------ */
/* The season result                                                   */
/* ------------------------------------------------------------------ */

const TOP_OUTCOMES: readonly ClubSeasonOutcome[] = [
  'relegated',
  'relegation_battle',
  'lower_table',
  'mid_table',
  'upper_table',
  'european_places',
  'title_challenge',
  'champion',
];

const SECOND_OUTCOMES: readonly ClubSeasonOutcome[] = [
  'struggled',
  'second_mid_table',
  'promotion_challenge',
  'promoted',
];

const OUTCOME_LABELS: Record<ClubSeasonOutcome, string> = {
  champion: 'אלופה',
  title_challenge: 'מאבק על האליפות',
  european_places: 'מאבק על מקומות אירופה',
  upper_table: 'חלק עליון בטבלה',
  mid_table: 'אמצע הטבלה',
  lower_table: 'חלק תחתון בטבלה',
  relegation_battle: 'מאבק הישרדות',
  relegated: 'ירידה ליגה',
  promoted: 'עלייה ליגה',
  promotion_challenge: 'מאבק על עלייה',
  second_mid_table: 'אמצע הטבלה',
  struggled: 'עונה קשה',
};

export function outcomeLabel(outcome: ClubSeasonOutcome): string {
  return OUTCOME_LABELS[outcome];
}

/** Outcomes that are good enough to be worth remembering. */
export function isGoodSeason(outcome: ClubSeasonOutcome): boolean {
  return ['champion', 'title_challenge', 'european_places', 'promoted', 'promotion_challenge'].includes(
    outcome,
  );
}

export function isBadSeason(outcome: ClubSeasonOutcome): boolean {
  return ['relegated', 'relegation_battle', 'struggled'].includes(outcome);
}

/**
 * Draws a season result for the player's club.
 *
 * A normal distribution over the ladder of outcomes: the club's strength for its division sets
 * the centre, the player's impact nudges it up, and season variance does the rest. Cheap, and
 * it produces the right shape - strong clubs usually finish high but occasionally implode.
 */
export function simulateClubSeason(
  career: Career,
  record: SeasonRecord | null,
  rng: Rng,
): ClubSeasonResult {
  const clubId = career.currentClubId;
  const league = leagueOf(career.world, clubId);
  const ladder = league.tier >= 2 ? SECOND_OUTCOMES : TOP_OUTCOMES;

  const strength = clubStrengthVsLeague(career.world, clubId);
  const impact = playerImpact(career, record);

  // Centre of the distribution, in ladder positions.
  const centre =
    (ladder.length - 1) / 2 +
    strength * WORLD.strengthToPositions +
    impact * WORLD.impactToPositions;

  const noisy = centre + rng.gaussian(0, WORLD.seasonVariance);
  const index = Math.round(clamp(noisy, 0, ladder.length - 1));
  const outcome = ladder[index] as ClubSeasonOutcome;

  return {
    season: career.currentSeason,
    clubId,
    leagueId: league.id,
    outcome,
    label: OUTCOME_LABELS[outcome],
    playerImpact: Math.round(impact * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Promotion and relegation                                            */
/* ------------------------------------------------------------------ */

/**
 * Moves a club between divisions after its season. Returns the world state; unchanged unless
 * the club actually went up or down.
 */
export function applyPromotionRelegation(world: WorldState, result: ClubSeasonResult): WorldState {
  const league = getLeague(result.leagueId);

  if (result.outcome === 'relegated' && league.relegatesTo) {
    return {
      ...world,
      clubLeagues: { ...world.clubLeagues, [result.clubId]: league.relegatesTo },
    };
  }
  if (result.outcome === 'promoted' && league.promotesTo) {
    return {
      ...world,
      clubLeagues: { ...world.clubLeagues, [result.clubId]: league.promotesTo },
    };
  }
  return world;
}

/** Records a club season and applies any division change it caused. */
export function recordClubSeason(career: Career, result: ClubSeasonResult): WorldState {
  const withSeason: WorldState = {
    ...career.world,
    clubSeasons: [...career.world.clubSeasons, result].slice(-WORLD.keepClubSeasons),
  };
  return applyPromotionRelegation(withSeason, result);
}

/** The most recent club season, if there is one. */
export function lastClubSeason(career: Career): ClubSeasonResult | null {
  return career.world.clubSeasons[career.world.clubSeasons.length - 1] ?? null;
}

import { getClub } from '../data/clubs';
import { defaultLeagueFor, getLeague, type League } from '../data/leagues';
import { LEAGUE_MEMBERSHIP } from '../data/worldClubs';
import type { Club, SeasonRecord, WorldState } from '../types';
import { leagueSeasonGames } from './leagueSchedule';

export { leagueSeasonGames };

/**
 * One authority for "which league, and how many games" (v0.6.5.2).
 *
 * ## The bug this module exists to close
 *
 * `Club` carries `league`, `tier` and `seasonGames` as static fields. They were true when the
 * dataset was written and they are NOT true afterwards, because v0.6.5 gave Israel a dynamic
 * pyramid: clubs are promoted and relegated inside a career, and the 2026/27 snapshot itself
 * moved several of them. Hapoel Hadera's record still says `league: 'ליגת העל'` while world truth
 * has it in Liga Alef; Hapoel Petah Tikva's still says Liga Leumit while it is top-flight.
 *
 * The league table already read authoritative membership. Other paths did not, and a release
 * offer really would tell the player "הפועל חדרה מליגת העל".
 *
 * ## The three contexts, kept apart on purpose
 *
 *   STATIC IDENTITY   - id, name, colours, country, crest. Permanent. Read `Club` freely.
 *   CURRENT WORLD     - where the club plays NOW, after this career's movements.
 *                       `currentLeagueId` / `currentSeasonGames`.
 *   HISTORICAL SEASON - where the club played in a completed season.
 *                       `historicalLeagueId` / `historicalSeasonGames`, read off the
 *                       SeasonRecord and NEVER re-derived from the current world.
 *
 * The third rule is the one worth stating twice: a career that played in Liga Alef in 2044 must
 * still say Liga Alef in 2050, even if the club has since been promoted twice. History is a
 * record, not a query.
 */

/* ------------------------------------------------------------------ */
/* Current world truth                                                 */
/* ------------------------------------------------------------------ */

/**
 * Which league a club is in RIGHT NOW, after any movement this career has caused.
 *
 * Membership override first, then the 2026/27 snapshot, then - only for a club with no modelled
 * division at all - the tier/country fallback inside `defaultLeagueFor`. `worldEngine.leagueOf`
 * delegates here, so there is exactly one implementation of "where does this club play".
 */
export function currentLeagueOf(world: WorldState, club: Club): League {
  const moved = world.clubLeagues[club.id];
  if (moved) return getLeague(moved);
  return getLeague(defaultLeagueFor(club.tier, club.country, club.id));
}

/**
 * The current league id of a club known only by id.
 *
 * Deliberately narrower than `currentLeagueOf`: without the club record there is no tier or
 * country to fall back on, so a club outside every modelled division returns null instead of a
 * guess. Callers that hold the club should prefer `currentLeagueOf`.
 */
export function currentLeagueId(world: WorldState, clubId: string): string | null {
  const moved = world.clubLeagues[clubId];
  if (moved) return moved;
  for (const [leagueId, ids] of Object.entries(LEAGUE_MEMBERSHIP)) {
    if (ids.includes(clubId)) return leagueId;
  }
  return null;
}

/**
 * The name of the league a club is in right now - what the player should be shown.
 *
 * This is the replacement for reading `club.league`, which is a snapshot of where the club was
 * when the dataset was written.
 */
export function currentLeagueName(world: WorldState, club: Club): string {
  return currentLeagueOf(world, club).name;
}

/** Fixtures in the club's CURRENT season, from its CURRENT division. */
export function currentSeasonGames(world: WorldState, club: Club): number {
  return leagueSeasonGames(currentLeagueOf(world, club).id, club.quality, club.country === 'ישראל');
}

/* ------------------------------------------------------------------ */
/* Historical truth                                                    */
/* ------------------------------------------------------------------ */

/**
 * The league a completed season was played in.
 *
 * `SeasonRecord.leagueId` is written at settlement from the league the club was actually in that
 * year (v0.6.5.2). Records from older saves have only the display NAME, so this falls back to
 * resolving that name - and returns null rather than guessing when even that fails.
 *
 * It deliberately does NOT consult the current world. Deriving a historical league from where
 * the club plays today is the exact mistake this module exists to prevent.
 */
export function historicalLeagueId(record: SeasonRecord): string | null {
  if (record.leagueId) return record.leagueId;
  for (const leagueId of Object.keys(LEAGUE_MEMBERSHIP)) {
    try {
      if (getLeague(leagueId).name === record.league) return leagueId;
    } catch {
      /* unknown league id in the map - skip */
    }
  }
  return null;
}

/**
 * How many games that completed season held.
 *
 * Used for every historical denominator - `playerImpact`'s minutes share, the integrity
 * validator's appearance ceiling, the market's last-season minutes read. Before v0.6.5.2 these
 * all used the club's CURRENT static `seasonGames`, so a career's 2044 Liga Alef season was
 * re-judged years later against whatever league the club had since been promoted into.
 *
 * `clubQuality` is passed in rather than looked up, so this module stays free of the club
 * dataset and cannot form an import cycle with it.
 */
export function historicalSeasonGames(
  record: SeasonRecord,
  clubQuality: number,
  isIsraeli: boolean,
  fallbackSeasonGames: number,
): number {
  const leagueId = historicalLeagueId(record);
  if (!leagueId) return fallbackSeasonGames;
  return leagueSeasonGames(leagueId, clubQuality, isIsraeli);
}

/**
 * Fixtures in a completed season, resolved from the record alone.
 *
 * The convenience form of `historicalSeasonGames` for the common case where the caller has a
 * record and nothing else: every historical denominator in the game - impact, valuation,
 * stagnation, the integrity ceiling, the season card's minutes box - should go through this so
 * they cannot drift apart. Falls back to the club's stored schedule for a record whose league
 * cannot be resolved, and to a plain season length for a club that no longer exists.
 */
export function seasonFixtures(record: SeasonRecord): number {
  try {
    const club = getClub(record.clubId);
    return historicalSeasonGames(record, club.quality, club.country === 'ישראל', club.seasonGames);
  } catch {
    return 38;
  }
}

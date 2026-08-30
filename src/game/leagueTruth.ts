import { stageConfig } from '../data/academy';
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
 * Resolution order, strongest evidence first (v0.6.5.3):
 *
 *   1. `record.leagueId` - written at settlement. Stored fact.
 *   2. `world.clubSeasons` - the world's own record of that club in that season. Also stored
 *      fact, just kept somewhere else, and it outranks display text because it is an id rather
 *      than a name that may have been copied from a stale static field.
 *   3. `record.league` display name - last resort for a pre-v0.6.5.2 save.
 *
 * It deliberately does NOT consult the CURRENT league of the club at any point. Deriving a
 * historical league from where the club plays today is the exact mistake this module exists to
 * prevent, and no amount of missing evidence makes it acceptable - the function returns null
 * instead.
 */
export function historicalLeagueId(record: SeasonRecord, world?: WorldState): string | null {
  if (record.leagueId) return record.leagueId;

  /*
   * v0.6.5.3: the world's own history beats the record's display text.
   *
   * Pre-v0.6.5.2 records took their league NAME from `levelContext`, which read the club's stale
   * static field - so a season at Hapoel Hadera could be stamped "ליגת העל" when the club was in
   * Liga Alef and the world knew it. `clubSeasons` holds a leagueId written by the world engine
   * at the time, which is the better witness. Only a unique match counts; an ambiguous one is
   * treated as no evidence rather than a coin flip.
   */
  const matches = (world?.clubSeasons ?? []).filter(
    (entry) => entry.season === record.season && entry.clubId === record.clubId,
  );
  const unique = matches.length === 1 ? matches[0] : null;
  if (unique?.leagueId) return unique.leagueId;

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
 * `clubQuality` is passed in rather than looked up, so this stays usable from a caller that
 * already holds the club.
 */
export function historicalSeasonGames(
  record: SeasonRecord,
  clubQuality: number,
  isIsraeli: boolean,
  fallbackSeasonGames: number,
  world?: WorldState,
): number {
  const leagueId = historicalLeagueId(record, world);
  if (!leagueId) return fallbackSeasonGames;
  return leagueSeasonGames(leagueId, clubQuality, isIsraeli);
}

/**
 * Fixtures in a completed season. The one resolver every historical consumer goes through.
 *
 * ## Why a stored number, and not a calculation
 *
 * v0.6.5.2 stopped history being scored against the club's CURRENT division. It left the count
 * itself still being *reconstructed* - from the league's size, the club's quality and the
 * schedule rules as they exist right now. That is a query, and a query answers with today's
 * data. Reshape Liga Alef, add a playoff round, restate a club's quality, and a season that
 * finished in 2044 quietly returns a different number than it did last version.
 *
 * A season that happened is a fact. If he played 16 team games in טרום ב׳, that season must
 * always say 16.
 *
 * ## Order, strongest evidence first
 *
 *   1. `record.teamGames` - stored at settlement, from the halves he actually played. Nothing
 *      overrides it, including a later change to the schedule rules. This is the whole point.
 *   2. Academy stage - the schedule of an age group is a property of the age group, not of the
 *      club. Before v0.6.5.3 every academy season fell through to `getClub('maccabi_academy')
 *      .seasonGames`, so a טרום ב׳ season (16 games) and a נוער season (32) were both scored
 *      against the same generic number.
 *   3. The historical league - `record.leagueId`, or the world's own `clubSeasons` entry, or the
 *      recorded display name, in that order of trust.
 *   4. Legacy fallback - the club's static field, for a pre-v0.6.5.2 record whose league cannot
 *      be established at all. Wrong in the ways this version documents, but it loads.
 *
 * At no point does it consult the club's current league.
 */
export function seasonFixtures(record: SeasonRecord, world?: WorldState): number {
  if (typeof record.teamGames === 'number' && record.teamGames > 0) return record.teamGames;

  if (record.academyStage && record.academyStage !== 'senior') {
    const stage = stageConfig(record.academyStage);
    if (stage?.seasonGames) return stage.seasonGames;
  }

  try {
    const club = getClub(record.clubId);
    return historicalSeasonGames(
      record,
      club.quality,
      club.country === 'ישראל',
      club.seasonGames,
      world,
    );
  } catch {
    // The club no longer exists in the dataset. A plain season length beats crashing on load.
    return 38;
  }
}

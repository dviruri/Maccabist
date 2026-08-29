/**
 * How big each league is and what the places mean (v0.4.6, membership moved out in v0.6.3).
 *
 * v0.6.3: the `others` lists that used to live here - eight named clubs for a twenty-club
 * division, with the difference invented at runtime as "קבוצה N" - are gone. Membership now
 * comes complete from `worldClubs.ts`, and `tests/worldData.test.ts` fails the build if any
 * league's modelled clubs plus its table clubs do not equal its declared size exactly.
 *
 * What remains here is the *shape*: how many clubs, and which places mean Europe, relegation
 * or promotion. Club names and colours are used as facts; no crest or club artwork is
 * reproduced (see CLUB_CRESTS.md and the v0.6.3 importer's provenance rules).
 */

import { TABLE_CLUBS_BY_LEAGUE, type TableClub } from './worldClubs';

export interface LeagueShape {
  /** Clubs in the division. The completeness validator holds membership to exactly this. */
  size: number;
  /** How many places qualify for Europe, from the top. 0 where none are modelled. */
  europePlaces: number;
  /** How many places go down, from the bottom. 0 where nothing is modelled below. */
  relegationPlaces: number;
  /** How many places go up, from the top. 0 in a top division. */
  promotionPlaces: number;
  /** The named table clubs that complete the division around its modelled Club records. */
  others: ReadonlyArray<TableClub>;
}

function shape(
  leagueId: string,
  size: number,
  europePlaces: number,
  relegationPlaces: number,
  promotionPlaces: number,
): LeagueShape {
  return {
    size,
    europePlaces,
    relegationPlaces,
    promotionPlaces,
    others: TABLE_CLUBS_BY_LEAGUE[leagueId] ?? [],
  };
}

export const LEAGUE_SHAPES: Record<string, LeagueShape> = {
  // Nine modelled clubs plus five named table clubs makes fourteen, the real shape.
  il_premier: shape('il_premier', 14, 3, 2, 0),
  il_leumit: shape('il_leumit', 16, 0, 2, 2),
  be_pro: shape('be_pro', 16, 3, 3, 0),
  nl_eredivisie: shape('nl_eredivisie', 18, 3, 3, 0),
  at_bundesliga: shape('at_bundesliga', 12, 3, 3, 0),
  gr_superleague: shape('gr_superleague', 14, 3, 3, 0),
  cy_first: shape('cy_first', 12, 2, 3, 0),
  pt_primeira: shape('pt_primeira', 18, 4, 3, 0),
  de_bundesliga: shape('de_bundesliga', 18, 5, 3, 0),
  es_laliga: shape('es_laliga', 20, 5, 3, 0),
  it_seriea: shape('it_seriea', 20, 5, 3, 0),
  en_premier: shape('en_premier', 20, 5, 3, 0),
};

/**
 * The generic career-quality buckets (euro_elite / euro_strong) deliberately have no shape any
 * more. They exist in `leagues.ts` only as `defaultLeagueFor`'s fallback for a club in a country
 * with no modelled league - and every club's country HAS a modelled league, which
 * `tests/worldData.test.ts` asserts. A bucket with no shape has no table, so its old
 * "יריבה אירופית א׳" placeholder rows can never render.
 */

/** Youth football has no league table in this game; the age group is the unit. */
export const UNTABLED_LEAGUES: readonly string[] = ['il_youth'];

export function leagueShape(leagueId: string): LeagueShape | null {
  return LEAGUE_SHAPES[leagueId] ?? null;
}

export function hasTable(leagueId: string): boolean {
  return !UNTABLED_LEAGUES.includes(leagueId) && LEAGUE_SHAPES[leagueId] !== undefined;
}

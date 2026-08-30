/**
 * How big each league is and what its places mean (v0.4.6; membership moved out in v0.6.3, and
 * the size itself became derived in v0.6.4).
 *
 * There is no `others` list any more and no `size` literal. A division's size IS the length of
 * its membership in `worldClubs.ts` - one number, one place, impossible to disagree with itself.
 * v0.6.3 kept the two apart and a mismatch was a test failure; v0.6.4 makes the mismatch
 * unrepresentable.
 *
 * What remains here is the shape: which places mean Europe, relegation or promotion.
 */

import { LEAGUE_MEMBERSHIP } from './worldClubs';

export interface LeagueShape {
  /** Clubs in the division. Derived from the authoritative membership. */
  size: number;
  /** How many places qualify for Europe, from the top. 0 where none are modelled. */
  europePlaces: number;
  /** How many places go down, from the bottom. 0 where nothing is modelled below. */
  relegationPlaces: number;
  /** How many places go up, from the top. 0 in a top division. */
  promotionPlaces: number;
}

function shape(
  leagueId: string,
  europePlaces: number,
  relegationPlaces: number,
  promotionPlaces: number,
): LeagueShape {
  return {
    size: (LEAGUE_MEMBERSHIP[leagueId] ?? []).length,
    europePlaces,
    relegationPlaces,
    promotionPlaces,
  };
}

export const LEAGUE_SHAPES: Record<string, LeagueShape> = {
  il_premier: shape('il_premier', 3, 2, 0),
  il_leumit: shape('il_leumit', 0, 2, 2),
  /*
   * Liga Alef (v0.6.5): one promotion place per district; no modelled relegation because Liga
   * Bet is below the modelled world - a bottom-placed Alef club has a terrible season and stays,
   * which WORLD_DATA.md records as a known limitation rather than hiding.
   */
  il_alef_north: shape('il_alef_north', 0, 0, 1),
  il_alef_south: shape('il_alef_south', 0, 0, 1),
  be_pro: shape('be_pro', 3, 3, 0),
  nl_eredivisie: shape('nl_eredivisie', 3, 3, 0),
  at_bundesliga: shape('at_bundesliga', 3, 3, 0),
  gr_superleague: shape('gr_superleague', 3, 3, 0),
  cy_first: shape('cy_first', 2, 3, 0),
  pt_primeira: shape('pt_primeira', 4, 3, 0),
  de_bundesliga: shape('de_bundesliga', 5, 3, 0),
  es_laliga: shape('es_laliga', 5, 3, 0),
  it_seriea: shape('it_seriea', 5, 3, 0),
  en_premier: shape('en_premier', 5, 3, 0),
};

/**
 * The generic career-quality buckets (euro_elite / euro_strong) deliberately have no shape.
 * They exist in `leagues.ts` only as `defaultLeagueFor`'s fallback for a club in a country with
 * no modelled league, and `tests/worldData.test.ts` asserts no club is in that position - so a
 * table can never be drawn for them.
 */

/** Youth football has no league table in this game; the age group is the unit. */
export const UNTABLED_LEAGUES: readonly string[] = ['il_youth'];

export function leagueShape(leagueId: string): LeagueShape | null {
  return LEAGUE_SHAPES[leagueId] ?? null;
}

export function hasTable(leagueId: string): boolean {
  return !UNTABLED_LEAGUES.includes(leagueId) && LEAGUE_SHAPES[leagueId] !== undefined;
}

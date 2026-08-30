import { leagueShape } from '../data/leagueShape';

/**
 * How long a season is, in fixtures (v0.6.5.2).
 *
 * Split out from `leagueTruth` on purpose: the club dataset derives its stored `seasonGames`
 * from this, so anything the dataset imports must not import the dataset back. This module
 * knows only about league shapes.
 */

/**
 * How many matches a club of this quality plays in a season in this league.
 *
 * The league portion is derived from the division's real size - a double round-robin of
 * `(size - 1) * 2` - so a division that changes size changes its schedule with it. That is the
 * v0.6.5.1 lesson: Liga Alef was hardcoded at 31 games from a 16-club assumption and kept it
 * after the division turned out to have 18, silently capping every Liga Alef season by three
 * fixtures.
 *
 * The allowances on top are stated rather than buried: Ligat Ha'Al genuinely plays a
 * championship/relegation playoff round, everyone plays some cup football, and European nights
 * scale with how strong the club is.
 */
export function leagueSeasonGames(
  leagueId: string | null,
  clubQuality: number,
  isIsraeli: boolean,
): number {
  const size = leagueId ? (leagueShape(leagueId)?.size ?? 0) : 0;
  const roundRobin = size > 1 ? (size - 1) * 2 : 30;
  const playoff = leagueId === 'il_premier' ? 7 : 0;
  const cup = isIsraeli ? 2 : 3;
  /*
   * European nights need a division that HAS European places (v0.6.5.2).
   *
   * The old formula scaled them from club quality alone. That was invisible while a club's
   * schedule was frozen at derivation time, and wrong the moment schedules started following
   * the world: relegate a strong club to Liga Leumit and it kept eight European fixtures in a
   * division that qualifies nobody - while `europeChance` correctly sat at zero. The club was
   * playing continental football it could not have been in.
   */
  const qualifies = leagueId ? (leagueShape(leagueId)?.europePlaces ?? 0) > 0 : false;
  const europe = !qualifies ? 0 : clubQuality >= 82 ? 12 : clubQuality >= 74 ? 8 : clubQuality >= 66 ? 4 : 0;
  return roundRobin + playoff + cup + europe;
}


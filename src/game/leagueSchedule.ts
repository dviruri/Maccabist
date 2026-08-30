import { leagueShape } from '../data/leagueShape';

/**
 * How long a season is, in fixtures (v0.6.5.2).
 *
 * Split out from `leagueTruth` on purpose: the club dataset derives its stored `seasonGames`
 * from this, so anything the dataset imports must not import the dataset back. This module
 * knows only about league shapes.
 */

/**
 * The composition of a club's season, by competition (v0.7).
 *
 * The league portion is derived from the division's real size - a double round-robin of
 * `(size - 1) * 2` - so a division that changes size changes its schedule with it. That is the
 * v0.6.5.1 lesson: Liga Alef was hardcoded at 31 games from a 16-club assumption and kept it
 * after the division turned out to have 18, silently capping every Liga Alef season by three
 * fixtures.
 *
 * Split out of `leagueSeasonGames` so the total and the breakdown cannot disagree - the total
 * IS the sum of these parts. `continental` is the generic European allowance strong clubs have
 * always carried; it is not a modelled competition and must never be labelled as one.
 */
export interface ScheduleBreakdown {
  /** League fixtures, including the championship playoff round where the division has one. */
  league: number;
  cup: number;
  continental: number;
}

export function leagueScheduleBreakdown(
  leagueId: string | null,
  clubQuality: number,
  isIsraeli: boolean,
): ScheduleBreakdown {
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
  const continental = !qualifies ? 0 : clubQuality >= 82 ? 12 : clubQuality >= 74 ? 8 : clubQuality >= 66 ? 4 : 0;
  return { league: roundRobin + playoff, cup, continental };
}

export function leagueSeasonGames(
  leagueId: string | null,
  clubQuality: number,
  isIsraeli: boolean,
): number {
  const b = leagueScheduleBreakdown(leagueId, clubQuality, isIsraeli);
  return b.league + b.cup + b.continental;
}

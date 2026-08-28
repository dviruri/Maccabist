/**
 * What match is this, exactly (v0.4.6).
 *
 * Events kept asserting things about a fixture that nothing in the game knew: a derby with no
 * opponent, a "biggest match of the season" in a season that was going nowhere. The fix is not
 * better wording, it is having an actual opponent and an actual table to check against.
 *
 * A match context is *derived*, deterministically, from the career and the live table. There is
 * no fixture list — building one would be Football Manager, and the game does not need to know
 * that Maccabi play away on the 14th. It needs to know that when a match event fires, there is a
 * real club on the other side of it, in a real table position, and that the words the event uses
 * are true of that pairing.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { leagueShape } from '../data/leagueShape';
import {
  derbyRival,
  rivalryBetween,
  rivalryClubOf,
  rivalsOf,
  type Rivalry,
  type RivalryType,
} from '../data/rivalries';
import type { Career, LeagueContext, MatchContext, MatchImportance, SeasonPhase } from '../types';
import { currentLeagueContext, currentPhase, currentProjection, buildTable } from './leagueEngine';
import { createRng } from './random';
import { leagueOf } from './worldEngine';

/* ------------------------------------------------------------------ */
/* Picking an opponent                                                 */
/* ------------------------------------------------------------------ */

/**
 * Who the player's club is playing.
 *
 * Drawn from the clubs actually in the division this season, so the opponent is always someone
 * the table contains. Seeded on club, season and phase, so the same moment in the same save
 * always describes the same fixture — a match event that renamed its opponent on reload would be
 * its own kind of incoherence.
 *
 * Rivals are weighted up. Over a season a club plays its derby opponent twice out of thirty-odd
 * matches, but the matches a career *remembers* are not drawn uniformly from the fixture list.
 */
function pickOpponent(career: Career, phase: SeasonPhase): { clubId: string; name: string } | null {
  const projection = currentProjection(career);
  if (!projection) return null;

  const table = buildTable(career.world, projection, phase);
  const others = table.rows.filter((r) => r.clubId !== career.currentClubId);
  if (others.length === 0) return null;

  const rng = createRng((projection.tableSeed ^ 0x9e3779b9 ^ phaseKey(phase)) >>> 0);
  const weighted = others.map((row) => ({
    row,
    weight: rivalryBetween(career.currentClubId, row.clubId) ? 4 : 1,
  }));

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.next() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return { clubId: entry.row.clubId, name: entry.row.name };
  }
  const last = weighted[weighted.length - 1];
  return last ? { clubId: last.row.clubId, name: last.row.name } : null;
}

function phaseKey(phase: SeasonPhase): number {
  return { early: 0x51, mid: 0x52, late: 0x53, end: 0x54 }[phase];
}

/* ------------------------------------------------------------------ */
/* The context                                                         */
/* ------------------------------------------------------------------ */

/**
 * Everything an event is allowed to claim about the current fixture.
 *
 * Returns null in youth football and anywhere else without a table: an age group plays matches,
 * but it does not play a fixture with a league position on either side, and an event that wants
 * to talk about one has no business firing there.
 */
export function matchContext(career: Career, phaseOverride?: SeasonPhase): MatchContext | null {
  const phase = phaseOverride ?? currentPhase(career);
  const league = currentLeagueContext(career);
  if (!league) return null;

  const opponent = pickOpponent(career, phase);
  if (!opponent) return null;

  const projection = currentProjection(career);
  const table = projection ? buildTable(career.world, projection, phase) : null;
  const opponentRow = table?.rows.find((r) => r.clubId === opponent.clubId) ?? null;
  const opponentPosition = opponentRow?.position ?? null;

  const rivalry = rivalryBetween(career.currentClubId, opponent.clubId);
  const gap = opponentRow ? Math.abs(opponentRow.points - league.points) : null;

  /*
   * A title decider needs both clubs in it. "We are third and they are eleventh" is a big match
   * for us and a nothing match overall, and calling it a decider would be the same overclaiming
   * the version exists to remove.
   */
  const bothHigh =
    opponentPosition !== null && opponentPosition <= 3 && league.position <= 3;
  const titleDecider =
    league.titleRace && phase === 'late' && bothHigh && (gap ?? 99) <= 6 && !league.championClinched;

  const shape = leagueShape(league.leagueId);
  const bottomEdge = shape ? shape.size - shape.relegationPlaces - 2 : league.leagueSize - 3;
  const bothLow = opponentPosition !== null && opponentPosition >= bottomEdge;
  const relegationSixPointer =
    league.relegationBattle && bothLow && (gap ?? 99) <= 6 && !league.relegationConfirmed;

  const bothPromotion =
    opponentPosition !== null && shape !== null && opponentPosition <= shape.promotionPlaces + 3;
  const promotionDecider =
    league.promotionRace &&
    phase === 'late' &&
    bothPromotion &&
    (gap ?? 99) <= 6 &&
    !league.promotionClinched;

  const importance = importanceOf({
    league,
    rivalry,
    titleDecider,
    relegationSixPointer,
    promotionDecider,
  });

  return {
    opponentClubId: opponent.clubId,
    opponentName: opponent.name,
    opponentPosition,
    /* No fixture list, so home and away alternate off the seed rather than pretending to know. */
    home: (createRng((phaseKey(phase) ^ (projection?.tableSeed ?? 0)) >>> 0).next() ?? 0) < 0.5,
    rivalryType: rivalry?.type ?? null,
    rivalryName: rivalry?.name ?? null,
    isDerby: rivalry?.type === 'localDerby',
    importance,
    titleDecider,
    relegationSixPointer,
    promotionDecider,
    vsMaccabi: opponent.clubId === MACCABI_ID,
    vsFormerClub: playedForBefore(career, opponent.clubId),
    pointsGap: gap,
  };
}

function importanceOf(input: {
  league: LeagueContext;
  rivalry: Rivalry | null;
  titleDecider: boolean;
  relegationSixPointer: boolean;
  promotionDecider: boolean;
}): MatchImportance {
  if (input.titleDecider || input.relegationSixPointer || input.promotionDecider) return 'huge';
  if (input.rivalry?.intensity === 'high') return 'huge';
  if (input.rivalry) return 'important';
  if (input.league.titleRace || input.league.relegationBattle || input.league.promotionRace) {
    return 'important';
  }
  return 'routine';
}

/** Did he play a senior season for this club before? */
function playedForBefore(career: Career, clubId: string): boolean {
  if (clubId === career.currentClubId) return false;
  return career.seasonHistory.some((s) => s.clubId === clubId && s.academyStage === 'senior');
}

/* ------------------------------------------------------------------ */
/* The narrow questions events ask                                     */
/* ------------------------------------------------------------------ */

/**
 * May this career see the word דרבי at all?
 *
 * Nothing about form, importance or occasion — purely whether this club has a local rival that
 * the game models. A club with no derby can have the biggest match in its history and it is
 * still not a derby.
 */
export function canPlayDerby(career: Career): boolean {
  const club = rivalryClubOf(career.currentClubId);
  const rival = derbyRival(club);
  if (!rival) return false;

  /*
   * Deliberately not gated on having a league table. An academy side plays the derby too - it is
   * the same two towns - and requiring a table would make every youth derby silently ineligible,
   * which is the opposite failure from the one this system exists to fix and just as wrong.
   *
   * For senior football the rival does have to be in the same division: a derby against a club
   * that went down last season is not this season's fixture.
   */
  if (club !== career.currentClubId) return true;
  return leagueOf(career.world, rival).id === leagueOf(career.world, club).id;
}

/** The derby opponent's display name, for events that name it. */
export function derbyOpponentName(career: Career): string | null {
  const rival = derbyRival(rivalryClubOf(career.currentClubId));
  if (!rival || !canPlayDerby(career)) return null;
  const club = getClub(rival);
  return club.shortName ?? club.name;
}

/** Any modelled rivalry, derby or not, against a club in the same division. */
export function activeRivalries(career: Career): Rivalry[] {
  const club = rivalryClubOf(career.currentClubId);
  // An academy side inherits its club's rivalries without inheriting its division.
  if (club !== career.currentClubId) return rivalsOf(club);
  const leagueId = leagueOf(career.world, club).id;
  return rivalsOf(club).filter((r) => {
    const other = r.clubs[0] === club ? r.clubs[1] : r.clubs[0];
    return leagueOf(career.world, other).id === leagueId;
  });
}

export function hasRivalryOfType(career: Career, types: RivalryType[]): boolean {
  return activeRivalries(career).some((r) => types.includes(r.type));
}

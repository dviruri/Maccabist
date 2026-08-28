/**
 * The narrow questions events are allowed to ask about the world (v0.4.6).
 *
 * Phase 7 of the brief asks for reusable helpers rather than scattered checks, and the reason is
 * not tidiness. When "is this club in a title race?" is answered in eight places it is answered
 * eight slightly different ways, and one of them is the one that lets a club that finishes
 * eleventh get an April title-decider. There is one answer here and everything reads it.
 *
 * Every predicate **fails closed**. A career with no league table — youth football, or a league
 * with no modelled shape — is not in a title race, not in a relegation battle and not eligible
 * for a promotion decider. It is not "unknown, so allow it". That default is what kept letting
 * these events through.
 */

import { MACCABI_ID } from '../data/clubs';
import type { Career, LeagueContext } from '../types';
import {
  currentLeagueContext,
  currentPhase,
  maccabiLeagueContext,
} from './leagueEngine';
import { canPlayDerby, matchContext } from './matchEngine';
import { leagueOf } from './worldEngine';

/* ------------------------------------------------------------------ */
/* Does this career have a world at all?                               */
/* ------------------------------------------------------------------ */

/** True when the player's club has a modelled league table this season. */
export function hasLeagueTable(career: Career): boolean {
  return currentLeagueContext(career) !== null;
}

/** The context, or a fail-closed stand-in that answers "no" to everything. */
function ctx(career: Career): LeagueContext | null {
  return currentLeagueContext(career);
}

/* ------------------------------------------------------------------ */
/* Races                                                               */
/* ------------------------------------------------------------------ */

export function isInTitleRace(career: Career): boolean {
  return ctx(career)?.titleRace === true;
}

export function isInEuropeRace(career: Career): boolean {
  return ctx(career)?.europeRace === true;
}

export function isInRelegationBattle(career: Career): boolean {
  return ctx(career)?.relegationBattle === true;
}

export function isInPromotionRace(career: Career): boolean {
  return ctx(career)?.promotionRace === true;
}

export function isMidTable(career: Career): boolean {
  return ctx(career)?.midTable === true;
}

export function isOverperforming(career: Career): boolean {
  return ctx(career)?.overperforming === true;
}

export function isUnderperforming(career: Career): boolean {
  return ctx(career)?.underperforming === true;
}

/** Where the club sits right now, or null without a table. */
export function leaguePosition(career: Career): number | null {
  return ctx(career)?.position ?? null;
}

/* ------------------------------------------------------------------ */
/* Deciders                                                            */
/* ------------------------------------------------------------------ */

/**
 * May this career see a title-decider match?
 *
 * Three things at once, and the first is the one that was missing: the club has to be in a title
 * race *this season, at this phase*, which — because the season is projected at preseason and the
 * late-phase position is inside the final outcome's band — means it will finish in one too.
 *
 * The other two are about the fixture. It has to be late in the season, and the opponent has to
 * be up there as well: "we are third, they are eleventh" is a big match for us and a nothing
 * match for the title.
 */
export function isTitleDeciderEligible(career: Career): boolean {
  const league = ctx(career);
  if (!league || !league.titleRace || league.championClinched) return false;
  if (currentPhase(career) !== 'late') return false;
  return matchContext(career)?.titleDecider === true;
}

/** A promotion decider. Second divisions only, by construction — top flights have no promotion. */
export function isPromotionDeciderEligible(career: Career): boolean {
  const league = ctx(career);
  if (!league || !league.promotionRace || league.promotionClinched) return false;
  if (currentPhase(career) !== 'late') return false;
  return matchContext(career)?.promotionDecider === true;
}

/** A six-pointer at the bottom. */
export function isRelegationDeciderEligible(career: Career): boolean {
  const league = ctx(career);
  if (!league || !league.relegationBattle || league.relegationConfirmed) return false;
  return matchContext(career)?.relegationSixPointer === true;
}

/** A match that matters for a European place. */
export function isEuropeRaceEligible(career: Career): boolean {
  const league = ctx(career);
  return league !== null && league.europeRace && league.pointsFromEurope !== null;
}

/* ------------------------------------------------------------------ */
/* Derbies                                                             */
/* ------------------------------------------------------------------ */

/**
 * May this career see the word דרבי?
 *
 * Re-exported from the match engine so that every caller goes through one door. A club with no
 * modelled local rival in its own division cannot play a derby, however big the match is.
 */
export function isDerbyEligible(career: Career): boolean {
  return canPlayDerby(career);
}

/* ------------------------------------------------------------------ */
/* Maccabi, from wherever he is                                        */
/* ------------------------------------------------------------------ */

/** Where Maccabi stands right now — the side thread, available wherever the player is. */
export function maccabiStatus(career: Career): LeagueContext | null {
  return maccabiLeagueContext(career);
}

/** True when Maccabi are top of their division right now. */
export function maccabiLeadingLeague(career: Career): boolean {
  return maccabiStatus(career)?.position === 1;
}

/** True when Maccabi are in the bottom third of their division. */
export function maccabiStruggling(career: Career): boolean {
  const status = maccabiStatus(career);
  if (!status) return false;
  return status.position > status.leagueSize * 0.66 || leagueOf(career.world, MACCABI_ID).tier >= 2;
}

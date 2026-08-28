/**
 * Did he actually play? (v0.4.8)
 *
 * The gate every on-field event goes through. Before this, `match_moment` events were gated on
 * `roleValue` — a measure of standing in the squad, not of playing — so a backup with a decent
 * reputation could be handed "minute 88, the ball reaches you" in a season he finished with zero
 * appearances. Nought of twenty-one match events checked participation at all.
 *
 * There are two questions here rather than one, because of *when* they get asked.
 *
 *   MID and LATE slots   the first half has been played, so the ledger holds real appearances and
 *                        the answer is a fact.
 *   EARLY slot           `planSeason` chooses the whole season at preseason, before a ball is
 *                        kicked. There is nothing to read, so the answer is a projection.
 *
 * The projection deliberately reuses the season engine's own minutes model with the noise term
 * removed. Two formulas that disagree about whether a player will play is precisely the class of
 * bug this version exists to remove, so there is one formula and this reads it.
 */

import { SEASON } from './balance';
import { ageMinutesModifier, levelContext, playerLevel } from './rules';
import { clamp } from './random';
import { appearancesThisSeason, startsThisSeason } from './truth';
import type { Career, SeasonParticipation, SeasonSlot } from '../types';

/* ------------------------------------------------------------------ */
/* The projection                                                      */
/* ------------------------------------------------------------------ */

/**
 * The share of minutes this player would expect, with the noise taken out.
 *
 * Identical to `computeMinutesShare` minus its `rng.range(0.88, 1.12)`. Kept as a separate
 * function rather than a flag on that one because this must never consume a draw: it is called
 * during event *planning*, and consuming randomness there would change every subsequent event in
 * the season and break seed determinism.
 */
export function projectedMinutesShare(career: Career): number {
  const level = levelContext(career);
  const raw = SEASON.minutesBase + (playerLevel(career) - level.quality) / SEASON.minutesSpread;
  const withAge = level.isAcademy ? raw : raw * ageMinutesModifier(career.age);
  const withForm = withAge * (0.9 + career.hidden.form / 500 + career.hidden.confidence / 700);
  const withOlderGroup = withForm * SEASON.olderGroupMinutesPenalty[career.olderGroup];
  const withEvents = withOlderGroup * career.hidden.minutesModifier;
  const floor = level.isAcademy ? SEASON.youthMinutesFloor : SEASON.minutesMin;
  return clamp(withEvents, floor, SEASON.minutesMax);
}

/** Roughly how many matches he would expect across the whole season. */
export function projectedAppearances(career: Career): number {
  const level = levelContext(career);
  return Math.round(level.seasonGames * projectedMinutesShare(career));
}

/**
 * The threshold for "he will be on the pitch at some point".
 *
 * Deliberately generous — three expected appearances rather than one. The projection has no noise
 * in it, so a player sitting just under the line can still end up playing; being slightly
 * permissive at plan time and reconciling at settlement is the right way round. Being *strict*
 * here would silently delete match moments from careers that did play.
 */
const PROJECTED_APPEARANCE_FLOOR = 3;

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

/**
 * Has any football been played this season yet?
 *
 * This, and not the slot, is what decides whether the gate can consult facts. `planSeason` chooses
 * the *whole* season at preseason - early, mid and late together - so at plan time nothing has
 * been played whatever slot the event is for. Keying on the slot instead blocked every late-slot
 * match moment outright, because the ledger was necessarily empty when it was asked.
 */
/**
 * Has this season's football actually happened yet?
 *
 * Two ways it has. Mid-season, `firstHalfStats` holds the first half. After settlement that field
 * is cleared - so the season record is the other way, and it has to be checked, because the late
 * slot runs *after* the season is settled.
 *
 * That second clause is a fix, not defensiveness. `playSecondHalf` closes the season at the end of
 * the mid slot and only then are the late-slot events loaded, so for the whole late slot
 * `firstHalfStats` was null and the gate fell back to the *projection* - which let an on-field
 * event fire into a season already recorded with zero appearances, with reconciliation long past.
 * Found by the 50,000-career scan; 20,000 was not enough to see it once.
 */
function hasPlayedThisSeason(career: Career): boolean {
  if (career.firstHalfStats !== null) return true;
  return career.seasonHistory.some((s) => s.season === career.currentSeason);
}

/**
 * May this career be given an event that puts him on the pitch?
 *
 * Facts once there are facts, projection before that. The projection is used at plan time and the
 * factual check runs again at delivery (`loadSlotEvents`), which is what makes Phase 3.3 - zero
 * appearances means zero on-field moments - hold rather than merely be intended.
 */
export function canBeOnField(career: Career, _slot?: SeasonSlot): boolean {
  if (hasPlayedThisSeason(career)) return appearancesThisSeason(career) > 0;
  return projectedAppearances(career) >= PROJECTED_APPEARANCE_FLOOR;
}

/** Stronger: he has to have started a match, not come off the bench. */
export function canHaveStarted(career: Career, _slot?: SeasonSlot): boolean {
  if (hasPlayedThisSeason(career)) return startsThisSeason(career) > 0;
  // A start needs more than a token share of minutes, so the bar is higher than for an appearance.
  return projectedMinutesShare(career) >= 0.35;
}

/**
 * The hard gate, applied when an event is actually handed to the player.
 *
 * Planning happens at preseason on a projection; this runs at delivery, when the first half has
 * been played and the ledger is a fact. An event that survives planning and then turns out to
 * belong to a season the player did not play is dropped here.
 */
export function mayDeliverOnField(career: Career): boolean {
  if (!hasPlayedThisSeason(career)) return true;
  return appearancesThisSeason(career) > 0;
}

/* ------------------------------------------------------------------ */
/* The ledger                                                          */
/* ------------------------------------------------------------------ */

/** A fresh ledger for a new season. Called at preseason. */
export function openParticipation(season: number): SeasonParticipation {
  return { season, appearances: 0, starts: 0, onFieldEventFired: false };
}

/** Adds a half-season's football to the ledger. */
export function creditParticipation(
  career: Career,
  appearances: number,
  starts: number,
): SeasonParticipation {
  const ledger = career.seasonParticipation;
  const base =
    ledger && ledger.season === career.currentSeason
      ? ledger
      : { season: career.currentSeason, appearances: 0, starts: 0, onFieldEventFired: false };

  return {
    ...base,
    appearances: base.appearances + appearances,
    starts: base.starts + starts,
  };
}

/**
 * Records that an on-field event was delivered.
 *
 * This is what makes settlement able to reconcile rather than merely detect. The event told the
 * player he was on the pitch; if the statistics then come out at zero, the statistics are the
 * thing that is wrong.
 */
export function markOnFieldEvent(career: Career): SeasonParticipation {
  const base =
    career.seasonParticipation && career.seasonParticipation.season === career.currentSeason
      ? career.seasonParticipation
      : openParticipation(career.currentSeason);
  return { ...base, onFieldEventFired: true };
}

/**
 * True when an on-field event fired this season and the statistics disagree.
 *
 * Settlement resolves this in the event's favour: it already happened, the player already read it,
 * and a season summary that then says he played nothing is the contradiction v0.4.8 exists to
 * remove.
 */
export function needsAppearanceReconciliation(career: Career, appearances: number): boolean {
  const ledger = career.seasonParticipation;
  if (!ledger || ledger.season !== career.currentSeason) return false;
  return ledger.onFieldEventFired === true && appearances < 1;
}

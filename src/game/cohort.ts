/**
 * Birth cohort, football age, and the natural academy stage.
 *
 * This is the v0.3.1 correction to the world model. Previously the academy stage advanced
 * from a per-player promotion roll, which allowed a player to repeat an age group - something
 * that does not happen in youth football. An academy is organised by **birth year**: the whole
 * 2021 cohort moves up together, every season, whatever anyone's coach thinks.
 *
 *   naturalStage  = the age group this player's birth cohort plays in this season
 *   currentStage  = the team he is actually registered with (career.academyStage)
 *
 * Normally they are equal. A player pushed up early has currentStage ahead of naturalStage,
 * and the following season his cohort catches up - which looks like "staying" but is not
 * repeating a year.
 */

import { STAGE_LADDER, stageOrder } from '../data/academy';
import { BIRTH_COHORT, FIRST_ACADEMY_SEASON, RELATIVE_AGE } from './balance';
import type { AcademyStage, Career, DateOfBirth, SeasonPoint } from '../types';

/* ------------------------------------------------------------------ */
/* Natural stage                                                       */
/* ------------------------------------------------------------------ */

/**
 * The age group a cohort plays in during a given season.
 *
 * The 2021 cohort starts טרום ב׳ in 2030/31 and moves one rung every season, reaching נוער in
 * 2038/39 and senior football after that. Seasons are identified by their end year, so
 * "2030/31" is season 2031 — matching `seasonLabel()`.
 */
export function naturalStageFor(birthCohort: number, season: number): AcademyStage {
  // How many seasons this cohort has been in the academy.
  const cohortOffset = birthCohort - BIRTH_COHORT;
  const index = season - (FIRST_ACADEMY_SEASON + cohortOffset);
  if (index < 0) return STAGE_LADDER[0] as AcademyStage;
  const last = STAGE_LADDER.length - 1;
  return STAGE_LADDER[Math.min(last, index)] as AcademyStage;
}

/** The age group this player's cohort should be playing in right now. */
export function naturalStage(career: Career): AcademyStage {
  return naturalStageFor(career.birthCohort, career.currentSeason);
}

/** The natural stage for next season - what the cohort moves up to. */
export function nextNaturalStage(career: Career): AcademyStage {
  return naturalStageFor(career.birthCohort, career.currentSeason + 1);
}

/** True when the player is registered above his own cohort. */
export function isPlayingUpACohort(career: Career): boolean {
  return stageOrder(career.academyStage) > stageOrder(naturalStage(career));
}

/**
 * How many rungs ahead of his cohort the player is. 0 for a normal player, 1 after an early
 * promotion, 2 after two.
 */
export function cohortLead(career: Career): number {
  return stageOrder(career.academyStage) - stageOrder(naturalStage(career));
}

/** The cohort has reached senior football - the youth ladder is over for everyone. */
export function cohortHasGraduated(career: Career): boolean {
  return naturalStage(career) === 'senior';
}

/* ------------------------------------------------------------------ */
/* Football age                                                        */
/* ------------------------------------------------------------------ */

/**
 * The calendar month each season checkpoint falls in. A season labelled 2031 runs
 * August 2030 → June 2031, so preseason is in the previous calendar year.
 */
const SEASON_POINT_DATE: Record<SeasonPoint, { month: number; yearOffset: number }> = {
  preseason: { month: 8, yearOffset: -1 },
  midseason: { month: 1, yearOffset: 0 },
  season_end: { month: 6, yearOffset: 0 },
};

/**
 * Football age at a season checkpoint.
 *
 * This is why the player picks a birth month: two players in the same cohort can be a year
 * apart in displayed age at the same moment, while belonging to exactly the same age group.
 */
export function ageAt(dob: DateOfBirth, season: number, point: SeasonPoint): number {
  const { month, yearOffset } = SEASON_POINT_DATE[point];
  const calendarYear = season + yearOffset;
  const hadBirthday = month > dob.month || (month === dob.month && 1 >= dob.day);
  return calendarYear - dob.year - (hadBirthday ? 0 : 1);
}

export function currentAge(career: Career): number {
  return ageAt(career.dateOfBirth, career.currentSeason, career.seasonPoint);
}

/* ------------------------------------------------------------------ */
/* Relative age effect                                                 */
/* ------------------------------------------------------------------ */

/**
 * A small, temporary physical-maturity edge for players born early in the year.
 *
 * Deliberately *not* a talent modifier: potential is untouched, and this fades to nothing by
 * late youth. It only represents being physically bigger than a boy born eleven months later,
 * which is real in youth football and irrelevant among adults.
 */
export function relativeAgeBonus(career: Career): number {
  const stage = career.academyStage;
  if (stage === 'senior') return 0;

  const quarterBonus =
    career.dateOfBirth.month <= 3
      ? RELATIVE_AGE.earlyYearBonus
      : career.dateOfBirth.month >= 10
        ? -RELATIVE_AGE.lateYearBonus
        : 0;
  if (quarterBonus === 0) return 0;

  // Fades as the players grow: full weight in the children's groups, almost gone by נוער.
  const fade = Math.max(
    0,
    1 - stageOrder(stage) / RELATIVE_AGE.fadeOverStages,
  );
  return quarterBonus * fade;
}

/** Whether the player is among the youngest in his cohort - used for narrative. */
export function isYoungInCohort(career: Career): boolean {
  return career.dateOfBirth.month >= 10;
}

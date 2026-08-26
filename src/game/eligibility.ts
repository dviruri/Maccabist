/**
 * Professional-football eligibility by academy stage.
 *
 * Hard football rules, in one place. A twelve year old in ילדים ב׳ cannot train with the first
 * team, cannot sit on a senior bench, and cannot be offered a professional contract - and the
 * way to guarantee that is a reusable predicate the event data declares against, not an age
 * check copied into forty event definitions.
 *
 *   טרום ב׳ .. נערים ב׳   no professional contact whatsoever
 *   נערים א׳             first-team contact only as a genuinely extraordinary event
 *   נוער                 first-team integration becomes normal
 *   בוגרים               professional football
 */

import { stageOrder } from '../data/academy';
import type { AcademyStage, Career } from '../types';
import { SENIOR_ELIGIBILITY } from './balance';
import { hasTrait } from './memory';

/** The first stage at which first-team contact is a normal part of life. */
const NORMAL_SENIOR_CONTACT_STAGE: AcademyStage = 'u19';
/** The one stage below that where it can happen, exceptionally. */
const EXCEPTIONAL_SENIOR_CONTACT_STAGE: AcademyStage = 'youth_a';

/** Already a professional. */
export function isSenior(career: Career): boolean {
  return career.academyStage === 'senior';
}

/**
 * Can this player be involved with the first team at all - training, bench, a contract
 * conversation? True for נוער and above.
 */
export function allowsSeniorContact(career: Career): boolean {
  return stageOrder(career.academyStage) >= stageOrder(NORMAL_SENIOR_CONTACT_STAGE);
}

/**
 * The exceptional case: a נערים א׳ player extraordinary enough that the first team wants a
 * look. Deliberately demanding on several axes at once, so it cannot be reached by being
 * merely good at one thing.
 */
export function allowsExceptionalSeniorContact(career: Career): boolean {
  if (career.academyStage !== EXCEPTIONAL_SENIOR_CONTACT_STAGE) return false;

  const e = SENIOR_ELIGIBILITY;
  // Measured against his own age group - "extraordinary for a sixteen year old".
  const abilityEdge = career.ability - stageQuality(career.academyStage);

  const traitBoost = hasTrait(career, 'big_game') || hasTrait(career, 'late_bloomer') ? 1 : 0;

  return (
    abilityEdge >= e.exceptionalAbilityEdge &&
    career.hidden.potential >= e.exceptionalPotential &&
    career.coachTrust >= e.exceptionalCoachTrust &&
    career.roleValue >= e.exceptionalRoleValue &&
    career.hidden.form >= e.exceptionalForm - traitBoost * 6
  );
}

/**
 * The single predicate event data should use for anything that belongs to professional
 * football: senior training, a bench call, a first contract, a debut.
 */
export function allowsProfessionalEvent(career: Career): boolean {
  return isSenior(career) || allowsSeniorContact(career) || allowsExceptionalSeniorContact(career);
}

/** Stage quality without importing the whole level context (avoids a cycle). */
function stageQuality(stage: AcademyStage): number {
  // Kept local and small on purpose; the ladder's quality curve lives in data/academy.ts.
  const QUALITIES: Record<AcademyStage, number> = {
    pre_b: 18,
    pre_a: 23,
    children_c: 28,
    children_b: 33,
    children_a: 38,
    youth_c: 45,
    youth_b: 51,
    youth_a: 57,
    u19: 63,
    senior: 76,
  };
  return QUALITIES[stage];
}

/**
 * Stages at which no professional event may ever appear. Exported so the audit test can assert
 * it directly rather than restating the list.
 */
export const NO_PROFESSIONAL_CONTACT_STAGES: readonly AcademyStage[] = [
  'pre_b',
  'pre_a',
  'children_c',
  'children_b',
  'children_a',
  'youth_c',
  'youth_b',
];

export { EXCEPTIONAL_SENIOR_CONTACT_STAGE, NORMAL_SENIOR_CONTACT_STAGE };

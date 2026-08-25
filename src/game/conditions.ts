/**
 * Shared condition matching for events and for individual outcomes.
 * Pure predicate code - no randomness, no state changes.
 */

import { stageBand } from '../data/academy';
import type { Career, EventConditions } from '../types';
import { isAtMaccabi, isAtMaccabiSenior, isOnLoan, isPlayingAbroad } from './rules';

export interface ConditionContext {
  /** Appearances the condition should read: this season so far, or last season. */
  appearances: number;
}

function between(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function matchesConditions(
  career: Career,
  c: EventConditions | undefined,
  ctx: ConditionContext,
): boolean {
  if (!c) return true;

  if (!between(career.age, c.minAge, c.maxAge)) return false;
  if (c.stages && !c.stages.includes(career.academyStage)) return false;
  if (c.bands && !c.bands.includes(stageBand(career.academyStage))) return false;
  if (c.positions && !c.positions.includes(career.position)) return false;
  if (c.notPositions && c.notPositions.includes(career.position)) return false;

  if (!between(career.ability, c.minAbility, c.maxAbility)) return false;
  if (c.minPotential !== undefined && career.hidden.potential < c.minPotential) return false;
  if (!between(career.maccabism, c.minMaccabism, c.maxMaccabism)) return false;
  if (!between(career.reputation, c.minReputation, c.maxReputation)) return false;
  if (!between(career.coachTrust, c.minCoachTrust, c.maxCoachTrust)) return false;
  if (!between(career.hidden.form, c.minForm, c.maxForm)) return false;
  if (!between(career.hidden.confidence, c.minConfidence, c.maxConfidence)) return false;
  if (!between(career.roleValue, c.minRoleValue, c.maxRoleValue)) return false;
  if (c.roles && !c.roles.includes(career.role)) return false;
  if (c.olderGroup && !c.olderGroup.includes(career.olderGroup)) return false;

  if (c.atMaccabi !== undefined && isAtMaccabi(career) !== c.atMaccabi) return false;
  if (c.atMaccabiSenior !== undefined && isAtMaccabiSenior(career) !== c.atMaccabiSenior) return false;
  if (c.abroad !== undefined && isPlayingAbroad(career) !== c.abroad) return false;
  if (c.onLoan !== undefined && isOnLoan(career) !== c.onLoan) return false;
  if (c.isCaptain !== undefined && career.captain !== c.isCaptain) return false;
  if (c.hasLeftMaccabi !== undefined && career.maccabi.everLeft !== c.hasLeftMaccabi) return false;

  if (!between(ctx.appearances, c.minLastAppearances, c.maxLastAppearances)) return false;

  if (c.requiresFlags && !c.requiresFlags.every((f) => career.flags.includes(f))) return false;
  if (c.forbidsFlags && c.forbidsFlags.some((f) => career.flags.includes(f))) return false;

  return true;
}

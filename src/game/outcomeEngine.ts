/**
 * Weighted-outcome engine.
 *
 * A choice no longer *is* a set of effects. A choice opens a distribution of outcomes, and
 * where the player lands depends on who he is:
 *
 *   decision + player state + context + luck = outcome
 *
 * Event data declares `baseWeight` plus `modifiers`; this module turns that into real weights.
 * No probability logic belongs inside individual events.
 */

import type {
  Career,
  EventOutcome,
  ModifierAttribute,
  OutcomeModifier,
} from '../types';
import { matchesConditions, type ConditionContext } from './conditions';
import type { Rng } from './random';
import { abilityVsLevel } from './rules';

/** Reads the value a modifier is thresholding against. */
export function readAttribute(career: Career, attribute: ModifierAttribute): number {
  switch (attribute) {
    case 'ability':
      return career.ability;
    case 'potential':
      return career.hidden.potential;
    case 'form':
      return career.hidden.form;
    case 'confidence':
      return career.hidden.confidence;
    case 'coachTrust':
      return career.coachTrust;
    case 'maccabism':
      return career.maccabism;
    case 'reputation':
      return career.reputation;
    case 'discipline':
      return career.hidden.discipline;
    case 'roleValue':
      return career.roleValue;
    case 'age':
      return career.age;
    case 'injuryRisk':
      return career.hidden.injuryRisk;
    case 'abilityVsLevel':
      return abilityVsLevel(career);
    default:
      return 0;
  }
}

export function modifierApplies(career: Career, modifier: OutcomeModifier): boolean {
  const value = readAttribute(career, modifier.attribute);
  if (modifier.above !== undefined && value <= modifier.above) return false;
  if (modifier.below !== undefined && value >= modifier.below) return false;
  // A modifier with neither bound declared is a flat tweak that always applies.
  return true;
}

export interface WeightedOutcome {
  outcome: EventOutcome;
  weight: number;
  /** Which modifiers fired - surfaced in the debug panel only. */
  appliedModifiers: OutcomeModifier[];
}

/**
 * Turns declared weights into effective weights for this specific player.
 * Outcomes whose `conditions` do not hold are dropped entirely (weight 0).
 */
export function calculateOutcomeWeights(
  outcomes: readonly EventOutcome[],
  career: Career,
  ctx: ConditionContext,
): WeightedOutcome[] {
  return outcomes.map((outcome) => {
    if (!matchesConditions(career, outcome.conditions, ctx)) {
      return { outcome, weight: 0, appliedModifiers: [] };
    }

    let weight = outcome.baseWeight;
    const applied: OutcomeModifier[] = [];
    for (const modifier of outcome.modifiers ?? []) {
      if (modifierApplies(career, modifier)) {
        weight *= modifier.multiplier;
        applied.push(modifier);
      }
    }

    return { outcome, weight: Math.max(0, weight), appliedModifiers: applied };
  });
}

/** Normalised probabilities. Debug/testing only - never shown to the player. */
export function outcomeProbabilities(
  outcomes: readonly EventOutcome[],
  career: Career,
  ctx: ConditionContext,
): { id: string; probability: number }[] {
  const weighted = calculateOutcomeWeights(outcomes, career, ctx);
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (total <= 0) return weighted.map((w) => ({ id: w.outcome.id, probability: 0 }));
  return weighted.map((w) => ({ id: w.outcome.id, probability: w.weight / total }));
}

/**
 * Picks one outcome. Deterministic for a given rng state, which is what makes careers
 * reproducible and the tests meaningful.
 */
export function selectWeightedOutcome(
  outcomes: readonly EventOutcome[],
  career: Career,
  rng: Rng,
  ctx: ConditionContext,
): EventOutcome | null {
  const weighted = calculateOutcomeWeights(outcomes, career, ctx);
  const picked = rng.weighted(weighted, (w) => w.weight);
  if (picked) return picked.outcome;
  // Every outcome was gated out - fall back to the first one that is at least possible.
  const fallback = weighted.find((w) => matchesConditions(career, w.outcome.conditions, ctx));
  return fallback?.outcome ?? outcomes[0] ?? null;
}

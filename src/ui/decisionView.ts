import type { DecisionDistribution, OutcomeValence } from '../types';

/**
 * The decision VIEW MODEL (v0.9.5).
 *
 * v0.9.5 changes how a career decision is presented, and nothing about what it does. That line is
 * easy to state and easy to cross, so the crossing is made structural here: this module turns
 * facts the engine already produced into the shape a choice card renders, and it is the only
 * place allowed to do that. It computes no probability, consults no RNG, and reads no career
 * state that the caller did not already hand it.
 *
 * The one arithmetic operation in the file is `outcomeSummary`, which ADDS UP percentages the
 * engine has already assigned. Summing 45 and 15 into 60 is not a second opinion about the odds -
 * it is the same odds, grouped. `calculateOutcomeDistribution` remains the only thing in the game
 * that decides what a number is, and `resolveFromDistribution` still draws from that same object.
 */

/** How a single supporting fact reads on a choice card. */
export type ChoiceFactTone = 'positive' | 'negative' | 'neutral';

export interface ChoiceFact {
  tone: ChoiceFactTone;
  text: string;
}

export const FACT_ICON: Record<ChoiceFactTone, string> = {
  positive: '🟢',
  negative: '🔴',
  neutral: '⚪',
};

/**
 * The three-figure roll-up shown on a choice card.
 *
 * Five valences are more shades than a player can weigh at a glance while choosing, so they are
 * grouped into the three questions he is actually asking: does this go well, does nothing happen,
 * does it go badly. Every concrete outcome and its own exact percentage stays one tap away in the
 * details sheet - this summarises them, it does not replace them.
 */
export interface OutcomeSummary {
  good: number;
  flat: number;
  bad: number;
}

const GOOD: OutcomeValence[] = ['majorPositive', 'positive'];
const BAD: OutcomeValence[] = ['negative', 'majorNegative'];

function share(distribution: DecisionDistribution, valences: OutcomeValence[]): number {
  return distribution.outcomes
    .filter((outcome) => valences.includes(outcome.valence))
    .reduce((sum, outcome) => sum + outcome.percent, 0);
}

/**
 * Group the engine's own percentages by valence. Never a recalculation.
 *
 * Returns null when the choice is not probabilistic - a single-outcome choice has nothing to be
 * uncertain about, and drawing a 100% bar beside it would invent a decision the player is not
 * making. Callers render the choice's authored hint instead.
 */
export function outcomeSummary(distribution: DecisionDistribution): OutcomeSummary | null {
  if (distribution.outcomes.length < 2) return null;
  return {
    good: share(distribution, GOOD),
    flat: share(distribution, ['neutral']),
    bad: share(distribution, BAD),
  };
}

/** True when this choice has real odds to show. The one test for "may I draw percentages". */
export function isProbabilistic(distribution: DecisionDistribution): boolean {
  return distribution.outcomes.length >= 2;
}

/**
 * The engine's consequence hints, split by direction so a card can colour them.
 *
 * `consequenceHints` returns Hebrew sentences it has already decided are upside or downside - the
 * direction is in the wording, not in a field - so this recognises its own vocabulary rather than
 * guessing at sentiment. A hint it does not recognise is shown as neutral, which is the safe
 * failure: an unclassified fact is still a true fact, it just does not get a colour.
 */
const DOWNSIDE_MARKERS = ['סיכון', 'עלול', 'לאבד', 'לפגוע', 'לעצור', 'ירידה'];

export function toneOfHint(hint: string): ChoiceFactTone {
  return DOWNSIDE_MARKERS.some((marker) => hint.includes(marker)) ? 'negative' : 'positive';
}

/**
 * Turn the engine's hints into card facts, best-first and capped.
 *
 * The cap is a presentation decision and is the point of the whole release: a card carrying six
 * consequences is the data page this version is removing. `consequenceHints` already caps at four;
 * a card shows at most three, and the details sheet carries the rest.
 */
export function factsFromHints(hints: readonly string[], limit = 3): ChoiceFact[] {
  const ordered = [...hints].sort((a, b) => {
    const rank = (hint: string): number => (toneOfHint(hint) === 'positive' ? 0 : 1);
    return rank(a) - rank(b);
  });
  return ordered.slice(0, limit).map((text) => ({ tone: toneOfHint(text), text }));
}

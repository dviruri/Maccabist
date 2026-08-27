/**
 * Decisions with visible odds (v0.4.1).
 *
 * The product goal: the player should think *"I understand the risk. I made a choice. Now let's
 * see what happens"* rather than *"the game randomly decided something"*. That requires showing
 * the real probability of each outcome before he commits.
 *
 * The hard part is not rendering percentages — it is guaranteeing that the numbers shown are the
 * numbers used. This module exists so that there is exactly one function producing a
 * distribution, and both the UI preview and the resolver consume it:
 *
 *   calculateOutcomeDistribution(career, event, choice, slot)
 *       |                                    |
 *   UI preview                          resolveEventChoice
 *
 * React never computes a probability. There is no second formula to drift.
 *
 * Two subtleties that make the invariant actually hold rather than merely look like it does:
 *
 *  1. The distribution is computed on the career state **as the player sees it** — before the
 *     choice's own `effects` are applied. Resolution uses the same pre-effect state. Otherwise a
 *     choice that costs coach trust would silently shift the very odds it was shown alongside.
 *
 *  2. Display percentages are integers that sum to exactly 100, computed once here. If the UI
 *     rounded independently it could print 33/33/33 while the engine used something else.
 *
 * Hidden attributes (potential, form, confidence, leadership) are allowed to move the numbers.
 * They are never named: the player may see "פריצת דרך — 27%" but never "because potential is 91".
 */

import type {
  Career,
  DecisionDistribution,
  DecisionOutcomeView,
  EventChoice,
  GameEvent,
  OutcomeValence,
  RiskLevel,
  SeasonSlot,
} from '../types';
import { conditionContext } from './conditions';
import { calculateOutcomeWeights } from './outcomeEngine';
import type { Rng } from './random';

/* ------------------------------------------------------------------ */
/* Valence                                                             */
/* ------------------------------------------------------------------ */

/**
 * How good or bad an outcome is, for presentation.
 *
 * Derived from the event data — the author's `tone`, plus how much the outcome actually moves the
 * career — so the engine owns the semantics and the UI only renders them. A UI colour must never
 * be what decides whether something counts as a disaster.
 */
export function outcomeValence(
  choice: EventChoice,
  outcome: { tone: string; effects: Record<string, unknown> },
): OutcomeValence {
  const magnitude = effectMagnitude(outcome.effects);
  if (outcome.tone === 'good') return magnitude >= MAJOR_MAGNITUDE ? 'majorPositive' : 'positive';
  if (outcome.tone === 'bad') return magnitude >= MAJOR_MAGNITUDE ? 'majorNegative' : 'negative';
  void choice;
  return 'neutral';
}

/** Above this total attribute movement an outcome reads as a turning point rather than a nudge. */
const MAJOR_MAGNITUDE = 18;

/** Attributes whose movement the player would actually notice. */
const WEIGHTED_EFFECTS: readonly string[] = [
  'ability',
  'coachTrust',
  'reputation',
  'roleValue',
  'confidence',
  'form',
  'maccabism',
  'leadership',
  'potential',
];

function effectMagnitude(effects: Record<string, unknown>): number {
  let total = 0;
  for (const key of WEIGHTED_EFFECTS) {
    const value = effects[key];
    if (typeof value === 'number') total += Math.abs(value);
  }
  // A move, a milestone or an opened storyline is a big deal regardless of the numbers.
  if (effects.transferTo || effects.startArc || effects.milestone) total += 10;
  return total;
}

/* ------------------------------------------------------------------ */
/* The distribution                                                    */
/* ------------------------------------------------------------------ */

/**
 * The single source of truth for what can happen and how likely it is.
 *
 * `career` must be the state the player is looking at — do not pre-apply the choice's effects.
 */
export function calculateOutcomeDistribution(
  career: Career,
  event: GameEvent,
  choice: EventChoice,
  slot: SeasonSlot,
): DecisionDistribution {
  const ctx = conditionContext(career, slot);
  const weighted = calculateOutcomeWeights(choice.outcomes, career, ctx, choice.risk);
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);

  // Every outcome gated out. Real, and the caller has to cope rather than divide by zero.
  if (total <= 0) {
    return {
      eventId: event.id,
      choiceId: choice.id,
      outcomes: [],
      totalWeight: 0,
      risk: 'low',
      upside: 0,
      downside: 0,
    };
  }

  const possible = weighted.filter((w) => w.weight > 0);
  const percents = wholePercentages(possible.map((w) => w.weight));

  const outcomes: DecisionOutcomeView[] = possible.map((w, i) => {
    const valence = outcomeValence(choice, w.outcome as never);
    return {
      id: w.outcome.id,
      label: outcomeLabelOf(w.outcome.id, valence),
      valence,
      probability: w.weight / total,
      percent: percents[i] as number,
      weight: w.weight,
    };
  });

  const upside = shareOf(outcomes, ['positive', 'majorPositive']);
  const downside = shareOf(outcomes, ['negative', 'majorNegative']);

  return {
    eventId: event.id,
    choiceId: choice.id,
    outcomes,
    totalWeight: total,
    risk: riskLevelFrom(outcomes, choice),
    upside,
    downside,
  };
}

function shareOf(outcomes: DecisionOutcomeView[], valences: OutcomeValence[]): number {
  return outcomes
    .filter((o) => valences.includes(o.valence))
    .reduce((sum, o) => sum + o.probability, 0);
}

/* ------------------------------------------------------------------ */
/* Percentages that add up                                            */
/* ------------------------------------------------------------------ */

/**
 * Integer percentages summing to exactly 100 (largest-remainder method).
 *
 * Naive rounding gives 33/33/33 = 99, which reads as a bug to a player. Computed here rather than
 * in the UI so the preview and any test read identical numbers.
 */
export function wholePercentages(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, f) => sum + f, 0);

  // Hand the leftover points to the largest fractional parts, biggest first.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (const { index } of order) {
    if (remaining <= 0) break;
    result[index] = (result[index] as number) + 1;
    remaining -= 1;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Risk label                                                          */
/* ------------------------------------------------------------------ */

/**
 * A qualitative summary, derived from the distribution rather than computed separately.
 *
 * The percentages remain the source of truth; this is a glance-level hint. It reads the chance and
 * severity of the downside, so "unlikely but catastrophic" and "likely but mild" do not collapse
 * into the same label.
 */
export function riskLevelFrom(outcomes: DecisionOutcomeView[], choice: EventChoice): RiskLevel {
  if (outcomes.length === 0) return 'low';

  const majorDown = shareOf(outcomes, ['majorNegative']);
  const anyDown = shareOf(outcomes, ['negative', 'majorNegative']);

  if (majorDown >= 0.25 || anyDown >= 0.5) return 'high';
  if (majorDown >= 0.08 || anyDown >= 0.25) return 'medium';
  // Trust the author's own read when the numbers are borderline.
  if (choice.risk === 'risky') return 'medium';
  return 'low';
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'סיכון נמוך',
  medium: 'סיכון בינוני',
  high: 'סיכון גבוה',
};

/** True when the upside is worth flagging alongside the risk. */
export function hasHighUpside(distribution: DecisionDistribution): boolean {
  const major = distribution.outcomes
    .filter((o) => o.valence === 'majorPositive')
    .reduce((sum, o) => sum + o.probability, 0);
  return major >= 0.15;
}

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

/**
 * A short Hebrew label for an outcome, for the preview list and the reveal.
 *
 * Authored labels come first; otherwise the outcome id is mapped through a small vocabulary of
 * the shapes that recur across the event pool. The full narrative text is only revealed *after*
 * the choice — showing it up front would give away the story.
 */
const OUTCOME_LABELS: Record<string, string> = {
  breakthrough: 'פריצת דרך',
  thrived: 'פריצת דרך',
  decisive: 'הכרעה',
  scored: 'הצלחה גדולה',
  legend_here: 'רגע גדול',
  moment: 'רגע גדול',
  galvanised: 'הובלת את הקבוצה',
  adored: 'הקהל אימץ אותך',
  adopted: 'הקהל אימץ אותך',
  respected: 'זכית בכבוד',
  respected_honesty: 'זכית בכבוד',
  held_own: 'השתלבות טובה',
  settled: 'השתלבות טובה',
  steady: 'השתלבות טובה',
  delivered: 'עמדת בזה',
  survived: 'עברת את זה',
  professional: 'עברת את זה',
  fine: 'בסדר',
  nothing: 'לא קרה כלום',
  flat: 'עונה אפורה',
  experience: 'צברת ניסיון',
  too_early: 'זה היה מוקדם מדי',
  struggled: 'התקשית',
  swallowed: 'הלחץ ניצח',
  froze: 'הלחץ ניצח',
  overplayed: 'ניסית יותר מדי',
  missed: 'החטאת',
  dragged_down: 'נגרפת עם הקבוצה',
  wore_down: 'נשחקת',
  burned: 'זה נגד אותך',
  worse: 'החמרת את המצב',
  not_your_place: 'לא היה הרגע שלך',
  cost_him: 'זה עלה לך',
  turned_on_you: 'הקהל התהפך עליך',
  no_one_called: 'אף אחד לא התקשר',
};

/**
 * Generic labels by valence, for outcomes the vocabulary above does not cover.
 *
 * Deliberately NOT the narrative text. An early draft fell back to the first clause of the
 * outcome's story, which meant the preview printed things like "שיחקת 90 דקות והיית מהטובים
 * במגרש" before the player had chosen - giving away the result it was supposed to be the odds of.
 * A vague-but-honest label plus a real percentage is the whole point; the story is the reward for
 * committing.
 */
const VALENCE_LABELS: Record<OutcomeValence, string> = {
  majorPositive: 'הצלחה גדולה',
  positive: 'תוצאה טובה',
  neutral: 'בלי דרמה',
  negative: 'תוצאה רעה',
  majorNegative: 'כישלון כבד',
};

export function outcomeLabelOf(id: string, valence: OutcomeValence): string {
  return OUTCOME_LABELS[id] ?? VALENCE_LABELS[valence];
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * Picks one outcome id from a distribution the caller already has.
 *
 * This is what makes the invariant structural rather than a promise: the resolver cannot use
 * different odds from the preview because it is handed the preview's own distribution.
 */
export function resolveFromDistribution(
  distribution: DecisionDistribution,
  rng: Rng,
): string | null {
  if (distribution.outcomes.length === 0) return null;
  const picked = rng.weighted(distribution.outcomes, (o) => o.weight);
  return picked?.id ?? distribution.outcomes[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Consequence hints                                                   */
/* ------------------------------------------------------------------ */

/**
 * Qualitative notes about what a choice could move, shown before deciding.
 *
 * Deliberately directional rather than numeric ("אמון המאמן עשוי לעלות משמעותically" rather than
 * "+7 coach trust"). The exact numbers are shown *after* resolution, where they are a result
 * rather than a spoiler.
 */
export function consequenceHints(distribution: DecisionDistribution, choice: EventChoice): string[] {
  const hints: string[] = [];
  const reach = new Map<string, number>();

  for (const view of distribution.outcomes) {
    const outcome = choice.outcomes.find((o) => o.id === view.id);
    if (!outcome) continue;
    for (const [key, value] of Object.entries(outcome.effects)) {
      if (typeof value !== 'number') continue;
      const current = reach.get(key) ?? 0;
      if (Math.abs(value) > Math.abs(current)) reach.set(key, value);
    }
  }

  const note = (key: string, up: string, down: string, big: number): void => {
    const value = reach.get(key);
    if (value === undefined || value === 0) return;
    hints.push(value > 0 ? up : down);
    void big;
  };

  note('coachTrust', 'אמון המאמן עשוי לעלות', 'סיכון לאבד את אמון המאמן', 8);
  note('roleValue', 'סיכוי להתקדם במעמד', 'סיכון לירידה במעמד', 8);
  note('confidence', 'הביטחון עשוי לעלות', 'סיכון לירידה בביטחון', 8);
  note('ability', 'הזדמנות להתפתח', 'עלול לעצור את ההתפתחות', 4);
  note('reputation', 'עשוי להגדיל את המוניטין', 'עלול לפגוע במוניטין', 6);
  note('minutesModifier', 'סיכוי לקבל יותר דקות', 'עלול לעלות לך בדקות', 0);

  if (reach.has('injuryChance')) hints.push('סיכון לפציעה');

  return hints.slice(0, 4);
}

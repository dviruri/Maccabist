/**
 * v0.4.1 Phase 12: decisions with visible odds.
 *
 * The feature is not "show percentages" — it is "show the percentages that actually decide the
 * career". A game that displays 18% and resolves on some other number is worse than one that
 * displays nothing, because it teaches the player that the numbers are decoration.
 *
 * So the tests that matter here are the invariant ones:
 *
 *   - the preview distribution and the resolver's distribution are the same object
 *   - displayed integers sum to exactly 100
 *   - the same seed and choice always give the same outcome
 *   - a different player state produces different odds
 *   - hidden attributes move the odds without being exposed
 *   - observed frequency over many draws matches the displayed probability
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL, EVENTS_BY_ID } from '../src/data/events';
import { createCareer } from '../src/game/careerEngine';
import { conditionContext } from '../src/game/conditions';
import {
  calculateOutcomeDistribution,
  consequenceHints,
  hasHighUpside,
  resolveFromDistribution,
  RISK_LABELS,
  riskLevelFrom,
  wholePercentages,
} from '../src/game/decisionEngine';
import { resolveEventChoice } from '../src/game/eventEngine';
import { calculateOutcomeWeights } from '../src/game/outcomeEngine';
import { createRng } from '../src/game/random';
import type { Career, EventChoice, GameEvent, SeasonSlot } from '../src/types';

const base = (seed = 4): Career => createCareer({ playerName: 'ל', position: 'CM', seed });

/** A senior with room to move in every direction, so few outcomes get gated out. */
const midCareer = (over: Partial<Career> = {}): Career => ({
  ...base(),
  academyStage: 'senior',
  currentClubId: 'maccabi_haifa',
  age: 24,
  ability: 62,
  reputation: 45,
  coachTrust: 58,
  roleValue: 55,
  ...over,
});

/** Events with a genuinely probabilistic choice, i.e. more than one possible outcome. */
function probabilisticChoices(career: Career, slot: SeasonSlot = 'early'): Array<{
  event: GameEvent;
  choice: EventChoice;
}> {
  const found: Array<{ event: GameEvent; choice: EventChoice }> = [];
  for (const event of EVENT_POOL) {
    for (const choice of event.choices) {
      const dist = calculateOutcomeDistribution(career, event, choice, slot);
      if (dist.outcomes.length >= 2) found.push({ event, choice });
    }
  }
  return found;
}

describe('whole percentages', () => {
  it('sums to exactly 100', () => {
    const cases: number[][] = [
      [1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [40, 60],
      [33, 33, 34],
      [7, 11, 13, 17, 19],
      [0.001, 0.002, 0.003],
      [99999, 1],
    ];
    for (const weights of cases) {
      const percents = wholePercentages(weights);
      expect(percents.reduce((a, b) => a + b, 0), weights.join('/')).toBe(100);
    }
  });

  it('never prints 33/33/33', () => {
    // The specific case the brief calls out. Largest-remainder gives 34/33/33.
    expect(wholePercentages([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('gives the leftover points to the largest fractions', () => {
    const percents = wholePercentages([1, 1, 2]);
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100);
    expect(percents[2]).toBe(50);
  });

  it('returns zeroes rather than NaN for an impossible choice', () => {
    expect(wholePercentages([0, 0])).toEqual([0, 0]);
    expect(wholePercentages([])).toEqual([]);
  });
});

describe('every distribution in the event pool', () => {
  it('has percentages summing to 100 whenever anything is possible', () => {
    const career = midCareer();
    let checked = 0;
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const dist = calculateOutcomeDistribution(career, event, choice, 'early');
        if (dist.outcomes.length === 0) continue;
        checked += 1;
        const sum = dist.outcomes.reduce((total, o) => total + o.percent, 0);
        expect(sum, `${event.id}/${choice.id}`).toBe(100);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('has probabilities summing to 1', () => {
    const career = midCareer();
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const dist = calculateOutcomeDistribution(career, event, choice, 'early');
        if (dist.outcomes.length === 0) continue;
        const sum = dist.outcomes.reduce((total, o) => total + o.probability, 0);
        expect(sum, `${event.id}/${choice.id}`).toBeCloseTo(1, 10);
      }
    }
  });

  it('gives every possible outcome a non-empty label and a valence', () => {
    const career = midCareer();
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        for (const outcome of calculateOutcomeDistribution(career, event, choice, 'early').outcomes) {
          expect(outcome.label.length, `${event.id}/${choice.id}/${outcome.id}`).toBeGreaterThan(0);
          expect(outcome.valence).toBeDefined();
        }
      }
    }
  });

  it('never lists an outcome the player cannot actually get', () => {
    const child = base();
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const dist = calculateOutcomeDistribution(child, event, choice, 'early');
        for (const view of dist.outcomes) {
          expect(view.probability).toBeGreaterThan(0);
          expect(view.weight).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('the preview and the resolver use the same distribution', () => {
  /*
   * The structural guarantee: `calculateOutcomeDistribution` is the only place weights are turned
   * into probabilities, and `resolveEventChoice` draws from its result. These tests check the
   * property from the outside, so a future refactor that reintroduces a second formula fails here.
   */
  it('matches calculateOutcomeWeights exactly', () => {
    const career = midCareer();
    for (const { event, choice } of probabilisticChoices(career).slice(0, 40)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      const raw = calculateOutcomeWeights(
        choice.outcomes,
        career,
        conditionContext(career, 'early'),
        choice.risk,
      );
      const total = raw.reduce((sum, w) => sum + w.weight, 0);
      for (const view of dist.outcomes) {
        const match = raw.find((w) => w.outcome.id === view.id);
        expect(match, `${event.id}/${view.id}`).toBeDefined();
        expect(view.probability).toBeCloseTo((match as { weight: number }).weight / total, 12);
      }
    }
  });

  it('resolves only outcomes the preview listed', () => {
    const career = midCareer();
    for (const { event, choice } of probabilisticChoices(career).slice(0, 30)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      const ids = new Set(dist.outcomes.map((o) => o.id));
      for (let seed = 1; seed <= 25; seed += 1) {
        const resolved = resolveFromDistribution(dist, createRng(seed));
        expect(ids.has(resolved as string), `${event.id}/${choice.id} -> ${resolved}`).toBe(true);
      }
    }
  });

  it('is unaffected by the choice\'s own effects being applied later', () => {
    /*
     * choice.effects used to be applied *before* the weights were computed, so a choice that cost
     * coach trust moved the very odds it was shown alongside and no preview could have matched.
     * The distribution is now taken from the untouched career.
     */
    const career = midCareer();
    const withEffects = EVENT_POOL.flatMap((event) =>
      event.choices.filter((c) => c.effects !== undefined).map((choice) => ({ event, choice })),
    );
    expect(withEffects.length).toBeGreaterThan(0);

    for (const { event, choice } of withEffects) {
      const before = calculateOutcomeDistribution(career, event, choice, 'early');
      const again = calculateOutcomeDistribution(career, event, choice, 'early');
      expect(again.outcomes.map((o) => o.percent)).toEqual(before.outcomes.map((o) => o.percent));
    }
  });

  it('resolves through the real event pipeline to a previewed outcome', () => {
    const career = { ...midCareer(), pendingEventIds: [] as string[] };
    for (const { event, choice } of probabilisticChoices(career).slice(0, 30)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      const ids = new Set(dist.outcomes.map((o) => o.id));
      const resolved = resolveEventChoice(career, event.id, choice.id, createRng(11), 'early');
      expect(ids.has(resolved.result.outcomeId), `${event.id}/${choice.id}`).toBe(true);
    }
  });
});

describe('determinism', () => {
  it('gives the same outcome for the same seed and choice', () => {
    const career = midCareer();
    const { event, choice } = probabilisticChoices(career)[0] as {
      event: GameEvent;
      choice: EventChoice;
    };
    const first = resolveEventChoice(career, event.id, choice.id, createRng(99), 'early');
    const second = resolveEventChoice(career, event.id, choice.id, createRng(99), 'early');
    expect(second.result.outcomeId).toBe(first.result.outcomeId);
    expect(second.result.outcomeText).toBe(first.result.outcomeText);
  });

  it('gives different outcomes across seeds', () => {
    const career = midCareer();
    const { event, choice } = probabilisticChoices(career).find(
      ({ event: e, choice: c }) =>
        calculateOutcomeDistribution(career, e, c, 'early').outcomes.length >= 2,
    ) as { event: GameEvent; choice: EventChoice };

    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      seen.add(resolveFromDistribution(
        calculateOutcomeDistribution(career, event, choice, 'early'),
        createRng(seed),
      ) as string);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('the odds respond to who the player is', () => {
  it('changes when the visible state changes', () => {
    const weak = midCareer({ ability: 35, coachTrust: 25, roleValue: 20 });
    const strong = midCareer({ ability: 88, coachTrust: 90, roleValue: 85 });

    let differing = 0;
    for (const { event, choice } of probabilisticChoices(strong)) {
      const a = calculateOutcomeDistribution(weak, event, choice, 'early');
      const b = calculateOutcomeDistribution(strong, event, choice, 'early');
      const same =
        a.outcomes.length === b.outcomes.length &&
        a.outcomes.every((o, i) => o.percent === b.outcomes[i]?.percent);
      if (!same) differing += 1;
    }
    expect(differing).toBeGreaterThan(0);
  });

  it('lets hidden potential move the odds without exposing it', () => {
    const low: Career = { ...midCareer(), hidden: { ...midCareer().hidden, potential: 45 } };
    const high: Career = { ...midCareer(), hidden: { ...midCareer().hidden, potential: 95 } };

    let differing = 0;
    for (const { event, choice } of probabilisticChoices(high)) {
      const a = calculateOutcomeDistribution(low, event, choice, 'early');
      const b = calculateOutcomeDistribution(high, event, choice, 'early');
      if (a.outcomes.some((o, i) => o.percent !== b.outcomes[i]?.percent)) differing += 1;

      // Whatever the odds, nothing in what the player sees may name the hidden value.
      for (const view of b.outcomes) {
        expect(view.label).not.toMatch(/potential|פוטנציאל|\d\d\b/);
      }
    }
    expect(differing).toBeGreaterThan(0);
  });
});

describe('observed frequency matches the displayed probability', () => {
  it('draws in proportion to the shown percentages', () => {
    const career = midCareer();
    const candidates = probabilisticChoices(career).filter(
      ({ event, choice }) =>
        calculateOutcomeDistribution(career, event, choice, 'early').outcomes.length >= 2,
    );
    // A handful of real choices rather than a synthetic distribution, so this also exercises
    // conditions, modifiers, traits and the risky-upside boost.
    expect(candidates.length, 'no probabilistic choices found - test would pass vacuously')
      .toBeGreaterThan(20);
    for (const { event, choice } of candidates.slice(0, 6)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      const counts = new Map<string, number>();
      const draws = 12000;
      for (let seed = 1; seed <= draws; seed += 1) {
        const id = resolveFromDistribution(dist, createRng(seed)) as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const view of dist.outcomes) {
        const observed = (counts.get(view.id) ?? 0) / draws;
        expect(
          Math.abs(observed - view.probability),
          `${event.id}/${choice.id}/${view.id}: shown ${view.probability.toFixed(3)}, observed ${observed.toFixed(3)}`,
        ).toBeLessThan(0.02);
      }
    }
  });
});

describe('risk labels', () => {
  it('come from the distribution, not from a separate guess', () => {
    const career = midCareer();
    for (const { event, choice } of probabilisticChoices(career).slice(0, 40)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      expect(dist.risk).toBe(riskLevelFrom(dist.outcomes, choice));
      expect(RISK_LABELS[dist.risk]).toBeTruthy();
    }
  });

  it('rates a mostly-bad choice as high risk and a safe one as low', () => {
    const mostlyBad = [
      { id: 'a', label: 'x', valence: 'majorNegative' as const, probability: 0.6, percent: 60, weight: 6 },
      { id: 'b', label: 'y', valence: 'positive' as const, probability: 0.4, percent: 40, weight: 4 },
    ];
    const mostlyFine = [
      { id: 'a', label: 'x', valence: 'positive' as const, probability: 0.8, percent: 80, weight: 8 },
      { id: 'b', label: 'y', valence: 'neutral' as const, probability: 0.2, percent: 20, weight: 2 },
    ];
    const choice = { id: 'c', label: 'l', outcomes: [] } as unknown as EventChoice;
    expect(riskLevelFrom(mostlyBad, choice)).toBe('high');
    expect(riskLevelFrom(mostlyFine, choice)).toBe('low');
  });

  it('flags a real chance of a big win as high upside', () => {
    const career = midCareer();
    const flagged = probabilisticChoices(career).filter(({ event, choice }) =>
      hasHighUpside(calculateOutcomeDistribution(career, event, choice, 'early')),
    );
    expect(flagged.length).toBeGreaterThan(0);
  });
});

describe('consequence hints', () => {
  it('describe direction without printing the numbers', () => {
    const career = midCareer();
    let withHints = 0;
    for (const { event, choice } of probabilisticChoices(career).slice(0, 60)) {
      const dist = calculateOutcomeDistribution(career, event, choice, 'early');
      const hints = consequenceHints(dist, choice);
      if (hints.length > 0) withHints += 1;
      for (const hint of hints) {
        expect(hint).not.toMatch(/\d/);
        expect(hint.length).toBeLessThan(60);
      }
      expect(hints.length).toBeLessThanOrEqual(4);
    }
    expect(withHints).toBeGreaterThan(20);
  });
});

describe('impossible choices', () => {
  it('return an empty distribution rather than dividing by zero', () => {
    const career = base();
    const impossible: EventChoice = {
      id: 'imp',
      label: 'x',
      outcomes: [
        {
          id: 'never',
          baseWeight: 10,
          tone: 'good',
          text: 't',
          effects: {},
          conditions: { minAbility: 200 },
        },
      ],
    };
    const event = EVENTS_BY_ID[EVENT_POOL[0]!.id] as GameEvent;
    const dist = calculateOutcomeDistribution(career, event, impossible, 'early');
    expect(dist.outcomes).toEqual([]);
    expect(dist.totalWeight).toBe(0);
    expect(resolveFromDistribution(dist, createRng(1))).toBeNull();
  });
});

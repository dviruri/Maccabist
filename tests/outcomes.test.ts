import { describe, expect, it } from 'vitest';

import { EVENTS_BY_ID, EVENT_POOL } from '../src/data/events';
import { EVENTS } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import {
  conditionContext,
  isEventEligible,
  resolveEventChoice,
  selectionWeight,
} from '../src/game/eventEngine';
import {
  calculateOutcomeWeights,
  outcomeProbabilities,
  readAttribute,
  selectWeightedOutcome,
} from '../src/game/outcomeEngine';
import { createRng } from '../src/game/random';
import type { Career, EventOutcome } from '../src/types';

function career(overrides: Partial<Career> = {}): Career {
  return { ...createCareer({ playerName: 'בודק', position: 'CM', seed: 99 }), ...overrides };
}

const ctx = { appearances: 10 };

const outcomes: EventOutcome[] = [
  { id: 'good', baseWeight: 50, tone: 'good', text: 'טוב', effects: {} },
  { id: 'bad', baseWeight: 50, tone: 'bad', text: 'רע', effects: {} },
];

describe('weighted outcomes', () => {
  it('is deterministic for the same seed', () => {
    const c = career();
    const a = selectWeightedOutcome(outcomes, c, createRng(555), ctx);
    const b = selectWeightedOutcome(outcomes, c, createRng(555), ctx);
    expect(a?.id).toBe(b?.id);
  });

  it('can land differently on different seeds', () => {
    const c = career();
    const ids = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      ids.add(selectWeightedOutcome(outcomes, c, createRng(i + 1), ctx)?.id ?? '');
    }
    // The whole point of v0.2: the same choice does not always give the same result.
    expect(ids.size).toBeGreaterThan(1);
  });

  it('applies a modifier only when its threshold is met', () => {
    const boosted: EventOutcome[] = [
      {
        id: 'breakthrough',
        baseWeight: 10,
        tone: 'good',
        text: 'פריצה',
        effects: {},
        modifiers: [{ attribute: 'coachTrust', above: 70, multiplier: 3 }],
      },
      { id: 'normal', baseWeight: 90, tone: 'neutral', text: 'רגיל', effects: {} },
    ];

    const trusted = calculateOutcomeWeights(boosted, career({ coachTrust: 85 }), ctx);
    const untrusted = calculateOutcomeWeights(boosted, career({ coachTrust: 40 }), ctx);

    expect(trusted[0]?.weight).toBe(30);
    expect(untrusted[0]?.weight).toBe(10);
    expect(trusted[0]?.appliedModifiers).toHaveLength(1);
    expect(untrusted[0]?.appliedModifiers).toHaveLength(0);
  });

  it('stacks multiple modifiers multiplicatively', () => {
    const stacked: EventOutcome[] = [
      {
        id: 'x',
        baseWeight: 10,
        tone: 'good',
        text: '',
        effects: {},
        modifiers: [
          { attribute: 'ability', above: 50, multiplier: 2 },
          { attribute: 'confidence', below: 40, multiplier: 0.5 },
        ],
      },
    ];
    const weights = calculateOutcomeWeights(
      stacked,
      career({ ability: 70, hidden: { ...career().hidden, confidence: 30 } }),
      ctx,
    );
    expect(weights[0]?.weight).toBe(10);
  });

  it('drops outcomes whose conditions do not hold', () => {
    const gated: EventOutcome[] = [
      {
        id: 'wonderkid_only',
        baseWeight: 100,
        tone: 'good',
        text: '',
        effects: {},
        conditions: { minPotential: 95 },
      },
      { id: 'fallback', baseWeight: 1, tone: 'neutral', text: '', effects: {} },
    ];
    const ordinary = career({ hidden: { ...career().hidden, potential: 70 } });
    const weights = calculateOutcomeWeights(gated, ordinary, ctx);
    expect(weights[0]?.weight).toBe(0);
    expect(selectWeightedOutcome(gated, ordinary, createRng(1), ctx)?.id).toBe('fallback');
  });

  it('reports probabilities that sum to 1', () => {
    const probs = outcomeProbabilities(outcomes, career(), ctx);
    const total = probs.reduce((sum, p) => sum + p.probability, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('shifts the distribution towards good outcomes for a stronger player', () => {
    const shaped: EventOutcome[] = [
      {
        id: 'success',
        baseWeight: 40,
        tone: 'good',
        text: '',
        effects: {},
        modifiers: [{ attribute: 'coachTrust', above: 70, multiplier: 1.5 }],
      },
      {
        id: 'failure',
        baseWeight: 40,
        tone: 'bad',
        text: '',
        effects: {},
        modifiers: [{ attribute: 'confidence', below: 40, multiplier: 1.6 }],
      },
    ];

    const strong = outcomeProbabilities(shaped, career({ coachTrust: 85 }), ctx);
    const weak = outcomeProbabilities(
      shaped,
      career({ coachTrust: 40, hidden: { ...career().hidden, confidence: 30 } }),
      ctx,
    );

    const successOf = (rows: { id: string; probability: number }[]): number =>
      rows.find((r) => r.id === 'success')?.probability ?? 0;
    expect(successOf(strong)).toBeGreaterThan(successOf(weak));
  });

  it('lifts the upside of a risky choice without touching the downside', () => {
    const c = career();
    const plain = calculateOutcomeWeights(outcomes, c, ctx);
    const risky = calculateOutcomeWeights(outcomes, c, ctx, 'risky');

    const goodPlain = plain.find((w) => w.outcome.id === 'good')?.weight ?? 0;
    const goodRisky = risky.find((w) => w.outcome.id === 'good')?.weight ?? 0;
    const badPlain = plain.find((w) => w.outcome.id === 'bad')?.weight ?? 0;
    const badRisky = risky.find((w) => w.outcome.id === 'bad')?.weight ?? 0;

    expect(goodRisky).toBeGreaterThan(goodPlain);
    expect(badRisky).toBe(badPlain);
  });

  it('leaves non-risky choices exactly as the data declares them', () => {
    const c = career();
    for (const risk of ['safe', 'balanced', 'opportunity'] as const) {
      const weighted = calculateOutcomeWeights(outcomes, c, ctx, risk);
      expect(weighted.find((w) => w.outcome.id === 'good')?.weight).toBe(50);
    }
  });

  it('reads every modifier attribute it advertises', () => {
    const c = career({ ability: 61, coachTrust: 62, roleValue: 63 });
    expect(readAttribute(c, 'ability')).toBe(61);
    expect(readAttribute(c, 'coachTrust')).toBe(62);
    expect(readAttribute(c, 'roleValue')).toBe(63);
    expect(readAttribute(c, 'potential')).toBe(c.hidden.potential);
    expect(readAttribute(c, 'age')).toBe(c.age);
  });
});

describe('event data integrity', () => {
  it('has a healthy pool of events', () => {
    expect(EVENT_POOL.length).toBeGreaterThanOrEqual(30);
  });

  it('uses unique ids', () => {
    const ids = EVENT_POOL.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every event at least two real choices with at least one outcome', () => {
    for (const event of EVENT_POOL) {
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2);
      for (const choice of event.choices) {
        expect(choice.outcomes.length, `${event.id}/${choice.id}`).toBeGreaterThanOrEqual(1);
        for (const outcome of choice.outcomes) {
          expect(outcome.baseWeight, `${event.id}/${choice.id}/${outcome.id}`).toBeGreaterThan(0);
          expect(outcome.text.length, `${event.id}/${choice.id}/${outcome.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('uses unique outcome ids inside a choice', () => {
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const ids = choice.outcomes.map((o) => o.id);
        expect(new Set(ids).size, `${event.id}/${choice.id}`).toBe(ids.length);
      }
    }
  });

  it('never offers a striker storyline to a goalkeeper', () => {
    const keeper = career({ position: 'GK', academyStage: 'youth_b', age: 15 });
    for (const slot of ['early', 'mid', 'late'] as const) {
      for (const event of EVENT_POOL) {
        if (!isEventEligible(event, keeper, slot)) continue;
        expect(event.conditions.notPositions ?? [], event.id).not.toContain('GK');
      }
    }
  });
});

describe('event eligibility and repetition', () => {
  it('only offers academy events to academy players', () => {
    const child = career({ academyStage: 'pre_b', age: 9 });
    const eligible = EVENT_POOL.filter((e) => isEventEligible(e, child, 'early'));
    expect(eligible.length).toBeGreaterThan(0);
    for (const event of eligible) {
      expect(event.conditions.bands ?? ['children'], event.id).toContain('children');
    }
  });

  it('respects oncePerCareer', () => {
    const event = EVENT_POOL.find((e) => e.oncePerCareer);
    expect(event).toBeDefined();
    if (!event) return;

    const before = career({ academyStage: 'youth_b', age: 15, ability: 60, currentSeason: 2040 });
    const after = career({
      ...before,
      currentSeason: 2050,
      eventsHistory: [
        {
          eventId: event.id,
          eventTitle: event.title,
          category: event.category,
          season: 2040,
          age: 15,
          stage: 'youth_b',
          choiceId: 'x',
          choiceLabel: 'x',
          outcomeId: 'x',
          outcomeText: 'x',
          tone: 'neutral',
          deltas: [],
        },
      ],
    });
    expect(isEventEligible(event, after, 'early')).toBe(false);
  });

  it('respects the cooldown window', () => {
    // Start from an event that really is eligible for this player, so the only thing the
    // assertions can be measuring is the cooldown itself.
    const base = career({ academyStage: 'youth_b', age: 15, ability: 60, currentSeason: 2044 });
    const event = EVENT_POOL.find(
      (e) => !e.oncePerCareer && !e.oncePerStage && isEventEligible(e, base, 'early'),
    );
    expect(event).toBeDefined();
    if (!event) return;

    const cooldown = event.cooldownSeasons ?? EVENTS.defaultCooldownSeasons;
    const seenIn = (season: number): Career['eventsHistory'] => [
      {
        eventId: event.id,
        eventTitle: event.title,
        category: event.category,
        season,
        age: 15,
        stage: 'youth_b',
        choiceId: 'x',
        choiceLabel: 'x',
        outcomeId: 'x',
        outcomeText: 'x',
        tone: 'neutral',
        deltas: [],
      },
    ];

    const tooSoon = { ...base, eventsHistory: seenIn(base.currentSeason) };
    const longEnough = { ...base, eventsHistory: seenIn(base.currentSeason - cooldown) };

    expect(isEventEligible(event, tooSoon, 'early')).toBe(false);
    expect(isEventEligible(event, longEnough, 'early')).toBe(true);
  });

  it('penalises repeating a category inside the same season', () => {
    const event = EVENT_POOL[0];
    if (!event) return;
    const c = career();
    const fresh = selectionWeight(event, c, [], []);
    const repeated = selectionWeight(event, c, [event.category], []);
    expect(repeated).toBeLessThan(fresh);
  });

  it('blocks a category outright when asked to', () => {
    const event = EVENT_POOL[0];
    if (!event) return;
    expect(selectionWeight(event, career(), [], [event.category])).toBe(0);
  });

  it('throttles rare events far below common ones', () => {
    const rare = EVENT_POOL.find((e) => e.rarity === 'rare');
    const common = EVENT_POOL.find((e) => (e.rarity ?? 'common') === 'common');
    expect(rare).toBeDefined();
    expect(common).toBeDefined();
    if (!rare || !common) return;
    const c = career();
    const rareWeight = selectionWeight(rare, c, [], []) / rare.weight;
    const commonWeight = selectionWeight(common, c, [], []) / common.weight;
    expect(rareWeight).toBeLessThan(commonWeight);
  });
});

describe('resolving a choice', () => {
  it('applies exactly one outcome and records the story', () => {
    const c = career({
      academyStage: 'youth_b',
      age: 15,
      ability: 55,
      pendingEventIds: ['kids_work_harder'],
      seasonSlot: 'early',
    });
    const event = EVENTS_BY_ID.kids_work_harder;
    expect(event).toBeDefined();
    if (!event) return;

    const choice = event.choices[0];
    if (!choice) return;
    const { career: after, result } = resolveEventChoice(
      c,
      event.id,
      choice.id,
      createRng(4242),
      'early',
    );

    expect(result.eventId).toBe(event.id);
    expect(result.choiceId).toBe(choice.id);
    expect(choice.outcomes.map((o) => o.id)).toContain(result.outcomeId);
    expect(result.outcomeText.length).toBeGreaterThan(0);
    expect(after.eventsHistory).toHaveLength(1);
    expect(after.pendingEventIds).not.toContain(event.id);
  });

  it('gives two different careers different stories from the same choice', () => {
    const c = career({ academyStage: 'youth_b', age: 15, ability: 55 });
    const event = EVENTS_BY_ID.kids_work_harder;
    const choice = event?.choices[0];
    if (!event || !choice) return;

    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const { result } = resolveEventChoice(c, event.id, choice.id, createRng(i + 1), 'early');
      seen.add(result.outcomeId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('builds the condition context from the right half of the season', () => {
    const c = career({
      firstHalfStats: {
        appearances: 7,
        starts: 5,
        goals: 1,
        assists: 2,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 60,
        injuredGames: 0,
      },
    });
    expect(conditionContext(c, 'mid').appearances).toBe(7);
    expect(conditionContext(c, 'early').appearances).toBe(0);
  });
});

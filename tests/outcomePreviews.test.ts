/**
 * v0.4.6 Phases 11-15: the player is told what could actually happen.
 *
 * Before this, an outcome with no entry in a shared label table fell through to its valence, so a
 * decision read "תוצאה טובה 30% / תוצאה רעה 30% / בלי דרמה 40%". Showing odds is only worth
 * anything if the odds are *on something specific* — otherwise it is a coin flip with extra
 * decimal places.
 *
 * Coverage is measured against what players actually see rather than against the catalogue,
 * because half the catalogue is rare or narrow and writing previews in id order would move the
 * catalogue number while barely changing what anyone reads.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL, EVENTS_BY_ID } from '../src/data/events';
import { calculateOutcomeDistribution } from '../src/game/decisionEngine';
import { POSITION_LIST } from '../src/game/balance';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { GameEvent, Position } from '../src/types';

/** Outcomes belonging to a choice the player actually gambles on. */
function gambledOutcomes(event: GameEvent): { total: number; concrete: number } {
  let total = 0;
  let concrete = 0;
  for (const choice of event.choices) {
    if (choice.outcomes.length <= 1) continue;
    for (const outcome of choice.outcomes) {
      total += 1;
      /*
       * Strictly a *written* preview. A shared label like 'הצלחה גדולה' is better than a bare
       * valence and still not specific - it tells the player the result was good, which the
       * colour already told him - so counting it here would flatter the number.
       */
      if (outcome.preview) concrete += 1;
    }
  }
  return { total, concrete };
}

describe('outcome previews say something', () => {
  it('covers the large majority of what players actually see', () => {
    /*
     * Weighted by firing frequency, and counting only written previews. Measured at 0% before
     * this version's content pass and 88.0% after; the floor is set below that so ordinary
     * content edits do not fail the build, but a regression to valence labels would.
     */
    const fires = new Map<string, number>();
    for (let seed = 1; seed <= 150; seed += 1) {
      const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
      const career = simulateCareer({ playerName: 'כ', position, seed, policy: balancedPolicy });
      for (const entry of career.eventsHistory) {
        fires.set(entry.eventId, (fires.get(entry.eventId) ?? 0) + 1);
      }
    }

    let total = 0;
    let concrete = 0;
    for (const [id, count] of fires) {
      const event = EVENTS_BY_ID[id];
      if (!event) continue;
      const counts = gambledOutcomes(event);
      total += counts.total * count;
      concrete += counts.concrete * count;
    }

    expect(total).toBeGreaterThan(1000);
    expect(concrete / total).toBeGreaterThan(0.75);
  });

  it('has raised catalogue coverage well clear of where it started', () => {
    let total = 0;
    let concrete = 0;
    for (const event of EVENT_POOL) {
      const counts = gambledOutcomes(event);
      total += counts.total;
      concrete += counts.concrete;
    }
    // 0% written previews before the pass; 54.6% after.
    expect(concrete / total).toBeGreaterThan(0.45);
  });

  it('never writes a preview in the past tense of the resolution', () => {
    /*
     * The preview is a possibility and the text is what happened. They must not be the same
     * string - a preview that is the resolution spoils the roll and reads as though it already
     * occurred.
     */
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (!outcome.preview) continue;
          expect(outcome.preview, `${event.id}/${outcome.id}`).not.toBe(outcome.text);
        }
      }
    }
  });

  it('keeps previews short enough to read on a phone', () => {
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (!outcome.preview) continue;
          expect(outcome.preview.length, `${event.id}/${outcome.id}`).toBeLessThan(80);
          expect(outcome.preview.trim().length, `${event.id}/${outcome.id}`).toBeGreaterThan(5);
        }
      }
    }
  });
});

describe('the preview and the resolver describe the same thing', () => {
  /*
   * The v0.4.1 invariant, extended (Phase 13). It was already true that the displayed
   * probabilities are the resolver's probabilities, because both read one distribution. What is
   * added here is that the *object* is the same one: the label a player was shown for an outcome
   * must belong to the outcome that can actually be drawn.
   */
  const career = simulateCareer({ playerName: 'ב', position: 'CM', seed: 31, policy: balancedPolicy });

  it('offers only outcome ids the choice actually contains', () => {
    for (const event of EVENT_POOL.slice(0, 60)) {
      for (const choice of event.choices) {
        const distribution = calculateOutcomeDistribution(career, event, choice, 'early');
        const ids = choice.outcomes.map((o) => o.id);
        for (const view of distribution.outcomes) {
          expect(ids, `${event.id}/${choice.id}`).toContain(view.id);
        }
      }
    }
  });

  it('labels each shown outcome with that outcome’s own preview', () => {
    for (const event of EVENT_POOL.slice(0, 60)) {
      for (const choice of event.choices) {
        const distribution = calculateOutcomeDistribution(career, event, choice, 'early');
        for (const view of distribution.outcomes) {
          const outcome = choice.outcomes.find((o) => o.id === view.id);
          if (outcome?.preview) expect(view.label).toBe(outcome.preview);
        }
      }
    }
  });

  it('shows percentages that sum to exactly 100', () => {
    for (const event of EVENT_POOL.slice(0, 80)) {
      for (const choice of event.choices) {
        const distribution = calculateOutcomeDistribution(career, event, choice, 'early');
        if (distribution.outcomes.length === 0) continue;
        const sum = distribution.outcomes.reduce((s, o) => s + o.percent, 0);
        expect(sum, `${event.id}/${choice.id}`).toBe(100);
      }
    }
  });

  it('has no duplicate outcome ids inside a choice', () => {
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const ids = choice.outcomes.map((o) => o.id);
        expect(new Set(ids).size, `${event.id}/${choice.id}`).toBe(ids.length);
      }
    }
  });

  it('never offers a choice with no possible outcome', () => {
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        expect(choice.outcomes.length, `${event.id}/${choice.id}`).toBeGreaterThan(0);
        const totalWeight = choice.outcomes.reduce((s, o) => s + o.baseWeight, 0);
        expect(totalWeight, `${event.id}/${choice.id}`).toBeGreaterThan(0);
      }
    }
  });
});

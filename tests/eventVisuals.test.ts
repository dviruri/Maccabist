/**
 * v0.4.5.1 Phase 14: every event gets a coherent presentation.
 *
 * The variant system is what keeps 128 events feeling like one game rather than 128 cards. That
 * only holds if every event actually resolves to a variant, with a label and an icon - a single
 * event falling through to an undefined variant is a card with a blank header strip, and it will
 * be found by a player rather than by a developer.
 *
 * This is an audit rather than a unit test: it walks the real event catalogue.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { createCareer } from '../src/game/careerEngine';
import { eventVisual, VARIANTS } from '../src/ui/eventVisuals';

/*
 * eventVisual reads the career for context (a Maccabi event looks different to a player who is
 * there and one who left), so the audit runs against a plain senior career. What is being checked
 * is coverage: no event may fall through to a blank header, whoever is looking at it.
 */
const EVENTS = EVENT_POOL;
const career = { ...createCareer({ playerName: 'ב', position: 'CM', seed: 5 }), academyStage: 'senior' as const };

describe('event visual coverage', () => {
  it('has a catalogue worth auditing', () => {
    expect(EVENTS.length).toBeGreaterThan(100);
  });

  it('resolves every event to a known variant', () => {
    const bad = EVENTS.filter((event) => !VARIANTS.includes(eventVisual(event, career).variant));
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it('gives every event a non-empty icon and label', () => {
    const bad = EVENTS.filter((event) => {
      const visual = eventVisual(event, career);
      return !visual.icon || !visual.label;
    });
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it('gives every event a known importance', () => {
    const bad = EVENTS.filter(
      (event) => !['normal', 'important', 'major'].includes(eventVisual(event, career).importance),
    );
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it('is a derivation, so an event always looks the same', () => {
    for (const event of EVENTS.slice(0, 40)) {
      const first = eventVisual(event, career);
      expect(eventVisual(event, career)).toEqual(first);
    }
  });

  it('does not park most of the catalogue in one variant', () => {
    /*
     * A variant system where 80% of events are 'career' is a variant system in name only. This is
     * the check that the mapping is doing work rather than defaulting.
     */
    const counts = new Map<string, number>();
    for (const event of EVENTS) {
      const v = eventVisual(event, career).variant;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const biggest = Math.max(...counts.values());
    expect(biggest / EVENTS.length).toBeLessThan(0.5);
    // And the system should not have variants that nothing ever uses.
    expect(counts.size).toBeGreaterThanOrEqual(6);
  });
});

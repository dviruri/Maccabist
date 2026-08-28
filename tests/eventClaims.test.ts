/**
 * v0.4.6 Phases 30-31: an event may not claim something the world need not support.
 *
 * Every bug that motivated this version was the same bug in different clothes — text asserting a
 * football situation that no condition required to be true. A derby with no rivalry. A title
 * run-in for a club heading for eleventh.
 *
 * Fixing the six that existed would have left the seventh to be found in playtesting, so the
 * rule is enforced over the whole catalogue instead. These tests fail the build for a new event
 * that says דרבי without requiring one.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { rivalryBetween, RIVALRIES, rivalsOf } from '../src/data/rivalries';
import { stageConfig, STAGE_LADDER } from '../src/data/academy';
import { CLAIM_RULES, eventsWithUnsupportedClaims, unsupportedClaims } from '../src/game/eventClaims';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { EventConditions, GameEvent, SeasonSlot } from '../src/types';

const conditions = (e: GameEvent): EventConditions => e.conditions ?? {};

describe('no event claims more than its conditions require', () => {
  it('has no unsupported claims anywhere in the catalogue', () => {
    const bad = eventsWithUnsupportedClaims(EVENT_POOL).map(
      (e) => `${e.id} (${unsupportedClaims(e).join(', ')})`,
    );
    expect(bad).toEqual([]);
  });

  it('still finds a claim when one is planted, so the rule is doing work', () => {
    /*
     * A green suite from a scanner that matches nothing is worthless. This is the canary: an
     * event that says דרבי and requires nothing must be caught.
     */
    const planted: GameEvent = {
      id: 'planted_derby',
      title: 'דרבי',
      description: 'דרבי גדול.',
      category: 'match_moment',
      weight: 1,
      choices: [],
    } as unknown as GameEvent;
    expect(unsupportedClaims(planted)).toContain('derby');
  });

  it('checks every rule against at least the events that use its words', () => {
    // A rule nothing mentions is a rule that has never been tested against real content.
    const derby = CLAIM_RULES.find((r) => r.id === 'derby');
    expect(derby).toBeDefined();
    expect(EVENT_POOL.filter((e) => derby?.mentions(e)).length).toBeGreaterThan(0);
  });
});

describe('derby events are tied to a real rivalry', () => {
  it('requires a derby wherever the word is used', () => {
    for (const event of EVENT_POOL) {
      if (!/דרבי/.test(`${event.kicker ?? ''} ${event.title} ${event.description ?? ''}`)) continue;
      expect(conditions(event).requiresDerby, event.id).toBe(true);
    }
  });

  it('models Maccabi Haifa a local derby, because the game leans on it', () => {
    const derby = rivalsOf('maccabi_haifa').find((r) => r.type === 'localDerby');
    expect(derby, 'Maccabi Haifa must have a modelled derby').toBeDefined();
    expect(derby?.clubs).toContain('hapoel_haifa');
  });

  it('does not call a non-local rivalry a derby', () => {
    /*
     * Maccabi Haifa against Maccabi Tel Aviv is the biggest fixture in the league and it is not a
     * derby - which is exactly the distinction the youth event used to get wrong.
     */
    const bigTwo = rivalryBetween('maccabi_haifa', 'maccabi_tel_aviv');
    expect(bigTwo?.type).toBe('majorRivalry');
    expect(bigTwo?.type).not.toBe('localDerby');
  });

  it('is symmetric, so a rivalry reads the same from either side', () => {
    for (const rivalry of RIVALRIES) {
      const [a, b] = rivalry.clubs;
      expect(rivalryBetween(a, b), `${a}/${b}`).toEqual(rivalryBetween(b, a));
    }
  });

  it('never lists a club as its own rival', () => {
    for (const rivalry of RIVALRIES) {
      expect(rivalry.clubs[0]).not.toBe(rivalry.clubs[1]);
    }
  });
});

describe('every event can actually be reached', () => {
  /*
   * The bug this catches cost an afternoon. The senior stage budgets one or two events, so the
   * three-slot branch of `planSeason` never ran there and the late slot was never allocated -
   * which made every senior event declaring `slots: ['late']` silently unreachable.
   * `spon_last_minute` had been in the catalogue, unreachable, since it was written, and the
   * v0.4.6 title events joined it: eligible in 131 of 481 senior preseasons, planned in none.
   *
   * An event that cannot fire is worse than a missing event, because nothing says so.
   */
  it('allocates every declared slot to some stage', () => {
    const declared = new Set<SeasonSlot>();
    for (const event of EVENT_POOL) for (const slot of event.slots ?? []) declared.add(slot);

    const allocated = new Set<SeasonSlot>();
    for (const stage of STAGE_LADDER) {
      const config = stageConfig(stage);
      for (let budget = config.minEvents; budget <= config.maxEvents; budget += 1) {
        for (const slot of possibleSlots(budget)) allocated.add(slot);
      }
    }
    for (const slot of declared) expect([...allocated], `slot "${slot}" is declared but never allocated`).toContain(slot);
  });

  it('can allocate a late slot to a senior season', () => {
    // The specific hole. Senior budgets are 1-2, so this only holds because a two-event season
    // can now place its second event late instead of mid.
    const config = stageConfig('senior');
    const slots = new Set<SeasonSlot>();
    for (let budget = config.minEvents; budget <= config.maxEvents; budget += 1) {
      for (const slot of possibleSlots(budget)) slots.add(slot);
    }
    expect([...slots]).toContain('late');
  });

  it('plans the late-slot senior events in real careers', () => {
    /*
     * The end-to-end version, because the slot arithmetic being right does not prove the events
     * get chosen. Every senior late-only event must appear somewhere in a population.
     */
    const lateOnly = EVENT_POOL.filter(
      (e) => e.slots?.length === 1 && e.slots[0] === 'late' && e.conditions?.bands?.includes('senior'),
    ).map((e) => e.id);
    expect(lateOnly.length).toBeGreaterThan(0);

    const seen = new Set<string>();
    for (let seed = 1; seed <= 400 && seen.size < lateOnly.length; seed += 1) {
      const career = simulateCareer({ playerName: 'ק', position: 'CM', seed, policy: balancedPolicy });
      for (const entry of career.eventsHistory) if (lateOnly.includes(entry.eventId)) seen.add(entry.eventId);
    }
    expect([...seen].sort(), 'senior late-slot events that never fired').toEqual(lateOnly.sort());
  });
});

/** Which slots `planSeason` can hand out for a given budget. Mirrors the allocation there. */
function possibleSlots(budget: number): SeasonSlot[] {
  if (budget <= 1) return ['early', 'mid'];
  if (budget === 2) return ['early', 'mid', 'late'];
  return ['early', 'mid', 'late'];
}

describe('deciders declare the race they decide', () => {
  it('never declares a title decider without a title race', () => {
    for (const event of EVENT_POOL) {
      const c = conditions(event);
      if (c.titleDecider !== true) continue;
      expect(c.titleRace, `${event.id} declares titleDecider`).toBe(true);
    }
  });

  it('never declares a promotion decider without a promotion race', () => {
    for (const event of EVENT_POOL) {
      const c = conditions(event);
      if (c.promotionDecider !== true) continue;
      expect(c.promotionRace, `${event.id} declares promotionDecider`).toBe(true);
    }
  });

  it('never declares a relegation six-pointer without a relegation battle', () => {
    for (const event of EVENT_POOL) {
      const c = conditions(event);
      if (c.relegationSixPointer !== true) continue;
      expect(c.relegationBattle, `${event.id} declares relegationSixPointer`).toBe(true);
    }
  });

  it('never asks for a promotion race in a top-flight-only event', () => {
    for (const event of EVENT_POOL) {
      const c = conditions(event);
      if (c.promotionRace !== true) continue;
      // A top division has nothing to be promoted to.
      expect(c.clubLeagueTier?.includes(1), `${event.id}`).not.toBe(true);
    }
  });

  it('pins season-defining events to the end of the season', () => {
    /*
     * A title-deciding penalty in September is not a thing. Anything gated on a title race being
     * live must be planned for the late slot, where the projection has already converged on the
     * band the club finishes in.
     */
    for (const event of EVENT_POOL) {
      const c = conditions(event);
      if (c.titleDecider !== true && c.promotionDecider !== true) continue;
      expect(event.slots, `${event.id}`).toEqual(['late']);
    }
  });
});

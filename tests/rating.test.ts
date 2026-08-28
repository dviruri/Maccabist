/**
 * v0.4.5.1 Phase 11: season performance can surprise you.
 *
 * `rng.gaussian` is the sum of three uniforms: it delivers roughly a *third* of its parameter as
 * standard deviation, and it is hard-capped at ±that parameter. So `ratingNoise: 7` produced an
 * actual sd of 2.33 with an absolute limit of ±6.9 — a season could never land more than seven
 * rating points away from what ability, form and confidence already predicted.
 *
 * There were no breakthrough seasons and no collapses. Only the state, plus a small wobble.
 */

import { describe, expect, it } from 'vitest';

import { SEASON } from '../src/game/balance';
import { createRng } from '../src/game/random';
import { simulateHalfStats } from '../src/game/seasonEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { createCareer } from '../src/game/careerEngine';
import type { Career, Position } from '../src/types';

const sd = (values: number[]): number => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
};

const senior = (over: Partial<Career> = {}): Career => ({
  ...createCareer({ playerName: 'ל', position: 'ST', seed: 4 }),
  academyStage: 'senior',
  currentClubId: 'maccabi_haifa',
  age: 25,
  ability: 72,
  coachTrust: 65,
  roleValue: 70,
  ...over,
});

describe('the two distributions differ in the way that matters', () => {
  it('gives gaussian a hard ceiling and normal a tail', () => {
    const g = createRng(11);
    const n = createRng(11);
    const gs: number[] = [];
    const ns: number[] = [];
    for (let i = 0; i < 60000; i += 1) {
      gs.push(g.gaussian(0, 7));
      ns.push(n.normal(0, 7));
    }

    // Bounded: cannot exceed its parameter, and delivers about a third of it as sd.
    expect(gs.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(7);
    expect(sd(gs)).toBeLessThan(3);

    // Real: sd is the parameter, and outliers exist.
    expect(sd(ns)).toBeGreaterThan(6.5);
    expect(ns.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeGreaterThan(20);
  });
});

describe('season ratings', () => {
  it('are deterministic for a given seed', () => {
    const career = senior();
    const a = simulateHalfStats(career, createRng(77), 20);
    const b = simulateHalfStats(career, createRng(77), 20);
    expect(b.stats.rating).toBe(a.stats.rating);
    expect(b.stats.goals).toBe(a.stats.goals);
    expect(b.stats.appearances).toBe(a.stats.appearances);
  });

  it('differ across seeds', () => {
    const career = senior();
    const ratings = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      ratings.add(simulateHalfStats(career, createRng(seed), 20).stats.rating);
    }
    expect(ratings.size).toBeGreaterThan(20);
  });

  it('can land far from what the player state predicts', () => {
    /*
     * The point of the change. Holding the career completely fixed, the spread of outcomes has to
     * be wide enough for a genuinely surprising season - good or bad - to be possible.
     */
    const career = senior();
    const ratings: number[] = [];
    for (let seed = 1; seed <= 4000; seed += 1) {
      ratings.push(simulateHalfStats(career, createRng(seed), 20).stats.rating);
    }
    const spread = sd(ratings);
    expect(spread).toBeGreaterThan(3);

    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const best = ratings.reduce((m, v) => Math.max(m, v), -Infinity);
    const worst = ratings.reduce((m, v) => Math.min(m, v), Infinity);
    // Under the bounded gaussian this gap could never exceed ~14 points in total.
    expect(best - mean).toBeGreaterThan(8);
    expect(mean - worst).toBeGreaterThan(8);
  });

  it('keeps the noise parameter honest', () => {
    // It feeds rng.normal now, so the number means what it says.
    expect(SEASON.ratingNoise).toBeGreaterThan(0);
    expect(SEASON.ratingNoise).toBeLessThan(6);
  });
});

describe('across whole careers', () => {
  it('keeps the rating distribution sane while widening the tails', () => {
    const ratings: number[] = [];
    for (const position of ['GK', 'CM', 'ST'] as Position[]) {
      for (let seed = 1; seed <= 200; seed += 1) {
        const career = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
        for (const s of career.seasonHistory) {
          if (s.academyStage === 'senior' && s.stats.appearances >= 4) ratings.push(s.stats.rating);
        }
      }
    }
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    // Baseline was mean 53.95 / sd 11.75; this should widen modestly, not explode.
    expect(mean).toBeGreaterThan(48);
    expect(mean).toBeLessThan(62);
    expect(sd(ratings)).toBeGreaterThan(10);
    expect(sd(ratings)).toBeLessThan(16);
    // Ratings are clamped 20-99 by the engine; the tails should approach but not break that.
    expect(ratings.reduce((m, v) => Math.min(m, v), Infinity)).toBeGreaterThanOrEqual(20);
    expect(ratings.reduce((m, v) => Math.max(m, v), 0)).toBeLessThanOrEqual(99);
  });
});

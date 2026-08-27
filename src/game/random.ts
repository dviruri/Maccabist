/**
 * Centralised randomness.
 *
 * Every random decision in the game goes through an Rng instance created from a numeric state,
 * so a career is fully reproducible: store `seed` + `rngState` and you can replay or resume it.
 * Never call Math.random() anywhere else in src/game.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** True with the given probability (0-1). */
  chance(probability: number): boolean;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick. Items with weight <= 0 are ignored. Returns null if nothing is eligible. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | null;
  /**
   * Bounded jitter around `mean` (sum of 3 uniforms). Hard-limited to +/- spread, with no tails.
   * Right for nudging a rating; wrong wherever a rare extreme has to be *possible*.
   */
  gaussian(mean: number, spread: number): number;
  /**
   * A real normal distribution with real tails (Box-Muller).
   *
   * Added in v0.4.1 because `gaussian` cannot produce an outlier at all: a club whose expected
   * finish was five rungs up literally could not be relegated, so "strong clubs occasionally
   * implode" was a comment describing something the maths forbade.
   */
  normal(mean: number, sd: number): number;
  /** Current internal state - persist this to resume the exact same stream. */
  getState(): number;
}

/** mulberry32 - small, fast, good enough for a game, and deterministic. */
export function createRng(state: number): Rng {
  let s = state >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('rng.pick called with an empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    weighted: <T,>(items: readonly T[], weightOf: (item: T) => number): T | null => {
      let total = 0;
      for (const item of items) {
        const w = weightOf(item);
        if (w > 0) total += w;
      }
      if (total <= 0) return null;
      let roll = next() * total;
      for (const item of items) {
        const w = weightOf(item);
        if (w <= 0) continue;
        roll -= w;
        if (roll <= 0) return item;
      }
      return items[items.length - 1] as T;
    },
    gaussian: (mean, spread) => {
      const sum = (next() + next() + next()) / 3; // 0..1, centred on 0.5
      return mean + (sum - 0.5) * 2 * spread;
    },
    normal: (mean, sd) => {
      // Box-Muller. `next()` can return 0, which would give -Infinity through the log.
      const u = Math.max(Number.EPSILON, next());
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    getState: () => s,
  };

  return rng;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Clamp helper used all over the engine. */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to a fixed number of decimals (avoids 0.30000000000000004 in saved data). */
export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

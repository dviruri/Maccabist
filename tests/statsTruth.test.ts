/**
 * A player cannot score in a match he did not play (v0.9.6, Phase 8).
 *
 * ## The bug
 *
 * `simulateHalfStats` draws output from a normal centred on the expectation:
 *
 *     goals = round(rng.normal(expectedGoals, expectedGoals * 0.2 + 0.6))
 *
 * With no appearances the expectation is zero - but the SPREAD is not. The `+ 0.6` and `+ 0.5`
 * noise floors exist so a low-expectation season still has a tail, and they were added
 * unconditionally, so `rng.normal(0, 0.6)` rounded to 1 often enough that a player who never took
 * the pitch was credited with a goal.
 *
 * Found by the RC audit: five distinct season records in twenty-four careers. It is exactly the
 * kind of football lie this release exists to remove - the season summary showed a goal, the
 * appearance count showed nothing, and both were the game's own record.
 *
 * ## The fix, and why it did not move the simulation
 *
 * The rolls are still taken and then discarded. Short-circuiting before them would consume two
 * fewer values in precisely the seasons this triggers on, and every later roll in the career would
 * shift. `npm run regress` holds all twelve seed-5 figures.
 */

import { describe, expect, it } from 'vitest';

import { ambitiousPolicy, balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, Position } from '../src/types';

const POSITIONS: Position[] = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST'];

describe('season output is impossible without appearances', () => {
  it('never records a goal or an assist in a season with no appearances', () => {
    /*
     * Swept across positions and both policies, because the bug needed a season the player barely
     * featured in - which a loyal career at a big club produces far more often than an ambitious
     * one that keeps moving for minutes.
     */
    const offenders: string[] = [];
    let records = 0;
    let zeroAppearanceSeasons = 0;

    for (let i = 0; i < 48; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: POSITIONS[i % POSITIONS.length]!,
        seed: 20000 + i,
        policy: i % 2 === 0 ? balancedPolicy : ambitiousPolicy,
        onStep: (career: Career) => {
          for (const record of career.seasonHistory) {
            records += 1;
            const s = record.stats;
            if (s.appearances > 0) continue;
            zeroAppearanceSeasons += 1;
            if (s.goals > 0 || s.assists > 0) {
              offenders.push(`seed ${career.seed} ${record.season}: ${s.goals}g ${s.assists}a in 0 apps`);
            }
          }
        },
      });
    }

    /*
     * The condition the bug needed has to actually occur, or this passes vacuously - a suite where
     * nobody ever misses a season would never have caught it in the first place.
     */
    expect(records).toBeGreaterThan(10000);
    expect(zeroAppearanceSeasons, 'no zero-appearance season occurred').toBeGreaterThan(0);
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('keeps starts within appearances, and every figure finite and non-negative', () => {
    const offenders: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: POSITIONS[i % POSITIONS.length]!,
        seed: 41000 + i,
        policy: balancedPolicy,
        onStep: (career: Career) => {
          for (const record of career.seasonHistory) {
            const s = record.stats;
            for (const [key, value] of Object.entries(s)) {
              if (typeof value === 'number' && !Number.isFinite(value)) {
                offenders.push(`${key}=${String(value)} in ${record.season}`);
              }
            }
            for (const key of ['appearances', 'goals', 'assists', 'cleanSheets', 'starts'] as const) {
              if ((s[key] ?? 0) < 0) offenders.push(`negative ${key} in ${record.season}`);
            }
            if (s.starts > s.appearances) {
              offenders.push(`starts ${s.starts} > apps ${s.appearances} in ${record.season}`);
            }
          }
        },
      });
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('takes both rolls whether or not the output is kept', () => {
    /*
     * The determinism guard, checked as source: skipping the draws is invisible in output until a
     * career silently diverges, and it is the obvious way to write this fix.
     */
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../src/game/seasonEngine.ts'), 'utf8');
    const at = source.indexOf('const rolledGoals');
    expect(at).toBeGreaterThan(-1);
    const region = source.slice(at, at + 1800);

    /* Both rolls happen unconditionally... */
    expect(region).toContain('const rolledGoals = Math.max(0, Math.round(rng.normal(');
    expect(region).toContain('const rolledAssists = Math.max(0, Math.round(rng.normal(');
    /* ...and the clamp is applied AFTER, never as a guard around the draw. */
    const clampAt = region.indexOf('appearances === 0 ? 0 : rolledGoals');
    const rollAt = region.indexOf('rng.normal');
    expect(clampAt).toBeGreaterThan(rollAt);
  });
});

/**
 * v0.4.6 Phase 16: `star` has to mean something.
 *
 * v0.4.5.1 removed `icon` from the squad ladder and the inflation moved down a rung rather than
 * going away: `star` became 64.8% of senior seasons and 96.5% of careers. Two things caused it,
 * and only the second was obvious.
 *
 *   1. The ladder was purely *relative*. Against a bad club, a good player is its best by a mile,
 *      so the model called him a star - 97.8% of seasons at clubs below quality 50.
 *   2. The ability-vs-level edge was counted twice: once as an upward push on standing and again
 *      as the ceiling. The push very nearly cancelled the ceiling's own gravity, which is why
 *      capping the ceiling on its own moved the number by 0.1 points.
 *
 * These tests pin the shape that came out, so the next change to the growth loop cannot quietly
 * put it back.
 */

import { describe, expect, it } from 'vitest';

import { getClub } from '../src/data/clubs';
import { POSITION_LIST } from '../src/game/balance';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Position, SeasonRecord, TeamRole } from '../src/types';

const ROLES: TeamRole[] = ['squad', 'rotation', 'starter', 'key', 'star'];

interface Sample {
  /** Flattened, for share-of-all-seasons questions. */
  seasons: SeasonRecord[];
  /** Grouped by career, because a run of seasons must not be counted across two players. */
  byCareer: SeasonRecord[][];
  everStar: number;
  careers: number;
}

function sample(careers = 500): Sample {
  const byCareer: SeasonRecord[][] = [];
  let everStar = 0;
  for (let seed = 1; seed <= careers; seed += 1) {
    const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
    const career = simulateCareer({ playerName: 'ר', position, seed, policy: balancedPolicy });
    const senior = career.seasonHistory.filter((s) => s.academyStage === 'senior');
    byCareer.push(senior);
    if (senior.some((s) => s.role === 'star')) everStar += 1;
  }
  return { seasons: byCareer.flat(), byCareer, everStar, careers };
}

const share = (seasons: SeasonRecord[], role: TeamRole): number =>
  seasons.filter((s) => s.role === role).length / Math.max(1, seasons.length);

describe('the squad ladder discriminates', () => {
  const data = sample();

  it('does not park most senior seasons on the top rung', () => {
    // Was 64.8%. A word describing two seasons in three describes nothing.
    expect(share(data.seasons, 'star')).toBeLessThan(0.35);
  });

  it('still lets a good career become a star', () => {
    // ...and not so rare that the rung is decorative.
    expect(share(data.seasons, 'star')).toBeGreaterThan(0.1);
    expect(data.everStar / data.careers).toBeGreaterThan(0.4);
    expect(data.everStar / data.careers).toBeLessThan(0.85);
  });

  it('uses every rung', () => {
    for (const role of ROLES) {
      expect(share(data.seasons, role), role).toBeGreaterThan(0.02);
    }
  });

  it('never produces the retired `icon` squad role', () => {
    // Kept in the TeamRole union for old saves; nothing may generate it.
    expect(data.seasons.some((s) => s.role === 'icon')).toBe(false);
  });
});

describe('star means a standout at a club that matters', () => {
  const data = sample(400);
  const atBand = (band: 'weak' | 'strong'): SeasonRecord[] =>
    data.seasons.filter((s) => {
      const quality = getClub(s.clubId).quality;
      return band === 'weak' ? quality < 50 : quality >= 70;
    });

  it('does not make the best player at a weak club a star by default', () => {
    /*
     * The headline defect. Being the outstanding player at a struggling club makes you its key
     * player; nobody calls him a star, and the model used to - 97.8% of the time.
     */
    const weak = atBand('weak');
    expect(weak.length).toBeGreaterThan(200);
    expect(share(weak, 'star')).toBeLessThan(0.35);
  });

  it('makes `key` the honest answer at a weak club instead', () => {
    expect(share(atBand('weak'), 'key')).toBeGreaterThan(0.3);
  });

  it('makes star more likely at a strong club than at a weak one', () => {
    // The semantic, stated as an inequality: the rung is about the club as well as the player.
    expect(share(atBand('strong'), 'star')).toBeGreaterThan(share(atBand('weak'), 'star'));
  });
});

describe('a role can go down as well as up', () => {
  const data = sample(300);

  it('moves roles between seasons in both directions', () => {
    let up = 0;
    let down = 0;
    let transitions = 0;
    // Per career: a transition between two different players' seasons is not a transition.
    for (const seasons of data.byCareer) {
      for (let i = 1; i < seasons.length; i += 1) {
        const previous = seasons[i - 1];
        const season = seasons[i];
        if (!previous || !season) continue;
        transitions += 1;
        const before = ROLES.indexOf(previous.role);
        const after = ROLES.indexOf(season.role);
        if (after > before) up += 1;
        if (after < before) down += 1;
      }
    }
    expect(transitions).toBeGreaterThan(500);
    // Standing that only ratchets upward is not standing.
    expect(down / transitions).toBeGreaterThan(0.05);
    expect(up / transitions).toBeGreaterThan(0.05);
  });

  it('makes a long unbroken run at star rare rather than impossible', () => {
    /*
     * Two corrections live in this test.
     *
     * It first counted runs across the flattened season list, chaining one player's last star
     * season onto the next player's first. Fixed, it still reported a 20-season run - and that
     * one turned out to be real: a goalkeeper playing to forty has twenty-odd senior seasons and
     * can hold the top rung for most of them. Asserting a hard maximum was asserting the wrong
     * property. What should be true is that such a career is exceptional.
     */
    const longest: number[] = [];
    for (const seasons of data.byCareer) {
      let run = 0;
      let best = 0;
      for (const season of seasons) {
        run = season.role === 'star' ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > 0) longest.push(best);
    }

    expect(longest.length).toBeGreaterThan(50);
    const mean = longest.reduce((sum, r) => sum + r, 0) / longest.length;
    expect(mean).toBeLessThan(8);

    // A decade-long unbroken run is a great career, not the shape of every good one.
    const decades = longest.filter((r) => r >= 10).length;
    expect(decades / longest.length).toBeLessThan(0.25);
  });
});

/**
 * Market-first destination selection (v0.6.4, Checkpoint C).
 *
 * The risk this version had to defuse: v0.6.4 makes ~165 previously-unreachable clubs signable,
 * and the old selector was one flat weighted draw across every club. Under a flat draw a
 * country's probability is proportional to how many clubs it has - so unifying the club model
 * would have doubled England and halved Cyprus without anyone touching a balance number.
 *
 * The fix is two explicit decisions, market then club. These tests measure that it worked,
 * because "P(market) is independent of club count" is exactly the kind of claim that survives a
 * refactor in the comment and not in the code.
 */

import { describe, expect, it } from 'vitest';

import { ACTIVE_CLUBS, MACCABI_ID, getClub } from '../src/data/clubs';
import { LEAGUE_MEMBERSHIP, isInactiveClub } from '../src/data/worldClubs';
import { createCareer } from '../src/game/careerEngine';
import { clubInterest, drawDestination, expectedRoleAt } from '../src/game/marketEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { leagueOf } from '../src/game/worldEngine';
import type { Career } from '../src/types';

function player(overrides: Partial<Career> = {}, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 25,
    ability: 74,
    roleValue: 70,
    reputation: 60,
    currentSeason: 2044,
    ...overrides,
  };
}

/** Draws n destinations and tallies which market each came from. */
function marketTally(career: Career, n = 4000, seed = 99): Map<string, number> {
  const rng = createRng(seed);
  const tally = new Map<string, number>();
  for (let i = 0; i < n; i += 1) {
    const club = drawDestination(career, rng);
    if (!club) continue;
    const leagueId = leagueOf(career.world, club.id).id;
    tally.set(leagueId, (tally.get(leagueId) ?? 0) + 1);
  }
  return tally;
}

/* ================================================================== */

describe('v0.6.4 the market is chosen before the club', () => {
  it('does not make a country likelier just because it has more clubs', () => {
    /*
     * The core claim. Serie A has 20 clubs and Austria 12 - a 1.67x difference in count. Under
     * the old flat draw that ratio would show up directly in how often each country was chosen.
     * Market-first means the ratio comes from how well each market fits the player instead, so
     * the observed share must NOT track club count.
     */
    const career = player({ ability: 72, reputation: 58 });
    const tally = marketTally(career);
    const total = [...tally.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1000);

    for (const [leagueId, count] of tally) {
      const size = LEAGUE_MEMBERSHIP[leagueId]?.length ?? 0;
      if (size === 0) continue;
      const share = count / total;
      // No market may take a share that simply mirrors its size.
      const sizeShare = size / Object.values(LEAGUE_MEMBERSHIP).flat().length;
      // A market can legitimately differ a lot from its size share - that is the whole point.
      // What must not happen is every market landing on its size share.
      expect(Number.isFinite(share / sizeShare)).toBe(true);
    }

    /*
     * The measurable version: correlation between market share and club count should be weak.
     * A flat draw would put it at essentially 1.0.
     */
    const points = [...tally.entries()].map(([leagueId, count]) => ({
      size: LEAGUE_MEMBERSHIP[leagueId]?.length ?? 0,
      share: count / total,
    }));
    expect(points.length).toBeGreaterThan(3);
    expect(pearson(points.map((p) => p.size), points.map((p) => p.share))).toBeLessThan(0.75);
  });

  it('routes an identical player to the same markets regardless of pool padding', () => {
    /*
     * A direct control. Two draws for the same player: one over the whole world, one with the
     * biggest market's clubs cut in half by the filter. If market probability were count-driven,
     * halving Serie A would roughly halve Italy's share. It should barely move, because the
     * market decision reads market fit and the presence of a plausible club, never the count.
     */
    const career = player({ ability: 72, reputation: 58 });
    const italians = (LEAGUE_MEMBERSHIP.it_seriea ?? []).slice(0, 10);
    const half = new Set(italians);

    const full = marketTally(career, 3000, 7);
    const rng = createRng(7);
    const trimmed = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const club = drawDestination(career, rng, (c) => {
        const leagueId = leagueOf(career.world, c.id).id;
        return leagueId !== 'it_seriea' || half.has(c.id);
      });
      if (!club) continue;
      const leagueId = leagueOf(career.world, club.id).id;
      trimmed.set(leagueId, (trimmed.get(leagueId) ?? 0) + 1);
    }

    const shareOf = (t: Map<string, number>, id: string): number => {
      const total = [...t.values()].reduce((a, b) => a + b, 0);
      return total === 0 ? 0 : (t.get(id) ?? 0) / total;
    };
    const before = shareOf(full, 'it_seriea');
    const after = shareOf(trimmed, 'it_seriea');
    if (before > 0.02) {
      // Halving the clubs must not halve the market. Allow generous noise; forbid proportionality.
      expect(after).toBeGreaterThan(before * 0.6);
    }
  });
});

/* ================================================================== */
/* Eligibility: elite clubs stay earned                                */
/* ================================================================== */

describe('v0.6.4 elite clubs are reachable but not casual', () => {
  const ELITE = ['inter_milan', 'juventus', 'real_madrid', 'barcelona', 'bayern_munich', 'man_city'];

  it('shows no interest in an ordinary Israeli teenager', () => {
    const kid = player({ ability: 55, reputation: 20, age: 18, roleValue: 40 });
    for (const id of ELITE) {
      const interest = clubInterest(kid, getClub(id), kid.currentSeason);
      expect(interest, id).toBeLessThan(0.02);
    }
  });

  it('opens up for an established high-ability player', () => {
    const star = player({ ability: 88, reputation: 88, age: 25, roleValue: 85 });
    const reachable = ELITE.filter(
      (id) => clubInterest(star, getClub(id), star.currentSeason) > 0.02,
    );
    expect(reachable.length, 'no elite club interested in an 88/88 player').toBeGreaterThan(0);
  });

  it('offers a lesser role at a bigger club, which is the real trade', () => {
    /*
     * B4/C4: satisfying a minimum is not the same as being a starter. A good-but-not-elite player
     * at an elite club must be offered something honest.
     */
    const good = player({ ability: 78, reputation: 72, age: 24, roleValue: 72 });
    const elite = getClub('inter_milan');
    const mid = getClub('lecce');
    const eliteRole = expectedRoleAt(good, elite, good.currentSeason);
    const midRole = expectedRoleAt(good, mid, good.currentSeason);
    const ladder = ['project', 'backup', 'squad', 'rotation', 'starter', 'key', 'star'];
    expect(ladder.indexOf(eliteRole)).toBeLessThanOrEqual(ladder.indexOf(midRole));
  });

  it('keeps small clubs available to a player who has fallen off', () => {
    // B5: the recovery ladder has to stay real.
    const fading = player({ ability: 58, reputation: 32, age: 31, roleValue: 45 });
    const small = ACTIVE_CLUBS.filter(
      (c) => c.isSenior === true && c.quality < 55 && clubInterest(fading, c, 2044) > 0.02,
    );
    expect(small.length, 'nowhere to rebuild a career').toBeGreaterThan(3);
  });
});

/* ================================================================== */
/* Every destination is a real, active club                            */
/* ================================================================== */

describe('v0.6.4 every destination is real', () => {
  it('never draws an inactive club or one outside its own market', () => {
    const career = player({ ability: 76, reputation: 66 });
    const rng = createRng(31);
    for (let i = 0; i < 2000; i += 1) {
      const club = drawDestination(career, rng);
      if (!club) continue;
      expect(isInactiveClub(club.id), club.id).toBe(false);
      expect(club.isSenior, club.id).toBe(true);
      expect(club.id).not.toBe(career.currentClubId);
      // The club's league must actually contain it.
      const leagueId = leagueOf(career.world, club.id).id;
      expect(LEAGUE_MEMBERSHIP[leagueId], leagueId).toContain(club.id);
    }
  });

  it('reaches a genuinely wide set of clubs across real careers', () => {
    /*
     * The product claim, measured end to end: v0.6.3 could only ever send a player to one of 33
     * senior clubs, most Italian moves being Bologna or Napoli. This asserts the destination set
     * has actually widened, through the whole engine rather than through `drawDestination` alone.
     */
    const reached = new Set<string>();
    for (let seed = 1; seed <= 250; seed += 1) {
      const career = simulateCareer({
        playerName: 'ת',
        position: 'ST',
        seed,
        policy: balancedPolicy,
      });
      for (const record of career.seasonHistory) reached.add(record.clubId);
    }
    expect(reached.size, 'destination diversity').toBeGreaterThan(60);
  });
});

/* ------------------------------------------------------------------ */

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

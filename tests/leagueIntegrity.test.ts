/**
 * League-size truth under world movement (v0.6.5.1, Checkpoint B).
 *
 * The bug this suite was written to expose, before it was fixed:
 *
 *   `applyPromotionRelegation` mutated ONE club's league in isolation -
 *   `clubLeagues[promoted] = 'il_leumit'` - with nothing balancing the destination. Promote a
 *   Liga Alef club and Liga Leumit holds 17. `buildTable` then rendered `shape.size` rows and
 *   the 17th club silently vanished from the division it had just been promoted into.
 *
 * That is exactly the class of failure v0.4.8 exists to forbid: two systems disagreeing, with
 * the disagreement swallowed rather than raised. The fix is an atomic transition plus a hard
 * invariant, and these tests hold both.
 */

import { describe, expect, it } from 'vitest';

import { CLUBS } from '../src/data/clubs';
import { LEAGUE_SHAPES } from '../src/data/leagueShape';
import { LEAGUE_MEMBERSHIP, snapshotLeagueOf } from '../src/data/worldClubs';
import { buildTable, projectSeason } from '../src/game/leagueEngine';
import { createRng } from '../src/game/random';
import { applySeasonMovements, emptyWorld, leagueMembership, leagueOf } from '../src/game/worldEngine';
import type { WorldState } from '../src/types';

const ISRAELI_LEAGUES = ['il_premier', 'il_leumit', 'il_alef_north', 'il_alef_south'] as const;

/** Every active league must hold exactly its declared size. The hard invariant (B3). */
function assertAllSizes(world: WorldState, label: string): void {
  for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
    const members = leagueMembership(world, leagueId);
    expect(members.length, `${label}: ${leagueId} holds ${members.length}, expected ${shape.size}`).toBe(
      shape.size,
    );
    expect(new Set(members).size, `${label}: ${leagueId} has duplicates`).toBe(members.length);
  }
  // And no club may sit in two active leagues at once.
  const seen = new Map<string, string>();
  for (const leagueId of Object.keys(LEAGUE_SHAPES)) {
    for (const id of leagueMembership(world, leagueId)) {
      expect(seen.has(id), `${label}: ${id} in ${seen.get(id)} and ${leagueId}`).toBe(false);
      seen.set(id, leagueId);
    }
  }
}

describe('v0.6.5.1 league sizes survive every season transition', () => {
  it('starts from a world whose every division is exactly its declared size', () => {
    assertAllSizes(emptyWorld(), 'initial');
  });

  it('keeps Leumit at sixteen when an Alef club is promoted', () => {
    /*
     * THE REPRODUCED BUG. Before the fix this produced a 17-club Liga Leumit, and buildTable
     * quietly showed sixteen of them.
     */
    const world = applySeasonMovements(emptyWorld(), 2044, [
      { clubId: 'hapoel_nof_hagalil', fromLeague: 'il_alef_north', toLeague: 'il_leumit', reason: 'promoted' },
    ]);
    expect(leagueOf(world, 'hapoel_nof_hagalil').id).toBe('il_leumit');
    assertAllSizes(world, 'after promotion');
  });

  it('keeps every division intact when a Leumit club is relegated', () => {
    const world = applySeasonMovements(emptyWorld(), 2044, [
      { clubId: 'hapoel_acre', fromLeague: 'il_leumit', toLeague: 'il_alef', reason: 'relegated' },
    ]);
    // District resolution still applies inside the transition.
    expect(leagueOf(world, 'hapoel_acre').id).toBe('il_alef_north');
    assertAllSizes(world, 'after relegation');
  });

  it('balances a promotion and a relegation as one transition', () => {
    const world = applySeasonMovements(emptyWorld(), 2044, [
      { clubId: 'maccabi_kiryat_gat', fromLeague: 'il_leumit', toLeague: 'il_premier', reason: 'promoted' },
      { clubId: 'ironi_tiberias', fromLeague: 'il_premier', toLeague: 'il_leumit', reason: 'relegated' },
    ]);
    expect(leagueOf(world, 'maccabi_kiryat_gat').id).toBe('il_premier');
    expect(leagueOf(world, 'ironi_tiberias').id).toBe('il_leumit');
    assertAllSizes(world, 'after swap');
  });
});

describe('v0.6.5.1 buildTable cannot hide corruption (B4)', () => {
  it('renders exactly the declared number of rows for every league', () => {
    const world = emptyWorld();
    for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
      const anchor = LEAGUE_MEMBERSHIP[leagueId]![0]!;
      const projection = projectSeason(world, anchor, 2044, null, null, createRng(7))!;
      const table = buildTable(world, projection, 'mid');
      expect(table.rows.length, leagueId).toBe(shape.size);
      expect(new Set(table.rows.map((r) => r.clubId)).size, `${leagueId} duplicate rows`).toBe(
        shape.size,
      );
    }
  });

  it('refuses to silently truncate a corrupted membership (Scenario G)', () => {
    /*
     * Artificially corrupt the world: move a club INTO Leumit without anything leaving. The old
     * code sliced the extra club away and rendered a clean-looking sixteen-row table. The
     * invariant must surface it instead.
     */
    const corrupt: WorldState = {
      ...emptyWorld(),
      clubLeagues: { ...emptyWorld().clubLeagues, ms_tira: 'il_leumit' },
    };
    expect(leagueMembership(corrupt, 'il_leumit').length).toBe(17);
    const projection = projectSeason(corrupt, 'hapoel_kfar_saba', 2044, null, null, createRng(3))!;
    expect(() => buildTable(corrupt, projection, 'mid')).toThrow(/membership/i);
  });
});

describe('v0.6.5.1 fifty consecutive season transitions stay coherent (B7)', () => {
  it('never corrupts a league across a long world history', () => {
    /*
     * The multi-season proof. Each season promotes the top club of each feeder division and
     * relegates the bottom club of each division above, exactly as the engine does, then checks
     * every size, every duplicate and every double-membership.
     */
    let world = emptyWorld();
    const rng = createRng(2044);
    for (let season = 2044; season < 2094; season += 1) {
      const pick = (leagueId: string, fromEnd: boolean): string => {
        const members = leagueMembership(world, leagueId);
        const index = fromEnd ? members.length - 1 - (rng.next() < 0.5 ? 0 : 1) : 0;
        return members[Math.max(0, Math.min(members.length - 1, index))]!;
      };
      world = applySeasonMovements(world, season, [
        { clubId: pick('il_leumit', false), fromLeague: 'il_leumit', toLeague: 'il_premier', reason: 'promoted' },
        { clubId: pick('il_premier', true), fromLeague: 'il_premier', toLeague: 'il_leumit', reason: 'relegated' },
        { clubId: pick('il_alef_north', false), fromLeague: 'il_alef_north', toLeague: 'il_leumit', reason: 'promoted' },
        { clubId: pick('il_leumit', true), fromLeague: 'il_leumit', toLeague: 'il_alef', reason: 'relegated' },
      ]);
      assertAllSizes(world, `season ${season}`);
    }
  });
});

describe('v0.6.5.1 movement respects district geography (B6)', () => {
  it('sends relegated clubs to the district their geography says', () => {
    for (const [clubId, expected] of [
      ['hapoel_acre', 'il_alef_north'],
      ['maccabi_ahi_nazareth', 'il_alef_north'],
      ['hapoel_raanana', 'il_alef_south'],
      ['bnei_yehuda', 'il_alef_south'],
    ] as const) {
      const world = applySeasonMovements(emptyWorld(), 2044, [
        { clubId, fromLeague: 'il_leumit', toLeague: 'il_alef', reason: 'relegated' },
      ]);
      expect(leagueOf(world, clubId).id, clubId).toBe(expected);
    }
  });
});

describe('v0.6.5.1 the corrected Liga Alef snapshot', () => {
  it('has eighteen clubs in each district', () => {
    expect(LEAGUE_MEMBERSHIP.il_alef_north?.length).toBe(18);
    expect(LEAGUE_MEMBERSHIP.il_alef_south?.length).toBe(18);
  });

  it('includes the five clubs promoted from Liga Bet', () => {
    for (const id of ['beitar_nahariya', 'hapoel_bnei_jatt']) {
      expect(snapshotLeagueOf(id), id).toBe('il_alef_north');
    }
    for (const id of ['hapoel_mahane_yehuda', 'ironi_beit_shemesh', 'mk_sderot']) {
      expect(snapshotLeagueOf(id), id).toBe('il_alef_south');
    }
  });

  it('drops the club relegated out of Alef, keeping its identity', () => {
    expect(snapshotLeagueOf('beitar_yavne')).toBeNull();
    expect(CLUBS['beitar_yavne'], 'identity deleted rather than deactivated').toBeDefined();
  });

  it('gives every Alef club a schedule sized for an 18-club division', () => {
    for (const leagueId of ['il_alef_north', 'il_alef_south'] as const) {
      for (const id of LEAGUE_MEMBERSHIP[leagueId]!) {
        // 17 opponents home and away = 34 league fixtures, before any cup.
        expect(CLUBS[id]!.seasonGames, id).toBeGreaterThanOrEqual(34);
      }
    }
  });

  it('keeps the whole Israeli pyramid at 66 active clubs', () => {
    const total = ISRAELI_LEAGUES.reduce((sum, id) => sum + LEAGUE_MEMBERSHIP[id]!.length, 0);
    expect(total).toBe(66);
  });
});

/**
 * v0.4.6: the live league table.
 *
 * The whole system exists to make one thing true by construction: **the table can never
 * contradict the season narrative.** A club in a title race in April does not finish eleventh,
 * because the position it is shown in April is drawn from the band its final outcome describes.
 *
 * These tests are the guard on that, plus the phase-progression and determinism properties the
 * table needs in order to survive a save.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { getLeague } from '../src/data/leagues';
import { leagueShape } from '../src/data/leagueShape';
import {
  buildTable,
  leagueContextFrom,
  matchesPlayed,
  outcomeForPosition,
  positionsForOutcome,
  projectSeason,
  settleProjection,
} from '../src/game/leagueEngine';
import { createCareer } from '../src/game/careerEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { emptyWorld } from '../src/game/worldEngine';
import type { Career, SeasonPhase, SeasonProjection, SeasonRecord, WorldState } from '../src/types';

const PHASES: SeasonPhase[] = ['early', 'mid', 'late', 'end'];

function project(clubId: string, seed: number, world: WorldState = emptyWorld()): SeasonProjection {
  const p = projectSeason(world, clubId, 2040, null, null, createRng(seed));
  if (!p) throw new Error(`no projection for ${clubId}`);
  return p;
}

/* ------------------------------------------------------------------ */

describe('position and outcome are the same fact', () => {
  it('maps every position in a division to an outcome', () => {
    const shape = leagueShape('il_premier');
    if (!shape) throw new Error('no shape');
    for (let p = 1; p <= shape.size; p += 1) {
      expect(outcomeForPosition('il_premier', p, shape), `position ${p}`).toBeTruthy();
    }
  });

  it('gives first place the title and last place relegation', () => {
    const shape = leagueShape('il_premier');
    if (!shape) throw new Error('no shape');
    expect(outcomeForPosition('il_premier', 1, shape)).toBe('champion');
    expect(outcomeForPosition('il_premier', shape.size, shape)).toBe('relegated');
  });

  it('gives a second division promotion at the top and no European places', () => {
    const shape = leagueShape('il_leumit');
    if (!shape) throw new Error('no shape');
    expect(outcomeForPosition('il_leumit', 1, shape)).toBe('promoted');
    expect(shape.europePlaces).toBe(0);
    // Nothing in a second division may be described as a European place.
    for (let p = 1; p <= shape.size; p += 1) {
      expect(outcomeForPosition('il_leumit', p, shape)).not.toBe('european_places');
    }
  });

  it('is monotonic: finishing higher is never a worse outcome', () => {
    const shape = leagueShape('il_premier');
    if (!shape) throw new Error('no shape');
    const ladder = [
      'champion',
      'title_challenge',
      'european_places',
      'upper_table',
      'mid_table',
      'lower_table',
      'relegation_battle',
      'relegated',
    ];
    let last = -1;
    for (let p = 1; p <= shape.size; p += 1) {
      const rank = ladder.indexOf(outcomeForPosition('il_premier', p, shape));
      expect(rank, `position ${p}`).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });
});

/* ------------------------------------------------------------------ */

describe('the season path', () => {
  it('ends exactly where the projection says', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const p = project(MACCABI_ID, seed);
      expect(p.path.end).toBe(p.finalPosition);
    }
  });

  it('is already inside the final outcome band by the late phase', () => {
    /*
     * This is the property the whole version turns on. A club shown fighting for the title in
     * April must finish in a title-race position - otherwise a late title-decider event can be
     * planned for a season that ends in mid-table, which is the bug v0.4.6 was written to kill.
     */
    for (const clubId of [MACCABI_ID, 'hapoel_hadera', 'hapoel_petah_tikva', 'bnei_sakhnin']) {
      for (let seed = 1; seed <= 120; seed += 1) {
        const p = project(clubId, seed);
        const shape = leagueShape(p.leagueId);
        if (!shape) continue;
        const band = positionsForOutcome(p.leagueId, p.finalOutcome, shape);
        expect(band, `${clubId} seed ${seed}`).toContain(p.path.late);
      }
    }
  });

  it('lets the early season wander further than the late season', () => {
    let earlySpread = 0;
    let lateSpread = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const p = project(MACCABI_ID, seed);
      earlySpread += Math.abs(p.path.early - p.finalPosition);
      lateSpread += Math.abs(p.path.late - p.finalPosition);
    }
    // A table that is settled in August is not a season.
    expect(earlySpread).toBeGreaterThan(lateSpread);
    expect(earlySpread).toBeGreaterThan(0);
  });

  it('never leaves the table', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const p = project('hapoel_petah_tikva', seed);
      for (const phase of PHASES) {
        expect(p.path[phase], `${phase} seed ${seed}`).toBeGreaterThanOrEqual(1);
        expect(p.path[phase], `${phase} seed ${seed}`).toBeLessThanOrEqual(p.leagueSize);
      }
    }
  });
});

/* ------------------------------------------------------------------ */

describe('the table itself', () => {
  const world = emptyWorld();

  it('is full, ordered and unique', () => {
    const p = project(MACCABI_ID, 11);
    for (const phase of PHASES) {
      const table = buildTable(world, p, phase);
      expect(table.rows).toHaveLength(p.leagueSize);
      expect(table.rows.map((r) => r.position)).toEqual(
        Array.from({ length: p.leagueSize }, (_, i) => i + 1),
      );
      expect(new Set(table.rows.map((r) => r.clubId)).size).toBe(p.leagueSize);
    }
  });

  it('puts the player’s club exactly where the projection says', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const p = project(MACCABI_ID, seed);
      for (const phase of PHASES) {
        const table = buildTable(world, p, phase);
        const row = table.rows.find((r) => r.clubId === MACCABI_ID);
        expect(row?.position, `${phase} seed ${seed}`).toBe(p.path[phase]);
      }
    }
  });

  it('never has a lower club on more points than a higher one', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const p = project(MACCABI_ID, seed);
      for (const phase of PHASES) {
        const rows = buildTable(world, p, phase).rows;
        for (let i = 1; i < rows.length; i += 1) {
          const above = rows[i - 1];
          const below = rows[i];
          if (!above || !below) continue;
          expect(above.points, `${phase} ${above.name} vs ${below.name}`).toBeGreaterThanOrEqual(
            below.points,
          );
        }
      }
    }
  });

  it('plays more matches as the season goes on, and a full season by the end', () => {
    const p = project(MACCABI_ID, 3);
    const played = PHASES.map((phase) => buildTable(world, p, phase).rows[0]?.played ?? 0);
    for (let i = 1; i < played.length; i += 1) {
      expect(played[i]).toBeGreaterThan(played[i - 1] as number);
    }
    expect(played[played.length - 1]).toBe(matchesPlayed('end', p.leagueSize));
    expect(matchesPlayed('end', 14)).toBe(26);
  });

  it('is deterministic, so a reloaded save draws the identical table', () => {
    /*
     * The table is never stored - it is a pure function of the projection. That is only safe if
     * drawing it twice gives the same answer, which is what a save/load actually does.
     */
    const p = project(MACCABI_ID, 21);
    const reloaded: SeasonProjection = JSON.parse(JSON.stringify(p));
    for (const phase of PHASES) {
      expect(buildTable(world, reloaded, phase)).toEqual(buildTable(world, p, phase));
    }
  });
});

/* ------------------------------------------------------------------ */

describe('what the club is fighting for', () => {
  const world = emptyWorld();

  it('never claims two incompatible races at once', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const clubId of [MACCABI_ID, 'hapoel_hadera', 'hapoel_petah_tikva']) {
        const p = project(clubId, seed);
        for (const phase of PHASES) {
          const ctx = leagueContextFrom(world, p, phase);
          expect(ctx.titleRace && ctx.relegationBattle, `${clubId} ${phase}`).toBe(false);
          expect(ctx.promotionRace && ctx.relegationBattle, `${clubId} ${phase}`).toBe(false);
          // midTable is defined as "none of the above", so it must be exactly that.
          const anyRace = ctx.titleRace || ctx.europeRace || ctx.relegationBattle || ctx.promotionRace;
          expect(ctx.midTable).toBe(!anyRace);
        }
      }
    }
  });

  it('never puts a top-division club in a promotion race', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const p = project(MACCABI_ID, seed);
      expect(getLeague(p.leagueId).tier).toBe(1);
      for (const phase of PHASES) {
        expect(leagueContextFrom(world, p, phase).promotionRace).toBe(false);
      }
    }
  });

  it('never puts a second-division club in a European race', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const p = project('hapoel_petah_tikva', seed);
      for (const phase of PHASES) {
        expect(leagueContextFrom(world, p, phase).europeRace).toBe(false);
      }
    }
  });

  it('only calls it a title race near the top of the table', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const p = project(MACCABI_ID, seed);
      for (const phase of PHASES) {
        const ctx = leagueContextFrom(world, p, phase);
        if (ctx.titleRace) expect(ctx.position, `seed ${seed} ${phase}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('only calls it a relegation battle near the bottom', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const p = project('hapoel_hadera', seed);
      const shape = leagueShape(p.leagueId);
      if (!shape) continue;
      for (const phase of PHASES) {
        const ctx = leagueContextFrom(world, p, phase);
        if (ctx.relegationBattle) {
          expect(ctx.position, `seed ${seed} ${phase}`).toBeGreaterThanOrEqual(
            shape.size - shape.relegationPlaces - 2,
          );
        }
      }
    }
  });

  it('does not claim a race once the season is over', () => {
    // No matches left means nothing is still being decided.
    for (let seed = 1; seed <= 60; seed += 1) {
      const ctx = leagueContextFrom(world, project(MACCABI_ID, seed), 'end');
      expect(ctx.titleRace || ctx.europeRace || ctx.relegationBattle || ctx.promotionRace).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */

describe('table coherence across real careers', () => {
  it('records a table position for every senior club season', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'CM', seed, policy: balancedPolicy });
      for (const season of career.world.clubSeasons) {
        expect(season.finalPosition, `seed ${seed} ${season.season}`).toBeDefined();
      }
    }
  });

  it('never records an outcome the finishing position does not produce', () => {
    /*
     * The acceptance criterion, checked on real careers rather than on the generator: the season
     * summary's wording and the table's final position are the same fact.
     */
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'ST', seed, policy: balancedPolicy });
      for (const season of career.world.clubSeasons) {
        const shape = leagueShape(season.leagueId);
        if (!shape || season.finalPosition === undefined) continue;
        expect(
          outcomeForPosition(season.leagueId, season.finalPosition, shape),
          `seed ${seed} ${season.season} pos ${season.finalPosition}`,
        ).toBe(season.outcome);
      }
    }
  });

  it('puts stronger clubs higher up the table on average', () => {
    const meanFinish = (clubId: string): number => {
      let total = 0;
      const n = 400;
      for (let seed = 1; seed <= n; seed += 1) total += project(clubId, seed).finalPosition;
      return total / n;
    };
    // Maccabi (76) above Bnei Sakhnin (52) above Hapoel Hadera (48), in the same division.
    expect(meanFinish(MACCABI_ID)).toBeLessThan(meanFinish('bnei_sakhnin'));
    expect(meanFinish('bnei_sakhnin')).toBeLessThan(meanFinish('hapoel_hadera'));
  });

  it('gives a strong club a real chance of a bad year, and vice versa', () => {
    let maccabiBadYear = 0;
    let strugglerGoodYear = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      if (project(MACCABI_ID, seed).finalPosition > 6) maccabiBadYear += 1;
      if (project('hapoel_hadera', seed).finalPosition <= 5) strugglerGoodYear += 1;
    }
    // A league where the best squad always wins is not a league.
    expect(maccabiBadYear).toBeGreaterThan(0);
    expect(strugglerGoodYear).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */

describe('settling the season does not rewrite its history', () => {
  /*
   * Phase 25's explicit requirement. The player's actual season moves his club's final position
   * via `settleProjection`, and that must not reach backwards: a table a player was shown in
   * January has to still say the same thing in June, or the season was never one continuous
   * thing.
   */
  const world = emptyWorld();

  function playedWell(clubId: string): { career: Career; record: SeasonRecord } {
    const base = createCareer({ playerName: 'ס', position: 'ST', seed: 3 });
    const record: SeasonRecord = {
      season: 2040,
      age: 26,
      academyStage: 'senior',
      clubId,
      clubName: clubId,
      teamName: clubId,
      league: 'ליגת העל',
      onLoan: false,
      stats: {
        appearances: 34,
        starts: 33,
        goals: 18,
        assists: 9,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 78,
        injuredGames: 0,
      },
      firstHalf: null,
      ability: 86,
      role: 'star',
      coachTrust: 80,
      trophies: [],
      captain: true,
      olderGroup: 'none',
    };
    return {
      career: { ...base, academyStage: 'senior', currentClubId: clubId, currentSeason: 2040 },
      record,
    };
  }

  it('leaves the early, mid and late positions untouched', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const before = project(MACCABI_ID, seed);
      const { career, record } = playedWell(MACCABI_ID);
      const after = settleProjection(before, career, record);
      for (const phase of ['early', 'mid', 'late'] as SeasonPhase[]) {
        expect(after.path[phase], `seed ${seed} ${phase}`).toBe(before.path[phase]);
      }
    }
  });

  it('redraws the identical early-season table afterwards', () => {
    const before = project(MACCABI_ID, 8);
    const { career, record } = playedWell(MACCABI_ID);
    const after = settleProjection(before, career, record);
    for (const phase of ['early', 'mid', 'late'] as SeasonPhase[]) {
      expect(buildTable(world, after, phase), phase).toEqual(buildTable(world, before, phase));
    }
  });

  it('never moves the club out of the outcome band it committed to', () => {
    /*
     * He can be why they finished second instead of fourth. He cannot turn a season that was
     * planned as a title race into mid-table after the events for it were already chosen.
     */
    for (let seed = 1; seed <= 80; seed += 1) {
      const before = project(MACCABI_ID, seed);
      const { career, record } = playedWell(MACCABI_ID);
      const after = settleProjection(before, career, record);
      expect(after.finalOutcome, `seed ${seed}`).toBe(before.finalOutcome);
      const shape = leagueShape(after.leagueId);
      if (!shape) continue;
      expect(
        outcomeForPosition(after.leagueId, after.finalPosition, shape),
        `seed ${seed}`,
      ).toBe(after.finalOutcome);
    }
  });

  it('lets a great season actually move the club, at least sometimes', () => {
    // A settle step that never changes anything is not a feature.
    let moved = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const before = project(MACCABI_ID, seed);
      const { career, record } = playedWell(MACCABI_ID);
      if (settleProjection(before, career, record).finalPosition !== before.finalPosition) moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
  });
});

describe('youth football has no table', () => {
  it('projects nothing for an academy player', () => {
    const career = createCareer({ playerName: 'י', position: 'CM', seed: 4 });
    expect(projectSeason(career.world, career.currentClubId, 2031, null, career, createRng(1))).toBeNull();
  });
});

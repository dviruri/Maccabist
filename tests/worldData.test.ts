/**
 * World-data truth (v0.6.3, Checkpoint 1).
 *
 * Real playtesting in Italy produced a league table reading "קבוצה 8 / קבוצה 9 / קבוצה 10":
 * `LeagueShape.others` declared eight clubs for a twenty-club division and the engine invented
 * the rest at runtime. The generator is deleted; these tests are what keeps it deleted.
 *
 * The invariant is exact: for every tabled league, the modelled clubs that default into it plus
 * its named table clubs equal its declared size. Not "at least" - a league that is over-full
 * silently drops real clubs from the bottom of the table, which is a quieter version of the
 * same lie.
 */

import { describe, expect, it } from 'vitest';

import { ALL_CLUBS } from '../src/data/clubs';
import { EXTERNAL_YOUTH_CLUB_IDS } from '../src/data/youthClubs';
import { defaultLeagueFor, getLeague } from '../src/data/leagues';
import { LEAGUE_SHAPES, hasTable } from '../src/data/leagueShape';
import {
  RESERVE_CLUBS_BY_LEAGUE,
  TABLE_CLUBS_BY_LEAGUE,
  WORLD_DATA_VERSION,
  allTableClubs,
  tableClubById,
} from '../src/data/worldClubs';
import { clubVisual } from '../src/data/clubVisuals';
import { createCareer } from '../src/game/careerEngine';
import { buildTable, projectSeason } from '../src/game/leagueEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career } from '../src/types';

/**
 * Every generated-placeholder pattern the old engine could produce, plus the imports the brief
 * names. Checked against NAMES, because the ban is about what a player can read.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /קבוצה\s*\d/,
  /יריבה אירופית/,
  /^Team\s*\d+$/i,
  /^Club\s*\d+$/i,
  /placeholder/i,
];

function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(name));
}

/** The modelled clubs whose default league is this one. Mirrors `membership()` exactly. */
function modelledIn(leagueId: string): string[] {
  return ALL_CLUBS.filter(
    (c) =>
      c.tier !== 'academy' &&
      c.tier !== 'youth' &&
      defaultLeagueFor(c.tier, c.country) === leagueId,
  ).map((c) => c.id);
}

/* ================================================================== */
/* League completeness                                                 */
/* ================================================================== */

describe('v0.6.3 every tabled league carries its complete membership', () => {
  it('has modelled + table clubs equal to the declared size, exactly', () => {
    const report: string[] = [];
    for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
      const total = modelledIn(leagueId).length + shape.others.length;
      if (total !== shape.size) {
        report.push(`${leagueId}: ${total} clubs for ${shape.size} places`);
      }
    }
    expect(report, 'incomplete or over-full leagues').toEqual([]);
  });

  it('declares a shape for every league a modelled club can play in', () => {
    for (const club of ALL_CLUBS) {
      if (club.tier === 'academy' || club.tier === 'youth') continue;
      const leagueId = defaultLeagueFor(club.tier, club.country);
      expect(hasTable(leagueId), `${club.id} -> ${leagueId}`).toBe(true);
    }
  });

  it('leaves the generic euro buckets tableless and unreachable', () => {
    /*
     * euro_elite / euro_strong were quality buckets with placeholder rival names. They survive
     * in leagues.ts only as defaultLeagueFor's fallback for an unmapped country - and the test
     * above proves no club's country is unmapped, so no table can ever be drawn for them.
     */
    expect(hasTable('euro_elite')).toBe(false);
    expect(hasTable('euro_strong')).toBe(false);
  });

  it('keeps every table club inside a league its own data declares', () => {
    for (const [leagueId, clubs] of Object.entries(TABLE_CLUBS_BY_LEAGUE)) {
      expect(LEAGUE_SHAPES[leagueId], leagueId).toBeDefined();
      expect(clubs.length, leagueId).toBeGreaterThan(0);
      // And the league genuinely exists with a country.
      expect(getLeague(leagueId).country.length).toBeGreaterThan(0);
    }
  });

  it('carries a versioned snapshot', () => {
    expect(WORLD_DATA_VERSION).toMatch(/^\d{4}\.\d+$/);
  });
});

/* ================================================================== */
/* The placeholder ban                                                 */
/* ================================================================== */

describe('v0.6.3 no user-visible club may be a placeholder', () => {
  it('bans placeholder names across the whole club world', () => {
    const offenders: string[] = [];
    for (const club of ALL_CLUBS) {
      if (isPlaceholderName(club.name)) offenders.push(`club ${club.id}: ${club.name}`);
    }
    for (const club of allTableClubs()) {
      if (isPlaceholderName(club.name)) offenders.push(`table ${club.id}: ${club.name}`);
    }
    expect(offenders).toEqual([]);
  });

  it('bans generated ids of the old filler scheme', () => {
    for (const club of allTableClubs()) {
      expect(club.id, club.id).not.toMatch(/^filler_/);
      expect(club.id, club.id).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it('never renders a placeholder row in any real table', () => {
    /*
     * The runtime proof, through the same path the UI uses. A table is drawn for every tabled
     * league at every phase, and every row must carry a real name. This is the test that fails
     * if anyone reintroduces a pad loop, whatever the data says.
     */
    for (const [leagueId] of Object.entries(LEAGUE_SHAPES)) {
      const anchor = modelledIn(leagueId)[0];
      if (!anchor) continue; // cy_first: covered by the direct membership assertions above.
      const career = careerAt(anchor, leagueId);
      const projection = projectSeason(
        career.world,
        anchor,
        career.currentSeason,
        null,
        career,
        createRng(42),
      );
      expect(projection, leagueId).not.toBeNull();
      for (const phase of ['early', 'mid', 'late', 'end'] as const) {
        const table = buildTable(career.world, projection!, phase);
        expect(table.rows.length, leagueId).toBe(LEAGUE_SHAPES[leagueId]!.size);
        for (const row of table.rows) {
          expect(isPlaceholderName(row.name), `${leagueId}/${phase}: ${row.name}`).toBe(false);
        }
      }
    }
  });
});

/* ================================================================== */
/* Identity integrity                                                  */
/* ================================================================== */

describe('v0.6.3 club identity is unique and resolvable', () => {
  it('has no id collisions across modelled clubs, table clubs and reserves', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const club of ALL_CLUBS) seen.set(club.id, 'club');
    for (const club of allTableClubs()) {
      if (seen.has(club.id)) collisions.push(`${club.id} (${seen.get(club.id)} + table)`);
      else seen.set(club.id, 'table');
    }
    expect(collisions).toEqual([]);
  });

  it('has no duplicate display names inside any one division', () => {
    /*
     * The bug this pins: il_leumit listed "מכבי יפו" while the modelled מכבי קביליו יפו mapped
     * into the same division - one real club, two rows.
     */
    for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
      const names = [
        ...modelledIn(leagueId).map((id) => ALL_CLUBS.find((c) => c.id === id)!.name),
        ...shape.others.map((c) => c.name),
      ];
      expect(new Set(names).size, `${leagueId} has duplicate names`).toBe(names.length);
    }
  });

  it('keeps reserves out of every division main list', () => {
    const memberIds = new Set(
      Object.values(TABLE_CLUBS_BY_LEAGUE)
        .flat()
        .map((c) => c.id),
    );
    for (const reserves of Object.values(RESERVE_CLUBS_BY_LEAGUE)) {
      for (const reserve of reserves) {
        expect(memberIds.has(reserve.id), reserve.id).toBe(false);
      }
    }
  });

  it('resolves every club - modelled, table, reserve - to a valid visual', () => {
    const HEX = /^#[0-9a-f]{6}$/i;
    const everyone = [
      ...ALL_CLUBS.map((cl) => ({ id: cl.id, name: cl.name })),
      ...allTableClubs().map((cl) => ({ id: cl.id, name: cl.name })),
    ];
    for (const { id, name } of everyone) {
      const visual = clubVisual(id, name);
      expect(visual.primary, id).toMatch(HEX);
      expect(visual.secondary, id).toMatch(HEX);
      expect(visual.initials.length, id).toBeGreaterThan(0);
      // A declared asset must be repo-local; remote URLs are banned at the resolver too.
      if (visual.asset) expect(visual.asset).not.toMatch(/^https?:/i);
    }
  });

  it('keeps quality on the shared 0-100 scale everywhere', () => {
    for (const club of allTableClubs()) {
      expect(club.quality, club.id).toBeGreaterThan(0);
      expect(club.quality, club.id).toBeLessThanOrEqual(100);
    }
  });

  it('looks table clubs up by id, both directions', () => {
    expect(tableClubById('inter_milan')?.name).toBe('אינטר');
    expect(tableClubById('no_such_club')).toBeNull();
  });
});

/* ================================================================== */
/* Transfer-market protection                                          */
/* ================================================================== */

describe('v0.6.3 more clubs does not mean more transfers', () => {
  it('never offers a table club - the market draws only from ALL_CLUBS', () => {
    /*
     * The whole probability-protection argument rests on one structural fact: the market's
     * candidate pool is `ALL_CLUBS`, and v0.6.3 added its ~150 named clubs somewhere else.
     * This test pins that fact through the real engine, so if someone ever merges table clubs
     * into the market pool, the Europe rate does not quietly double - a test fails and the
     * question gets asked out loud.
     */
    // The signable world: modelled clubs plus the academy-stage external youth clubs.
    const clubIds = new Set([...ALL_CLUBS.map((c) => c.id), ...EXTERNAL_YOUTH_CLUB_IDS]);
    const offenders: string[] = [];
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      for (const record of career.seasonHistory) {
        if (!clubIds.has(record.clubId)) offenders.push(`seed ${seed}: played for ${record.clubId}`);
      }
      for (const trophy of career.trophies) {
        if (!clubIds.has(trophy.clubId)) offenders.push(`seed ${seed}: trophy at ${trophy.clubId}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('static: transferEngine and marketEngine do not import the table-club dataset', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    for (const file of ['transferEngine.ts', 'marketEngine.ts']) {
      const source = fs.readFileSync(path.resolve(__dirname, `../src/game/${file}`), 'utf8');
      expect(source, `${file} must not draw destinations from worldClubs`).not.toContain(
        "from '../data/worldClubs'",
      );
    }
  });
});

/* ================================================================== */

function careerAt(clubId: string, _leagueId: string, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability: 74,
    roleValue: 70,
    currentSeason: 2044,
  };
}

/**
 * World-data truth (v0.6.3, rewritten for the v0.6.4 unification).
 *
 * v0.6.3 killed the runtime "קבוצה N" generator and held membership to an exact size. v0.6.4 went
 * further: there is no `TableClub` any more, a division's size IS the length of its membership
 * list, and every active member is a real `Club` the market can reach. These tests keep all three
 * true, and pin the specific snapshot errors v0.6.3 shipped.
 */

import { describe, expect, it } from 'vitest';

import { ACTIVE_CLUBS, ALL_CLUBS, CLUBS, getClub } from '../src/data/clubs';
import { EXTERNAL_YOUTH_CLUB_IDS } from '../src/data/youthClubs';
import { defaultLeagueFor } from '../src/data/leagues';
import { LEAGUE_SHAPES, hasTable } from '../src/data/leagueShape';
import {
  INACTIVE_CLUB_IDS,
  LEAGUE_MEMBERSHIP,
  WORLD_CLUBS,
  WORLD_DATA_VERSION,
  WORLD_SNAPSHOT_SEASON,
  isInactiveClub,
  snapshotLeagueOf,
} from '../src/data/worldClubs';
import { clubVisual } from '../src/data/clubVisuals';
import { createCareer } from '../src/game/careerEngine';
import { buildTable, projectSeason } from '../src/game/leagueEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career } from '../src/types';

/** Every generated-placeholder pattern the old engine could produce. */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /קבוצה\s*\d/,
  /יריבה אירופית/,
  /^Team\s*\d+$/i,
  /^Club\s*\d+$/i,
  /placeholder/i,
];

const isPlaceholderName = (name: string): boolean =>
  PLACEHOLDER_PATTERNS.some((p) => p.test(name));

function careerAt(clubId: string, seed = 5): Career {
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

/* ================================================================== */
/* Membership completeness                                             */
/* ================================================================== */

describe('v0.6.4 every league carries its complete, real membership', () => {
  it('makes size and membership the same fact', () => {
    /*
     * v0.6.3 declared a `size` literal and asserted membership matched it. v0.6.4 derives size
     * FROM membership, so they cannot disagree - this asserts the derivation is wired, rather
     * than that two independent numbers happen to agree.
     */
    for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
      expect(shape.size, leagueId).toBe(LEAGUE_MEMBERSHIP[leagueId]?.length);
      expect(shape.size, leagueId).toBeGreaterThan(0);
    }
  });

  it('matches the verified 2026/27 snapshot sizes', () => {
    const expected: Record<string, number> = {
      il_premier: 14,
      il_leumit: 16,
      il_alef_north: 18,
      il_alef_south: 18,
      it_seriea: 20,
      en_premier: 20,
      es_laliga: 20,
      de_bundesliga: 18,
      nl_eredivisie: 18,
      be_pro: 18,
      pt_primeira: 18,
      at_bundesliga: 12,
      gr_superleague: 14,
      cy_first: 14,
    };
    for (const [leagueId, size] of Object.entries(expected)) {
      expect(LEAGUE_MEMBERSHIP[leagueId]?.length, leagueId).toBe(size);
    }
    expect(Object.keys(LEAGUE_MEMBERSHIP).sort()).toEqual(Object.keys(expected).sort());
  });

  it('resolves every member to a real, active club', () => {
    for (const [leagueId, ids] of Object.entries(LEAGUE_MEMBERSHIP)) {
      for (const id of ids) {
        expect(CLUBS[id], `${leagueId}: ${id}`).toBeDefined();
        expect(isInactiveClub(id), `${leagueId}: ${id} is inactive`).toBe(false);
      }
    }
  });

  it('never lists a club in two divisions', () => {
    const seen = new Map<string, string>();
    for (const [leagueId, ids] of Object.entries(LEAGUE_MEMBERSHIP)) {
      for (const id of ids) {
        expect(seen.has(id), `${id} in ${seen.get(id)} and ${leagueId}`).toBe(false);
        seen.set(id, leagueId);
      }
    }
  });

  it('declares a shape for every league an active club can play in', () => {
    for (const club of ACTIVE_CLUBS) {
      if (club.tier === 'academy' || club.tier === 'youth') continue;
      const leagueId = defaultLeagueFor(club.tier, club.country, club.id);
      expect(hasTable(leagueId), `${club.id} -> ${leagueId}`).toBe(true);
    }
  });

  it('leaves the generic euro buckets tableless and unreachable', () => {
    expect(hasTable('euro_elite')).toBe(false);
    expect(hasTable('euro_strong')).toBe(false);
  });

  it('carries a versioned, named snapshot', () => {
    expect(WORLD_DATA_VERSION).toBe('2026.4');
    expect(WORLD_SNAPSHOT_SEASON).toBe('2026/27');
  });
});

/* ================================================================== */
/* Snapshot accuracy - the specific v0.6.3 errors                      */
/* ================================================================== */

describe('v0.6.4 the snapshot errors v0.6.3 shipped are fixed', () => {
  it('puts the promoted Israeli clubs in the top flight', () => {
    // v0.6.3 had these in Liga Leumit, or (Maccabi Petah Tikva) in no division at all.
    for (const id of ['hapoel_petah_tikva', 'hapoel_ramat_gan', 'maccabi_petah_tikva']) {
      expect(snapshotLeagueOf(id), id).toBe('il_premier');
    }
  });

  it('removes Hapoel Hadera from the top flight', () => {
    /*
     * v0.6.3 modelled it as an `israeli_mid` top-flight club. v0.6.4 made it inactive - the
     * honest state while no third tier existed. v0.6.5 models the tier it actually plays in,
     * so the club is back: an active Liga Alef South member.
     */
    expect(snapshotLeagueOf('hapoel_hadera')).toBe('il_alef_south');
    expect(isInactiveClub('hapoel_hadera')).toBe(false);
  });

  it('relegates F.C. Ashdod and Maccabi Bnei Reineh to Liga Leumit', () => {
    expect(snapshotLeagueOf('ms_ashdod')).toBe('il_leumit');
    expect(snapshotLeagueOf('maccabi_bnei_raina')).toBe('il_leumit');
  });

  it('gives Cyprus fourteen clubs, not twelve', () => {
    expect(LEAGUE_MEMBERSHIP.cy_first?.length).toBe(14);
    expect(LEAGUE_MEMBERSHIP.cy_first).not.toContain('ethnikos_achna');
    expect(LEAGUE_MEMBERSHIP.cy_first).not.toContain('doxa_katokopias');
  });

  it('expands the Belgian Pro League to eighteen', () => {
    expect(LEAGUE_MEMBERSHIP.be_pro?.length).toBe(18);
  });
});

/* ================================================================== */
/* The placeholder ban                                                 */
/* ================================================================== */

describe('v0.6.4 no user-visible club may be a placeholder', () => {
  it('bans placeholder names across the whole club world', () => {
    const offenders = ALL_CLUBS.filter((club) => isPlaceholderName(club.name)).map((c) => c.id);
    expect(offenders).toEqual([]);
  });

  it('bans generated ids of the old filler scheme', () => {
    for (const club of WORLD_CLUBS) {
      expect(club.id, club.id).not.toMatch(/^filler_/);
      expect(club.id, club.id).toMatch(/^[a-z][a-z0-9_]+$/);
    }
  });

  it('never renders a placeholder or an inactive club in any real table', () => {
    for (const [leagueId, shape] of Object.entries(LEAGUE_SHAPES)) {
      const anchor = LEAGUE_MEMBERSHIP[leagueId]![0]!;
      const career = careerAt(anchor);
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
        expect(table.rows.length, leagueId).toBe(shape.size);
        for (const row of table.rows) {
          expect(isPlaceholderName(row.name), `${leagueId}/${phase}: ${row.name}`).toBe(false);
          expect(isInactiveClub(row.clubId), `${leagueId}: ${row.clubId}`).toBe(false);
        }
      }
    }
  });
});

/* ================================================================== */
/* Identity integrity                                                  */
/* ================================================================== */

describe('v0.6.4 club identity is unique and resolvable', () => {
  it('has one record per club id', () => {
    const ids = ALL_CLUBS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate display names inside any one division', () => {
    for (const [leagueId, ids] of Object.entries(LEAGUE_MEMBERSHIP)) {
      const names = ids.map((id) => getClub(id).name);
      expect(new Set(names).size, `${leagueId} has duplicate names`).toBe(names.length);
    }
  });

  it('resolves every club to a valid visual', () => {
    const HEX = /^#[0-9a-f]{6}$/i;
    for (const club of ALL_CLUBS) {
      const visual = clubVisual(club.id, club.name);
      expect(visual.primary, club.id).toMatch(HEX);
      expect(visual.secondary, club.id).toMatch(HEX);
      expect(visual.initials.length, club.id).toBeGreaterThan(0);
      if (visual.asset) expect(visual.asset).not.toMatch(/^https?:/i);
    }
  });

  it('keeps quality and prestige on the shared 0-100 scale', () => {
    for (const club of ALL_CLUBS) {
      expect(club.quality, club.id).toBeGreaterThan(0);
      expect(club.quality, club.id).toBeLessThanOrEqual(100);
      expect(club.prestige, club.id).toBeGreaterThanOrEqual(0);
      expect(club.prestige, club.id).toBeLessThanOrEqual(100);
      expect(club.seasonGames, club.id).toBeGreaterThan(20);
    }
  });

  it('keeps derived competitive chances inside their bands', () => {
    for (const club of ACTIVE_CLUBS) {
      for (const chance of [club.titleChance, club.cupChance, club.europeChance]) {
        expect(Number.isFinite(chance), club.id).toBe(true);
        expect(chance, club.id).toBeGreaterThanOrEqual(0);
        expect(chance, club.id).toBeLessThanOrEqual(0.4);
      }
    }
  });
});

/* ================================================================== */
/* Inactive clubs (A5, A6)                                             */
/* ================================================================== */

describe('v0.6.4 an inactive club keeps its identity and loses its place', () => {
  it('still resolves a name and a badge, so old saves read honestly', () => {
    for (const id of INACTIVE_CLUB_IDS) {
      expect(() => getClub(id), id).not.toThrow();
      expect(getClub(id).name.length, id).toBeGreaterThan(0);
      expect(clubVisual(id).initials.length, id).toBeGreaterThan(0);
    }
  });

  it('is in no division and in no market', () => {
    const activeIds = new Set(ACTIVE_CLUBS.map((c) => c.id));
    for (const id of INACTIVE_CLUB_IDS) {
      expect(snapshotLeagueOf(id), id).toBeNull();
      expect(activeIds.has(id), `${id} is still in ACTIVE_CLUBS`).toBe(false);
    }
  });

  it('is never signed in a real career', () => {
    const offenders: string[] = [];
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = simulateCareer({
        playerName: 'ת',
        position: 'ST',
        seed,
        policy: balancedPolicy,
      });
      for (const record of career.seasonHistory) {
        if (isInactiveClub(record.clubId)) offenders.push(`seed ${seed}: ${record.clubId}`);
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });
});

/* ================================================================== */
/* Playable coverage (C6)                                              */
/* ================================================================== */

describe('v0.6.4 the world is playable, not scenery', () => {
  it('makes every active division member a possible career destination', () => {
    /*
     * The headline of v0.6.4. Under v0.6.3 a Serie A table had twenty clubs and two of them
     * could sign the player; the other eighteen were `TableClub`s the market could not see.
     */
    const marketIds = new Set(ACTIVE_CLUBS.filter((c) => c.isSenior === true).map((c) => c.id));
    const notPlayable: string[] = [];
    for (const ids of Object.values(LEAGUE_MEMBERSHIP)) {
      for (const id of ids) {
        if (!marketIds.has(id)) notPlayable.push(id);
      }
    }
    expect(notPlayable, 'division members that cannot be signed').toEqual([]);
  });

  it('has a lot more of them than v0.6.3 did', () => {
    // v0.6.3: 33 signable senior clubs. This should be a step change, not a trim.
    const seniors = ACTIVE_CLUBS.filter((c) => c.isSenior === true);
    expect(seniors.length).toBeGreaterThan(150);
  });

  it('keeps the ladder: elite, mid and lower clubs all exist in quantity', () => {
    const seniors = ACTIVE_CLUBS.filter((c) => c.isSenior === true);
    expect(seniors.filter((c) => c.quality >= 85).length).toBeGreaterThan(5);
    expect(seniors.filter((c) => c.quality >= 60 && c.quality < 75).length).toBeGreaterThan(40);
    expect(seniors.filter((c) => c.quality < 50).length).toBeGreaterThan(10);
  });
});

describe('v0.6.4 youth clubs stay outside the league world', () => {
  it('has no external youth club in any division', () => {
    for (const id of EXTERNAL_YOUTH_CLUB_IDS) {
      expect(snapshotLeagueOf(id), id).toBeNull();
    }
  });
});

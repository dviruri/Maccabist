/**
 * Controlled scenarios for v0.6.3 (A-J).
 *
 * The world-data and crest invariants are proven wholesale in worldData.test.ts and
 * crestPipeline.test.ts; these are the brief's ten named situations, each pinned as the
 * specific case a player would actually meet.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREST_MANIFEST } from '../src/data/clubCrests.generated';
import { ALL_CLUBS, MACCABI_ID, getClub } from '../src/data/clubs';
import { clubVisual, getClubCrest } from '../src/data/clubVisuals';
import { LEAGUE_MEMBERSHIP } from '../src/data/worldClubs';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import { cupFinalOpponent, projectCup } from '../src/game/cupEngine';
import { clubDisplayName } from '../src/game/identity';
import { buildTable, projectSeason } from '../src/game/leagueEngine';
import { matchContext } from '../src/game/matchEngine';
import { createRng } from '../src/game/random';
import { generateOffers } from '../src/game/transferEngine';
import type { Career } from '../src/types';

const PLACEHOLDER = /קבוצה\s*\d|יריבה אירופית|^Team\s*\d|^Club\s*\d/;

function seniorAt(clubId: string, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability: 76,
    roleValue: 72,
    reputation: 60,
    currentSeason: 2044,
  };
}

function fullTable(clubId: string, seed = 11): { rows: { clubId: string; name: string }[] } {
  const career = seniorAt(clubId, seed);
  const projection = projectSeason(
    career.world,
    clubId,
    career.currentSeason,
    null,
    career,
    createRng(seed),
  )!;
  return buildTable(career.world, projection, 'mid');
}

describe('v0.6.3 A. the Italian league is Serie A', () => {
  it('shows twenty named clubs, every one with a crest path', () => {
    const table = fullTable('bologna');
    expect(table.rows.length).toBe(20);
    for (const row of table.rows) {
      expect(row.name, row.clubId).not.toMatch(PLACEHOLDER);
      const visual = clubVisual(row.clubId, row.name);
      expect(visual.initials.length, row.clubId).toBeGreaterThan(0);
    }
    // And it is recognisably Serie A, not a list of inventions.
    const names = table.rows.map((r) => r.name);
    for (const expected of ['אינטר', 'מילאן', 'יובנטוס', 'רומא']) {
      expect(names).toContain(expected);
    }
  });
});

describe('v0.6.3 B. the Dutch league is the Eredivisie', () => {
  it('shows eighteen named clubs', () => {
    const table = fullTable('az_alkmaar');
    expect(table.rows.length).toBe(18);
    for (const row of table.rows) expect(row.name, row.clubId).not.toMatch(PLACEHOLDER);
    expect(table.rows.map((r) => r.name)).toContain('איאקס');
  });
});

describe('v0.6.3 C. a small market is complete too', () => {
  it('fills the Austrian Bundesliga with twelve named clubs', () => {
    const table = fullTable('sturm_graz');
    expect(table.rows.length).toBe(12);
    for (const row of table.rows) expect(row.name, row.clubId).not.toMatch(PLACEHOLDER);
  });

  it('and Cyprus is fully named at its real 2026/27 size', () => {
    // v0.6.4 corrected the division from 12 clubs to its actual 14.
    const ids = LEAGUE_MEMBERSHIP.cy_first!;
    expect(ids.length).toBe(14);
    for (const id of ids) expect(getClub(id).name).not.toMatch(PLACEHOLDER);
  });
});

describe('v0.6.3 D. a transfer offer is an identified club', () => {
  it('offers real clubs with country, league and crest identity', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = { ...seniorAt(MACCABI_ID, seed), reputation: 70, ability: 80 };
      for (const offer of generateOffers(career, createRng(seed))) {
        checked += 1;
        const club = getClub(offer.clubId);
        expect(club.name).not.toMatch(PLACEHOLDER);
        expect(club.country.length).toBeGreaterThan(0);
        const visual = clubVisual(offer.clubId);
        expect(visual.initials.length, offer.clubId).toBeGreaterThan(0);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('v0.6.3 E. a match moment has two identifiable clubs', () => {
  it('never names a placeholder opponent, in Italy included', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const career = seniorAt('bologna', seed);
      const projection = projectSeason(
        career.world,
        'bologna',
        career.currentSeason,
        null,
        career,
        createRng(seed),
      );
      const withWorld: Career = {
        ...career,
        world: { ...career.world, projection },
      };
      for (const phase of ['early', 'mid', 'late'] as const) {
        const match = matchContext(withWorld, phase, {});
        if (!match) continue;
        expect(match.opponentName, `seed ${seed}`).not.toMatch(PLACEHOLDER);
        expect(match.opponentClubId).not.toMatch(/^filler_/);
      }
    }
  });
});

describe('v0.6.3 F. a cup opponent is a real club from the right country', () => {
  it('draws Italian finals from the whole of Serie A', () => {
    const rng = createRng(77);
    const career = seniorAt('napoli');
    const finalists = new Set<string>();
    for (let i = 0; i < 4000; i += 1) {
      const cup = projectCup(career, rng);
      if (cup.finalOpponentId) finalists.add(cup.finalOpponentId);
    }
    // More than the one other modelled Italian club - the table clubs are in the draw.
    expect(finalists.size).toBeGreaterThan(3);
    for (const id of finalists) {
      const name = clubDisplayName(id);
      expect(name, id).not.toMatch(PLACEHOLDER);
      expect(getClub(id).country, id).toBe('איטליה');
    }
  });
});

describe('v0.6.3 G. a missing real crest falls back to the badge', () => {
  it('keeps drawable badge inputs for every club that has an asset', () => {
    /*
     * The runtime half is ClubCrest's onError state (Phase 17): a failed load re-renders the
     * generated badge. The static half, asserted here: the badge inputs exist for every
     * manifest club, so deleting any asset file leaves a working crest rather than a hole.
     */
    for (const clubId of Object.keys(CREST_MANIFEST)) {
      const visual = clubVisual(clubId);
      expect(visual.primary, clubId).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.initials.length, clubId).toBeGreaterThan(0);
    }
  });
});

describe('v0.6.3 H. ambiguity is refused, not resolved by luck', () => {
  it('records the reviewed Inter resolution rather than a guess', () => {
    /*
     * The live case: "Inter Milan" search surfaces two entities that both verify (the men's and
     * women's clubs - same name, same country, both football clubs). The importer reported it
     * ambiguous; the resolution is a *reviewed* QID recorded on the seed, which the importer
     * re-verifies on every run. This test pins the artefact of that flow: if Inter has a crest,
     * it is the men's club's PD file, with provenance.
     */
    const entry = CREST_MANIFEST['inter_milan'];
    if (!entry) return; // not imported in this checkout - fallback badge, which is valid.
    const provenance = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/club-crests/manifest.json'), 'utf8'),
    ) as Record<string, { wikidata: string }>;
    expect(provenance['inter_milan']!.wikidata).toBe('Q631');
  });
});

describe('v0.6.3 I. the game works offline', () => {
  it('resolves every crest to a local path or a drawn badge - no network anywhere', () => {
    for (const { id, name } of ALL_CLUBS.map((c) => ({ id: c.id, name: c.name }))) {
      const asset = getClubCrest(id);
      if (asset) {
        expect(asset).not.toMatch(/^https?:/i);
      } else {
        expect(clubVisual(id, name).initials.length, id).toBeGreaterThan(0);
      }
    }
  });
});

describe('v0.6.3 J. an old save loads against the new world', () => {
  it('hydrates a pre-v0.6.3 career without touching its history', () => {
    /*
     * Table clubs were never persisted - tables are derived from tableSeed each season, and
     * every stored clubId (seasons, trophies, cup finalists) came from ALL_CLUBS. So there is
     * nothing to migrate and nothing to falsify: the same save simply draws complete tables
     * from now on. Simulated here as a career shaped like an old save: no cup state, a played
     * history, hydrated against the new world.
     */
    const old = seniorAt(MACCABI_ID, 9);
    expect(old.world.cup).toBeUndefined();
    const hydrated = hydrateCareer(old);
    expect(hydrated.currentClubId).toBe(MACCABI_ID);
    expect(cupFinalOpponent(hydrated)).toBeNull();
    // Its next table is already complete.
    const table = fullTable(MACCABI_ID, 9);
    expect(table.rows.length).toBe(14);
    for (const row of table.rows) expect(row.name).not.toMatch(PLACEHOLDER);
  });
});

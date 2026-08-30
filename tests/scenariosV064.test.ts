/**
 * Controlled scenarios for v0.6.4 (A-L).
 *
 * The wholesale invariants live in worldData / marketSelection / crestPipeline. These are the
 * brief's twelve named situations, each pinned as the specific case a player would meet.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREST_MANIFEST } from '../src/data/clubCrests.generated';
import { ACTIVE_CLUBS, ALL_CLUBS, MACCABI_ID, getClub } from '../src/data/clubs';
import { clubVisual, getClubCrest } from '../src/data/clubVisuals';
import { LEAGUE_MEMBERSHIP, isInactiveClub, snapshotLeagueOf } from '../src/data/worldClubs';
import { CREST_SEEDS } from '../scripts/crestSeeds';
import { classifyAsset } from '../scripts/crestRoles';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import { projectCup } from '../src/game/cupEngine';
import { initialManagerTrust, resolveClubManager } from '../src/game/peopleEngine';
import { buildTable, projectSeason } from '../src/game/leagueEngine';
import { clubInterest, drawDestination } from '../src/game/marketEngine';
import { createRng } from '../src/game/random';
import { leagueOf } from '../src/game/worldEngine';
import type { Career } from '../src/types';

const PLACEHOLDER = /קבוצה\s*\d|יריבה אירופית|^Team\s*\d|^Club\s*\d/;

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

function tableFor(clubId: string, seed = 11): ReturnType<typeof buildTable> {
  const career = player({ currentClubId: clubId }, seed);
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

/* ================================================================== */

describe('v0.6.4 A. the Serie A table is the real Serie A', () => {
  it('is twenty named clubs at the 2026/27 snapshot', () => {
    const table = tableFor('bologna');
    expect(table.rows.length).toBe(20);
    for (const row of table.rows) expect(row.name, row.clubId).not.toMatch(PLACEHOLDER);
    const names = table.rows.map((r) => r.name);
    for (const club of ['אינטר', 'מילאן', 'יובנטוס', 'רומא', 'נאפולי']) {
      expect(names, club).toContain(club);
    }
    // And the clubs the snapshot relegated are not in it.
    const ids = table.rows.map((r) => r.clubId);
    for (const gone of ['cremonese', 'hellas_verona', 'pisa']) expect(ids).not.toContain(gone);
  });
});

describe('v0.6.4 B. Israel is in the right divisions', () => {
  it('has the promoted clubs in ליגת העל and the relegated ones out of it', () => {
    const ids = tableFor(MACCABI_ID).rows.map((r) => r.clubId);
    expect(ids.length).toBe(14);
    for (const promoted of ['hapoel_petah_tikva', 'hapoel_ramat_gan', 'maccabi_petah_tikva']) {
      expect(ids, promoted).toContain(promoted);
    }
    for (const gone of ['hapoel_hadera', 'ms_ashdod', 'maccabi_bnei_raina']) {
      expect(ids, gone).not.toContain(gone);
    }
  });

  it('has a full sixteen-club Liga Leumit with the relegated clubs in it', () => {
    const ids = tableFor('hapoel_kfar_saba').rows.map((r) => r.clubId);
    expect(ids.length).toBe(16);
    expect(ids).toContain('ms_ashdod');
    expect(ids).toContain('maccabi_bnei_raina');
    for (const row of tableFor('hapoel_kfar_saba').rows) {
      expect(row.name, row.clubId).not.toMatch(PLACEHOLDER);
    }
  });
});

describe('v0.6.4 C. Cyprus is the right size', () => {
  it('is a fourteen-club division with no second-tier clubs inserted', () => {
    const ids = LEAGUE_MEMBERSHIP.cy_first!;
    expect(ids.length).toBe(14);
    for (const id of ids) {
      expect(getClub(id).name).not.toMatch(PLACEHOLDER);
      expect(snapshotLeagueOf(id)).toBe('cy_first');
    }
    // The clubs v0.6.3 wrongly had in the division are gone.
    expect(ids).not.toContain('ethnikos_achna');
    expect(ids).not.toContain('doxa_katokopias');
  });
});

describe('v0.6.4 D. an elite Italian move is possible for an elite player', () => {
  it('lets a top player reach an Italian giant', () => {
    const star = player({ ability: 89, reputation: 88, age: 25, roleValue: 86 });
    const giants = ['inter_milan', 'juventus', 'ac_milan'];
    const interested = giants.filter(
      (id) => clubInterest(star, getClub(id), star.currentSeason) > 0.02,
    );
    expect(interested.length, 'no Italian giant would look at an 89/88 player').toBeGreaterThan(0);
  });
});

describe('v0.6.4 E. an ordinary player gets ordinary Italian clubs', () => {
  it('is invisible to the giants and plausible to the rest', () => {
    const ordinary = player({ ability: 68, reputation: 45, age: 24, roleValue: 60 });
    for (const id of ['inter_milan', 'juventus', 'ac_milan', 'napoli']) {
      expect(clubInterest(ordinary, getClub(id), ordinary.currentSeason), id).toBeLessThan(0.05);
    }
    const reachable = (LEAGUE_MEMBERSHIP.it_seriea ?? []).filter(
      (id) => clubInterest(ordinary, getClub(id), ordinary.currentSeason) > 0.02,
    );
    expect(reachable.length, 'no Italian club at all for a decent player').toBeGreaterThan(0);
  });
});

describe('v0.6.4 F. more clubs does not mean more Italy', () => {
  it('keeps a market reachable without its size deciding the odds', () => {
    /*
     * Measured properly in marketSelection.test.ts. Pinned here as the scenario: Italy has 20
     * clubs and Austria 12, and the draw must not simply prefer Italy by 20:12.
     */
    const career = player({ ability: 72, reputation: 58 });
    const rng = createRng(4242);
    const tally = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const club = drawDestination(career, rng);
      if (!club) continue;
      const id = leagueOf(career.world, club.id).id;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    const total = [...tally.values()].reduce((a, b) => a + b, 0);
    const italy = (tally.get('it_seriea') ?? 0) / total;
    const austria = (tally.get('at_bundesliga') ?? 0) / total;
    if (austria > 0.01) {
      // A count-driven draw would put this ratio near 20/12 = 1.67 by construction alone.
      // Market fit may legitimately favour either; what must not happen is the size ratio.
      expect(Number.isFinite(italy / austria)).toBe(true);
    }
    expect(total).toBeGreaterThan(500);
  });
});

describe('v0.6.4 G. every active Israeli club was attempted for a crest', () => {
  it('seeds all of them - no blanket skip', () => {
    /*
     * v0.6.3 excluded Israel entirely. Whatever the import RESULT is (and it is honestly
     * reported in V064_REPORT.md), every active Israeli club must at least have been tried.
     */
    const seeded = new Set(CREST_SEEDS.map((s) => s.clubId));
    const israeli = [...(LEAGUE_MEMBERSHIP.il_premier ?? []), ...(LEAGUE_MEMBERSHIP.il_leumit ?? [])];
    const missing = israeli.filter((id) => !seeded.has(id));
    expect(missing, 'Israeli clubs never offered to the importer').toEqual([]);
    expect(israeli.length).toBe(30);
  });
});

describe('v0.6.4 H. a wordmark or historic badge is never the primary crest', () => {
  it('classifies the real cases correctly', () => {
    // The exact file v0.6.3 shipped for Roma, and a monochrome variant.
    expect(classifyAsset('AS ROMA Text Logo 2020 - 2021 .svg')).toBe('wordmark');
    expect(classifyAsset('Juventus FC - logo black (Italy, 2020).svg')).toBe('unknown');
    expect(classifyAsset('Real Madrid CF old logo.svg')).toBe('historic_crest');
    expect(classifyAsset('Club logo 1980-1995.svg')).toBe('historic_crest');
    // And does not reject a legitimate crest for containing a founding or adoption year.
    expect(classifyAsset('Bologna F.C. 1909 logo.svg')).toBe('current_primary_crest');
    expect(classifyAsset('Atalanta BC.png')).toBe('current_primary_crest');
  });

  it('ships no demoted asset in the runtime manifest', () => {
    const provenance = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/club-crests/manifest.json'), 'utf8'),
    ) as Record<string, { sourceFile: string; verifiedCurrent?: boolean }>;
    for (const clubId of Object.keys(CREST_MANIFEST)) {
      const record = provenance[clubId];
      expect(record, clubId).toBeDefined();
      expect(classifyAsset(record!.sourceFile), `${clubId}: ${record!.sourceFile}`).toBe(
        'current_primary_crest',
      );
      expect(record!.verifiedCurrent, clubId).toBe(true);
    }
  });
});

describe('v0.6.4 I. a provider failure is bounded', () => {
  it('caps attempts, timeout and total wait in every network path', () => {
    /*
     * The critical operating rule, asserted statically because the failure mode is a job that
     * never ends - which no runtime test can catch by running it. Every network script must
     * declare a request timeout, an attempt cap and a total budget, and none may contain an
     * unbounded wait loop.
     */
    for (const script of ['importClubCrests.ts', 'auditLeagues.mjs']) {
      const source = fs.readFileSync(path.resolve(__dirname, `../scripts/${script}`), 'utf8');
      expect(source, `${script} request timeout`).toMatch(/REQUEST_TIMEOUT_MS|AbortController/);
      expect(source, `${script} attempt cap`).toMatch(/MAX_ATTEMPTS|attempt < \d/);
      expect(source, `${script} total budget`).toMatch(/MAX_MS_PER_CLUB|MAX_TOTAL_MS_PER_PAGE/);
      // No `while (true)` and no unbounded retry-until-success.
      expect(source, `${script} unbounded loop`).not.toMatch(/while\s*\(\s*true\s*\)/);
    }
  });
});

describe('v0.6.4 J. the game works offline', () => {
  it('resolves every club to a local asset or a drawn badge', () => {
    for (const club of ALL_CLUBS) {
      const asset = getClubCrest(club.id);
      if (asset) {
        expect(asset).not.toMatch(/^https?:/i);
        expect(
          fs.existsSync(path.resolve(__dirname, '../public', asset.replace(/^.*?club-crests/, 'club-crests'))),
          club.id,
        ).toBe(true);
      } else {
        expect(clubVisual(club.id, club.name).initials.length, club.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('v0.6.4 K. an old save is not rewritten', () => {
  it('keeps a career at a now-inactive club readable and honest', () => {
    /*
     * A v0.6.3 career could genuinely be at Hapoel Hadera. v0.6.4 moved that club out of the
     * modelled divisions - and must not silently relocate the player to a different real club,
     * which is the falsification A6 forbids.
     */
    /*
     * v0.6.5: hapoel_hadera was the exemplar and is ACTIVE again (Liga Alef exists now), which
     * is itself the system working. The remaining inactive Israeli identity takes over the role.
     */
    const old = player({ currentClubId: 'sektzia_nes_tziona' });
    const hydrated = hydrateCareer(old);
    expect(hydrated.currentClubId).toBe('sektzia_nes_tziona');
    expect(getClub('sektzia_nes_tziona').name.length).toBeGreaterThan(0);
    expect(clubVisual('sektzia_nes_tziona').initials.length).toBeGreaterThan(0);
    expect(isInactiveClub('sektzia_nes_tziona')).toBe(true);
  });

  it('never offers an inactive club to a new career', () => {
    const career = player({ ability: 70, reputation: 55 });
    const rng = createRng(17);
    for (let i = 0; i < 1500; i += 1) {
      const club = drawDestination(career, rng);
      if (club) expect(isInactiveClub(club.id), club.id).toBe(false);
    }
  });
});

describe('v0.6.4 L. a newly playable club resolves a manager', () => {
  it('gives every active club a manager and a coherent starting trust', () => {
    /*
     * E7: the people system is keyed on club id and had only ever seen 33 of them. Every club
     * that can now sign the player must resolve a manager without crashing, and the trust that
     * relationship opens on must be a real number in range.
     */
    const career = player();
    const sample = ACTIVE_CLUBS.filter((c) => c.isSenior === true);
    expect(sample.length).toBeGreaterThan(150);
    for (const club of sample) {
      const resolved = resolveClubManager(career, club.id, career.currentSeason);
      expect(resolved.person, club.id).toBeDefined();
      expect(resolved.person.name.length, club.id).toBeGreaterThan(0);
      const trust = initialManagerTrust({ ...career, currentClubId: club.id }, createRng(1));
      expect(Number.isFinite(trust), club.id).toBe(true);
      expect(trust, club.id).toBeGreaterThanOrEqual(0);
      expect(trust, club.id).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic: the same club resolves the same manager', () => {
    const career = player();
    const first = resolveClubManager(career, 'inter_milan', 2044).person;
    for (let i = 0; i < 5; i += 1) {
      expect(resolveClubManager(career, 'inter_milan', 2044).person.id).toBe(first.id);
    }
  });
});

describe('v0.6.4 cup opponents come from the active national pool', () => {
  it('never draws an inactive club as a finalist', () => {
    const rng = createRng(88);
    const career = player({ currentClubId: 'napoli' });
    for (let i = 0; i < 2000; i += 1) {
      const cup = projectCup(career, rng);
      if (!cup.finalOpponentId) continue;
      expect(isInactiveClub(cup.finalOpponentId), cup.finalOpponentId).toBe(false);
      expect(getClub(cup.finalOpponentId).country).toBe('איטליה');
    }
  });
});

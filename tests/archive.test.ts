/**
 * Career Archive (v0.7, Checkpoint C + Scenarios J, K, L).
 *
 * The claim under test: a career no longer disappears when it ends. Retirement freezes a
 * snapshot, the snapshot is idempotent (reopening the retirement screen cannot duplicate it),
 * multiple careers coexist without contaminating each other, and deleting archive history
 * never touches an active run.
 *
 * Storage runs against a minimal in-memory localStorage shim - the repository's own
 * `hasStorage()` check sees a working window.localStorage and behaves exactly as in a browser.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { buildArchivedCareer } from '../src/game/archive';
import { createCareer } from '../src/game/careerEngine';
import type { Career, SeasonRecord, SeasonStats } from '../src/types';

/* ------------------------------------------------------------------ */
/* localStorage shim                                                   */
/* ------------------------------------------------------------------ */

function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
    },
  };
}

beforeEach(() => {
  installLocalStorage();
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

/** Imported lazily so each test suite sees the shimmed window. */
async function repo() {
  const { storage } = await import('../src/services/storage');
  return storage;
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function stats(overrides: Partial<SeasonStats> = {}): SeasonStats {
  return {
    appearances: 30,
    starts: 27,
    goals: 12,
    assists: 5,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 64,
    injuredGames: 0,
    ...overrides,
  };
}

function seniorSeason(season: number, clubId: string, clubName: string): SeasonRecord {
  return {
    season,
    age: 20 + (season - 2040),
    academyStage: 'senior',
    clubId,
    clubName,
    teamName: clubName,
    league: 'ליגת העל',
    leagueId: 'il_premier',
    teamGames: 43,
    onLoan: false,
    stats: stats(),
    ability: 74,
    role: 'starter',
    captain: false,
    olderGroup: 'none',
    trophies: [],
  } as unknown as SeasonRecord;
}

function retiredCareer(seed = 9, name = 'ת', history?: SeasonRecord[]): Career {
  const base = createCareer({ playerName: name, position: 'ST', seed });
  return {
    ...base,
    retired: true,
    age: 35,
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    currentSeason: 2055,
    peakAbility: 84,
    seasonHistory:
      history ??
      [
        seniorSeason(2040, MACCABI_ID, 'מכבי חיפה'),
        seniorSeason(2041, 'borussia_dortmund', 'בורוסיה דורטמונד'),
        seniorSeason(2042, 'napoli', 'נאפולי'),
        seniorSeason(2043, MACCABI_ID, 'מכבי חיפה'),
      ],
  };
}

/* ------------------------------------------------------------------ */
/* The snapshot                                                        */
/* ------------------------------------------------------------------ */

describe('buildArchivedCareer freezes the essentials', () => {
  it('captures identity, axes, journey and seasons', () => {
    const archived = buildArchivedCareer(retiredCareer());
    expect(archived.archiveId).toBeTruthy();
    expect(archived.playerName).toBe('ת');
    expect(archived.seasons).toHaveLength(4);
    expect(archived.totals.seasons).toBe(4);
    expect(typeof archived.globalCareer).toBe('number');
    expect(typeof archived.maccabiLegacy).toBe('number');
    // The archive carries no live engine state.
    expect('rngState' in archived).toBe(false);
    expect('pendingEventIds' in archived).toBe(false);
    expect('world' in archived).toBe(false);
  });

  it('Scenario L: the club journey holds unique clubs, with return spells counted', () => {
    const archived = buildArchivedCareer(retiredCareer());
    // Maccabi, Dortmund, Napoli - three unique clubs despite four season rows.
    expect(archived.clubs).toHaveLength(3);
    const maccabi = archived.clubs.find((c) => c.clubId === MACCABI_ID);
    expect(maccabi?.spells).toBe(2);
    expect(maccabi?.seasons).toBe(2);
    const ids = archived.clubs.map((c) => c.clubId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('counts countries across the journey', () => {
    const archived = buildArchivedCareer(retiredCareer());
    expect(archived.totals.countries).toBeGreaterThanOrEqual(2); // Israel + Germany + Italy
  });
});

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

describe('Scenario J: retirement archives exactly once', () => {
  it('upserts by career id - saving twice leaves one entry', async () => {
    const storage = await repo();
    const career = retiredCareer(11);
    storage.archiveCareer(career);
    storage.archiveCareer(career); // reopening the retirement screen
    const archive = storage.loadArchive();
    expect(archive.filter((a) => a.archiveId === career.id)).toHaveLength(1);
  });

  it('recordFinishedCareer no longer double-counts on reload', async () => {
    const storage = await repo();
    const career = retiredCareer(12);
    const first = storage.recordFinishedCareer(career);
    const second = storage.recordFinishedCareer(career); // the reload path
    expect(first.careersPlayed).toBe(second.careersPlayed);
  });
});

describe('Scenario K: multiple careers coexist without contamination', () => {
  it('keeps three finished careers, each intact', async () => {
    const storage = await repo();
    const a = retiredCareer(21, 'א');
    const b = retiredCareer(22, 'ב');
    const c = retiredCareer(23, 'ג');
    storage.archiveCareer(a);
    storage.archiveCareer(b);
    storage.archiveCareer(c);
    const archive = storage.loadArchive();
    expect(archive).toHaveLength(3);
    expect(new Set(archive.map((x) => x.archiveId)).size).toBe(3);
    expect(archive.map((x) => x.playerName).sort()).toEqual(['א', 'ב', 'ג']);
  });

  it('deleting one career leaves the others and the ACTIVE career untouched', async () => {
    const storage = await repo();
    const active = { ...retiredCareer(31, 'פ'), retired: false };
    storage.saveCareer(active);
    const a = retiredCareer(32, 'א');
    const b = retiredCareer(33, 'ב');
    storage.archiveCareer(a);
    storage.archiveCareer(b);

    storage.deleteArchivedCareer(a.id);
    expect(storage.loadArchive().map((x) => x.archiveId)).toEqual([b.id]);
    // The run in progress is a different key entirely; deleting archives cannot touch it.
    expect(storage.loadCareer()?.id).toBe(active.id);
  });

  it('full meta reset clears archive and meta but never the active career', async () => {
    const storage = await repo();
    const active = { ...retiredCareer(41, 'פ'), retired: false };
    storage.saveCareer(active);
    storage.archiveCareer(retiredCareer(42));
    storage.recordFinishedCareer(retiredCareer(42));

    storage.resetMetaAndArchive();
    expect(storage.loadArchive()).toEqual([]);
    expect(storage.loadMeta().careersPlayed).toBe(0);
    expect(storage.loadCareer()?.id).toBe(active.id);
  });
});

/* ------------------------------------------------------------------ */
/* Meta is display-only                                                */
/* ------------------------------------------------------------------ */

describe('archives are display-only: no gameplay advantage flows back', () => {
  it('a new career created after ten archived ones is identical to one created before', async () => {
    const storage = await repo();
    const before = createCareer({ playerName: 'ח', position: 'CM', seed: 77 });
    for (let i = 0; i < 10; i += 1) storage.archiveCareer(retiredCareer(100 + i, `ק${i}`));
    const after = createCareer({ playerName: 'ח', position: 'CM', seed: 77 });
    expect(after.ability).toBe(before.ability);
    expect(after.hidden.potential).toBe(before.hidden.potential);
    expect(after.rngState).toBe(before.rngState);
  });
});

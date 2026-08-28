/**
 * v0.4.6 Phases 26-27: the table survives a save, and old saves get one.
 *
 * The projection is new state, so there are two ways to get this wrong. A save that round-trips
 * to a *different* table breaks the promise that the season is one continuous thing; a
 * v0.4.5.1 save that crashes, or loses its career memory on the way in, breaks something worse.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { hydrateCareer, SCHEMA_VERSION } from '../src/game/careerEngine';
import {
  buildTable,
  currentLeagueContext,
  currentTable,
  leagueContextFrom,
} from '../src/game/leagueEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, SeasonPhase } from '../src/types';

const PHASES: SeasonPhase[] = ['early', 'mid', 'late', 'end'];

/** What actually happens on save/load: JSON out, JSON in, hydrate. */
function roundTrip(career: Career): Career {
  return hydrateCareer(JSON.parse(JSON.stringify(career)) as Career);
}

/** A mid-career senior save, taken from a real simulated career. */
function seniorSave(seed = 12): Career {
  const career = simulateCareer({ playerName: 'ש', position: 'CM', seed, policy: balancedPolicy });
  return {
    ...career,
    retired: false,
    academyStage: 'senior',
    seasonPoint: 'preseason',
    seasonSlot: 'early',
  };
}

describe('the table survives a save', () => {
  it('redraws the identical table after a round trip', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const before = seniorSave(seed);
      if (!before.world.projection) continue;
      const after = roundTrip(before);
      expect(after.world.projection, `seed ${seed}`).toEqual(before.world.projection);
      for (const phase of PHASES) {
        expect(
          buildTable(after.world, after.world.projection!, phase),
          `seed ${seed} ${phase}`,
        ).toEqual(buildTable(before.world, before.world.projection!, phase));
      }
    }
  });

  it('keeps the same league context, so events stay eligible across a reload', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const before = seniorSave(seed);
      if (!before.world.projection) continue;
      const after = roundTrip(before);
      for (const phase of PHASES) {
        expect(
          leagueContextFrom(after.world, after.world.projection!, phase),
          `seed ${seed} ${phase}`,
        ).toEqual(leagueContextFrom(before.world, before.world.projection!, phase));
      }
    }
  });

  it('keeps Maccabi’s parallel season across a reload', () => {
    const before = { ...seniorSave(5), currentClubId: 'hapoel_tel_aviv' };
    const after = roundTrip(before);
    expect(after.world.maccabiProjection).toEqual(before.world.maccabiProjection);
  });
});

describe('a save from before v0.4.6', () => {
  /** Strips the fields v0.4.6 added, which is exactly what a v0.4.5.1 save looks like. */
  function oldSave(seed = 9): Career {
    const career = seniorSave(seed);
    const world = { ...career.world };
    delete (world as { projection?: unknown }).projection;
    delete (world as { maccabiProjection?: unknown }).maccabiProjection;
    return { ...career, world };
  }

  it('loads without crashing', () => {
    expect(() => roundTrip(oldSave())).not.toThrow();
  });

  it('is given a table rather than left with a blank season', () => {
    const loaded = roundTrip(oldSave());
    expect(loaded.world.projection).toBeTruthy();
    expect(currentTable(loaded)?.rows.length).toBeGreaterThan(0);
    expect(currentLeagueContext(loaded)).not.toBeNull();
  });

  it('migrates deterministically, so loading twice gives the same season', () => {
    const save = oldSave(14);
    expect(roundTrip(save).world.projection).toEqual(roundTrip(save).world.projection);
  });

  it('does not advance the career’s RNG to do it', () => {
    /*
     * Consuming a draw during migration would change every subsequent event in a career made
     * before this code existed - a far worse thing to do to someone's save than a missing table.
     */
    const save = oldSave(3);
    expect(roundTrip(save).rngState).toBe(save.rngState);
  });

  it('does not touch career memory, milestones or season history', () => {
    const save = oldSave(7);
    const loaded = roundTrip(save);
    expect(loaded.memories).toEqual(save.memories);
    expect(loaded.milestones).toEqual(save.milestones);
    expect(loaded.seasonHistory).toEqual(save.seasonHistory);
    expect(loaded.world.clubSeasons).toEqual(save.world.clubSeasons);
  });

  it('gives Maccabi a parallel season when the player is elsewhere', () => {
    const away = { ...oldSave(2), currentClubId: 'bnei_sakhnin' };
    expect(roundTrip(away).world.maccabiProjection).toBeTruthy();
  });

  it('does not give an academy player a league table', () => {
    // An age group is not a league campaign, and migration must not invent one.
    const boy: Career = {
      ...oldSave(4),
      academyStage: 'children_a',
      currentClubId: 'maccabi_academy',
    };
    const loaded = roundTrip(boy);
    expect(loaded.world.projection ?? null).toBeNull();
    expect(currentTable(loaded)).toBeNull();
  });

  it('does not project a season for a retired career', () => {
    const done = { ...oldSave(6), retired: true };
    expect(roundTrip(done).world.projection ?? null).toBeNull();
  });
});

describe('the save schema did not break', () => {
  it('is still version 4, so v0.4.5.1 saves are migrated and not discarded', () => {
    /*
     * This matters more than it looks. `loadCareer` treats a save whose schemaVersion differs
     * from SCHEMA_VERSION as *stale* and deletes it. Everything v0.4.6 added is optional -
     * world.projection, world.maccabiProjection, ClubSeasonResult.finalPosition,
     * EventOutcome.preview, two MemoryKinds - so a bump would have thrown away every existing
     * career for no reason at all.
     */
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('loads a save that predates every v0.4.6 field', () => {
    const career = seniorSave(11);
    const world = { ...career.world };
    delete (world as { projection?: unknown }).projection;
    delete (world as { maccabiProjection?: unknown }).maccabiProjection;
    const stripped: Career = {
      ...career,
      world: {
        ...world,
        // Pre-v0.4.6 club seasons carry no finishing position.
        clubSeasons: world.clubSeasons.map((s) => {
          const copy = { ...s };
          delete (copy as { finalPosition?: unknown }).finalPosition;
          return copy;
        }),
      },
    };

    const loaded = roundTrip(stripped);
    expect(loaded.seasonHistory).toEqual(stripped.seasonHistory);
    expect(loaded.memories).toEqual(stripped.memories);
    // The old results keep their outcome; only new seasons get a position.
    expect(loaded.world.clubSeasons.every((s) => s.outcome !== undefined)).toBe(true);
    expect(loaded.world.projection).toBeTruthy();
  });
});

describe('the player’s own club is always in its own table', () => {
  it('appears exactly once, at its stated position', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const career = seniorSave(seed);
      const table = currentTable(career);
      const context = currentLeagueContext(career);
      if (!table || !context) continue;
      const mine = table.rows.filter((r) => r.clubId === career.currentClubId);
      expect(mine, `seed ${seed}`).toHaveLength(1);
      expect(mine[0]?.position).toBe(context.position);
    }
  });

  it('shows Maccabi in the same table when the player is there', () => {
    const atMaccabi = { ...seniorSave(1), currentClubId: MACCABI_ID };
    const table = currentTable(atMaccabi);
    if (!table) return;
    expect(table.rows.some((r) => r.clubId === MACCABI_ID)).toBe(true);
  });
});

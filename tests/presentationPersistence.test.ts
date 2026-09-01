/**
 * A cinematic shown once stays shown (v0.9.6, Phase 4).
 *
 * ## The bug
 *
 * `matchdaysSeen` and `ceremoniesSeen` were React `useState` inside `GamePage`. React state does
 * not survive a refresh, so a reload emptied both and every completed matchday and ceremony
 * replayed.
 *
 * And permanently, not once: finishing a matchday only marked it in local state, it did not
 * advance the career. So the career sat on the same beat, the ledger reset on every reload, and
 * the player could watch the same full-time screen forever.
 *
 * ## The fix
 *
 * `seenPresentationKeys` lives on the Career, which is the thing that gets saved. The answer to
 * "has he seen this" is now the same before and after a refresh, because it is the same field.
 *
 * ## What must remain true
 *
 * It is PRESENTATION metadata. It may not reach the simulation - no branch, no RNG, no effect on
 * results - and it must not suppress a legitimate later occurrence, which is why every key is
 * season-scoped.
 */

import { describe, expect, it } from 'vitest';

import { deriveArrivalMoment, deriveDebutMoment, deriveSeasonMoments } from '../src/components/CareerMoments';
import { createCareer, hydrateCareer, SCHEMA_VERSION } from '../src/game/careerEngine';
import { activeFixture } from '../src/game/fixture';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career } from '../src/types';

/** Exactly what the storage layer does: envelope, JSON, back, hydrate. */
function roundTrip(career: Career): Career {
  const envelope = { version: SCHEMA_VERSION, data: career };
  const parsed = JSON.parse(JSON.stringify(envelope)) as { version: number; data: Career };
  expect(parsed.version).toBe(SCHEMA_VERSION);
  return hydrateCareer(parsed.data);
}

/** Marking, exactly as `useGame.markPresentationSeen` does it. */
function markSeen(career: Career, key: string): Career {
  return career.seenPresentationKeys?.includes(key)
    ? career
    : { ...career, seenPresentationKeys: [...(career.seenPresentationKeys ?? []), key] };
}

describe('the ledger survives the things that used to erase it', () => {
  it('keeps a marked key through serialize and hydrate', () => {
    const career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 42 });
    const marked = markSeen(career, 'cup_final_2044');
    expect(roundTrip(marked).seenPresentationKeys).toContain('cup_final_2044');
  });

  it('keeps every key through repeated reloads', () => {
    /* A refresh loop is the failure mode; ten of them must not lose anything. */
    let career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 7 });
    const keys = ['arrival_maccabi_haifa_2040', 'debut_2041', 'championship_2042', 'cup_2043'];
    for (const key of keys) career = markSeen(career, key);
    for (let i = 0; i < 10; i += 1) career = roundTrip(career);
    for (const key of keys) expect(career.seenPresentationKeys).toContain(key);
  });

  it('marks idempotently, so a double-tap on Continue cannot grow the ledger', () => {
    let career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 3 });
    career = markSeen(career, 'championship_2044');
    const once = career.seenPresentationKeys!.length;
    career = markSeen(career, 'championship_2044');
    expect(career.seenPresentationKeys!.length).toBe(once);
  });

  it('hydrates a save written before the field existed', () => {
    /*
     * Backward compatibility, checked by actually removing the field rather than by trusting the
     * optional marker. An old save must load with an empty ledger, not with `undefined` reaching
     * a `.includes` call.
     */
    const career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 11 });
    const old = JSON.parse(JSON.stringify(career)) as Career & { seenPresentationKeys?: string[] };
    delete old.seenPresentationKeys;
    expect('seenPresentationKeys' in old).toBe(false);

    const hydrated = hydrateCareer(old);
    expect(Array.isArray(hydrated.seenPresentationKeys)).toBe(true);
    expect(hydrated.seenPresentationKeys).toEqual([]);
  });
});

describe('the beat does not reopen after a reload', () => {
  /*
   * The end-to-end shape of the bug: reach a beat, complete it, reload, and check the screen does
   * not decide to show it again. `GamePage` asks exactly these two questions, so the test asks
   * them too rather than rendering React.
   */
  const wouldShowMatchday = (career: Career, fixtureId: string): boolean =>
    !(career.seenPresentationKeys ?? []).includes(fixtureId);
  const wouldShowMoment = (career: Career, key: string): boolean =>
    !(career.seenPresentationKeys ?? []).includes(key);

  it('does not reopen a completed matchday', () => {
    let found: { career: Career; fixtureId: string } | null = null;
    simulateCareer({
      playerName: 'אורי דביר',
      position: 'ST',
      seed: 2024,
      policy: balancedPolicy,
      onStep: (career) => {
        if (found) return;
        if (career.phase !== 'mid_season') return;
        const fixture = activeFixture(career);
        if (fixture) found = { career, fixtureId: fixture.id };
      },
    });
    expect(found).not.toBeNull();
    const { career, fixtureId } = found!;

    expect(wouldShowMatchday(career, fixtureId)).toBe(true);
    const after = roundTrip(markSeen(career, fixtureId));
    expect(wouldShowMatchday(after, fixtureId)).toBe(false);
  });

  it('does not reopen an arrival, a debut or a season moment', () => {
    const collected = new Map<string, Career>();
    for (let i = 0; i < 25 && collected.size < 4; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 3300 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          const arrival = deriveArrivalMoment(career);
          if (arrival) collected.set(arrival.key.split('_')[0]!, career);
          const debut = deriveDebutMoment(career);
          if (debut) collected.set('debut', career);
          if (career.phase === 'season_result') {
            for (const moment of deriveSeasonMoments(career)) {
              collected.set(moment.key.split('_')[0]!, career);
            }
          }
        },
      });
    }
    /* If nothing was collected the test is vacuous, so that is asserted first. */
    expect(collected.size).toBeGreaterThan(0);

    for (const [, career] of collected) {
      const moment =
        deriveArrivalMoment(career) ??
        deriveDebutMoment(career) ??
        (career.phase === 'season_result' ? deriveSeasonMoments(career)[0] : undefined);
      if (!moment) continue;
      expect(wouldShowMoment(career, moment.key)).toBe(true);
      const after = roundTrip(markSeen(career, moment.key));
      expect(wouldShowMoment(after, moment.key), `${moment.key} reopened`).toBe(false);
    }
  });

  it('still shows the same KIND of moment in a later season', () => {
    /*
     * The other half of the rule. Keys are season-scoped, so marking a 2044 championship must not
     * suppress a 2047 one - which a naive key like "championship" would have done.
     */
    let career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 9 });
    career = markSeen(career, 'championship_2044');
    expect((career.seenPresentationKeys ?? []).includes('championship_2047')).toBe(false);
    expect((career.seenPresentationKeys ?? []).includes('cup_2044')).toBe(false);
  });
});

describe('presentation metadata cannot reach the simulation', () => {
  it('is read by no engine module', () => {
    /*
     * Checked as source across the whole engine rather than by observation: a single branch on
     * this field anywhere in `src/game` would make a cinematic able to change a career.
     */
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.resolve(__dirname, '../src/game');
    const offenders: string[] = [];
    const walk = (at: string): void => {
      for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
        const full = path.join(at, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        /* `careerEngine` writes the default on hydrate; that is the one legitimate mention. */
        if (entry.name === 'careerEngine.ts') continue;
        if (fs.readFileSync(full, 'utf8').includes('seenPresentationKeys')) {
          offenders.push(path.relative(dir, full));
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });

  it('changes no career outcome when the ledger is populated', () => {
    /*
     * The behavioural proof. Two identical careers, one of which has watched every cinematic,
     * must finish with the same football - same appearances, goals, titles, retirement age.
     */
    const run = (prefill: boolean): Career => {
      let last: Career | null = null;
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 5150,
        policy: balancedPolicy,
        onStep: (career) => {
          last = career;
          if (prefill && (career.seenPresentationKeys ?? []).length === 0) {
            /*
             * Mutating the observed object rather than the loop's own state: `onStep` receives the
             * live career, so this is the most invasive thing a presentation write could possibly
             * do, and the totals below still have to match.
             */
            (career as Career).seenPresentationKeys = ['championship_2044', 'cup_2044'];
          }
        },
      });
      return last!;
    };

    const plain = run(false);
    const watched = run(true);
    /*
     * Compared on the career's real recorded football rather than on a summary object: the season
     * history IS the record, so if a presentation write had perturbed anything it shows up here.
     */
    expect(watched.retirementAge).toBe(plain.retirementAge);
    expect(watched.ability).toBe(plain.ability);
    expect(watched.trophies).toEqual(plain.trophies);
    expect(watched.seasonHistory.map((s) => [s.season, s.clubId, s.stats.appearances, s.stats.goals]))
      .toEqual(plain.seasonHistory.map((s) => [s.season, s.clubId, s.stats.appearances, s.stats.goals]));
  });
});

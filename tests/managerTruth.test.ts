/**
 * One manager truth (v0.5.2).
 *
 * Two coherence guarantees, each of which had a real hole in v0.5.1:
 *
 *   TRUST LIFECYCLE  the number a departing manager's history remembers is the number the
 *                    relationship actually ended on - not one produced by a preseason he never
 *                    coached.
 *   DESTINATION      the manager the transfer preview promises is the manager who is waiting
 *                    after signing. One resolution, used by both.
 */

import { describe, expect, it } from 'vitest';

import { getClub, MACCABI_ID } from '../src/data/clubs';
import { beginSeason, createCareer } from '../src/game/careerEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { offerHints } from '../src/game/marketEngine';
import {
  clubManagerArchetype,
  endManagerTenure,
  initialManagerTrust,
  installManager,
  replaceManager,
  resolveClubManager,
} from '../src/game/peopleEngine';
import { driftTrustTowardsBaseline, maybeChangeCoach, moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { generateOffers } from '../src/game/transferEngine';
import type { Career, ManagerArchetypeId } from '../src/types';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function seniorAt(clubId: string, seed = 7): Career {
  const base = createCareer({ playerName: 'ת', position: 'CM', seed });
  const senior: Career = {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 24,
    ability: 68,
    reputation: 52,
  };
  return installManager(endManagerTenure(senior, true));
}

function withArchetype(career: Career, archetypeId: ManagerArchetypeId): Career {
  const manager = career.people!.manager!;
  return {
    ...career,
    people: {
      ...career.people!,
      manager: { ...manager, person: { ...manager.person, archetypeId } },
    },
  };
}

/* ================================================================== */
/* ISSUE 1 — manager trust lifecycle                                   */
/* ================================================================== */

describe('v0.5.2 A. a departing manager is remembered at the trust he left on', () => {
  it('snapshots the exact value, with no preseason drift applied first', () => {
    /*
     * The v0.5.1 hole. `beginSeason` drifted trust and only THEN asked whether the manager was
     * leaving, so the number filed in his history included a preseason for a season he never
     * coached. Here trust 87 sits well above where a drift would leave it, so any drift is
     * visible in the recorded value.
     */
    const before: Career = { ...withArchetype(seniorAt(MACCABI_ID, 5), 'youth_believer'), coachTrust: 87 };
    expect(driftTrustTowardsBaseline(before, 0.3).coachTrust).not.toBe(87); // drift would move it

    const after = replaceManager(before, createRng(5));
    const closed = after.people!.managerHistory.at(-1)!;

    expect(closed.finalTrust).toBe(87);
    expect(closed.person.archetypeId).toBe('youth_believer');
  });

  it('does it through the real season loop, not just the helper', () => {
    let changed = 0;
    for (let seed = 1; seed <= 400 && changed < 6; seed += 1) {
      const before: Career = { ...seniorAt(MACCABI_ID, seed), coachTrust: 87, phase: 'preseason' };
      const after = beginSeason(before);
      if (!after.newCoachThisSeason) continue;
      changed += 1;

      const closed = after.people!.managerHistory.at(-1)!;
      expect(closed.finalTrust, `seed ${seed}`).toBe(87);
    }
    expect(changed, 'no manager change occurred in 400 seeds').toBeGreaterThan(0);
  });

  it('never mutates a closed tenure afterwards', () => {
    let career: Career = { ...seniorAt(MACCABI_ID, 3), coachTrust: 87, phase: 'preseason' };
    career = replaceManager(career, createRng(3));
    const closed = career.people!.managerHistory.at(-1)!;
    const recordedId = closed.person.id;
    const recordedTrust = closed.finalTrust;

    // Play on for several seasons; the history entry must be frozen.
    for (let i = 0; i < 6; i += 1) {
      career = { ...career, phase: 'preseason' };
      career = beginSeason(career);
    }
    const still = career.people!.managerHistory.find((t) => t.person.id === recordedId);
    expect(still?.finalTrust).toBe(recordedTrust);
  });
});

describe('v0.5.2 B. a manager who stays still gets his drift', () => {
  it('drifts trust when there is no change - the fix did not disable recovery', () => {
    /*
     * The obvious way to get Test A wrong is to stop drifting altogether. A frozen-out player
     * whose manager stays must still be pulled back toward what his ability deserves.
     */
    let drifted = 0;
    for (let seed = 1; seed <= 200 && drifted < 5; seed += 1) {
      const before: Career = { ...seniorAt(MACCABI_ID, seed), coachTrust: 12, phase: 'preseason' };
      const after = beginSeason(before);
      if (after.newCoachThisSeason) continue;
      drifted += 1;
      expect(after.coachTrust, `seed ${seed}`).toBeGreaterThan(12);
    }
    expect(drifted, 'no staying-manager season found').toBeGreaterThan(0);
  });

  it('applies that drift exactly once (Scenario H)', () => {
    const before: Career = { ...seniorAt(MACCABI_ID, 21), coachTrust: 20, phase: 'preseason' };
    const stays = maybeChangeCoach(before, createRng(21));
    if (stays.changed) return; // this seed changes manager; the other test covers that path

    const once = driftTrustTowardsBaseline(before, 0.3).coachTrust;
    const twice = driftTrustTowardsBaseline(driftTrustTowardsBaseline(before, 0.3), 0.3).coachTrust;
    expect(once).not.toBeCloseTo(twice, 3); // the two are distinguishable...

    const after = beginSeason(before);
    // ...and the season loop lands on the single-drift value, not the double.
    expect(after.coachTrust).toBeCloseTo(once, 3);
  });
});

describe('v0.5.2 the successor derives his own opinion', () => {
  it('uses the new archetype, and cannot inherit the old one', () => {
    const base: Career = { ...seniorAt(MACCABI_ID, 9), coachTrust: 87, age: 19 };
    const believer = withArchetype(installManager(endManagerTenure(base, false)), 'youth_believer');
    const conservative = withArchetype(installManager(endManagerTenure(base, false)), 'conservative');
    expect(initialManagerTrust(believer, createRng(1))).toBeGreaterThan(
      initialManagerTrust(conservative, createRng(1)),
    );
  });

  it('does not simply carry 87 across', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const before: Career = { ...seniorAt(MACCABI_ID, seed), coachTrust: 87 };
      expect(replaceManager(before, createRng(seed)).coachTrust, `seed ${seed}`).not.toBe(87);
    }
  });
});

/* ================================================================== */
/* ISSUE 2 — destination manager truth                                 */
/* ================================================================== */

describe('v0.5.2 C-E. the preview is the manager who is actually there', () => {
  it('C. first-time club: preview matches arrival', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = seniorAt(MACCABI_ID, seed);
      const preview = resolveClubManager(career, 'az_alkmaar', career.currentSeason);
      expect(preview.source).toBe('new');

      const arrived = moveToClub(career, 'az_alkmaar');
      expect(arrived.people!.manager!.person.id, `seed ${seed}`).toBe(preview.person.id);
      expect(arrived.people!.manager!.person.archetypeId).toBe(preview.person.archetypeId);
      expect(arrived.people!.manager!.person.name).toBe(preview.person.name);
    }
  });

  it('D. short return: preview and arrival agree, whichever way continuity falls', () => {
    let remembered = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const career = seniorAt(MACCABI_ID, seed);
      const away = moveToClub(career, 'az_alkmaar');
      const later: Career = { ...away, currentSeason: away.currentSeason + 1 };

      const preview = resolveClubManager(later, MACCABI_ID, later.currentSeason);
      const back = moveToClub(later, MACCABI_ID);

      expect(back.people!.manager!.person.id, `seed ${seed}`).toBe(preview.person.id);
      if (preview.source === 'remembered') remembered += 1;
    }
    // A one-season absence usually keeps the same man - the point of the short-return case.
    expect(remembered).toBeGreaterThan(40);
  });

  it('E. long return: the preview shows the successor, not the old manager', () => {
    let successors = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const career = seniorAt(MACCABI_ID, seed);
      const original = career.people!.manager!.person.id;
      const away = moveToClub(career, 'az_alkmaar');
      const later: Career = { ...away, currentSeason: away.currentSeason + 10 };

      const preview = resolveClubManager(later, MACCABI_ID, later.currentSeason);
      const back = moveToClub(later, MACCABI_ID);

      expect(back.people!.manager!.person.id, `seed ${seed}`).toBe(preview.person.id);
      if (preview.source === 'successor') {
        successors += 1;
        expect(preview.person.id).not.toBe(original);
        expect(preview.previousManagerId).toBe(original);
        expect(preview.turnoverOccurred).toBe(true);
      }
    }
    // After a decade the old manager is rarely still there.
    expect(successors).toBeGreaterThan(60);
  });
});

describe('v0.5.2 F/G. previewing changes nothing', () => {
  it('G. is completely side-effect free', () => {
    const career = seniorAt(MACCABI_ID, 11);
    const snapshot = JSON.stringify(career);

    for (let i = 0; i < 20; i += 1) {
      resolveClubManager(career, 'az_alkmaar', career.currentSeason);
      resolveClubManager(career, 'union_sg', career.currentSeason);
      clubManagerArchetype(career, 'az_alkmaar');
      offerHints(career, getClub('az_alkmaar'), 'starter', career.currentSeason);
    }

    // Not one byte of the career moved: no rngState, no clubManagers, no memories, no trust.
    expect(JSON.stringify(career)).toBe(snapshot);
  });

  it('G. rejecting an offer leaves the destination untouched', () => {
    const career = seniorAt(MACCABI_ID, 13);
    const before = JSON.stringify(career.people);
    resolveClubManager(career, 'az_alkmaar', career.currentSeason);
    expect(JSON.stringify(career.people)).toBe(before);
    expect(career.people!.clubManagers['az_alkmaar']).toBeUndefined();
  });

  it('F. the same offer cannot silently change manager when unrelated RNG advances', () => {
    /*
     * A club manager's identity is derived from (seed, club, slot) and nothing else - crucially
     * NOT from `personSeq`, which changes whenever the player signs an agent or a specialist.
     * If it did, previewing an offer and then signing an agent before accepting would swap the
     * man waiting at the other end.
     */
    const career = seniorAt(MACCABI_ID, 17);
    const preview = resolveClubManager(career, 'union_sg', career.currentSeason);

    // Burn career RNG and add people, exactly as ordinary play would between offer and decision.
    const rng = createRng(career.rngState);
    for (let i = 0; i < 50; i += 1) rng.chance(0.5);
    const busy: Career = {
      ...career,
      rngState: rng.getState(),
      people: { ...career.people!, personSeq: career.people!.personSeq + 4 },
    };

    const again = resolveClubManager(busy, 'union_sg', busy.currentSeason);
    expect(again.person.id).toBe(preview.person.id);
    expect(again.person.name).toBe(preview.person.name);
    expect(again.person.archetypeId).toBe(preview.person.archetypeId);

    const arrived = moveToClub(busy, 'union_sg');
    expect(arrived.people!.manager!.person.id).toBe(preview.person.id);
  });

  it('is deterministic across repeated calls', () => {
    const career = seniorAt(MACCABI_ID, 19);
    const a = resolveClubManager(career, 'az_alkmaar', career.currentSeason);
    const b = resolveClubManager(career, 'az_alkmaar', career.currentSeason);
    expect(b).toEqual(a);
  });
});

describe('v0.5.2 J. the hint, the advice and the arrival share one truth', () => {
  it('offer hints describe the manager who will actually be there', () => {
    const HINTS: Record<string, string> = {
      youth_believer: 'מאמן: מאמין בצעירים',
      star_driven: 'מאמן: מעדיף שחקנים מוכחים',
      conservative: 'מאמן: אמון נבנה אצלו לאט',
      rotation: 'מאמן: מסובב את הסגל',
    };

    let checked = 0;
    for (let seed = 1; seed <= 120 && checked < 25; seed += 1) {
      // A career that has been somewhere and come back is where the two used to disagree.
      const career = seniorAt(MACCABI_ID, seed);
      const away = moveToClub(career, 'az_alkmaar');
      const later: Career = { ...away, currentSeason: away.currentSeason + 6 };

      const offers = generateOffers(later, createRng(seed));
      const home = offers.find((o) => o.clubId === MACCABI_ID);
      if (!home) continue;
      checked += 1;

      const resolved = resolveClubManager(later, MACCABI_ID, later.currentSeason);
      const expectedHint = HINTS[resolved.person.archetypeId];
      const shownHint = home.hints?.find((h) => h.startsWith('מאמן:'));

      if (shownHint) {
        expect(shownHint, `seed ${seed}`).toBe(expectedHint);
      }

      // ...and the man who greets him is that man.
      const arrived = moveToClub(later, MACCABI_ID);
      expect(arrived.people!.manager!.person.archetypeId).toBe(resolved.person.archetypeId);
      expect(validateCareerIntegrity(arrived)).toEqual([]);
    }
    expect(checked, 'no homecoming offer generated to check').toBeGreaterThan(0);
  });
});

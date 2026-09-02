/**
 * A cup final is played against someone who could actually be in that cup (v0.9.6, Phase 7).
 *
 * ## The two halves of this bug
 *
 * v0.9.5.1 fixed the IDENTITY half: `drawFinalOpponent` filtered with `club.id !== own.id`, so a
 * youth side could draw its own senior parent - and since both render as "מכבי חיפה", the game
 * showed a club playing itself.
 *
 * It left the AGE half, and recorded it as a known limitation. The pool excluded academy and youth
 * tiers UNCONDITIONALLY, so a youth cup final was drawn from senior first teams: Maccabi Haifa's
 * under-19s against a top-flight senior club, in a competition called the Youth Cup.
 *
 * ## The honest answer
 *
 * The world contains exactly two academy/youth clubs - `maccabi_academy` and `maccabi_youth` - and
 * both carry Maccabi Haifa's football identity. So for a youth cup there is genuinely no opponent
 * to name, and the fix is to name none rather than to substitute a senior club. The cup RUN is
 * decided separately and is unaffected; only the fixture goes unnamed.
 *
 * ## Determinism
 *
 * The draw is taken before the pool is inspected, so consumption is exactly one value whatever the
 * competition. An early return on an empty pool would have made the size of a candidate list shift
 * every later roll in the career.
 */

import { describe, expect, it } from 'vitest';

import { ACTIVE_CLUBS, MACCABI_ACADEMY_ID, MACCABI_ID, MACCABI_YOUTH_ID } from '../src/data/clubs';
import { sameFootballIdentity } from '../src/data/clubVisuals';
import { getClub } from '../src/data/clubs';
import { knownCupFinal } from '../src/game/fixture';
import { ambitiousPolicy, balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career } from '../src/types';

const isAgeGroupClub = (id: string): boolean => {
  const tier = getClub(id).tier;
  return tier === 'academy' || tier === 'youth';
};

describe('the world has no age-appropriate youth cup opponent, and says so', () => {
  it('contains exactly two academy/youth clubs, both Maccabi Haifa', () => {
    /*
     * The fact the fix rests on, asserted so that adding a real youth league later FAILS here and
     * whoever adds it revisits this decision rather than inheriting it.
     */
    const ageGroup = ACTIVE_CLUBS.filter((club) => club.tier === 'academy' || club.tier === 'youth');
    expect(ageGroup.map((club) => club.id).sort()).toEqual(
      [MACCABI_ACADEMY_ID, MACCABI_YOUTH_ID].sort(),
    );
    for (const club of ageGroup) {
      expect(sameFootballIdentity(club.id, MACCABI_ID), `${club.id}`).toBe(true);
    }
  });
});

describe('no cup final pairs a youth side with a senior club', () => {
  it('never names a senior opponent in an age-group cup, across real careers', () => {
    const violations: string[] = [];
    let youthCups = 0;
    let seniorCups = 0;

    for (let i = 0; i < 60; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 12000 + i,
        policy: balancedPolicy,
        onStep: (career: Career) => {
          const cup = career.world.cup;
          if (!cup || cup.season !== career.currentSeason) return;
          /*
           * The cup record carries the club it belongs to, and that is the authority - NOT
           * `career.currentClubId`. The first version of this test compared against the current
           * club and reported "maccabi_academy vs maccabi_academy": the player had moved up to the
           * senior side, so the cup was the academy's while the career had moved on. The pairing
           * was correct; the question was wrong.
           */
          const owner = cup.clubId;
          const ageGroup = isAgeGroupClub(owner);
          if (ageGroup) youthCups += 1;
          else seniorCups += 1;

          if (!cup.finalOpponentId) return;

          /* Never itself, at any age. */
          if (sameFootballIdentity(cup.finalOpponentId, owner)) {
            violations.push(`self: ${owner} vs ${cup.finalOpponentId}`);
          }
          /* And never across the age divide, in either direction. */
          if (ageGroup && !isAgeGroupClub(cup.finalOpponentId)) {
            violations.push(`youth cup vs senior club: ${cup.finalOpponentId}`);
          }
          if (!ageGroup && isAgeGroupClub(cup.finalOpponentId)) {
            violations.push(`senior cup vs age-group club: ${cup.finalOpponentId}`);
          }
        },
      });
    }

    /* Both kinds of cup must actually have occurred, or this proves nothing. */
    expect(youthCups, 'no youth cup was reached').toBeGreaterThan(0);
    expect(seniorCups, 'no senior cup was reached').toBeGreaterThan(0);
    expect([...new Set(violations)]).toEqual([]);
  });

  it('offers no cup-final fixture when no opponent could be named', () => {
    /*
     * The presentation consequence, checked rather than assumed: an unnamed final must not become
     * a fixture against nobody. `knownCupFinal` already required `finalOpponentId`, so this pins
     * that behaviour against a future change.
     */
    let checked = 0;
    for (let i = 0; i < 30; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 13000 + i,
        policy: balancedPolicy,
        onStep: (career: Career) => {
          const cup = career.world.cup;
          if (!cup || cup.season !== career.currentSeason || cup.finalOpponentId) return;
          checked += 1;
          expect(knownCupFinal(career)).toBeNull();
        },
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('leaves the senior cup exactly as it was', () => {
    /*
     * The regression guard for the other side of the branch. A senior player's pool is still
     * every active senior club of his country, minus his own identity - unchanged behaviour.
     */
    let seniorFinals = 0;
    for (let i = 0; i < 25; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 14000 + i,
        policy: balancedPolicy,
        onStep: (career: Career) => {
          const cup = career.world.cup;
          /* Judged against the cup's OWN club, for the reason recorded above. */
          if (!cup?.finalOpponentId || isAgeGroupClub(cup.clubId)) return;
          seniorFinals += 1;
          expect(getClub(cup.finalOpponentId).country).toBe(getClub(cup.clubId).country);
          expect(isAgeGroupClub(cup.finalOpponentId)).toBe(false);
        },
      });
    }
    expect(seniorFinals).toBeGreaterThan(10);
  });
});

describe('the pool change did not move the simulation', () => {
  it('consumes exactly one draw whether or not an opponent is found', () => {
    /*
     * The determinism guard, checked as source because the alternative - an early return on an
     * empty pool - is invisible in output until a career silently diverges. `roll` must be taken
     * before the emptiness check.
     */
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../src/game/cupEngine.ts'), 'utf8');
    const fn = source.slice(source.indexOf('function drawFinalOpponent'));
    const body = fn.slice(0, fn.indexOf('\n}'));

    const rollAt = body.indexOf('const roll = rng.next();');
    const emptyAt = body.indexOf('if (candidates.length === 0)');
    expect(rollAt).toBeGreaterThan(-1);
    expect(emptyAt).toBeGreaterThan(-1);
    expect(rollAt, 'the draw must be taken before the pool is inspected').toBeLessThan(emptyAt);
    /* And exactly one draw, not two. */
    expect((body.match(/rng\.next\(\)/g) ?? []).length).toBe(1);
  });

  it('gives the same career twice from the same seed', () => {
    const run = (): unknown => {
      let last: Career | null = null;
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 5,
        policy: balancedPolicy,
        onStep: (career) => {
          last = career;
        },
      });
      const c = last!;
      return {
        age: c.retirementAge,
        ability: c.ability,
        trophies: c.trophies.length,
        seasons: c.seasonHistory.map((s) => [s.season, s.clubId, s.stats.appearances]),
      };
    };
    expect(run()).toEqual(run());
  });
});

describe('a transfer offer is never to the club he already plays for', () => {
  it('never offers a release destination that is his own club', () => {
    /*
     * Found by the RC audit at 240 careers (2 occurrences), invisible at 60.
     *
     * The release destination pool excluded Maccabi and nothing else, so a senior starved of
     * minutes could be handed an offer naming the club he already played for - "they are willing
     * to give you a stage", about his own team. Rare enough never to have been noticed, common
     * enough that a beta tester would eventually see it.
     */
    const offenders: string[] = [];
    let offers = 0;
    for (let i = 0; i < 120; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: (['GK', 'CB', 'CM', 'ST'] as const)[i % 4]!,
        seed: 20000 + i,
        policy: i % 2 === 0 ? balancedPolicy : ambitiousPolicy,
        onStep: (career: Career) => {
          for (const offer of career.pendingOffers) {
            offers += 1;
            /*
             * `contract` and `promotion` are legitimately from his own identity - a renewal, and
             * the academy-to-senior step inside one club. Every other kind means MOVING, and
             * moving to where you already are is not a thing.
             */
            if (offer.kind === 'contract' || offer.kind === 'promotion') continue;
            if (sameFootballIdentity(offer.clubId, career.currentClubId)) {
              offenders.push(`${offer.kind}: ${career.currentClubId} -> ${offer.clubId}`);
            }
          }
        },
      });
    }
    expect(offers, 'no offers were generated, so this proves nothing').toBeGreaterThan(500);
    expect([...new Set(offenders)]).toEqual([]);
  });
});

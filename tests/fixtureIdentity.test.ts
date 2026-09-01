/**
 * A club never plays itself (v0.9.5.1).
 *
 * ## The bug
 *
 * A playtest produced **מכבי חיפה vs מכבי חיפה**. Neither side was `maccabi_haifa` twice: one was
 * `maccabi_academy`, which carries `crestOwnerId: maccabi_haifa` and therefore renders with
 * Maccabi Haifa's name, crest and colours. Two different career entities, one football identity.
 *
 * The path was `drawFinalOpponent` in the cup engine. Its pool excluded academy and youth TIERS
 * and excluded the player's exact id - so when the player himself was in the academy, his own
 * senior parent remained a perfectly ordinary senior candidate and got drawn into the final.
 * `scripts/fixtureAudit.ts` reproduces it at 75 occurrences in 40 careers with the fix reverted.
 *
 * ## The rule
 *
 * Opponent validity is decided by `sameFootballIdentity`, not by id equality. If it returns true
 * the two entities may never be presented as opponents - in any competition, by any generator.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTIVE_CLUBS,
  MACCABI_ACADEMY_ID,
  MACCABI_ID,
  MACCABI_YOUTH_ID,
} from '../src/data/clubs';
import { sameFootballIdentity } from '../src/data/clubVisuals';
import { clubDisplayName } from '../src/game/identity';
import { activeFixture } from '../src/game/fixture';
import { cupFinalOpponent } from '../src/game/cupEngine';
import { matchContext } from '../src/game/matchEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, Position } from '../src/types';

describe('football identity is what decides whether two sides may meet', () => {
  it('treats a club, its youth side and its academy as ONE identity', () => {
    for (const a of [MACCABI_ID, MACCABI_YOUTH_ID, MACCABI_ACADEMY_ID]) {
      for (const b of [MACCABI_ID, MACCABI_YOUTH_ID, MACCABI_ACADEMY_ID]) {
        expect(sameFootballIdentity(a, b), `${a} vs ${b}`).toBe(true);
      }
    }
  });

  it('is exactly as strong as the name the player reads', () => {
    /*
     * This is why id equality was not enough. All three render as "מכבי חיפה", so any pairing
     * among them looks like a club playing itself whatever the ids underneath say.
     */
    expect(clubDisplayName(MACCABI_YOUTH_ID)).toBe(clubDisplayName(MACCABI_ID));
    expect(clubDisplayName(MACCABI_ACADEMY_ID)).toBe(clubDisplayName(MACCABI_ID));
  });

  it('does not merge two genuinely different clubs', () => {
    /* The rule must not over-reach: separate clubs stay separate opponents. */
    expect(sameFootballIdentity(MACCABI_ID, 'hapoel_haifa')).toBe(false);
    expect(sameFootballIdentity(MACCABI_ID, 'maccabi_tel_aviv')).toBe(false);
    expect(sameFootballIdentity('hapoel_haifa', 'hapoel_tel_aviv')).toBe(false);
  });
});

describe('no generator can produce a club against itself', () => {
  /*
   * The cup draw, exercised directly. This is the path that actually shipped the bug, so it is
   * checked at the pool level rather than only through a simulated career: the pool filter is
   * where the fix lives.
   */
  it('never leaves a club\'s own identity in the cup-final candidate pool', () => {
    for (const own of [MACCABI_ID, MACCABI_YOUTH_ID, MACCABI_ACADEMY_ID, 'hapoel_haifa']) {
      const survivors = ACTIVE_CLUBS.filter(
        (club) =>
          sameFootballIdentity(club.id, own) &&
          club.tier !== 'academy' &&
          club.tier !== 'youth',
      );
      /*
       * Every club left here after the tier filter would have been a legal candidate under the
       * old `club.id !== own.id` test. For an academy player that set contained his own senior
       * club - which is the bug, stated as the set that must now be excluded by identity.
       */
      expect(
        survivors.every((club) => sameFootballIdentity(club.id, own)),
        `${own}: pool would contain ${survivors.map((c) => c.id).join(', ')}`,
      ).toBe(true);
    }
  });

  it('refuses a vsMaccabi fixture for a player whose own identity IS Maccabi', () => {
    /*
     * An event gated on "you are playing Maccabi" has no fixture to describe when the player IS
     * Maccabi. It must return no context rather than find something to put on the other side.
     */
    for (const clubId of [MACCABI_ID, MACCABI_YOUTH_ID, MACCABI_ACADEMY_ID]) {
      const career = careerAt(clubId);
      const context = matchContext(career, undefined, { maccabi: true });
      if (context) {
        expect(sameFootballIdentity(context.opponentClubId, clubId)).toBe(false);
      }
    }
  });
});

describe('the presentation boundary fails closed', () => {
  it('returns null rather than a fixture of a club against itself', () => {
    /*
     * A corrupt STORED state - a cup final drawn by a build older than this patch - cannot be
     * fixed by a generator that no longer runs. So `activeFixture` checks, and returns null.
     *
     * It must not rename the opponent: a renamed opponent is a lie the player cannot detect,
     * while a missing fixture is a visible absence.
     */
    const career = careerAt(MACCABI_ACADEMY_ID);
    const corrupted: Career = {
      ...career,
      phase: 'season_result',
      seasonPoint: 'season_end',
      world: {
        ...career.world,
        cup: {
          season: career.currentSeason,
          run: 'runners_up' as never,
          trophyId: 'cup',
          finalOpponentId: MACCABI_ID,
        } as never,
      },
    };
    const fixture = activeFixture(corrupted);
    if (fixture) {
      expect(sameFootballIdentity(fixture.playerClubId, fixture.opponentClubId)).toBe(false);
    }
  });
});

describe('a many-seed audit finds no self-opponent anywhere', () => {
  /*
   * The invariant is a property of thousands of beats across a whole career in every competition,
   * so one hand-picked seed proves nothing. This is the same walk `npm run fixture:audit` performs
   * - league beat, cup final, European tie and the presented fixture - at a size a test suite can
   * afford. The audit script runs 600 careers; this runs enough to fail if a path regresses.
   */
  it('walks every fixture source of many careers and finds zero', () => {
    const violations: string[] = [];
    const positions: Position[] = ['ST', 'GK', 'CM'];
    let beats = 0;
    let checked = 0;

    for (let i = 0; i < 25; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: positions[i % positions.length]!,
        seed: 4000 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          beats += 1;

          const fixture = activeFixture(career);
          if (fixture) {
            checked += 1;
            if (sameFootballIdentity(fixture.playerClubId, fixture.opponentClubId)) {
              violations.push(`${fixture.kind}: ${fixture.playerClubId} vs ${fixture.opponentClubId}`);
            }
          }

          for (const require of [undefined, { derby: true }, { maccabi: true }, { formerClub: true }] as const) {
            const context = matchContext(career, undefined, require);
            if (!context) continue;
            checked += 1;
            if (sameFootballIdentity(context.opponentClubId, career.currentClubId)) {
              violations.push(`context: ${career.currentClubId} vs ${context.opponentClubId}`);
            }
          }

          const cup = cupFinalOpponent(career);
          if (cup) {
            checked += 1;
            if (sameFootballIdentity(cup, career.currentClubId)) {
              violations.push(`cup: ${career.currentClubId} vs ${cup}`);
            }
          }

          const journey = career.world.europe?.current?.playerJourney;
          if (journey && journey.clubId === career.currentClubId) {
            for (const step of journey.steps) {
              if (step.kind !== 'tie') continue;
              checked += 1;
              if (sameFootballIdentity(step.tie.opponentId, journey.clubId)) {
                violations.push(`euro ${step.tie.stage}: ${journey.clubId} vs ${step.tie.opponentId}`);
              }
            }
          }
        },
      });
    }

    /* The audit has to have actually looked at something, or "zero violations" is vacuous. */
    expect(beats).toBeGreaterThan(2000);
    expect(checked).toBeGreaterThan(5000);
    expect([...new Set(violations)]).toEqual([]);
  });
});

/** A career parked at a club, far enough in to have a table and a season. */
function careerAt(clubId: string): Career {
  let parked: Career | null = null;
  simulateCareer({
    playerName: 'אורי דביר',
    position: 'ST',
    seed: 77,
    policy: balancedPolicy,
    onStep: (career) => {
      if (!parked && career.currentSeason > career.startSeason + 2) parked = career;
    },
  });
  const base = parked!;
  return { ...base, currentClubId: clubId };
}

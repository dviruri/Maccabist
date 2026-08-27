/**
 * v0.4 Phase 5: the player's standing with Maccabi.
 *
 * The rule these guard is the product invariant: THE PLAYER MAY LEAVE MACCABI, MACCABI NEVER
 * LEAVES THE PLAYER'S STORY. Standing is what the club remembers, it is always derived from the
 * record rather than stored, and it must move in the right direction for the right reasons —
 * service earns it, the *manner* of leaving costs it, and leaving in itself does neither.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { MACCABI_EVENTS } from '../src/data/events/maccabiEvents';
import { LEAVING } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import { isEventEligible } from '../src/game/eventEngine';
import {
  canFaceMaccabi,
  crowdResponse,
  isAtMaccabi,
  joinedRivalFromMaccabi,
  maccabiGrievance,
  maccabiRelationship,
  maccabiService,
  maccabiStandingScore,
  playedForMaccabi,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_NOTES,
} from '../src/game/maccabiEngine';
import { balancedPolicy, loyalPolicy, simulateCareer } from '../src/game/simulate';
import { homecomingKind, homecomingPossible } from '../src/game/transferEngine';
import type {
  Career,
  MaccabiRecord,
  MaccabiRelationship,
  SeasonRecord,
  SeasonSlot,
} from '../src/types';

const base = (seed = 3): Career => createCareer({ playerName: 'ל', position: 'CM', seed });

const withMaccabi = (over: Partial<MaccabiRecord>, career = base()): Career => ({
  ...career,
  maccabi: { ...career.maccabi, ...over },
});

/** A senior season somewhere, used to build the club trail standing is read off. */
const seniorSeason = (clubId: string, onLoan = false): SeasonRecord => ({
  season: 2042,
  age: 22,
  academyStage: 'senior',
  clubId,
  clubName: clubId,
  teamName: clubId,
  league: 'ליגת העל',
  onLoan,
  stats: {
    appearances: 30,
    starts: 28,
    goals: 5,
    assists: 4,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 68,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 65,
  role: 'starter',
  coachTrust: 60,
  trophies: [],
  captain: false,
  olderGroup: 'none',
});

const RIVAL = LEAVING.rivalClubIds[0] as string;
const SLOTS: SeasonSlot[] = ['early', 'mid', 'late'];

describe('service and grievance', () => {
  it('gives a player who never went near the club nothing', () => {
    expect(maccabiService(base())).toBe(0);
    expect(playedForMaccabi(base())).toBe(false);
  });

  it('counts senior appearances far more heavily than academy years', () => {
    const academyLifer = withMaccabi({ academySeasons: 10, academyGraduate: true });
    const senior = withMaccabi({ appearances: 200, seasons: 6 });
    expect(maccabiService(senior)).toBeGreaterThan(maccabiService(academyLifer));
  });

  it('leaves a whole youth career short of being beloved', () => {
    const academyLifer = withMaccabi({ academySeasons: 12, academyGraduate: true });
    // The academy makes you familiar, not beloved. This is the band the numbers are tuned to.
    expect(maccabiRelationship(academyLifer)).toBe('known');
  });

  it('rewards trophies and the armband on top of appearances', () => {
    const plain = withMaccabi({ appearances: 150, seasons: 5 });
    const decorated = withMaccabi({
      appearances: 150,
      seasons: 5,
      championships: 3,
      cups: 2,
      captainSeasons: 3,
    });
    expect(maccabiService(decorated)).toBeGreaterThan(maccabiService(plain));
  });

  it('does not treat leaving, on its own, as a grievance', () => {
    const stayed = withMaccabi({ appearances: 200, seasons: 7, academyGraduate: true });
    const left = withMaccabi({
      appearances: 200,
      seasons: 7,
      academyGraduate: true,
      everLeft: true,
    });
    expect(maccabiGrievance(left)).toBe(maccabiGrievance(stayed));
    expect(maccabiRelationship(left)).toBe(maccabiRelationship(stayed));
  });

  it('does treat the manner of leaving as one', () => {
    const clean = withMaccabi({ appearances: 200, seasons: 7 });
    const messy = withMaccabi({ appearances: 200, seasons: 7, betrayalMoments: 2 });
    expect(maccabiGrievance(messy)).toBeGreaterThan(maccabiGrievance(clean));
  });

  it('credits loyalty moments back against grievance', () => {
    const sour = withMaccabi({ appearances: 100, betrayalMoments: 3 });
    const forgiven = withMaccabi({ appearances: 100, betrayalMoments: 3, loyaltyMoments: 2 });
    expect(maccabiGrievance(forgiven)).toBeLessThan(maccabiGrievance(sour));
  });
});

describe('joining a rival', () => {
  const defector = (): Career => ({
    ...withMaccabi({ appearances: 250, seasons: 8, academyGraduate: true }),
    seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason(RIVAL)],
  });

  it('is read off the season trail', () => {
    expect(joinedRivalFromMaccabi(defector())).toBe(true);
  });

  it('overrides even a great career', () => {
    const career = defector();
    // The same service, without the rival shirt at the end of it, is a well-regarded career.
    const stayed: Career = { ...career, seasonHistory: [seniorSeason(MACCABI_ID)] };
    expect(maccabiRelationship(stayed)).toBe('respected');
    expect(maccabiRelationship(career)).toBe('traitor');
  });

  it('is not triggered by a loan spell at a rival', () => {
    const loaned: Career = {
      ...withMaccabi({ appearances: 250, seasons: 8, academyGraduate: true }),
      seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason(RIVAL, true)],
    };
    expect(joinedRivalFromMaccabi(loaned)).toBe(false);
    expect(maccabiRelationship(loaned)).not.toBe('traitor');
  });

  it('is not triggered by joining a rival without ever leaving Maccabi for them', () => {
    const neverTheirs: Career = {
      ...base(),
      seasonHistory: [seniorSeason(RIVAL), seniorSeason('hapoel_afula')],
    };
    expect(joinedRivalFromMaccabi(neverTheirs)).toBe(false);
  });
});

describe('the relationship', () => {
  it('rises monotonically with service', () => {
    const order: MaccabiRelationship[] = [
      'stranger',
      'known',
      'respected',
      'beloved',
      'son_of_the_club',
    ];
    // The first rung is a player with no connection at all - give him academy years and he is
    // already "known", which is the point of the band rather than a failure of it.
    const careers = [0, 40, 120, 240, 400].map((appearances, i) =>
      withMaccabi({
        appearances,
        seasons: i * 3,
        academySeasons: i === 0 ? 0 : 8,
        academyGraduate: i > 0,
        championships: i,
      }),
    );
    const scores = careers.map(maccabiStandingScore);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i] as number).toBeGreaterThanOrEqual(scores[i - 1] as number);
    }
    // And the bands they land in never go backwards.
    const bands = careers.map(maccabiRelationship);
    for (const band of bands) expect(order).toContain(band);
    expect(bands[0]).toBe('stranger');
    expect(bands[bands.length - 1]).toBe('son_of_the_club');
  });

  it('reserves son_of_the_club for a graduate, and icon for everyone else', () => {
    const graduate: Partial<MaccabiRecord> = {
      appearances: 400,
      seasons: 15,
      championships: 4,
      academySeasons: 10,
      academyGraduate: true,
    };
    expect(maccabiRelationship(withMaccabi(graduate))).toBe('son_of_the_club');

    // A player who arrived as an adult has to be genuinely enormous to reach the top, because
    // none of the academy credit is available to him. That is the intended asymmetry.
    const signed: Partial<MaccabiRecord> = {
      appearances: 400,
      seasons: 18,
      championships: 6,
      cups: 3,
      captainSeasons: 6,
      academySeasons: 0,
      academyGraduate: false,
    };
    expect(maccabiRelationship(withMaccabi(signed))).toBe('icon');
  });

  it('has a label and a note for every band', () => {
    const bands: MaccabiRelationship[] = [
      'son_of_the_club',
      'icon',
      'beloved',
      'respected',
      'known',
      'stranger',
      'traitor',
    ];
    for (const band of bands) {
      expect(RELATIONSHIP_LABELS[band]).toBeTruthy();
      expect(RELATIONSHIP_NOTES[band]).toBeTruthy();
    }
  });

  it('is derived, so it survives a round trip through JSON unchanged', () => {
    const career = simulateCareer({ playerName: 'ל', position: 'CM', seed: 21, policy: loyalPolicy });
    const before = maccabiRelationship(career);
    const reloaded = JSON.parse(JSON.stringify(career)) as Career;
    expect(maccabiRelationship(reloaded)).toBe(before);
    expect(maccabiStandingScore(reloaded)).toBe(maccabiStandingScore(career));
  });
});

describe('facing them', () => {
  it('boos a traitor, ignores a stranger and welcomes a favourite', () => {
    const traitor: Career = {
      ...withMaccabi({ appearances: 250, seasons: 8 }),
      seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason(RIVAL)],
    };
    expect(crowdResponse(traitor)).toBe('hostile');
    expect(crowdResponse(base())).toBe('indifferent');
    expect(
      crowdResponse(withMaccabi({ appearances: 400, seasons: 15, academyGraduate: true })),
    ).toBe('warm');
  });

  it('never has the player face his own club', () => {
    const home: Career = { ...base(), currentClubId: MACCABI_ID, academyStage: 'senior' };
    expect(isAtMaccabi(home)).toBe(true);
    expect(canFaceMaccabi(home)).toBe(false);
  });

  it('only happens in a division they share', () => {
    const topFlight: Career = {
      ...base(),
      currentClubId: 'bnei_sakhnin',
      academyStage: 'senior',
    };
    expect(canFaceMaccabi(topFlight)).toBe(true);

    const secondDivision: Career = { ...topFlight, currentClubId: 'hapoel_afula' };
    expect(canFaceMaccabi(secondDivision)).toBe(false);

    const abroad: Career = { ...topFlight, currentClubId: 'benfica' };
    expect(canFaceMaccabi(abroad)).toBe(false);
  });

  it('never happens to an academy player', () => {
    const boy: Career = { ...base(), currentClubId: 'bnei_sakhnin', academyStage: 'youth_a' };
    expect(canFaceMaccabi(boy)).toBe(false);
  });
});

describe('the Maccabi event family', () => {
  it('is entirely for players who are no longer there', () => {
    for (const event of MACCABI_EVENTS) {
      // `formerMaccabi` is the scope that means "has history there, is somewhere else now".
      expect(event.conditions?.clubScope).toBe('formerMaccabi');
      expect(event.conditions?.atMaccabi).not.toBe(true);
    }
  });

  it('never reaches a player still at Maccabi', () => {
    const home: Career = {
      ...withMaccabi({ appearances: 200, seasons: 6, academyGraduate: true }),
      currentClubId: MACCABI_ID,
      academyStage: 'senior',
    };
    for (const event of MACCABI_EVENTS) {
      for (const slot of SLOTS) expect(isEventEligible(event, home, slot)).toBe(false);
    }
  });

  it('never reaches a child', () => {
    const boy: Career = { ...base(), currentClubId: 'bnei_sakhnin', academyStage: 'children_a' };
    for (const event of MACCABI_EVENTS) {
      for (const slot of SLOTS) expect(isEventEligible(event, boy, slot)).toBe(false);
    }
  });

  it('fires for a meaningful share of careers that leave', () => {
    const ids = new Set(MACCABI_EVENTS.map((e) => e.id));
    let withOne = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const career = simulateCareer({ playerName: 'ל', position: 'CM', seed, policy: balancedPolicy });
      if (career.eventsHistory.some((e) => ids.has(e.eventId))) withOne += 1;
    }
    // Maccabi never leaves the player's story: measured ~45% across policies.
    expect(withOne / N).toBeGreaterThan(0.25);
  });
});

describe('the homecoming', () => {
  it('is never offered to a player who left them for a rival', () => {
    const defector: Career = {
      ...withMaccabi({ appearances: 250, seasons: 8, academyGraduate: true, everLeft: true }),
      seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason(RIVAL)],
      currentClubId: RIVAL,
      academyStage: 'senior',
      ability: 85,
      maccabism: 90,
    };
    // Good enough, keen enough, and one of their own — and it still does not happen.
    expect(homecomingPossible(defector)).toBe(false);
  });

  it('is possible for a player who simply left', () => {
    const emigrant: Career = {
      ...withMaccabi({ appearances: 250, seasons: 8, academyGraduate: true, everLeft: true }),
      seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason('benfica')],
      currentClubId: 'benfica',
      academyStage: 'senior',
    };
    expect(homecomingPossible(emigrant)).toBe(true);
  });

  it('tells the rejected boy who came back a star apart from an ordinary redemption', () => {
    const released: Career = {
      ...base(),
      academyStage: 'senior',
      currentClubId: 'hapoel_afula',
      flags: ['released_by_maccabi'],
      age: 24,
    };
    expect(homecomingKind({ ...released, ability: 40 })).toBe('redemption');
    expect(homecomingKind({ ...released, ability: 85 })).toBe('rejected_child_star');
  });
});

describe('across whole simulated careers', () => {
  it('puts a one-club career further up the ladder than an ambitious one, on average', () => {
    const mean = (policy: typeof balancedPolicy): number => {
      let total = 0;
      for (let seed = 1; seed <= 300; seed += 1) {
        total += maccabiStandingScore(
          simulateCareer({ playerName: 'ל', position: 'CM', seed, policy }),
        );
      }
      return total / 300;
    };
    expect(mean(loyalPolicy)).toBeGreaterThan(mean(balancedPolicy));
  });

  it('produces every band across a population, and no undefined ones', () => {
    const seen = new Set<MaccabiRelationship>();
    for (let seed = 1; seed <= 600; seed += 1) {
      const career = simulateCareer({ playerName: 'ל', position: 'CM', seed, policy: balancedPolicy });
      const band = maccabiRelationship(career);
      expect(RELATIONSHIP_LABELS[band]).toBeTruthy();
      seen.add(band);
    }
    // Every band should be reachable; a band nobody ever lands in is dead content.
    for (const band of ['son_of_the_club', 'beloved', 'respected', 'known', 'stranger', 'traitor']) {
      expect(seen).toContain(band);
    }
  });

  it('keeps the score inside its stated range', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const score = maccabiStandingScore(
        simulateCareer({ playerName: 'ל', position: 'CM', seed, policy: balancedPolicy }),
      );
      expect(score).toBeGreaterThanOrEqual(-100);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

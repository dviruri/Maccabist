/**
 * Engine tests, migrated from the v0.1 API to v0.2.
 *
 * Deliberately does NOT re-test the academy ladder or the weighted-outcome engine -
 * tests/academy.test.ts and tests/outcomes.test.ts own those. This file covers the rest of
 * the engine: effects, club moves, half-season simulation, development and the potential
 * ceiling, the youth -> senior verdict, the released-player route, transfers/homecoming,
 * the Legend Score, and the season state machine.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ACADEMY_ID, MACCABI_ID, getClub } from '../src/data/clubs';
import { EVENTS_BY_ID } from '../src/data/events';
import { RETIREMENT_FORCED_AGE } from '../src/game/balance';
import {
  advanceYear,
  answerEvent,
  beginSeason,
  continueAfterEvent,
  createCareer,
  retire,
} from '../src/game/careerEngine';
import { computeLegendScore } from '../src/game/legendEngine';
import {
  applyEffects,
  applyHalfProgression,
  moveToClub,
  type HalfContext,
} from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { roleFromValue } from '../src/game/rules';
import { EMPTY_STATS, playFirstHalf, playSecondHalf, simulateHalfStats } from '../src/game/seasonEngine';
import {
  acceptOffer,
  evaluateSeniorTransition,
  generateOffers,
  interestWeight,
  seniorTransitionOffers,
} from '../src/game/transferEngine';
import type { Career, SeasonStats } from '../src/types';

const newCareer = (seed = 12345, position: Career['position'] = 'CM'): Career =>
  createCareer({ playerName: 'בדיקה', position, seed });

/** A career parked in the senior team, which is where most of the numbers get interesting. */
const seniorCareer = (overrides: Partial<Career> = {}): Career => ({
  ...newCareer(),
  academyStage: 'senior',
  currentClubId: MACCABI_ID,
  age: 25,
  ability: 75,
  roleValue: 70,
  ...overrides,
});

const halfContext = (overrides: Partial<HalfContext> = {}): HalfContext => ({
  stats: { ...EMPTY_STATS, appearances: 15, starts: 13, rating: 68 },
  minutesShare: 0.7,
  trophyPoints: 0,
  fraction: 0.5,
  ...overrides,
});

/* ------------------------------------------------------------------ */

describe('career creation', () => {
  it('starts a 9 year old at טרום ב׳, on the origin screen', () => {
    const career = newCareer();
    expect(career.age).toBe(9);
    expect(career.academyStage).toBe('pre_b');
    expect(career.retired).toBe(false);
    // v0.3.1: a career opens on how it began - scouted, or the Maccabi trials.
    expect(career.phase).toBe('origin');
    expect(career.maccabi.appearances).toBe(0);
    // ...and where he starts depends on whether that door opened.
    if (career.origin === 'trial_rejected') {
      expect(career.currentClubId).not.toBe(MACCABI_ACADEMY_ID);
    } else {
      expect(career.currentClubId).toBe(MACCABI_ACADEMY_ID);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createCareer({ playerName: 'א', position: 'ST', seed: 777 });
    const b = createCareer({ playerName: 'א', position: 'ST', seed: 777 });
    expect(a.ability).toBe(b.ability);
    expect(a.hidden.potential).toBe(b.hidden.potential);
    expect(a.currentSeason).toBe(b.currentSeason);
    expect(a.coachTrust).toBe(b.coachTrust);
  });

  it('varies the hidden potential between seeds', () => {
    const potentials = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => createCareer({ playerName: 'פ', position: 'CM', seed }).hidden.potential),
    );
    expect(potentials.size).toBeGreaterThan(3);
  });

  it('falls back to a default name', () => {
    expect(createCareer({ playerName: '   ', position: 'GK', seed: 1 }).playerName).toBe('מכביסט');
  });

  it('derives the team role from the numeric role value', () => {
    expect(roleFromValue(5)).toBe('squad');
    expect(roleFromValue(40)).toBe('rotation');
    expect(roleFromValue(55)).toBe('starter');
    expect(roleFromValue(70)).toBe('key');
    expect(roleFromValue(82)).toBe('star');
    /*
     * The ladder tops out at `star` (v0.4.5.1). It used to continue to `icon` at 90, which made
     * "club symbol" something awarded for being better than your teammates - 91% of careers got
     * it. Legacy moved to its own dimension; see legacyEngine and tests/legacy.test.ts.
     */
    expect(roleFromValue(95)).toBe('star');
    expect(roleFromValue(100)).toBe('star');
  });
});

/* ------------------------------------------------------------------ */

describe('effects', () => {
  it('applies attribute changes and reports deltas', () => {
    const career = newCareer();
    /*
     * The relevance argument is what licenses the maccabism delta (v0.4.8). Without it the guard
     * drops it, which is the whole point - this call used to change how the player felt about
     * Maccabi without saying what about Maccabi had happened.
     */
    const result = applyEffects(
      career,
      { ability: 5, maccabism: -10, reputation: 3 },
      createRng(1),
      'leaving',
    );
    expect(result.career.ability).toBe(career.ability + 5);
    expect(result.career.maccabism).toBe(career.maccabism - 10);
    expect(result.deltas.map((d) => d.key)).toContain('ability');
    expect(result.deltas.map((d) => d.key)).toContain('maccabism');
  });

  it('drops a maccabism change that does not say what about Maccabi happened', () => {
    const career = newCareer();
    for (const relevance of [undefined, 'none' as const]) {
      const result = applyEffects(career, { ability: 5, maccabism: -10 }, createRng(1), relevance);
      expect(result.career.maccabism, String(relevance)).toBe(career.maccabism);
      // ...and nothing else is affected by the guard.
      expect(result.career.ability).toBe(career.ability + 5);
    }
  });

  it('clamps visible attributes to 0-100', () => {
    const career = newCareer();
    const high = applyEffects(career, { ability: 500, maccabism: 500 }, createRng(2), 'identity').career;
    expect(high.ability).toBe(100);
    expect(high.maccabism).toBe(100);
    const low = applyEffects(career, { ability: -500, reputation: -500 }, createRng(2)).career;
    expect(low.ability).toBe(0);
    expect(low.reputation).toBe(0);
  });

  it('moves hidden attributes without exposing them as deltas', () => {
    const career = newCareer();
    const after = applyEffects(career, { confidence: 10, form: -5 }, createRng(3));
    expect(after.career.hidden.confidence).toBe(career.hidden.confidence + 10);
    expect(after.career.hidden.form).toBe(career.hidden.form - 5);
    expect(after.deltas.map((d) => d.key)).not.toContain('confidence');
  });

  it('keeps the team role in step with the role value', () => {
    const career = { ...newCareer(), roleValue: 30 };
    const promoted = applyEffects(career, { roleValue: 40 }, createRng(4)).career;
    expect(promoted.roleValue).toBe(70);
    expect(promoted.role).toBe('key');
  });

  it('does not mutate the original career', () => {
    const career = newCareer();
    const before = career.ability;
    applyEffects(career, { ability: 20 }, createRng(5));
    expect(career.ability).toBe(before);
  });

  it('records loyalty and betrayal moments from flags', () => {
    const career = newCareer();
    expect(applyEffects(career, { flags: ['loyalty_moment'] }, createRng(6)).career.maccabi.loyaltyMoments).toBe(1);
    expect(applyEffects(career, { flags: ['betrayal_moment'] }, createRng(7)).career.maccabi.betrayalMoments).toBe(1);
  });

  it('applies the olderGroup effect without touching the official stage', () => {
    const career = { ...newCareer(), academyStage: 'youth_b' as const };
    const up = applyEffects(career, { olderGroup: 'training' }, createRng(8)).career;
    expect(up.olderGroup).toBe('training');
    expect(up.academyStage).toBe('youth_b');
  });
});

/* ------------------------------------------------------------------ */

describe('club moves', () => {
  it('marks the player as having left only after a senior departure', () => {
    const fromYouth = moveToClub({ ...newCareer(), academyStage: 'u19' }, 'maccabi_netanya');
    expect(fromYouth.maccabi.everLeft).toBe(false);

    const senior = seniorCareer();
    expect(moveToClub(senior, 'benfica').maccabi.everLeft).toBe(true);
  });

  it('flags a homecoming when returning to Maccabi', () => {
    let career = moveToClub(seniorCareer(), 'benfica');
    career = { ...career, age: 30 };
    career = moveToClub(career, MACCABI_ID);
    expect(career.maccabi.returned).toBe(true);
    expect(career.maccabi.returnAge).toBe(30);
  });

  it('keeps a loan tied to the parent club and off the Maccabi ledger', () => {
    const career = moveToClub(seniorCareer(), 'hapoel_hadera', { loan: true, loanSeasons: 1 });
    expect(career.parentClubId).toBe(MACCABI_ID);
    expect(career.maccabi.everLeft).toBe(false);
  });

  it('sends the player to the senior stage when joining a senior club', () => {
    const career = moveToClub({ ...newCareer(), academyStage: 'u19' }, 'hapoel_hadera');
    expect(career.academyStage).toBe('senior');
  });

  it('reseats the player in the new dressing room and resets playing up', () => {
    const career = moveToClub({ ...seniorCareer({ roleValue: 95 }), olderGroup: 'playing' }, 'benfica');
    expect(career.roleValue).toBeLessThan(95);
    expect(career.olderGroup).toBe('none');
    expect(career.captain).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('half-season simulation', () => {
  it('gives a striker far more goals than a goalkeeper in the same team', () => {
    const base = seniorCareer({ ability: 78 });
    let strikerGoals = 0;
    let keeperGoals = 0;
    for (let i = 0; i < 40; i += 1) {
      strikerGoals += simulateHalfStats({ ...base, position: 'ST' }, createRng(i + 1), 21).stats.goals;
      keeperGoals += simulateHalfStats({ ...base, position: 'GK' }, createRng(i + 1), 21).stats.goals;
    }
    expect(strikerGoals).toBeGreaterThan(keeperGoals * 5);
  });

  it('only gives clean sheets to keepers and defenders', () => {
    const base = seniorCareer({ ability: 75 });
    let keeperCleanSheets = 0;
    let wingerCleanSheets = 0;
    for (let i = 0; i < 20; i += 1) {
      keeperCleanSheets += simulateHalfStats({ ...base, position: 'GK' }, createRng(i + 5), 21).stats.cleanSheets;
      wingerCleanSheets += simulateHalfStats({ ...base, position: 'WG' }, createRng(i + 5), 21).stats.cleanSheets;
    }
    expect(keeperCleanSheets).toBeGreaterThan(0);
    expect(wingerCleanSheets).toBe(0);
  });

  it('concedes goals only for goalkeepers', () => {
    const base = seniorCareer({ ability: 70 });
    expect(simulateHalfStats({ ...base, position: 'GK' }, createRng(11), 21).stats.goalsConceded).toBeGreaterThan(0);
    expect(simulateHalfStats({ ...base, position: 'CM' }, createRng(11), 21).stats.goalsConceded).toBe(0);
  });

  it('never produces more appearances than games, or more starts than appearances', () => {
    for (let i = 0; i < 60; i += 1) {
      const career = seniorCareer({ ability: 92, roleValue: 96, age: 27 });
      const sim = simulateHalfStats(career, createRng(i), 21);
      expect(sim.stats.appearances).toBeLessThanOrEqual(21);
      expect(sim.stats.starts).toBeLessThanOrEqual(sim.stats.appearances);
      expect(sim.stats.appearances).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives a trusted player more minutes than a distrusted twin of equal ability', () => {
    let trustedApps = 0;
    let distrustedApps = 0;
    for (let i = 0; i < 40; i += 1) {
      trustedApps += simulateHalfStats(seniorCareer({ coachTrust: 92 }), createRng(i + 3), 21).stats.appearances;
      distrustedApps += simulateHalfStats(seniorCareer({ coachTrust: 12 }), createRng(i + 3), 21).stats.appearances;
    }
    expect(trustedApps).toBeGreaterThan(distrustedApps);
  });

  it('rotates academy players rather than benching them completely', () => {
    const kid = { ...newCareer(), academyStage: 'children_b' as const, ability: 12 };
    const sim = simulateHalfStats(kid, createRng(21), 11);
    expect(sim.stats.appearances).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */

describe('season halves and records', () => {
  it('records first-half stats, then merges both halves into the season record', () => {
    const career = beginSeason({ ...newCareer(2024), academyStage: 'youth_b', age: 15 });
    const first = playFirstHalf(career, createRng(31));
    expect(first.firstHalfStats).not.toBeNull();

    const { career: done, record } = playSecondHalf(first, createRng(32));
    const firstApps = first.firstHalfStats?.appearances ?? 0;
    expect(record.stats.appearances).toBeGreaterThanOrEqual(firstApps);
    expect(record.firstHalf?.appearances).toBe(firstApps);
    expect(done.seasonHistory).toHaveLength(1);
    expect(done.firstHalfStats).toBeNull();
  });

  it('counts senior Maccabi games towards the club legacy', () => {
    const played = playFirstHalf(seniorCareer(), createRng(33));
    expect(played.maccabi.appearances).toBeGreaterThan(0);
    expect(played.maccabi.debutAge).toBe(25);
  });

  it('does not count loan games towards the Maccabi legacy', () => {
    const onLoan = playFirstHalf(
      { ...seniorCareer({ currentClubId: 'hapoel_hadera', age: 21 }), parentClubId: MACCABI_ID, loanSeasonsLeft: 1 },
      createRng(34),
    );
    expect(onLoan.stats.appearances).toBeGreaterThan(0);
    expect(onLoan.maccabi.appearances).toBe(0);
  });

  it('does not count academy games towards the senior Maccabi legacy', () => {
    const kid = playFirstHalf({ ...newCareer(), academyStage: 'youth_a', age: 16 }, createRng(35));
    expect(kid.stats.appearances).toBeGreaterThan(0);
    expect(kid.maccabi.appearances).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe('development', () => {
  it('develops a young player over a half season', () => {
    const career = { ...newCareer(), academyStage: 'children_a' as const, age: 13, ability: 40 };
    const after = applyHalfProgression(career, halfContext(), createRng(41));
    expect(after.ability).toBeGreaterThan(career.ability);
  });

  it('declines a veteran past his peak', () => {
    const career = seniorCareer({ age: 36, ability: 70 });
    const after = applyHalfProgression(career, halfContext(), createRng(42));
    expect(after.ability).toBeLessThan(career.ability);
  });

  it('develops a high-potential player faster than a low-potential twin', () => {
    const base = { ...newCareer(), academyStage: 'youth_c' as const, age: 14, ability: 45 };
    const high = { ...base, hidden: { ...base.hidden, potential: 95 } };
    const low = { ...base, hidden: { ...base.hidden, potential: 52 } };
    let highGrowth = 0;
    let lowGrowth = 0;
    for (let i = 0; i < 30; i += 1) {
      highGrowth += applyHalfProgression(high, halfContext(), createRng(i + 1)).ability - high.ability;
      lowGrowth += applyHalfProgression(low, halfContext(), createRng(i + 1)).ability - low.ability;
    }
    expect(highGrowth).toBeGreaterThan(lowGrowth);
  });

  it('treats potential as a soft ceiling, not a wall', () => {
    // Already at the ceiling, but having an exceptional season with high confidence.
    const career = {
      ...newCareer(),
      academyStage: 'u19' as const,
      age: 17,
      ability: 70,
      hidden: { ...newCareer().hidden, potential: 70, confidence: 85 },
    };
    const exceptional = halfContext({
      stats: { ...EMPTY_STATS, appearances: 16, starts: 16, rating: 85 },
      minutesShare: 0.85,
    });
    let grew = 0;
    for (let i = 0; i < 30; i += 1) {
      if (applyHalfProgression(career, exceptional, createRng(i + 1)).ability > career.ability) grew += 1;
    }
    expect(grew).toBeGreaterThan(0);
  });

  it('does not let a player run away far beyond his potential', () => {
    let career: Career = {
      ...newCareer(),
      academyStage: 'senior',
      currentClubId: MACCABI_ID,
      age: 22,
      ability: 70,
      hidden: { ...newCareer().hidden, potential: 70, confidence: 90 },
    };
    const exceptional = halfContext({
      stats: { ...EMPTY_STATS, appearances: 20, starts: 20, rating: 90 },
      minutesShare: 0.9,
    });
    for (let i = 0; i < 40; i += 1) {
      career = applyHalfProgression(career, exceptional, createRng(i + 1));
    }
    expect(career.ability).toBeLessThanOrEqual(70 + 8 + 1);
  });

  it('raises coach trust after a strong half and lowers it after a poor one', () => {
    const career = seniorCareer({ coachTrust: 50 });
    const strong = applyHalfProgression(
      career,
      halfContext({ stats: { ...EMPTY_STATS, appearances: 20, starts: 19, rating: 82 }, minutesShare: 0.9 }),
      createRng(51),
    );
    const poor = applyHalfProgression(
      career,
      halfContext({ stats: { ...EMPTY_STATS, appearances: 2, starts: 0, rating: 38 }, minutesShare: 0.05 }),
      createRng(51),
    );
    expect(strong.coachTrust).toBeGreaterThan(career.coachTrust);
    expect(poor.coachTrust).toBeLessThan(career.coachTrust);
  });

  it('grows the in-team role after a strong half', () => {
    const career = seniorCareer({ roleValue: 50 });
    const strong = applyHalfProgression(
      career,
      halfContext({ stats: { ...EMPTY_STATS, appearances: 20, starts: 19, rating: 84 }, minutesShare: 0.9 }),
      createRng(52),
    );
    expect(strong.roleValue).toBeGreaterThan(career.roleValue);
  });

  it('develops a player faster when he is training with the older age group', () => {
    const base = { ...newCareer(), academyStage: 'youth_b' as const, age: 15, ability: 50 };
    let upGrowth = 0;
    let flatGrowth = 0;
    for (let i = 0; i < 30; i += 1) {
      upGrowth += applyHalfProgression({ ...base, olderGroup: 'playing' }, halfContext(), createRng(i + 1)).ability;
      flatGrowth += applyHalfProgression({ ...base, olderGroup: 'none' }, halfContext(), createRng(i + 1)).ability;
    }
    expect(upGrowth).toBeGreaterThan(flatGrowth);
  });

  it('never moves maccabism passively, wherever the player is', () => {
    /*
     * This test asserted the opposite until v0.4.8: maccabism up at Maccabi, down abroad, every
     * half-season, from nothing but which club the player was at. That is the bug - a career at
     * Maccabi Herzliya accumulated Maccabism for playing well at Maccabi Herzliya, and a career at
     * Benfica lost it for existing.
     *
     * Maccabism is what the player feels about ONE club and it is his to spend. Only an explicit
     * decision about that club may move it, which is now enforced by `guardedMaccabismDelta`.
     */
    for (const clubId of ['maccabi_haifa', 'benfica', 'maccabi_herzliya', 'hapoel_hadera']) {
      const after = applyHalfProgression(
        seniorCareer({ maccabism: 60, currentClubId: clubId }),
        halfContext(),
        createRng(61),
      );
      expect(after.maccabism, clubId).toBe(60);
    }
  });
});

/* ------------------------------------------------------------------ */

describe('youth to senior transition', () => {
  const u19 = (overrides: Partial<Career> = {}): Career => ({
    ...newCareer(),
    academyStage: 'u19',
    age: 18,
    ability: 60,
    coachTrust: 60,
    reputation: 40,
    ...overrides,
  });

  it('offers a contract to an outstanding נוער player', () => {
    const verdict = evaluateSeniorTransition(
      u19({ ability: 82, coachTrust: 92, reputation: 70, roleValue: 88 }),
      createRng(71),
    );
    expect(['contract', 'contract_loan']).toContain(verdict.path);
  });

  it('releases a נוער player who never developed', () => {
    const verdict = evaluateSeniorTransition(
      { ...u19({ ability: 30, coachTrust: 15, reputation: 5, roleValue: 10, age: 19 }), seasonsAtStage: 2 },
      createRng(72),
    );
    expect(verdict.path).toBe('released');
  });

  it('values coach trust, not just ability', () => {
    const trusted = evaluateSeniorTransition(u19({ ability: 62, coachTrust: 95 }), createRng(73)).score;
    const distrusted = evaluateSeniorTransition(u19({ ability: 62, coachTrust: 15 }), createRng(73)).score;
    expect(trusted).toBeGreaterThan(distrusted);
  });

  it('produces a real spread of paths across many players', () => {
    const paths = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const career = u19({ ability: 45 + (i % 40), coachTrust: 30 + (i % 60), reputation: i % 70 });
      paths.add(evaluateSeniorTransition(career, createRng(i + 1)).path);
    }
    expect(paths.size).toBeGreaterThanOrEqual(3);
  });

  it('marks a promoted player as an academy graduate', () => {
    const career = u19({ ability: 82, coachTrust: 92, reputation: 70 });
    const verdict = evaluateSeniorTransition(career, createRng(74));
    const offers = seniorTransitionOffers(career, verdict, createRng(75));
    expect(offers.length).toBeGreaterThan(0);
    const signed = acceptOffer({ ...career, pendingOffers: offers }, offers[0]!.id, createRng(76));
    expect(signed.maccabi.academyGraduate).toBe(true);
    expect(signed.academyStage).toBe('senior');
  });
});

/* ------------------------------------------------------------------ */

describe('the released-player route', () => {
  it('offers a released player somewhere else to play', () => {
    const career: Career = { ...newCareer(), academyStage: 'u19', age: 19, ability: 40, coachTrust: 20 };
    const verdict = evaluateSeniorTransition({ ...career, seasonsAtStage: 2 }, createRng(81));
    expect(verdict.path).toBe('released');

    const offers = seniorTransitionOffers(career, verdict, createRng(82));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]!.kind).toBe('release');
    expect(offers[0]!.mandatory).toBe(true);
    expect(offers[0]!.clubId).not.toBe(MACCABI_ID);
  });

  it('keeps the career playable after being released', () => {
    const career: Career = { ...newCareer(), academyStage: 'u19', age: 19, ability: 45, coachTrust: 25 };
    const verdict = evaluateSeniorTransition({ ...career, seasonsAtStage: 2 }, createRng(83));
    const offers = seniorTransitionOffers(career, verdict, createRng(84));
    let next = acceptOffer({ ...career, pendingOffers: offers }, offers[0]!.id, createRng(85));

    expect(next.flags).toContain('released_by_maccabi');
    expect(next.retired).toBe(false);
    expect(next.academyStage).toBe('senior');

    // ... and he can still play a full season somewhere else.
    next = playFirstHalf(next, createRng(86));
    const { record } = playSecondHalf(next, createRng(87));
    expect(record.stats.appearances).toBeGreaterThan(0);
    expect(record.clubId).not.toBe(MACCABI_ID);
  });

  it('can bring a released player home again years later', () => {
    let career: Career = {
      ...seniorCareer({ currentClubId: 'hapoel_hadera', age: 28, ability: 74, reputation: 60, maccabism: 88 }),
      flags: ['released_by_maccabi'],
    };
    career = { ...career, lastSeasonRecord: null };

    let sawHomecoming = false;
    for (let i = 0; i < 60 && !sawHomecoming; i += 1) {
      sawHomecoming = generateOffers(career, createRng(i + 1)).some((o) => o.kind === 'return_home');
    }
    expect(sawHomecoming).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('transfers', () => {
  it('prefers clubs close to the player level', () => {
    const modest: Career = seniorCareer({ ability: 55, reputation: 20, age: 22 });
    const elite: Career = seniorCareer({ ability: 90, reputation: 88, age: 24 });
    const smallClub = getClub('hapoel_hadera');
    const bigClub = getClub('atletico');

    expect(interestWeight(modest, smallClub)).toBeGreaterThan(interestWeight(modest, bigClub));
    expect(interestWeight(elite, bigClub)).toBeGreaterThan(interestWeight(elite, smallClub));
  });

  it('loses interest in an ageing player', () => {
    const club = getClub('benfica');
    const young = interestWeight(seniorCareer({ age: 24, ability: 80, reputation: 70 }), club);
    const old = interestWeight(seniorCareer({ age: 35, ability: 80, reputation: 70 }), club);
    expect(old).toBeLessThan(young);
  });

  it('does not offer transfers to a nine year old in the academy', () => {
    expect(generateOffers(newCareer(), createRng(91))).toHaveLength(0);
  });

  it('treats leaving as a betrayal only from the senior team', () => {
    const senior = seniorCareer({ reputation: 80, ability: 82 });
    let sawTransfer = false;
    for (let i = 0; i < 80 && !sawTransfer; i += 1) {
      const offers = generateOffers({ ...senior, hidden: { ...senior.hidden, transferBoost: 1 } }, createRng(i + 1));
      const transfer = offers.find((o) => o.kind === 'transfer');
      if (transfer) {
        sawTransfer = true;
        expect(transfer.acceptEffects.maccabism ?? 0).toBeLessThan(0);
        expect(transfer.declineEffects.flags ?? []).toContain('loyalty_moment');
      }
    }
    expect(sawTransfer).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('legend score', () => {
  const legendaryCareer = (): Career => ({
    ...newCareer(),
    academyStage: 'senior',
    age: 36,
    ability: 74,
    peakAbility: 84,
    maccabism: 96,
    reputation: 60,
    captainSeasons: 7,
    maccabi: {
      ...newCareer().maccabi,
      appearances: 380,
      goals: 70,
      assists: 60,
      seasons: 15,
      championships: 5,
      cups: 3,
      captainSeasons: 7,
      academyGraduate: true,
      loyaltyMoments: 3,
    },
  });

  it('rewards a long Maccabi career far above a short one', () => {
    const legend = computeLegendScore(legendaryCareer()).score;
    const tourist = computeLegendScore({
      ...newCareer(),
      academyStage: 'senior',
      age: 34,
      ability: 92,
      peakAbility: 94,
      maccabism: 30,
      reputation: 95,
      maccabi: { ...newCareer().maccabi, appearances: 25, seasons: 1, everLeft: true },
    }).score;
    expect(legend).toBeGreaterThan(tourist + 25);
  });

  it('stays inside 0-100', () => {
    const score = computeLegendScore(legendaryCareer()).score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('caps a player who never appeared for the senior team', () => {
    const never = computeLegendScore({
      ...newCareer(),
      age: 35,
      ability: 88,
      peakAbility: 90,
      reputation: 90,
      maccabism: 90,
    });
    expect(never.score).toBeLessThanOrEqual(34);
  });

  it('punishes forcing a move out of the club', () => {
    const base = legendaryCareer();
    const loyal = computeLegendScore(base).score;
    const traitor = computeLegendScore({
      ...base,
      maccabi: { ...base.maccabi, betrayalMoments: 3 },
    }).score;
    expect(traitor).toBeLessThan(loyal);
  });

  it('rewards coming home', () => {
    const base = legendaryCareer();
    const stayed = computeLegendScore({
      ...base,
      maccabi: { ...base.maccabi, everLeft: true, returned: false },
    }).score;
    const cameBack = computeLegendScore({
      ...base,
      maccabi: { ...base.maccabi, everLeft: true, returned: true, returnAge: 29, seasonsAfterReturn: 5 },
    }).score;
    expect(cameBack).toBeGreaterThan(stayed);
  });

  it('always produces an ending archetype', () => {
    const result = computeLegendScore(legendaryCareer());
    expect(result.ending.title.length).toBeGreaterThan(0);
    expect(result.components.length).toBeGreaterThan(4);
  });
});

/* ------------------------------------------------------------------ */

describe('career flow', () => {
  it('moves preseason -> event -> outcome', () => {
    let career = beginSeason(newCareer(2024));
    expect(career.phase).toBe('event');

    const eventId = career.pendingEventIds[0]!;
    const choiceId = EVENTS_BY_ID[eventId]!.choices[0]!.id;
    career = answerEvent(career, eventId, choiceId);

    expect(career.lastEventResult).not.toBeNull();
    expect(career.lastEventResult?.outcomeText.length).toBeGreaterThan(0);
    expect(career.eventsHistory).toHaveLength(1);
    expect(career.pendingEventIds).not.toContain(eventId);
  });

  it('snapshots the season opening so the summary can show real movement', () => {
    const career = beginSeason(newCareer(2025));
    expect(career.seasonOpening).not.toBeNull();
    expect(career.seasonOpening?.ability).toBeGreaterThan(0);
  });

  it('walks a whole season through to the season summary', () => {
    let career = beginSeason({ ...newCareer(7), academyStage: 'youth_b', age: 15 });
    for (let i = 0; i < 40 && career.phase !== 'season_result'; i += 1) {
      if (career.phase === 'event') {
        if (career.lastEventResult) {
          career = continueAfterEvent(career);
          continue;
        }
        const eventId = career.pendingEventIds[0];
        if (!eventId) {
          career = continueAfterEvent(career);
          continue;
        }
        career = answerEvent(career, eventId, EVENTS_BY_ID[eventId]!.choices[0]!.id);
        continue;
      }
      if (career.phase === 'mid_season') {
        career = continueAfterEvent(career);
        continue;
      }
      break;
    }
    expect(career.phase).toBe('season_result');
    expect(career.lastSeasonRecord).not.toBeNull();
    expect(career.seasonHistory).toHaveLength(1);
  });

  it('ages the player and eventually forces retirement', () => {
    /*
     * v0.3.1: age is derived from the date of birth and the season, never incremented, so an
     * old player is made by moving the season forward rather than by setting `age`.
     */
    const old = seniorCareer();
    const career = advanceYear({
      ...old,
      currentSeason: old.dateOfBirth.year + RETIREMENT_FORCED_AGE,
    });
    expect(career.age).toBeGreaterThanOrEqual(RETIREMENT_FORCED_AGE);
    expect(career.retired).toBe(true);
    expect(career.legend).not.toBeNull();
  });

  it('derives age from the date of birth, not from a counter', () => {
    /*
     * The point of the v0.3.1 model: age is a function of (date of birth, season, season
     * point). Overwriting `age` on a career is meaningless - moving the season is what ages
     * a player - so this walks the season forward and checks the derived age tracks it.
     */
    let career = newCareer();
    const startAge = career.age;
    for (let i = 1; i <= 4; i += 1) {
      career = { ...advanceYear(career), phase: 'preseason' };
      expect(career.age).toBe(startAge + i);
    }
  });

  it('computes a legend result on retirement', () => {
    const career = retire({ ...seniorCareer(), age: 35 });
    expect(career.phase).toBe('retired');
    expect(career.retirementAge).toBe(35);
    expect(career.legend?.ending.id).toBeTruthy();
  });

  it('carries the rng state forward so a save resumes the same stream', () => {
    const career = newCareer(4242);
    const advanced = beginSeason(career);
    expect(advanced.rngState).not.toBe(career.rngState);

    // Re-running from the same saved state reproduces the same result.
    const a = beginSeason({ ...career });
    const b = beginSeason({ ...career });
    expect(a.pendingEventIds).toEqual(b.pendingEventIds);
    expect(a.rngState).toBe(b.rngState);
  });
});

/* ------------------------------------------------------------------ */

describe('stats bookkeeping', () => {
  it('accumulates career totals across halves', () => {
    const career = seniorCareer();
    const first = playFirstHalf(career, createRng(101));
    const { career: full } = playSecondHalf(first, createRng(102));
    const record = full.lastSeasonRecord!;
    expect(full.stats.appearances).toBe(record.stats.appearances);
    expect(full.stats.goals).toBe(record.stats.goals);
  });

  it('merges two halves into a sane season total', () => {
    const first: SeasonStats = { ...EMPTY_STATS, appearances: 10, starts: 8, goals: 4, rating: 70 };
    const career = { ...seniorCareer(), firstHalfStats: first };
    const { record } = playSecondHalf(career, createRng(103));
    expect(record.stats.appearances).toBeGreaterThanOrEqual(10);
    expect(record.stats.goals).toBeGreaterThanOrEqual(4);
    expect(record.stats.rating).toBeGreaterThan(0);
  });
});

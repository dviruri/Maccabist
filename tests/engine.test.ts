import { describe, expect, it } from 'vitest';

import { MACCABI_ACADEMY_ID, MACCABI_ID, MACCABI_YOUTH_ID, getClub } from '../src/data/clubs';
import { EVENTS, EVENTS_BY_ID } from '../src/data/events';
import {
  advanceYear,
  answerEvent,
  beginSeason,
  createCareer,
  retire,
  simulateCurrentSeason,
} from '../src/game/careerEngine';
import { isEventEligible, pickEvents, resolveEventChoice } from '../src/game/eventEngine';
import { computeLegendScore } from '../src/game/legendEngine';
import { applyEffects, moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { statusFromValue } from '../src/game/rules';
import { simulateSeasonStats } from '../src/game/seasonEngine';
import { interestWeight, generateOffers } from '../src/game/transferEngine';
import type { Career } from '../src/types';

const newCareer = (seed = 12345, position: Career['position'] = 'CM'): Career =>
  createCareer({ playerName: 'בדיקה', position, seed });

/* ------------------------------------------------------------------ */

describe('career creation', () => {
  it('starts a 9 year old in the Maccabi Haifa academy', () => {
    const career = newCareer();
    expect(career.age).toBe(9);
    expect(career.currentClubId).toBe(MACCABI_ACADEMY_ID);
    expect(career.retired).toBe(false);
    expect(career.phase).toBe('preseason');
    expect(career.maccabi.appearances).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const a = createCareer({ playerName: 'א', position: 'ST', seed: 777 });
    const b = createCareer({ playerName: 'א', position: 'ST', seed: 777 });
    expect(a.ability).toBe(b.ability);
    expect(a.hidden.potential).toBe(b.hidden.potential);
    expect(a.currentSeason).toBe(b.currentSeason);
  });

  it('falls back to a default name', () => {
    const career = createCareer({ playerName: '   ', position: 'GK', seed: 1 });
    expect(career.playerName).toBe('מכביסט');
  });

  it('derives the status label from the numeric value', () => {
    expect(statusFromValue(5)).toBe('academy');
    expect(statusFromValue(55)).toBe('starter');
    expect(statusFromValue(95)).toBe('icon');
  });
});

/* ------------------------------------------------------------------ */

describe('effects', () => {
  it('applies attribute changes and reports deltas', () => {
    const career = newCareer();
    const rng = createRng(1);
    const result = applyEffects(career, { ability: 5, maccabism: -10, reputation: 3 }, rng);
    expect(result.career.ability).toBe(career.ability + 5);
    expect(result.career.maccabism).toBe(career.maccabism - 10);
    expect(result.deltas.map((d) => d.key)).toContain('ability');
    expect(result.deltas.map((d) => d.key)).toContain('maccabism');
  });

  it('clamps attributes to 0-100', () => {
    const career = newCareer();
    const rng = createRng(2);
    const high = applyEffects(career, { ability: 500, maccabism: 500 }, rng).career;
    expect(high.ability).toBe(100);
    expect(high.maccabism).toBe(100);
    const low = applyEffects(career, { ability: -500, reputation: -500 }, rng).career;
    expect(low.ability).toBe(0);
    expect(low.reputation).toBe(0);
  });

  it('does not mutate the original career', () => {
    const career = newCareer();
    const before = career.ability;
    applyEffects(career, { ability: 20 }, createRng(3));
    expect(career.ability).toBe(before);
  });

  it('records loyalty and betrayal moments from flags', () => {
    const career = newCareer();
    const loyal = applyEffects(career, { flags: ['loyalty_moment'] }, createRng(4)).career;
    expect(loyal.maccabi.loyaltyMoments).toBe(1);
    const traitor = applyEffects(career, { flags: ['betrayal_moment'] }, createRng(5)).career;
    expect(traitor.maccabi.betrayalMoments).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe('club moves', () => {
  it('marks the player as having left only after a senior departure', () => {
    const youth = moveToClub(newCareer(), MACCABI_YOUTH_ID);
    const leftFromYouth = moveToClub(youth, 'maccabi_netanya');
    expect(leftFromYouth.maccabi.everLeft).toBe(false);

    const senior = moveToClub(newCareer(), MACCABI_ID);
    const leftFromSenior = moveToClub(senior, 'benfica');
    expect(leftFromSenior.maccabi.everLeft).toBe(true);
  });

  it('flags a homecoming when returning to Maccabi', () => {
    let career = moveToClub(newCareer(), MACCABI_ID);
    career = moveToClub(career, 'benfica');
    career = { ...career, age: 30 };
    career = moveToClub(career, MACCABI_ID);
    expect(career.maccabi.returned).toBe(true);
    expect(career.maccabi.returnAge).toBe(30);
  });

  it('keeps a loan tied to the parent club', () => {
    const career = moveToClub(moveToClub(newCareer(), MACCABI_ID), 'hapoel_hadera', {
      loan: true,
      loanSeasons: 1,
    });
    expect(career.parentClubId).toBe(MACCABI_ID);
    expect(career.maccabi.everLeft).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('event eligibility', () => {
  it('respects age and stage conditions', () => {
    const kid = newCareer();
    const kidsEvent = EVENTS_BY_ID['kids_older_group'];
    expect(kidsEvent).toBeDefined();
    expect(isEventEligible(kidsEvent!, kid)).toBe(true);

    const adult: Career = { ...kid, age: 28 };
    expect(isEventEligible(kidsEvent!, adult)).toBe(false);
  });

  it('never offers a `once` event twice', () => {
    const career = newCareer();
    const event = EVENTS_BY_ID['kids_first_stadium'];
    expect(isEventEligible(event!, career)).toBe(true);
    const seen: Career = { ...career, seenEventIds: ['kids_first_stadium'] };
    expect(isEventEligible(event!, seen)).toBe(false);
  });

  it('always finds at least one eligible event for a fresh career', () => {
    const picked = pickEvents(newCareer(), createRng(9), 2);
    expect(picked.length).toBeGreaterThan(0);
  });

  it('every event has a unique id and at least two real choices', () => {
    const ids = new Set<string>();
    for (const event of EVENTS) {
      expect(ids.has(event.id)).toBe(false);
      ids.add(event.id);
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      for (const choice of event.choices) {
        const hasEffects = choice.effects !== undefined;
        const hasOutcomes = (choice.outcomes?.length ?? 0) > 0;
        expect(hasEffects || hasOutcomes).toBe(true);
      }
    }
  });

  it('resolves a choice into an outcome with text and deltas', () => {
    const career = newCareer();
    const { career: after, result } = resolveEventChoice(
      career,
      'kids_first_stadium',
      'dream',
      createRng(11),
    );
    expect(result.outcomeText.length).toBeGreaterThan(0);
    expect(after.maccabism).toBeGreaterThan(career.maccabism);
    expect(after.seenEventIds).toContain('kids_first_stadium');
    expect(after.eventsHistory.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe('season simulation', () => {
  it('gives a striker more goals than a goalkeeper in the same team', () => {
    const base = { ...newCareer(), currentClubId: MACCABI_ID, ability: 78, statusValue: 70, age: 25 };
    let strikerGoals = 0;
    let keeperGoals = 0;
    for (let i = 0; i < 40; i += 1) {
      strikerGoals += simulateSeasonStats({ ...base, position: 'ST' }, createRng(i + 1)).stats.goals;
      keeperGoals += simulateSeasonStats({ ...base, position: 'GK' }, createRng(i + 1)).stats.goals;
    }
    expect(strikerGoals).toBeGreaterThan(keeperGoals * 5);
  });

  it('only gives goalkeepers clean sheets among non-defenders', () => {
    const base = { ...newCareer(), currentClubId: MACCABI_ID, ability: 75, statusValue: 70, age: 26 };
    const keeper = simulateSeasonStats({ ...base, position: 'GK' }, createRng(5));
    const winger = simulateSeasonStats({ ...base, position: 'WG' }, createRng(5));
    expect(keeper.stats.cleanSheets).toBeGreaterThan(0);
    expect(winger.stats.cleanSheets).toBe(0);
  });

  it('never produces more appearances than games in the season', () => {
    const club = getClub(MACCABI_ID);
    for (let i = 0; i < 50; i += 1) {
      const career = { ...newCareer(i), currentClubId: MACCABI_ID, ability: 90, statusValue: 95, age: 27 };
      const sim = simulateSeasonStats(career, createRng(i));
      expect(sim.stats.appearances).toBeLessThanOrEqual(club.seasonGames);
      expect(sim.stats.starts).toBeLessThanOrEqual(sim.stats.appearances);
    }
  });

  it('develops a young academy player over a season', () => {
    const career = newCareer(42);
    const played = simulateCurrentSeason(career);
    expect(played.phase).toBe('season_result');
    expect(played.ability).toBeGreaterThan(career.ability);
    expect(played.seasonHistory.length).toBe(1);
  });

  it('counts senior Maccabi games towards the club legacy but not loan games', () => {
    const atMaccabi = simulateCurrentSeason({
      ...newCareer(3),
      currentClubId: MACCABI_ID,
      ability: 75,
      statusValue: 70,
      age: 24,
    });
    expect(atMaccabi.maccabi.appearances).toBeGreaterThan(0);

    const onLoan = simulateCurrentSeason({
      ...newCareer(3),
      currentClubId: 'hapoel_hadera',
      parentClubId: MACCABI_ID,
      loanSeasonsLeft: 1,
      ability: 75,
      statusValue: 70,
      age: 21,
    });
    expect(onLoan.maccabi.appearances).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe('transfers', () => {
  it('prefers clubs close to the player level', () => {
    const modest: Career = { ...newCareer(), ability: 55, reputation: 20, age: 22 };
    const elite: Career = { ...newCareer(), ability: 90, reputation: 88, age: 24 };
    const smallClub = getClub('hapoel_hadera');
    const bigClub = getClub('atletico');

    expect(interestWeight(modest, smallClub)).toBeGreaterThan(interestWeight(modest, bigClub));
    expect(interestWeight(elite, bigClub)).toBeGreaterThan(interestWeight(elite, smallClub));
  });

  it('promotes a good enough youth player to the senior squad', () => {
    const career: Career = {
      ...newCareer(),
      currentClubId: MACCABI_YOUTH_ID,
      age: 18,
      ability: 62,
      statusValue: 55,
    };
    const offers = generateOffers(career, createRng(7));
    expect(offers[0]?.kind).toBe('promotion');
    expect(offers[0]?.mandatory).toBe(true);
  });

  it('releases a youth player who never developed', () => {
    const career: Career = {
      ...newCareer(),
      currentClubId: MACCABI_YOUTH_ID,
      age: 20,
      ability: 40,
      statusValue: 20,
    };
    const offers = generateOffers(career, createRng(8));
    expect(offers[0]?.kind).toBe('release');
  });

  it('does not offer transfers to a nine year old in the academy', () => {
    expect(generateOffers(newCareer(), createRng(4))).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */

describe('legend score', () => {
  const legendaryCareer = (): Career => ({
    ...newCareer(),
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

  it('always produces an ending archetype', () => {
    const result = computeLegendScore(legendaryCareer());
    expect(result.ending.title.length).toBeGreaterThan(0);
    expect(result.components.length).toBeGreaterThan(4);
  });
});

/* ------------------------------------------------------------------ */

describe('career flow', () => {
  it('moves preseason -> event -> season result', () => {
    let career = newCareer(2024);
    career = beginSeason(career);
    expect(career.phase).toBe('event');
    const eventId = career.pendingEventIds[0]!;
    const choiceId = EVENTS_BY_ID[eventId]!.choices[0]!.id;
    career = answerEvent(career, eventId, choiceId);
    expect(career.lastEventResult).not.toBeNull();
  });

  it('ages the player and eventually forces retirement', () => {
    let career: Career = { ...newCareer(), age: 40 };
    career = advanceYear(career);
    expect(career.retired).toBe(true);
    expect(career.legend).not.toBeNull();
  });

  it('computes a legend result on retirement', () => {
    const career = retire({ ...newCareer(), age: 35 });
    expect(career.phase).toBe('retired');
    expect(career.retirementAge).toBe(35);
    expect(career.legend?.ending.id).toBeTruthy();
  });
});

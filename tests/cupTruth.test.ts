/**
 * The cup as an authoritative fact (v0.6.2, Target 4).
 *
 * The bug this locks down: `sen_cup_final` narrated a State Cup final - "אתה מכריע את הגמר",
 * "אתה מסתכל על הקבוצה היריבה מרימה גביע" - while the cup trophy was an unrelated roll at season
 * end. Neither knew about the other, so a player could be carried off the pitch as the man who
 * won the cup and finish the season with no cup, or lift a cup in a season the game never
 * mentioned a final.
 *
 * `world.cup` now commits the run at preseason. These tests assert the three joins that gives us:
 * events gate on it, the trophy is read from it, and the validator catches disagreement.
 */

import { describe, expect, it } from 'vitest';

import { ALL_CLUBS, MACCABI_ID, getClub } from '../src/data/clubs';
import { getLeague } from '../src/data/leagues';
import { tableClubById, tableClubLeague } from '../src/data/worldClubs';
import { EVENT_POOL } from '../src/data/events';
import { rivalryBetween } from '../src/data/rivalries';
import { createCareer } from '../src/game/careerEngine';
import {
  cupFinalOpponent,
  cupRunLabel,
  currentCup,
  isCupFinalDerby,
  projectCup,
  reachedCupFinal,
  wonCupThisSeason,
} from '../src/game/cupEngine';
import { isEventEligible } from '../src/game/eventEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { createRng } from '../src/game/random';
import { levelContext } from '../src/game/rules';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, CupSeasonState } from '../src/types';

function seniorAt(clubId: string, seed = 5, ability = 74): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability,
    roleValue: 70,
    currentSeason: 2044,
  };
}

function withCup(career: Career, cup: Partial<CupSeasonState>): Career {
  return {
    ...career,
    world: {
      ...career.world,
      cup: {
        season: career.currentSeason,
        clubId: career.currentClubId,
        trophyId: 'cup',
        run: 'winners',
        finalOpponentId: null,
        ...cup,
      },
    },
  };
}

/* ================================================================== */
/* The state itself                                                    */
/* ================================================================== */

describe('v0.6.2 the cup run is a committed season fact', () => {
  it('belongs to one season and one club, and reads as nothing otherwise', () => {
    const career = withCup(seniorAt(MACCABI_ID), { run: 'winners' });
    expect(wonCupThisSeason(career)).toBe(true);

    // A season later, the same state answers nothing.
    expect(wonCupThisSeason({ ...career, currentSeason: 2045 })).toBe(false);
    // At another club, likewise.
    expect(wonCupThisSeason({ ...career, currentClubId: 'hapoel_haifa' })).toBe(false);
    // And a save with no cup state supports no cup claim at all.
    expect(currentCup(seniorAt(MACCABI_ID))).toBeNull();
    expect(reachedCupFinal(seniorAt(MACCABI_ID))).toBe(false);
  });

  it('keeps the marginal win rate the pre-v0.6.2 roll produced', () => {
    /*
     * The one calibration claim in cupEngine: decomposing a win into reaching a final and winning
     * it must not change how often the cup is won. Measured rather than asserted, because
     * REACH_FINAL_MULTIPLE cancelling is exactly the kind of algebra that survives a refactor in
     * the comment and not in the code.
     */
    const career = seniorAt(MACCABI_ID);
    const level = levelContext(career);
    const strength = Math.min(1.35, Math.max(0.7, 0.75 + (career.ability - level.quality) / 90));
    const expected = level.cupChance * strength;

    const rng = createRng(20250829);
    let wins = 0;
    let finals = 0;
    const n = 30000;
    for (let i = 0; i < n; i += 1) {
      const cup = projectCup(career, rng);
      if (cup.run === 'winners') wins += 1;
      if (cup.run === 'winners' || cup.run === 'runner_up') finals += 1;
    }
    expect(wins / n).toBeGreaterThan(expected - 0.015);
    expect(wins / n).toBeLessThan(expected + 0.015);
    // And a final is genuinely more common than a win, or the split bought nothing.
    expect(finals).toBeGreaterThan(wins * 1.8);
  });

  it('never reports an opponent for a run that reached no final', () => {
    for (const run of ['early_exit', 'quarter_final', 'semi_final'] as const) {
      const career = withCup(seniorAt(MACCABI_ID), { run, finalOpponentId: 'hapoel_haifa' });
      expect(reachedCupFinal(career), run).toBe(false);
      expect(cupFinalOpponent(career), run).toBeNull();
      expect(isCupFinalDerby(career), run).toBe(false);
    }
  });

  it('draws finalists that are real clubs from the same country', () => {
    /*
     * v0.6.3 widened the pool: a finalist may be a modelled Club or a named table club from the
     * same national dataset. Either way it must be an identified club of the right country -
     * never an invented one.
     */
    const rng = createRng(4242);
    const career = seniorAt(MACCABI_ID);
    const ids = new Set<string>();
    for (let i = 0; i < 3000; i += 1) {
      const cup = projectCup(career, rng);
      if (cup.finalOpponentId) ids.add(cup.finalOpponentId);
    }
    expect(ids.size).toBeGreaterThan(3);
    const home = getClub(MACCABI_ID).country;
    for (const id of ids) {
      expect(id).not.toBe(MACCABI_ID);
      const table = tableClubById(id);
      if (table) {
        const leagueId = tableClubLeague(id);
        expect(leagueId, id).not.toBeNull();
        expect(getLeague(leagueId!).country, id).toBe(home);
      } else {
        expect(getClub(id).country, id).toBe(home);
      }
    }
  });

  it('labels every run, so a cup exit is never a blank line', () => {
    for (const run of ['early_exit', 'quarter_final', 'semi_final', 'runner_up', 'winners'] as const) {
      expect(cupRunLabel(run).length, run).toBeGreaterThan(0);
    }
  });
});

/* ================================================================== */
/* A cup final may be a derby, and only for the real reason            */
/* ================================================================== */

describe('v0.6.2 a cup final is a derby only when the finalists are rivals', () => {
  it('says so when the draw produces the actual local rival', () => {
    const career = withCup(seniorAt(MACCABI_ID), {
      run: 'runner_up',
      finalOpponentId: 'hapoel_haifa',
    });
    expect(rivalryBetween(MACCABI_ID, 'hapoel_haifa')?.type).toBe('localDerby');
    expect(isCupFinalDerby(career)).toBe(true);
  });

  it('says nothing for a big final against a club that is not a rival', () => {
    const career = withCup(seniorAt(MACCABI_ID), {
      run: 'winners',
      finalOpponentId: 'maccabi_tel_aviv',
    });
    expect(rivalryBetween(MACCABI_ID, 'maccabi_tel_aviv')?.type).not.toBe('localDerby');
    expect(isCupFinalDerby(career)).toBe(false);
  });

  it('is false for the reported career: Kfar Saba against Umm al-Fahm', () => {
    const career = withCup(seniorAt('hapoel_kfar_saba'), {
      run: 'winners',
      finalOpponentId: 'hapoel_umm_al_fahm',
    });
    expect(isCupFinalDerby(career)).toBe(false);
  });
});

/* ================================================================== */
/* Events                                                             */
/* ================================================================== */

describe('v0.6.2 no event may mention a cup final without one', () => {
  const CUP_FINAL_WORDS = ['גמר הגביע', 'גמר גביע'];

  it('gates every event whose text names a cup final', () => {
    const offenders: string[] = [];
    for (const event of EVENT_POOL) {
      const text = [
        event.kicker ?? '',
        event.title,
        event.description,
        ...event.choices.flatMap((c) => c.outcomes.map((o) => o.text)),
      ].join(' ');
      if (!CUP_FINAL_WORDS.some((w) => text.includes(w))) continue;
      if (event.conditions.cupFinal === undefined) offenders.push(event.id);
    }
    expect(offenders, 'events naming a cup final with no cup condition').toEqual([]);
  });

  it('has one event for a final won and one for a final lost', () => {
    const won = EVENT_POOL.find((e) => e.id === 'sen_cup_final_won');
    const lost = EVENT_POOL.find((e) => e.id === 'sen_cup_final_lost');
    expect(won?.conditions.cupFinal).toBe('won');
    expect(lost?.conditions.cupFinal).toBe('lost');

    // The trophy-winning honour belongs only to the final that was won.
    const wonAchievements = won!.choices.flatMap((c) =>
      c.outcomes.map((o) => o.effects?.achievement),
    );
    const lostAchievements = lost!.choices.flatMap((c) =>
      c.outcomes.map((o) => o.effects?.achievement),
    );
    expect(wonAchievements).toContain('cup_final_hero');
    expect(lostAchievements.filter(Boolean)).toEqual([]);
  });

  it('offers neither final to a club that did not reach one', () => {
    const base = seniorAt(MACCABI_ID);
    const noCup = withCup(base, { run: 'semi_final', finalOpponentId: null });
    for (const id of ['sen_cup_final_won', 'sen_cup_final_lost']) {
      const event = EVENT_POOL.find((e) => e.id === id)!;
      for (const slot of ['early', 'mid', 'late'] as const) {
        expect(isEventEligible(event, noCup, slot), `${id}/${slot}`).toBe(false);
        // And a pre-v0.6.2 save with no cup state at all.
        expect(isEventEligible(event, base, slot), `${id}/${slot} legacy save`).toBe(false);
      }
    }
  });

  it('offers only the matching one to a club that did', () => {
    const won = EVENT_POOL.find((e) => e.id === 'sen_cup_final_won')!;
    const lost = EVENT_POOL.find((e) => e.id === 'sen_cup_final_lost')!;

    const winner = withCup(seniorAt(MACCABI_ID), {
      run: 'winners',
      finalOpponentId: 'maccabi_tel_aviv',
    });
    const runnerUp = withCup(seniorAt(MACCABI_ID), {
      run: 'runner_up',
      finalOpponentId: 'maccabi_tel_aviv',
    });

    /*
     * Eligibility only - whether either is actually *drawn* depends on appearances, cooldowns and
     * the rest of the planner. What must hold is that the wrong one is never eligible.
     */
    expect(isEventEligible(lost, winner, 'late')).toBe(false);
    expect(isEventEligible(won, runnerUp, 'late')).toBe(false);
  });
});

/* ================================================================== */
/* Real careers                                                       */
/* ================================================================== */

describe('v0.6.2 real careers do not contradict themselves about the cup', () => {
  it('never records a cup this season that the cup state did not win', () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= 150; seed += 1) {
      const career = simulateCareer({
        playerName: 'ת',
        position: 'ST',
        seed,
        policy: balancedPolicy,
      });
      for (const v of validateCareerIntegrity(career)) {
        if (v.code.startsWith('cup_') || v.code === 'derby_claim_without_rival') {
          violations.push(`seed ${seed}: ${v.code} - ${v.detail}`);
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('still hands out cups at a believable rate', () => {
    /*
     * The regression guard for the calibration above, measured through the whole engine rather
     * than through `projectCup` alone - the participation gate and the player's club history are
     * both part of how often a cup actually lands.
     */
    let cups = 0;
    let careers = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const career = simulateCareer({
        playerName: 'ת',
        position: 'ST',
        seed,
        policy: balancedPolicy,
      });
      careers += 1;
      cups += career.trophies.filter((t) => t.id === 'cup' || t.id === 'foreign_cup').length;
    }
    const perCareer = cups / careers;
    expect(perCareer).toBeGreaterThan(0.15);
    expect(perCareer).toBeLessThan(4);
  });

  it('catches a cup trophy that the cup state does not support', () => {
    // A fabricated contradiction, to prove the validator is actually looking.
    const career = withCup(seniorAt(MACCABI_ID), { run: 'runner_up', finalOpponentId: 'hapoel_haifa' });
    const lying: Career = {
      ...career,
      trophies: [
        {
          id: 'cup',
          name: 'גביע המדינה',
          season: career.currentSeason,
          clubId: MACCABI_ID,
          clubName: 'מכבי חיפה',
          weight: 3,
        },
      ],
    };
    const codes = validateCareerIntegrity(lying).map((v) => v.code);
    expect(codes).toContain('cup_trophy_without_cup_win');
  });
});

/* ================================================================== */
/* Sanity on the club data the draw relies on                          */
/* ================================================================== */

describe('v0.6.2 the finalist draw has something to draw from', () => {
  it('has more than one Israeli club to meet in a final', () => {
    const israeli = ALL_CLUBS.filter((c) => c.country === 'ישראל');
    expect(israeli.length).toBeGreaterThan(5);
  });
});

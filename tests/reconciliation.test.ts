/**
 * v0.4.8: every system agrees, and future events cannot make them disagree again.
 *
 * Four playtest bugs, all the same shape: two systems each holding an opinion about one fact. The
 * static half of this file stops a new event definition recreating them; the dynamic half checks
 * real careers.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { getClub, MACCABI_ID } from '../src/data/clubs';
import { leagueShape } from '../src/data/leagueShape';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import { isEventEligible } from '../src/game/eventEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { outcomeForPosition, positionsForOutcome, projectSeason } from '../src/game/leagueEngine';
import { applyEffects } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import {
  appearanceBreakdown,
  CUP_TROPHY_IDS,
  guardedMaccabismDelta,
  isForeignSeason,
  LEAGUE_TROPHY_IDS,
  seniorSeasons,
} from '../src/game/truth';
import type { Career, ClubSeasonOutcome, MaccabiRelevance, SeasonRecord } from '../src/types';

/* ================================================================== */
/* Static: event definitions                                           */
/* ================================================================== */

describe('an event cannot put a player on the pitch without requiring him to be on it', () => {
  it('gates every match moment on an appearance', () => {
    const ungated = EVENT_POOL.filter(
      (e) => e.category === 'match_moment' && e.conditions?.requiresAppearance !== true,
    ).map((e) => e.id);
    expect(ungated).toEqual([]);
  });

  it('has match moments to gate, so the check is doing work', () => {
    expect(EVENT_POOL.filter((e) => e.category === 'match_moment').length).toBeGreaterThan(15);
  });

  it('never requires a start without also requiring an appearance', () => {
    // You cannot start a match you did not appear in.
    for (const event of EVENT_POOL) {
      if (event.conditions?.requiresStart !== true) continue;
      expect(event.conditions.requiresAppearance, event.id).toBe(true);
    }
  });
});

describe('an event cannot move Maccabism without saying what about Maccabi happened', () => {
  it('declares a relevance on every outcome that changes Maccabism', () => {
    const bad: string[] = [];
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (!outcome.effects?.maccabism) continue;
          if (outcome.maccabiRelevance === undefined || outcome.maccabiRelevance === 'none') {
            bad.push(`${event.id}/${choice.id}/${outcome.id}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('never declares a relevance on an outcome that does not change Maccabism', () => {
    /*
     * The other direction. A stray label is harmless at runtime and it is a lie in the data - it
     * says this outcome is about Maccabi when nothing about it is.
     */
    const stray: string[] = [];
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (outcome.maccabiRelevance === undefined) continue;
          if (!outcome.effects?.maccabism) stray.push(`${event.id}/${choice.id}/${outcome.id}`);
        }
      }
    }
    expect(stray).toEqual([]);
  });

  it('has Maccabism effects to check, so the rule is exercised', () => {
    const withMaccabism = EVENT_POOL.flatMap((e) =>
      e.choices.flatMap((c) => c.outcomes.filter((o) => o.effects?.maccabism)),
    );
    expect(withMaccabism.length).toBeGreaterThan(50);
  });
});

describe('the Maccabism guard', () => {
  it('drops a delta with no declared relevance', () => {
    expect(guardedMaccabismDelta(10, undefined)).toBe(0);
    expect(guardedMaccabismDelta(-10, undefined)).toBe(0);
    expect(guardedMaccabismDelta(10, 'none')).toBe(0);
  });

  it('passes a delta that says what happened', () => {
    const licensed: MaccabiRelevance[] = [
      'identity',
      'fans',
      'people',
      'leaving',
      'return',
      'opponent',
    ];
    for (const relevance of licensed) {
      expect(guardedMaccabismDelta(7, relevance), relevance).toBe(7);
      expect(guardedMaccabismDelta(-7, relevance), relevance).toBe(-7);
    }
  });

  it('tapers a positive delta as the ceiling approaches, and never a negative one', () => {
    /*
     * A consequence I caused and then had to fix. Removing the passive drift was correct, and it
     * left the event deltas - which are net positive - with nothing pulling back. Measured right
     * after the removal: median Maccabism 100, mean 94.7, p75 and p90 both 100. A stat pinned at
     * its ceiling carries no information, and it inflated the Legend Score with it.
     *
     * The taper is not the old decay returning: nothing moves the number on its own, an event
     * still has to happen and it still has to be about Maccabi. The hundredth point of devotion is
     * simply harder to earn than the fiftieth.
     */
    const low = guardedMaccabismDelta(10, 'identity', 20);
    const high = guardedMaccabismDelta(10, 'identity', 95);
    expect(low).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(0);
    expect(low).toBeLessThanOrEqual(10);

    // At the ceiling there is nothing left to gain.
    expect(guardedMaccabismDelta(10, 'identity', 100)).toBe(0);

    // Losing devotion is never softened - that is the half a player actually feels.
    expect(guardedMaccabismDelta(-10, 'identity', 95)).toBe(-10);
    expect(guardedMaccabismDelta(-10, 'identity', 5)).toBe(-10);
  });

  it('keeps the maccabism distribution off the ceiling across real careers', () => {
    const values: number[] = [];
    for (let seed = 1; seed <= 150; seed += 1) {
      values.push(
        simulateCareer({ playerName: 'מ', position: 'CM', seed, policy: balancedPolicy }).maccabism,
      );
    }
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)] ?? 0;
    // Was exactly 100 immediately after the passive drift was removed.
    expect(median).toBeLessThan(96);
    // ...and still high, because this is a career raised in green.
    expect(median).toBeGreaterThan(60);
  });

  it('records why maccabism moved, and never records a change it blocked', () => {
    /*
     * Phase 24. The guard is easy to state and impossible to see, so the trace makes it checkable:
     * every entry names the cause and the relevance that let it through. A blocked delta leaves no
     * entry, because nothing happened - an audit trail of non-events would bury the real ones.
     */
    const rng = createRng(11);
    const base = createCareer({ playerName: 'מ', position: 'CM', seed: 11 });

    const blocked = applyEffects(base, { maccabism: 8 }, rng, 'none', 'some_event').career;
    expect(blocked.maccabismTrace ?? []).toHaveLength(0);
    expect(blocked.maccabism).toBe(base.maccabism);

    const allowed = applyEffects(base, { maccabism: 8 }, rng, 'fans', 'sen_fans_sing').career;
    const trace = allowed.maccabismTrace ?? [];
    expect(trace).toHaveLength(1);
    expect(trace[0]?.source).toBe('sen_fans_sing');
    expect(trace[0]?.relevance).toBe('fans');
    expect(trace[0]?.requested).toBe(8);
    expect(trace[0]?.applied).toBeGreaterThan(0);
    expect(trace[0]?.after).toBeCloseTo(allowed.maccabism, 5);
  });

  it('bounds the trace so a long career does not grow the save', () => {
    const rng = createRng(12);
    let career = createCareer({ playerName: 'מ', position: 'CM', seed: 12 });
    for (let i = 0; i < 40; i += 1) {
      career = applyEffects(career, { maccabism: -1 }, rng, 'identity', `e${i}`).career;
    }
    expect((career.maccabismTrace ?? []).length).toBeLessThanOrEqual(12);
    // The most recent change is the one kept.
    expect(career.maccabismTrace?.at(-1)?.source).toBe('e39');
  });

  it('does not invent a delta where there was none', () => {
    expect(guardedMaccabismDelta(0, 'identity')).toBe(0);
    expect(guardedMaccabismDelta(undefined, 'identity')).toBe(0);
  });

  it('blocks a generic effect applied at Maccabi', () => {
    /*
     * Scenario I from the brief. A player at Maccabi choosing to train harder does not become more
     * of a Maccabist for it - the club he is standing in is not the reason, and being at Maccabi is
     * deliberately not on the licensed list.
     */
    const atMaccabi: Career = {
      ...createCareer({ playerName: 'מ', position: 'CM', seed: 4 }),
      academyStage: 'senior',
      currentClubId: MACCABI_ID,
      maccabism: 55,
    };
    const after = applyEffects(atMaccabi, { maccabism: 6, ability: 1 }, createRng(2)).career;
    expect(after.maccabism).toBe(55);
  });

  it('blocks a generic effect at another club', () => {
    // Scenario G. Asking the manager at Maccabi Herzliya for minutes is not about Maccabi Haifa.
    const elsewhere: Career = {
      ...createCareer({ playerName: 'מ', position: 'CM', seed: 4 }),
      academyStage: 'senior',
      currentClubId: 'maccabi_herzliya',
      maccabism: 55,
    };
    const after = applyEffects(elsewhere, { maccabism: 4, coachTrust: 5 }, createRng(2)).career;
    expect(after.maccabism).toBe(55);
    expect(after.coachTrust).toBeGreaterThan(elsewhere.coachTrust);
  });
});

describe('trophies keep their identity', () => {
  it('never lets one trophy id be both a league and a cup', () => {
    for (const id of LEAGUE_TROPHY_IDS) expect(CUP_TROPHY_IDS, id).not.toContain(id);
  });

  it('has both kinds', () => {
    expect(LEAGUE_TROPHY_IDS.length).toBeGreaterThan(0);
    expect(CUP_TROPHY_IDS.length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/* The reported scenarios                                              */
/* ================================================================== */

/** A senior career whose season is pinned to a given league outcome. */
function seniorAt(clubId: string, outcome: ClubSeasonOutcome, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'CM', seed });
  const career: Career = {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability: 74,
    roleValue: 70,
    currentSeason: 2044,
    seasonPoint: 'preseason',
    seasonSlot: 'early',
  };
  const projection = projectSeason(career.world, clubId, 2044, null, null, createRng(seed));
  if (!projection) throw new Error('no projection');
  const shape = leagueShape(projection.leagueId);
  if (!shape) throw new Error('no shape');
  const band = positionsForOutcome(projection.leagueId, outcome, shape);
  const position = band[Math.floor(band.length / 2)] ?? projection.finalPosition;
  return {
    ...career,
    world: {
      ...career.world,
      projection: {
        ...projection,
        finalPosition: position,
        finalOutcome: outcome,
        path: { early: position, mid: position, late: position, end: position },
      },
    },
  };
}

describe('C. Maccabi Herzliya, 5th in Liga Leumit', () => {
  it('is not champions, and the table says why', () => {
    /*
     * The exact reported bug. A championship celebration at a club the authoritative table had
     * finishing fifth, because the title was rolled from a fixed per-club probability.
     */
    const career = seniorAt('maccabi_herzliya', 'second_upper_half');
    const projection = career.world.projection!;
    const shape = leagueShape(projection.leagueId)!;

    expect(projection.leagueId).toBe('il_leumit');
    expect(projection.finalPosition).toBeGreaterThan(2);
    expect(outcomeForPosition(projection.leagueId, projection.finalPosition, shape)).not.toBe(
      'champion',
    );
    expect(projection.finalOutcome).not.toBe('champion');
  });

  it('cannot be champions at any non-first position, in either division', () => {
    for (const leagueId of ['il_premier', 'il_leumit']) {
      const shape = leagueShape(leagueId);
      if (!shape) continue;
      for (let position = 2; position <= shape.size; position += 1) {
        expect(outcomeForPosition(leagueId, position, shape), `${leagueId} ${position}`).not.toBe(
          'champion',
        );
      }
    }
  });
});

describe('D. a real champion', () => {
  it('is champions exactly when the table says first', () => {
    for (const leagueId of ['il_premier']) {
      const shape = leagueShape(leagueId);
      if (!shape) continue;
      expect(outcomeForPosition(leagueId, 1, shape)).toBe('champion');
    }
  });
});

describe('E/F. foreign football only from foreign clubs', () => {
  it('counts nothing abroad for a career played entirely in Israel', () => {
    /*
     * Scenario E. The bug counted every academy season and every Liga Leumit season as European
     * football, because it compared the league's Hebrew name against two strings.
     */
    const career = careerWithSeasons([
      season(2035, 'maccabi_academy', 'children_a', 20),
      season(2040, MACCABI_ID, 'senior', 28),
      season(2041, 'hapoel_petah_tikva', 'senior', 30),
      season(2042, 'maccabi_herzliya', 'senior', 26),
    ]);
    const breakdown = appearanceBreakdown(career);
    expect(breakdown.foreign).toBe(0);
    expect(breakdown.foreignSeasonsPlayed).toBe(0);
    // ...and the Israeli football is all accounted for.
    expect(breakdown.maccabi).toBe(28);
    expect(breakdown.otherIsraeli).toBe(56);
    expect(breakdown.total).toBe(84);
    expect(breakdown.youth).toBe(20);
  });

  it('counts a real foreign spell, and keeps it after coming home', () => {
    // Scenario F. 17 appearances abroad stay 17 after a return to Israel.
    const career = careerWithSeasons([
      season(2040, MACCABI_ID, 'senior', 28),
      season(2041, 'az_alkmaar', 'senior', 17),
      season(2042, MACCABI_ID, 'senior', 30),
    ]);
    const breakdown = appearanceBreakdown(career);
    expect(breakdown.foreign).toBe(17);
    expect(breakdown.foreignSeasonsPlayed).toBe(1);
    expect(breakdown.maccabi).toBe(58);
    expect(breakdown.total).toBe(75);
  });

  it('never counts a foreign season the player did not play in', () => {
    const career = careerWithSeasons([season(2041, 'az_alkmaar', 'senior', 0)]);
    const breakdown = appearanceBreakdown(career);
    expect(breakdown.foreign).toBe(0);
    expect(breakdown.foreignSeasonsPlayed).toBe(0);
  });

  it('reads the club country rather than the league name', () => {
    // Every modelled club must answer the question from data.
    const israeli = season(2041, 'hapoel_petah_tikva', 'senior', 10);
    const dutch = season(2041, 'az_alkmaar', 'senior', 10);
    expect(isForeignSeason(israeli)).toBe(false);
    expect(isForeignSeason(dutch)).toBe(true);
    expect(getClub('az_alkmaar').country).not.toBe('ישראל');
  });

  it('sums exactly, with no missing or overlapping category', () => {
    const career = careerWithSeasons([
      season(2040, MACCABI_ID, 'senior', 28),
      season(2041, 'az_alkmaar', 'senior', 17),
      season(2042, 'hapoel_hadera', 'senior', 22),
      season(2043, 'maccabi_academy', 'youth_a', 15),
    ]);
    const b = appearanceBreakdown(career);
    expect(b.maccabi + b.otherIsraeli + b.foreign).toBe(b.total);
    expect(b.youth).toBe(15);
  });
});

/* ================================================================== */
/* Dynamic: real careers                                               */
/* ================================================================== */

describe('real careers do not contradict themselves', () => {
  it('passes integrity validation across a population', () => {
    const violations: string[] = [];
    for (let seed = 1; seed <= 120; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'CM', seed, policy: balancedPolicy });
      for (const v of validateCareerIntegrity(career)) {
        violations.push(`seed ${seed}: ${v.code} - ${v.detail}`);
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  /*
   * The two bugs the 50,000-career scan found and 20,000 did not. Both are pinned by their own
   * seed, because a population test that only samples 150 careers is exactly what missed them.
   */
  it('counts a title won on loan at Maccabi (seed 722)', () => {
    /*
     * The counters were incremented inside the countsForMaccabiLegacy branch, which requires
     * parentClubId === null - so a title won on loan at Maccabi awarded a trophy with
     * clubId maccabi_haifa and counted nothing. They are recomputed from the trophy list now.
     */
    /*
     * Re-pinned for v0.5: the manager minutes factor shifted every career's trajectory, and
     * seed 3119 no longer produces the loan-title shape. Seed 722 does - a 2053 title at Maccabi
     * sandwiched between two Dortmund seasons. The invariant itself is also covered across a
     * population below; this pin exists so the loan case specifically stays exercised.
     */
    const career = simulateCareer({ playerName: 'ת', position: 'ST', seed: 722, policy: balancedPolicy });
    const titles = career.trophies.filter(
      (t) => t.clubId === MACCABI_ID && t.id === 'championship',
    ).length;
    expect(titles).toBeGreaterThan(0);
    expect(career.maccabi.championships).toBe(titles);
  });

  it('does not fire an on-field event into a settled empty season (seed 44241)', () => {
    /*
     * playSecondHalf settles the season at the end of the MID slot; the late slot loads after it.
     * firstHalfStats is null for that whole slot, so the gate concluded the season had not been
     * played and fell back to the projection.
     */
    const career = simulateCareer({ playerName: 'ת', position: 'CM', seed: 44241, policy: balancedPolicy });
    expect(validateCareerIntegrity(career)).toEqual([]);
  });

  it('keeps the maccabi counters equal to the trophy list across a population', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      const titles = career.trophies.filter(
        (t) => t.clubId === MACCABI_ID && t.id === 'championship',
      ).length;
      expect(career.maccabi.championships, `seed ${seed}`).toBe(titles);
    }
  });

  it('never records a league title in a season the club did not win', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      for (const trophy of career.trophies) {
        if (!LEAGUE_TROPHY_IDS.includes(trophy.id)) continue;
        if (trophy.id === 'youth_championship') continue;
        const result = career.world.clubSeasons.find(
          (s) => s.season === trophy.season && s.clubId === trophy.clubId,
        );
        if (!result) continue;
        expect(result.outcome, `seed ${seed} ${trophy.season}`).toBe('champion');
      }
    }
  });

  it('never has starts exceeding appearances', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'CB', seed, policy: balancedPolicy });
      for (const record of career.seasonHistory) {
        expect(record.stats.starts, `seed ${seed} ${record.season}`).toBeLessThanOrEqual(
          record.stats.appearances,
        );
      }
    }
  });

  it('never credits foreign appearances without a foreign senior season', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'WG', seed, policy: balancedPolicy });
      const b = appearanceBreakdown(career);
      if (b.foreign === 0) continue;
      const real = seniorSeasons(career).some((s) => isForeignSeason(s) && s.stats.appearances > 0);
      expect(real, `seed ${seed}`).toBe(true);
    }
  });

  it('has the appearance breakdown sum exactly, every career', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'FB', seed, policy: balancedPolicy });
      const b = appearanceBreakdown(career);
      expect(b.maccabi + b.otherIsraeli + b.foreign, `seed ${seed}`).toBe(b.total);
    }
  });
});

describe('the decision reveal can lock onto the resolved outcome', () => {
  /*
   * The reveal used to cycle labels and stop wherever the reel happened to be, then hand over to
   * the narrative on the same tick - so the selected outcome was visible for zero milliseconds and
   * the player inferred it afterwards. It now locks onto `lastEventResult.outcomeId`, which only
   * works if that id is always one of the outcomes the player was shown.
   */
  it('always resolves to an outcome that was in the displayed distribution', () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'CM', seed, policy: balancedPolicy });
      for (const entry of career.eventsHistory) {
        const odds = entry.odds ?? [];
        if (odds.length < 2) continue;
        checked += 1;
        expect(
          odds.map((o) => o.id),
          `${entry.eventId}/${entry.choiceId}`,
        ).toContain(entry.outcomeId);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('is the same outcome on the same seed, however it is revealed', () => {
    /*
     * The RNG invariant (Phase 9.5). The reveal is timers over data the engine already produced,
     * so reduced motion, a skipped animation and a full cycle cannot differ - resolving twice from
     * the same seed gives the same answer, and nothing in the component participates.
     */
    for (let seed = 1; seed <= 30; seed += 1) {
      const a = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      const b = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      expect(a.eventsHistory.map((e) => e.outcomeId)).toEqual(b.eventsHistory.map((e) => e.outcomeId));
    }
  });
});

describe('A. a Maccabi senior with zero appearances', () => {
  /*
   * The reported bug. A player signed a senior contract at Maccabi, received live on-field match
   * events - "minute 88, the ball reaches you" - and finished the season with 0 appearances,
   * because match moments gated on roleValue rather than on playing.
   */
  function backupWithNoFootball(): Career {
    const base = createCareer({ playerName: 'ס', position: 'CM', seed: 8 });
    return {
      ...base,
      academyStage: 'senior',
      currentClubId: MACCABI_ID,
      age: 19,
      // Signed, but nowhere near the team: well below the level, no trust, no minutes.
      ability: 42,
      roleValue: 30,
      coachTrust: 22,
      currentSeason: 2040,
      seasonPoint: 'midseason',
      seasonSlot: 'mid',
      // The first half has been played and produced nothing.
      firstHalfStats: {
        appearances: 0,
        starts: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 0,
        injuredGames: 0,
      },
      seasonParticipation: { season: 2040, appearances: 0, starts: 0 },
    };
  }

  it('is offered no on-field event at all', () => {
    const career = backupWithNoFootball();
    for (const slot of ['early', 'mid', 'late'] as const) {
      const onField = EVENT_POOL.filter(
        (e) => e.conditions?.requiresAppearance === true && isEventEligible(e, career, slot),
      ).map((e) => e.id);
      expect(onField, slot).toEqual([]);
    }
  });

  it('is still offered the things that happen off the pitch', () => {
    /*
     * The gate must not silence him. Training, the coach, the bench, the media and a loan
     * discussion are exactly what a season like this is made of.
     */
    const career = backupWithNoFootball();
    const offered = new Set(
      (['early', 'mid', 'late'] as const).flatMap((slot) =>
        EVENT_POOL.filter((e) => isEventEligible(e, career, slot)).map((e) => e.id),
      ),
    );
    expect(offered.size).toBeGreaterThan(5);
    // And none of what he is offered puts him on the pitch.
    for (const id of offered) {
      const event = EVENT_POOL.find((e) => e.id === id);
      expect(event?.conditions?.requiresAppearance, id).not.toBe(true);
    }
  });

  it('lets a player who is actually playing have them', () => {
    // The converse, so the gate is not simply switched off for everyone.
    const playing: Career = {
      ...backupWithNoFootball(),
      ability: 78,
      roleValue: 72,
      coachTrust: 70,
      firstHalfStats: {
        appearances: 14,
        starts: 12,
        goals: 3,
        assists: 2,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 72,
        injuredGames: 0,
      },
      seasonParticipation: { season: 2040, appearances: 14, starts: 12 },
    };
    const onField = EVENT_POOL.filter(
      (e) => e.conditions?.requiresAppearance === true && isEventEligible(e, playing, 'mid'),
    );
    expect(onField.length).toBeGreaterThan(0);
  });

  it('never records an on-field event in a season with no appearances, across real careers', () => {
    /*
     * B, the reconciliation direction. If a match moment did fire, settlement credits the
     * appearance rather than closing a season that contradicts what the player just read.
     */
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'CM', seed, policy: balancedPolicy });
      const onFieldIds = new Set(
        EVENT_POOL.filter((e) => e.conditions?.requiresAppearance === true).map((e) => e.id),
      );
      for (const entry of career.eventsHistory) {
        if (!onFieldIds.has(entry.eventId)) continue;
        const record = career.seasonHistory.find((r) => r.season === entry.season);
        if (!record) continue;
        expect(
          record.stats.appearances,
          `seed ${seed}: ${entry.eventId} in ${entry.season}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('save migration', () => {
  /** What a v0.4.7 save looks like: no ledger, and possibly a contradicted title. */
  function oldSave(over: Partial<Career> = {}): Career {
    const career = simulateCareer({ playerName: 'ש', position: 'CM', seed: 13, policy: balancedPolicy });
    const stripped = { ...career, retired: false, ...over };
    delete (stripped as { seasonParticipation?: unknown }).seasonParticipation;
    return stripped as Career;
  }

  it('loads without crashing', () => {
    expect(() => hydrateCareer(JSON.parse(JSON.stringify(oldSave())) as Career)).not.toThrow();
  });

  it('rebuilds the participation ledger rather than leaving on-field events ungated', () => {
    const loaded = hydrateCareer(oldSave());
    expect(loaded.seasonParticipation).toBeTruthy();
  });

  it('recalculates career totals from season records rather than trusting counters', () => {
    /*
     * The appearance breakdown is derived on read, so a save with a wrong stored counter gets the
     * right answer without a migration step at all - which is the point of deriving it.
     */
    const loaded = hydrateCareer(oldSave());
    const b = appearanceBreakdown(loaded);
    expect(b.maccabi + b.otherIsraeli + b.foreign).toBe(b.total);
  });

  it('removes a league title the recorded final position contradicts', () => {
    /*
     * The reported bug, already written into a save. A championship rolled from titleChance in a
     * season the club finished fifth is decidable - the world record holds the position - so it is
     * safely correctable on load.
     */
    const base = simulateCareer({ playerName: 'ש', position: 'CM', seed: 21, policy: balancedPolicy });
    const nonFirst = base.world.clubSeasons.find(
      (s) => s.finalPosition !== undefined && s.finalPosition > 1,
    );
    expect(nonFirst, 'fixture needs a non-first season').toBeTruthy();
    if (!nonFirst) return;

    const corrupted: Career = {
      ...base,
      retired: false,
      trophies: [
        ...base.trophies,
        {
          id: 'championship',
          name: 'אליפות',
          season: nonFirst.season,
          clubId: nonFirst.clubId,
          clubName: nonFirst.clubId,
          weight: 3,
        },
      ],
    };

    const loaded = hydrateCareer(corrupted);
    const stillThere = loaded.trophies.some(
      (t) => t.id === 'championship' && t.season === nonFirst.season && t.clubId === nonFirst.clubId,
    );
    expect(stillThere).toBe(false);
  });

  it('leaves a title alone when there is nothing to check it against', () => {
    /*
     * Conservative on purpose. A title whose season has no world record cannot be judged, and
     * destroying history on a guess is worse than an inconsistency.
     */
    const base = simulateCareer({ playerName: 'ש', position: 'CM', seed: 22, policy: balancedPolicy });
    const orphan: Career = {
      ...base,
      retired: false,
      trophies: [
        ...base.trophies,
        {
          id: 'championship',
          name: 'אליפות',
          season: 1999,
          clubId: MACCABI_ID,
          clubName: 'מכבי חיפה',
          weight: 3,
        },
      ],
    };
    const loaded = hydrateCareer(orphan);
    expect(loaded.trophies.some((t) => t.season === 1999)).toBe(true);
  });

  it('never touches a youth championship, which has no table to check', () => {
    const base = simulateCareer({ playerName: 'ש', position: 'CM', seed: 23, policy: balancedPolicy });
    const withYouth: Career = {
      ...base,
      retired: false,
      trophies: [
        ...base.trophies,
        {
          id: 'youth_championship',
          name: 'אליפות נוער',
          season: base.world.clubSeasons[0]?.season ?? 2040,
          clubId: base.world.clubSeasons[0]?.clubId ?? MACCABI_ID,
          clubName: 'x',
          weight: 1,
        },
      ],
    };
    expect(hydrateCareer(withYouth).trophies.some((t) => t.id === 'youth_championship')).toBe(true);
  });

  it('leaves a fresh career exactly as created', () => {
    const fresh = createCareer({ playerName: 'ש', position: 'CM', seed: 5 });
    expect(hydrateCareer(fresh)).toBe(fresh);
  });
});

/* ------------------------------------------------------------------ */

function season(
  seasonYear: number,
  clubId: string,
  stage: SeasonRecord['academyStage'],
  appearances: number,
): SeasonRecord {
  return {
    season: seasonYear,
    age: seasonYear - 2020,
    academyStage: stage,
    clubId,
    clubName: clubId,
    teamName: clubId,
    league: 'ליגה',
    onLoan: false,
    stats: {
      appearances,
      starts: Math.min(appearances, Math.round(appearances * 0.8)),
      goals: 2,
      assists: 1,
      cleanSheets: 0,
      goalsConceded: 0,
      rating: 70,
      injuredGames: 0,
    },
    firstHalf: null,
    ability: 70,
    role: 'starter',
    coachTrust: 65,
    trophies: [],
    captain: false,
    olderGroup: 'none',
  };
}

function careerWithSeasons(records: SeasonRecord[]): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'CM', seed: 9 }),
    seasonHistory: records,
  };
}

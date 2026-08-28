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
import { createCareer } from '../src/game/careerEngine';
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

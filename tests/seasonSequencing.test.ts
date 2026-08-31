/**
 * Season sequencing (v0.9.2, Phase 1): the cup final belongs at the END.
 *
 * Playtesting found the domestic cup final playable in the middle of the season, ahead of
 * ordinary league football. The cause was treating COMMITTED as ACTIVE: the engine decides the
 * cup run and its opponent at preseason, so the final is known months early. These tests hold
 * the distinction - known is not active - and the product rule it protects: the domestic cup
 * final is always the last playable match of a season.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { activeFixture, isFinalSeasonBeat, knownCupFinal } from '../src/game/fixture';
import { buildMatchday } from '../src/game/matchdayPresenter';
import { createRng } from '../src/game/random';
import { playFirstHalf } from '../src/game/seasonEngine';
import { openWorldSeason } from '../src/game/worldEngine';
import type { Career, CupRun } from '../src/types';

/** A senior career mid-season with a real simulated first half. */
function midSeason(seed = 5): Career {
  let career: Career = {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 72,
    roleValue: 62,
    currentSeason: 2044,
    seasonPoint: 'midseason',
    phase: 'mid_season',
  };
  career = { ...career, world: openWorldSeason(career, createRng(seed)) };
  career = playFirstHalf(career, createRng(seed + 1));
  return { ...career, seasonPoint: 'midseason', phase: 'mid_season' };
}

/** Commit a cup final the club reached, with a known opponent. */
function withFinal(career: Career, run: CupRun = 'winners'): Career {
  return {
    ...career,
    world: {
      ...career.world,
      cup: {
        season: career.currentSeason,
        clubId: career.currentClubId,
        trophyId: 'cup',
        run,
        finalOpponentId: 'hapoel_beer_sheva',
      },
    },
  };
}

/** Move a career to the settlement beat, with a settled season record. */
function atFinalBeat(career: Career): Career {
  return {
    ...career,
    seasonPoint: 'season_end',
    phase: 'season_result',
    lastSeasonRecord: {
      season: career.currentSeason,
      age: career.age,
      academyStage: 'senior',
      clubId: career.currentClubId,
      clubName: 'מכבי חיפה',
      teamName: 'מכבי חיפה',
      league: 'ליגת העל',
      leagueId: 'il_premier',
      teamGames: 43,
      onLoan: false,
      stats: {
        appearances: 30,
        starts: 27,
        goals: 9,
        assists: 4,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 66,
        injuredGames: 0,
      },
      ability: 74,
      role: 'starter',
      captain: false,
      olderGroup: 'none',
      trophies: [],
    } as never,
  };
}

describe('known is not active', () => {
  it('1+2: the final opponent is known at mid-season, and that is not the active fixture', () => {
    const career = withFinal(midSeason());
    const known = knownCupFinal(career);
    expect(known).not.toBeNull();
    expect(known!.opponentId).toBe('hapoel_beer_sheva');
    expect(isFinalSeasonBeat(career)).toBe(false);
  });

  it('3: the mid-season fixture is a league match, never the cup final', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const career = withFinal(midSeason(seed));
      const fixture = activeFixture(career);
      if (!fixture) continue;
      // The KIND is the invariant. The league may legitimately draw Beer Sheva as a league
      // opponent, so the opponent id alone proves nothing.
      expect(fixture.kind, `seed ${seed}`).not.toBe('cup_final');
    }
  });

  it('the mid-season matchday is likewise not the final', () => {
    const matchday = buildMatchday(withFinal(midSeason()));
    expect(matchday).not.toBeNull();
    expect(matchday!.fixture.kind).not.toBe('cup_final');
  });
});

describe('the final is the last playable match', () => {
  it('4: becomes active only at the final season beat', () => {
    const career = atFinalBeat(withFinal(midSeason()));
    expect(isFinalSeasonBeat(career)).toBe(true);
    const fixture = activeFixture(career)!;
    expect(fixture.kind).toBe('cup_final');
    expect(fixture.opponentClubId).toBe('hapoel_beer_sheva');
    expect(fixture.competition).toBe('גביע המדינה');
  });

  it('6+7: no league match exists at the final beat - not before it, not after', () => {
    /*
     * "Without a final" has to be explicit: the engine projects a cup run at preseason, and this
     * seed's club really did reach one - which is exactly why the bug existed.
     */
    const base = midSeason();
    const withoutFinal = atFinalBeat({ ...base, world: { ...base.world, cup: null } });
    expect(activeFixture(withoutFinal)).toBeNull();
    expect(buildMatchday(withoutFinal)).toBeNull();
  });

  it('9: a club that never reached the final is unaffected mid-season', () => {
    const career = midSeason(7);
    expect(knownCupFinal(career)).toBeNull();
    const fixture = activeFixture(career);
    if (fixture) expect(fixture.kind).toBe('league');
  });

  it('an early cup exit is not a final, at any beat', () => {
    const early: Career = {
      ...midSeason(),
      world: {
        ...midSeason().world,
        cup: {
          season: 2044,
          clubId: MACCABI_ID,
          trophyId: 'cup',
          run: 'quarter_final',
          finalOpponentId: null,
        },
      },
    };
    expect(knownCupFinal(early)).toBeNull();
    expect(activeFixture(atFinalBeat(early))).toBeNull();
  });
});

describe('the final tells its real stored result', () => {
  it('a won final ends with the club ahead', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const matchday = buildMatchday(atFinalBeat(withFinal(midSeason(seed), 'winners')));
      if (!matchday) continue;
      expect(matchday.fixture.kind).toBe('cup_final');
      expect(matchday.scoreFor, `seed ${seed}`).toBeGreaterThan(matchday.scoreAgainst);
    }
  });

  it('a lost final ends with the club behind', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const matchday = buildMatchday(atFinalBeat(withFinal(midSeason(seed), 'runner_up')));
      if (!matchday) continue;
      expect(matchday.scoreFor, `seed ${seed}`).toBeLessThan(matchday.scoreAgainst);
    }
  });

  it('5: the same beat always yields the same single final - it cannot be replayed differently', () => {
    const career = atFinalBeat(withFinal(midSeason()));
    const a = buildMatchday(career);
    const b = buildMatchday(career);
    expect(a).toEqual(b);
    expect(a!.fixture.id).toBe(`cup_final_${career.currentSeason}`);
  });
});

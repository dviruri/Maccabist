/**
 * THE fixture (v0.9.1, Phase 1): one match, one answer.
 *
 * The regression this file exists to make impossible: v0.9 showed Maccabi Netanya as the next
 * opponent on the career home and then kicked off against Maccabi Tel Aviv, because the home
 * screen and the matchday each derived an opponent independently. Every assertion below is a
 * different way of stating that they now cannot.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { activeFixture } from '../src/game/fixture';
import { buildMatchday } from '../src/game/matchdayPresenter';
import { createRng } from '../src/game/random';
import { playFirstHalf } from '../src/game/seasonEngine';
import { openWorldSeason } from '../src/game/worldEngine';
import type { Career, Position } from '../src/types';

function midSeason(position: Position, seed: number): Career {
  let career: Career = {
    ...createCareer({ playerName: 'ת', position, seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 72,
    roleValue: 62,
    currentSeason: 2044,
    seasonPoint: 'midseason',
  };
  career = { ...career, world: openWorldSeason(career, createRng(seed)) };
  career = playFirstHalf(career, createRng(seed + 1));
  return { ...career, seasonPoint: 'midseason' };
}

describe('the home screen and the matchday cannot disagree', () => {
  it('renders the same opponent, crest id, competition and venue', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = midSeason('ST', seed);
      const home = activeFixture(career);
      const matchday = buildMatchday(career);
      if (!home || !matchday) continue;
      // The matchday does not hold its own opponent - it holds THE fixture.
      expect(matchday.fixture.opponentClubId, `seed ${seed}`).toBe(home.opponentClubId);
      expect(matchday.fixture.opponentName).toBe(home.opponentName);
      expect(matchday.fixture.home).toBe(home.home);
      expect(matchday.fixture.competition).toBe(home.competition);
      expect(matchday.fixture.id).toBe(home.id);
    }
  });

  it('keeps home/away identity coherent: the player is in exactly one of the two slots', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const fixture = activeFixture(midSeason('CM', seed));
      if (!fixture) continue;
      const slots = [fixture.homeClubId, fixture.awayClubId];
      expect(slots).toContain(fixture.playerClubId);
      expect(slots).toContain(fixture.opponentClubId);
      expect(fixture.homeClubId).not.toBe(fixture.awayClubId);
      expect(fixture.home ? fixture.homeClubId : fixture.awayClubId).toBe(fixture.playerClubId);
    }
  });

  it('never plays the club against itself, and always picks a club in the league', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const fixture = activeFixture(midSeason('GK', seed));
      if (!fixture) continue;
      expect(fixture.opponentClubId).not.toBe(fixture.playerClubId);
      expect(fixture.opponentName.length).toBeGreaterThan(0);
    }
  });

  it('is stable: the same career state yields the same fixture every time', () => {
    const career = midSeason('ST', 9);
    const a = activeFixture(career);
    const b = activeFixture(career);
    expect(a).toEqual(b);
    // And it does not drift while the beat is unfinished - re-reading cannot move it.
    expect(activeFixture(career)?.opponentClubId).toBe(a?.opponentClubId);
  });
});

describe('stored competitions outrank the generic league beat', () => {
  it('a committed cup final names the engine’s own final opponent', () => {
    const base = midSeason('ST', 5);
    const career: Career = {
      ...base,
      world: {
        ...base.world,
        cup: {
          season: base.currentSeason,
          clubId: base.currentClubId,
          trophyId: 'cup',
          run: 'winners',
          finalOpponentId: 'hapoel_beer_sheva',
        },
      },
    };
    const fixture = activeFixture(career)!;
    expect(fixture.kind).toBe('cup_final');
    expect(fixture.opponentClubId).toBe('hapoel_beer_sheva');
    expect(fixture.competition).toBe('גביע המדינה');
    // The matchday follows it - not the league pairing it would otherwise have drawn.
    expect(buildMatchday(career)!.fixture.opponentClubId).toBe('hapoel_beer_sheva');
  });

  it('a stored European knockout tie beats the league beat, and keeps its own competition', () => {
    const base = midSeason('ST', 6);
    const career: Career = {
      ...base,
      world: {
        // Cleared so this test isolates European priority over the LEAGUE beat; a committed
        // cup final legitimately outranks both (see the ordering in activeFixture).
        ...base.world,
        cup: null,
        europe: {
          coefficients: { associations: {}, clubs: {} },
          history: [],
          current: {
            season: base.currentSeason,
            entries: [],
            winners: {} as never,
            maccabiJourney: null,
            playerJourney: {
              season: base.currentSeason,
              clubId: base.currentClubId,
              steps: [
                {
                  kind: 'tie',
                  tie: {
                    stage: 'r16',
                    competition: 'uefa_conference_league',
                    opponentId: 'fld_basel',
                    opponentName: 'באזל',
                    legs: [{ for: 1, against: 0, home: true }],
                    aggFor: 1,
                    aggAgainst: 0,
                    won: true,
                  },
                },
              ],
              finalCompetition: 'uefa_conference_league',
              furthest: 'r16',
              matches: 2,
              wonCompetition: null,
              reachedFinal: false,
              reachedSemiFinal: false,
              reachedLeaguePhase: true,
            },
          },
        },
      },
    };
    const fixture = activeFixture(career)!;
    expect(fixture.kind).toBe('european');
    expect(fixture.opponentClubId).toBe('fld_basel');
    expect(fixture.competitionId).toBe('uefa_conference_league');
    expect(fixture.competition).toBe('הקונפרנס ליג');
    expect(fixture.stage).toBe('שמינית הגמר');
    expect(buildMatchday(career)!.fixture.opponentName).toBe('באזל');
  });
});

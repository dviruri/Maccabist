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
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
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
  it('a committed cup final names the engine’s own final opponent - at the final beat', () => {
    /*
     * v0.9.2 changed this case deliberately. In v0.9.1 a committed final was active the moment
     * it was known, which put the final in the middle of the season; the rule now is that the
     * final is known early and played last. The assertion moved with the rule - the final still
     * names the engine's own opponent and still overrides the league pairing, but only at the
     * season's final beat. Mid-season non-eligibility is covered by seasonSequencing.test.ts.
     */
    const base = midSeason('ST', 5);
    const career: Career = {
      ...base,
      seasonPoint: 'season_end',
      phase: 'season_result',
      lastSeasonRecord: {
        ...base,
        season: base.currentSeason,
        clubId: base.currentClubId,
        clubName: 'מכבי חיפה',
        stats: base.firstHalfStats!,
      } as never,
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

  /*
   * INVERTED in v0.9.6, Phase 3.
   *
   * This used to assert that a stored European tie became the active fixture and that
   * `buildMatchday` presented it. Both were true and both were wrong:
   *
   *   - the journey already holds the REAL legs and aggregate, while `buildMatchday` has no
   *     per-match team results and invents a scoreline with `presentScore`. The Europe card could
   *     say the club went through 4-1 while the matchday screen showed 2-0, from one save.
   *   - the knockout step exists from the moment the European season is simulated - the first
   *     preseason beat - so a February tie was offered as "the next match" in July.
   *
   * v0.9.6 does not build a European calendar to fix that; it removes the claim. So the same
   * fixture that used to be European must now fall through to the LEAGUE beat, and Europe is
   * rendered only as the record it is.
   */
  it('never presents a stored European tie as a playable fixture', () => {
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
    const fixture = activeFixture(career);
    /*
     * The stored journey is untouched and still contains the tie - it just cannot become a
     * fixture. Whatever is presented, it is not the European opponent.
     */
    expect(career.world.europe?.current?.playerJourney?.steps.some((s) => s.kind === 'tie')).toBe(true);
    if (fixture) {
      expect(fixture.kind).not.toBe('european');
      expect(fixture.opponentClubId).not.toBe('fld_basel');
    }
    const matchday = buildMatchday(career);
    if (matchday) expect(matchday.fixture.opponentName).not.toBe('באזל');
  });

  it('offers no fixture that a stored result could contradict', () => {
    /*
     * The structural rule behind the inversion above, stated once: the only kinds the presenter
     * can produce are the two the game can tell the truth about. A league beat has no stored team
     * result to disagree with, and a cup final's result is fixed by `world.cup.run`, which the
     * presented scoreline is made to match.
     */
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 9500 + seed,
        policy: balancedPolicy,
        onStep: (c) => {
          const f = activeFixture(c);
          if (f) kinds.add(f.kind);
        },
      });
    }
    expect([...kinds].sort()).toEqual(['cup_final', 'league']);
  });
});

/**
 * The matchday presenter (v0.9, Phase 3): presentation that can never lie.
 *
 * The invariants the brief demands: a moment never contradicts the real statistics, keepers
 * get keeper matchdays, the presentation consumes nothing from the simulation stream, and the
 * same save renders the same matchday forever.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { buildMatchday } from '../src/game/matchdayPresenter';
import { openWorldSeason } from '../src/game/worldEngine';
import { createRng } from '../src/game/random';
import { playFirstHalf } from '../src/game/seasonEngine';
import type { Career, Position } from '../src/types';

/** A senior career mid-season, with a REAL first half played by the real engine. */
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

describe('matchday honesty', () => {
  it('shows a player goal only when the half really contains one', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = midSeason('ST', seed);
      const matchday = buildMatchday(career);
      if (!matchday) continue;
      const playerGoals = matchday.moments.filter((m) => m.kind === 'player_goal').length;
      const playerAssists = matchday.moments.filter((m) => m.kind === 'player_assist').length;
      expect(playerGoals, `seed ${seed}`).toBeLessThanOrEqual(career.firstHalfStats!.goals);
      expect(playerAssists, `seed ${seed}`).toBeLessThanOrEqual(career.firstHalfStats!.assists);
    }
  });

  it('gives keepers keeper matchdays: saves, never striker moments, no penalty saves', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = midSeason('GK', seed);
      const matchday = buildMatchday(career);
      if (!matchday) continue;
      for (const moment of matchday.moments) {
        expect(['player_goal', 'player_assist'], `seed ${seed}`).not.toContain(moment.kind);
        expect(moment.text).not.toContain('פנדל');
      }
      // A clean-sheet presentation requires a REAL clean sheet in the half.
      if (matchday.played && matchday.scoreAgainst === 0) {
        expect(career.firstHalfStats!.cleanSheets, `seed ${seed}`).toBeGreaterThan(0);
      }
    }
  });

  it('benches honestly: zero real appearances means no on-pitch player moments', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = midSeason('CM', seed);
      const matchday = buildMatchday(career);
      if (!matchday || matchday.played) continue;
      const onPitch = matchday.moments.filter((m) =>
        ['player_goal', 'player_assist', 'save', 'big_save', 'chance'].includes(m.kind),
      );
      expect(onPitch, `seed ${seed}`).toEqual([]);
    }
  });

  it('keeps the scoreboard equal to the story: goal moments sum to the final score', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const matchday = buildMatchday(midSeason('WG', seed));
      if (!matchday) continue;
      // player_assist is the assisted goal itself, so it counts toward the score.
      const forMoments = matchday.moments.filter(
        (m) => m.kind === 'player_goal' || m.kind === 'team_goal' || m.kind === 'player_assist',
      ).length;
      const againstMoments = matchday.moments.filter((m) => m.kind === 'conceded').length;
      expect(forMoments).toBe(matchday.scoreFor);
      expect(againstMoments).toBe(matchday.scoreAgainst);
    }
  });

  it('is deterministic and consumes nothing from the career', () => {
    const career = midSeason('ST', 7);
    const a = buildMatchday(career);
    const b = buildMatchday(career);
    expect(a).toEqual(b);
    // The career object is untouched by rendering its matchday.
    expect(career.rngState).toBe(midSeason('ST', 7).rngState);
  });

  it('presents a real opponent from the real table', () => {
    const matchday = buildMatchday(midSeason('ST', 11));
    expect(matchday).not.toBeNull();
    expect(matchday!.context.opponentClubId).not.toBe(MACCABI_ID);
    expect(matchday!.context.opponentName.length).toBeGreaterThan(0);
  });
});

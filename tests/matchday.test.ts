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
import { scoringSide } from '../src/game/matchScore';
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
    // v0.9.1: the matchday holds THE fixture, not its own opponent.
    expect(matchday!.fixture.opponentClubId).not.toBe(MACCABI_ID);
    expect(matchday!.fixture.opponentName.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Substitute chronology (v0.9.6.6)                                    */
/* ------------------------------------------------------------------ */

/**
 * The beta bug: the player was shown starting on the bench and then scored in the 24th minute.
 *
 * `played` and `started` both existed, but nothing modelled the moment a substitute actually
 * walked on, so every player-owned minute was drawn from the full ninety. Reproduced before the
 * fix across 60 careers: 222 of 229 bench matchdays carried a player-owned moment with no
 * substitution at all, the earliest at minute 8.
 */

const PLAYER_OWNED = ['player_goal', 'player_assist', 'chance', 'save', 'big_save'] as const;

function ownedMoments(matchday: NonNullable<ReturnType<typeof buildMatchday>>) {
  return matchday.moments.filter((moment) =>
    (PLAYER_OWNED as readonly string[]).includes(moment.kind),
  );
}

/** Every presented matchday across a wide sweep, so the invariants are checked on real data. */
function sweep(seeds: number, positions: readonly Position[]) {
  const out: { career: Career; matchday: NonNullable<ReturnType<typeof buildMatchday>> }[] = [];
  for (const position of positions) {
    for (let seed = 1; seed <= seeds; seed += 1) {
      const career = midSeason(position, seed);
      const matchday = buildMatchday(career);
      if (matchday) out.push({ career, matchday });
    }
  }
  return out;
}

const ALL_POSITIONS: readonly Position[] = ['ST', 'CM', 'CB', 'GK', 'WG', 'FB'];

describe('a substitute is on the pitch before he does anything', () => {
  const presented = sweep(40, ALL_POSITIONS);
  const benched = presented.filter(({ matchday }) => matchday.played && !matchday.started);

  it('finds enough bench matchdays for the sweep to mean something', () => {
    expect(presented.length).toBeGreaterThan(50);
    expect(benched.length, 'no bench matchday in the sweep - these tests prove nothing').toBeGreaterThan(5);
  });

  it('gives a bench player exactly one entry moment, in the substitute window', () => {
    for (const { matchday } of benched) {
      const subs = matchday.moments.filter((moment) => moment.kind === 'sub_on');
      expect(subs).toHaveLength(1);
      expect(subs[0]!.minute).toBeGreaterThanOrEqual(46);
      expect(subs[0]!.minute).toBeLessThanOrEqual(75);
      expect(matchday.enteredAt).toBe(subs[0]!.minute);
    }
  });

  it('never lets a substitute score, assist, threaten or save before he came on', () => {
    /* This is the reported bug, as an invariant: no player-owned minute may precede the entry. */
    let checked = 0;
    for (const { matchday } of benched) {
      const entry = matchday.moments.find((moment) => moment.kind === 'sub_on')!.minute;
      for (const moment of ownedMoments(matchday)) {
        checked += 1;
        expect(
          moment.minute,
          `${moment.kind} at ${moment.minute}' but the substitution was at ${entry}'`,
        ).toBeGreaterThan(entry);
      }
    }
    expect(checked, 'no player-owned moment on any bench matchday').toBeGreaterThan(0);
  });

  it('specifically never shows a bench goal or assist before the substitution', () => {
    let scoring = 0;
    for (const { matchday } of benched) {
      const entry = matchday.enteredAt!;
      for (const moment of matchday.moments) {
        if (moment.kind !== 'player_goal' && moment.kind !== 'player_assist') continue;
        scoring += 1;
        expect(moment.minute, `${moment.kind} at ${moment.minute}' vs entry ${entry}'`).toBeGreaterThan(entry);
      }
    }
    expect(scoring, 'no substitute goal or assist in the sweep').toBeGreaterThan(0);
  });

  it('keeps a substitute keeper from saving before he is between the posts', () => {
    const keepers = sweep(120, ['GK']).filter(
      ({ matchday }) => matchday.played && !matchday.started,
    );
    expect(keepers.length, 'no substitute keeper in the sweep').toBeGreaterThan(0);
    let saves = 0;
    for (const { matchday } of keepers) {
      const entry = matchday.enteredAt!;
      for (const moment of matchday.moments) {
        if (moment.kind !== 'save' && moment.kind !== 'big_save') continue;
        saves += 1;
        expect(moment.minute).toBeGreaterThan(entry);
      }
    }
    expect(saves, 'no substitute keeper save in the sweep').toBeGreaterThan(0);
  });

  it('keeps a substitute outfielder from having a chance before he came on', () => {
    let chances = 0;
    for (const { matchday } of benched) {
      const entry = matchday.enteredAt!;
      for (const moment of matchday.moments) {
        if (moment.kind !== 'chance') continue;
        chances += 1;
        expect(moment.minute).toBeGreaterThan(entry);
      }
    }
    expect(chances, 'no substitute chance in the sweep').toBeGreaterThan(0);
  });

  it('leaves team goals scored before the substitution as team goals', () => {
    /* The point of moving minutes rather than labels: early goals still happened, without him. */
    let earlyTeamGoals = 0;
    for (const { matchday } of benched) {
      const entry = matchday.enteredAt!;
      for (const moment of matchday.moments) {
        if (moment.minute >= entry) continue;
        if (moment.kind === 'team_goal') earlyTeamGoals += 1;
        expect(['player_goal', 'player_assist']).not.toContain(moment.kind);
      }
    }
    expect(earlyTeamGoals, 'no pre-substitution team goal in the sweep').toBeGreaterThan(0);
  });
});

describe('starters and non-participants', () => {
  const presented = sweep(40, ALL_POSITIONS);

  it('never invents a substitution for a player who started', () => {
    const starters = presented.filter(({ matchday }) => matchday.started);
    expect(starters.length).toBeGreaterThan(5);
    for (const { matchday } of starters) {
      expect(matchday.moments.some((moment) => moment.kind === 'sub_on')).toBe(false);
      expect(matchday.enteredAt).toBeNull();
    }
  });

  it('gives a player who did not play no substitution and no moments of his own', () => {
    /*
     * Built explicitly rather than fished out of the sweep. A senior regular at this ability
     * always plays, so a filtered version of this test passed by checking nothing - which is what
     * the pre-existing bench test had been doing.
     */
    let checked = 0;
    for (const position of ALL_POSITIONS) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const base = midSeason(position, seed);
        const absent: Career = {
          ...base,
          firstHalfStats: {
            ...base.firstHalfStats!,
            appearances: 0,
            starts: 0,
            goals: 0,
            assists: 0,
            cleanSheets: 0,
          },
        };
        const matchday = buildMatchday(absent);
        if (!matchday) continue;
        checked += 1;
        expect(matchday.played).toBe(false);
        expect(matchday.started).toBe(false);
        expect(matchday.moments.some((moment) => moment.kind === 'sub_on')).toBe(false);
        expect(matchday.enteredAt).toBeNull();
        expect(ownedMoments(matchday)).toHaveLength(0);
      }
    }
    expect(checked, 'no did-not-play matchday could be built').toBeGreaterThan(10);
  });
});

describe('the substitution changes the story, not the scoreboard', () => {
  const presented = sweep(40, ALL_POSITIONS);

  it('reconciles every scoreline exactly, with sub_on counting for nothing', () => {
    for (const { matchday } of presented) {
      const forClub = matchday.moments.filter(
        (moment) => scoringSide(moment.kind) === 'player_club',
      ).length;
      const against = matchday.moments.filter(
        (moment) => scoringSide(moment.kind) === 'opponent_club',
      ).length;
      expect(forClub).toBe(matchday.scoreFor);
      expect(against).toBe(matchday.scoreAgainst);
      expect(scoringSide('sub_on')).toBeNull();
    }
  });

  it('keeps the timeline sorted, with kickoff first and full time last', () => {
    for (const { matchday } of presented) {
      const minutes = matchday.moments.map((moment) => moment.minute);
      expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
      expect(matchday.moments[0]!.kind).toBe('kickoff');
      expect(matchday.moments[matchday.moments.length - 1]!.kind).toBe('full_time');
    }
  });

  it('puts the substitution before anything else drawn on the same minute', () => {
    for (const { matchday } of presented) {
      const index = matchday.moments.findIndex((moment) => moment.kind === 'sub_on');
      if (index < 0) continue;
      const entry = matchday.moments[index]!.minute;
      for (let i = 0; i < index; i += 1) {
        const earlier = matchday.moments[i]!;
        if (earlier.kind === 'kickoff') continue;
        expect(earlier.minute).toBeLessThan(entry);
      }
    }
  });
});

describe('the substitution is presentation only', () => {
  it('renders identically every time and consumes nothing from the career', () => {
    for (const position of ALL_POSITIONS) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const career = midSeason(position, seed);
        const before = career.rngState;
        const snapshot = JSON.stringify(career);
        const first = buildMatchday(career);
        const second = buildMatchday(career);
        expect(second).toEqual(first);
        expect(career.rngState).toBe(before);
        expect(JSON.stringify(career)).toBe(snapshot);
      }
    }
  });
});

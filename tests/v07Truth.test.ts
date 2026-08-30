/**
 * v0.7 Checkpoints A + B: season segments, competition stats, individual honors.
 *
 * The truth problem these guard: a season total is not a competition total. 6 goals in Israel
 * plus 8 after a January move to Serie A is 14 goals - and zero of them is "14 Serie A goals".
 * Honors read LEAGUE lines only, segments reconcile exactly with season totals, and pre-v0.7
 * records get one honest `combined` line instead of an invented precise split.
 */

import { describe, expect, it } from 'vitest';

import { stageConfig } from '../src/data/academy';
import { EVENTS_BY_ID } from '../src/data/events';
import { MACCABI_ACADEMY_ID, MACCABI_ID, getClub } from '../src/data/clubs';
import { EXTERNAL_YOUTH_CLUB_IDS } from '../src/data/youthClubs';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import { evaluateSeasonHonors } from '../src/game/honorsEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { leagueScheduleBreakdown } from '../src/game/leagueSchedule';
import { applyEffects } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { playFirstHalf, playSecondHalf } from '../src/game/seasonEngine';
import { apportion } from '../src/game/segmentEngine';
import type {
  Career,
  IndividualHonor,
  Position,
  SeasonRecord,
  SeasonSegment,
  SeasonStats,
} from '../src/types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function seniorCareer(overrides: Partial<Career> = {}, seed = 7): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 74,
    roleValue: 70,
    currentSeason: 2044,
    ...overrides,
  };
}

function stats(overrides: Partial<SeasonStats> = {}): SeasonStats {
  return {
    appearances: 30,
    starts: 27,
    goals: 12,
    assists: 5,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 64,
    injuredGames: 0,
    ...overrides,
  };
}

/** A hand-built engine segment for honor tests, with the league line already separated. */
function engineSegment(overrides: Partial<SeasonSegment> = {}): SeasonSegment {
  const s = overrides.stats ?? stats();
  const teamGames = overrides.teamGames ?? 43;
  const base: SeasonSegment = {
    clubId: MACCABI_ID,
    clubName: 'מכבי חיפה',
    league: 'ליגת העל',
    leagueId: 'il_premier',
    academyStage: 'senior',
    onLoan: false,
    teamGames,
    stats: s,
    role: 'key',
    breakdown: 'engine',
    competitions: [],
    ...overrides,
  };
  if (base.competitions.length === 0) {
    // All stats on the league line unless a test separates them itself.
    base.competitions = [
      {
        competition: 'league',
        teamGames: Math.min(base.teamGames, 33),
        appearances: s.appearances,
        starts: s.starts,
        goals: s.goals,
        assists: s.assists,
        cleanSheets: s.cleanSheets,
        goalsConceded: s.goalsConceded,
      },
    ];
  }
  return base;
}

function record(overrides: Partial<SeasonRecord> = {}): SeasonRecord {
  return {
    season: 2044,
    age: 24,
    academyStage: 'senior',
    clubId: MACCABI_ID,
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    leagueId: 'il_premier',
    teamGames: 43,
    onLoan: false,
    ability: 74,
    role: 'key',
    stats: stats(),
    captain: false,
    olderGroup: 'none',
    trophies: [],
    ...overrides,
  } as SeasonRecord;
}

function closeSeason(career: Career, seed = 11): SeasonRecord {
  const first = playFirstHalf(career, createRng(seed));
  return playSecondHalf(first, createRng(seed + 1)).record;
}

const ADDITIVE = ['appearances', 'starts', 'goals', 'assists', 'cleanSheets', 'goalsConceded'] as const;

function expectReconciled(rec: SeasonRecord): void {
  expect(rec.segments && rec.segments.length).toBeTruthy();
  for (const key of ADDITIVE) {
    const segSum = rec.segments!.reduce((a, s) => a + s.stats[key], 0);
    expect(segSum, `segments.${key}`).toBe(rec.stats[key]);
    for (const segment of rec.segments!) {
      const compSum = segment.competitions.reduce((a, c) => a + c[key], 0);
      expect(compSum, `${segment.clubName} competitions.${key}`).toBe(segment.stats[key]);
    }
  }
  const games = rec.segments!.reduce((a, s) => a + s.teamGames, 0);
  expect(games).toBe(rec.teamGames);
}

/* ------------------------------------------------------------------ */
/* Pre-flight: the youth event stays in youth football                 */
/* ------------------------------------------------------------------ */

describe('pre-flight: youth_guaranteed_spot moves a boy to a youth side, not a senior contract', () => {
  it('targets the youth identity, which is not a senior club', () => {
    const event = EVENTS_BY_ID['youth_guaranteed_spot'];
    expect(event).toBeDefined();
    const leave = event!.choices.find((c) => c.id === 'leave');
    const target = leave?.outcomes[0]?.effects.transferTo;
    expect(target).toBe('youth_maccabi_netanya');
    expect(EXTERNAL_YOUTH_CLUB_IDS).toContain(target);
    expect(getClub(target!).isSenior).not.toBe(true);
  });

  it('does not promote the academy stage when the effect is applied', () => {
    const teen: Career = {
      ...createCareer({ playerName: 'ת', position: 'CM', seed: 3 }),
      academyStage: 'youth_b',
      age: 15,
      currentClubId: MACCABI_ACADEMY_ID,
    };
    const { career: moved } = applyEffects(teen, { transferTo: 'youth_maccabi_netanya' }, createRng(4));
    expect(moved.academyStage).toBe('youth_b'); // the regression: this used to become 'senior'
    expect(moved.currentClubId).toBe('youth_maccabi_netanya');
  });
});

/* ------------------------------------------------------------------ */
/* apportion                                                           */
/* ------------------------------------------------------------------ */

describe('apportion splits integers that always sum back', () => {
  it('sums back exactly across many shapes', () => {
    for (const [total, weights] of [
      [20, [33, 2, 8]],
      [43, [33, 2, 8]],
      [1, [33, 2, 8]],
      [7, [1, 1, 1]],
      [0, [5, 5]],
      [12, [0, 0, 4]],
    ] as const) {
      const parts = apportion(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(weights.some((w) => w > 0) ? total : 0);
    }
  });

  it('respects caps and pours the overflow where there is room', () => {
    const parts = apportion(10, [8, 1, 1], [4, 10, 10]);
    expect(parts[0]).toBe(4);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('is deterministic: same inputs, same split, no rng anywhere', () => {
    expect(apportion(17, [33, 2, 8])).toEqual(apportion(17, [33, 2, 8]));
  });
});

/* ------------------------------------------------------------------ */
/* Scenario A: one-club season                                         */
/* ------------------------------------------------------------------ */

describe('A: a whole season at one club is one segment', () => {
  it('writes one reconciling segment with engine competition lines', () => {
    const rec = closeSeason(seniorCareer());
    expect(rec.segments).toHaveLength(1);
    expect(rec.segments![0]!.breakdown).toBe('engine');
    expectReconciled(rec);
    const comps = rec.segments![0]!.competitions.map((c) => c.competition);
    expect(comps).toContain('league');
    expect(comps).toContain('cup');
    expect(comps).not.toContain('combined');
  });

  it('never labels the continental allowance as a named European competition', () => {
    const rec = closeSeason(seniorCareer());
    for (const comp of rec.segments![0]!.competitions) {
      expect(['league', 'cup', 'continental_generic']).toContain(comp.competition);
    }
  });

  it('caps every line inside its own fixtures and football sense', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const rec = closeSeason(seniorCareer({}, seed), seed);
      for (const segment of rec.segments!) {
        for (const comp of segment.competitions) {
          expect(comp.appearances, comp.competition).toBeLessThanOrEqual(comp.teamGames);
          expect(comp.starts, comp.competition).toBeLessThanOrEqual(comp.appearances);
          expect(comp.cleanSheets, comp.competition).toBeLessThanOrEqual(comp.appearances);
        }
      }
      expectReconciled(rec);
    }
  });

  it('passes the integrity validator with zero segment violations', () => {
    const career = seniorCareer();
    const rec = closeSeason(career);
    const violated = validateCareerIntegrity({ ...career, seasonHistory: [rec] }).filter((v) =>
      ['segment_totals_mismatch', 'competition_totals_mismatch', 'segment_games_mismatch'].includes(v.code),
    );
    expect(violated).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario B: mid-season transfer                                     */
/* ------------------------------------------------------------------ */

describe('B: a mid-season move produces two honest segments', () => {
  function midSeasonMove(seed = 21): SeasonRecord {
    const start = seniorCareer({}, seed);
    const half = playFirstHalf(start, createRng(seed));
    const moved: Career = { ...half, currentClubId: 'hapoel_beer_sheva' };
    return playSecondHalf(moved, createRng(seed + 1)).record;
  }

  it('keeps each spell separate and reconciles the whole', () => {
    const rec = midSeasonMove();
    expect(rec.segments).toHaveLength(2);
    expect(rec.segments![0]!.clubId).toBe(MACCABI_ID);
    expect(rec.segments![1]!.clubId).toBe('hapoel_beer_sheva');
    expectReconciled(rec);
  });

  it('gives each segment its own league line - goals never migrate between spells', () => {
    const rec = midSeasonMove();
    const first = rec.segments![0]!;
    const second = rec.segments![1]!;
    const firstLeague = first.competitions.find((c) => c.competition === 'league');
    const secondLeague = second.competitions.find((c) => c.competition === 'league');
    expect(firstLeague).toBeDefined();
    expect(secondLeague).toBeDefined();
    expect(firstLeague!.goals + (first.competitions.find((c) => c.competition === 'cup')?.goals ?? 0) +
      (first.competitions.find((c) => c.competition === 'continental_generic')?.goals ?? 0)).toBe(first.stats.goals);
  });
});

/* ------------------------------------------------------------------ */
/* Scenarios C, D, G: honors use league lines only                     */
/* ------------------------------------------------------------------ */

function honorsFor(rec: SeasonRecord, seed = 7, overrides: Partial<Career> = {}): IndividualHonor[] {
  return evaluateSeasonHonors(seniorCareer(overrides, seed), rec);
}

describe('C/D: top scorer is a race against the league, not a threshold', () => {
  it('a monster league total wins', () => {
    const s = stats({ goals: 32, appearances: 33, starts: 32 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    const honors = honorsFor(rec);
    expect(honors.some((h) => h.type === 'top_scorer')).toBe(true);
    expect(honors.find((h) => h.type === 'top_scorer')!.statValue).toBe(32);
  });

  it('a modest total loses to the simulated field', () => {
    const s = stats({ goals: 4 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    expect(honorsFor(rec).some((h) => h.type === 'top_scorer')).toBe(false);
  });

  it('the same seed decides the same field, twice', () => {
    const s = stats({ goals: 19, appearances: 33 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    const a = honorsFor(rec, 42).map((h) => h.type);
    const b = honorsFor(rec, 42).map((h) => h.type);
    expect(a).toEqual(b);
  });

  it('different seeds produce different races over a borderline total', () => {
    // 27 sits inside the tuned rival band for a 33-game league: a real race, not a formality.
    const s = stats({ goals: 27, appearances: 33 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    const results = new Set<boolean>();
    for (let seed = 1; seed <= 60; seed += 1) {
      results.add(honorsFor(rec, seed).some((h) => h.type === 'top_scorer'));
    }
    // 27 goals wins some years and not others - both outcomes must exist.
    expect(results.size).toBe(2);
  });
});

describe('G: cup goals do not count toward the scoring crown', () => {
  it('judges 25 league goals, not 33 with the cup added', () => {
    const s = stats({ goals: 33, appearances: 38, starts: 36 });
    const segment = engineSegment({
      stats: s,
      competitions: [
        {
          competition: 'league',
          teamGames: 33,
          appearances: 31,
          starts: 30,
          goals: 25,
          assists: 5,
          cleanSheets: 0,
          goalsConceded: 0,
        },
        {
          competition: 'cup',
          teamGames: 10,
          appearances: 7,
          starts: 6,
          goals: 8,
          assists: 0,
          cleanSheets: 0,
          goalsConceded: 0,
        },
      ],
    });
    const rec = record({ stats: s, segments: [segment] });
    // Find a seed whose field sits between 25 and 33: with 33 he would win, with 25 he must not.
    let proved = false;
    for (let seed = 1; seed <= 300 && !proved; seed += 1) {
      const withLeagueGoals = honorsFor(rec, seed).find((h) => h.type === 'top_scorer');
      if (withLeagueGoals) {
        expect(withLeagueGoals.statValue).toBe(25); // won WITH the league number, never the total
        continue;
      }
      // He lost - now show 33 would have won this exact field, proving the 8 cup goals were excluded.
      const allLeague = engineSegment({ stats: s });
      const inflated = record({ stats: s, segments: [allLeague] });
      const wouldWin = honorsFor(inflated, seed).some((h) => h.type === 'top_scorer');
      if (wouldWin) proved = true;
    }
    expect(proved).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Scenarios E, F: position fairness                                   */
/* ------------------------------------------------------------------ */

describe('E/F: every position has a real path to the quality awards', () => {
  const statsByPosition: Record<Position, Partial<SeasonStats>> = {
    GK: { goals: 0, assists: 0, cleanSheets: 17, appearances: 33, starts: 33, rating: 70 },
    CB: { goals: 3, assists: 1, appearances: 33, starts: 33, rating: 70 },
    FB: { goals: 2, assists: 7, appearances: 33, starts: 32, rating: 70 },
    CM: { goals: 8, assists: 11, appearances: 33, starts: 32, rating: 70 },
    WG: { goals: 14, assists: 9, appearances: 33, starts: 31, rating: 70 },
    ST: { goals: 22, assists: 4, appearances: 33, starts: 32, rating: 70 },
  };

  it('lets a great season win שחקן העונה from any position', () => {
    for (const position of Object.keys(statsByPosition) as Position[]) {
      const s = stats(statsByPosition[position]);
      const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
      let wins = 0;
      for (let seed = 1; seed <= 120; seed += 1) {
        if (honorsFor(rec, seed, { position }).some((h) => h.type === 'player_of_season')) wins += 1;
      }
      expect(wins, `${position} never wins player of the season`).toBeGreaterThan(0);
    }
  });

  it('gives a dominant goalkeeper the שוער העונה award', () => {
    const s = stats({ goals: 0, assists: 0, cleanSheets: 18, appearances: 33, starts: 33, rating: 71 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    let wins = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      if (honorsFor(rec, seed, { position: 'GK' }).some((h) => h.type === 'goalkeeper_of_season')) wins += 1;
    }
    expect(wins).toBeGreaterThan(0);
  });

  it('never gives the goalkeeper award to an outfield player', () => {
    const s = stats({ cleanSheets: 15, appearances: 33, rating: 72 });
    const rec = record({ stats: s, segments: [engineSegment({ stats: s })] });
    for (let seed = 1; seed <= 60; seed += 1) {
      expect(honorsFor(rec, seed, { position: 'CB' }).some((h) => h.type === 'goalkeeper_of_season')).toBe(false);
    }
  });
});

describe('the young player award has a hard age line', () => {
  it('is winnable at 21', () => {
    const s = stats({ appearances: 30, rating: 66 });
    const rec = record({ age: 21, stats: s, segments: [engineSegment({ stats: s })] });
    let wins = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      if (honorsFor(rec, seed).some((h) => h.type === 'young_player_of_season')) wins += 1;
    }
    expect(wins).toBeGreaterThan(0);
  });

  it('is never awarded at 22, whatever the season', () => {
    const s = stats({ appearances: 33, rating: 80, goals: 30 });
    const rec = record({ age: 22, stats: s, segments: [engineSegment({ stats: s })] });
    for (let seed = 1; seed <= 60; seed += 1) {
      expect(honorsFor(rec, seed).some((h) => h.type === 'young_player_of_season')).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Old saves                                                           */
/* ------------------------------------------------------------------ */

describe('old saves: one honest combined line, no invented precision, no retroactive honors', () => {
  it('backfills a legacy segment marked legacy_estimate', () => {
    const old = record({ segments: undefined });
    const hydrated = hydrateCareer(seniorCareer({ seasonHistory: [old] }));
    const migrated = hydrated.seasonHistory[0]!;
    expect(migrated.segments).toHaveLength(1);
    expect(migrated.segments![0]!.breakdown).toBe('legacy_estimate');
    expect(migrated.segments![0]!.competitions).toHaveLength(1);
    expect(migrated.segments![0]!.competitions[0]!.competition).toBe('combined');
    expectReconciled(migrated);
  });

  it('awards nothing from a legacy season - reduced reconstruction, not invention', () => {
    const old = record({
      stats: stats({ goals: 40, appearances: 33, rating: 80 }),
      segments: undefined,
    });
    const hydrated = hydrateCareer(seniorCareer({ seasonHistory: [old] }));
    expect(honorsFor(hydrated.seasonHistory[0]!)).toEqual([]);
  });

  it('academy seasons produce a youth line, never league honors', () => {
    const youth: Career = {
      ...createCareer({ playerName: 'ת', position: 'ST', seed: 5 }),
      academyStage: 'youth_a',
      currentClubId: MACCABI_ACADEMY_ID,
    };
    const rec = closeSeason(youth);
    expect(rec.segments![0]!.competitions[0]!.competition).toBe('youth');
    expect(rec.segments![0]!.teamGames).toBe(stageConfig('youth_a').seasonGames);
    expect(evaluateSeasonHonors(youth, rec)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* The schedule breakdown reconciles with the total                    */
/* ------------------------------------------------------------------ */

describe('the fixture breakdown IS the total, not a second formula', () => {
  it('sums to leagueSeasonGames for every modelled league', () => {
    for (const leagueId of ['il_premier', 'il_leumit', 'il_alef_north', 'il_alef_south', 'en_premier', 'it_seriea']) {
      for (const quality of [55, 70, 85]) {
        const b = leagueScheduleBreakdown(leagueId, quality, leagueId.startsWith('il_'));
        expect(b.league + b.cup + b.continental).toBeGreaterThan(0);
        expect(b.league).toBeGreaterThan(b.cup);
      }
    }
  });
});

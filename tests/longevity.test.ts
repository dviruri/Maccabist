/**
 * v0.4.1 Phase 3 / Phase 10: how long careers last, and why goalkeepers were behind.
 *
 * Two separate problems that turned out to share a cause — the model had the right ideas and never
 * got to express them.
 *
 * Longevity: every position retired at 36/37/38 with no spread whatsoever, because the simulation
 * policies said "retire at 36" and the retirement model was never consulted.
 *
 * Goalkeepers: they trailed on every career metric, and none of it was because goalkeeping is
 * hard. A keeper was scored against a goal output he can never produce, and the Legend Score's
 * contribution component multiplied his (zero) goals by a compensation factor, which scales to
 * zero.
 */

import { describe, expect, it } from 'vitest';

import { POSITIONS, RETIREMENT } from '../src/game/balance';
import {
  createCareer,
  forcedRetirementAge,
  retirementChance,
  retirementWindow,
} from '../src/game/careerEngine';
import { outputScore } from '../src/game/rules';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, Position, SeasonRecord } from '../src/types';

const senior = (position: Position, over: Partial<Career> = {}): Career => {
  const career = createCareer({ playerName: 'ל', position, seed: 5 });
  const record: SeasonRecord = {
    season: 2050,
    age: 30,
    academyStage: 'senior',
    clubId: 'maccabi_haifa',
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    onLoan: false,
    stats: {
      appearances: 30,
      starts: 28,
      goals: 4,
      assists: 3,
      cleanSheets: 10,
      goalsConceded: 30,
      rating: 62,
      injuredGames: 0,
    },
    firstHalf: null,
    ability: 70,
    role: 'starter',
    coachTrust: 60,
    trophies: [],
    captain: false,
    olderGroup: 'none',
  };
  return {
    ...career,
    academyStage: 'senior',
    currentClubId: 'maccabi_haifa',
    age: 30,
    ability: 70,
    peakAbility: 72,
    roleValue: 55,
    lastSeasonRecord: record,
    ...over,
  };
};

/** Retirement ages of careers that actually reached senior football. */
function retirementAges(position: Position, count = 400): number[] {
  const ages: number[] = [];
  for (let seed = 1; seed <= count; seed += 1) {
    const career = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
    // An academy release is not a retirement age.
    if (career.seasonHistory.some((s) => s.academyStage === 'senior')) {
      ages.push(career.retirementAge ?? career.age);
    }
  }
  return ages;
}

const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
const quantile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
};

describe('the retirement window', () => {
  it('opens later for a goalkeeper, at both ends', () => {
    expect(retirementWindow(senior('GK')).pressureFrom).toBeGreaterThan(
      retirementWindow(senior('CM')).pressureFrom,
    );
    expect(forcedRetirementAge(senior('GK'))).toBeGreaterThan(forcedRetirementAge(senior('CM')));
  });

  it('applies no pressure before the window opens', () => {
    expect(retirementChance(senior('CM', { age: 26 }))).toBe(0);
    expect(retirementChance(senior('GK', { age: 32 }))).toBe(0);
  });

  it('builds with age once it is open', () => {
    const at = (age: number): number => retirementChance(senior('CM', { age }));
    expect(at(32)).toBeGreaterThan(0);
    expect(at(35)).toBeGreaterThan(at(32));
    expect(at(38)).toBeGreaterThan(at(35));
  });

  it('is driven by context, not only by age', () => {
    const playing = senior('CM', { age: 34 });
    const notPlaying: Career = {
      ...playing,
      lastSeasonRecord: {
        ...(playing.lastSeasonRecord as SeasonRecord),
        stats: { ...(playing.lastSeasonRecord as SeasonRecord).stats, appearances: 3 },
      },
    };
    expect(retirementChance(notPlaying)).toBeGreaterThan(retirementChance(playing));

    const declined = senior('CM', { age: 34, ability: 55, peakAbility: 80 });
    expect(retirementChance(declined)).toBeGreaterThan(retirementChance(playing));

    const benched = senior('CM', { age: 34, roleValue: 15 });
    expect(retirementChance(benched)).toBeGreaterThan(retirementChance(playing));
  });

  it('lets a player who is still excellent carry on', () => {
    const ordinary = senior('CM', { age: 35, ability: 66 });
    const excellent = senior('CM', { age: 35, ability: 88, peakAbility: 88 });
    expect(retirementChance(excellent)).toBeLessThan(retirementChance(ordinary));
  });

  it('gives a collapsed career an exit before its window would open', () => {
    /*
     * A goalkeeper whose level had gone at 31 previously had no exit at all: the goalkeeping
     * window does not open until 34, so the model offered him nothing. Measurement shows this
     * state is rare in practice - keepers decline slowly - so it is a safety valve rather than a
     * fix, and it is tested here because a guard that can never fire is dead code.
     */
    const collapsed = senior('GK', {
      age: 30,
      ability: 55,
      peakAbility: 75,
      lastSeasonRecord: {
        ...(senior('GK').lastSeasonRecord as SeasonRecord),
        stats: { ...(senior('GK').lastSeasonRecord as SeasonRecord).stats, appearances: 2 },
      },
    });
    expect(collapsed.age).toBeLessThan(retirementWindow(collapsed).pressureFrom);
    expect(retirementChance(collapsed)).toBeGreaterThan(0);
  });
});

describe('career length across simulated careers', () => {
  it('ends most outfield careers in the low-to-mid thirties', () => {
    const ages = retirementAges('CM');
    expect(mean(ages)).toBeGreaterThan(32);
    expect(mean(ages)).toBeLessThan(36);
    expect(quantile(ages, 0.5)).toBeGreaterThanOrEqual(33);
    expect(quantile(ages, 0.5)).toBeLessThanOrEqual(36);
  });

  it('gives outfield careers a real spread rather than one age', () => {
    // The v0.4 defect: p10 and p90 were both 36-38 for every position.
    const ages = retirementAges('ST');
    expect(quantile(ages, 0.9) - quantile(ages, 0.1)).toBeGreaterThanOrEqual(2);
    expect(new Set(ages).size).toBeGreaterThan(4);
  });

  it('keeps goalkeepers going noticeably longer', () => {
    const keepers = retirementAges('GK');
    const outfield = retirementAges('CB');
    expect(mean(keepers)).toBeGreaterThan(mean(outfield) + 1.5);
  });

  it('does not send every goalkeeper to 40', () => {
    const keepers = retirementAges('GK');
    const past40 = keepers.filter((age) => age >= 40).length / keepers.length;
    expect(past40).toBeLessThan(0.15);
    expect(past40).toBeGreaterThan(0);
  });

  it('never exceeds the position\'s forced age', () => {
    for (const position of ['GK', 'CM'] as Position[]) {
      const cap = forcedRetirementAge(senior(position));
      for (const age of retirementAges(position, 200)) {
        expect(age).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('why goalkeepers were behind', () => {
  it('does not score a goalkeeper on goal output he cannot produce', () => {
    /*
     * outputWeight was 0.15, meant to make output matter *less*. But a keeper records zero goals
     * while expectedOutputPerApp is non-zero, so the delta clamped to -1 every season and the
     * reduced weight became a fixed rating tax.
     */
    expect(POSITIONS.GK.outputWeight).toBe(0);
    expect(POSITIONS.ST.outputWeight).toBeGreaterThan(0);
  });

  it('counts clean sheets towards the Legend Score contribution', () => {
    // The compensation factor (6x for a keeper) multiplied zero goals, so a goalkeeper scored
    // nothing at all on this component.
    expect(outputScore(0, 0, 'GK', 60)).toBeGreaterThan(0);
    expect(POSITIONS.GK.legendCleanSheetFactor).toBeGreaterThan(0);
    expect(POSITIONS.ST.legendCleanSheetFactor).toBe(0);
  });

  it('rates a goalkeeper on clean sheets rather than on nothing', () => {
    const barren = outputScore(0, 0, 'GK', 0);
    const solid = outputScore(0, 0, 'GK', 70);
    expect(solid).toBeGreaterThan(barren);
  });

  it('declines a goalkeeper more slowly than an outfielder', () => {
    expect(POSITIONS.GK.declineFactor).toBeLessThan(POSITIONS.ST.declineFactor);
    expect(POSITIONS.CB.declineFactor).toBeLessThan(POSITIONS.ST.declineFactor);
  });

  it('leaves no position far behind on the Legend Score', () => {
    const scores = (['GK', 'CB', 'FB', 'CM', 'WG', 'ST'] as Position[]).map((position) => {
      const total = Array.from({ length: 260 }, (_, i) =>
        simulateCareer({ playerName: 'ל', position, seed: i + 1, policy: balancedPolicy }),
      ).reduce((sum, c) => sum + (c.legend?.score ?? 0), 0);
      return { position, mean: total / 260 };
    });
    const best = Math.max(...scores.map((s) => s.mean));
    const worst = Math.min(...scores.map((s) => s.mean));
    // Was a 6.0-point gap with GK bottom. Positions should feel different, not disadvantaged.
    expect(best - worst, JSON.stringify(scores)).toBeLessThan(3.5);
  });

  it('gets goalkeepers to Maccabi\'s first team at a comparable rate', () => {
    const rate = (position: Position): number => {
      let reached = 0;
      for (let seed = 1; seed <= 400; seed += 1) {
        const c = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
        if (c.maccabi.appearances > 0) reached += 1;
      }
      return reached / 400;
    };
    // Was 61.8% against 68.0% for a striker.
    expect(rate('GK')).toBeGreaterThan(rate('ST') - 0.06);
  });
});

describe('the retirement thresholds', () => {
  it('makes the personas differ in stubbornness rather than in age', () => {
    const t = RETIREMENT.policyThreshold;
    expect(t.loyal).toBeLessThan(t.balanced);
    expect(t.balanced).toBeLessThan(t.ambitious);
    expect(t.ambitious).toBeLessThan(t.riskTaker);
  });
});

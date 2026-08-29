/**
 * Maccabi Legacy (v0.6) - the controlled scenarios (Phases 50-61) and the separations that make
 * the system honest: legacy vs global career, senior vs academy, Maccabi vs foreign, feeling vs
 * fact.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { historicalLadder, historicalRecord } from '../src/data/maccabiHistory';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import {
  contextualComparisons,
  globalCareerScore,
  historicalStanding,
  maccabiArchetypes,
  maccabiLegacyFacts,
  maccabiLegacyRank,
  maccabiLegacyScore,
} from '../src/game/maccabiLegacy';
import { dueLegacyMilestones, LEGACY_MILESTONES, markLegacyMilestonesSeen, nextLegacyTarget } from '../src/game/maccabiLegacy';
import { validateCareerIntegrity } from '../src/game/integrity';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, SeasonRecord, Trophy } from '../src/types';

/* ------------------------------------------------------------------ */
/* Career fixtures - hand-built histories, exact assertions            */
/* ------------------------------------------------------------------ */

function base(seed = 3): Career {
  return createCareer({ playerName: 'ת', position: 'CM', seed });
}

let seasonCounter = 2031;

function season(
  clubId: string,
  apps: number,
  overrides: Partial<SeasonRecord> & Partial<SeasonRecord['stats']> = {},
): SeasonRecord {
  seasonCounter += 1;
  const { goals = 0, assists = 0, cleanSheets = 0, captain = false, onLoan = false, age, academyStage } =
    overrides as Record<string, never> & {
      goals?: number; assists?: number; cleanSheets?: number; captain?: boolean;
      onLoan?: boolean; age?: number; academyStage?: SeasonRecord['academyStage'];
    };
  return {
    season: seasonCounter,
    age: age ?? 22,
    academyStage: academyStage ?? 'senior',
    clubId,
    clubName: clubId,
    teamName: clubId,
    league: 'ליגת העל',
    onLoan,
    stats: { appearances: apps, starts: apps, goals, assists, cleanSheets, goalsConceded: 0, rating: 70, injuredGames: 0 },
    firstHalf: null,
    ability: 70,
    role: 'starter',
    coachTrust: 70,
    trophies: [],
    captain,
    olderGroup: 'none',
  };
}

function trophy(id: string, clubId: string, seasonNum: number): Trophy {
  return { id, name: id, season: seasonNum, clubId, clubName: clubId, weight: id === 'championship' ? 3 : 1.5 };
}

function withHistory(career: Career, records: SeasonRecord[], trophies: Trophy[] = []): Career {
  return {
    ...career,
    seasonHistory: [...career.seasonHistory, ...records],
    trophies: [...career.trophies, ...trophies],
  };
}

/** A long one-club Maccabi career: 14 seasons, captaincy, titles. */
function oneClubLegend(): Career {
  seasonCounter = 2031;
  const records: SeasonRecord[] = [];
  for (let i = 0; i < 14; i += 1) {
    records.push(season(MACCABI_ID, 30, { captain: i >= 8, goals: 4, assists: 5, age: 19 + i }));
  }
  const trophies = [
    trophy('championship', MACCABI_ID, 2035),
    trophy('championship', MACCABI_ID, 2038),
    trophy('championship', MACCABI_ID, 2041),
    trophy('cup', MACCABI_ID, 2039),
  ];
  const career = withHistory(base(), records, trophies);
  return {
    ...career,
    maccabism: 90,
    maccabi: { ...career.maccabi, academyGraduate: true },
  };
}

/** The European superstar: 1 Maccabi season, then a decade of brilliance abroad. */
function europeanSuperstar(): Career {
  seasonCounter = 2031;
  const records: SeasonRecord[] = [season(MACCABI_ID, 15, { age: 18 })];
  for (let i = 0; i < 10; i += 1) {
    records.push(season('az_alkmaar', 34, { goals: 15, assists: 8, age: 19 + i, academyStage: 'senior' }));
  }
  const trophies = [
    trophy('foreign_championship', 'az_alkmaar', 2035),
    trophy('foreign_championship', 'az_alkmaar', 2037),
    trophy('foreign_cup', 'az_alkmaar', 2038),
  ];
  const career = withHistory(base(5), records, trophies);
  return {
    ...career,
    peakAbility: 92,
    reputation: 90,
    maccabi: { ...career.maccabi, everLeft: true, academyGraduate: true },
  };
}

describe('A. the one-club Maccabi player (Phase 50)', () => {
  const career = oneClubLegend();

  it('derives the facts exactly from the records', () => {
    const f = maccabiLegacyFacts(career);
    expect(f.appearances).toBe(14 * 30);
    expect(f.seasons).toBe(14);
    expect(f.captainSeasons).toBe(6);
    expect(f.championships).toBe(3);
    expect(f.cups).toBe(1);
  });

  it('reaches the very top of the Maccabi ladder without Europe', () => {
    expect(maccabiLegacyScore(career)).toBeGreaterThanOrEqual(85);
    expect(maccabiLegacyRank(career)).toBe('symbol');
    expect(maccabiArchetypes(career).primary.id).toBe('symbol');
  });
});

describe('B. the European superstar with little Maccabi football (Phase 51)', () => {
  const career = europeanSuperstar();

  it('scores high globally and low in green', () => {
    const global = globalCareerScore(career);
    const legacy = maccabiLegacyScore(career);
    expect(global).toBeGreaterThanOrEqual(65);
    expect(legacy).toBeLessThan(35);
    expect(global - legacy).toBeGreaterThan(30);
  });

  it('cannot become הסמל, whatever the global numbers say', () => {
    expect(maccabiLegacyRank(career)).not.toBe('symbol');
    expect(maccabiArchetypes(career).primary.id).toBe('european_star');
  });
});

describe('C. the prodigal son (Phase 52)', () => {
  it('requires the whole journey - and grants it when it happened', () => {
    seasonCounter = 2031;
    const records = [
      season(MACCABI_ID, 30, { age: 19 }),
      season(MACCABI_ID, 32, { age: 20 }),
      season('az_alkmaar', 30, { age: 21 }),
      season('az_alkmaar', 33, { age: 22 }),
      season('az_alkmaar', 31, { age: 23 }),
      season(MACCABI_ID, 28, { age: 24 }),
      season(MACCABI_ID, 30, { age: 25 }),
      season(MACCABI_ID, 29, { age: 26 }),
    ];
    const careerBase = withHistory(base(7), records);
    const career: Career = {
      ...careerBase,
      maccabi: {
        ...careerBase.maccabi,
        everLeft: true,
        returned: true,
        returnAge: 24,
        seasonsAfterReturn: 3,
      },
    };
    const { primary, secondary } = maccabiArchetypes(career);
    expect([primary.id, ...secondary.map((s) => s.id)]).toContain('prodigal_son');
  });

  it('a return without football after it does not qualify', () => {
    seasonCounter = 2031;
    const records = [
      season(MACCABI_ID, 30, { age: 19 }),
      season('az_alkmaar', 30, { age: 21 }),
      season('az_alkmaar', 33, { age: 22 }),
      season('az_alkmaar', 31, { age: 23 }),
      season(MACCABI_ID, 2, { age: 35 }),
    ];
    const careerBase = withHistory(base(8), records);
    const career: Career = {
      ...careerBase,
      maccabi: { ...careerBase.maccabi, everLeft: true, returned: true, seasonsAfterReturn: 1 },
    };
    const { primary, secondary } = maccabiArchetypes(career);
    expect([primary.id, ...secondary.map((s) => s.id)]).not.toContain('prodigal_son');
  });
});

describe('D. the goalkeeper legend (Phase 53)', () => {
  it('reaches the top tiers on appearances, titles and leadership - zero goals', () => {
    seasonCounter = 2031;
    const records: SeasonRecord[] = [];
    for (let i = 0; i < 14; i += 1) {
      records.push(season(MACCABI_ID, 32, { cleanSheets: 13, captain: i >= 9, age: 20 + i }));
    }
    const trophies = [
      trophy('championship', MACCABI_ID, 2034),
      trophy('championship', MACCABI_ID, 2037),
      trophy('championship', MACCABI_ID, 2040),
    ];
    const gkBase = withHistory({ ...base(9), position: 'GK' }, records, trophies);
    // A one-club keeper of fourteen years is an academy graduate - Davidovich's actual shape.
    const career: Career = {
      ...gkBase,
      maccabism: 85,
      maccabi: { ...gkBase.maccabi, academyGraduate: true },
    };

    const f = maccabiLegacyFacts(career);
    expect(f.goals).toBe(0);
    expect(maccabiLegacyScore(career)).toBeGreaterThanOrEqual(80);
    expect(maccabiLegacyRank(career)).toBe('symbol');
  });
});

describe('E. the fan favourite is not automatically the symbol (Phase 54)', () => {
  it('devotion with modest football earns love, not the crown', () => {
    seasonCounter = 2031;
    const records = [
      season(MACCABI_ID, 24, { age: 20 }),
      season(MACCABI_ID, 26, { age: 21 }),
      season(MACCABI_ID, 22, { age: 22 }),
      season(MACCABI_ID, 25, { age: 23 }),
    ];
    const careerBase = withHistory(base(11), records);
    const career: Career = { ...careerBase, maccabism: 100 };

    expect(maccabiLegacyRank(career)).not.toBe('symbol');
    expect(maccabiLegacyRank(career)).not.toBe('green_legend');
    // ~97 appearances of honest football plus total devotion: a favourite, honestly earned.
    expect(['fan_favourite', 'player']).toContain(maccabiLegacyRank(career));
  });

  it('Maccabism 100 with 8 appearances is worth almost nothing in legacy', () => {
    seasonCounter = 2031;
    const careerBase = withHistory(base(12), [season(MACCABI_ID, 8, { age: 19 })]);
    const career: Career = { ...careerBase, maccabism: 100 };
    expect(maccabiLegacyScore(career)).toBeLessThan(20);
    expect(maccabiLegacyRank(career)).toBe('player');
  });
});

describe('F/G. records: proximity, tie, break, and surviving a return (Phases 55-56)', () => {
  const record = historicalRecord('appearances')!;

  function withApps(apps: number): Career {
    seasonCounter = 2031;
    const records: SeasonRecord[] = [];
    let left = apps;
    while (left > 0) {
      const chunk = Math.min(34, left);
      records.push(season(MACCABI_ID, chunk, { age: 20 + records.length }));
      left -= chunk;
    }
    return withHistory(base(13), records);
  }

  it('F. approaching, tying and breaking are three different facts', () => {
    const near = historicalStanding(withApps(record.value - 3), 'appearances');
    expect(near.rank).toBe(2);
    expect(near.above?.player.id).toBe(record.player.id);
    expect(near.gap).toBe(3);
    expect(near.tiedRecord).toBe(false);
    expect(near.brokeRecord).toBe(false);

    const tied = historicalStanding(withApps(record.value), 'appearances');
    expect(tied.tiedRecord).toBe(true);
    expect(tied.brokeRecord).toBe(false);
    expect(tied.rank).toBe(1);

    const broke = historicalStanding(withApps(record.value + 1), 'appearances');
    expect(broke.tiedRecord).toBe(false);
    expect(broke.brokeRecord).toBe(true);
    expect(broke.above).toBeNull();
    expect(broke.gap).toBe(0);
  });

  it('G. Maccabi totals accumulate across spells - leaving does not reset the ledger', () => {
    seasonCounter = 2031;
    const records = [
      ...Array.from({ length: 7 }, (_, i) => season(MACCABI_ID, 29, { age: 19 + i })),
      season('az_alkmaar', 30, { age: 26 }),
      season('az_alkmaar', 31, { age: 27 }),
      ...Array.from({ length: 4 }, (_, i) => season(MACCABI_ID, 25, { age: 28 + i })),
    ];
    const career = withHistory(base(14), records);
    expect(maccabiLegacyFacts(career).appearances).toBe(7 * 29 + 4 * 25);
  });
});

describe('H. trophy separation (Phase 57)', () => {
  it('Maccabi legacy counts only Maccabi silverware; the global read counts it all', () => {
    seasonCounter = 2031;
    const records = [
      ...Array.from({ length: 5 }, (_, i) => season(MACCABI_ID, 30, { age: 19 + i })),
      ...Array.from({ length: 5 }, (_, i) => season('az_alkmaar', 32, { age: 24 + i })),
    ];
    const trophies = [
      trophy('championship', MACCABI_ID, 2033),
      trophy('championship', MACCABI_ID, 2035),
      trophy('foreign_championship', 'az_alkmaar', 2038),
      trophy('foreign_championship', 'az_alkmaar', 2039),
      trophy('foreign_championship', 'az_alkmaar', 2040),
    ];
    const career = withHistory(base(15), records, trophies);

    const f = maccabiLegacyFacts(career);
    expect(f.championships).toBe(2);
    expect(career.trophies.length).toBe(5);
    expect(historicalStanding(career, 'championships').playerValue).toBe(2);
  });
});

describe('J. academy only (Phase 59)', () => {
  it('academy years never contaminate the senior record', () => {
    seasonCounter = 2031;
    const records = [
      season('maccabi_academy', 26, { age: 15, academyStage: 'youth_b' }),
      season('maccabi_academy', 28, { age: 16, academyStage: 'youth_a' }),
      season('maccabi_academy', 27, { age: 17, academyStage: 'u19' }),
    ];
    const career = withHistory(base(16), records);
    const f = maccabiLegacyFacts(career);
    expect(f.appearances).toBe(0);
    expect(f.seasons).toBe(0);
    expect(maccabiLegacyScore(career)).toBeLessThan(10);
    expect(historicalStanding(career, 'appearances').rank).toBeGreaterThan(10);
  });

  it('loan spells away while owned by Maccabi count nothing either (Phase 38)', () => {
    seasonCounter = 2031;
    const records = [
      season(MACCABI_ID, 20, { age: 20 }),
      season('hapoel_haifa', 30, { age: 21, onLoan: true }),
    ];
    const career = withHistory(base(17), records);
    expect(maccabiLegacyFacts(career).appearances).toBe(20);
  });
});

describe('K. the captain without record appearances (Phase 60)', () => {
  it('leadership lifts the legacy without inventing appearances', () => {
    seasonCounter = 2031;
    const build = (captain: boolean): Career => {
      seasonCounter = 2031;
      const records = Array.from({ length: 8 }, (_, i) =>
        season(MACCABI_ID, 27, { age: 20 + i, captain: captain && i >= 2 }),
      );
      return withHistory(base(18), records, [trophy('championship', MACCABI_ID, 2036)]);
    };
    const led = build(true);
    const didNot = build(false);

    expect(maccabiLegacyScore(led)).toBeGreaterThan(maccabiLegacyScore(didNot) + 5);
    // ...but the armband adds no appearances and no historical-standing jump.
    expect(historicalStanding(led, 'appearances').playerValue).toBe(
      historicalStanding(didNot, 'appearances').playerValue,
    );
  });
});

describe('L. the career that never touched Maccabi (Phase 61)', () => {
  it('handles a fully foreign career gracefully - zero legacy, honest global score', () => {
    seasonCounter = 2031;
    const records = Array.from({ length: 12 }, (_, i) => season('az_alkmaar', 33, { goals: 12, age: 19 + i }));
    const careerBase = withHistory(base(19), records, [
      trophy('foreign_championship', 'az_alkmaar', 2036),
      trophy('foreign_championship', 'az_alkmaar', 2040),
    ]);
    const career: Career = { ...careerBase, peakAbility: 88, reputation: 85 };

    expect(maccabiLegacyScore(career)).toBeLessThanOrEqual(6);
    expect(maccabiLegacyRank(career)).toBe('player');
    expect(maccabiArchetypes(career).primary.id).toBe('outsider');
    expect(globalCareerScore(career)).toBeGreaterThan(55);
  });
});

describe('the mechanics underneath', () => {
  it('is bounded, finite and deterministic (Phase 46)', () => {
    const career = oneClubLegend();
    const a = maccabiLegacyScore(career);
    const b = maccabiLegacyScore(career);
    expect(a).toBe(b);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it('picks contextual comparisons relevant to the career (Phase 32)', () => {
    const gk = { ...oneClubLegend(), position: 'GK' as const };
    const picks = contextualComparisons(gk);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.some((p) => p.positionGroup === 'GK')).toBe(true);
  });

  it('diminishing returns: the first 100 appearances are worth more than the fifth 100', () => {
    const scoreAt = (apps: number): number => {
      seasonCounter = 2031;
      const records: SeasonRecord[] = [];
      let left = apps;
      while (left > 0) {
        const chunk = Math.min(34, left);
        records.push(season(MACCABI_ID, chunk, { age: 20 + records.length }));
        left -= chunk;
      }
      return maccabiLegacyScore(withHistory(base(21), records));
    };
    const first = scoreAt(100) - scoreAt(0);
    const fifth = scoreAt(500) - scoreAt(400);
    expect(first).toBeGreaterThan(fifth * 2);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario I: the old save (Phase 58), and milestones exactly once    */
/* ------------------------------------------------------------------ */

describe('I. a v0.5.2 save with 235 Maccabi appearances (Phase 58)', () => {
  function veteran(): Career {
    seasonCounter = 2031;
    const records = [
      ...Array.from({ length: 8 }, (_, i) => season(MACCABI_ID, 29, { age: 19 + i })),
      season(MACCABI_ID, 3, { age: 27 }),
    ];
    const career = withHistory(base(23), records);
    // A pre-v0.6 save has no ledger at all.
    const { legacyMilestones: _dropped, ...rest } = career;
    return rest as Career;
  }

  it('derives the legacy correctly and does NOT replay old milestones', () => {
    const loaded = hydrateCareer(veteran());
    expect(maccabiLegacyFacts(loaded).appearances).toBe(235);

    // 50, 100 and 200 are marked as lived, not announced - nothing is due right now.
    expect(loaded.legacyMilestones).toContain('maccabi_apps_50');
    expect(loaded.legacyMilestones).toContain('maccabi_apps_100');
    expect(loaded.legacyMilestones).toContain('maccabi_apps_200');
    expect(dueLegacyMilestones(loaded)).toHaveLength(0);

    // ...and no timeline entry was written for any of them during migration.
    const legacyIds = new Set(LEGACY_MILESTONES.map((m) => m.id));
    expect(loaded.milestones.filter((m) => legacyIds.has(m.id))).toHaveLength(0);
  });

  it('lets the NEXT threshold fire normally after migration', () => {
    const loaded = hydrateCareer(veteran());
    seasonCounter = 2050;
    const later = withHistory(loaded, [
      season(MACCABI_ID, 34, { age: 28 }),
      season(MACCABI_ID, 33, { age: 29 }),
    ]);
    const due = dueLegacyMilestones(later);
    expect(due.map((m) => m.id)).toContain('maccabi_apps_300');
    expect(due.map((m) => m.id)).not.toContain('maccabi_apps_200');
  });

  it('markLegacyMilestonesSeen is idempotent and never duplicates', () => {
    const once = markLegacyMilestonesSeen(veteran());
    const twice = markLegacyMilestonesSeen(once);
    expect(twice.legacyMilestones).toEqual(once.legacyMilestones);
    expect(new Set(twice.legacyMilestones).size).toBe(twice.legacyMilestones!.length);
  });
});

describe('milestones through the real engine', () => {
  it('announces each milestone exactly once across a whole simulated career', () => {
    let found = 0;
    for (let seed = 1; seed <= 40 && found < 8; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'CM', seed, policy: balancedPolicy });
      const announced = career.legacyMilestones ?? [];
      if (announced.length === 0) continue;
      found += 1;

      // Exactly once, in both ledgers.
      expect(new Set(announced).size, `seed ${seed}`).toBe(announced.length);
      const legacyIds = new Set(LEGACY_MILESTONES.map((m) => m.id));
      const onTimeline = career.milestones.filter((m) => legacyIds.has(m.id)).map((m) => m.id);
      expect(new Set(onTimeline).size, `seed ${seed}`).toBe(onTimeline.length);

      // Every announced id genuinely crossed its threshold - the integrity code agrees.
      expect(validateCareerIntegrity(career), `seed ${seed}`).toEqual([]);
    }
    expect(found, 'no simulated career ever announced a legacy milestone').toBeGreaterThan(0);
  });

  it('points at the next mountain (Phase 25)', () => {
    seasonCounter = 2031;
    const career = withHistory(base(24), [
      ...Array.from({ length: 3 }, (_, i) => season(MACCABI_ID, 30, { age: 20 + i })),
    ]);
    /*
     * Derived from the ladder rather than hardcoded (v0.6.1): the v0.6 version asserted "the
     * next man up is Mizrahi on 91", which was true only of the mis-scoped league dataset. A
     * test that pins the DATA breaks whenever the data is corrected; a test that pins the
     * RELATION survives, and is what the feature actually promises.
     */
    const target = nextLegacyTarget(career);
    expect(target).not.toBeNull();

    const apps = maccabiLegacyFacts(career).appearances;
    const ladder = historicalLadder('appearances');
    const nextUp = [...ladder].reverse().find((row) => row.value > apps);
    expect(nextUp, 'no historical player above this total').toBeDefined();
    expect(target!.gap).toBe(nextUp!.value - apps);
    expect(target!.label).toContain(String(nextUp!.value));
    expect(target!.label).toContain(nextUp!.player.name);
  });
});

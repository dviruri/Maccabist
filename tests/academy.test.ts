import { describe, expect, it } from 'vitest';

import { ACADEMY_STAGES, STAGE_LADDER, stageAfter, stageOrder } from '../src/data/academy';
import { FIRST_ACADEMY_SEASON, PROMOTION } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import { promotionScore, resolveAcademyProgression } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import type { AcademyStage, Career } from '../src/types';

function academyCareer(overrides: Partial<Career> = {}): Career {
  return { ...createCareer({ playerName: 'בודק', position: 'CM', seed: 42 }), ...overrides };
}

/**
 * The season in which the 2021 cohort naturally plays a given stage. Fixtures need this so a
 * player's `academyStage` and his cohort's stage line up - otherwise the progression rule sees
 * a player playing above or below his year and behaves (correctly) differently.
 */
function naturalSeasonFor(stage: AcademyStage): number {
  return FIRST_ACADEMY_SEASON + stageOrder(stage);
}

describe('the academy ladder', () => {
  it('runs טרום ב׳ → נוער → בוגרים in the real order', () => {
    expect(STAGE_LADDER).toEqual([
      'pre_b',
      'pre_a',
      'children_c',
      'children_b',
      'children_a',
      'youth_c',
      'youth_b',
      'youth_a',
      'u19',
      'senior',
    ]);
  });

  it('labels every stage in Hebrew', () => {
    expect(STAGE_LADDER.map((s) => ACADEMY_STAGES[s].label)).toEqual([
      'טרום ב׳',
      'טרום א׳',
      'ילדים ג׳',
      'ילדים ב׳',
      'ילדים א׳',
      'נערים ג׳',
      'נערים ב׳',
      'נערים א׳',
      'נוער',
      'בוגרים',
    ]);
  });

  it('gets harder and plays more games the higher you climb', () => {
    const youth = STAGE_LADDER.filter((s) => s !== 'senior');
    for (let i = 1; i < youth.length; i += 1) {
      const prev = ACADEMY_STAGES[youth[i - 1] as AcademyStage];
      const curr = ACADEMY_STAGES[youth[i] as AcademyStage];
      expect(curr.quality).toBeGreaterThan(prev.quality);
      expect(curr.seasonGames).toBeGreaterThanOrEqual(prev.seasonGames);
    }
  });

  it('never walks off the end of the ladder', () => {
    expect(stageAfter('u19', 1)).toBe('senior');
    expect(stageAfter('senior', 3)).toBe('senior');
  });

  it('starts every career at טרום ב׳, aged 9', () => {
    const career = createCareer({ playerName: 'ילד', position: 'ST', seed: 7 });
    expect(career.academyStage).toBe('pre_b');
    expect(career.age).toBe(9);
  });
});

describe('academy progression', () => {
  it('promotes one step for an ordinary season', () => {
    // Genuinely ordinary: ability level with the age group, middling trust, squad-level role.
    // A player clearly ahead of his age group is supposed to be skipping levels, not stepping.
    const career = academyCareer({
      academyStage: 'children_b',
      currentSeason: naturalSeasonFor('children_b'),
      coachTrust: 40,
      roleValue: 25,
      ability: 30,
    });
    const { career: next, result } = resolveAcademyProgression(career, 56, createRng(1));
    expect(result.kind).toBe('normal');
    expect(next.academyStage).toBe('children_a');
    expect(stageOrder(next.academyStage)).toBe(stageOrder('children_b') + 1);
  });

  it('skips a level for an exceptional academy season', () => {
    const career = academyCareer({
      academyStage: 'children_b',
      currentSeason: naturalSeasonFor('children_b'),
      coachTrust: 98,
      roleValue: 96,
      ability: 70,
      olderGroup: 'playing',
      seasonsAtStage: 1,
    });
    const { career: next, result } = resolveAcademyProgression(career, 88, createRng(3));
    expect(result.kind).toBe('early');
    expect(next.academyStage).toBe('youth_c');
    expect(next.maccabi.earlyPromotions).toBe(1);
  });

  /*
   * v0.3.1: an academy is organised by birth year, so a player registered with his own cohort
   * moves up every season no matter how badly it went. These replace the old "held back" tests,
   * which encoded a rule that does not exist in youth football.
   */
  it('moves a struggling player up with his cohort anyway', () => {
    const career = academyCareer({
      academyStage: 'youth_c',
      currentSeason: naturalSeasonFor('youth_c'),
      coachTrust: 8,
      roleValue: 6,
      ability: 20,
    });
    const { career: next, result } = resolveAcademyProgression(career, 30, createRng(5));
    expect(result.kind).toBe('normal');
    expect(next.academyStage).toBe('youth_b');
  });

  it('never leaves a player behind his own birth cohort, over many rolls', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = academyCareer({
        academyStage: 'children_b',
        currentSeason: naturalSeasonFor('children_b'),
        coachTrust: 2,
        roleValue: 2,
        ability: 8,
      });
      const { career: next } = resolveAcademyProgression(career, 20, createRng(seed));
      // Next season the cohort is at children_a; he must be there or above, never below.
      expect(stageOrder(next.academyStage)).toBeGreaterThanOrEqual(stageOrder('children_a'));
    }
  });

  it('caps how often one player can be fast-tracked', () => {
    const career = academyCareer({
      academyStage: 'children_b',
      currentSeason: naturalSeasonFor('children_b'),
      coachTrust: 99,
      roleValue: 99,
      ability: 80,
      olderGroup: 'playing',
      seasonsAtStage: 1,
      maccabi: {
        ...academyCareer().maccabi,
        earlyPromotions: PROMOTION.maxEarlyPromotions,
      },
    });
    const { result } = resolveAcademyProgression(career, 90, createRng(11));
    expect(result.kind).toBe('normal');
  });

  it('resets the pecking order when you move up an age group', () => {
    // Ability has to match the stage, otherwise the promotion roll fails and nothing moves.
    const career = academyCareer({
      academyStage: 'youth_c',
      currentSeason: naturalSeasonFor('youth_c'),
      ability: 55,
      coachTrust: 70,
      roleValue: 80,
      olderGroup: 'training',
    });
    const { career: next, result } = resolveAcademyProgression(career, 70, createRng(2));
    expect(['normal', 'early']).toContain(result.kind);
    expect(next.roleValue).toBeLessThan(career.roleValue);
    expect(next.olderGroup).toBe('none');
  });
});

describe('coach trust drives promotion', () => {
  it('scores a trusted player higher than a distrusted twin', () => {
    const base = { academyStage: 'youth_b' as const, roleValue: 55, ability: 55 };
    const trusted = academyCareer({ ...base, coachTrust: 90 });
    const distrusted = academyCareer({ ...base, coachTrust: 20 });

    // Same rng stream, so the only difference is the trust itself.
    const a = promotionScore(trusted, 60, createRng(123));
    const b = promotionScore(distrusted, 60, createRng(123));
    expect(a).toBeGreaterThan(b);
  });

  it('makes an EARLY promotion measurably more likely across many rolls', () => {
    /*
     * v0.3.1: ordinary promotion is no longer a roll - the cohort moves up regardless. What
     * trust buys is being pushed up *ahead* of the cohort, so that is what this measures.
     */
    const base = {
      academyStage: 'youth_a' as const,
      currentSeason: naturalSeasonFor('youth_a'),
      roleValue: 70,
      ability: 60,
    };
    const countEarly = (coachTrust: number): number => {
      let early = 0;
      for (let i = 0; i < 300; i += 1) {
        const career = academyCareer({ ...base, coachTrust });
        const { result } = resolveAcademyProgression(career, 58, createRng(i + 1));
        if (result.kind === 'early') early += 1;
      }
      return early;
    };
    const trusted = countEarly(88);
    const distrusted = countEarly(25);
    expect(trusted).toBeGreaterThan(distrusted);
    // And the gap should be substantial, not a rounding artefact.
    expect(trusted - distrusted).toBeGreaterThan(30);
  });
});

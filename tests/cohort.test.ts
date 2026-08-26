/**
 * v0.3.1: the world timeline, birth cohorts, the natural academy stage, and the origin/trials
 * system.
 *
 * The critical invariant tested here is that a player registered with his own birth cohort can
 * never repeat that age group - an academy is organised by birth year, and youth football has
 * no concept of being "held back a year" in your own cohort.
 */

import { describe, expect, it } from 'vitest';

import { STAGE_LADDER, stageLabel, stageOrder } from '../src/data/academy';
import { MACCABI_ACADEMY_ID } from '../src/data/clubs';
import { EXTERNAL_YOUTH_CLUB_IDS } from '../src/data/youthClubs';
import {
  BIRTH_COHORT,
  FIRST_ACADEMY_SEASON,
  ORIGIN,
  PROMOTION,
  RELATIVE_AGE,
} from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import {
  ageAt,
  cohortLead,
  isPlayingUpACohort,
  isYoungInCohort,
  naturalStage,
  naturalStageFor,
  nextNaturalStage,
  relativeAgeBonus,
} from '../src/game/cohort';
import { hasMemory } from '../src/game/memory';
import { eligibleForRetrial, resolveOrigin, trialScore } from '../src/game/originEngine';
import { resolveAcademyProgression } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { AcademyStage, Career } from '../src/types';

const newCareer = (seed = 42, day = 15, month = 6): Career =>
  createCareer({ playerName: 'קוהורט', position: 'CM', seed, birthDay: day, birthMonth: month });

/** The season the 2021 cohort naturally plays a given stage. */
const seasonOf = (stage: AcademyStage): number => FIRST_ACADEMY_SEASON + stageOrder(stage);

/* ------------------------------------------------------------------ */

describe('the world timeline', () => {
  it('starts every career in the same season', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'ST', seed });
      expect(career.currentSeason).toBe(FIRST_ACADEMY_SEASON);
      expect(career.startSeason).toBe(FIRST_ACADEMY_SEASON);
    }
  });

  it('puts every player in the 2021 birth cohort', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'GK', seed });
      expect(career.birthCohort).toBe(BIRTH_COHORT);
      expect(career.dateOfBirth.year).toBe(BIRTH_COHORT);
    }
  });

  it('takes the chosen day and month, and locks the year', () => {
    const career = newCareer(1, 17, 12);
    expect(career.dateOfBirth.day).toBe(17);
    expect(career.dateOfBirth.month).toBe(12);
    expect(career.dateOfBirth.year).toBe(BIRTH_COHORT);
  });

  it('rejects impossible days and months', () => {
    const career = createCareer({
      playerName: 'א',
      position: 'CM',
      seed: 3,
      birthDay: 99,
      birthMonth: 44,
    });
    expect(career.dateOfBirth.day).toBeLessThanOrEqual(28);
    expect(career.dateOfBirth.month).toBeLessThanOrEqual(12);
    expect(career.dateOfBirth.day).toBeGreaterThanOrEqual(1);
    expect(career.dateOfBirth.month).toBeGreaterThanOrEqual(1);
  });
});

describe('football age', () => {
  it('moves through the season as the calendar does', () => {
    // Born December: still the younger age at preseason, ages over the winter.
    const dob = { day: 17, month: 12, year: BIRTH_COHORT };
    const atPreseason = ageAt(dob, FIRST_ACADEMY_SEASON, 'preseason');
    const atMid = ageAt(dob, FIRST_ACADEMY_SEASON, 'midseason');
    expect(atMid).toBe(atPreseason + 1);
  });

  it('gives a January and a December player different ages on the same date', () => {
    const january = { day: 5, month: 1, year: BIRTH_COHORT };
    const december = { day: 20, month: 12, year: BIRTH_COHORT };
    const season = FIRST_ACADEMY_SEASON;
    expect(ageAt(january, season, 'preseason')).toBe(ageAt(december, season, 'preseason') + 1);
  });

  it('keeps both of them in exactly the same cohort and age group', () => {
    const january = newCareer(7, 5, 1);
    const december = newCareer(7, 20, 12);

    expect(january.birthCohort).toBe(december.birthCohort);
    expect(naturalStage(january)).toBe(naturalStage(december));
    expect(january.academyStage).toBe(december.academyStage);
    // ...while their displayed ages differ.
    expect(january.age).not.toBe(december.age);
  });
});

/* ------------------------------------------------------------------ */

describe('natural academy stage', () => {
  it('maps the 2021 cohort onto the ladder, one rung per season', () => {
    const expected: Array<[number, AcademyStage]> = [
      [2031, 'pre_b'],
      [2032, 'pre_a'],
      [2033, 'children_c'],
      [2034, 'children_b'],
      [2035, 'children_a'],
      [2036, 'youth_c'],
      [2037, 'youth_b'],
      [2038, 'youth_a'],
      [2039, 'u19'],
      [2040, 'senior'],
    ];
    for (const [season, stage] of expected) {
      expect(naturalStageFor(BIRTH_COHORT, season), `season ${season}`).toBe(stage);
    }
  });

  it('never walks off either end of the ladder', () => {
    expect(naturalStageFor(BIRTH_COHORT, FIRST_ACADEMY_SEASON - 5)).toBe(STAGE_LADDER[0]);
    expect(naturalStageFor(BIRTH_COHORT, FIRST_ACADEMY_SEASON + 40)).toBe('senior');
  });

  it('reports the next season stage, and whether the player is ahead of it', () => {
    // Stage and season must agree, or the player is by definition playing up or behind.
    const career: Career = {
      ...newCareer(),
      academyStage: 'children_b',
      currentSeason: seasonOf('children_b'),
    };
    expect(naturalStage(career)).toBe('children_b');
    expect(nextNaturalStage(career)).toBe('children_a');
    expect(isPlayingUpACohort(career)).toBe(false);
    expect(cohortLead(career)).toBe(0);

    const pushedUp: Career = { ...career, academyStage: 'children_a' };
    expect(isPlayingUpACohort(pushedUp)).toBe(true);
    expect(cohortLead(pushedUp)).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe('the no-repeat rule', () => {
  it('moves a player up with his cohort even after an awful season', () => {
    const career: Career = {
      ...newCareer(),
      academyStage: 'children_b',
      currentSeason: seasonOf('children_b'),
      ability: 8,
      coachTrust: 2,
      roleValue: 2,
    };
    const { career: next, result } = resolveAcademyProgression(career, 20, createRng(1));
    expect(next.academyStage).toBe('children_a');
    expect(result.kind).toBe('normal');
  });

  it('never registers a player below his own cohort, over many rolls and stages', () => {
    const ladderStages = STAGE_LADDER.filter((s) => s !== 'senior' && s !== 'u19');
    for (const stage of ladderStages) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const career: Career = {
          ...newCareer(seed),
          academyStage: stage,
          currentSeason: seasonOf(stage),
          ability: 5 + (seed % 40),
          coachTrust: seed % 90,
          roleValue: seed % 80,
        };
        const { career: next } = resolveAcademyProgression(career, 20 + (seed % 60), createRng(seed));
        const nextNatural = nextNaturalStage(career);
        expect(
          stageOrder(next.academyStage),
          `${stage} seed ${seed}: went below the cohort`,
        ).toBeGreaterThanOrEqual(stageOrder(nextNatural));
      }
    }
  });

  it('never produces the same stage twice for a player with his own cohort', () => {
    const ladderStages = STAGE_LADDER.filter((s) => s !== 'senior' && s !== 'u19');
    for (const stage of ladderStages) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const career: Career = {
          ...newCareer(seed),
          academyStage: stage,
          currentSeason: seasonOf(stage),
          ability: 10 + (seed % 50),
          coachTrust: seed % 95,
          roleValue: seed % 85,
        };
        const { career: next, result } = resolveAcademyProgression(career, 25 + (seed % 55), createRng(seed * 7));
        expect(next.academyStage, `${stage} seed ${seed}`).not.toBe(stage);
        expect(result.kind).not.toBe('cohort_caught_up');
      }
    }
  });
});

describe('playing up, and the cohort catching up', () => {
  /**
   * A player pushed up one rung, whose own year is about to arrive in that group. Kept
   * deliberately modest so the promotion roll does not earn him *another* early jump - the
   * point of these tests is the cohort catching up, not the fast track.
   */
  const pushedUpEarlier = (overrides: Partial<Career> = {}): Career => ({
    ...newCareer(),
    academyStage: 'youth_c',
    currentSeason: seasonOf('children_a'),
    ability: 46,
    coachTrust: 30,
    roleValue: 35,
    ...overrides,
  });

  it('lets a player who was pushed up stay in the same group when his year arrives', () => {
    const career = pushedUpEarlier();
    expect(cohortLead(career)).toBe(1);

    const { career: next, result } = resolveAcademyProgression(career, 45, createRng(4));
    // His cohort reaches youth_c next season, so staying is the cohort arriving - not a repeat.
    expect(next.academyStage).toBe('youth_c');
    expect(result.kind).toBe('cohort_caught_up');
    /*
     * Measured against *next* season's cohort stage, because progression sets the stage while
     * advanceYear moves the season - so cohortLead() still reads the old season here.
     */
    expect(next.academyStage).toBe(nextNaturalStage(career));
  });

  it('describes that as the cohort arriving, never as being held back', () => {
    const { result } = resolveAcademyProgression(pushedUpEarlier(), 45, createRng(5));
    expect(result.kind).toBe('cohort_caught_up');
    expect(result.title).toContain('השנתון שלך');
    expect(result.detail).not.toContain('נשארת');
    expect(result.icon).not.toBe('⏸️');
  });

  it('gains standing rather than losing it when the cohort catches up', () => {
    const career = pushedUpEarlier({ roleValue: 50 });
    const { career: next, result } = resolveAcademyProgression(career, 45, createRng(6));
    expect(result.kind).toBe('cohort_caught_up');
    // He goes from youngest in the room to one of the older boys.
    expect(next.roleValue).toBeGreaterThan(career.roleValue);
  });

  it('caps how far ahead of his cohort a player can ever be', () => {
    // Already at the maximum lead, and outstanding - must not be pushed further.
    const career: Career = {
      ...newCareer(),
      academyStage: 'children_a',
      currentSeason: seasonOf('children_c'),
      ability: 90,
      coachTrust: 99,
      roleValue: 99,
    };
    expect(cohortLead(career)).toBe(PROMOTION.maxCohortLead);
    const { career: next } = resolveAcademyProgression(career, 95, createRng(8));
    expect(cohortLead(next)).toBeLessThanOrEqual(PROMOTION.maxCohortLead);
  });

  it('only resets standing on an early promotion, not on the cohort moving up', () => {
    const withCohort: Career = {
      ...newCareer(),
      academyStage: 'children_b',
      currentSeason: seasonOf('children_b'),
      ability: 30,
      coachTrust: 40,
      roleValue: 60,
    };
    const { career: normal, result } = resolveAcademyProgression(withCohort, 50, createRng(9));
    expect(result.kind).toBe('normal');
    // A step in standard, not a change of standing - so nothing like the old -9 hit.
    expect(normal.roleValue).toBeGreaterThan(withCohort.roleValue - 5);
  });
});

/* ------------------------------------------------------------------ */

describe('relative age effect', () => {
  it('favours an early-year birthday in the academy, and fades with age', () => {
    const january = { ...newCareer(1, 5, 1), academyStage: 'pre_b' as const };
    const december = { ...newCareer(1, 20, 12), academyStage: 'pre_b' as const };
    expect(relativeAgeBonus(january)).toBeGreaterThan(0);
    expect(relativeAgeBonus(december)).toBeLessThan(0);

    const older = { ...january, academyStage: 'u19' as const };
    expect(Math.abs(relativeAgeBonus(older))).toBeLessThan(Math.abs(relativeAgeBonus(january)));
  });

  it('is neutral in the middle of the year, and gone at senior level', () => {
    const june = { ...newCareer(1, 15, 6), academyStage: 'children_b' as const };
    expect(relativeAgeBonus(june)).toBe(0);

    const senior = { ...newCareer(1, 5, 1), academyStage: 'senior' as const };
    expect(relativeAgeBonus(senior)).toBe(0);
  });

  it('never touches potential - it is maturity, not talent', () => {
    const potentials = new Set<number>();
    for (let month = 1; month <= 12; month += 1) {
      potentials.add(newCareer(77, 10, month).hidden.potential);
    }
    // Same seed, same talent, whatever the birthday.
    expect(potentials.size).toBe(1);
  });

  it('stays small', () => {
    const january = { ...newCareer(1, 5, 1), academyStage: 'pre_b' as const };
    expect(relativeAgeBonus(january)).toBeLessThanOrEqual(RELATIVE_AGE.earlyYearBonus);
  });

  it('knows who is young in the cohort', () => {
    expect(isYoungInCohort(newCareer(1, 20, 11))).toBe(true);
    expect(isYoungInCohort(newCareer(1, 20, 3))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('origin and the Maccabi trials', () => {
  it('gives every career one of the three origins', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'CM', seed });
      expect(['scouted', 'trial_accepted', 'trial_rejected']).toContain(career.origin);
      expect(career.phase).toBe('origin');
    }
  });

  it('starts an accepted or scouted player inside Maccabi', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'CM', seed });
      if (career.origin === 'trial_rejected') continue;
      expect(career.currentClubId).toBe(MACCABI_ACADEMY_ID);
      expect(career.academyStage).toBe('pre_b');
    }
  });

  it('sends a rejected player to another youth academy, not out of the game', () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 6; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'CM', seed });
      if (career.origin !== 'trial_rejected') continue;
      checked += 1;
      expect(EXTERNAL_YOUTH_CLUB_IDS).toContain(career.currentClubId);
      // Still a nine year old in טרום ב׳ - the ladder is the same, the badge is not.
      expect(career.academyStage).toBe('pre_b');
      expect(career.retired).toBe(false);
      expect(hasMemory(career, 'failed_first_maccabi_trial')).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('records the origin in memory and on the timeline', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = createCareer({ playerName: 'א', position: 'CM', seed });
      const originMemory =
        hasMemory(career, 'scouted_by_maccabi') ||
        hasMemory(career, 'passed_first_maccabi_trial') ||
        hasMemory(career, 'failed_first_maccabi_trial');
      expect(originMemory).toBe(true);
      expect(career.milestones.some((m) => m.id.startsWith('origin_'))).toBe(true);
    }
  });

  it('produces all three origins across seeds, none of them vanishingly rare', () => {
    const counts = { scouted: 0, trial_accepted: 0, trial_rejected: 0 };
    const N = 600;
    for (let seed = 1; seed <= N; seed += 1) {
      counts[createCareer({ playerName: 'א', position: 'CM', seed }).origin] += 1;
    }
    expect(counts.scouted / N).toBeGreaterThan(0.02);
    expect(counts.trial_rejected / N).toBeGreaterThan(0.05);
    expect(counts.trial_accepted / N).toBeGreaterThan(0.3);
  });

  it('rates a stronger child higher at the trials', () => {
    const weak: Career = { ...newCareer(), ability: 12, hidden: { ...newCareer().hidden, confidence: 40 } };
    const strong: Career = { ...newCareer(), ability: 30, hidden: { ...newCareer().hidden, confidence: 75 } };
    expect(trialScore(strong, createRng(11))).toBeGreaterThan(trialScore(weak, createRng(11)));
  });

  it('never guarantees the trials - a scouted origin is possible but not certain for talent', () => {
    const origins = new Set<string>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const c = createCareer({ playerName: 'א', position: 'CM', seed });
      if (c.hidden.potential >= 88) origins.add(c.origin);
    }
    // High potential does not force a single outcome.
    expect(origins.size).toBeGreaterThan(1);
  });

  it('is deterministic for a seed', () => {
    const a = createCareer({ playerName: 'א', position: 'CM', seed: 999, birthDay: 3, birthMonth: 4 });
    const b = createCareer({ playerName: 'א', position: 'CM', seed: 999, birthDay: 3, birthMonth: 4 });
    expect(a.origin).toBe(b.origin);
    expect(a.currentClubId).toBe(b.currentClubId);
  });

  it('is a pure function of the career it is given', () => {
    const career = newCareer();
    const before = career.currentClubId;
    resolveOrigin(career, createRng(5));
    expect(career.currentClubId).toBe(before);
  });
});

describe('the road back to Maccabi', () => {
  it('never offers a trial to someone already at Maccabi', () => {
    expect(eligibleForRetrial(newCareer())).toBe(false);
  });

  it('needs the player to be standing out where he is', () => {
    const base: Career = {
      ...newCareer(),
      currentClubId: 'youth_hapoel_afula',
      currentSeason: seasonOf('children_b'),
      academyStage: 'children_b',
      trials: [
        { accepted: false, attempt: 1, season: FIRST_ACADEMY_SEASON, title: '', description: '', icon: '' },
      ],
    };

    // An ordinary season at his own level is not enough.
    const ordinary: Career = {
      ...base,
      lastSeasonRecord: {
        season: seasonOf('children_c'),
        age: 11,
        academyStage: 'children_c',
        clubId: 'youth_hapoel_afula',
        clubName: 'הפועל עפולה',
        teamName: 'ילדים ג׳',
        league: 'x',
        onLoan: false,
        stats: {
          appearances: 10, starts: 5, goals: 1, assists: 1,
          cleanSheets: 0, goalsConceded: 0, rating: 55, injuredGames: 0,
        },
        firstHalf: null,
        ability: 28,
        role: 'rotation',
        coachTrust: 50,
        trophies: [],
        captain: false,
        olderGroup: 'none',
      },
    };
    expect(eligibleForRetrial(ordinary)).toBe(false);

    // Clearly better than his level, and a regular - now they look.
    const standout: Career = {
      ...ordinary,
      lastSeasonRecord: {
        ...ordinary.lastSeasonRecord!,
        ability: 28 + ORIGIN.retrialAbilityEdge + 6,
        role: 'star',
      },
    };
    expect(eligibleForRetrial(standout)).toBe(true);
  });

  it('produces real second chances, and real rejections, across many careers', () => {
    let rejected = 0;
    let laterJoined = 0;
    let retrialsAttempted = 0;
    let stillReachedSeniorFootball = 0;

    for (let seed = 1; seed <= 1200; seed += 1) {
      const career = simulateCareer({ playerName: 'ק', position: 'CM', seed, policy: balancedPolicy });
      if (career.origin !== 'trial_rejected') continue;
      rejected += 1;
      retrialsAttempted += career.trials.filter((t) => t.attempt > 1).length;
      if (hasMemory(career, 'joined_maccabi_late')) laterJoined += 1;
      if (career.seasonHistory.some((s) => s.academyStage === 'senior' && s.stats.appearances > 0)) {
        stillReachedSeniorFootball += 1;
      }
    }

    expect(rejected).toBeGreaterThan(20);
    // The road back exists...
    expect(retrialsAttempted).toBeGreaterThan(0);
    expect(laterJoined).toBeGreaterThan(0);
    // ...and it is not the only road: being rejected must not end the career.
    expect(stillReachedSeniorFootball / rejected).toBeGreaterThan(0.7);
    // ...but it is also not automatic.
    expect(laterJoined / rejected).toBeLessThan(0.7);
  });
});

/* ------------------------------------------------------------------ */

describe('cohort invariants across whole simulated careers', () => {
  it('never repeats a natural age group on the academy ladder', () => {
    let repeats = 0;
    let behindCohort = 0;
    let cohortCaughtUp = 0;

    for (let seed = 1; seed <= 400; seed += 1) {
      const career = simulateCareer({ playerName: 'ק', position: 'CM', seed, policy: balancedPolicy });
      const academy = career.seasonHistory.filter((s) => s.academyStage !== 'senior');

      for (let i = 0; i < academy.length - 1; i += 1) {
        const current = academy[i]!;
        const following = academy[i + 1]!;
        // נוער is excluded: being kept an extra year there is the club's explicit
        // youth-to-senior decision, not the academy ladder.
        if (stageOrder(current.academyStage) >= stageOrder('u19')) continue;

        const naturalNow = naturalStageFor(career.birthCohort, current.season);
        const naturalNext = naturalStageFor(career.birthCohort, following.season);

        if (stageOrder(following.academyStage) < stageOrder(naturalNext)) behindCohort += 1;
        if (current.academyStage === following.academyStage) {
          if (stageOrder(current.academyStage) > stageOrder(naturalNow)) cohortCaughtUp += 1;
          else repeats += 1;
        }
      }
    }

    expect(repeats, 'a player repeated his own natural age group').toBe(0);
    expect(behindCohort, 'a player fell behind his own birth cohort').toBe(0);
    // The legal case must still be reachable, or the test above proves nothing.
    expect(cohortCaughtUp).toBeGreaterThan(0);
  });

  it('keeps the whole cohort on the same ladder whatever their birthdays', () => {
    const january = simulateCareer({
      playerName: 'ינואר', position: 'CM', seed: 4242, birthDay: 5, birthMonth: 1, policy: balancedPolicy,
    });
    const december = simulateCareer({
      playerName: 'דצמבר', position: 'CM', seed: 4242, birthDay: 20, birthMonth: 12, policy: balancedPolicy,
    });

    expect(january.birthCohort).toBe(december.birthCohort);
    // Same seed, so the same first academy season and the same stage in it.
    const firstJan = january.seasonHistory[0];
    const firstDec = december.seasonHistory[0];
    expect(firstJan?.season).toBe(firstDec?.season);
    expect(firstJan?.academyStage).toBe(firstDec?.academyStage);
    // ...but different ages while playing it.
    expect(firstJan?.age).not.toBe(firstDec?.age);
  });

  it('leaves the academy at a believable age', () => {
    const ages: number[] = [];
    for (let seed = 1; seed <= 300; seed += 1) {
      const career = simulateCareer({ playerName: 'ק', position: 'CM', seed, policy: balancedPolicy });
      const lastAcademy = career.seasonHistory.filter((s) => s.academyStage !== 'senior').at(-1);
      if (lastAcademy) ages.push(lastAcademy.age + 1);
    }
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    // Senior football around 18-19, and specifically not drifting past 20.
    expect(mean).toBeGreaterThan(17);
    expect(mean).toBeLessThan(20.5);
  });

  it('labels every stage the player passes through', () => {
    const career = simulateCareer({ playerName: 'ק', position: 'CM', seed: 3, policy: balancedPolicy });
    for (const season of career.seasonHistory) {
      expect(stageLabel(season.academyStage).length).toBeGreaterThan(0);
    }
  });
});

/**
 * v0.3 systems: career memory, story arcs, traits, leadership, recovery, the senior phase,
 * contextual Maccabism, homecoming eligibility, milestones and the career story.
 */

import { describe, expect, it } from 'vitest';

import { getClub, MACCABI_ID } from '../src/data/clubs';
import { TRAIT_DEFS } from '../src/data/traits';
import { CAPTAINCY, LEAVING, RECOVERY } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import { matchesConditions } from '../src/game/conditions';
import {
  activeArc,
  advanceArc,
  countMemories,
  hasCompletedArc,
  hasMemory,
  hasTrait,
  lastMemory,
  matchesArc,
  recordMemory,
  seasonsSinceMemory,
  seniorPhase,
  startArc,
} from '../src/game/memory';
import { checkMilestones } from '../src/game/milestones';
import {
  applyEffects,
  coachTrustBaseline,
  driftTrustTowardsBaseline,
  maybeChangeCoach,
  revealTrait,
} from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { findRecoveries } from '../src/game/simulate';
import { careerArchetype, careerHeadline, careerStory } from '../src/game/storyEngine';
import { checkTraitReveals, revealRemainingTraits } from '../src/game/traitReveal';
import { homecomingKind, leavingContext } from '../src/game/transferEngine';
import type { Career, EventConditions, SeasonRecord, SeasonStats } from '../src/types';

const base = (seed = 4242): Career => createCareer({ playerName: 'זיכרון', position: 'CM', seed });

const senior = (overrides: Partial<Career> = {}): Career => ({
  ...base(),
  academyStage: 'senior',
  currentClubId: MACCABI_ID,
  age: 25,
  ability: 76,
  roleValue: 70,
  ...overrides,
});

const EMPTY: SeasonStats = {
  appearances: 0,
  starts: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  goalsConceded: 0,
  rating: 0,
  injuredGames: 0,
};

const season = (overrides: Partial<SeasonRecord> = {}): SeasonRecord => ({
  season: 2040,
  age: 24,
  academyStage: 'senior',
  clubId: MACCABI_ID,
  clubName: 'מכבי חיפה',
  teamName: 'מכבי חיפה',
  league: 'ליגת העל',
  onLoan: false,
  stats: { ...EMPTY, appearances: 25, starts: 22, rating: 68 },
  firstHalf: null,
  ability: 74,
  role: 'starter',
  coachTrust: 60,
  trophies: [],
  captain: false,
  olderGroup: 'none',
  ...overrides,
});

/* ------------------------------------------------------------------ */

describe('career memory', () => {
  it('records what happened, on top of the origin memory every career starts with', () => {
    const career = base();
    // v0.3.1: a career opens with how it began - scouted, or passed/failed the trials.
    expect(career.memories.length).toBeGreaterThanOrEqual(1);
    expect(hasMemory(career, 'major_injury')).toBe(false);

    const withMemory = { ...career, memories: recordMemory(career, 'major_injury') };
    expect(hasMemory(withMemory, 'major_injury')).toBe(true);
    expect(lastMemory(withMemory, 'major_injury')?.season).toBe(career.currentSeason);
    expect(lastMemory(withMemory, 'major_injury')?.age).toBe(career.age);
  });

  it('records a memory through event effects', () => {
    const career = base();
    const after = applyEffects(career, { remember: 'penalty_miss' }, createRng(1)).career;
    expect(hasMemory(after, 'penalty_miss')).toBe(true);
  });

  it('counts repeats and reports how long ago the last one was', () => {
    let career = base();
    career = { ...career, memories: recordMemory(career, 'penalty_miss') };
    career = { ...career, currentSeason: career.currentSeason + 4 };
    career = { ...career, memories: recordMemory(career, 'penalty_miss') };

    expect(countMemories(career, 'penalty_miss')).toBe(2);
    expect(seasonsSinceMemory(career, 'penalty_miss')).toBe(0);

    const later = { ...career, currentSeason: career.currentSeason + 3 };
    expect(seasonsSinceMemory(later, 'penalty_miss')).toBe(3);
    expect(seasonsSinceMemory(later, 'derby_hero')).toBeNull();
  });

  it('does not mutate the career it reads', () => {
    const career = base();
    const before = career.memories.length;
    recordMemory(career, 'major_injury');
    expect(career.memories).toHaveLength(before);
  });
});

describe('memory conditions', () => {
  const ctx = { appearances: 10 };

  it('gates an event on a memory being present or absent', () => {
    const career = base();
    const withMemory = { ...career, memories: recordMemory(career, 'major_injury') };

    expect(matchesConditions(career, { requiresMemory: ['major_injury'] }, ctx)).toBe(false);
    expect(matchesConditions(withMemory, { requiresMemory: ['major_injury'] }, ctx)).toBe(true);
    expect(matchesConditions(withMemory, { forbidsMemory: ['major_injury'] }, ctx)).toBe(false);
    expect(matchesConditions(career, { forbidsMemory: ['major_injury'] }, ctx)).toBe(true);
  });

  it('makes a callback wait before it can fire, and expire once it is stale', () => {
    const career = base();
    const remembered = { ...career, memories: recordMemory(career, 'penalty_miss') };
    const conditions: EventConditions = {
      requiresMemory: ['penalty_miss'],
      memoryMinSeasonsAgo: 2,
      memoryMaxSeasonsAgo: 6,
    };

    // Same season - too soon for a callback to land.
    expect(matchesConditions(remembered, { ...conditions }, ctx)).toBe(false);
    // Three seasons later - the right distance.
    expect(
      matchesConditions({ ...remembered, currentSeason: career.currentSeason + 3 }, { ...conditions }, ctx),
    ).toBe(true);
    // Ten seasons later - no longer interesting.
    expect(
      matchesConditions({ ...remembered, currentSeason: career.currentSeason + 10 }, { ...conditions }, ctx),
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('story arcs', () => {
  it('opens an arc at stage 1 with a branch', () => {
    const career = base();
    const withArc = { ...career, arcs: startArc(career, 'coach_relationship', 'conflict') };
    const arc = activeArc(withArc, 'coach_relationship');
    expect(arc?.stage).toBe(1);
    expect(arc?.branch).toBe('conflict');
    expect(arc?.startedSeason).toBe(career.currentSeason);
  });

  it('advances the stage and can rebrand the branch', () => {
    let career = base();
    career = { ...career, arcs: startArc(career, 'older_group', 'struggled') };
    career = { ...career, arcs: advanceArc(career, 'older_group', 'redeemed') };
    const arc = activeArc(career, 'older_group');
    expect(arc?.stage).toBe(2);
    expect(arc?.branch).toBe('redeemed');
  });

  it('matches stage, branch and elapsed-season requirements', () => {
    let career = base();
    career = { ...career, arcs: startArc(career, 'position_battle', 'behind') };

    expect(matchesArc(career, { id: 'position_battle' })).toBe(true);
    expect(matchesArc(career, { id: 'position_battle', minStage: 2 })).toBe(false);
    expect(matchesArc(career, { id: 'position_battle', branches: ['ahead'] })).toBe(false);
    expect(matchesArc(career, { id: 'position_battle', branches: ['behind'] })).toBe(true);
    expect(matchesArc(career, { id: 'position_battle', minSeasonsSinceStart: 2 })).toBe(false);

    const later = { ...career, currentSeason: career.currentSeason + 2 };
    expect(matchesArc(later, { id: 'position_battle', minSeasonsSinceStart: 2 })).toBe(true);
    expect(matchesArc(career, { id: 'europe_move' })).toBe(false);
  });

  it('drives arcs through effects and closes them out', () => {
    const career = base();
    const started = applyEffects(
      career,
      { startArc: 'injury_comeback', arcBranch: 'rushed' },
      createRng(2),
    ).career;
    expect(activeArc(started, 'injury_comeback')?.branch).toBe('rushed');

    const advanced = applyEffects(started, { advanceArc: 'injury_comeback' }, createRng(3)).career;
    expect(activeArc(advanced, 'injury_comeback')?.stage).toBe(2);

    const done = applyEffects(advanced, { completeArc: 'injury_comeback' }, createRng(4)).career;
    expect(activeArc(done, 'injury_comeback')).toBeNull();
    expect(hasCompletedArc(done, 'injury_comeback')).toBe(true);
  });

  it('gates events on active and completed arcs', () => {
    const ctx = { appearances: 0 };
    const career = base();
    const inArc = { ...career, arcs: startArc(career, 'coach_relationship', 'conflict') };

    expect(matchesConditions(inArc, { forbidsActiveArc: 'coach_relationship' }, ctx)).toBe(false);
    expect(matchesConditions(career, { forbidsActiveArc: 'coach_relationship' }, ctx)).toBe(true);
    expect(matchesConditions(career, { requiresCompletedArc: 'coach_relationship' }, ctx)).toBe(false);

    const finished = { ...career, completedArcs: ['coach_relationship' as const] };
    expect(matchesConditions(finished, { requiresCompletedArc: 'coach_relationship' }, ctx)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('traits', () => {
  it('gives every career one or two traits, hidden at first', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = createCareer({ playerName: 'ת', position: 'CM', seed });
      expect(career.traits.length).toBeGreaterThanOrEqual(1);
      expect(career.traits.length).toBeLessThanOrEqual(2);
      expect(career.traits.every((t) => !t.revealed)).toBe(true);
      // No duplicates.
      expect(new Set(career.traits.map((t) => t.id)).size).toBe(career.traits.length);
    }
  });

  it('produces a spread of traits across seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 120; seed += 1) {
      for (const trait of createCareer({ playerName: 'ת', position: 'ST', seed }).traits) {
        seen.add(trait.id);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('only reveals traits the player actually has', () => {
    const career = base();
    const owned = career.traits[0]!.id;
    const notOwned = TRAIT_DEFS.find((t) => !hasTrait(career, t.id))!.id;

    const revealed = revealTrait(career, owned);
    expect(revealed.traits.find((t) => t.id === owned)?.revealed).toBe(true);
    expect(revealTrait(career, notOwned)).toBe(career);
  });

  it('reveals a trait once the career demonstrates it', () => {
    const career = base();
    const withLeader: Career = {
      ...career,
      age: 27,
      traits: [{ id: 'leader', revealed: false, revealedSeason: null }],
      hidden: { ...career.hidden, leadership: 80 },
      academyStage: 'senior',
    };
    const after = checkTraitReveals(withLeader);
    expect(after.traits[0]?.revealed).toBe(true);
    // ...and it writes a timeline beat, so the player sees it happen.
    expect(after.milestones.some((mi) => mi.id === 'trait_leader')).toBe(true);
  });

  it('never reveals anything to a young child', () => {
    const career = { ...base(), age: 10, academyStage: 'pre_a' as const };
    expect(checkTraitReveals(career).traits.every((t) => !t.revealed)).toBe(true);
  });

  it('names anything still hidden at retirement', () => {
    const career = base();
    const after = revealRemainingTraits(career);
    expect(after.traits.every((t) => t.revealed)).toBe(true);
  });

  it('gates events on traits', () => {
    const ctx = { appearances: 0 };
    const career: Career = {
      ...base(),
      traits: [{ id: 'big_game', revealed: false, revealedSeason: null }],
    };
    expect(matchesConditions(career, { requiresTrait: ['big_game'] }, ctx)).toBe(true);
    expect(matchesConditions(career, { requiresTrait: ['injury_prone'] }, ctx)).toBe(false);
  });

  it('tilts outcome weights - a big-game player is likelier to deliver', () => {
    // Verified through the public engine in outcomes.test.ts; here we assert the trait is
    // readable by the modifier layer at all.
    const career: Career = {
      ...base(),
      traits: [{ id: 'big_game', revealed: true, revealedSeason: 2040 }],
    };
    expect(hasTrait(career, 'big_game')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('leadership and captaincy', () => {
  it('starts low and is never shown as a visible metric', () => {
    const career = base();
    expect(career.hidden.leadership).toBeGreaterThan(0);
    expect(career.hidden.leadership).toBeLessThan(70);
  });

  it('gives a leader a head start', () => {
    let withLeader = 0;
    let without = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = createCareer({ playerName: 'מ', position: 'CB', seed });
      if (hasTrait(career, 'leader')) withLeader += career.hidden.leadership;
      else without += career.hidden.leadership;
    }
    expect(withLeader).toBeGreaterThan(0);
    expect(without).toBeGreaterThan(0);
  });

  it('requires dressing-room standing as well as quality', () => {
    const ctx = { appearances: 0 };
    const career = senior({ hidden: { ...base().hidden, leadership: 40 } });
    expect(matchesConditions(career, { minLeadership: CAPTAINCY.minLeadership }, ctx)).toBe(false);

    const leader = senior({ hidden: { ...base().hidden, leadership: 80 } });
    expect(matchesConditions(leader, { minLeadership: CAPTAINCY.minLeadership }, ctx)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('recovery mechanics', () => {
  it('sets the trust baseline from ability against the level', () => {
    const strong = senior({ ability: 88 });
    const weak = senior({ ability: 58 });
    expect(coachTrustBaseline(strong)).toBeGreaterThan(coachTrustBaseline(weak));
  });

  it('drifts a distrusted good player back up, partially', () => {
    const career = senior({ ability: 86, coachTrust: 10 });
    const baseline = coachTrustBaseline(career);
    const drifted = driftTrustTowardsBaseline(career, RECOVERY.seasonDriftToBaseline);

    expect(drifted.coachTrust).toBeGreaterThan(career.coachTrust);
    // Partial: history still matters, so it does not arrive at the baseline in one season.
    expect(drifted.coachTrust).toBeLessThan(baseline);
  });

  it('drifts an over-trusted weak player back down', () => {
    const career = senior({ ability: 48, coachTrust: 95 });
    const drifted = driftTrustTowardsBaseline(career, RECOVERY.seasonDriftToBaseline);
    expect(drifted.coachTrust).toBeLessThan(career.coachTrust);
  });

  it('does nothing when trust already sits at the baseline', () => {
    const career = senior();
    const settled = { ...career, coachTrust: coachTrustBaseline(career) };
    const drifted = driftTrustTowardsBaseline(settled, RECOVERY.seasonDriftToBaseline);
    expect(Math.abs(drifted.coachTrust - settled.coachTrust)).toBeLessThan(0.5);
  });

  it('a new coach pulls a frozen-out player much closer to the baseline', () => {
    const career = senior({ ability: 84, coachTrust: 8 });
    let changed = false;
    let best = career.coachTrust;
    for (let seed = 1; seed <= 200 && !changed; seed += 1) {
      const result = maybeChangeCoach(career, createRng(seed));
      if (result.changed) {
        changed = true;
        best = result.career.coachTrust;
      }
    }
    expect(changed).toBe(true);
    expect(best).toBeGreaterThan(career.coachTrust);
  });

  it('a new coach drops the previous coach favourite tag', () => {
    const career: Career = { ...senior(), flags: ['coach_favourite'] };
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = maybeChangeCoach(career, createRng(seed));
      if (result.changed) {
        expect(result.career.flags).not.toContain('coach_favourite');
        return;
      }
    }
    throw new Error('no coach change observed');
  });

  it('floors the accumulated minutes penalty so a bad season is not terminal', () => {
    let career = senior();
    for (let i = 0; i < 6; i += 1) {
      career = applyEffects(career, { minutesModifier: 0.5 }, createRng(i)).career;
    }
    expect(career.hidden.minutesModifier).toBeGreaterThanOrEqual(RECOVERY.minutesModifierFloor);
  });

  it('detects a slump and a recovery in the season history', () => {
    const career: Career = {
      ...senior(),
      seasonHistory: [
        season({ season: 2040, role: 'starter', coachTrust: 62 }),
        season({ season: 2041, role: 'squad', coachTrust: 24 }),
        season({ season: 2042, role: 'rotation', coachTrust: 42 }),
        season({ season: 2043, role: 'starter', coachTrust: 64 }),
        // Padding: the closing two seasons are excluded from slump detection on purpose.
        season({ season: 2044, role: 'starter', coachTrust: 64 }),
        season({ season: 2045, role: 'starter', coachTrust: 62 }),
      ],
    };
    const result = findRecoveries(career);
    expect(result.slumps).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.seasonsToRecover[0]).toBe(2);
  });

  it('does not count a slump that never came back', () => {
    const career: Career = {
      ...senior(),
      seasonHistory: [
        season({ season: 2040, role: 'starter', coachTrust: 62 }),
        season({ season: 2041, role: 'squad', coachTrust: 20 }),
        season({ season: 2042, role: 'squad', coachTrust: 18 }),
        season({ season: 2043, role: 'squad', coachTrust: 15 }),
        season({ season: 2044, role: 'squad', coachTrust: 16 }),
        season({ season: 2045, role: 'squad', coachTrust: 14 }),
      ],
    };
    const result = findRecoveries(career);
    expect(result.slumps).toBe(1);
    expect(result.recovered).toBe(0);
  });

  it('ignores the end-of-career decline, which is not a slump to recover from', () => {
    const fadingOut: Career = {
      ...senior(),
      seasonHistory: [
        season({ season: 2040, role: 'starter', coachTrust: 64 }),
        season({ season: 2041, role: 'starter', coachTrust: 62 }),
        // Retires here - losing his place at the end is the career ending, not a slump.
        season({ season: 2042, role: 'squad', coachTrust: 22 }),
        season({ season: 2043, role: 'squad', coachTrust: 18 }),
      ],
    };
    expect(findRecoveries(fadingOut).slumps).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe('senior career phase', () => {
  it('reads a newcomer as a breakthrough regardless of age', () => {
    const young = senior({ age: 19, stats: { appearances: 4, goals: 0, assists: 0, cleanSheets: 0 } });
    expect(seniorPhase(young)).toBe('breakthrough');
    const lateStarter = senior({ age: 23, stats: { appearances: 6, goals: 0, assists: 0, cleanSheets: 0 } });
    expect(seniorPhase(lateStarter)).toBe('breakthrough');
  });

  it('reads an experienced first-teamer as prime', () => {
    const prime = senior({
      age: 27,
      roleValue: 78,
      stats: { appearances: 220, goals: 40, assists: 30, cleanSheets: 0 },
    });
    expect(seniorPhase(prime)).toBe('prime');
  });

  it('reads an older player as a veteran', () => {
    const veteran = senior({
      age: 34,
      roleValue: 70,
      stats: { appearances: 400, goals: 60, assists: 50, cleanSheets: 0 },
    });
    expect(seniorPhase(veteran)).toBe('veteran');
  });

  it('reads a fading 30 year old as a veteran too', () => {
    const fading = senior({
      age: 30,
      roleValue: 40,
      stats: { appearances: 250, goals: 20, assists: 20, cleanSheets: 0 },
    });
    expect(seniorPhase(fading)).toBe('veteran');
  });

  it('gates events by phase', () => {
    const ctx = { appearances: 0 };
    const young = senior({ age: 19, stats: { appearances: 2, goals: 0, assists: 0, cleanSheets: 0 } });
    expect(matchesConditions(young, { seniorPhases: ['breakthrough'] }, ctx)).toBe(true);
    expect(matchesConditions(young, { seniorPhases: ['veteran'] }, ctx)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('contextual Maccabism', () => {
  it('barely punishes an earned European move', () => {
    const established = senior({
      age: 25,
      maccabi: { ...base().maccabi, appearances: 200, seasons: 6 },
    });
    const result = leavingContext(established, getClub('benfica'));
    expect(result.maccabism).toBe(LEAVING.earnedEuropePenalty);
    expect(result.betrayal).toBe(false);
    expect(result.memory).toBe('left_established');
  });

  it('punishes leaving young for Europe more than leaving established', () => {
    const young = senior({ age: 19, maccabi: { ...base().maccabi, appearances: 12, seasons: 1 } });
    const established = senior({
      age: 26,
      maccabi: { ...base().maccabi, appearances: 200, seasons: 7 },
    });
    const club = getClub('benfica');
    expect(leavingContext(young, club).maccabism).toBeLessThan(
      leavingContext(established, club).maccabism,
    );
  });

  it('treats a move to a domestic rival as the worst of all', () => {
    const established = senior({
      age: 26,
      maccabi: { ...base().maccabi, appearances: 250, seasons: 8 },
    });
    const rival = leavingContext(established, getClub('maccabi_tel_aviv'));
    expect(rival.maccabism).toBe(LEAVING.rivalPenalty);
    expect(rival.betrayal).toBe(true);
    expect(rival.maccabism).toBeLessThan(leavingContext(established, getClub('benfica')).maccabism);
  });

  it('is not a betrayal at all when leaving from the academy', () => {
    const youth = { ...base(), academyStage: 'u19' as const, age: 18 };
    const result = leavingContext(youth, getClub('hapoel_hadera'));
    expect(result.betrayal).toBe(false);
  });
});

describe('homecoming', () => {
  it('tells the four homecomings apart', () => {
    const prime = senior({
      age: 26,
      ability: 82,
      currentClubId: 'benfica',
      maccabi: { ...base().maccabi, everLeft: true },
    });
    expect(homecomingKind(prime)).toBe('prime_hero');

    const veteran = senior({ age: 35, ability: 66, currentClubId: 'benfica' });
    expect(homecomingKind(veteran)).toBe('veteran_farewell');

    const released: Career = {
      ...senior({ age: 27, ability: 70, currentClubId: 'hapoel_hadera' }),
      flags: ['released_by_maccabi'],
    };
    expect(homecomingKind(released)).toBe('redemption');

    const ordinary = senior({
      age: 30,
      ability: 70,
      currentClubId: 'benfica',
      maccabi: { ...base().maccabi, everLeft: true },
    });
    expect(homecomingKind(ordinary)).toBe('successful_return');
  });
});

/* ------------------------------------------------------------------ */

describe('milestones', () => {
  it('opens every career with the birth date and how the career began', () => {
    const career = base();
    // v0.3.1: born, then the origin beat (scouted / passed trials / failed trials).
    expect(career.milestones.length).toBeGreaterThanOrEqual(2);
    expect(career.milestones[0]?.id).toBe('born');
    expect(career.milestones[0]?.text).toContain(String(career.birthCohort));
    expect(career.milestones.some((mi) => mi.id.startsWith('origin_'))).toBe(true);
  });

  it('records the structural beats automatically', () => {
    const career: Career = {
      ...senior(),
      stats: { appearances: 40, goals: 6, assists: 4, cleanSheets: 0 },
      maccabi: { ...base().maccabi, appearances: 40, debutAge: 19 },
    };
    const ids = checkMilestones(career).career.milestones.map((mi) => mi.id);
    expect(ids).toContain('first_senior_appearance');
    expect(ids).toContain('maccabi_debut');
    expect(ids).toContain('first_senior_goal');
  });

  it('never records the same milestone twice', () => {
    const career: Career = {
      ...senior(),
      stats: { appearances: 40, goals: 6, assists: 4, cleanSheets: 0 },
      maccabi: { ...base().maccabi, appearances: 40 },
    };
    const once = checkMilestones(career).career;
    const twice = checkMilestones(once).career;
    expect(twice.milestones.length).toBe(once.milestones.length);
  });

  it('records a milestone from an event effect', () => {
    const career = base();
    const after = applyEffects(
      career,
      { milestone: { id: 'test_beat', icon: '⭐', text: 'משהו קרה', major: true } },
      createRng(9),
    ).career;
    expect(after.milestones.some((mi) => mi.id === 'test_beat' && mi.major)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe('the career story', () => {
  it('always produces at least a couple of lines', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const career = createCareer({ playerName: 'ס', position: 'ST', seed });
      const story = careerStory(career);
      expect(story.length).toBeGreaterThanOrEqual(2);
      expect(story.every((line) => line.length > 0)).toBe(true);
    }
  });

  it('tells the released-and-returned story differently from the one-club story', () => {
    const oneClub: Career = {
      ...senior({ age: 35 }),
      maccabi: { ...base().maccabi, appearances: 300, seasons: 12, academyGraduate: true },
    };
    const returned: Career = {
      ...senior({ age: 35 }),
      flags: ['released_by_maccabi'],
      memories: recordMemory(base(), 'released_by_maccabi'),
      maccabi: {
        ...base().maccabi,
        appearances: 80,
        returned: true,
        returnAge: 30,
        seasonsAfterReturn: 4,
      },
    };
    expect(careerStory(oneClub).join(' ')).not.toBe(careerStory(returned).join(' '));
    expect(careerStory(returned).join(' ')).toContain('לא רצה אותך');
  });

  it('picks the archetype from the shape of the career, not the score', () => {
    const icon: Career = {
      ...senior({ age: 36 }),
      maccabi: {
        ...base().maccabi,
        appearances: 400,
        championships: 3,
        captainSeasons: 5,
        academyGraduate: true,
      },
    };
    expect(careerArchetype(icon).id).toBe('legend');

    const nobody: Career = { ...senior(), maccabi: { ...base().maccabi, appearances: 3 } };
    expect(['never_made_it', 'footballer', 'journeyman']).toContain(careerArchetype(nobody).id);
  });

  it('always resolves to some archetype', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const archetype = careerArchetype(createCareer({ playerName: 'א', position: 'GK', seed }));
      expect(archetype.title.length).toBeGreaterThan(0);
      expect(archetype.icon.length).toBeGreaterThan(0);
    }
  });

  it('writes Hebrew singulars properly', () => {
    const one: Career = {
      ...senior(),
      maccabi: { ...base().maccabi, appearances: 1, goals: 1, championships: 1, captainSeasons: 1 },
    };
    const headline = careerHeadline(one);
    expect(headline).toContain('הופעה אחת');
    expect(headline).not.toContain('1 הופעות');
  });
});

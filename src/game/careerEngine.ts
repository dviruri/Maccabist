/**
 * The public API of the game engine.
 *
 * React only ever calls these functions - it never touches the other engine modules.
 * Every function takes a Career and returns a new Career, with the RNG state carried
 * inside the career itself so a save file resumes the exact same random stream.
 */

import { MACCABI_ACADEMY_ID, getClub } from '../data/clubs';
import { EVENTS_BY_ID } from '../data/events';
import type { Career, Position } from '../types';
import { RETIREMENT_FORCED_AGE, RETIREMENT_MIN_AGE, START, START_AGE, START_SEASON_MAX, START_SEASON_MIN } from './balance';
import { eventsPerSeason, pickEvents, resolveEventChoice } from './eventEngine';
import { computeLegendScore } from './legendEngine';
import { applyEffects, checkAchievements, cloneCareer } from './progressionEngine';
import { clamp, createRng, randomSeed, round, type Rng } from './random';
import { playSeason } from './seasonEngine';
import { isAtMaccabiSenior, statusFromValue } from './rules';
import {
  acceptOffer as acceptTransferOffer,
  applyAutomaticMoves,
  declineAllOffers,
  generateOffers,
} from './transferEngine';

/** Runs `fn` with a fresh Rng seeded from the career and stores the advanced state back. */
function withRng<T extends { rngState: number }>(career: T, fn: (rng: Rng) => T): T {
  const rng = createRng(career.rngState);
  const result = fn(rng);
  return { ...result, rngState: rng.getState() };
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export interface NewCareerInput {
  playerName: string;
  position: Position;
  /** Optional fixed seed - the same seed and the same decisions produce the same career. */
  seed?: number;
}

export function createCareer(input: NewCareerInput): Career {
  const seed = input.seed ?? randomSeed();
  const rng = createRng(seed);

  const isWonderkid = rng.chance(START.wonderkidChance);
  const potential = isWonderkid
    ? rng.int(START.wonderkidPotentialMin, 99)
    : rng.int(START.potentialMin, START.potentialMax);

  const career: Career = {
    id: `career_${seed.toString(36)}_${Date.now().toString(36)}`,
    createdAt: Date.now(),
    playerName: input.playerName.trim() || 'מכביסט',
    position: input.position,

    age: START_AGE,
    startAge: START_AGE,
    currentSeason: rng.int(START_SEASON_MIN, START_SEASON_MAX),
    startSeason: 0,

    ability: rng.int(START.abilityMin, START.abilityMax),
    hidden: {
      potential,
      form: START.form + rng.int(-6, 6),
      confidence: START.confidence + rng.int(-6, 6),
      injuryRisk: START.injuryRisk + rng.int(-6, 8),
      discipline: START.discipline + rng.int(-10, 12),
      pressure: START.pressure + rng.int(-8, 8),
      minutesModifier: 1,
      transferBoost: 0,
    },

    maccabism: rng.int(START.maccabismMin, START.maccabismMax),
    reputation: START.reputation,
    statusValue: START.statusValue,
    status: statusFromValue(START.statusValue),

    currentClubId: MACCABI_ACADEMY_ID,
    parentClubId: null,
    loanSeasonsLeft: 0,

    captain: false,
    captainSeasons: 0,

    stats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0 },
    maccabi: {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      seasons: 0,
      championships: 0,
      cups: 0,
      europeanRuns: 0,
      captainSeasons: 0,
      academyGraduate: false,
      everLeft: false,
      returned: false,
      returnAge: null,
      seasonsAfterReturn: 0,
      loyaltyMoments: 0,
      betrayalMoments: 0,
      debutAge: null,
    },
    peakAbility: 0,

    seasonHistory: [],
    trophies: [],
    achievements: [],
    eventsHistory: [],
    seenEventIds: [],
    flags: [],

    phase: 'preseason',
    pendingEventIds: [],
    pendingOffers: [],
    lastSeasonRecord: null,
    lastSeasonDeltas: [],
    lastEventResult: null,
    lastAchievements: [],

    retired: false,
    retirementAge: null,
    legend: null,

    seed,
    rngState: rng.getState(),
  };

  career.startSeason = career.currentSeason;
  career.peakAbility = career.ability;
  return career;
}

/* ------------------------------------------------------------------ */
/* Season loop                                                         */
/* ------------------------------------------------------------------ */

/** Preseason -> queue this season's events and open the first one. */
export function beginSeason(career: Career): Career {
  return withRng(career, (rng) => {
    const next = cloneCareer(career);
    next.pendingEventIds = pickEvents(next, rng, eventsPerSeason(next, rng));
    next.lastEventResult = null;
    next.lastAchievements = [];
    next.phase = next.pendingEventIds.length > 0 ? 'event' : 'preseason';
    return next;
  });
}

/** Applies a decision. The career stays in the `event` phase so the outcome can be shown. */
export function answerEvent(career: Career, eventId: string, choiceId: string): Career {
  return withRng(career, (rng) => {
    const { career: next } = resolveEventChoice(career, eventId, choiceId, rng);
    return next;
  });
}

/** After the outcome is read: next event, or straight into the season. */
export function continueAfterEvent(career: Career): Career {
  const next = cloneCareer(career);
  next.lastEventResult = null;
  next.lastAchievements = [];
  if (next.pendingEventIds.length > 0) {
    next.phase = 'event';
    return next;
  }
  return simulateCurrentSeason(next);
}

/** Runs the season simulation and moves to the results screen. */
export function simulateCurrentSeason(career: Career): Career {
  return withRng(career, (rng) => {
    const before = career;
    const { career: played } = playSeason(career, rng);
    const next = cloneCareer(played);
    next.lastSeasonDeltas = [
      { key: 'ability', label: 'יכולת', from: Math.round(before.ability), to: Math.round(next.ability) },
      { key: 'maccabism', label: 'מכביסטיות', from: Math.round(before.maccabism), to: Math.round(next.maccabism) },
      { key: 'reputation', label: 'מוניטין', from: Math.round(before.reputation), to: Math.round(next.reputation) },
      { key: 'statusValue', label: 'מעמד', from: Math.round(before.statusValue), to: Math.round(next.statusValue) },
    ].filter((delta) => delta.from !== delta.to);
    next.phase = 'season_result';
    return next;
  });
}

/** After the season card: generate summer business, or roll straight into next season. */
export function continueAfterSeason(career: Career): Career {
  const withOffers = withRng(career, (rng) => {
    let next = cloneCareer(career);
    next.lastAchievements = [];
    next = maybeAwardCaptaincy(next, rng);
    next.pendingOffers = generateOffers(next, rng);
    next.phase = next.pendingOffers.length > 0 ? 'offseason' : 'preseason';
    return next;
  });
  // Nothing to decide - jump straight into next season.
  return withOffers.phase === 'offseason' ? withOffers : advanceYear(withOffers);
}

export function chooseOffer(career: Career, offerId: string): Career {
  const moved = withRng(career, (rng) => acceptTransferOffer(career, offerId, rng));
  return advanceYear(moved);
}

export function rejectOffers(career: Career): Career {
  const stayed = withRng(career, (rng) => declineAllOffers(career, rng));
  return advanceYear(stayed);
}

/* ------------------------------------------------------------------ */
/* Year rollover + retirement                                          */
/* ------------------------------------------------------------------ */

function maybeAwardCaptaincy(career: Career, rng: Rng): Career {
  if (career.captain) return career;
  if (!isAtMaccabiSenior(career)) return career;
  if (career.flags.includes('refused_captaincy')) return career;
  if (career.statusValue < 82 || career.maccabi.seasons < 4) return career;
  if (!rng.chance(0.45)) return career;
  const next = cloneCareer(career);
  next.captain = true;
  return next;
}

export function retirementChance(career: Career): number {
  if (career.age < RETIREMENT_MIN_AGE) return 0;
  let chance = (career.age - RETIREMENT_MIN_AGE + 1) * 0.09;
  chance += Math.max(0, career.peakAbility - career.ability) * 0.01;
  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;
  if (lastApps < 12) chance += 0.18;
  if (career.flags.includes('retirement_considered')) chance += 0.08;
  return clamp(chance, 0, 0.97) as number;
}

/** Ages the player a year, applies automatic moves and decides whether the end is near. */
export function advanceYear(career: Career): Career {
  const aged = withRng(career, (rng) => {
    let next = cloneCareer(career);
    next.age += 1;
    next.currentSeason += 1;
    next = applyAutomaticMoves(next);

    const checked = checkAchievements(next);
    next = checked.career;
    next.lastAchievements = checked.unlocked;

    if (next.age >= RETIREMENT_FORCED_AGE) {
      next.phase = 'retirement_decision';
      return next;
    }
    next.phase = rng.chance(retirementChance(next)) ? 'retirement_decision' : 'preseason';
    return next;
  });

  // Past the hard limit the boots come off whether you like it or not.
  return aged.age >= RETIREMENT_FORCED_AGE ? retire(aged) : aged;
}

export type RetirementDecision = 'continue' | 'retire';

export function decideRetirement(career: Career, decision: RetirementDecision): Career {
  if (decision === 'retire') return retire(career);
  return withRng(career, (rng) => {
    // One more year: a little extra determination, a little more wear.
    const next = cloneCareer(
      applyEffects(career, { form: 4, maccabism: 2, injuryRisk: 6, confidence: 3 }, rng).career,
    );
    next.phase = 'preseason';
    return next;
  });
}

export function retire(career: Career): Career {
  const next = cloneCareer(career);
  next.retired = true;
  next.retirementAge = next.age;
  next.phase = 'retired';
  next.pendingEventIds = [];
  next.pendingOffers = [];
  next.legend = computeLegendScore(next);
  next.ability = round(next.ability, 1);
  return next;
}

/* ------------------------------------------------------------------ */
/* Convenience                                                         */
/* ------------------------------------------------------------------ */

export function clubOf(career: Career) {
  return getClub(career.currentClubId);
}

/**
 * One "click" of the game loop, used by the debug panel and by headless simulation.
 * Chooses randomly whenever a decision is required.
 */
export function autoStep(career: Career): Career {
  const rng = createRng(career.rngState ^ 0x9e3779b9);
  switch (career.phase) {
    case 'preseason':
      return beginSeason(career);
    case 'event': {
      if (career.lastEventResult) return continueAfterEvent(career);
      const eventId = career.pendingEventIds[0];
      if (!eventId) return continueAfterEvent(career);
      const event = EVENTS_BY_ID[eventId];
      const choice = event ? rng.pick(event.choices) : null;
      return choice ? answerEvent(career, eventId, choice.id) : continueAfterEvent(career);
    }
    case 'season_result':
      return continueAfterSeason(career);
    case 'offseason': {
      const mandatory = career.pendingOffers.find((o) => o.mandatory);
      if (mandatory) return chooseOffer(career, mandatory.id);
      if (career.pendingOffers.length > 0 && rng.chance(0.5)) {
        return chooseOffer(career, rng.pick(career.pendingOffers).id);
      }
      return rejectOffers(career);
    }
    case 'retirement_decision':
      return decideRetirement(career, rng.chance(0.5) ? 'continue' : 'retire');
    default:
      return career;
  }
}

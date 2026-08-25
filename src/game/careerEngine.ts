/**
 * The public API of the game engine.
 *
 * React only ever calls these functions - it never touches the other engine modules.
 * Every function takes a Career and returns a new Career, with the RNG state carried
 * inside the career itself so a save file resumes the exact same random stream.
 *
 * The season is a small state machine:
 *
 *   preseason → [early event] → first half → [mid summary] → [mid event]
 *             → second half → [late key moment] → season summary
 *             → progression / youth-to-senior / transfers → next season
 */

import { FIRST_STAGE, stageConfig } from '../data/academy';
import { MACCABI_ACADEMY_ID, getClub } from '../data/clubs';
import { EVENTS_BY_ID } from '../data/events';
import type { AttributeDelta, Career, Position, SeasonSlot } from '../types';
import {
  RETIREMENT_FORCED_AGE,
  RETIREMENT_MIN_AGE,
  START,
  START_AGE,
  START_SEASON_MAX,
  START_SEASON_MIN,
} from './balance';
import { planSeason, resolveEventChoice } from './eventEngine';
import { computeLegendScore } from './legendEngine';
import {
  applyEffects,
  checkAchievements,
  cloneCareer,
  endOfSeasonReset,
  resolveAcademyProgression,
} from './progressionEngine';
import { clamp, createRng, randomSeed, round, type Rng } from './random';
import { isAtMaccabiSenior, isInAcademy, roleFromValue } from './rules';
import { playFirstHalf, playSecondHalf } from './seasonEngine';
import {
  acceptOffer as acceptTransferOffer,
  applyAutomaticMoves,
  declineAllOffers,
  evaluateSeniorTransition,
  generateOffers,
  seniorTransitionOffers,
  stayAnotherYouthYear,
  verdictToProgression,
} from './transferEngine';

export const SCHEMA_VERSION = 2;

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
  /** Optional fixed seed - the same seed and the same decisions reproduce the career. */
  seed?: number;
}

export function createCareer(input: NewCareerInput): Career {
  const seed = input.seed ?? randomSeed();
  const rng = createRng(seed);

  const isWonderkid = rng.chance(START.wonderkidChance);
  const potential = isWonderkid
    ? rng.int(START.wonderkidPotentialMin, START.wonderkidPotentialMax)
    : rng.int(START.potentialMin, START.potentialMax);

  const career: Career = {
    id: `career_${seed.toString(36)}_${Date.now().toString(36)}`,
    schemaVersion: SCHEMA_VERSION,
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
      promotionBoost: 0,
    },

    maccabism: rng.int(START.maccabismMin, START.maccabismMax),
    reputation: START.reputation,
    coachTrust: rng.int(START.coachTrustMin, START.coachTrustMax),
    roleValue: START.roleValue + rng.int(-6, 6),
    role: 'squad',

    academyStage: FIRST_STAGE,
    olderGroup: 'none',
    seasonsAtStage: 0,

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
      academySeasons: 0,
      earlyPromotions: 0,
    },
    peakAbility: 0,

    seasonHistory: [],
    trophies: [],
    achievements: [],
    eventsHistory: [],
    flags: [],

    phase: 'preseason',
    seasonSlot: 'early',
    pendingEventIds: [],
    plannedEvents: [],
    pendingOffers: [],

    firstHalfStats: null,
    seasonOpening: null,
    lastSeasonRecord: null,
    lastSeasonDeltas: [],
    lastEventResult: null,
    lastAchievements: [],
    lastProgression: null,

    retired: false,
    retirementAge: null,
    legend: null,

    seed,
    rngState: rng.getState(),
  };

  career.startSeason = career.currentSeason;
  career.peakAbility = career.ability;
  career.role = roleFromValue(career.roleValue);
  return career;
}

/* ------------------------------------------------------------------ */
/* Season flow                                                         */
/* ------------------------------------------------------------------ */

function snapshotOpening(career: Career): Career {
  const next = cloneCareer(career);
  next.seasonOpening = {
    ability: career.ability,
    coachTrust: career.coachTrust,
    maccabism: career.maccabism,
    reputation: career.reputation,
    roleValue: career.roleValue,
  };
  return next;
}

function loadSlotEvents(career: Career, slot: SeasonSlot): Career {
  const next = cloneCareer(career);
  next.seasonSlot = slot;
  next.pendingEventIds = next.plannedEvents.filter((p) => p.slot === slot).map((p) => p.eventId);
  next.plannedEvents = next.plannedEvents.filter((p) => p.slot !== slot);
  return next;
}

function seasonDeltas(career: Career): AttributeDelta[] {
  const open = career.seasonOpening;
  if (!open) return [];
  const rows: AttributeDelta[] = [
    { key: 'ability', label: 'יכולת', from: Math.round(open.ability), to: Math.round(career.ability) },
    {
      key: 'coachTrust',
      label: 'אמון המאמן',
      from: Math.round(open.coachTrust),
      to: Math.round(career.coachTrust),
    },
    {
      key: 'maccabism',
      label: 'מכביסטיות',
      from: Math.round(open.maccabism),
      to: Math.round(career.maccabism),
    },
    {
      key: 'reputation',
      label: 'מוניטין',
      from: Math.round(open.reputation),
      to: Math.round(career.reputation),
    },
  ];
  return rows.filter((row) => row.from !== row.to);
}

/**
 * The single driver that walks a season forward from wherever it currently is.
 * Every UI "continue" ends up here.
 */
function advanceSeasonFlow(career: Career): Career {
  return withRng(career, (rng) => {
    let next = cloneCareer(career);

    // An event is waiting in the current slot - hand it to the player.
    if (next.pendingEventIds.length > 0) {
      next.phase = 'event';
      return next;
    }

    if (next.seasonSlot === 'early') {
      next = playFirstHalf(next, rng);
      next = loadSlotEvents(next, 'mid');
      if (stageConfig(next.academyStage).showMidSeason) {
        next.phase = 'mid_season';
        return next;
      }
      if (next.pendingEventIds.length > 0) {
        next.phase = 'event';
        return next;
      }
      // fall through to the second half
    }

    if (next.seasonSlot === 'mid') {
      const played = playSecondHalf(next, rng);
      next = loadSlotEvents(played.career, 'late');
      if (next.pendingEventIds.length > 0) {
        next.phase = 'event';
        return next;
      }
    }

    // Season is done.
    next = cloneCareer(next);
    next.lastSeasonDeltas = seasonDeltas(next);
    next.phase = 'season_result';
    return next;
  });
}

/** Preseason -> plan the season's decision points and start it. */
export function beginSeason(career: Career): Career {
  const prepared = withRng(career, (rng) => {
    let next = snapshotOpening(career);
    next.plannedEvents = planSeason(next, rng);
    next.lastEventResult = null;
    next.lastAchievements = [];
    next.lastProgression = null;
    next.firstHalfStats = null;
    next = loadSlotEvents(next, 'early');
    return next;
  });
  return advanceSeasonFlow(prepared);
}

/** Applies a decision. The career stays in the `event` phase so the outcome can be shown. */
export function answerEvent(career: Career, eventId: string, choiceId: string): Career {
  return withRng(career, (rng) => {
    const { career: next } = resolveEventChoice(career, eventId, choiceId, rng, career.seasonSlot);
    return next;
  });
}

/** After the outcome card: next event in this slot, or on with the season. */
export function continueAfterEvent(career: Career): Career {
  const cleared = cloneCareer(career);
  cleared.lastEventResult = null;
  cleared.lastAchievements = [];
  return advanceSeasonFlow(cleared);
}

/** After the mid-season card. */
export function continueAfterMidSeason(career: Career): Career {
  return advanceSeasonFlow(career);
}

/* ------------------------------------------------------------------ */
/* End of season                                                       */
/* ------------------------------------------------------------------ */

/** Season summary -> academy promotion, the נוער verdict, or the senior transfer window. */
export function continueAfterSeason(career: Career): Career {
  const rating = career.lastSeasonRecord?.stats.rating ?? 55;

  const resolved = withRng(career, (rng) => {
    let next = endOfSeasonReset(career);
    next.lastAchievements = [];

    /* ---------- the big one: leaving נוער ---------- */
    if (next.academyStage === 'u19' && next.age >= 17) {
      const verdict = evaluateSeniorTransition(next, rng);
      next = cloneCareer(next);
      next.lastProgression = verdictToProgression(next, verdict);
      next.pendingOffers = seniorTransitionOffers(next, verdict, rng);
      if (verdict.path === 'another_year') {
        next = stayAnotherYouthYear(next);
        next.lastProgression = verdictToProgression(career, verdict);
      }
      next.phase = 'youth_to_senior';
      return next;
    }

    /* ---------- academy ladder ---------- */
    if (isInAcademy(next)) {
      const promoted = resolveAcademyProgression(next, rating, rng);
      next = cloneCareer(promoted.career);
      next.lastProgression = promoted.result;
      const checked = checkAchievements(next);
      next = checked.career;
      next.lastAchievements = checked.unlocked;
      next.phase = 'progression';
      return next;
    }

    /* ---------- senior transfer window ---------- */
    next = maybeAwardCaptaincy(next, rng);
    next.pendingOffers = generateOffers(next, rng);
    next.phase = next.pendingOffers.length > 0 ? 'offseason' : 'preseason';
    return next;
  });

  // Quiet summer for a senior player - roll straight into the next season.
  return resolved.phase === 'preseason' ? advanceYear(resolved) : resolved;
}

/** After the promotion card. */
export function continueAfterProgression(career: Career): Career {
  return advanceYear(career);
}

/** The player picks one of the paths offered by the נוער verdict. */
export function resolveYouthTransition(career: Career, offerId: string | null): Career {
  if (offerId === null) {
    // "Another year in נוער" - nothing to sign.
    return advanceYear(career);
  }
  return chooseOffer(career, offerId);
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
  if (career.roleValue < 82 || career.maccabi.seasons < 4) return career;
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
    next.seasonSlot = 'early';
    next.pendingEventIds = [];
    next.plannedEvents = [];
    next.pendingOffers = [];
    next.firstHalfStats = null;
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

  return aged.age >= RETIREMENT_FORCED_AGE ? retire(aged) : aged;
}

export type RetirementDecision = 'continue' | 'retire';

export function decideRetirement(career: Career, decision: RetirementDecision): Career {
  if (decision === 'retire') return retire(career);
  return withRng(career, (rng) => {
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
  next.plannedEvents = [];
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
 * One "click" of the game loop, choosing at random whenever a decision is required.
 * Used by the debug panel; the headless simulator has its own policy-driven version.
 */
export function autoStep(career: Career): Career {
  const rng = createRng((career.rngState ^ 0x9e3779b9) >>> 0);
  switch (career.phase) {
    case 'preseason':
      return beginSeason(career);
    case 'event': {
      if (career.lastEventResult) return continueAfterEvent(career);
      const eventId = career.pendingEventIds[0];
      const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
      if (!event || !eventId) return continueAfterEvent(career);
      return answerEvent(career, eventId, rng.pick(event.choices).id);
    }
    case 'mid_season':
      return continueAfterMidSeason(career);
    case 'season_result':
      return continueAfterSeason(career);
    case 'progression':
      return continueAfterProgression(career);
    case 'youth_to_senior': {
      const offer = career.pendingOffers[0];
      return resolveYouthTransition(career, offer ? offer.id : null);
    }
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

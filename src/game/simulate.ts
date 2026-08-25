/**
 * Headless career simulation.
 *
 * The UI is not involved at any point here, which is the whole reason the engine is
 * separated from React: `simulateCareer()` can be run tens of thousands of times to check
 * that the academy, the probabilities and the Legend Score are producing sane distributions.
 */

import { EVENTS_BY_ID } from '../data/events';
import type { Career, GameEvent, TransferOffer } from '../types';
import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterMidSeason,
  continueAfterProgression,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  resolveYouthTransition,
  type NewCareerInput,
  type RetirementDecision,
} from './careerEngine';
import { createRng, type Rng } from './random';

export interface CareerPolicy {
  pickChoice(event: GameEvent, career: Career, rng: Rng): string;
  pickOffer(offers: TransferOffer[], career: Career, rng: Rng): string | null;
  pickRetirement(career: Career, rng: Rng): RetirementDecision;
}

/** Decides at random. The baseline for "what does an average career look like". */
export const randomPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => rng.pick(event.choices).id,
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    if (offers.length === 0) return null;
    return rng.chance(0.5) ? rng.pick(offers).id : null;
  },
  pickRetirement: (_career, rng) => (rng.chance(0.55) ? 'continue' : 'retire'),
};

/** Always takes the boldest option available - the "go for it" player. */
export const ambitiousPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    const bold = event.choices.filter((c) => c.risk === 'opportunity' || c.risk === 'risky');
    return bold.length > 0 ? rng.pick(bold).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    return offers.length > 0 ? rng.pick(offers).id : null;
  },
  pickRetirement: (career) => (career.age >= 35 ? 'retire' : 'continue'),
};

/** A one-club man: takes the safe road and never leaves willingly. */
export const loyalPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    const safe = event.choices.filter((c) => c.risk === 'safe' || c.risk === 'balanced');
    return safe.length > 0 ? rng.pick(safe).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    const home = offers.find((o) => o.kind === 'return_home' || o.kind === 'promotion');
    return home?.id ?? null;
  },
  pickRetirement: (career) => (career.age >= 36 ? 'retire' : 'continue'),
};

export interface SimulateOptions extends NewCareerInput {
  policy?: CareerPolicy;
  /** Safety valve so a bug can never hang a batch run. */
  maxSteps?: number;
}

export function simulateCareer(options: SimulateOptions): Career {
  const { policy = randomPolicy, maxSteps = 1200, ...input } = options;
  let career = createCareer(input);
  const rng = createRng((career.seed ^ 0x5bf03635) >>> 0);

  let steps = 0;
  while (!career.retired && steps < maxSteps) {
    steps += 1;
    switch (career.phase) {
      case 'preseason':
        career = beginSeason(career);
        break;
      case 'event': {
        if (career.lastEventResult) {
          career = continueAfterEvent(career);
          break;
        }
        const eventId = career.pendingEventIds[0];
        const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
        if (!event || !eventId) {
          career = continueAfterEvent(career);
          break;
        }
        career = answerEvent(career, eventId, policy.pickChoice(event, career, rng));
        break;
      }
      case 'mid_season':
        career = continueAfterMidSeason(career);
        break;
      case 'season_result':
        career = continueAfterSeason(career);
        break;
      case 'progression':
        career = continueAfterProgression(career);
        break;
      case 'youth_to_senior': {
        const pick = policy.pickOffer(career.pendingOffers, career, rng);
        career = resolveYouthTransition(career, pick ?? career.pendingOffers[0]?.id ?? null);
        break;
      }
      case 'offseason': {
        const pick = policy.pickOffer(career.pendingOffers, career, rng);
        career = pick ? chooseOffer(career, pick) : rejectOffers(career);
        break;
      }
      case 'retirement_decision':
        career = decideRetirement(career, policy.pickRetirement(career, rng));
        break;
      default:
        break;
    }
  }

  return career;
}

/* ------------------------------------------------------------------ */
/* Batch analysis                                                      */
/* ------------------------------------------------------------------ */

export interface BatchResult {
  count: number;
  /** Share of careers that ever pulled on a senior Maccabi shirt. */
  reachedMaccabiSeniors: number;
  /** Share that were promoted from נוער straight into the first team. */
  academyGraduates: number;
  /** Share that were skipped up an age group at least once. */
  earlyPromotion: number;
  /** Share that hit at least 'starter' role in a senior season. */
  reachedStarter: number;
  captain: number;
  releasedFromAcademy: number;
  rareBreakthrough: number;
  averagePeakAbility: number;
  averageLegendScore: number;
  averageMaccabiAppearances: number;
  averageCareerSeasons: number;
  averageRetirementAge: number;
  endings: Record<string, number>;
  byPosition: Record<string, { count: number; peakAbility: number; legend: number }>;
}

const RARE_EVENT_IDS = ['rare_tournament', 'rare_leap', 'rare_derby_legend'];

/** Runs many careers and reports aggregates - the starting point for balancing. */
export function simulateBatch(count: number, options: Omit<SimulateOptions, 'seed'>): BatchResult {
  const endings: Record<string, number> = {};
  const byPosition: BatchResult['byPosition'] = {};
  let reachedSeniors = 0;
  let graduates = 0;
  let early = 0;
  let starter = 0;
  let captain = 0;
  let released = 0;
  let rare = 0;
  let peakSum = 0;
  let legendSum = 0;
  let appsSum = 0;
  let seasonsSum = 0;
  let ageSum = 0;

  for (let i = 0; i < count; i += 1) {
    const career = simulateCareer({ ...options, seed: ((i + 1) * 2654435761) >>> 0 });

    if (career.maccabi.appearances > 0) reachedSeniors += 1;
    if (career.maccabi.academyGraduate) graduates += 1;
    if (career.maccabi.earlyPromotions > 0) early += 1;
    if (career.flags.includes('released_by_maccabi')) released += 1;
    if (career.maccabi.captainSeasons > 0) captain += 1;
    if (career.eventsHistory.some((e) => RARE_EVENT_IDS.includes(e.eventId))) rare += 1;

    const seniorSeasons = career.seasonHistory.filter((s) => s.academyStage === 'senior');
    if (seniorSeasons.some((s) => ['starter', 'key', 'star', 'icon'].includes(s.role))) {
      starter += 1;
    }

    peakSum += career.peakAbility;
    legendSum += career.legend?.score ?? 0;
    appsSum += career.maccabi.appearances;
    seasonsSum += career.seasonHistory.length;
    ageSum += career.retirementAge ?? career.age;

    const endingId = career.legend?.ending.title ?? 'none';
    endings[endingId] = (endings[endingId] ?? 0) + 1;

    const pos = byPosition[career.position] ?? { count: 0, peakAbility: 0, legend: 0 };
    pos.count += 1;
    pos.peakAbility += career.peakAbility;
    pos.legend += career.legend?.score ?? 0;
    byPosition[career.position] = pos;
  }

  for (const key of Object.keys(byPosition)) {
    const p = byPosition[key];
    if (!p) continue;
    p.peakAbility = p.peakAbility / p.count;
    p.legend = p.legend / p.count;
  }

  return {
    count,
    reachedMaccabiSeniors: reachedSeniors / count,
    academyGraduates: graduates / count,
    earlyPromotion: early / count,
    reachedStarter: starter / count,
    captain: captain / count,
    releasedFromAcademy: released / count,
    rareBreakthrough: rare / count,
    averagePeakAbility: peakSum / count,
    averageLegendScore: legendSum / count,
    averageMaccabiAppearances: appsSum / count,
    averageCareerSeasons: seasonsSum / count,
    averageRetirementAge: ageSum / count,
    endings,
    byPosition,
  };
}

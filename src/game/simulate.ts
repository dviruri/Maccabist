/**
 * Headless career simulation.
 *
 * The UI is not involved at any point here, which is the whole reason the engine is
 * separated from React: `simulateCareer()` can be run thousands of times for balancing.
 */

import { EVENTS_BY_ID } from '../data/events';
import type { Career, GameEvent, TransferOffer } from '../types';
import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  type NewCareerInput,
  type RetirementDecision,
} from './careerEngine';
import { createRng, type Rng } from './random';

export interface CareerPolicy {
  pickChoice(event: GameEvent, career: Career, rng: Rng): string;
  pickOffer(offers: TransferOffer[], career: Career, rng: Rng): string | null;
  pickRetirement(career: Career, rng: Rng): RetirementDecision;
}

/** Default policy: decides at random. Good enough to sanity-check the balance surface. */
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

/** A one-club man: never leaves, always takes the armband path. */
export const loyalPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    // Prefer the first choice, which by convention is the "stay and commit" option.
    return rng.chance(0.75) ? (event.choices[0]?.id ?? rng.pick(event.choices).id) : rng.pick(event.choices).id;
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
  const { policy = randomPolicy, maxSteps = 800, ...input } = options;
  let career = createCareer(input);
  const rng = createRng(career.seed ^ 0x5bf03635);

  let steps = 0;
  while (!career.retired && steps < maxSteps) {
    steps += 1;
    switch (career.phase) {
      case 'preseason':
        career = beginSeason(career);
        // No eligible events this year - go straight to the season.
        if (career.phase === 'preseason') career = continueAfterEvent(career);
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
      case 'season_result':
        career = continueAfterSeason(career);
        break;
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

export interface BatchResult {
  count: number;
  averageLegendScore: number;
  averageMaccabiAppearances: number;
  averagePeakAbility: number;
  endings: Record<string, number>;
}

/** Runs many careers and reports aggregate numbers - the starting point for balancing. */
export function simulateBatch(count: number, options: Omit<SimulateOptions, 'seed'>): BatchResult {
  const endings: Record<string, number> = {};
  let legendSum = 0;
  let appsSum = 0;
  let peakSum = 0;

  for (let i = 0; i < count; i += 1) {
    const career = simulateCareer({ ...options, seed: (i * 2654435761) >>> 0 });
    legendSum += career.legend?.score ?? 0;
    appsSum += career.maccabi.appearances;
    peakSum += career.peakAbility;
    const endingId = career.legend?.ending.id ?? 'none';
    endings[endingId] = (endings[endingId] ?? 0) + 1;
  }

  return {
    count,
    averageLegendScore: legendSum / count,
    averageMaccabiAppearances: appsSum / count,
    averagePeakAbility: peakSum / count,
    endings,
  };
}

/**
 * Data-driven event selection and resolution.
 * The engine knows nothing about specific events - everything comes from src/data/events.ts.
 */

import { EVENTS, getEvent } from '../data/events';
import type { Achievement, Career, CareerEventResult, EventEffects, GameEvent } from '../types';
import { applyEffects, cloneCareer, diffCareer } from './progressionEngine';
import type { Rng } from './random';
import {
  isAtMaccabi,
  isAtMaccabiSenior,
  isOnLoan,
  isPlayingAbroad,
  stageForAge,
} from './rules';

/** Weight multiplier for an event the player has already seen in this career. */
const REPEAT_PENALTY = 0.3;

export function isEventEligible(event: GameEvent, career: Career): boolean {
  const c = event.conditions;
  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;

  if (c.once && career.seenEventIds.includes(event.id)) return false;
  if (c.minAge !== undefined && career.age < c.minAge) return false;
  if (c.maxAge !== undefined && career.age > c.maxAge) return false;
  if (c.stages && !c.stages.includes(stageForAge(career.age))) return false;
  if (c.minAbility !== undefined && career.ability < c.minAbility) return false;
  if (c.maxAbility !== undefined && career.ability > c.maxAbility) return false;
  if (c.minMaccabism !== undefined && career.maccabism < c.minMaccabism) return false;
  if (c.maxMaccabism !== undefined && career.maccabism > c.maxMaccabism) return false;
  if (c.minReputation !== undefined && career.reputation < c.minReputation) return false;
  if (c.maxReputation !== undefined && career.reputation > c.maxReputation) return false;
  if (c.minStatusValue !== undefined && career.statusValue < c.minStatusValue) return false;
  if (c.maxStatusValue !== undefined && career.statusValue > c.maxStatusValue) return false;
  if (c.atMaccabi !== undefined && isAtMaccabi(career) !== c.atMaccabi) return false;
  if (c.atMaccabiSenior !== undefined && isAtMaccabiSenior(career) !== c.atMaccabiSenior)
    return false;
  if (c.abroad !== undefined && isPlayingAbroad(career) !== c.abroad) return false;
  if (c.onLoan !== undefined && isOnLoan(career) !== c.onLoan) return false;
  if (c.isCaptain !== undefined && career.captain !== c.isCaptain) return false;
  if (c.hasLeftMaccabi !== undefined && career.maccabi.everLeft !== c.hasLeftMaccabi) return false;
  if (c.minLastAppearances !== undefined && lastApps < c.minLastAppearances) return false;
  if (c.maxLastAppearances !== undefined && lastApps > c.maxLastAppearances) return false;

  return true;
}

export function eligibleEvents(career: Career): GameEvent[] {
  return EVENTS.filter((event) => isEventEligible(event, career));
}

/** Picks up to `count` distinct events for the coming season. */
export function pickEvents(career: Career, rng: Rng, count: number): string[] {
  const pool = eligibleEvents(career);
  const picked: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const remaining = pool.filter((event) => !picked.includes(event.id));
    if (remaining.length === 0) break;
    const chosen = rng.weighted(remaining, (event) =>
      career.seenEventIds.includes(event.id) ? event.weight * REPEAT_PENALTY : event.weight,
    );
    if (!chosen) break;
    picked.push(chosen.id);
  }

  return picked;
}

/** How many events a season should present. Big career moments deserve a busier season. */
export function eventsPerSeason(career: Career, rng: Rng): number {
  const stage = stageForAge(career.age);
  if (stage === 'kids') return rng.chance(0.25) ? 2 : 1;
  if (stage === 'youth') return rng.chance(0.35) ? 2 : 1;
  return rng.chance(0.45) ? 2 : 1;
}

export interface ResolvedEvent {
  career: Career;
  result: CareerEventResult;
  achievements: Achievement[];
}

/** Applies a decision: fixed choice effects first, then one weighted random outcome. */
export function resolveEventChoice(
  career: Career,
  eventId: string,
  choiceId: string,
  rng: Rng,
): ResolvedEvent {
  const event = getEvent(eventId);
  const choice = event.choices.find((ch) => ch.id === choiceId);
  if (!choice) throw new Error(`Unknown choice ${choiceId} for event ${eventId}`);

  const before = career;
  let next = career;
  const achievements: Achievement[] = [];

  const applyOne = (effects: EventEffects): void => {
    const applied = applyEffects(next, effects, rng);
    next = applied.career;
    achievements.push(...applied.achievements);
  };

  if (choice.effects) applyOne(choice.effects);

  let outcomeText = '';
  let tone: CareerEventResult['tone'] = 'neutral';
  if (choice.outcomes?.length) {
    const outcome = rng.weighted(choice.outcomes, (o) => o.weight) ?? choice.outcomes[0];
    if (outcome) {
      outcomeText = outcome.text;
      tone = outcome.tone ?? 'neutral';
      applyOne(outcome.effects);
    }
  }

  next = cloneCareer(next);
  if (!next.seenEventIds.includes(eventId)) next.seenEventIds.push(eventId);
  next.pendingEventIds = next.pendingEventIds.filter((id) => id !== eventId);

  const result: CareerEventResult = {
    eventId,
    eventTitle: event.title,
    season: career.currentSeason,
    age: career.age,
    choiceId,
    choiceLabel: choice.label,
    outcomeText,
    tone,
    deltas: diffCareer(before, next),
  };

  next.eventsHistory.push(result);
  next.lastEventResult = result;
  next.lastAchievements = achievements;

  return { career: next, result, achievements };
}

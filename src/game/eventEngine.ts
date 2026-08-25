/**
 * Data-driven event selection and resolution.
 *
 * The engine knows nothing about specific events - everything comes from src/data/events.ts.
 * Its jobs are: decide how many decision points a season gets, pick events that fit the
 * player's situation without repeating themselves, and resolve a choice into a weighted outcome.
 */

import { stageConfig } from '../data/academy';
import { EVENTS_BY_ID, EVENT_POOL } from '../data/events';
import type {
  Achievement,
  Career,
  CareerEventResult,
  EventCategory,
  GameEvent,
  SeasonSlot,
} from '../types';
import { EVENTS } from './balance';
import { matchesConditions, type ConditionContext } from './conditions';
import { selectWeightedOutcome } from './outcomeEngine';
import { applyEffects, cloneCareer, diffCareer } from './progressionEngine';
import type { Rng } from './random';

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

/**
 * Early-slot events read last season's appearances; once the season is under way they read
 * what has actually happened so far this season.
 */
export function conditionContext(career: Career, slot: SeasonSlot): ConditionContext {
  if (slot === 'early') {
    return { appearances: career.lastSeasonRecord?.stats.appearances ?? 0 };
  }
  return { appearances: career.firstHalfStats?.appearances ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Repetition control                                                  */
/* ------------------------------------------------------------------ */

function lastSeasonSeen(career: Career, eventId: string): number | null {
  let latest: number | null = null;
  for (const entry of career.eventsHistory) {
    if (entry.eventId === eventId) latest = Math.max(latest ?? entry.season, entry.season);
  }
  return latest;
}

function seenThisStage(career: Career, eventId: string): boolean {
  return career.eventsHistory.some(
    (e) => e.eventId === eventId && e.stage === career.academyStage,
  );
}

/** Categories used earlier in the current season - kept for variety. */
export function categoriesThisSeason(career: Career): EventCategory[] {
  return career.eventsHistory
    .filter((e) => e.season === career.currentSeason)
    .map((e) => e.category);
}

/** Categories that hit last season and should not immediately repeat (injury, discipline). */
function blockedCategories(career: Career): EventCategory[] {
  const blocked = EVENTS.blockedRepeatCategories as readonly EventCategory[];
  return career.eventsHistory
    .filter((e) => e.season === career.currentSeason - 1 && blocked.includes(e.category))
    .map((e) => e.category);
}

/** How many seasons ago this event last fired, or null if it never has. */
function seasonsSinceSeen(career: Career, eventId: string): number | null {
  const last = lastSeasonSeen(career, eventId);
  return last === null ? null : career.currentSeason - last;
}

/**
 * Categories used in the previous few seasons (not the current one, which is handled
 * separately). Used to discourage repetitive category sequences across seasons.
 */
export function recentCategories(career: Career): EventCategory[] {
  const window = EVENTS.recentCategoryWindowSeasons;
  return career.eventsHistory
    .filter((e) => {
      const ago = career.currentSeason - e.season;
      return ago > 0 && ago <= window;
    })
    .map((e) => e.category);
}

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

export function isEventEligible(event: GameEvent, career: Career, slot: SeasonSlot): boolean {
  if (event.slots && !event.slots.includes(slot)) return false;

  if (event.oncePerCareer && lastSeasonSeen(career, event.id) !== null) return false;
  if (event.oncePerStage && seenThisStage(career, event.id)) return false;

  const last = lastSeasonSeen(career, event.id);
  if (last !== null) {
    const cooldown = event.cooldownSeasons ?? EVENTS.defaultCooldownSeasons;
    if (career.currentSeason - last < cooldown) return false;
  }

  return matchesConditions(career, event.conditions, conditionContext(career, slot));
}

export function eligibleEvents(career: Career, slot: SeasonSlot): GameEvent[] {
  return EVENT_POOL.filter((event) => isEventEligible(event, career, slot));
}

/**
 * Effective selection weight for an event, after variety and rarity throttling.
 *
 * Repetition is handled here rather than by piling on more content: an event that just fired
 * is suppressed hard and recovers gradually, and a category is penalised both inside the
 * current season and across the last couple of seasons.
 */
export function selectionWeight(
  event: GameEvent,
  career: Career,
  usedCategories: EventCategory[],
  blocked: EventCategory[],
  recent: EventCategory[] = [],
): number {
  if (blocked.includes(event.category)) return 0;

  let weight = event.weight * EVENTS.rarityWeight[event.rarity ?? 'common'];

  const since = seasonsSinceSeen(career, event.id);
  if (since !== null) {
    // Strongest right after it fired, fading back to full weight over the recovery window.
    const recovered = Math.min(1, Math.max(0, since) / EVENTS.repeatRecoverySeasons);
    weight *= EVENTS.repeatPenalty + (1 - EVENTS.repeatPenalty) * recovered;
  }

  if (usedCategories.includes(event.category)) weight *= EVENTS.sameCategoryPenalty;
  if (recent.includes(event.category)) weight *= EVENTS.recentCategoryPenalty;
  return weight;
}

/** Picks a single event for a slot, or null when nothing fits. */
export function pickEventForSlot(
  career: Career,
  rng: Rng,
  slot: SeasonSlot,
  usedCategories: EventCategory[],
  exclude: string[] = [],
): GameEvent | null {
  const blocked = blockedCategories(career);
  const recent = recentCategories(career);
  const pool = eligibleEvents(career, slot).filter((e) => !exclude.includes(e.id));
  if (pool.length === 0) return null;
  const picked = rng.weighted(pool, (event) =>
    selectionWeight(event, career, usedCategories, blocked, recent),
  );
  // Every candidate can be penalised to zero (a fully blocked category); fall back to the
  // eligible pool rather than silently dropping the slot.
  return picked ?? rng.pick(pool);
}

/* ------------------------------------------------------------------ */
/* Season planning                                                     */
/* ------------------------------------------------------------------ */

/** How many decision points this season should contain, from the stage config. */
export function eventBudget(career: Career, rng: Rng): number {
  const stage = stageConfig(career.academyStage);
  if (stage.maxEvents <= stage.minEvents) return stage.minEvents;
  return rng.int(stage.minEvents, stage.maxEvents);
}

export interface PlannedEvent {
  slot: SeasonSlot;
  eventId: string;
}

/**
 * Lays out the season's decision points across the early / mid / late slots.
 * Events are chosen one at a time so each pick can avoid repeating the previous category.
 */
export function planSeason(career: Career, rng: Rng): PlannedEvent[] {
  const budget = eventBudget(career, rng);
  const slots: SeasonSlot[] =
    budget <= 1
      ? [rng.chance(0.6) ? 'early' : 'mid']
      : budget === 2
        ? ['early', 'mid']
        : ['early', 'mid', 'late'];

  const planned: PlannedEvent[] = [];
  const used: EventCategory[] = [];
  for (const slot of slots) {
    // The late "key moment" slot is not always used, even when budgeted.
    if (slot === 'late' && !rng.chance(EVENTS.lateSlotChance + 0.35)) continue;
    const event = pickEventForSlot(
      career,
      rng,
      slot,
      used,
      planned.map((p) => p.eventId),
    );
    if (!event) continue;
    planned.push({ slot, eventId: event.id });
    used.push(event.category);
  }

  return planned;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export interface ResolvedEvent {
  career: Career;
  result: CareerEventResult;
  achievements: Achievement[];
}

/**
 * Applies a decision. The choice's fixed effects land first, then exactly one weighted
 * outcome - which is where the story and most of the numbers come from.
 */
export function resolveEventChoice(
  career: Career,
  eventId: string,
  choiceId: string,
  rng: Rng,
  slot: SeasonSlot,
): ResolvedEvent {
  const event = EVENTS_BY_ID[eventId];
  if (!event) throw new Error(`Unknown event: ${eventId}`);
  const choice = event.choices.find((ch) => ch.id === choiceId);
  if (!choice) throw new Error(`Unknown choice ${choiceId} for event ${eventId}`);

  const before = career;
  let next = career;
  const achievements: Achievement[] = [];

  if (choice.effects) {
    const applied = applyEffects(next, choice.effects, rng);
    next = applied.career;
    achievements.push(...applied.achievements);
  }

  const ctx = conditionContext(career, slot);
  const outcome = selectWeightedOutcome(choice.outcomes, next, rng, ctx);

  let outcomeText = '';
  let outcomeId = 'none';
  let tone: CareerEventResult['tone'] = 'neutral';
  if (outcome) {
    outcomeId = outcome.id;
    outcomeText = outcome.text;
    tone = outcome.tone;
    const applied = applyEffects(next, outcome.effects, rng);
    next = applied.career;
    achievements.push(...applied.achievements);
  }

  next = cloneCareer(next);
  next.pendingEventIds = next.pendingEventIds.filter((id) => id !== eventId);

  const result: CareerEventResult = {
    eventId,
    eventTitle: event.title,
    category: event.category,
    season: career.currentSeason,
    age: career.age,
    stage: career.academyStage,
    choiceId,
    choiceLabel: choice.label,
    outcomeId,
    outcomeText,
    tone,
    deltas: diffCareer(before, next),
  };

  next.eventsHistory.push(result);
  next.lastEventResult = result;
  next.lastAchievements = achievements;

  return { career: next, result, achievements };
}

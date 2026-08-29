/**
 * Data-driven event selection and resolution.
 *
 * The engine knows nothing about specific events - everything comes from src/data/events.ts.
 * Its jobs are: decide how many decision points a season gets, pick events that fit the
 * player's situation without repeating themselves, and resolve a choice into a weighted outcome.
 */

import { stageConfig } from '../data/academy';
import { EVENTS_BY_ID, EVENT_POOL } from '../data/events';
import { AGENT_ARCHETYPES } from '../data/people';
import type {
  Achievement,
  AgentArchetypeId,
  Career,
  CareerEventResult,
  EventCategory,
  EventEffects,
  GameEvent,
  SeasonSlot,
} from '../types';
import { EVENTS } from './balance';
// conditionContext moved to conditions.ts (v0.4.1) so decisionEngine can use it without a
// cycle through this file. Re-exported because callers and tests already import it from here.
import { conditionContext, matchesConditions } from './conditions';
import { markOnFieldEvent } from './participation';
import { calculateOutcomeDistribution, resolveFromDistribution } from './decisionEngine';

export { conditionContext };
import { applyEffects, cloneCareer, diffCareer } from './progressionEngine';
import { round, type Rng } from './random';

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

/**
 * Early-slot events read last season's appearances; once the season is under way they read
 * what has actually happened so far this season.
 */

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

  /*
   * v0.5, Phase 42: people must not hijack the season. Two rules, one hard and one soft. A
   * season never plans a second people event (zero, not a penalty - the fallback path in
   * `pickEventForSlot` cannot resurrect it because that path only runs when every candidate is
   * zeroed, and a mixed pool always has football left in it). And a people event in the season
   * right after one fired is halved, so agent-manager-agent-coach runs cannot form. Football
   * remains the main story.
   */
  if (event.category === 'people') {
    if (usedCategories.includes('people')) return 0;
    const last = career.people?.lastPeopleEventSeason;
    if (last !== undefined && career.currentSeason - last <= 1) weight *= 0.5;
    /*
     * Representation seeks out the unrepresented (v0.5, Phase 6). The approach events are
     * oncePerCareer and gated on having no agent, yet at flat weight they compete with every
     * manager and coach event for the single people slot - measured at 13-20% of careers ever
     * signing, against the brief's "formal representation becomes normal around נוער". Tripling
     * them WHILE the player is unrepresented models the real asymmetry: agents chase rising
     * players far harder than any other person in football chases anyone.
     */
    if (event.conditions.forbidsAgent === true && !career.people?.agent) weight *= 3;

    /*
     * ...and a career that has outgrown its representation attracts callers (v0.5.1).
     *
     * The question v0.5.1 wants asked out loud is "does my current agent still fit the stage my
     * career is at?". Measured before this, only 16% of careers were ever asked it, because the
     * switch events compete with forty others for one slot a season. The signal is not random:
     * it is the gap between what the player is now worth and the level of representation that
     * signed him. A player whose reputation has climbed well past his agent's own threshold is
     * exactly who other agents phone.
     *
     * Weight only - every switch event still has to pass its own conditions, and staying is
     * always on the card.
     */
    if (event.conditions.requiresAgent === true && hasOutgrownAgent(career)) weight *= 2.6;
  }
  return weight;
}

/**
 * Has the player's standing climbed clear of the representation that signed him? (v0.5.1)
 *
 * Compared against the agent's own `reputationThreshold` - the level at which that archetype
 * would take a player on - so this asks a real question rather than a numeric one, and answers
 * "no" for a player whose agent still matches where he is.
 */
function hasOutgrownAgent(career: Career): boolean {
  const agent = career.people?.agent;
  if (!agent) return false;
  const archetype = AGENT_ARCHETYPES[agent.person.archetypeId as AgentArchetypeId];
  if (!archetype) return false;
  const seasonsTogether = career.currentSeason - agent.sinceSeason;
  return career.reputation >= archetype.reputationThreshold + 25 && seasonsTogether >= 3;
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

  /*
   * v0.4.6: a two-event season can put its second event in April.
   *
   * The senior stage budgets one or two events, so `budget === 3` never happened there and the
   * late slot was never allocated - which quietly made **every senior event declaring
   * `slots: ['late']` unreachable**. `spon_last_minute` had been in the catalogue unreachable
   * since it was written, and the v0.4.6 title events joined it: eligible in 131 of 481 senior
   * preseasons and planned in none of them.
   *
   * Swapping mid for late some of the time fixes the class rather than the three events. The
   * number of events per season is unchanged, so pacing is untouched - only *when* the second
   * one lands, and a season whose decisive moment comes in April is the normal case in football.
   */
  const slots: SeasonSlot[] =
    budget <= 1
      ? [rng.chance(0.6) ? 'early' : 'mid']
      : budget === 2
        ? rng.chance(EVENTS.lateInsteadOfMidChance)
          ? ['early', 'late']
          : ['early', 'mid']
        : ['early', 'mid', 'late'];

  /* Only the *third* slot is optional; a late slot that replaced mid is the season's second event. */
  const lateIsExtra = slots.length === 3;

  const planned: PlannedEvent[] = [];
  const used: EventCategory[] = [];
  for (const slot of slots) {
    // The late "key moment" slot is not always used, when it is an extra on top of two others.
    if (slot === 'late' && lateIsExtra && !rng.chance(EVENTS.lateSlotChance + 0.35)) continue;
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

/**
 * Scales up the developmental upside of an outcome. Only the attributes that compound into a
 * career are touched - deliberately not flags, memories, arcs, transfers or milestones, which
 * are not quantities and must not be multiplied.
 */
function amplifyUpside(effects: EventEffects, gain: number): EventEffects {
  const scale = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : round(value * gain, 2);

  const scaled: EventEffects = { ...effects };
  if (effects.ability !== undefined && effects.ability > 0) scaled.ability = scale(effects.ability);
  if (effects.coachTrust !== undefined && effects.coachTrust > 0) {
    scaled.coachTrust = scale(effects.coachTrust);
  }
  if (effects.roleValue !== undefined && effects.roleValue > 0) {
    scaled.roleValue = scale(effects.roleValue);
  }
  if (effects.reputation !== undefined && effects.reputation > 0) {
    scaled.reputation = scale(effects.reputation);
  }
  if (effects.confidence !== undefined && effects.confidence > 0) {
    scaled.confidence = scale(effects.confidence);
  }
  if (effects.promotionBoost !== undefined && effects.promotionBoost > 0) {
    scaled.promotionBoost = scale(effects.promotionBoost);
  }
  return scaled;
}

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

  /*
   * Record that an on-field event was delivered (v0.4.8).
   *
   * The gate in `matchesConditions` should already have prevented this event reaching a player
   * who is not playing, but the gate at the early slot is a projection rather than a fact - and a
   * projection can be wrong. Marking it here lets settlement reconcile in the event's favour: the
   * player has been told he was on the pitch, so the season may not close saying he played
   * nothing.
   */
  if (event.conditions?.requiresAppearance === true) {
    next = { ...next, seasonParticipation: markOnFieldEvent(next) };
  }

  /*
   * The distribution is computed FIRST, on the untouched career (v0.4.1).
   *
   * This is what makes the displayed odds honest. The UI preview calls
   * calculateOutcomeDistribution on exactly this state, so resolving from the same function with
   * the same input guarantees the numbers the player saw are the numbers that decided his career.
   *
   * It also fixes a real inconsistency: `choice.effects` used to be applied before the weights
   * were calculated, so a choice that cost coach trust silently moved the very odds it was shown
   * alongside - and a preview could never have matched.
   */
  const distribution = calculateOutcomeDistribution(career, event, choice, slot);

  if (choice.effects) {
    const applied = applyEffects(next, choice.effects, rng);
    next = applied.career;
    achievements.push(...applied.achievements);
  }

  const resolvedId = resolveFromDistribution(distribution, rng);
  const outcome = resolvedId
    ? (choice.outcomes.find((o) => o.id === resolvedId) ?? null)
    : // Every outcome was gated out for this player. Fall back rather than throw.
      (choice.outcomes[0] ?? null);

  let outcomeText = '';
  let outcomeId = 'none';
  let tone: CareerEventResult['tone'] = 'neutral';
  if (outcome) {
    outcomeId = outcome.id;
    outcomeText = outcome.text;
    tone = outcome.tone;
    const effects =
      choice.risk === 'risky' && outcome.tone === 'good'
        ? amplifyUpside(outcome.effects, EVENTS.riskyUpsideGain)
        : outcome.effects;
    /*
     * The outcome's own Maccabi relevance travels with its effects (v0.4.8). Without it the guard
     * drops the delta, which is the correct default: an outcome that does not say what about
     * Maccabi happened may not move how the player feels about Maccabi.
     */
    const applied = applyEffects(next, effects, rng, outcome.maccabiRelevance, event.id);
    next = applied.career;
    achievements.push(...applied.achievements);
  }

  next = cloneCareer(next);
  next.pendingEventIds = next.pendingEventIds.filter((id) => id !== eventId);

  // v0.5, Phase 42: the pacing rule reads this - one people event a season, and a soft cooldown.
  if (event.category === 'people' && next.people) {
    next.people = { ...next.people, lastPeopleEventSeason: next.currentSeason };
  }

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
    // The odds the player was shown, kept with the result they produced.
    odds: distribution.outcomes,
  };

  next.eventsHistory.push(result);
  next.lastEventResult = result;
  next.lastAchievements = achievements;

  return { career: next, result, achievements };
}

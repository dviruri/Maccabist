import type { Career, EventCategory, GameEvent } from '../types';
import { isAtMaccabi } from '../game/maccabiEngine';
import { isPlayingAbroad } from '../game/rules';

/**
 * How an event should look (v0.4.5).
 *
 * Presentation only. This is deliberately in `src/ui/` and derived from data the engine already
 * carries — `category`, `clubScope`, where the player is — rather than added to the event
 * definitions as a new field. Two reasons: 128 events would have needed annotating by hand, and a
 * visual tag living in gameplay data is a tag someone eventually writes a rule against.
 *
 * The goal is that events stop looking identical without becoming ten different layouts. One
 * component, one structure, a set of variants that change accent, icon and header treatment.
 */

export type EventVariant =
  | 'coach'
  | 'match'
  | 'development'
  | 'transfer'
  | 'club'
  | 'europe'
  | 'maccabi'
  | 'crisis'
  | 'media'
  | 'career';

/**
 * Every variant, for coverage auditing (v0.4.5.1). The variant system is what keeps 128 events
 * feeling like one game rather than 128 cards, and that only holds if the mapping is exhaustive -
 * so `tests/eventVisuals.test.ts` walks the real catalogue against this list.
 */
export const VARIANTS: readonly EventVariant[] = [
  'coach',
  'match',
  'development',
  'transfer',
  'club',
  'europe',
  'maccabi',
  'crisis',
  'media',
  'career',
];

/** How much room an event deserves. Most are ordinary; a few are turning points. */
export type EventImportance = 'normal' | 'important' | 'major';

export interface EventVisual {
  variant: EventVariant;
  icon: string;
  importance: EventImportance;
  /** Short Hebrew label for the header strip. */
  label: string;
}

const VARIANT_META: Record<EventVariant, { icon: string; label: string }> = {
  coach: { icon: '📋', label: 'המאמן' },
  match: { icon: '⚽', label: 'רגע במשחק' },
  development: { icon: '📈', label: 'התפתחות' },
  transfer: { icon: '🔄', label: 'העברות' },
  club: { icon: '🏟️', label: 'המועדון' },
  europe: { icon: '✈️', label: 'אירופה' },
  maccabi: { icon: '💚', label: 'מהבית' },
  crisis: { icon: '⚠️', label: 'משבר' },
  media: { icon: '🎙️', label: 'תקשורת' },
  career: { icon: '🧭', label: 'קריירה' },
};

/** The base mapping from the gameplay category. Context can still override it below. */
const CATEGORY_VARIANT: Record<EventCategory, EventVariant> = {
  coach: 'coach',
  match_moment: 'match',
  competition: 'match',
  development: 'development',
  promotion: 'development',
  transfer: 'transfer',
  contract: 'transfer',
  team: 'club',
  injury: 'crisis',
  discipline: 'crisis',
  pressure: 'media',
  family: 'career',
  opportunity: 'development',
  random: 'career',
  rare: 'career',
};

/** Categories that carry real weight when they land. */
const IMPORTANT_CATEGORIES: readonly EventCategory[] = [
  'transfer',
  'contract',
  'promotion',
  'injury',
];

export function eventVisual(event: GameEvent, career: Career): EventVisual {
  const scope = event.conditions?.clubScope;

  /*
   * Context beats category. An event about Maccabi while the player is elsewhere is a "from home"
   * moment whatever its gameplay category says, and that distinction is one of the things the
   * game is actually about — so it wins over the generic mapping.
   */
  let variant: EventVariant = CATEGORY_VARIANT[event.category] ?? 'career';

  if (scope === 'formerMaccabi' || (scope === 'maccabi' && !isAtMaccabi(career))) {
    variant = 'maccabi';
  } else if (scope === 'abroad' || (variant === 'career' && isAbroad(career))) {
    variant = 'europe';
  }

  const importance = importanceOf(event, variant);

  return {
    variant,
    icon: VARIANT_META[variant].icon,
    label: VARIANT_META[variant].label,
    importance,
  };
}

function isAbroad(career: Career): boolean {
  // v0.4.8: one "is he abroad" answer, from the club's country. See PlayerHub for the reasoning.
  return isPlayingAbroad(career);
}

function importanceOf(event: GameEvent, variant: EventVariant): EventImportance {
  // A rare event is rare because it matters.
  if (event.rarity === 'rare') return 'major';
  // Anything that can move the player, open a storyline or put a beat on the timeline.
  const heavy = event.choices.some((choice) =>
    choice.outcomes.some(
      (outcome) =>
        outcome.effects.transferTo !== undefined ||
        outcome.effects.milestone !== undefined ||
        outcome.effects.startArc !== undefined,
    ),
  );
  if (heavy) return 'major';
  if (variant === 'maccabi' || IMPORTANT_CATEGORIES.includes(event.category)) return 'important';
  return 'normal';
}

/* ------------------------------------------------------------------ */
/* Match moments                                                       */
/* ------------------------------------------------------------------ */

/**
 * Whether to render an event as a match moment, with the scoreboard treatment.
 *
 * Only `match_moment` events, and only for a player who is actually playing senior football — a
 * scoreboard above a twelve year old's training session would be worse than no scoreboard.
 */
export function isMatchMoment(event: GameEvent, career: Career): boolean {
  return event.category === 'match_moment' && career.academyStage === 'senior';
}

/**
 * The minute shown on the match-moment scoreboard.
 *
 * Derived from the event id so it is stable for a given event rather than jittering on re-render,
 * and never invented where the event's own kicker already states a minute — several do
 * ("דקה 88, סמי עופר"), and contradicting the prose would be worse than showing nothing.
 */
export function matchMinute(event: GameEvent): number | null {
  const stated = event.kicker?.match(/דקה\s+(\d{1,2})/);
  if (stated?.[1]) return Number(stated[1]);
  const opening = event.kicker?.match(/^(\d{1,2})[׳']/);
  if (opening?.[1]) return Number(opening[1]);

  // No minute in the text. A stable pseudo-minute from the id, weighted late where drama lives.
  let hash = 0;
  for (let i = 0; i < event.id.length; i += 1) hash = (hash * 31 + event.id.charCodeAt(i)) >>> 0;
  return 55 + (hash % 38);
}

/** Whether the event text already names a stadium or opponent, so the UI need not. */
export function mentionsVenue(event: GameEvent): boolean {
  const text = `${event.kicker ?? ''} ${event.description}`;
  return text.includes('סמי עופר') || text.includes('אצטדיון');
}

/* ------------------------------------------------------------------ */
/* Which Maccabi presentation an event wants (v0.4.5.1)                */
/* ------------------------------------------------------------------ */

export type MaccabiPresentation = 'none' | 'relationship' | 'sami_ofer' | 'ambient_news';

/** Events that are the player physically walking back into Sami Ofer. */
const SAMI_OFER_EVENTS: readonly string[] = [
  'mac_return_to_sami_ofer_warm',
  'mac_return_to_sami_ofer_hostile',
  'mac_scored_against_them',
];

/** Events that are news about Maccabi rather than something happening to the player. */
const AMBIENT_EVENTS: readonly string[] = [
  'amb_they_won_it_without_you',
  'amb_the_club_is_falling_apart',
  'amb_they_went_down',
  'amb_they_need_your_position',
];

/**
 * Which of the three Maccabi headers this event should carry.
 *
 * Keyed on event id for the two specific families, and falling back to the `formerMaccabi` scope
 * for everything else about the club. Keyed by id rather than by a new data field because these are
 * two small, named families - adding a `presentation` field to 128 events to describe seven of them
 * would be the wrong trade.
 */
export function maccabiPresentation(event: GameEvent, career: Career): MaccabiPresentation {
  if (isAtMaccabi(career)) return 'none';
  if (SAMI_OFER_EVENTS.includes(event.id)) return 'sami_ofer';
  if (AMBIENT_EVENTS.includes(event.id)) return 'ambient_news';
  if (event.conditions?.clubScope === 'formerMaccabi') return 'relationship';
  return 'none';
}

import type { GameEvent } from '../../types';
import { ACADEMY_EVENTS } from './academyEvents';
import { AMBIENT_MACCABI_EVENTS } from './ambientMaccabiEvents';
import { ARC_EVENTS } from './arcEvents';
import { FALL_AND_RISE_EVENTS } from './fallAndRiseEvents';
import { MACCABI_EVENTS } from './maccabiEvents';
import { PEOPLE_EVENTS } from './peopleEvents';
import { LEGACY_EVENTS } from './legacyEvents';
import { POSITION_EVENTS } from './positionEvents';
import { SENIOR_EVENTS } from './seniorEvents';
import { SENIOR_PHASE_EVENTS } from './seniorPhaseEvents';
import { SPONTANEOUS_EVENTS } from './spontaneousEvents';
import { LOWER_LEAGUE_EVENTS } from './lowerLeagueEvents';
import { WORLD_EVENTS } from './worldEvents';

/**
 * The whole event pool.
 *
 * Adding an event = adding an object to one of these files. Nothing in the engine changes:
 * `conditions` decide when it can appear, `weight` how often, `category` keeps a season
 * varied, and every choice's `outcomes` carry the probabilities.
 */
export const EVENT_POOL: GameEvent[] = [
  ...LOWER_LEAGUE_EVENTS,
  ...ACADEMY_EVENTS,
  ...AMBIENT_MACCABI_EVENTS,
  ...ARC_EVENTS,
  ...FALL_AND_RISE_EVENTS,
  ...MACCABI_EVENTS,
  ...PEOPLE_EVENTS,
  ...LEGACY_EVENTS,
  ...POSITION_EVENTS,
  ...SPONTANEOUS_EVENTS,
  ...SENIOR_EVENTS,
  ...SENIOR_PHASE_EVENTS,
  ...WORLD_EVENTS,
];

export const EVENTS_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  EVENT_POOL.map((event) => [event.id, event]),
);

export function getEvent(id: string): GameEvent {
  const event = EVENTS_BY_ID[id];
  if (!event) throw new Error(`Unknown event: ${id}`);
  return event;
}

export {
  ACADEMY_EVENTS,
  AMBIENT_MACCABI_EVENTS,
  ARC_EVENTS,
  FALL_AND_RISE_EVENTS,
  MACCABI_EVENTS,
  POSITION_EVENTS,
  SENIOR_EVENTS,
  SENIOR_PHASE_EVENTS,
  SPONTANEOUS_EVENTS,
  WORLD_EVENTS,
};

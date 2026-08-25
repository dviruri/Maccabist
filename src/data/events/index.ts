import type { GameEvent } from '../../types';
import { ACADEMY_EVENTS } from './academyEvents';
import { SENIOR_EVENTS } from './seniorEvents';
import { SPONTANEOUS_EVENTS } from './spontaneousEvents';

/**
 * The whole event pool.
 *
 * Adding an event = adding an object to one of these three files. Nothing in the engine
 * changes: `conditions` decide when it can appear, `weight` how often, `category` keeps a
 * season varied, and every choice's `outcomes` carry the probabilities.
 */
export const EVENT_POOL: GameEvent[] = [
  ...ACADEMY_EVENTS,
  ...SPONTANEOUS_EVENTS,
  ...SENIOR_EVENTS,
];

export const EVENTS_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  EVENT_POOL.map((event) => [event.id, event]),
);

export function getEvent(id: string): GameEvent {
  const event = EVENTS_BY_ID[id];
  if (!event) throw new Error(`Unknown event: ${id}`);
  return event;
}

export { ACADEMY_EVENTS, SENIOR_EVENTS, SPONTANEOUS_EVENTS };

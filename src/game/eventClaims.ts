/**
 * An event may not say something the world does not have to support (v0.4.6).
 *
 * The bugs that motivated this version were all the same bug wearing different clothes: a piece
 * of text asserting a football situation that no condition required to be true. A derby with no
 * rivalry. A title run-in for a club heading for eleventh. A promotion push in a top flight.
 *
 * Patching the strings would have fixed those four and left the next four to be found in
 * playtesting. So the rule is stated once, as data, and checked over the whole catalogue: **if
 * the presented text makes a claim, the conditions must require the claim to hold.**
 *
 * Only the presented text is scanned — kicker, title, description. That is what sets the scene
 * before the player chooses. Outcome text is deliberately excluded: "you won the title" inside a
 * winning branch is a *result*, not a premise, and gating an event on an outcome that may not
 * happen would be a different error.
 */

import type { EventConditions, GameEvent } from '../types';

export interface ClaimRule {
  id: string;
  /** Hebrew the text uses when it is making this claim. */
  patterns: readonly string[];
  /** What the event must declare for the claim to be honest. */
  requirement: string;
  mentions: (event: GameEvent) => boolean;
  supported: (event: GameEvent) => boolean;
}

/** The text a player reads before deciding. */
export function presentedText(event: GameEvent): string {
  return [event.kicker ?? '', event.title ?? '', event.description ?? ''].join(' ');
}

function says(event: GameEvent, patterns: readonly string[]): boolean {
  const text = presentedText(event);
  return patterns.some((p) => text.includes(p));
}

const c = (event: GameEvent): EventConditions => event.conditions ?? {};

export const CLAIM_RULES: readonly ClaimRule[] = [
  {
    id: 'derby',
    patterns: ['דרבי'],
    requirement: 'requiresDerby: true',
    mentions: (e) => says(e, ['דרבי']),
    supported: (e) => c(e).requiresDerby === true,
  },
  {
    id: 'title-race',
    patterns: ['מאבק אליפות', 'מרוץ האליפות', 'על האליפות', 'קרב על התואר', 'מאבק על האליפות'],
    requirement: 'titleRace: true (or championClinched)',
    mentions: (e) =>
      says(e, ['מאבק אליפות', 'מרוץ האליפות', 'על האליפות', 'קרב על התואר', 'מאבק על האליפות']),
    supported: (e) => c(e).titleRace === true || c(e).championClinched === true,
  },
  {
    id: 'relegation',
    patterns: ['מאבק הישרדות', 'קרב תחתית', 'לרדת ליגה', 'הישרדות בליגה', 'מהקו האדום'],
    requirement: 'relegationBattle: true (or relegationConfirmed)',
    mentions: (e) =>
      says(e, ['מאבק הישרדות', 'קרב תחתית', 'לרדת ליגה', 'הישרדות בליגה', 'מהקו האדום']),
    supported: (e) => c(e).relegationBattle === true || c(e).relegationConfirmed === true,
  },
  {
    id: 'promotion',
    patterns: ['מאבק על עלייה', 'משחק על העלייה', 'לעלות ליגה', 'פלייאוף עלייה'],
    requirement: 'promotionRace: true',
    mentions: (e) => says(e, ['מאבק על עלייה', 'משחק על העלייה', 'לעלות ליגה', 'פלייאוף עלייה']),
    supported: (e) => c(e).promotionRace === true,
  },
];

/** Every claim this event makes without requiring it. */
export function unsupportedClaims(event: GameEvent): string[] {
  return CLAIM_RULES.filter((rule) => rule.mentions(event) && !rule.supported(event)).map(
    (rule) => rule.id,
  );
}

/** Every event in a catalogue that makes an unsupported claim. */
export function eventsWithUnsupportedClaims(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => unsupportedClaims(event).length > 0);
}

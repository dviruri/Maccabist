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

/*
 * The phrasings that make each claim.
 *
 * Deliberately generous. The first version listed five ways of saying "title race" and missed
 * "אליפות באוויר" and "בצמרת" entirely, which let the world events - the ones that assert a table
 * position in so many words - through the audit untouched. A false positive here costs one
 * explicit condition on an event; a false negative costs a player being told his mid-table club
 * is one point off the top.
 */
const TITLE_PATTERNS = [
  'מאבק אליפות',
  'מרוץ האליפות',
  'על האליפות',
  'קרב על התואר',
  'מאבק על האליפות',
  'אליפות באוויר',
  'הפרש נקודה',
  /*
   * 'בצמרת' was here and is deliberately not: "הקבוצה בצמרת הליגה" in a second division is a
   * promotion race, not a title race, and the bare phrase cannot tell them apart. It flagged
   * `wrl_promotion_race` as an unsupported title claim. The two phrasings above already catch
   * the event this rule exists for.
   */
];

const RELEGATION_PATTERNS = [
  'מאבק הישרדות',
  'קרב תחתית',
  'לרדת ליגה',
  'הישרדות בליגה',
  'מהקו האדום',
  'קרב ההישרדות',
  'בתחתית הטבלה',
  'הקו האדום',
];

const PROMOTION_PATTERNS = [
  'מאבק על עלייה',
  'משחק על העלייה',
  'לעלות ליגה',
  'פלייאוף עלייה',
  'המרוץ לעלייה',
  'מדברים על עלייה',
];

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
    /*
     * v0.4.6: widened after the first pass missed the world events entirely.
     * "אליפות באוויר" and "הפרש נקודה אחת בצמרת" are title claims and matched none of the
     * original five phrasings, so `wrl_title_race` - which gated only on squad strength and
     * could fire for a strong club having a terrible season - passed the audit clean.
     */
    patterns: TITLE_PATTERNS,
    requirement: 'titleRace: true (or championClinched)',
    mentions: (e) => says(e, TITLE_PATTERNS),
    supported: (e) => c(e).titleRace === true || c(e).championClinched === true,
  },
  {
    id: 'relegation',
    patterns: RELEGATION_PATTERNS,
    requirement: 'relegationBattle: true (or relegationConfirmed)',
    mentions: (e) => says(e, RELEGATION_PATTERNS),
    supported: (e) => c(e).relegationBattle === true || c(e).relegationConfirmed === true,
  },
  {
    id: 'promotion',
    patterns: PROMOTION_PATTERNS,
    requirement: 'promotionRace: true',
    mentions: (e) => says(e, PROMOTION_PATTERNS),
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

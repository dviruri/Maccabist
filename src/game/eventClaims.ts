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

/**
 * The presented text *and* the choice labels.
 *
 * A choice reading "לבעוט" is as much a claim about the player as the description is - arguably
 * more, since it is the thing he is being asked to do.
 */
function saysInChoices(event: GameEvent, patterns: readonly string[]): boolean {
  const text = `${presentedText(event)} ${event.choices.map((ch) => ch.label).join(' ')}`;
  return patterns.some((p) => text.includes(p));
}

/*
 * Outfield actions. Narrow on purpose: "שער" is excluded because it also means a gate ("שער
 * צפוני" is a stand), and a rule that fires on a stand name is a rule people learn to ignore.
 */
const OUTFIELD_PATTERNS = ['לבעוט', 'הכדור מגיע אליך', 'לנגח', 'לכבוש'];

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

/*
 * v0.6.2: a cup final is a claim like any other.
 *
 * `sen_cup_final` asserted a State Cup final in its kicker, its title and both of its outcomes,
 * and gated on role value and age. The claims audit never saw it because no rule looked for the
 * words - the derby rule caught דרבי, and nothing caught גמר גביע. The cup now has authoritative
 * state, so the claim has a requirement to point at.
 */
const CUP_FINAL_PATTERNS = ['גמר הגביע', 'גמר גביע', 'בגמר הגביע'];

export const CLAIM_RULES: readonly ClaimRule[] = [
  {
    id: 'cup-final',
    patterns: CUP_FINAL_PATTERNS,
    requirement: "cupFinal: 'won' | 'lost' | 'reached'",
    mentions: (e) => says(e, CUP_FINAL_PATTERNS),
    supported: (e) => c(e).cupFinal !== undefined,
  },
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
  {
    /*
     * v0.4.6: an event that describes shooting may not reach a goalkeeper.
     *
     * `sen_derby_moment` had no position condition at all, so a keeper could be told the ball had
     * reached him at the far edge and offered "לבעוט". Three more did the same. This is the same
     * failure as the derby one - text asserting something about the player that nothing required
     * to be true - and it deserves the same treatment rather than four edits.
     */
    id: 'outfield-action',
    patterns: OUTFIELD_PATTERNS,
    requirement: "positions without GK, or notPositions: ['GK']",
    mentions: (e) => saysInChoices(e, OUTFIELD_PATTERNS),
    supported: (e) => {
      const conditions = c(e);
      if (conditions.notPositions?.includes('GK')) return true;
      return conditions.positions !== undefined && !conditions.positions.includes('GK');
    },
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

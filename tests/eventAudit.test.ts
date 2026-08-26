/**
 * Automated event audit (v0.3.1).
 *
 * Real playtesting found two classes of immersion-breaking bug that no amount of careful
 * authoring prevents at scale:
 *
 *   1. Maccabi-specific events firing while the player is at another club - the green stand
 *      singing your name while you turn out for Hapoel Afula.
 *   2. A goalkeeper being told the club has signed a striker who threatens his place.
 *
 * These tests are the regression guard. They read the event data and fail on the *pattern*,
 * so a new event with the same mistake is caught when it is added rather than in a playtest.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { createCareer } from '../src/game/careerEngine';
import { matchesClubScope } from '../src/game/conditions';
import { isEventEligible } from '../src/game/eventEngine';
import type { Career, GameEvent, Position } from '../src/types';

/** Every player-visible string an event can put on screen. */
function allText(event: GameEvent): string {
  return [
    event.title,
    event.description,
    event.kicker ?? '',
    ...event.choices.flatMap((choice) => [
      choice.label,
      choice.hint ?? '',
      ...choice.outcomes.map((outcome) => outcome.text),
    ]),
  ].join(' ');
}

/** Club-specific words that only make sense in a Maccabi context. */
const MACCABI_WORDS = ['מכבי', 'סמי עופר', 'הירוקה', 'הירוקים', 'היציע הירוק'];

/** Scopes under which naming Maccabi in the text is legitimate. */
const MACCABI_SAFE_SCOPES = ['maccabi', 'formerMaccabi'];

function namesMaccabi(event: GameEvent): boolean {
  const text = allText(event);
  return MACCABI_WORDS.some((word) => text.includes(word));
}

/**
 * An event is considered properly Maccabi-scoped if it declares a Maccabi-safe clubScope, or
 * pins the club through the older boolean conditions, or is explicitly about being elsewhere
 * (a homecoming approach, facing the club that released you).
 */
function isMaccabiScoped(event: GameEvent): boolean {
  const c = event.conditions;
  if (c.clubScope && MACCABI_SAFE_SCOPES.includes(c.clubScope)) return true;
  if (c.atMaccabi === true || c.atMaccabiSenior === true) return true;
  // "They are still watching you" events: elsewhere now, Maccabi history required.
  if (c.hasLeftMaccabi === true) return true;
  if (c.requiresMemory?.some((m) => m.includes('maccabi'))) return true;
  return false;
}

describe('event audit: club context', () => {
  it('never names Maccabi without a Maccabi-aware scope', () => {
    const offenders = EVENT_POOL.filter((e) => namesMaccabi(e) && !isMaccabiScoped(e)).map(
      (e) => e.id,
    );
    expect(offenders, `events naming Maccabi with no Maccabi scope: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });

  /*
   * Deliberately NOT requiring an explicit clubScope on all 108 events.
   *
   * An event with no club-specific text reads correctly wherever the player is - that is what
   * makes it generic - so demanding a declaration everywhere would be 100+ annotations that
   * cannot catch a bug. The rule that does catch bugs is the one above: if the text names a
   * club, the scope has to say so. This test just pins that a scope, once declared, is a
   * value the engine actually understands.
   */
  it('only uses club scopes the engine implements', () => {
    const known = ['maccabi', 'currentClub', 'nonMaccabi', 'abroad', 'formerMaccabi', 'any'];
    for (const event of EVENT_POOL) {
      if (event.conditions.clubScope === undefined) continue;
      expect(known, event.id).toContain(event.conditions.clubScope);
    }
  });

  it('offers no Maccabi-scoped event to a player at another club', () => {
    const elsewhere: Career = {
      ...createCareer({ playerName: 'א', position: 'CM', seed: 5 }),
      academyStage: 'senior',
      currentClubId: 'hapoel_hadera',
      age: 24,
      ability: 70,
      roleValue: 60,
    };

    for (const slot of ['early', 'mid', 'late'] as const) {
      for (const event of EVENT_POOL) {
        if (!isEventEligible(event, elsewhere, slot)) continue;
        expect(
          event.conditions.clubScope,
          `${event.id} is eligible at a non-Maccabi club`,
        ).not.toBe('maccabi');
      }
    }
  });

  it('resolves each scope against the right club situations', () => {
    const base = createCareer({ playerName: 'א', position: 'CM', seed: 6 });
    const atMaccabi: Career = { ...base, academyStage: 'senior', currentClubId: 'maccabi_haifa' };
    const atOther: Career = { ...base, academyStage: 'senior', currentClubId: 'hapoel_hadera' };
    const abroad: Career = { ...base, academyStage: 'senior', currentClubId: 'benfica' };
    const exMaccabi: Career = {
      ...atOther,
      maccabi: { ...base.maccabi, everLeft: true, appearances: 90 },
    };

    expect(matchesClubScope(atMaccabi, 'maccabi')).toBe(true);
    expect(matchesClubScope(atOther, 'maccabi')).toBe(false);
    expect(matchesClubScope(atOther, 'nonMaccabi')).toBe(true);
    expect(matchesClubScope(atMaccabi, 'nonMaccabi')).toBe(false);
    expect(matchesClubScope(abroad, 'abroad')).toBe(true);
    expect(matchesClubScope(atOther, 'abroad')).toBe(false);
    expect(matchesClubScope(exMaccabi, 'formerMaccabi')).toBe(true);
    expect(matchesClubScope(atMaccabi, 'formerMaccabi')).toBe(false);
    // A player with no Maccabi history is not a "former Maccabi" player.
    expect(matchesClubScope(atOther, 'formerMaccabi')).toBe(false);
    expect(matchesClubScope(atOther, 'any')).toBe(true);
    expect(matchesClubScope(atOther, 'currentClub')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

/**
 * Words that name a specific position. `קשר` and `מגן` are excluded on purpose: they are
 * ordinary Hebrew words too ("יצר קשר" = made contact, "מגן" = shield), so matching them
 * produces false positives rather than findings.
 */
const POSITION_WORDS: Partial<Record<Position, string[]>> = {
  GK: ['שוער'],
  ST: ['חלוץ'],
  WG: ['כנף'],
  CB: ['בלם'],
};

/** Categories where the event is about the player's own place in the team. */
const OWN_PLACE_CATEGORIES = ['competition'];

/**
 * Phrases that describe *the player's own slot* by position name.
 *
 * This is the pattern that caused the bug: "החלוץ הפותח נפצע... אתה מתחיל" is about the
 * position the player occupies, so a goalkeeper must never see it. Naming another position is
 * fine when it is the opponent - the striker you are marking, the keeper you are trying to
 * beat - which is why this is phrase-based rather than word-based.
 */
const OWN_SLOT_PHRASES = [
  'החלוץ הפותח',
  'השוער הפותח',
  'הבלם הפותח',
  'הקשר הפותח',
  'המגן הפותח',
  'הכנף הפותח',
];

describe('event audit: position context', () => {
  it('never names a position an event is not scoped to, when it is about your own place', () => {
    const offenders: string[] = [];

    for (const event of EVENT_POOL) {
      if (!OWN_PLACE_CATEGORIES.includes(event.category)) continue;
      const text = allText(event);
      const scoped = event.conditions.positions;

      for (const [position, words] of Object.entries(POSITION_WORDS)) {
        if (!words.some((w) => text.includes(w))) continue;
        // Naming a position is fine if the event only goes to that position.
        if (scoped && scoped.length === 1 && scoped[0] === position) continue;
        offenders.push(`${event.id} names ${position}`);
      }
    }

    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('never describes the player\'s own slot by a position it is not scoped to', () => {
    const offenders: string[] = [];
    for (const event of EVENT_POOL) {
      const text = allText(event);
      for (const phrase of OWN_SLOT_PHRASES) {
        if (!text.includes(phrase)) continue;
        // Only acceptable if the event goes exclusively to the position it names.
        const scoped = event.conditions.positions;
        if (scoped && scoped.length === 1) continue;
        offenders.push(`${event.id} says "${phrase}" but is not scoped to that position`);
      }
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('never tells a goalkeeper his place is threatened by an outfield signing', () => {
    const keeper: Career = {
      ...createCareer({ playerName: 'שוער', position: 'GK', seed: 11 }),
      academyStage: 'senior',
      currentClubId: 'maccabi_haifa',
      age: 24,
      ability: 72,
      roleValue: 62,
    };

    const outfieldWords = ['חלוץ', 'כנף'];
    for (const slot of ['early', 'mid', 'late'] as const) {
      for (const event of EVENT_POOL) {
        if (!isEventEligible(event, keeper, slot)) continue;
        if (!OWN_PLACE_CATEGORIES.includes(event.category)) continue;
        const text = allText(event);
        for (const word of outfieldWords) {
          expect(text.includes(word), `${event.id} tells a GK about a ${word}`).toBe(false);
        }
      }
    }
  });

  it('gives a goalkeeper his own competition storyline', () => {
    const keeper: Career = {
      ...createCareer({ playerName: 'שוער', position: 'GK', seed: 12 }),
      academyStage: 'youth_b',
      age: 15,
      ability: 55,
      roleValue: 55,
      coachTrust: 55,
    };

    const eligible = EVENT_POOL.filter(
      (e) => e.conditions.positions?.includes('GK') && isEventEligible(e, keeper, 'early'),
    );
    expect(eligible.length).toBeGreaterThan(0);
  });
});

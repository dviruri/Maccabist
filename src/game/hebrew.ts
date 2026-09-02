/**
 * Hebrew agreement helpers (v0.9.6.2).
 *
 * Deliberately dependency-free. The one that already existed lived in `src/ui/format.ts`, which
 * imports from `src/game/*` - so an engine file that wanted it created a game -> ui -> game
 * cycle. Kept here, both layers can use it.
 *
 * Related helpers live next to the data they serve: `inCompetition` in `data/uefa` contracts ב
 * onto a competition name, and `withHebrewPrefix` in `game/identity` does the club-name case.
 */

/**
 * A count with its noun, agreeing in number.
 *
 * Hebrew does not say "1 שערים". The plural form is right for 0 and for 2 upwards, and only 1
 * needs its own wording - which is why the singular is passed whole ("שער אחד") rather than
 * assembled, since the numeral itself inflects for gender: שער אחד, but הופעה אחת.
 *
 * countLabel(1, 'שער אחד', 'שערים')  -> "שער אחד"
 * countLabel(4, 'שער אחד', 'שערים')  -> "4 שערים"
 */
export function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : `${count} ${plural}`;
}

/**
 * A one-letter prefix (ו, ל, ב, מ) in front of a phrase that may or may not start with a digit.
 *
 * Hebrew hyphenates a prefix before a numeral - "ו-3 אליפויות", "ל-5 עונות" - and does not before
 * a word: "ואליפות אחת", "לעונה אחת". Combining a prefix with `countLabel` therefore cannot use a
 * fixed hyphen, because the very case `countLabel` exists to fix is the one that must lose it.
 */
export function hebrewPrefix(prefix: string, phrase: string): string {
  return /^[0-9]/.test(phrase) ? `${prefix}-${phrase}` : `${prefix}${phrase}`;
}

/**
 * ב / ל / כ in front of a DEFINITE common noun, where the article contracts into the prefix:
 * "ל" + "הגמר" is "לגמר", not "להגמר".
 *
 * The opposite of `withHebrewPrefix` in game/identity, which handles club names - there the
 * leading ה belongs to the name and must survive ("להפועל", "להמבורג"). The distinction is which
 * kind of word follows, so the two cases get two functions rather than one guess.
 *
 * `inCompetition` in data/uefa is this same rule, fixed to ב and to competition names.
 */
export function contractedPrefix(prefix: string, definiteNoun: string): string {
  return definiteNoun.startsWith('ה') ? `${prefix}${definiteNoun.slice(1)}` : `${prefix}${definiteNoun}`;
}

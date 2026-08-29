/**
 * Asset-role classification (v0.6.4, D4/D5). Shared by the importer and the reclassifier.
 *
 * ## The polarity matters
 *
 * The candidate file is not a search result - it is the value of the club entity's **P154 (logo
 * image)** property, which is Wikidata asserting "this is this club's logo". That is real
 * evidence, so the default is to trust it. This classifier's job is narrow: catch the specific
 * kinds of file that are a club's logo and still the wrong thing to put on a league table row.
 *
 * The first version had this backwards - it demanded the word "logo" in the title and treated
 * any four-digit year as historic. That rejected `Atalanta BC.png` (a perfectly good crest) and
 * `Bologna F.C. 1909 logo.svg`, where 1909 is the club's FOUNDING YEAR, printed on the badge.
 * Crest files are also routinely named for their *adoption* year, which means current, not old.
 *
 * So a bare year proves nothing. What actually indicates the wrong asset is:
 *
 *   - a word mark: "text logo", "wordmark", "lettering", "logotype"
 *   - an explicit historic marker: "old", "former", "historic", "until", "retro", "vintage"
 *   - a year RANGE, which is how Commons dates a superseded badge: "2020 - 2021"
 *   - a colour variant of the real crest: "black", "white", "mono", "negative", "inverted"
 *   - a photograph rather than artwork
 *
 * Anything else is taken as the club's current primary crest. When in doubt the importer can
 * still refuse on other grounds (licence, size), and a fallback badge always beats a wrong one.
 */

/** A superseded badge is dated as a span. A single year is a founding or adoption year. */
const YEAR_RANGE = /\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/;

const WORDMARK = /\b(?:word\s?mark|text\s+logo|lettering|logotype|schriftzug)\b/i;
const HISTORIC = /\b(?:old|former|historic(?:al)?|until|retro|vintage|previous|superseded)\b/i;
/* Colour-variant qualifiers, matched only when they qualify a logo rather than name a club. */
const VARIANT = /\b(?:black|white|mono(?:chrome)?|greyscale|grayscale|negative|inverted|outline)\b/i;
const PHOTO = /\b(?:photo(?:graph)?|stadium|training|fans|jersey|shirt|banner|fußball|match\s?day)\b/i;
/* "... by Someone" plus a date is how Commons names a match photograph. */
const CREDITED_PHOTO = /\bby\s+[A-Z]\w+/;

export type AssetRole = 'current_primary_crest' | 'wordmark' | 'historic_crest' | 'unknown';

export function classifyAsset(fileName: string): AssetRole {
  const title = String(fileName ?? '').replace(/[_]+/g, ' ');
  if (!title) return 'unknown';
  if (PHOTO.test(title) || CREDITED_PHOTO.test(title)) return 'unknown';
  if (WORDMARK.test(title)) return 'wordmark';
  if (HISTORIC.test(title) || YEAR_RANGE.test(title)) return 'historic_crest';
  if (VARIANT.test(title)) return 'unknown';
  return 'current_primary_crest';
}

import { clubVisual } from '../data/clubVisuals';

/**
 * The one answer to "what basic colour is this club" (v0.9.5.1).
 *
 * ## Why this is its own module
 *
 * Two systems need this fact and they must never disagree about it:
 *
 *   - `lib/assetSelector.ts` picks which pre-rendered OUTFIELD shirt to draw
 *   - `ui/kit.ts` decides which goalkeeper colour is forbidden, because a keeper may not wear
 *     the same basic colour as his own club's outfield shirt
 *
 * Before v0.9.5.1 only the first existed, so the second would have had to either import the
 * first - `assetSelector` already imports `resolveGoalkeeperKit` from `ui/kit`, so that is a
 * cycle - or keep a second club-colour table, which is two places to drift. Neither is
 * acceptable for a rule whose whole purpose is that the two answers agree, so the logic lives
 * here and both consume it. This module imports nothing but the club's declared colours.
 *
 * ## The families
 *
 * These are the six the art pack ships, and the mapping is deliberately by MEASURED COLOUR
 * rather than by club name: the world generates clubs, and a name table would be wrong the day
 * one appears. `clubVisual` resolves `crestOwnerId` first, so a youth side is whatever colour its
 * parent is.
 */

export type BasicColour = 'green' | 'yellow' | 'red' | 'blue' | 'white' | 'black';

/**
 * One representative colour per family - the anchors a club's own colour is matched against.
 * Chosen as the colours real kits in this world actually are (Maccabi Haifa's green, Maccabi Tel
 * Aviv's yellow, Hapoel's red, Kiryat Shmona's blue), so the clubs the game ships with land on
 * their own family exactly rather than approximately.
 */
const FAMILY_ANCHORS: Record<BasicColour, { r: number; g: number; b: number }> = {
  green: { r: 15, g: 166, b: 74 },
  yellow: { r: 244, g: 208, b: 63 },
  red: { r: 200, g: 16, b: 46 },
  blue: { r: 27, g: 79, b: 156 },
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
};

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Perceptual-ish colour distance ("redmean"), squared.
 *
 * Plain RGB distance is not good enough here and picks visibly wrong families: Hapoel Hadera's
 * violet #7b2d8e comes out nearer to RED than to BLUE under it, which is not what anyone sees.
 * Weighting the channels the way the eye does - green heaviest, red and blue shifted by where the
 * pair sits on the red axis - puts that violet on blue, comfortably. Cheap, deterministic, and a
 * great deal closer to perception than the alternative.
 */
function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const meanR = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + meanR / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanR) / 256) * db * db;
}

/** Above this a shirt is white whatever its hue; below it, black. Both ends before any matching. */
const WHITE_ABOVE = 0.82;
const BLACK_BELOW = 0.16;

/** The basic colour family of an arbitrary hex colour. */
export function colourFamilyOf(hex: string): BasicColour {
  const rgb = parseHex(hex);
  const lum = luminance(rgb);
  /*
   * The two luminance gates run first and are the reason a near-white or near-black club is never
   * argued into a chromatic family by a faint hue it happens to carry.
   */
  if (lum >= WHITE_ABOVE) return 'white';
  if (lum <= BLACK_BELOW) return 'black';

  let best: BasicColour = 'green';
  let bestDistance = Infinity;
  for (const [family, anchor] of Object.entries(FAMILY_ANCHORS) as [
    BasicColour,
    { r: number; g: number; b: number },
  ][]) {
    const d = distance(rgb, anchor);
    if (d < bestDistance) {
      bestDistance = d;
      best = family;
    }
  }
  return best;
}

/**
 * The basic colour a club's OUTFIELD shirt is.
 *
 * The single source for both "which outfield asset do we draw" and "which goalkeeper colour is
 * forbidden". If these two ever answered differently, a keeper at a blue club could be issued a
 * blue shirt while the outfield art was also blue - which is the exact clash the rule exists to
 * prevent.
 */
export function clubOutfieldColour(clubId: string): BasicColour {
  return colourFamilyOf(clubVisual(clubId).primary);
}

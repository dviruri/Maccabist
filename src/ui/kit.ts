import { clubVisual } from '../data/clubVisuals';
import type { Position } from '../types';

/**
 * The kit (v0.9.4).
 *
 * ## What changed, and why the old rule went
 *
 * Up to v0.9.3 the character art wore one neon kit - black with pink, purple and blue - and the
 * palette rule said no red and no yellow, ever. That rule existed to keep prestige UI and player
 * art from competing, and it had a cost playtesting kept finding: a player at Maccabi Haifa did
 * not look like a Maccabi Haifa player. He looked like a Maccabist character.
 *
 * So the rule is now split by what the shirt MEANS:
 *
 *   OUTFIELD    the shirt is the club. Green at Haifa, yellow at Maccabi Tel Aviv, red at Hapoel,
 *               blue at Kiryat Shmona - whatever the club actually plays in, including the reds
 *               and yellows the old invariant forbade.
 *   GOALKEEPER  the shirt is his own. Blue, pink, purple or black, chosen deterministically and
 *               preferring contrast with his club's outfield colour, because a goalkeeper does
 *               not wear the outfield shirt in football either.
 *
 * ## One source of club colour
 *
 * `clubVisual` already answers "what colour is this club", already resolves `crestOwnerId`
 * inheritance, and already backs every crest in the game. It answers here too - so a Maccabi
 * Haifa youth side wears its parent's green for exactly the same reason it wears its parent's
 * crest, with no second table to keep in step.
 *
 * ## Strength, not tint
 *
 * The recolour is a `screen` blend over the artwork's own black fabric, so folds, seams and
 * highlights all survive. How hard it has to push depends on the colour: a dark red needs almost
 * full strength to read as red, and white needs restraint or the shirt becomes a flat white
 * shape with no fabric left in it. `strength` is computed from the colour's own luminance rather
 * than hand-tuned per club, so a club added later behaves correctly without being listed here.
 */

export type GoalkeeperColour = 'blue' | 'pink' | 'purple' | 'black';

export interface KitPalette {
  /** The shirt's dominant colour. */
  primary: string;
  /** Trim and the lift under a very dark shirt. */
  secondary: string;
  /** How strongly the recolour layer is applied, 0..1. Derived from `primary`'s luminance. */
  strength: number;
  /**
   * True when `primary` is so dark that screening it changes almost nothing. The renderer adds a
   * second, quiet pass in `secondary` so the player stays visible against a night stadium -
   * without substituting a colour the club does not own.
   */
  needsLift: boolean;
  kind: 'outfield' | 'goalkeeper';
  /** Which of the four allowed goalkeeper colours this is. Absent for an outfield kit. */
  goalkeeperColour?: GoalkeeperColour;
}

/** The only goalkeeper palette v0.9.4 needs. Blue, pink, purple, black - and nothing else. */
export const GOALKEEPER_KITS: Record<GoalkeeperColour, { primary: string; secondary: string }> = {
  blue: { primary: '#2a6ede', secondary: '#0b1f4a' },
  pink: { primary: '#e0489b', secondary: '#3a0f2a' },
  purple: { primary: '#7b3fd4', secondary: '#22103f' },
  black: { primary: '#17171c', secondary: '#4a4a57' },
};

export const GOALKEEPER_COLOURS: readonly GoalkeeperColour[] = ['blue', 'pink', 'purple', 'black'];

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

/** Perceptual-ish luminance, 0..1. Good enough to decide how hard a colour has to push. */
export function luminanceOf(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Hue in degrees, or null for a grey where hue means nothing. */
function hueOf(hex: string): number | null {
  const { r, g, b } = parseHex(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 12) return null;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * How hard the recolour has to push, from the colour's own luminance.
 *
 * A dark colour screened over black barely moves, so it needs nearly all of it; a bright one
 * would obliterate the fabric, so it gets much less. The clamps are the two ends of that: 0.95
 * for near-black club colours, 0.62 for white ones - measured against the artwork, not guessed.
 */
function strengthFor(primary: string): number {
  return clamp(1.05 - luminanceOf(primary) * 0.5, 0.62, 0.95);
}

/**
 * The outfield kit for a club.
 *
 * Youth and academy sides inherit through `clubVisual`, which resolves `crestOwnerId` before it
 * looks anything up - so Maccabi Haifa's youth team is green because Maccabi Haifa is green, and
 * no youth club is listed anywhere in this file.
 */
export function resolveClubKitPalette(clubId: string): KitPalette {
  const visual = clubVisual(clubId);
  const primary = visual.primary;
  return {
    primary,
    secondary: visual.secondary,
    strength: strengthFor(primary),
    /* Below this the shirt reads as black whatever is screened onto it. */
    needsLift: luminanceOf(primary) < 0.17,
    kind: 'outfield',
  };
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}

/**
 * How much a goalkeeper colour stands apart from the club's outfield colour.
 *
 * Not kit-clash regulation - presentation identity. Luminance carries most of the weight because
 * that is what actually separates two shirts at a glance, and hue supplies the rest. A grey or
 * black club colour has no hue, so those pairs are judged on brightness alone.
 */
function contrast(clubPrimary: string, gkPrimary: string): number {
  const lumGap = Math.abs(luminanceOf(clubPrimary) - luminanceOf(gkPrimary));
  const a = hueOf(clubPrimary);
  const b = hueOf(gkPrimary);
  if (a === null || b === null) return lumGap;
  const raw = Math.abs(a - b);
  const hueGap = (raw > 180 ? 360 - raw : raw) / 180;
  return lumGap * 0.6 + hueGap * 0.4;
}

/**
 * The goalkeeper's own kit: stable, contrasting, and one of exactly four colours.
 *
 * Stable is the requirement that shaped this. A keeper who is purple on the home screen, blue at
 * kickoff and pink in his career journey has no identity at all, so nothing here is rolled: the
 * choice is a hash of (seed, club, season), which every screen recomputes to the same answer for
 * the same season and which moves on when he moves club or the season turns.
 *
 * Contrast first, then variety: the two best-contrasting colours are found, and the hash picks
 * between those two. So a green club never produces a green-adjacent keeper, and two careers at
 * the same club in the same season can still differ.
 */
export function resolveGoalkeeperKit(input: {
  seed: number;
  clubId: string;
  season: number;
}): KitPalette {
  const clubPrimary = clubVisual(input.clubId).primary;
  const ranked = [...GOALKEEPER_COLOURS].sort((a, b) => {
    const gap = contrast(clubPrimary, GOALKEEPER_KITS[b].primary) - contrast(clubPrimary, GOALKEEPER_KITS[a].primary);
    /* Ties broken by name, so the ranking itself never depends on array order. */
    return gap !== 0 ? gap : a.localeCompare(b);
  });
  const shortlist = ranked.slice(0, 2);
  const pick = shortlist[hash(input.seed, input.clubId, input.season, 'gk-kit') % shortlist.length]!;
  const kit = GOALKEEPER_KITS[pick];
  return {
    primary: kit.primary,
    secondary: kit.secondary,
    strength: strengthFor(kit.primary),
    needsLift: luminanceOf(kit.primary) < 0.17,
    kind: 'goalkeeper',
    goalkeeperColour: pick,
  };
}

/**
 * THE kit resolver. Position decides which of the two rules applies; every screen asks this.
 *
 * `season` and `seed` only matter for a goalkeeper, but they are required rather than optional so
 * a caller cannot accidentally get an unstable keeper by forgetting them.
 */
export function resolvePlayerKit(input: {
  position: Position;
  clubId: string;
  seed: number;
  season: number;
}): KitPalette {
  return input.position === 'GK'
    ? resolveGoalkeeperKit({ seed: input.seed, clubId: input.clubId, season: input.season })
    : resolveClubKitPalette(input.clubId);
}

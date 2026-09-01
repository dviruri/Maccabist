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
 * ## Dye, shading, accents - in that order
 *
 * The shirt is not tinted. It is rebuilt in three passes over the pose's garment mask:
 *
 *   COLOUR  the club's colour as a lit gradient, painted normally - so the hue that lands is the
 *           club's actual hue, at full saturation.
 *   SHADE   the artwork itself, levels-remapped and MULTIPLIED back - so every fold, seam and
 *           shadow the artist drew re-darkens the new colour. This is where the cloth comes from.
 *   ACCENT  the artwork once more, screened gently - so the neon flashes and the trim survive as
 *           kit design rather than being buried under paint.
 *
 * ## Why the v0.9.4 screen-blend version had to go
 *
 * That version screened one club colour over the artwork's own near-black fabric and scaled the
 * layer's OPACITY down for bright colours, on the theory that a bright colour would otherwise
 * obliterate the cloth. Over a near-black base that theory is backwards, and the measured numbers
 * say so. The garment's median luminance is 0.139 (`GARMENT_FABRIC_MEDIAN`, measured off the
 * artwork through the mask), so screening colour C at opacity a lands on
 *
 *     0.139 + a * 0.861 * C
 *
 * At Maccabi Tel Aviv's #f4d03f and the a=0.68 that function returned for it, that is rgb(179,
 * 158, 73) - OLIVE. The opacity was not moderating the colour, it was dimming it, and the darker
 * the club's shirt was supposed to be the less anyone noticed. Reducing opacity on a screen pass
 * cannot preserve fabric either: in a channel where C is near 1 the fabric's whole 0.02..0.25
 * range is compressed to nothing, whatever the opacity.
 *
 * So the colour is now painted at full strength and the fabric is restored by MULTIPLYING the
 * artwork back over it. That inverts the failure: the club's hue is exact, and the shading has
 * more range than the screen version ever had, because the remap AMPLIFIES the fabric's variation
 * instead of compressing it.
 *
 * There is one set of layer numbers for every club (`GARMENT_LAYERS`, `GARMENT_SHADE_FILTER`) -
 * the per-club luminance tuning was the bug, not a feature. What is still per-club is the
 * gradient's two ends, and whether a shirt is so dark it needs the club's secondary to read at
 * all.
 */

export type GoalkeeperColour = 'blue' | 'pink' | 'purple' | 'black';

export interface KitPalette {
  /** The shirt's dominant colour. */
  primary: string;
  /** Trim and the lift under a very dark shirt. */
  secondary: string;
  /**
   * The lit and shadowed ends of the shirt. The colour layer is a vertical gradient - light
   * falling from above, shadow gathering below - so that even before the artwork's own shading is
   * multiplied back the garment already has large-scale lighting on it.
   *
   * For a shirt too dark to read on its own these are pulled towards the club's SECONDARY rather
   * than towards white, which is what `needsLift` decides.
   */
  primaryLight: string;
  primaryDark: string;
  /**
   * True when `primary` is so dark that a shirt painted in it is a silhouette against a night
   * stadium. The gradient's lit end then carries the club's OWN secondary - a black shirt with
   * white shoulders, not a grey wash and not a colour the club does not have.
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

/** Mix a colour toward another, 0..1. The gradient's two ends come from here. */
function mixHex(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (x: number, y: number): string =>
    Math.round(x * (1 - amount) + y * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`;
}

/**
 * Below this luminance a shirt painted in the club's colour is a silhouette, not a kit.
 *
 * The same threshold decides `needsLift` and which way the gradient's lit end is pulled, so a
 * club can never be dark enough to disappear yet not dark enough to be helped.
 */
const LIFT_BELOW = 0.17;

/**
 * The levels remap applied to the artwork before it is multiplied back as the SHADE pass.
 *
 * The garment as drawn occupies roughly 0.02..0.25 luminance with highlights to 0.65 - far too
 * dark to multiply with directly, which is why the v0.9.4 attempt could only afford an opacity of
 * 0.09 and therefore restored nothing. This lifts that band into 0.37..1.0, where multiplying it
 * against the club's colour reads as lit cloth:
 *
 *   brightness(2.4)   spreads the fabric across the usable range; the top ~7% clips, which is the
 *                     neon flashes blowing out - they come back in the ACCENT pass.
 *   contrast(0.62)    pulls the black point up off zero, so a fold shades the colour instead of
 *                     punching a hole in it.
 *   brightness(1.75)  sets the final level: the median fold lands near 0.77, so the shirt sits at
 *                     roughly three quarters of the club's colour and darkens from there.
 *
 * Three stages rather than one because each one clamps: collapsing them into a single
 * brightness/contrast pair needs brightness(11.7), which clips the whole garment to white before
 * the contrast stage ever sees it.
 *
 * `src/styles/gamefeel.css` declares exactly this string on `.pr-kit-shade`, and a test asserts
 * the two have not drifted. The canvas poster feeds it to `ctx.filter`.
 */
export const GARMENT_SHADE_FILTER = 'brightness(2.4) contrast(0.62) brightness(1.75)';

/**
 * The opacity of each pass. One set of numbers for every club in the game.
 *
 * The v0.9.4 version derived these from the club colour's luminance and that was the whole bug -
 * see the note at the top of this file. A club added tomorrow needs no entry here and no tuning.
 */
export const GARMENT_LAYERS = {
  /** COLOUR. Not quite opaque: the last few percent of the artwork underneath is free grain. */
  colour: 0.94,
  /** SHADE. The remap in `GARMENT_SHADE_FILTER` does the tuning, so this is simply all of it. */
  shade: 1,
  /** ACCENT. Enough for the neon trim to read as kit design, not enough to wash out the colour. */
  accent: 0.38,
} as const;

/**
 * The garment's median luminance in the artwork, measured through the mask across all four poses
 * (`scripts/kitProbe.html`). Not a tuning knob - it is what the shading model is calibrated to,
 * and it is what `sampleGarment` samples at by default.
 */
export const GARMENT_FABRIC_MEDIAN = 0.139;

/** The gradient's two ends. Dark clubs are lifted with their own secondary, everyone else lit. */
function gradientFor(primary: string, secondary: string): { primaryLight: string; primaryDark: string } {
  return luminanceOf(primary) < LIFT_BELOW
    ? { primaryLight: mixHex(primary, secondary, 0.38), primaryDark: mixHex(primary, '#000000', 0.3) }
    : { primaryLight: mixHex(primary, '#ffffff', 0.22), primaryDark: mixHex(primary, '#000000', 0.42) };
}

/** The shared layer values every kit carries. */
function layersFor(primary: string, secondary: string): {
  primaryLight: string;
  primaryDark: string;
  needsLift: boolean;
} {
  return { ...gradientFor(primary, secondary), needsLift: luminanceOf(primary) < LIFT_BELOW };
}

/* ------------------------------------------------------------------ */
/* The compositing model, in one place, so the result can be asserted  */
/* ------------------------------------------------------------------ */

/** The `GARMENT_SHADE_FILTER` chain, per channel, with the clamp at every stage that CSS does. */
function shadeCurve(x: number): number {
  const b1 = clamp(x * 2.4, 0, 1);
  const c = clamp((b1 - 0.5) * 0.62 + 0.5, 0, 1);
  return clamp(c * 1.75, 0, 1);
}

/**
 * What the renderer actually produces for one garment pixel, as an 0..255 colour.
 *
 * The DOM and the canvas each spell this stack in their own vocabulary, so neither of them can be
 * asserted against directly - and "does Maccabi Tel Aviv's shirt come out yellow or olive" is
 * precisely the question the v0.9.4 pass got wrong and shipped. This is the third spelling: pure,
 * exported, and the one the tests interrogate.
 *
 * `fabric` is the artwork's own luminance at that pixel, defaulting to the measured median.
 */
export function sampleGarment(
  kit: KitPalette,
  fabric: number = GARMENT_FABRIC_MEDIAN,
): { r: number; g: number; b: number } {
  const colour = parseHex(kit.primary);
  const shade = shadeCurve(fabric);
  const channel = (c: number): number => {
    /* COLOUR: normal blend over the artwork, which is near-neutral at this luminance. */
    const painted = (c / 255) * GARMENT_LAYERS.colour + fabric * (1 - GARMENT_LAYERS.colour);
    /* SHADE: multiply the remapped artwork back over it. */
    const shaded = painted * shade;
    /* ACCENT: screen the artwork on top, gently. */
    const screened = 1 - (1 - shaded) * (1 - fabric);
    return Math.round(
      clamp(shaded * (1 - GARMENT_LAYERS.accent) + screened * GARMENT_LAYERS.accent, 0, 1) * 255,
    );
  };
  return { r: channel(colour.r), g: channel(colour.g), b: channel(colour.b) };
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
    ...layersFor(primary, visual.secondary),
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
    ...layersFor(kit.primary, kit.secondary),
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

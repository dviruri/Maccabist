import { clubVisual } from '../data/clubVisuals';
import { resolveGoalkeeperKit, type GoalkeeperColour } from '../ui/kit';
import type { Position } from '../types';

/**
 * The career player's character art (v0.9.4.x).
 *
 * ## What this replaced
 *
 * Up to now the in-game character was ONE neutral drawing per pose, recoloured live in the DOM:
 * a garment mask cut the shirt out, and three CSS layers painted the club's colour onto it. That
 * bought club identity from a small art pack, and it cost a compositing stack that had to be
 * measured and tuned against the artwork's own luminance to avoid looking like paint.
 *
 * The art pack now ships the shirts already rendered, in six outfield colours and four
 * goalkeeper ones, per age and pose. So there is nothing to recolour: the job is only to pick
 * the right file. This module is that pick, and it is the only place that knows the layout of
 * `public/assets/maccabist/players`.
 *
 * ## Why the club's COLOUR decides, and never the club's name
 *
 * The pack has six outfield families and the world has hundreds of clubs, so something has to
 * map one onto the other. A table of club names would be wrong the day a club is added - and the
 * world generates clubs. `clubVisual` already answers "what colour is this club", already
 * resolves `crestOwnerId` so a youth side inherits its parent, and already backs every crest in
 * the game; it answers here too, and the primary colour it returns is matched to the nearest
 * family. A club added tomorrow gets a sensible shirt with no entry anywhere.
 *
 * Goalkeepers keep the rule they have had since v0.9.4: their own kit, not the club's, chosen by
 * `resolveGoalkeeperKit` from (seed, club, season). That function is unchanged and still the only
 * authority on which of the four colours a keeper wears - this module only turns its answer into
 * a filename.
 */

/** The six outfield families the art pack ships. */
export type OutfieldAssetColour = 'green' | 'yellow' | 'red' | 'blue' | 'white' | 'black';

/** The three age buckets the art pack ships, named as the directories are named. */
export type AgeGroup = 'child' | 'youth' | 'adult';

export type RoleType = 'outfield' | 'goalkeeper';
export type OutfieldPose = 'hero' | 'celebration';
export type GoalkeeperPose = 'ready' | 'celebration';

/**
 * The context vocabulary the screens already speak. Unchanged: `PlayerRender`'s callers pass
 * these today and must keep working untouched.
 */
export type PlayerArtContext = 'hero' | 'celebration' | 'save' | 'ready';

/**
 * Built from BASE_URL, never from a leading slash.
 *
 * The game deploys to GitHub Pages under `/Maccabist/`, where an absolute `/assets/...` resolves
 * against the domain root and 404s. Vite guarantees BASE_URL both starts and ends with `/`, so
 * this concatenates cleanly to `/Maccabist/assets/maccabist` and to `/assets/maccabist` in dev,
 * with no doubled slash in either case. `src/data/assetManifest.json` lists the same files with
 * absolute paths; it is a catalogue, and deliberately not what the app reads.
 */
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/maccabist`;

/**
 * The player's ACTUAL age, in the pack's directory names.
 *
 * The boundaries are the ones the game has always used and are deliberately unchanged - only the
 * labels differ, because the old pack called `<= 14` "youth" and the new one calls it "child".
 * Age, never squad: a 17-year-old playing senior football is still seventeen, and a 19-year-old
 * in an academy side is not.
 */
export function resolveAgeGroup(age: number): AgeGroup {
  if (age <= 14) return 'child';
  if (age <= 18) return 'youth';
  return 'adult';
}

/**
 * One representative colour per outfield family - the anchors the club's own colour is matched
 * against. Chosen as the colours real kits in this world actually are (Maccabi Haifa's green,
 * Maccabi Tel Aviv's yellow, Hapoel's red, Kiryat Shmona's blue), so the clubs the game ships
 * with land on their own family exactly rather than approximately.
 */
const FAMILY_ANCHORS: Record<OutfieldAssetColour, { r: number; g: number; b: number }> = {
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

/**
 * The outfield family for a club, from the club's own colour.
 *
 * The two luminance gates run first and are the reason a near-white or near-black club is never
 * argued into a chromatic family by a faint hue it happens to carry. Everything else goes to the
 * nearest anchor, white and black included, so a desaturated grey still resolves sensibly instead
 * of being forced onto whichever primary it happens to lean towards.
 */
export function resolveOutfieldColourFamily(clubId: string): OutfieldAssetColour {
  const rgb = parseHex(clubVisual(clubId).primary);
  const lum = luminance(rgb);
  if (lum >= WHITE_ABOVE) return 'white';
  if (lum <= BLACK_BELOW) return 'black';

  let best: OutfieldAssetColour = 'green';
  let bestDistance = Infinity;
  for (const [family, anchor] of Object.entries(FAMILY_ANCHORS) as [
    OutfieldAssetColour,
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
 * The context the screens ask for, mapped onto the poses the pack actually has.
 *
 * The new pack is deliberately smaller than the old one - two poses per role rather than a
 * per-role scatter - so `save` and `ready` have to land somewhere. They land on the pose that
 * reads closest: an outfield player has no save or ready pose and falls to his hero, and a keeper
 * has no hero and stands ready. A keeper's `save` goes to celebration because both are the
 * airborne, arms-out drawing; his `hero` goes to ready because that is what a keeper standing
 * still is.
 *
 * Every branch names a file that exists. Nothing here can construct a path the pack does not have.
 */
function outfieldPose(context: PlayerArtContext): OutfieldPose {
  return context === 'celebration' ? 'celebration' : 'hero';
}

function goalkeeperPose(context: PlayerArtContext): GoalkeeperPose {
  return context === 'celebration' || context === 'save' ? 'celebration' : 'ready';
}

/** The low-level path builder. Every segment is a literal from a union, so no path is invented. */
export function resolvePlayerAsset(params: {
  role: RoleType;
  age: AgeGroup;
  pose: OutfieldPose | GoalkeeperPose;
  colour: OutfieldAssetColour | GoalkeeperColour;
}): string {
  return `${ASSET_BASE}/players/${params.role}/${params.age}/${params.pose}/${params.colour}.png`;
}

/** Everything the renderer needs, and everything a test needs to check the pick was right. */
export interface PlayerAssetChoice {
  src: string;
  role: RoleType;
  age: AgeGroup;
  pose: OutfieldPose | GoalkeeperPose;
  colour: OutfieldAssetColour | GoalkeeperColour;
}

/**
 * THE character-art resolver. `PlayerRender` is its only caller in the DOM.
 *
 * `clubId` is whose colours he wears, which is not always where he is going: a transfer OFFER
 * passes his CURRENT club on purpose, so he is still in the old shirt while he decides, and the
 * new one appears at the signing once `currentClubId` has actually changed. Matchday passes the
 * same field and never the fixture's home or away side, so his shirt does not depend on which end
 * of the tie he is on. Both behaviours are the callers', and neither changes here.
 */
export function resolveCharacterAsset(input: {
  age: number;
  position: Position;
  clubId: string;
  seed: number;
  season: number;
  context?: PlayerArtContext;
}): PlayerAssetChoice {
  const age = resolveAgeGroup(input.age);
  const context = input.context ?? 'hero';

  if (input.position === 'GK') {
    /*
     * The keeper's colour is `resolveGoalkeeperKit`'s answer and nothing else: a stable hash of
     * (seed, club, season) over the four allowed colours, preferring contrast with the club's
     * outfield colour. Unchanged from v0.9.4 - this only spells it as a filename, so a keeper is
     * the same colour all season and across every screen exactly as he was.
     */
    const colour = resolveGoalkeeperKit({
      seed: input.seed,
      clubId: input.clubId,
      season: input.season,
    }).goalkeeperColour!;
    const pose = goalkeeperPose(context);
    return { src: resolvePlayerAsset({ role: 'goalkeeper', age, pose, colour }), role: 'goalkeeper', age, pose, colour };
  }

  const colour = resolveOutfieldColourFamily(input.clubId);
  const pose = outfieldPose(context);
  return { src: resolvePlayerAsset({ role: 'outfield', age, pose, colour }), role: 'outfield', age, pose, colour };
}

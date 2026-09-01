import { clubOutfieldColour } from '../ui/colourFamily';
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
 * Goalkeepers wear their own kit, not the club's, chosen by `resolveGoalkeeperKit` from
 * **(seed, club)** - v0.9.5.1 removed the season, so a keeper keeps one shirt for as long as he
 * is at a club. That function is still the only authority on which of the four colours he wears;
 * this module only turns its answer into a filename.
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
 * The outfield family for a club.
 *
 * The measurement lives in `ui/colourFamily.ts` (v0.9.5.1) rather than here, because the
 * goalkeeper rule needs the same answer: a keeper may not wear his club's own outfield colour,
 * and if that check consulted a second table the two could disagree and issue a blue keeper at a
 * blue club. `assetSelector` already imports from `ui/kit`, so `ui/kit` cannot import back from
 * here - hence a neutral module both consume.
 */
export function resolveOutfieldColourFamily(clubId: string): OutfieldAssetColour {
  return clubOutfieldColour(clubId);
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
     * (seed, club) over the four allowed colours, minus the club's own outfield colour. The season
     * is deliberately NOT passed - v0.9.5.1 removed it from the identity, and a keeper keeps one
     * shirt on every screen for as long as he stays where he is.
     */
    const colour = resolveGoalkeeperKit({
      seed: input.seed,
      clubId: input.clubId,
    }).goalkeeperColour!;
    const pose = goalkeeperPose(context);
    return { src: resolvePlayerAsset({ role: 'goalkeeper', age, pose, colour }), role: 'goalkeeper', age, pose, colour };
  }

  const colour = resolveOutfieldColourFamily(input.clubId);
  const pose = outfieldPose(context);
  return { src: resolvePlayerAsset({ role: 'outfield', age, pose, colour }), role: 'outfield', age, pose, colour };
}

import type { Position } from '../types';

/**
 * The one player-art resolver (v0.9).
 *
 * Every screen that shows the player's character asks HERE; no image path for character art
 * lives anywhere else. The rules come from the art pack's own contract:
 *
 *   AGE decides the body:  ≤14 youth, 15-18 teen, ≥19 adult - the player's actual age, never
 *   the team's level, because a 17-year-old starting senior football is still seventeen.
 *
 *   POSITION decides the kind: goalkeepers get goalkeeper art, everyone else outfield. A GK
 *   never falls back to outfield art - a missing GK context falls back to the GK hero.
 *
 *   CONTEXT decides the pose, with per-age availability: adults have celebration and a GK
 *   save; teen/youth have celebration and a GK ready pose. An unavailable context falls back
 *   to the correct age+position hero.
 *
 * The art itself is deliberately neutral (black with pink/purple/blue accents) so one
 * character can wear any club's story; nothing dynamic is baked into it - name, number, age
 * and club are DOM, always.
 */

export type PlayerArtContext = 'hero' | 'celebration' | 'save' | 'ready';

const ROOT = '/assets/gamefeel/players';

type AgeBand = 'youth' | 'teen' | 'adult';

function bandOf(age: number): AgeBand {
  if (age <= 14) return 'youth';
  if (age <= 18) return 'teen';
  return 'adult';
}

/** Which files actually exist in the pack, per band. The resolver never guesses paths. */
const AVAILABLE: Record<AgeBand, Record<'gk' | 'outfield', Partial<Record<PlayerArtContext, string>>>> = {
  adult: {
    gk: { hero: 'goalkeeper-hero.webp', save: 'goalkeeper-save.webp' },
    outfield: { hero: 'outfield-hero.webp', celebration: 'outfield-celebration.webp' },
  },
  teen: {
    gk: { hero: 'goalkeeper-ready.webp', ready: 'goalkeeper-ready.webp' },
    outfield: { hero: 'outfield-hero.webp', celebration: 'outfield-celebration.webp' },
  },
  youth: {
    gk: { hero: 'goalkeeper-ready.webp', ready: 'goalkeeper-ready.webp' },
    outfield: { hero: 'outfield-hero.webp', celebration: 'outfield-celebration.webp' },
  },
};

export function getCareerPlayerArt(input: {
  age: number;
  position: Position;
  context?: PlayerArtContext;
}): string {
  return resolvePlayerArt(input).src;
}

/**
 * The art, plus what is needed to render it (v0.9.4).
 *
 * `garmentMask` is a per-pose alpha mask covering only the shirt and its sleeves, built once from
 * the artwork itself by `scripts/buildKitMasks.mjs`. It is what lets the club's colour reach the
 * kit without reaching the player's face - see `components/PlayerRender.tsx` for the compositing
 * and `ui/kit.ts` for where the colour comes from.
 *
 * Derived from the art path rather than listed separately: a mask that could be named for a pose
 * that does not exist is a mask that can go stale. Every file in AVAILABLE has one, and a test
 * asserts it.
 */
export interface PlayerArt {
  src: string;
  garmentMask: string;
}

export function resolvePlayerArt(input: {
  age: number;
  position: Position;
  context?: PlayerArtContext;
}): PlayerArt {
  const band = bandOf(input.age);
  const kind = input.position === 'GK' ? 'gk' : 'outfield';
  const shelf = AVAILABLE[band][kind];
  const file = shelf[input.context ?? 'hero'] ?? shelf.hero!;
  const base = `${import.meta.env.BASE_URL}${ROOT.slice(1)}/${band}`;
  return {
    src: `${base}/${file}`,
    garmentMask: `${base}/${file.replace(/\.webp$/, '')}-kit.png`,
  };
}

/* ------------------------------------------------------------------ */
/* The rest of the pack, resolved the same way: one place, no guessing */
/* ------------------------------------------------------------------ */

export type BackdropId =
  | 'home-dark'
  | 'neutral-night'
  | 'matchday-crowd'
  | 'europe-night'
  | 'trophy-ceremony'
  | 'training';

const BACKDROPS: Record<BackdropId, string> = {
  'home-dark': 'backgrounds/stadium-home-dark.webp',
  'neutral-night': 'backgrounds/stadium-neutral-night.webp',
  'matchday-crowd': 'backgrounds/stadium-matchday-crowd.webp',
  'europe-night': 'backgrounds/stadium-europe-night.webp',
  'trophy-ceremony': 'backgrounds/stadium-trophy-ceremony.webp',
  training: 'backgrounds/stadium-training.webp',
};

export function getBackdrop(id: BackdropId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/${BACKDROPS[id]}`;
}

export type PersonRole = 'agent' | 'coach' | 'scout' | 'club-director' | 'journalist';

export function getPersonArt(role: PersonRole): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/people/${role}.webp`;
}

export type MomentArtId =
  | 'debut'
  | 'championship'
  | 'cup-win'
  | 'europe-qualification'
  | 'relegation'
  | 'retirement';

export function getMomentArt(id: MomentArtId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/moments/${id}.webp`;
}

export type TransferArtId =
  | 'holding-shirt'
  | 'reveal-silhouette'
  | 'handshake'
  | 'contract-signing'
  | 'press-presentation';

export function getTransferArt(id: TransferArtId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/transfer/${id}.webp`;
}

export type TrophyArtId = 'league' | 'cup' | 'champions-generic' | 'europa-generic' | 'conference-generic';

export function getTrophyArt(id: TrophyArtId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/trophies/trophy-${id}.png`;
}

export type AwardArtId = 'top-scorer' | 'assists' | 'player-season' | 'goalkeeper-season' | 'young-player';

export function getAwardArt(id: AwardArtId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/awards/award-${id}.png`;
}

export type OverlayId =
  | 'green-smoke'
  | 'confetti-green'
  | 'confetti-gold'
  | 'trophy-glow'
  | 'star-lights'
  | 'vignette';

export function getOverlay(id: OverlayId): string {
  return `${import.meta.env.BASE_URL}assets/gamefeel/overlays/${id}.png`;
}

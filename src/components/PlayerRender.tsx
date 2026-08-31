import { useState } from 'react';

import { resolvePlayerKit, type KitPalette } from '../ui/kit';
import { resolvePlayerArt, type PlayerArtContext } from '../ui/playerArt';
import type { Position } from '../types';

/**
 * THE player, rendered (v0.9.4, Phase 2).
 *
 * Every screen that shows the career player's character goes through here: the home hero, the
 * matchday stage, the decision screen, every cinematic moment, the retirement scene. One
 * component, because club recolouring applied separately in five places is five chances for the
 * same player to be wearing two different shirts.
 *
 * ## How the shirt gets its colour without the face getting it too
 *
 * Three layers in one box:
 *
 *   1. the character artwork, untouched
 *   2. a flat club colour, masked to the pose's GARMENT MASK, blended with `screen`
 *   3. for a very dark club colour only, a quiet second pass in the club's secondary
 *
 * `screen` is the whole trick. The artwork's shirt is black fabric with real folds, seams and
 * highlights; screening a colour onto black yields that colour, and screening it onto a highlight
 * yields a lighter version of that colour. So the shading survives and the result is cloth rather
 * than a flat shape pasted over cloth. `strength` decides how hard it pushes, from the colour's
 * own luminance (see `ui/kit.ts`).
 *
 * There is NO filter on the character. No hue-rotate, no saturate, nothing that touches the whole
 * image - skin, face, hair, eyes, hands, the ball and the background are all exactly as drawn.
 * The mask is what confines the colour, and the mask was built to exclude every one of those.
 *
 * ## Geometry
 *
 * The wrapper takes the caller's class, so all the existing positioning - `.gf-hero-art`,
 * `.gf-md-art`, `.gf-dec-art`, `.gf-moment-player` - keeps working untouched: those rules already
 * set position, width, transform, mask and filter, and the layers inside simply fill the box the
 * image gives it. That is why the wrapper has no size of its own.
 */
export function PlayerRender({
  age,
  position,
  clubId,
  seed,
  season,
  context = 'hero',
  className,
  eager = true,
}: {
  age: number;
  position: Position;
  /**
   * Whose colours he wears. Not always his current club: a transfer OFFER shows the club he is
   * still at, and a historic era shows the club of that era.
   */
  clubId: string;
  /** Career seed and season - a goalkeeper's kit is a stable hash of these plus the club. */
  seed: number;
  season: number;
  context?: PlayerArtContext;
  className?: string;
  eager?: boolean;
}): JSX.Element {
  const [artFailed, setArtFailed] = useState(false);
  const [maskFailed, setMaskFailed] = useState(false);
  const art = resolvePlayerArt({ age, position, context });
  const kit = resolvePlayerKit({ position, clubId, seed, season });

  /*
   * A missing mask must not produce a coloured rectangle over the player, so the kit layers only
   * render once the mask file has actually loaded. Failure degrades to the artwork's own kit,
   * which is a complete and correct-looking player - just not in club colours.
   */
  return (
    <div className={`pr${className ? ` ${className}` : ''}`} data-kit={kit.goalkeeperColour ?? 'club'}>
      {!artFailed && (
        <img
          className="pr-art"
          src={art.src}
          alt=""
          aria-hidden
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setArtFailed(true)}
        />
      )}
      {/* Probes the mask; never drawn. Its load decides whether the colour layers exist at all. */}
      <img
        className="pr-probe"
        src={art.garmentMask}
        alt=""
        aria-hidden
        onError={() => setMaskFailed(true)}
      />
      {!artFailed && !maskFailed && <KitLayers mask={art.garmentMask} kit={kit} />}
    </div>
  );
}

function KitLayers({ mask, kit }: { mask: string; kit: KitPalette }): JSX.Element {
  const style = {
    '--pr-mask': `url(${mask})`,
  } as React.CSSProperties;
  return (
    <>
      <div
        className="pr-kit"
        style={{ ...style, background: kit.primary, opacity: kit.strength }}
        aria-hidden
      />
      {/*
        Only for a shirt so dark that screening it changes nothing - a black or near-black club.
        A quiet pass in the club's OWN secondary keeps him visible against a night stadium without
        putting a colour on him that his club does not have.
      */}
      {kit.needsLift && (
        <div
          className="pr-kit pr-kit-lift"
          style={{ ...style, background: kit.secondary, opacity: 0.22 }}
          aria-hidden
        />
      )}
    </>
  );
}

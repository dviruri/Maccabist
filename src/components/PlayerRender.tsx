import { useState } from 'react';

import { GARMENT_LAYERS, resolvePlayerKit, type KitPalette } from '../ui/kit';
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
 * Four layers in one box, every one after the first confined by the pose's GARMENT MASK:
 *
 *   1. the character artwork, untouched
 *   2. COLOUR  the club's colour as a lit vertical gradient, blended normally
 *   3. SHADE   the artwork again, levels-remapped by CSS and `multiply`-ed back: this is where
 *              the folds, seams and shadows come from
 *   4. ACCENT  the artwork a third time, `screen`-ed gently: the neon trim, back on top
 *
 * The dye is the club's, the cloth is the artist's. `ui/kit.ts` carries the whole argument for
 * why this replaced v0.9.4's single screen pass - the short version is that screening a colour at
 * reduced opacity over near-black fabric dims the colour instead of moderating it, which is how
 * Maccabi Tel Aviv's yellow shipped as olive.
 *
 * There is NO filter on the character. The remap in step 3 is declared in the stylesheet, on the
 * SHADE layer's own class - a compositing layer, not the image. Nothing touches skin, face, hair,
 * eyes, hands, the ball or the background, which are all exactly as drawn; the mask confines the
 * colour, and the mask was built to exclude every one of those.
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
      {!artFailed && !maskFailed && <KitLayers art={art.src} mask={art.garmentMask} kit={kit} />}
    </div>
  );
}

function KitLayers({ art, mask, kit }: { art: string; mask: string; kit: KitPalette }): JSX.Element {
  const style = {
    '--pr-mask': `url(${mask})`,
  } as React.CSSProperties;
  const texture = {
    ...style,
    backgroundImage: `url(${art})`,
  } as React.CSSProperties;
  return (
    <>
      {/*
        COLOUR: the club's own hue at full strength, lit from above. For a club dark enough to be
        a silhouette the lit end carries its SECONDARY instead of white, so Sturm Graz gets a
        black shirt with white shoulders rather than a grey wash - see `gradientFor` in ui/kit.ts.
      */}
      <div
        className="pr-kit pr-kit-colour"
        style={{
          ...style,
          background: `linear-gradient(180deg, ${kit.primaryLight} 0%, ${kit.primary} 45%, ${kit.primaryDark} 100%)`,
          opacity: GARMENT_LAYERS.colour,
        }}
        aria-hidden
      />
      {/* SHADE: the artwork's own folds and shadows, remapped by CSS, multiplied back over it */}
      <div
        className="pr-kit pr-kit-shade"
        style={{ ...texture, opacity: GARMENT_LAYERS.shade }}
        aria-hidden
      />
      {/* ACCENT: the neon trim and seams, screened back on top of the new colour */}
      <div
        className="pr-kit pr-kit-accent"
        style={{ ...texture, opacity: GARMENT_LAYERS.accent }}
        aria-hidden
      />
    </>
  );
}

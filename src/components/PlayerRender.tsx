import { useState } from 'react';

import { resolveCharacterAsset, type PlayerArtContext } from '../lib/assetSelector';
import type { Position } from '../types';

/**
 * THE player, rendered (v0.9.4, Phase 2; art pack switched v0.9.4.x).
 *
 * Every screen that shows the career player's character goes through here: the home hero, the
 * matchday stage, the decision screen, every cinematic moment, the retirement scene. One
 * component, because club identity applied separately in five places is five chances for the same
 * player to be wearing two different shirts.
 *
 * ## The shirt is no longer composited
 *
 * It used to be. Up to v0.9.4 this rendered one neutral drawing plus three masked CSS layers -
 * a club-coloured gradient, the artwork multiplied back for its folds, the neon trim screened on
 * top - because the art pack shipped a single kit and the colour had to be added at runtime.
 *
 * The pack now ships the shirts already rendered: six outfield colours and four goalkeeper ones,
 * per age and pose, drawn as finished kits. So there is nothing left to composite. No garment
 * mask, no mask probe, no blend layers, no gradient - one `<img>`, chosen by
 * `lib/assetSelector.ts`, which is the only place that knows how the pack is laid out.
 *
 * The old compositor still exists in `ui/kit.ts` and is still used by the share poster, which is
 * a canvas and a separate decision; nothing in this file touches it any more. What this file DOES
 * still get from there, through the selector, is the goalkeeper colour rule - a keeper's kit is
 * his own rather than his club's, hashed from (seed, club, season) so it holds all season.
 *
 * ## Geometry
 *
 * Unchanged, and deliberately so. The wrapper takes the caller's class, so all the existing
 * positioning - `.gf-hero-art`, `.gf-md-art`, `.gf-dec-art`, `.gf-moment-player` - keeps working
 * untouched: those rules already set position, width, transform, mask and filter, and the image
 * simply fills the box they give it. That is why the wrapper has no size of its own.
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
  const art = resolveCharacterAsset({ age, position, clubId, seed, season, context });

  /*
   * A missing file leaves the frame empty rather than showing a broken image. It cannot happen
   * from a bad path - every segment of the name comes from a string union and a test walks the
   * whole matrix against the disk - so this is for a genuinely absent asset, nothing else.
   */
  return (
    <div className={`pr${className ? ` ${className}` : ''}`} data-kit={art.colour}>
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
    </div>
  );
}

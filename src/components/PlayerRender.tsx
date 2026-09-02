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
 * his own rather than his club's, hashed from (seed, club) so he keeps one shirt for as
 * long as he is at that club - v0.9.5.1 removed the season from that identity.
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
  /**
   * The career seed, and the season.
   *
   * `seed` picks the goalkeeper's kit, with the club. `season` does NOT - v0.9.5.1 took it out of
   * that identity so a keeper stops changing shirt every year - and is passed only because the
   * resolver still accepts it for call-site compatibility.
   */
  seed: number;
  season: number;
  context?: PlayerArtContext;
  className?: string;
  eager?: boolean;
}): JSX.Element {
  const art = resolveCharacterAsset({ age, position, clubId, seed, season, context });
  /*
   * The failure is remembered PER SOURCE, not for the lifetime of the component (v0.9.6).
   *
   * It used to be a bare `useState(false)` that nothing ever reset. One failed load - a dropped
   * request, a cold cache, a single missing file - and the frame stayed empty for as long as the
   * component lived, THROUGH every change of asset. The player transfers and the shirt should
   * change; he has a birthday and the age band should change; a keeper's kit resolves differently
   * at a new club; the pose changes at full time. None of those would have brought him back.
   *
   * Keying the failure to the src that failed makes the reset structural: a new `art.src` is by
   * definition not the source that failed, so it is tried. No effect, no cleanup, no dependency
   * array to get wrong - and no render-phase `setState`, which is what a naive "reset when the
   * prop changes" version would have done.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const artFailed = failedSrc === art.src;
  return (
    <div className={`pr${className ? ` ${className}` : ''}`} data-kit={art.colour}>
      {/*
        A missing file leaves the frame empty rather than showing a broken image. It cannot happen
        from a bad path - every segment of the name comes from a string union and a test walks the
        whole matrix against the disk - so this is for a genuinely absent asset, nothing else.
      */}
      {!artFailed && (
        <img
          /* Keyed by src so React remounts the element rather than reusing a failed one. */
          key={art.src}
          className="pr-art"
          src={art.src}
          alt=""
          aria-hidden
          loading={eager ? 'eager' : 'lazy'}
          /* Remember WHICH source failed, so a different one is still allowed to load. */
          onError={() => setFailedSrc(art.src)}
        />
      )}
    </div>
  );
}

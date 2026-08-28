import { useState } from 'react';

import { clubVisual, getClubCrest } from '../data/clubVisuals';

/**
 * A club badge (v0.4.6).
 *
 * Drawn, not loaded. No official crest is reproduced anywhere in this project and no external
 * image is fetched, so there is no such thing as a broken badge here — the shield is SVG built
 * from the club's colours and initials, and a club with no declared colours gets a deterministic
 * palette from its id rather than nothing.
 *
 * `size` is a token rather than a number so that fourteen of these in a league table are all
 * exactly the same size, which is most of what makes a table look like a table.
 */
export type CrestSize = 'xs' | 'small' | 'medium' | 'large';

/**
 * One bounding box per size, so fourteen crests in a table are all exactly the same size (Phase
 * 19). A real asset gets `object-fit: contain` inside the same box, which is what stops a wide
 * badge and a tall one from distorting to match each other.
 *
 *   xs      dense list rows
 *   small   table rows, match strip, season strip
 *   medium  player hub, transfer offer
 *   large   career moments, retirement
 */
const DIMENSIONS: Record<CrestSize, number> = { xs: 14, small: 18, medium: 26, large: 44 };

export function ClubCrest({
  clubId,
  name,
  size = 'small',
  className,
}: {
  clubId: string;
  /** Needed for filler clubs, which have no Club record to look a name up from. */
  name?: string;
  size?: CrestSize;
  className?: string;
}): JSX.Element {
  const visual = clubVisual(clubId, name);
  const px = DIMENSIONS[size];
  const asset = getClubCrest(clubId);
  /*
   * Whether the asset failed to load (Phase 17).
   *
   * The first version of this replaced the <img> with an HTML comment on error, which is not a
   * fallback - it is a hole where the crest was. Tracking the failure in state and re-rendering
   * the generated badge means a wrong path, a file that failed to deploy and an asset that was
   * deliberately removed all end up showing a working crest. There is no third state and there is
   * never a broken-image icon.
   */
  const [assetFailed, setAssetFailed] = useState(false);

  if (asset && !assetFailed) {
    return (
      <img
        className={`crest crest-${size} crest-asset${className ? ` ${className}` : ''}`}
        src={asset}
        width={px}
        height={px}
        alt={name ?? clubId}
        loading="lazy"
        decoding="async"
        onError={() => setAssetFailed(true)}
      />
    );
  }

  return (
    <svg
      className={`crest crest-${size}${className ? ` ${className}` : ''}`}
      width={px}
      height={px}
      viewBox="0 0 32 32"
      role="img"
      aria-label={name ?? clubId}
      /* The badge is decorative next to a club name that is already read out. */
      aria-hidden={name !== undefined ? true : undefined}
    >
      {/* Shield. An original shape - deliberately not any club's actual outline. */}
      <path
        d="M16 1.5 L29 5.5 V16 C29 23.5 23.2 28.6 16 30.5 C8.8 28.6 3 23.5 3 16 V5.5 Z"
        fill={visual.primary}
        stroke={visual.secondary}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* One diagonal band, for clubs whose colours would otherwise be a flat block. */}
      <path
        d="M3 11 L29 5.8 V10.4 L3 15.6 Z"
        fill={visual.secondary}
        opacity="0.32"
      />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        fill={visual.secondary}
        /* The initials are Hebrew, so the text run has to be told which way to read. */
        direction="rtl"
      >
        {visual.initials}
      </text>
    </svg>
  );
}

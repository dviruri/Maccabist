import {
  SAMI_OFER_CROWD,
  SAMI_OFER_LINES,
  SAMI_OFER_TITLES,
  samiOferContext,
  wasRejectedAsAChild,
} from '../game/maccabiEngine';
import { lastAmbientMaccabiSeason } from '../game/worldEngine';
import type { Career } from '../types';
import { seasonLabel } from '../ui/format';
import { Ltr } from './primitives';

/**
 * The Maccabi family (v0.4.5.1).
 *
 * Three presentations that share one visual language, for the three ways Maccabi shows up in the
 * life of a player who is somewhere else:
 *
 *   MaccabiBanner    "מהבית" — this event is about your relationship with the club
 *   SamiOferHeader   you are walking back into that stadium, on the other side
 *   AmbientNews      something happened there while you were away
 *
 * All three are *headers* rather than whole screens. They sit above the event's own text, so the
 * content system stays one component with variants rather than three bespoke layouts — but a
 * player can tell at a glance that this is not a message from his current club.
 */

/* ------------------------------------------------------------------ */
/* מהבית                                                              */
/* ------------------------------------------------------------------ */

/**
 * The band that says "this is about Maccabi, and you are not there".
 *
 * Deliberately worded and coloured so it cannot be mistaken for a current-club event. The v0.4.5
 * variant system already gave these a green accent; this adds the thing that was missing, which is
 * an explicit statement of *why* the card looks different.
 */
export function MaccabiBanner({ career }: { career: Career }): JSX.Element {
  const rejected = wasRejectedAsAChild(career);

  return (
    <div className="mac-banner">
      <span className="mac-banner-mark" aria-hidden>
        💚
      </span>
      <span className="mac-banner-label">מהבית</span>
      {/*
        A player Maccabi turned away has a relationship with them too - it is just not a fond one.
        Saying "מהבית" to him without qualification would be the game inventing a warmth that
        never existed.
      */}
      {rejected && <span className="mac-banner-note">המועדון שלא קיבל אותך</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sami Ofer                                                           */
/* ------------------------------------------------------------------ */

/**
 * Walking back into Sami Ofer, on the other side.
 *
 * Everything shown here is derived from `samiOferContext`, which reads the career's actual history.
 * The same player always gets the same reception, and a player who was never theirs never gets a
 * homecoming framing.
 */
export function SamiOferHeader({ career }: { career: Career }): JSX.Element {
  const context = samiOferContext(career);

  return (
    <div className={`sami sami-${context}`}>
      <div className="sami-lights" aria-hidden />
      <div className="sami-body">
        <div className="sami-venue">סמי עופר</div>
        <h2 className="sami-title">{SAMI_OFER_TITLES[context]}</h2>
        <p className="sami-line">{SAMI_OFER_LINES[context]}</p>
        <p className="sami-crowd">{SAMI_OFER_CROWD[context]}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* News from home                                                      */
/* ------------------------------------------------------------------ */

/**
 * A sports-news strip, for something Maccabi did while the player was elsewhere.
 *
 * Reads as an update rather than a decision: label, headline, one line of context. The event's own
 * choices still follow underneath, but the framing tells the player this is news he is receiving,
 * not a situation he is standing in.
 */
export function AmbientNewsHeader({ career }: { career: Career }): JSX.Element | null {
  const season = lastAmbientMaccabiSeason(career);
  if (!season) return null;

  return (
    <div className="news">
      <div className="news-strip">
        <span className="news-mark" aria-hidden>
          💚
        </span>
        <span className="news-label">חדשות מהבית</span>
        <span className="news-season">
          <Ltr>{seasonLabel(season.season)}</Ltr>
        </span>
      </div>
      <div className="news-headline">מכבי חיפה · {season.label}</div>
    </div>
  );
}

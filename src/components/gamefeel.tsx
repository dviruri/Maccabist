import { useState, type ReactNode } from 'react';

import { getBackdrop, getCareerPlayerArt, getOverlay, type BackdropId } from '../ui/playerArt';
import { positionLabel } from '../ui/format';
import type { Career } from '../types';
import { ClubCrest } from './ClubCrest';
import { clubDisplayName } from '../game/identity';
import { Ltr } from './primitives';

/**
 * The game-feel foundation (v0.9, Phase 1).
 *
 * The reusable presentation system every v0.9 screen is built FROM, so screens compose a
 * vocabulary instead of each inventing its own. The depth model is fixed and shared:
 *
 *   stadium backdrop → vignette/gradient → player art → glass panels → foreground controls
 *
 * Principles carried from the concepts: near-black cinematic background, Maccabist green as
 * the UI accent, glass-dark panels, big game-like typography, one hero per screen. Character
 * art always comes from the resolver (`ui/playerArt.ts`) and every dynamic value - name, age,
 * club, position, rating - is DOM, never pixels.
 *
 * Every image has a graceful failure mode: backdrops and art are decorative layers behind
 * coded UI, so a missing file degrades to the dark gradient, never to a broken screen.
 */

/* ------------------------------------------------------------------ */
/* CinematicBackdrop                                                   */
/* ------------------------------------------------------------------ */

export function CinematicBackdrop({
  backdrop = 'home-dark',
  children,
  className,
}: {
  backdrop?: BackdropId;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`gf-scene${className ? ` ${className}` : ''}`}>
      {!failed && (
        <img
          className="gf-scene-bg"
          src={getBackdrop(backdrop)}
          alt=""
          aria-hidden
          loading="eager"
          onError={() => setFailed(true)}
        />
      )}
      <div className="gf-scene-vignette" aria-hidden />
      <div className="gf-scene-content">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PlayerHero                                                          */
/* ------------------------------------------------------------------ */

/**
 * The player, as the center of the screen - the concept's opening statement: THIS IS MY
 * PLAYER. Art from the age+position resolver; identity entirely from state. There is no shirt
 * number in the game's model, so none is rendered (the concept's "33" is sample content); the
 * ghost glyph behind the art is the position letter, which IS real.
 */
export function PlayerHero({
  career,
  compact = false,
}: {
  career: Career;
  compact?: boolean;
}): JSX.Element {
  const [artFailed, setArtFailed] = useState(false);
  const art = getCareerPlayerArt({ age: career.age, position: career.position });
  const clubName = clubDisplayName(career.currentClubId);

  return (
    <div className={`gf-hero${compact ? ' gf-hero-compact' : ''}`}>
      <div className="gf-hero-ghost" aria-hidden>
        {career.position}
      </div>
      {!artFailed && (
        <img
          className="gf-hero-art"
          src={art}
          alt=""
          aria-hidden
          loading="eager"
          onError={() => setArtFailed(true)}
        />
      )}
      <div className="gf-hero-id">
        <h1 className="gf-hero-name">{career.playerName}</h1>
        <div className="gf-hero-meta">
          <span className="gf-hero-pos">{positionLabel(career.position)}</span>
          <span className="gf-dot" aria-hidden>
            ·
          </span>
          <span>
            גיל <Ltr>{career.age}</Ltr>
          </span>
        </div>
        <div className="gf-hero-club">
          <ClubCrest clubId={career.currentClubId} size="small" />
          <span>{clubName}</span>
        </div>
        {/* ability is the game's own long-standing rating - shown, not invented */}
        <div className="gf-hero-rating" aria-label={`יכולת ${Math.round(career.ability)}`}>
          <span className="gf-hero-rating-value">
            <Ltr>{Math.round(career.ability)}</Ltr>
          </span>
          <span className="gf-hero-rating-label">יכולת</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panels and typography                                               */
/* ------------------------------------------------------------------ */

export function GlassPanel({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  /** 'gold' for prestige moments, 'euro' for European nights. Default is the dark glass. */
  tone?: 'gold' | 'euro';
}): JSX.Element {
  return (
    <section className={`gf-glass${tone ? ` gf-glass-${tone}` : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </section>
  );
}

export function GameSectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="gf-section-title">
      <span className="gf-section-rule" aria-hidden />
      <h2>{children}</h2>
      <span className="gf-section-rule" aria-hidden />
    </div>
  );
}

export function GameButton({
  children,
  onClick,
  tone = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}): JSX.Element {
  return (
    <button type="button" className={`gf-btn gf-btn-${tone}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* MomentShell                                                         */
/* ------------------------------------------------------------------ */

/**
 * The full-screen frame every "big career moment" renders inside (Phase 6 fills it): backdrop,
 * optional celebration overlay, a stage for art, and a title block. Big event ≠ another card.
 */
export function MomentShell({
  backdrop,
  overlay,
  art,
  kicker,
  title,
  subtitle,
  children,
  onContinue,
  continueLabel = 'המשך',
}: {
  backdrop: BackdropId;
  overlay?: 'confetti-green' | 'confetti-gold' | 'green-smoke' | 'star-lights';
  /** A full art path (moment / transfer / trophy art), already resolved by the caller. */
  art?: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
}): JSX.Element {
  const [artFailed, setArtFailed] = useState(false);
  return (
    <CinematicBackdrop backdrop={backdrop} className="gf-moment">
      {overlay && <img className="gf-moment-overlay" src={getOverlay(overlay)} alt="" aria-hidden loading="lazy" />}
      <div className="gf-moment-stage">
        {art && !artFailed && (
          <img className="gf-moment-art" src={art} alt="" aria-hidden onError={() => setArtFailed(true)} />
        )}
      </div>
      <div className="gf-moment-text">
        {kicker && <div className="gf-kicker">{kicker}</div>}
        <h1 className="gf-moment-title">{title}</h1>
        {subtitle && <p className="gf-moment-sub">{subtitle}</p>}
      </div>
      {children}
      <GameButton onClick={onContinue}>{continueLabel}</GameButton>
    </CinematicBackdrop>
  );
}

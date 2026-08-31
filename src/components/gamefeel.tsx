import { useState, type ReactNode } from 'react';

import { getBackdrop, getOverlay, type BackdropId } from '../ui/playerArt';
import { PlayerRender } from './PlayerRender';
import { positionLabel } from '../ui/format';
import type { Career, Position } from '../types';
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
 *
 * v0.9.4: and the shirt is his CLUB's. The character goes through `PlayerRender`, which is the one
 * component that composites a club colour onto the kit - so the player on the home screen is
 * wearing the same shirt as the player at kickoff and the player on his own championship night,
 * because all of them ask the same component.
 */
export function PlayerHero({
  career,
  compact = false,
}: {
  career: Career;
  compact?: boolean;
}): JSX.Element {
  const clubName = clubDisplayName(career.currentClubId);

  return (
    <div className={`gf-hero${compact ? ' gf-hero-compact' : ''}`}>
      <div className="gf-hero-ghost" aria-hidden>
        {career.position}
      </div>
      <PlayerRender
        className="gf-hero-art"
        age={career.age}
        position={career.position}
        clubId={career.currentClubId}
        seed={career.seed}
        season={career.currentSeason}
      />
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
        {/*
          Club and ability on ONE row (v0.9.3, Phase 8). Stacked, they cost about 30px of every
          screen the hero appears on, and at 360x800 and 375x812 that was exactly the margin the
          home screen was missing. Nothing was removed and nothing got smaller.
        */}
        <div className="gf-hero-line">
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
 * The full-screen frame every "big career moment" renders inside: backdrop, optional celebration
 * overlay, a stage for art, and a title block. Big event != another card.
 *
 * ## The career player, on his own moments (v0.9.3, Phase 5 · finished in v0.9.4, Phase 4)
 *
 * The art pack's moment images are complete SCENES with a generic footballer painted into them.
 * v0.9.3 kept them as background atmosphere behind the career player, dimmed and defocused - and
 * that was still two footballers on one screen, which is worse than one wrong one. There is no
 * reliable way to remove a figure from a raster image.
 *
 * So v0.9.4 composes a moment instead, from layers that contain no people: an empty stadium
 * backdrop, an overlay of confetti or star lights or smoke, a trophy - and the career player, who
 * is the only person in the frame. The prop is called `object` rather than `art` on purpose: the
 * type will not accept a scene.
 */
/** The overlays a moment may wear. Deliberately narrower than `OverlayId`: a vignette is chrome. */
export type MomentOverlay = 'confetti-green' | 'confetti-gold' | 'green-smoke' | 'star-lights';

export function MomentShell({
  backdrop,
  overlay,
  object,
  player,
  kicker,
  title,
  subtitle,
  children,
  onContinue,
  continueLabel = 'המשך',
}: {
  backdrop: BackdropId;
  overlay?: MomentOverlay;
  /**
   * A trophy or award: a transparent OBJECT with nobody in it. Not a moment scene - passing one
   * would put a second footballer on the screen, which is the thing this composition removes.
   */
  object?: string;
  /** The career player. Present means the moment is about him, and he holds the frame. */
  player?: {
    age: number;
    position: Position;
    clubId: string;
    seed: number;
    season: number;
    context: 'celebration' | 'hero';
  };
  kicker?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
}): JSX.Element {
  const [objectFailed, setObjectFailed] = useState(false);
  return (
    <CinematicBackdrop backdrop={backdrop} className={`gf-moment${player ? ' gf-moment-with-player' : ''}`}>
      {overlay && <img className="gf-moment-overlay" src={getOverlay(overlay)} alt="" aria-hidden loading="lazy" />}
      <div className="gf-moment-stage">
        {object && !objectFailed && (
          <img className="gf-moment-art" src={object} alt="" aria-hidden onError={() => setObjectFailed(true)} />
        )}
        {player && (
          <PlayerRender
            className="gf-moment-player"
            age={player.age}
            position={player.position}
            clubId={player.clubId}
            seed={player.seed}
            season={player.season}
            context={player.context}
          />
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

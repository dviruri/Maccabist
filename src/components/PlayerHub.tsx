import { useEffect, useRef, useState } from 'react';

import { currentTeamDisplay } from '../game/identity';
import {
  crowdResponse,
  isAtMaccabi,
  maccabiRelationship,
  RELATIONSHIP_LABELS,
} from '../game/maccabiEngine';
import { clubDisplayName } from '../game/identity';
import { hasLegacy, LEGACY_ICONS, LEGACY_LABELS, legacyStatus } from '../game/legacyEngine';
import { playerLeague } from '../game/worldEngine';
import type { Career } from '../types';
import { moodChips, olderGroupLine, positionIcon, positionLabel, roleIcon, roleText, seasonLabel } from '../ui/format';
import { Chip, Ltr } from './primitives';

/**
 * The Player Hub (v0.4.5).
 *
 * Replaces the v0.4 stat card. The requirement it is built against: a player should understand who
 * he is and where he is in about two seconds. So the hierarchy is deliberately uneven —
 *
 *   name and club      identity, top, largest text
 *   ABILITY            one focal number, because it is the one that means "how good am I"
 *   role               a badge, because it is a status not a quantity
 *   trust/maccabism/reputation   compact rings, because they are context
 *
 * The v0.4 version gave all four metrics identical progress bars, which is why it read as a
 * dashboard: nothing told you what to look at first.
 *
 * Every club/stage string comes from the identity module. Nothing here assembles team wording.
 */

/* ------------------------------------------------------------------ */
/* A number that counts to its value                                   */
/* ------------------------------------------------------------------ */

/**
 * Animates from the previous value to the current one when it changes.
 *
 * Only on change, never on mount — a hub that counts up from zero every time you open a screen
 * is noise. Respects reduced motion by snapping.
 */
function useCountUp(value: number, duration = 520): number {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(value);
      return;
    }

    const started = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - started) / duration);
      // Ease-out, so it decelerates into the final number rather than stopping dead.
      const eased = 1 - (1 - t) ** 3;
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

/* ------------------------------------------------------------------ */
/* Compact metric ring                                                 */
/* ------------------------------------------------------------------ */

const RING_TONES = {
  trust: 'var(--green-bright)',
  maccabism: 'var(--green-primary)',
  reputation: 'var(--europe)',
} as const;

function Ring({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof RING_TONES;
}): JSX.Element {
  const shown = Math.round(value);
  // 44px ring, r=19 -> circumference ~119.4. Dash offset draws the arc.
  const circumference = 2 * Math.PI * 19;
  const filled = (circumference * Math.min(100, Math.max(0, shown))) / 100;

  return (
    <div className="ring">
      <svg viewBox="0 0 44 44" className="ring-svg" aria-hidden>
        <circle cx="22" cy="22" r="19" className="ring-track" />
        <circle
          cx="22"
          cy="22"
          r="19"
          className="ring-fill"
          stroke={RING_TONES[tone]}
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="ring-value">
        <Ltr>{shown}</Ltr>
      </div>
      <div className="ring-label">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The hub                                                             */
/* ------------------------------------------------------------------ */

export function PlayerHub({ career }: { career: Career }): JSX.Element {
  const team = currentTeamDisplay(career);
  const ability = useCountUp(career.ability);
  const onLoan = career.parentClubId !== null;
  const older = olderGroupLine(career);
  const abroad = playerLeague(career).country !== 'ישראל';
  const relationship = maccabiRelationship(career);
  const legacy = legacyStatus(career);
  const showStanding = !isAtMaccabi(career) && relationship !== 'stranger';

  return (
    <section className={`hub${abroad ? ' hub-abroad' : ''}`}>
      {/* --- season strip --- */}
      <div className="hub-strip">
        <span className="hub-season">
          עונת <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </span>
        <span className="hub-position">
          <span aria-hidden>{positionIcon(career.position)}</span>{' '}
          {positionLabel(career.position)}
        </span>
      </div>

      {/* --- identity --- */}
      <div className="hub-identity">
        <h1 className="hub-name">{career.playerName}</h1>
        <div className="hub-club">{team.club}</div>
        <div className="hub-context">
          {team.team ? (
            <span className="hub-stage">{team.team}</span>
          ) : (
            <span>{playerLeague(career).name}</span>
          )}
          <span className="hub-dot" aria-hidden>
            ·
          </span>
          <span>
            בן <Ltr>{career.age}</Ltr>
          </span>
        </div>
      </div>

      {/*
        A loan has to be legible at a glance or the player thinks he was sold. Both clubs, with
        the direction of the move between them.
      */}
      {onLoan && career.parentClubId && (
        <div className="hub-loan">
          <span className="hub-loan-parent">{clubDisplayName(career.parentClubId)}</span>
          <span className="hub-loan-arrow" aria-hidden>
            ↓
          </span>
          <span className="hub-loan-label">מושאל ל{team.club}</span>
        </div>
      )}

      {/* --- ability + role --- */}
      <div className="hub-focal">
        <div className="hub-ability">
          <div className="hub-ability-value">
            <Ltr>{Math.round(ability)}</Ltr>
          </div>
          <div className="hub-ability-label">יכולת</div>
        </div>

        <div className="hub-role-block">
          <div className="hub-role">
            <span aria-hidden>{roleIcon(career)}</span>
            {roleText(career)}
          </div>
          <div className="hub-chips">
            {/*
              Legacy is separate from the squad role (v0.4.5.1). The role badge says how much he
              plays; this says what he means to the club. It appears in 8% of senior seasons, so
              it stays a badge worth seeing rather than furniture.
            */}
            {hasLegacy(legacy) && (
              <Chip tone={legacy === 'legend' ? 'gold' : 'green'}>
                {LEGACY_ICONS[legacy]} {LEGACY_LABELS[legacy]}
              </Chip>
            )}
            {older && <Chip>{older}</Chip>}
            {abroad && <Chip tone="plain">✈️ בחו״ל</Chip>}
            {onLoan && <Chip tone="plain">🔁 מושאל</Chip>}
            {/* Form and confidence stay hidden numbers - they surface only as a phrase. */}
            {moodChips(career).map((mood) => (
              <Chip key={mood.text} tone={mood.tone === 'bad' ? 'warn' : 'plain'}>
                {mood.text}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* --- secondary metrics --- */}
      <div className="hub-rings">
        <Ring label="אמון המאמן" value={career.coachTrust} tone="trust" />
        <Ring label="מכביסטיות" value={career.maccabism} tone="maccabism" />
        <Ring label="מוניטין" value={career.reputation} tone="reputation" />
      </div>

      {/*
        How Maccabi remembers him - only once he is elsewhere, because while he is there it is
        just his standing in the squad, which the role badge already says.
      */}
      {showStanding && (
        <div className="hub-standing">
          <span className="hub-standing-label">מול מכבי חיפה</span>
          <Chip tone={standingTone(career)}>{RELATIONSHIP_LABELS[relationship]}</Chip>
        </div>
      )}
    </section>
  );
}

function standingTone(career: Career): 'gold' | 'warn' | 'plain' {
  const response = crowdResponse(career);
  if (response === 'warm') return 'gold';
  if (response === 'hostile') return 'warn';
  return 'plain';
}

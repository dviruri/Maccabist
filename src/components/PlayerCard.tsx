import {
  crowdResponse,
  isAtMaccabi,
  maccabiRelationship,
  RELATIONSHIP_LABELS,
} from '../game/maccabiEngine';
import type { Career } from '../types';
import {
  headlineSubtitle,
  headlineTitle,
  moodChips,
  olderGroupLine,
  positionIcon,
  positionLabel,
  roleIcon,
  roleText,
  seasonLabel,
} from '../ui/format';
import { Chip, Ltr } from './primitives';

interface StatProps {
  label: string;
  value: number;
  tone: 'ability' | 'maccabism' | 'rep' | 'trust';
}

function Stat({ label, value, tone }: StatProps): JSX.Element {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{Math.round(value)}</div>
      <div className="bar">
        <div className={`bar-fill tone-${tone}`} style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

/**
 * The academy stage - not the age - is the player's identity, so it leads the card.
 */
export function PlayerCard({ career }: { career: Career }): JSX.Element {
  const onLoan = career.parentClubId !== null;
  const older = olderGroupLine(career);

  return (
    <section className="player-card">
      <div className="stage-headline">
        <div className="stage-name">{headlineTitle(career)}</div>
        <div className="stage-club">
          {headlineSubtitle(career)}
          {onLoan ? ' · בהשאלה' : ''}
        </div>
        <div className="stage-meta">
          בן <Ltr>{career.age}</Ltr> • עונת <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </div>
      </div>

      <div className="player-name-row">
        <div className="player-name">{career.playerName}</div>
        <div className="status-badge">
          <span aria-hidden>{roleIcon(career)}</span>
          {roleText(career)}
        </div>
      </div>

      <div className="player-meta">
        <Chip tone="plain">
          {positionIcon(career.position)} {positionLabel(career.position)}
        </Chip>
        {older && <Chip>{older}</Chip>}
        {/* Form and confidence stay hidden numbers - they only surface as a phrase. */}
        {moodChips(career).map((mood) => (
          <Chip key={mood.text} tone={mood.tone === 'bad' ? 'warn' : 'plain'}>
            {mood.text}
          </Chip>
        ))}
      </div>

      <div className="stat-grid">
        <Stat label="יכולת" value={career.ability} tone="ability" />
        <Stat label="אמון המאמן" value={career.coachTrust} tone="trust" />
        <Stat label="מכביסטיות" value={career.maccabism} tone="maccabism" />
        <Stat label="מוניטין" value={career.reputation} tone="rep" />
      </div>

      {/*
        How Maccabi remembers him (v0.4) - shown only once he is somewhere else, because while
        he is there it is just his standing in the squad, which the role chip already says.
        Deliberately next to מכביסטיות: the gap between what he feels and what they remember is
        the point, and seeing both at once is what makes it land.
      */}
      {!isAtMaccabi(career) && maccabiRelationship(career) !== 'stranger' && (
        <div className="maccabi-standing">
          <span className="kicker">מול מכבי חיפה</span>
          <Chip tone={standingTone(career)}>{RELATIONSHIP_LABELS[maccabiRelationship(career)]}</Chip>
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

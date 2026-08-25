import { getClub } from '../data/clubs';
import type { Career } from '../types';
import { positionIcon, positionLabel, stageLabel, statusIcon, statusText } from '../ui/format';
import { Chip, Ltr } from './primitives';

interface StatProps {
  label: string;
  value: number;
  tone: 'ability' | 'maccabism' | 'rep' | 'status';
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

export function PlayerCard({ career }: { career: Career }): JSX.Element {
  const club = getClub(career.currentClubId);
  const onLoan = career.parentClubId !== null;

  return (
    <section className="player-card">
      <div className="row-between">
        <div>
          <div className="player-name">{career.playerName}</div>
          <div className="player-club">
            {club.name}
            {onLoan ? ' (בהשאלה)' : ''}
          </div>
        </div>
        <div className="status-badge">
          <span aria-hidden>{statusIcon(career.status)}</span>
          {statusText(career.status)}
        </div>
      </div>

      <div className="player-meta">
        <Chip tone="plain">
          {positionIcon(career.position)} {positionLabel(career.position)}
        </Chip>
        <Chip tone="plain">
          גיל <Ltr>{career.age}</Ltr>
        </Chip>
        <Chip tone="plain">{stageLabel(career.age)}</Chip>
        {career.captain && <Chip tone="gold">🅲 קפטן</Chip>}
      </div>

      <div className="stat-grid">
        <Stat label="יכולת" value={career.ability} tone="ability" />
        <Stat label="מכביסטיות" value={career.maccabism} tone="maccabism" />
        <Stat label="מוניטין" value={career.reputation} tone="rep" />
        <Stat label="מעמד" value={career.statusValue} tone="status" />
      </div>
    </section>
  );
}

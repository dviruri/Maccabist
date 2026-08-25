import { getClub } from '../data/clubs';
import { trophyIcon } from '../data/trophies';
import type { Career } from '../types';
import { seasonLabel, statusText } from '../ui/format';
import { Chip, DeltaList, Ltr, NumberBox } from './primitives';

interface Props {
  career: Career;
  onContinue: () => void;
}

export function SeasonResultCard({ career, onContinue }: Props): JSX.Element | null {
  const record = career.lastSeasonRecord;
  if (!record) return null;

  const club = getClub(record.clubId);
  const isKeeper = career.position === 'GK';
  const isDefender = career.position === 'CB' || career.position === 'FB';
  const barelyPlayed = record.stats.appearances < 5 && record.age >= 16;

  return (
    <article className="card">
      <div className="stack">
        <div className="season-head">
          <div className="kicker">סיכום עונה</div>
          <div className="spacer" />
          <Chip tone="plain">{statusText(record.status)}</Chip>
        </div>

        <div className="row-between">
          <div className="season-year">
            <Ltr>{seasonLabel(record.season)}</Ltr>
          </div>
          <div style={{ textAlign: 'start' }}>
            <div style={{ fontWeight: 800 }}>{record.clubName}</div>
            <div className="faint">
              {club.league}
              {record.onLoan ? ' · בהשאלה' : ''}
            </div>
          </div>
        </div>

        <div className="numbers">
          <NumberBox value={record.stats.appearances} label="הופעות" />
          {isKeeper ? (
            <NumberBox value={record.stats.cleanSheets} label="שערים נקיים" />
          ) : (
            <NumberBox value={record.stats.goals} label="שערים" />
          )}
          <NumberBox value={record.stats.assists} label="בישולים" />
          {isDefender && <NumberBox value={record.stats.cleanSheets} label="נקיים" />}
          <NumberBox value={Math.round(record.stats.rating)} label="ציון עונה" />
        </div>

        {record.stats.injuredGames > 0 && (
          <p className="faint">
            🩹 פספסת <Ltr>{record.stats.injuredGames}</Ltr> משחקים בגלל פציעה.
          </p>
        )}
        {barelyPlayed && record.stats.injuredGames === 0 && (
          <p className="faint">כמעט ולא ראית דקות העונה. זה מתחיל להיות בעיה.</p>
        )}

        {record.trophies.length > 0 && (
          <div className="stack-sm">
            {record.trophies.map((trophy, i) => (
              <div
                key={trophy.id}
                className="trophy-line"
                style={{ animationDelay: `${180 + i * 120}ms` }}
              >
                <span aria-hidden>{trophyIcon(trophy.id)}</span>
                {trophy.name}!
              </div>
            ))}
          </div>
        )}

        <DeltaList deltas={career.lastSeasonDeltas} />

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          לעונה הבאה
        </button>
      </div>
    </article>
  );
}

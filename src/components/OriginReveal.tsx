import { getClub } from '../data/clubs';
import type { Career } from '../types';
import { Chip, Ltr } from './primitives';

/**
 * The first chapter: how the career actually began.
 *
 * Shown once, straight after creation, before the first season. It never reveals a hidden
 * number - being scouted says "a scout saw you", not "potential 94" - and a rejection is
 * framed as a longer road rather than a failure screen.
 */
export function OriginReveal({
  career,
  onContinue,
}: {
  career: Career;
  onContinue: () => void;
}): JSX.Element {
  const trial = career.trials[0];
  const club = getClub(career.currentClubId);

  const scouted = career.origin === 'scouted';
  const rejected = career.origin === 'trial_rejected';

  const kicker = scouted ? 'לפני שהתחלת' : 'המבחנים למכבי חיפה';
  const icon = scouted ? '⭐' : (trial?.icon ?? '💚');
  const title = scouted ? 'אותרת על ידי מכבי' : (trial?.title ?? 'התקבלת למכבי חיפה');
  const body = scouted
    ? 'סקאוט של מכבי חיפה ראה אותך בטורניר ילדים והזמין אותך ישר למחלקה, בלי מבחנים. זה קורה למעטים.'
    : (trial?.description ?? '');

  return (
    <article className={`card origin-card${rejected ? ' is-setback' : ''}`}>
      <div className="stack">
        <div className="kicker">{kicker}</div>

        <div className="origin-icon" aria-hidden>
          {icon}
        </div>
        <h2 className="card-title" style={{ textAlign: 'center' }}>
          {title}
        </h2>
        <p className="card-body" style={{ textAlign: 'center' }}>
          {body}
        </p>

        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip tone={rejected ? 'warn' : 'green'}>{club.name}</Chip>
          <Chip tone="plain">
            בן <Ltr>{career.age}</Ltr>
          </Chip>
          <Chip tone="plain">
            שנתון <Ltr>{career.birthCohort}</Ltr>
          </Chip>
        </div>

        {rejected && (
          <p className="card-body faint" style={{ textAlign: 'center' }}>
            הדלת של מכבי לא נפתחה - בינתיים. אם תבלוט כאן, הם ישמעו עליך.
          </p>
        )}

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {rejected ? 'להתחיל מהמקום הזה' : 'להתחיל את הקריירה'}
        </button>
      </div>
    </article>
  );
}

/**
 * A later trial - the road back for a player Maccabi turned down. Reuses the same visual
 * language so the callback lands: this is the same door, years on.
 */
export function RetrialCard({
  career,
  onContinue,
}: {
  career: Career;
  onContinue: () => void;
}): JSX.Element {
  const trial = career.trials[career.trials.length - 1];
  if (!trial) return <></>;
  const accepted = trial.accepted;

  return (
    <article className={`card origin-card${accepted ? '' : ' is-setback'}`}>
      <div className="stack">
        <div className="kicker">מבחנים חוזרים במכבי חיפה</div>
        <div className="origin-icon" aria-hidden>
          {trial.icon}
        </div>
        <h2 className="card-title" style={{ textAlign: 'center' }}>
          {trial.title}
        </h2>
        <p className="card-body" style={{ textAlign: 'center' }}>
          {trial.description}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Chip tone="plain">
            ניסיון <Ltr>{trial.attempt}</Ltr>
          </Chip>
        </div>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {accepted ? 'להצטרף למחלקה' : 'להמשיך לעבוד'}
        </button>
      </div>
    </article>
  );
}

import { teamDisplayFor, teamDisplayLine } from '../game/identity';
import { SCOUTED_COPY } from '../game/originEngine';
import type { Career, CareerOrigin } from '../types';
import { seasonLabel } from '../ui/format';
import { Chip, Ltr } from './primitives';

/**
 * The first chapter: how the career actually began.
 *
 * Shown once, straight after creation, before the first season. It never reveals a hidden
 * number - being scouted says "a scout saw you", not "potential 94" - and a rejection is
 * framed as a longer road rather than a failure screen.
 *
 * v0.4.5.1 gives it the presentation it never had. The component referenced `.origin-card` and
 * `.origin-icon`, neither of which existed in the stylesheet, so the first screen of the game
 * rendered as a plain card with a stray emoji. It now has three treatments sharing one language,
 * because the three openings are three different stories:
 *
 *   scouted          they came to you. Gold. Rare enough that it should feel rare.
 *   trial_accepted   you got through the door. Maccabi green.
 *   trial_rejected   the door shut. Not a loss screen - the premise of the whole game.
 *
 * The copy comes from `originEngine`. It used to be duplicated here for the scouted case, which
 * meant two strings kept in step by hand.
 */

/** Which of the three treatments this opening gets. */
type OriginTone = 'prodigy' | 'accepted' | 'setback';

function toneFor(origin: CareerOrigin): OriginTone {
  if (origin === 'scouted') return 'prodigy';
  return origin === 'trial_rejected' ? 'setback' : 'accepted';
}

/** The line above the title: what kind of beginning this was. */
const KICKERS: Record<OriginTone, string> = {
  prodigy: 'לפני שהתחלת',
  accepted: 'המבחנים למכבי חיפה',
  setback: 'המבחנים למכבי חיפה',
};

export function OriginReveal({
  career,
  onContinue,
}: {
  career: Career;
  onContinue: () => void;
}): JSX.Element {
  const trial = career.trials[0];
  /*
    Through the identity module, not `getClub().name`. The academy club record is named
    "מכבי חיפה - מחלקת ילדים" because it doubles as the player's club id while he is a boy, and
    printing it raw put that suffix on the very first screen of the game - the exact failure the
    identity module was written to stop.
  */
  const team = teamDisplayLine(teamDisplayFor(career.currentClubId, career.academyStage));
  const tone = toneFor(career.origin);

  const icon = tone === 'prodigy' ? SCOUTED_COPY.icon : (trial?.icon ?? '💚');
  const title = tone === 'prodigy' ? SCOUTED_COPY.title : (trial?.title ?? 'התקבלת למכבי חיפה');
  const body = tone === 'prodigy' ? SCOUTED_COPY.description : (trial?.description ?? '');

  return (
    <article className={`origin origin-${tone}`}>
      {/* Chapter one, said out loud. This is a beginning, including when it is a rejection. */}
      <div className="origin-chapter">
        <span className="origin-chapter-label">פרק ראשון</span>
        <span className="origin-chapter-season">
          <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </span>
      </div>

      <div className="origin-body">
        <div className="kicker">{KICKERS[tone]}</div>

        <div className="origin-icon" aria-hidden>
          {icon}
        </div>

        <h2 className="origin-title">{title}</h2>
        <p className="origin-text">{body}</p>

        <div className="origin-facts">
          <Chip tone={tone === 'setback' ? 'warn' : 'green'}>{team}</Chip>
          <Chip tone="plain">
            בן <Ltr>{career.age}</Ltr>
          </Chip>
          <Chip tone="plain">
            שנתון <Ltr>{career.birthCohort}</Ltr>
          </Chip>
        </div>

        {tone === 'setback' && (
          <div className="origin-premise">
            <p className="origin-premise-note">
              הדלת של מכבי לא נפתחה - בינתיים. אם תבלוט כאן, הם ישמעו עליך.
            </p>
            {/* The question the version is built around. Worth saying to his face, once. */}
            <p className="origin-premise-question">איך תגרום להם להתחרט?</p>
          </div>
        )}

        {tone === 'prodigy' && (
          <p className="origin-premise-note">
            סקאוט ראה משהו. עכשיו צריך להוכיח שהוא לא טעה.
          </p>
        )}

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {tone === 'setback' ? 'להתחיל מהמקום הזה' : 'להתחיל את הקריירה'}
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
    <article className={`origin origin-${accepted ? 'accepted' : 'setback'}`}>
      <div className="origin-chapter">
        <span className="origin-chapter-label">מבחנים חוזרים</span>
        <span className="origin-chapter-season">
          <Ltr>{seasonLabel(trial.season)}</Ltr>
        </span>
      </div>

      <div className="origin-body">
        <div className="kicker">מכבי חיפה</div>
        <div className="origin-icon" aria-hidden>
          {trial.icon}
        </div>
        <h2 className="origin-title">{trial.title}</h2>
        <p className="origin-text">{trial.description}</p>
        <div className="origin-facts">
          <Chip tone="plain">
            ניסיון <Ltr>{trial.attempt}</Ltr>
          </Chip>
          <Chip tone="plain">
            בן <Ltr>{career.age}</Ltr>
          </Chip>
        </div>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {accepted ? 'להצטרף למחלקה' : 'להמשיך לעבוד'}
        </button>
      </div>
    </article>
  );
}

import { BrandRule, Logo, Ltr } from '../components/primitives';
import type { Career, MetaProgress } from '../types';
import { positionLabel, seasonLabel } from '../ui/format';

interface Props {
  meta: MetaProgress;
  savedCareer: Career | null;
  /** A save from an older version could not be loaded and was cleared. */
  legacySaveDropped: boolean;
  onStart: () => void;
  onResume: () => void;
  /** חדר הגביעים (v0.7). */
  onOpenMeta: () => void;
  onDiscard: () => void;
  onDismissLegacyNotice: () => void;
}

export function WelcomePage({
  meta,
  savedCareer,
  legacySaveDropped,
  onStart,
  onResume,
  onOpenMeta,
  onDiscard,
  onDismissLegacyNotice,
}: Props): JSX.Element {
  const canResume = savedCareer !== null && !savedCareer.retired;

  return (
    <div className="shell narrow" style={{ paddingTop: 42 }}>
      <div className="hero">
        <h1 className="visually-hidden">מכביסט</h1>
        <Logo className="hero-logo" />
        <BrandRule />
        <p className="card-body hero-tagline">
          גדלת במחלקת הנוער של מכבי חיפה. השאלה היא לא כמה טוב תהיה - אלא כמה גדולה תהיה
          האגדה שתשאיר אחריך.
        </p>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        {legacySaveDropped && (
          <div className="notice">
            <span aria-hidden>♻️</span>
            <span style={{ flex: 1 }}>
              הקריירה השמורה שלך נוצרה בגרסה קודמת של המשחק ולא מתאימה למבנה החדש של מחלקת
              הנוער. צריך להתחיל קריירה חדשה.
            </span>
            <button type="button" onClick={onDismissLegacyNotice} aria-label="לסגור">
              ✕
            </button>
          </div>
        )}

        {canResume && savedCareer && (
          <div className="card card-green">
            <div className="stack-sm">
              <div className="kicker" style={{ color: 'rgba(255,255,255,0.8)' }}>
                קריירה פעילה
              </div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{savedCareer.playerName}</div>
              <div style={{ opacity: 0.9, fontSize: 14.5 }}>
                {positionLabel(savedCareer.position)} · גיל <Ltr>{savedCareer.age}</Ltr> · עונת{' '}
                <Ltr>{seasonLabel(savedCareer.currentSeason)}</Ltr>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 10 }}
                onClick={onResume}
              >
                להמשיך את הקריירה
              </button>
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary" onClick={onStart}>
          {canResume ? 'להתחיל קריירה חדשה' : 'להתחיל קריירה'}
        </button>

        {/* v0.7: the meta layer, one tap from home - careers, honors, achievements, clubs. */}
        <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={onOpenMeta}>
          🏆 חדר הגביעים
        </button>

        {canResume && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onDiscard}>
            למחוק את הקריירה השמורה
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 26 }}>
        <div className="kicker">הישגים כלליים</div>
        <div className="meta-grid">
          <div className="meta-box">
            <b>
              <Ltr>{meta.careersPlayed}</Ltr>
            </b>
            <small>קריירות ששיחקת</small>
          </div>
          <div className="meta-box">
            <b>
              <Ltr>{meta.bestLegendScore}</Ltr>
            </b>
            <small>מדד האגדה הגבוה ביותר</small>
          </div>
          <div className="meta-box">
            <b>
              <Ltr>{meta.totalChampionships}</Ltr>
            </b>
            <small>אליפויות שהרמת</small>
          </div>
          <div className="meta-box">
            <b>{meta.bestCareer?.endingTitle || '—'}</b>
            <small>הסיום הטוב ביותר</small>
          </div>
        </div>

        {meta.recentCareers.length > 0 && (
          <div className="card-flat" style={{ marginTop: 6 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>
              קריירות אחרונות
            </div>
            <div className="stack-sm">
              {meta.recentCareers.slice(0, 4).map((summary) => (
                <div key={summary.id} className="row-between">
                  <span style={{ fontWeight: 800 }}>{summary.playerName}</span>
                  <span className="faint">{summary.endingTitle}</span>
                  <span style={{ fontWeight: 900, color: 'var(--maccabi-green-light)' }}>
                    <Ltr>{summary.legendScore}</Ltr>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="faint" style={{ marginTop: 24, textAlign: 'center' }}>
        משחק אוהדים לא רשמי. כל הדמויות בדיוניות.
      </p>
    </div>
  );
}

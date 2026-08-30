import { useMemo, useState } from 'react';

import { ClubAlbum, buildAlbum } from '../components/ClubAlbum';
import { ClubCrest } from '../components/ClubCrest';
import { Ltr } from '../components/primitives';
import { CareerJourney } from '../components/SeasonCardV2';
import { TrophyCabinet } from '../components/TrophyCabinet';
import { storage } from '../services/storage';
import { downloadCareerPoster } from '../services/posterRenderer';
import type { ArchivedCareer } from '../types';
import { positionLabel } from '../ui/format';

/**
 * The meta home (v0.7): every finished career, permanently.
 *
 * Four tabs - קריירות, תארים, הישגים, מועדונים - all reading archived truth only. Nothing here
 * touches the active career or feeds anything back into gameplay: this is the trophy room, not
 * a progression system.
 */

type Tab = 'careers' | 'honors' | 'achievements' | 'clubs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'careers', label: 'קריירות' },
  { id: 'honors', label: 'תארים' },
  { id: 'achievements', label: 'הישגים' },
  { id: 'clubs', label: 'מועדונים' },
];

const LEGACY_RANK_TEXT: Record<string, string> = {
  player: 'שחקן',
  fan_favourite: 'אהוב הקהל',
  green_legend: 'אגדה ירוקה',
  symbol: 'הסמל',
};

function ArchiveCard({ archive, onOpen }: { archive: ArchivedCareer; onOpen: () => void }): JSX.Element {
  const prestigious = archive.legacyRank === 'symbol' || archive.legacyRank === 'green_legend';
  return (
    <button type="button" className={`archive-card${prestigious ? ' archive-card-gold' : ''}`} onClick={onOpen}>
      <ClubCrest clubId={archive.finalClubId} size="large" />
      <div className="archive-card-main">
        <div className="archive-card-name">{archive.playerName}</div>
        <div className="archive-card-sub">
          {positionLabel(archive.position)} · <Ltr>{`${archive.startSeason}–${archive.endSeason}`}</Ltr>
        </div>
        <div className="archive-card-title">{archive.endingTitle}</div>
      </div>
      <div className="archive-card-scores">
        <div className="archive-score">
          <span className="archive-score-value archive-score-green">
            <Ltr>{archive.globalCareer}</Ltr>
          </span>
          <span className="archive-score-label">עולמית</span>
        </div>
        <div className="archive-score">
          <span className="archive-score-value archive-score-gold">
            <Ltr>{archive.maccabiLegacy}</Ltr>
          </span>
          <span className="archive-score-label">מורשת</span>
        </div>
      </div>
    </button>
  );
}

function ArchiveDetail({
  archive,
  onBack,
  onDelete,
}: {
  archive: ArchivedCareer;
  onBack: () => void;
  onDelete: () => void;
}): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="stack">
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        → כל הקריירות
      </button>

      <section className="card archive-hero">
        <ClubCrest clubId={archive.finalClubId} size="large" />
        <h2 className="archive-hero-name">{archive.playerName}</h2>
        <div className="archive-hero-sub">
          {positionLabel(archive.position)} · <Ltr>{`${archive.startSeason}–${archive.endSeason}`}</Ltr> · פרש בגיל{' '}
          <Ltr>{archive.retirementAge}</Ltr>
        </div>
        <div className="archive-hero-title">{archive.endingTitle}</div>
        <div className="poster-scores">
          <div className="poster-score">
            <div className="poster-score-value">
              <Ltr>{archive.globalCareer}</Ltr>
            </div>
            <div className="poster-score-label">קריירה עולמית</div>
          </div>
          <div className="poster-score">
            <div className="poster-score-value">
              <Ltr>{archive.maccabiLegacy}</Ltr>
            </div>
            <div className="poster-score-label">מורשת מכבי</div>
          </div>
        </div>
        {LEGACY_RANK_TEXT[archive.legacyRank] && archive.legacyRank !== 'player' && (
          <div className="archive-rank">{LEGACY_RANK_TEXT[archive.legacyRank]}</div>
        )}
        <div className="archive-poster-buttons">
          <button type="button" className="btn btn-primary" onClick={() => void downloadCareerPoster(archive, 'story')}>
            פוסטר לסטורי
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void downloadCareerPoster(archive, 'square')}>
            פוסטר מרובע
          </button>
        </div>
      </section>

      <section className="card-flat">
        <div className="kicker">המסע</div>
        <div className="archive-route">
          {archive.clubs.map((club, i) => (
            <span key={club.clubId} className="archive-route-stop">
              {i > 0 && <span className="archive-route-arrow">←</span>}
              <ClubCrest clubId={club.clubId} name={club.clubName} size="small" />
              <span>{club.clubName}</span>
              {club.spells > 1 && <span className="archive-route-spells">×{club.spells}</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="card-flat">
        <div className="kicker">ארון הגביעים</div>
        <TrophyCabinet trophies={archive.trophies} honors={archive.honors} promotions={archive.promotions} />
      </section>

      {archive.highlights.length > 0 && (
        <section className="card-flat">
          <div className="kicker">רגעי הקריירה</div>
          <ul className="archive-highlights">
            {archive.highlights.map((m, i) => (
              <li key={i}>
                <span aria-hidden>{m.icon}</span> {m.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-flat">
        <div className="kicker">עונה אחרי עונה</div>
        <CareerJourney seasons={archive.seasons} position={archive.position} honors={archive.honors} />
      </section>

      <section className="card-flat">
        {confirmDelete ? (
          <div className="stack-sm">
            <p className="card-body">למחוק את הקריירה של {archive.playerName} מהארכיון? אין דרך חזרה.</p>
            <div className="archive-poster-buttons">
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                כן, למחוק לצמיתות
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost archive-delete" onClick={() => setConfirmDelete(true)}>
            מחיקת הקריירה מהארכיון
          </button>
        )}
      </section>
    </div>
  );
}

/** The aggregate תארים view: everything won, across every archived career. */
function HonorsTab({ archives }: { archives: readonly ArchivedCareer[] }): JSX.Element {
  const trophies = archives.flatMap((a) => a.trophies);
  const honors = archives.flatMap((a) => a.honors);
  const promotions = archives.flatMap((a) => a.promotions);
  return <TrophyCabinet trophies={trophies} honors={honors} promotions={promotions} />;
}

/** Achievements across careers: a presentation layer over stored achievements (F1). */
function AchievementsTab({ archives }: { archives: readonly ArchivedCareer[] }): JSX.Element {
  const byId = new Map<string, { name: string; description: string; icon: string; count: number }>();
  for (const archive of archives) {
    for (const achievement of archive.achievements) {
      const entry = byId.get(achievement.id);
      if (entry) entry.count += 1;
      else byId.set(achievement.id, { name: achievement.name, description: achievement.description, icon: achievement.icon, count: 1 });
    }
  }
  const entries = [...byId.values()];
  if (entries.length === 0) {
    return <p className="card-body">ההישגים ייחשפו תוך כדי משחק. חלקם נדירים באמת.</p>;
  }
  return (
    <div className="stack-sm">
      {entries.map((a, i) => (
        <div key={i} className="achievement-row">
          <span className="achievement-icon" aria-hidden>
            {a.icon}
          </span>
          <div className="achievement-text">
            <div className="achievement-name">{a.name}</div>
            <div className="achievement-desc">{a.description}</div>
          </div>
          {a.count > 1 && (
            <span className="achievement-count">
              <Ltr>{`×${a.count}`}</Ltr>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function MetaPage({ onBack }: { onBack: () => void }): JSX.Element {
  const [archives, setArchives] = useState<ArchivedCareer[]>(() => storage.loadArchive());
  const [tab, setTab] = useState<Tab>('careers');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const album = useMemo(() => buildAlbum(archives), [archives]);
  const open = archives.find((a) => a.archiveId === openId) ?? null;

  const best = useMemo(() => {
    if (archives.length === 0) return null;
    return {
      global: Math.max(...archives.map((a) => a.globalCareer)),
      legacy: Math.max(...archives.map((a) => a.maccabiLegacy)),
      trophies: Math.max(...archives.map((a) => a.trophies.length)),
      peak: Math.max(...archives.map((a) => a.peakAbility)),
    };
  }, [archives]);

  return (
    <div className="shell narrow meta-shell">
      <header className="meta-header">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          → חזרה
        </button>
        <h1 className="meta-title">חדר הגביעים</h1>
      </header>

      {open ? (
        <ArchiveDetail
          archive={open}
          onBack={() => setOpenId(null)}
          onDelete={() => {
            setArchives(storage.deleteArchivedCareer(open.archiveId));
            setOpenId(null);
          }}
        />
      ) : (
        <>
          {best && (
            <div className="meta-best" role="group" aria-label="שיאי כל הזמנים">
              <div className="meta-best-cell">
                <Ltr>{archives.length}</Ltr>
                <span>קריירות</span>
              </div>
              <div className="meta-best-cell">
                <Ltr>{best.global}</Ltr>
                <span>שיא עולמי</span>
              </div>
              <div className="meta-best-cell">
                <Ltr>{best.legacy}</Ltr>
                <span>שיא מורשת</span>
              </div>
              <div className="meta-best-cell">
                <Ltr>{best.peak}</Ltr>
                <span>שיא יכולת</span>
              </div>
            </div>
          )}

          <nav className="meta-tabs" aria-label="קטגוריות">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`meta-tab${tab === t.id ? ' meta-tab-active' : ''}`}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'careers' &&
            (archives.length === 0 ? (
              <p className="card-body meta-empty">
                כשקריירה מסתיימת היא נשמרת כאן לתמיד - העונות, התארים, המסע. סיים קריירה ראשונה
                וחדר הגביעים יתחיל להתמלא.
              </p>
            ) : (
              <div className="stack">
                {archives.map((archive) => (
                  <ArchiveCard key={archive.archiveId} archive={archive} onOpen={() => setOpenId(archive.archiveId)} />
                ))}
                <section className="card-flat">
                  {confirmReset ? (
                    <div className="stack-sm">
                      <p className="card-body">
                        לאפס את כל חדר הגביעים? כל הקריירות שהסתיימו יימחקו לצמיתות. הקריירה
                        הפעילה לא תיפגע.
                      </p>
                      <div className="archive-poster-buttons">
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            storage.resetMetaAndArchive();
                            setArchives([]);
                            setConfirmReset(false);
                          }}
                        >
                          כן, לאפס הכול
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost archive-delete" onClick={() => setConfirmReset(true)}>
                      איפוס מלא של חדר הגביעים
                    </button>
                  )}
                </section>
              </div>
            ))}

          {tab === 'honors' && <HonorsTab archives={archives} />}
          {tab === 'achievements' && <AchievementsTab archives={archives} />}
          {tab === 'clubs' && <ClubAlbum entries={album} />}
        </>
      )}
    </div>
  );
}

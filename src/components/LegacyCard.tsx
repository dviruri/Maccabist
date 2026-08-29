import { RECORD_CATEGORIES, historicalLadder } from '../data/maccabiHistory';
import {
  contextualComparisons,
  historicalStanding,
  maccabiArchetypes,
  maccabiLegacyFacts,
  maccabiLegacyRank,
  maccabiLegacyScore,
  nextLegacyTarget,
  LEGACY_RANK_ICONS,
  LEGACY_RANK_LABELS,
} from '../game/maccabiLegacy';
import { Ltr } from './primitives';
import type { Career } from '../types';

/**
 * מורשת מכבי (v0.6, Phase 31) - the legacy screen.
 *
 * Four compact sections: the legacy itself (score, rank, archetype), the player's own Maccabi
 * numbers, the next number worth chasing, and the record book against the real pantheon. All
 * selectors, no local arithmetic - the UI displays `maccabiLegacy.ts`, it never computes it
 * (Phase 2). Lives in a Sheet one tap from gameplay; nothing here ever renders above the
 * active event.
 *
 * Green, white, black, gold. The historical figures appear as names and eras only - no
 * photographs, no likenesses (Phase 70).
 */
export function LegacyCard({ career }: { career: Career }): JSX.Element {
  const facts = maccabiLegacyFacts(career);
  const score = maccabiLegacyScore(career);
  const rank = maccabiLegacyRank(career);
  const { primary, secondary } = maccabiArchetypes(career);
  const target = nextLegacyTarget(career);
  const comparisons = contextualComparisons(career);

  return (
    <div className="stack" data-testid="legacy-card">
      {/* ---------------- המורשת שלך ---------------- */}
      <section className="card-flat legacy-section">
        <div className="kicker">המורשת שלך</div>
        <div className="legacy-head">
          <div className="legacy-score" aria-label={`מדד מורשת ${score}`}>
            <Ltr>{score}</Ltr>
          </div>
          <div className="legacy-head-body">
            <div className="legacy-rank">
              <span aria-hidden>{LEGACY_RANK_ICONS[rank]}</span> {LEGACY_RANK_LABELS[rank]}
            </div>
            <div className="legacy-archetype">{primary.label}</div>
            <div className="legacy-line">{primary.line}</div>
            {secondary.length > 0 && (
              <div className="legacy-tags">
                {secondary.map((tag) => (
                  <span key={tag.id} className="legacy-tag">
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- המספרים שלך במכבי ---------------- */}
      <section className="card-flat legacy-section">
        <div className="kicker">המספרים שלך במכבי</div>
        <div className="legacy-numbers">
          <LegacyStat value={facts.appearances} label="הופעות" />
          <LegacyStat value={facts.seasons} label="עונות" />
          {career.position === 'GK' ? (
            <LegacyStat value={facts.cleanSheets} label="שערים נקיים" />
          ) : (
            <LegacyStat value={facts.goals} label="שערים" />
          )}
          <LegacyStat value={facts.championships} label="אליפויות" />
          <LegacyStat value={facts.cups} label="גביעים" />
          <LegacyStat value={facts.captainSeasons} label="עונות כקפטן" />
        </div>
      </section>

      {/* ---------------- בדרך לשיא ---------------- */}
      {target && (
        <section className="card-flat legacy-section">
          <div className="kicker">בדרך לשיא</div>
          <div className="legacy-target">
            <span className="legacy-target-gap">
              עוד <Ltr>{target.gap}</Ltr> הופעות
            </span>
            <span className="legacy-target-label">{target.label}</span>
          </div>
        </section>
      )}

      {/* ---------------- ספר השיאים ---------------- */}
      <section className="card-flat legacy-section">
        <div className="kicker">ספר השיאים של מכבי</div>
        {RECORD_CATEGORIES.map((category) => (
          <RecordLadder key={category.id} career={career} categoryId={category.id} />
        ))}
        <div className="legacy-scope-note">
          הנתונים ההיסטוריים: כל המשחקים הרשמיים בבוגרים, נכון לסוף עונת 2025/26.
        </div>
      </section>

      {/* ---------------- מול הגדולים ---------------- */}
      <section className="card-flat legacy-section">
        <div className="kicker">מול הגדולים</div>
        {comparisons.map((player) => (
          <div key={player.id} className="legacy-compare">
            <div className="legacy-compare-name">
              {player.name}
              <span className="legacy-compare-era">{player.era}</span>
            </div>
            <div className="legacy-compare-note">{player.note}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function LegacyStat({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div className="legacy-stat">
      <div className="legacy-stat-value">
        <Ltr>{value}</Ltr>
      </div>
      <div className="legacy-stat-label">{label}</div>
    </div>
  );
}

/**
 * One record category: the player's row placed inside the real top of the ladder.
 *
 * Phrased as standing, never superiority (Phase 32) - "אתה: 183" alongside the names above,
 * not "עקפת אותו ככדורגלן".
 */
function RecordLadder({
  career,
  categoryId,
}: {
  career: Career;
  categoryId: (typeof RECORD_CATEGORIES)[number]['id'];
}): JSX.Element | null {
  const category = RECORD_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  const standing = historicalStanding(career, categoryId);
  const top = historicalLadder(categoryId).slice(0, 3);

  return (
    <div className="legacy-ladder">
      <div className="legacy-ladder-title">{category.label}</div>
      {top.map((row, index) => (
        <div key={row.player.id} className="legacy-ladder-row">
          <span className="legacy-ladder-rank">
            <Ltr>{index + 1}</Ltr>
          </span>
          <span className="legacy-ladder-name">{row.player.name}</span>
          <span className="legacy-ladder-value">
            <Ltr>{row.value}</Ltr>
          </span>
        </div>
      ))}
      <div className={`legacy-ladder-row legacy-ladder-you${standing.rank <= 3 ? ' is-top' : ''}`}>
        <span className="legacy-ladder-rank">
          <Ltr>{standing.rank}</Ltr>
        </span>
        <span className="legacy-ladder-name">אתה</span>
        <span className="legacy-ladder-value">
          <Ltr>{standing.playerValue}</Ltr>
        </span>
      </div>
      {standing.brokeRecord && <div className="legacy-ladder-note">השיא שלך 👑</div>}
      {standing.tiedRecord && <div className="legacy-ladder-note">השווית את השיא</div>}
    </div>
  );
}

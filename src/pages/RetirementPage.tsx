import { CareerTimeline } from '../components/CareerTimeline';
import { Timeline } from '../components/Timeline';
import { Chip, Logo, Ltr, NumberBox } from '../components/primitives';
import { TRAITS_BY_ID } from '../data/traits';
import { careerStory } from '../game/storyEngine';
import type { Career } from '../types';
import { careerYears, positionLabel } from '../ui/format';

interface Props {
  career: Career;
  onNewCareer: () => void;
  isBest: boolean;
}

export function RetirementPage({ career, onNewCareer, isBest }: Props): JSX.Element {
  const legend = career.legend;
  const m = career.maccabi;
  const isKeeper = career.position === 'GK';
  const europeSeasons = career.seasonHistory.filter(
    (s) => s.league !== 'ליגת העל' && s.league !== 'ליגה לאומית' && s.stats.appearances > 0,
  );
  const europeApps = europeSeasons.reduce((sum, s) => sum + s.stats.appearances, 0);

  return (
    <div className="shell narrow" style={{ paddingTop: 26 }}>
      {/* --- share-card style hero --- */}
      <section className="legend-hero">
        <Logo className="legend-logo" />
        <h1 style={{ fontSize: 'clamp(30px, 10vw, 42px)', marginTop: 10 }}>{career.playerName}</h1>
        <p className="muted">
          {positionLabel(career.position)} · <Ltr>{careerYears(career)}</Ltr> · פרש בגיל{' '}
          <Ltr>{career.retirementAge}</Ltr>
        </p>

        <div style={{ marginTop: 22 }}>
          <div className="legend-label">מדד אגדה</div>
          <div className="legend-score">
            <Ltr>{legend?.score ?? 0}</Ltr>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 44 }} aria-hidden>
            {legend?.ending.icon}
          </div>
          <h2 className="ending-title">{legend?.ending.title}</h2>
          <div className="ending-sub">{legend?.ending.subtitle}</div>
        </div>

        {isBest && (
          <div style={{ marginTop: 14 }}>
            <Chip tone="gold">⭐ השיא האישי החדש שלך</Chip>
          </div>
        )}
      </section>

      {/* --- the career, told as a story --- */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stack-sm">
          <div className="kicker">סיפור הקריירה</div>
          {careerStory(career).map((line) => (
            <p key={line} className="card-body story-line">
              {line}
            </p>
          ))}
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {career.traits.map((trait) => (
              <Chip key={trait.id} tone="plain">
                {TRAITS_BY_ID[trait.id].icon} {TRAITS_BY_ID[trait.id].label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {/* --- every moment that mattered --- */}
      <div style={{ marginTop: 14 }}>
        <CareerTimeline career={career} defaultOpen />
      </div>

      {/* --- headline numbers --- */}
      <section className="card" style={{ marginTop: 18 }}>
        <div className="stack">
          <div className="kicker">במדים של מכבי חיפה</div>
          <div className="numbers">
            <NumberBox value={m.appearances} label="הופעות" />
            <NumberBox value={isKeeper ? m.cleanSheets : m.goals} label={isKeeper ? 'נקיים' : 'שערים'} />
            <NumberBox value={m.assists} label="בישולים" />
            <NumberBox value={m.seasons} label="עונות" />
            <NumberBox value={m.championships} label="אליפויות" />
            <NumberBox value={m.cups} label="גביעים" />
            <NumberBox value={m.captainSeasons} label="עונות כקפטן" />
            <NumberBox value={career.trophies.length} label="תארים בקריירה" />
          </div>

          <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {m.academyGraduate && <Chip>🌱 בוגר האקדמיה</Chip>}
            {m.returned && (
              <Chip>
                🏠 חזרת בגיל <Ltr>{m.returnAge}</Ltr>
              </Chip>
            )}
            {m.everLeft && !m.returned && <Chip tone="plain">✈️ עזבת ולא חזרת</Chip>}
            {europeApps > 0 && (
              <Chip tone="plain">
                🌍 <Ltr>{europeApps}</Ltr> הופעות בחו״ל
              </Chip>
            )}
            <Chip tone="plain">
              שיא יכולת <Ltr>{Math.round(career.peakAbility)}</Ltr>
            </Chip>
          </div>
        </div>
      </section>

      {/* --- legend breakdown --- */}
      {legend && (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="stack-sm">
            <div className="kicker">ממה מורכב מדד האגדה</div>
            {legend.components.map((component) => (
              <div key={component.key} className="component-row">
                <span className="component-name">{component.label}</span>
                <span className="component-bar">
                  <span
                    style={{ width: `${Math.round((component.points / component.max) * 100)}%` }}
                  />
                </span>
                <span className="component-points">
                  <Ltr>
                    {component.points.toFixed(1)}/{component.max}
                  </Ltr>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- career timeline --- */}
      <section className="card" style={{ marginTop: 14 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          ציר הקריירה
        </div>
        <Timeline history={career.seasonHistory} />
      </section>

      {/* --- achievements --- */}
      {career.achievements.length > 0 && (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            רגעים בקריירה
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {career.achievements.map((achievement) => (
              <Chip key={achievement.id} tone="plain">
                {achievement.icon} {achievement.name}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 22 }}
        onClick={onNewCareer}
      >
        קריירה חדשה
      </button>
      <p className="faint" style={{ textAlign: 'center', marginTop: 10, marginBottom: 20 }}>
        יאללה, עוד קריירה אחת.
      </p>
    </div>
  );
}

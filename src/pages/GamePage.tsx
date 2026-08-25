import { Celebration } from '../components/Celebration';
import { DebugPanel } from '../components/DebugPanel';
import { EventCard, OutcomeCard } from '../components/EventCard';
import { OffersCard } from '../components/OffersCard';
import { PlayerCard } from '../components/PlayerCard';
import {
  MidSeasonCard,
  ProgressionCard,
  SeasonResultCard,
  YouthTransitionCard,
} from '../components/SeasonCards';
import { Timeline } from '../components/Timeline';
import { Chip, Logo, Ltr } from '../components/primitives';
import { EVENTS_BY_ID } from '../data/events';
import type { GameActions } from '../state/useGame';
import type { Career } from '../types';
import { headlineTitle, olderGroupLine, seasonLabel } from '../ui/format';

interface Props {
  career: Career;
  actions: GameActions;
  onExit: () => void;
}

export function GamePage({ career, actions, onExit }: Props): JSX.Element {
  return (
    <div className="shell">
      <header className="topbar">
        <Logo variant="mark" className="topbar-mark" />
        <div className="topbar-brand">
          מכבי<span>סט</span>
        </div>
        <div className="spacer" />
        <Chip tone="plain">{headlineTitle(career)}</Chip>
        <button type="button" className="debug-toggle" onClick={onExit}>
          תפריט
        </button>
      </header>

      <div className="game-layout">
        <aside className="stack">
          <PlayerCard career={career} />
          {career.seasonHistory.length > 0 && (
            <section className="card-flat">
              <div className="kicker" style={{ marginBottom: 10 }}>
                הקריירה עד כה
              </div>
              <Timeline history={career.seasonHistory.slice(-14)} />
            </section>
          )}
        </aside>

        <main className="stack">
          <PhaseView career={career} actions={actions} />
        </main>
      </div>

      <Celebration achievements={career.lastAchievements} progression={career.lastProgression} />
      {import.meta.env.DEV && <DebugPanel career={career} onChange={actions.overrideCareer} />}
    </div>
  );
}

function PhaseView({ career, actions }: { career: Career; actions: GameActions }): JSX.Element {
  switch (career.phase) {
    case 'event': {
      if (career.lastEventResult) {
        return (
          <OutcomeCard
            result={career.lastEventResult}
            onContinue={actions.continueEvent}
            continueLabel={career.pendingEventIds.length > 0 ? 'הלאה' : 'להמשך העונה'}
          />
        );
      }
      const eventId = career.pendingEventIds[0];
      const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
      if (!event || !eventId) {
        return <ContinueCard title="העונה ממשיכה" onContinue={actions.continueEvent} label="קדימה" />;
      }
      return <EventCard event={event} onChoose={(choiceId) => actions.answer(eventId, choiceId)} />;
    }

    case 'mid_season':
      return <MidSeasonCard career={career} onContinue={actions.continueMidSeason} />;

    case 'season_result':
      return <SeasonResultCard career={career} onContinue={actions.continueSeason} />;

    case 'progression':
      return <ProgressionCard career={career} onContinue={actions.continueProgression} />;

    case 'youth_to_senior':
      return <YouthTransitionCard career={career} onChoose={actions.chooseYouthPath} />;

    case 'offseason':
      return (
        <OffersCard
          offers={career.pendingOffers}
          onAccept={actions.takeOffer}
          onDecline={actions.refuseOffers}
        />
      );

    case 'retirement_decision':
      return <RetirementDecision career={career} actions={actions} />;

    case 'preseason':
    default:
      return <PreSeasonCard career={career} onStart={actions.nextSeason} />;
  }
}

function PreSeasonCard({ career, onStart }: { career: Career; onStart: () => void }): JSX.Element {
  const older = olderGroupLine(career);
  const first = career.seasonHistory.length === 0;

  return (
    <article className="card">
      <div className="stack">
        <div className="kicker">{first ? 'הצעד הראשון' : 'לפני העונה'}</div>
        <h2 className="card-title">
          {headlineTitle(career)} · <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </h2>
        <p className="card-body">
          {first
            ? 'האימון הראשון שלך במגרשי האימונים של מכבי חיפה. מכאן זו דרך ארוכה מאוד.'
            : `עוד עונה במדים הירוקים. אתה בן ${career.age}.`}
        </p>
        {older && <Chip>{older}</Chip>}
        <button type="button" className="btn btn-primary" onClick={onStart}>
          להתחיל את העונה
        </button>
      </div>
    </article>
  );
}

function RetirementDecision({
  career,
  actions,
}: {
  career: Career;
  actions: GameActions;
}): JSX.Element {
  return (
    <article className="card event-card">
      <div className="stack">
        <div className="kicker">סוף הדרך מתקרב</div>
        <h2 className="card-title">
          אתה בן <Ltr>{career.age}</Ltr>. כמה עוד נשאר?
        </h2>
        <p className="card-body">
          הגוף מזכיר לך כל בוקר כמה שנים עברו. אתה יכול למשוך עוד עונה - או לסיים את זה
          בזמן, בתנאים שלך.
        </p>
        <div className="stack-sm">
          <button
            type="button"
            className="btn btn-choice"
            onClick={() => actions.retirementChoice('continue')}
          >
            <span>עוד עונה אחת</span>
            <span className="hint">עוד משחקים, עוד סיכוי לתארים - ועוד שחיקה</span>
          </button>
          <button
            type="button"
            className="btn btn-choice"
            onClick={() => actions.retirementChoice('retire')}
          >
            <span>לתלות את הנעליים</span>
            <span className="hint">לסיים ולחשב את מדד האגדה</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ContinueCard({
  title,
  label,
  onContinue,
}: {
  title: string;
  label: string;
  onContinue: () => void;
}): JSX.Element {
  return (
    <article className="card">
      <div className="stack">
        <h2 className="card-title">{title}</h2>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {label}
        </button>
      </div>
    </article>
  );
}

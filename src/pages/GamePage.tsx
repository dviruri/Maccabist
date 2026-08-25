import { Celebration } from '../components/Celebration';
import { DebugPanel } from '../components/DebugPanel';
import { EventCard, OutcomeCard } from '../components/EventCard';
import { OffersCard } from '../components/OffersCard';
import { PlayerCard } from '../components/PlayerCard';
import { SeasonResultCard } from '../components/SeasonResultCard';
import { Timeline } from '../components/Timeline';
import { Chip, Logo, Ltr } from '../components/primitives';
import { getClub } from '../data/clubs';
import { EVENTS_BY_ID } from '../data/events';
import type { GameActions } from '../state/useGame';
import type { Career } from '../types';
import { seasonLabel, stageLabel } from '../ui/format';

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
        <Chip tone="plain">
          עונת <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </Chip>
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

      <Celebration achievements={career.lastAchievements} />
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
            continueLabel={career.pendingEventIds.length > 0 ? 'הלאה' : 'לשחק את העונה'}
          />
        );
      }
      const eventId = career.pendingEventIds[0];
      const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
      if (!event || !eventId) {
        return <ContinueCard title="העונה מתחילה" onContinue={actions.continueEvent} label="קדימה" />;
      }
      return <EventCard event={event} onChoose={(choiceId) => actions.answer(eventId, choiceId)} />;
    }

    case 'season_result':
      return <SeasonResultCard career={career} onContinue={actions.continueSeason} />;

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
  const club = getClub(career.currentClubId);
  const onLoan = career.parentClubId !== null;

  return (
    <article className="card">
      <div className="stack">
        <div className="kicker">לפני העונה</div>
        <h2 className="card-title">
          עונת <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </h2>
        <p className="card-body">
          אתה בן <Ltr>{career.age}</Ltr>, ב{club.shortName ?? club.name}
          {onLoan ? ' (בהשאלה)' : ''}, {club.league}.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Chip tone="plain">{stageLabel(career.age)}</Chip>
          {career.captain && <Chip tone="gold">🅲 אתה הקפטן</Chip>}
        </div>
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
  const club = getClub(career.currentClubId);

  return (
    <article className="card event-card">
      <div className="stack">
        <div className="kicker">סוף הדרך מתקרב</div>
        <h2 className="card-title">
          אתה בן <Ltr>{career.age}</Ltr>. כמה עוד נשאר?
        </h2>
        <p className="card-body">
          הגוף מזכיר לך כל בוקר כמה שנים עברו. ב{club.name} כבר מדברים על מה יהיה אחריך.
          אתה יכול למשוך עוד עונה - או לסיים את זה בזמן, בתנאים שלך.
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

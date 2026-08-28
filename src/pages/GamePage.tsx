import { useState } from 'react';

import { CareerTimeline } from '../components/CareerTimeline';
import { CompactHub } from '../components/CompactHub';
import { LeagueTableCard } from '../components/LeagueTableCard';
import { SeasonStrip } from '../components/SeasonStrip';
import { Sheet } from '../components/Sheet';
import { Celebration } from '../components/Celebration';
import { DebugPanel } from '../components/DebugPanel';
import { DecisionCard, OutcomeReveal } from '../components/DecisionCard';
import { OutcomeCard } from '../components/EventCard';
import { OffersCard } from '../components/OffersCard';
import { OriginReveal, RetrialCard } from '../components/OriginReveal';
import { PlayerHub } from '../components/PlayerHub';
import {
  MidSeasonCard,
  ProgressionCard,
  SeasonResultCard,
  YouthTransitionCard,
} from '../components/SeasonCards';
import { Timeline } from '../components/Timeline';
import { Chip, Logo, Ltr } from '../components/primitives';
import { EVENTS_BY_ID } from '../data/events';
import { getLeague } from '../data/leagues';
import { clubDisplayName } from '../game/identity';
import { currentTable } from '../game/leagueEngine';
import type { GameActions } from '../state/useGame';
import type { Career } from '../types';
import { headlineTitle, olderGroupLine, seasonLabel, seasonPhaseSteps } from '../ui/format';

interface Props {
  career: Career;
  actions: GameActions;
  onExit: () => void;
}

/**
 * What the secondary sheets are, and which one is open.
 *
 * A plain union rather than three booleans: only one sheet can be open at a time, and encoding
 * that in the type means it cannot get into a state where two are.
 */
type SheetId = 'table' | 'timeline' | 'history' | null;

export function GamePage({ career, actions, onExit }: Props): JSX.Element {
  const [sheet, setSheet] = useState<SheetId>(null);
  const close = (): void => setSheet(null);

  const table = currentTable(career);
  const league = table ? getLeague(table.leagueId) : null;

  /*
   * The gameplay screen, restructured for a phone (v0.4.7).
   *
   * v0.4.6 rendered an aside of secondary panels before the main column. On a desktop that is a
   * sidebar; on a phone the grid collapses and it becomes four screens of dashboard stacked on top
   * of the event. Measured at 390px: the decision began at y=1155 and the first button a player
   * could press was at y=1454.
   *
   * The order now is the loop itself - WHO AM I, WHERE ARE WE, WHAT IS HAPPENING, WHAT DO I
   * CHOOSE - and everything else is one tap away in a sheet. Nothing was deleted.
   */
  return (
    <div className="shell play">
      <header className="topbar topbar-slim">
        <Logo variant="mark" className="topbar-mark" />
        <div className="topbar-brand">
          מכבי<span>סט</span>
        </div>
        <div className="spacer" />
        <span className="topbar-season">
          <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </span>
        <button type="button" className="debug-toggle" onClick={onExit}>
          תפריט
        </button>
      </header>

      {/* ---------- primary gameplay layer ---------- */}
      <CompactHub career={career} onOpenCareer={() => setSheet('history')} />
      <SeasonStrip career={career} onOpenTable={() => setSheet('table')} />

      {/*
        The five-dot season-phase strip is gone from here (v0.4.7). Its one piece of information -
        which part of the season this is - is now a word inside SeasonStrip, and it kept an academy
        career's context too, where there is no league table for the strip to show.
      */}
      {!career.retired && !currentTable(career) && <SeasonProgress career={career} />}

      <main className="play-main">
        <PhaseView career={career} actions={actions} />
      </main>

      {/* ---------- one tap to everything else ---------- */}
      <nav className="play-nav" aria-label="מידע נוסף">
        {table && (
          <button type="button" className="play-nav-btn" onClick={() => setSheet('table')}>
            טבלה
          </button>
        )}
        <button type="button" className="play-nav-btn" onClick={() => setSheet('timeline')}>
          סיפור הקריירה
        </button>
        <button type="button" className="play-nav-btn" onClick={() => setSheet('history')}>
          הקריירה
        </button>
      </nav>

      {/*
        The sheets render nothing at all while closed, so a fourteen-row table and a full career
        timeline are not mounted during ordinary play (Phase 39).
      */}
      <Sheet
        open={sheet === 'table'}
        title={league?.name ?? 'מצב הליגה'}
        subtitle={table ? `מחזור ${table.rows[0]?.played ?? ''}` : undefined}
        onClose={close}
      >
        <LeagueTableCard career={career} defaultOpen inSheet />
      </Sheet>

      <Sheet open={sheet === 'timeline'} title="סיפור הקריירה" onClose={close}>
        <CareerTimeline career={career} defaultOpen />
      </Sheet>

      <Sheet open={sheet === 'history'} title="הקריירה" onClose={close}>
        <div className="stack">
          {/* The full Player Hub lives here now - all of it, where its height costs nothing. */}
          <PlayerHub career={career} />
          {career.seasonHistory.length > 0 && (
            <section className="card-flat">
              <div className="kicker" style={{ marginBottom: 10 }}>
                הקריירה עד כה
              </div>
              <Timeline history={career.seasonHistory.slice(-14)} />
            </section>
          )}
        </div>
      </Sheet>

      <Celebration achievements={career.lastAchievements} progression={career.lastProgression} />
      {import.meta.env.DEV && <DebugPanel career={career} onChange={actions.overrideCareer} />}
    </div>
  );
}

/**
 * Where in the season we are. Deliberately a strip rather than navigation - it tells the
 * player the year has a shape without adding anything to click.
 */
function SeasonProgress({ career }: { career: Career }): JSX.Element {
  const steps = seasonPhaseSteps(career);
  const current = steps.find((step) => step.current);

  return (
    <div className="season-progress" aria-label={`שלב בעונה: ${current?.label ?? ''}`}>
      {steps.map((step) => (
        <div
          key={step.key}
          className={`season-step${step.current ? ' is-current' : ''}${step.done ? ' is-done' : ''}`}
        >
          <span className="season-step-dot" aria-hidden />
          <span className="season-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Identifies one resolved event, so the reveal plays once per outcome rather than replaying on
 * every re-render. Keyed on the event and the season it happened in - an event can legitimately
 * recur in a later season and should animate again then.
 */
function revealKey(career: Career): string {
  const result = career.lastEventResult;
  return result ? `${result.season}:${result.eventId}:${result.outcomeId}` : '';
}

function PhaseView({ career, actions }: { career: Career; actions: GameActions }): JSX.Element {
  const [revealed, setRevealed] = useState<string[]>([]);

  switch (career.phase) {
    case 'origin':
      return <OriginReveal career={career} onContinue={actions.continueOrigin} />;

    case 'retrial':
      return <RetrialCard career={career} onContinue={actions.continueRetrial} />;

    case 'event': {
      if (career.lastEventResult) {
        const odds = career.lastEventResult.odds ?? [];
        /*
         * The engine has already resolved this outcome from the seeded stream. The reveal only
         * delays showing it, so it cannot affect the result - and a save made mid-reveal resumes
         * on the outcome card, not on the animation.
         */
        if (odds.length >= 2 && !revealed.includes(revealKey(career))) {
          return (
            <OutcomeReveal
              outcomes={odds}
              onDone={() => setRevealed((seen) => [...seen, revealKey(career)])}
            />
          );
        }
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
      return (
        <DecisionCard
          career={career}
          event={event}
          onChoose={(choiceId) => actions.answer(eventId, choiceId)}
        />
      );
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
          /* Through the identity module, so it reads as the club rather than as a club id. */
          fromClub={clubDisplayName(career.currentClubId)}
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

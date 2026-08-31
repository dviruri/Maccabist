import { useState } from 'react';

import { CareerTimeline } from '../components/CareerTimeline';
import { CareerHomeScene } from '../components/CareerHome';
import { MatchdayExperience } from '../components/Matchday';
import { buildMatchday } from '../game/matchdayPresenter';
import {
  CareerMomentScreen,
  deriveArrivalMoment,
  deriveDebutMoment,
  deriveSeasonMoments,
} from '../components/CareerMoments';
import { LeagueTableCard } from '../components/LeagueTableCard';
import { SeasonStrip } from '../components/SeasonStrip';
import { EuropeCard } from '../components/EuropeCards';
import { EuropeStandings } from '../components/EuropeStandings';
import { JourneyTimeline } from '../components/JourneyTimeline';
import { CareerJourney } from '../components/SeasonCardV2';
import { Sheet } from '../components/Sheet';
import { PeopleCard } from '../components/PeopleCard';
import { LegacyCard } from '../components/LegacyCard';
import { Celebration } from '../components/Celebration';
import { DebugPanel } from '../components/DebugPanel';
import { DecisionCard, OutcomeReveal } from '../components/DecisionCard';
import { OutcomeCard } from '../components/EventCard';
import { DecisionScreen } from '../components/DecisionScreen';
import { OriginReveal, RetrialCard } from '../components/OriginReveal';
import { PlayerHub } from '../components/PlayerHub';
import {
  MidSeasonCard,
  ProgressionCard,
  SeasonResultCard,
  YouthTransitionCard,
} from '../components/SeasonCards';
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
type SheetId = 'table' | 'timeline' | 'history' | 'people' | 'legacy' | 'europe' | null;

/** Phases where a choice or reveal owns the screen - the home collapses to its compact hero. */
const FOCUSED_PHASES: ReadonlySet<Career['phase']> = new Set([
  'origin',
  'retrial',
  'event',
  'progression',
  'youth_to_senior',
  'offseason',
  'retirement_decision',
] as Career['phase'][]);

export function GamePage({ career, actions, onExit }: Props): JSX.Element {
  const [sheet, setSheet] = useState<SheetId>(null);
  const [matchdaysSeen, setMatchdaysSeen] = useState<string[]>([]);
  const [ceremoniesSeen, setCeremoniesSeen] = useState<string[]>([]);
  const close = (): void => setSheet(null);

  const table = currentTable(career);
  const league = table ? getLeague(table.leagueId) : null;

  /*
   * MATCHDAY IS ITS OWN SCREEN (v0.9.1, Phase 2).
   *
   * v0.9 rendered it inside the scrolling career page, so pressing שריקת פתיחה left the hero,
   * the feed and the league card sitting above and below the match - the player never felt he
   * had gone anywhere. This returns BEFORE the shell: no topbar, no home scene, no nav, no
   * sheets. The match owns the viewport until full time, then hands back.
   *
   * It is a screen state rather than a route because the app has no router; the state is keyed
   * by the fixture id, so a save mid-match resumes into the same match, and finishing it moves
   * the career on exactly as the phase flow did before.
   */
  /*
   * v0.9.1: arrival and debut ceremonies. Both are full-screen and both fire once - the arrival
   * at the first preseason after a move, the debut off the milestone the engine stamps when it
   * decides the debut itself. Keyed like every other reveal, so a reload lands past them.
   */
  const ceremony = deriveArrivalMoment(career) ?? deriveDebutMoment(career);
  if (ceremony && !ceremoniesSeen.includes(ceremony.key)) {
    return (
      <div className="gf-moment-screen">
        <CareerMomentScreen
          moment={ceremony}
          onContinue={() => setCeremoniesSeen((seen) => [...seen, ceremony.key])}
        />
      </div>
    );
  }

  /*
   * v0.9.2: the matchday screen serves two beats - the mid-season league match, and the domestic
   * cup final at settlement, which `activeFixture` only makes active at the final beat. The
   * final therefore plays after the league season and before the ceremonies below.
   */
  const matchday =
    career.phase === 'mid_season' || career.phase === 'season_result' ? buildMatchday(career) : null;
  if (matchday && !matchdaysSeen.includes(matchday.fixture.id)) {
    return (
      <MatchdayExperience
        career={career}
        matchday={matchday}
        onContinue={() => setMatchdaysSeen((seen) => [...seen, matchday.fixture.id])}
      />
    );
  }

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
      {/*
        v0.9: the cinematic career home. Full scene - hero, next chapter, feed - while the
        player is between decisions; collapsed to the compact hero the moment an event or
        choice is active, so the meta never pushes the decision below the fold (the v0.4.7
        lesson, kept). CompactHub's information lives on in the hero; the full PlayerHub still
        opens from the same tap.
      */}
      <CareerHomeScene
        career={career}
        focused={FOCUSED_PHASES.has(career.phase)}
        onOpenCareer={() => setSheet('history')}
      />
      <SeasonStrip career={career} onOpenTable={() => setSheet('table')} />

      {/*
        v0.8: the season's European situation, when there is one. Qualifying is summer football,
        so by the time the league starts this card can tell the whole summer story - including
        where each defeat dropped us - and state the autumn honestly.
      */}
      <EuropeCard career={career} onOpenStandings={() => setSheet('europe')} />

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
      {/*
        v0.9.1: a fixed bottom bar, mobile-first, from the concept. Five destinations - the
        existing sheets, not new ones - with the active state obvious, RTL order preserved by
        the document direction, and safe-area inset honoured so it clears a phone's home bar.
        `play-nav-spacer` below keeps page content from sitting underneath it.
      */}
      <nav className="gf-bottomnav" aria-label="ניווט">
        {table && (
          <button
            type="button"
            className={`gf-bn-btn${sheet === 'table' ? ' gf-bn-active' : ''}`}
            aria-current={sheet === 'table' ? 'page' : undefined}
            onClick={() => setSheet(sheet === 'table' ? null : 'table')}
          >
            <span className="gf-bn-icon" aria-hidden>▦</span>
            <span className="gf-bn-label">טבלה</span>
          </button>
        )}
        <button
          type="button"
          className={`gf-bn-btn${sheet === 'timeline' ? ' gf-bn-active' : ''}`}
          aria-current={sheet === 'timeline' ? 'page' : undefined}
          onClick={() => setSheet(sheet === 'timeline' ? null : 'timeline')}
        >
          <span className="gf-bn-icon" aria-hidden>◈</span>
          <span className="gf-bn-label">הסיפור</span>
        </button>
        <button
          type="button"
          className={`gf-bn-btn${sheet === null ? ' gf-bn-active' : ''}`}
          aria-current={sheet === null ? 'page' : undefined}
          onClick={() => setSheet(null)}
        >
          <span className="gf-bn-icon" aria-hidden>⌂</span>
          <span className="gf-bn-label">בית</span>
        </button>
        <button
          type="button"
          className={`gf-bn-btn${sheet === 'history' ? ' gf-bn-active' : ''}`}
          aria-current={sheet === 'history' ? 'page' : undefined}
          onClick={() => setSheet(sheet === 'history' ? null : 'history')}
        >
          <span className="gf-bn-icon" aria-hidden>≡</span>
          <span className="gf-bn-label">הקריירה</span>
        </button>
        <button
          type="button"
          className={`gf-bn-btn${sheet === 'people' || sheet === 'legacy' ? ' gf-bn-active' : ''}`}
          aria-current={sheet === 'people' ? 'page' : undefined}
          onClick={() => setSheet(sheet === 'people' ? 'legacy' : 'people')}
        >
          <span className="gf-bn-icon" aria-hidden>☗</span>
          <span className="gf-bn-label">מועדון</span>
        </button>
      </nav>
      <div className="gf-bottomnav-spacer" aria-hidden />

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

      {/* v0.5, Phase 27: the people screen - one tap away, never above the active event. */}
      {/* v0.9.1: the 36-club league-phase tables, one tap from the Europe card. */}
      <Sheet open={sheet === 'europe'} title="שלב הליגה באירופה" onClose={close}>
        <EuropeStandings career={career} />
      </Sheet>

      <Sheet open={sheet === 'people'} title="האנשים שלי" onClose={close}>
        <PeopleCard career={career} />
      </Sheet>

      {/* v0.6, Phase 31: Maccabi Legacy - the record book, one tap away like everything else. */}
      <Sheet open={sheet === 'legacy'} title="מורשת מכבי" onClose={close}>
        <LegacyCard career={career} />
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
              {/*
                v0.7 (D5): the journey, not the spreadsheet. Season Cards v2 with era breaks at
                every club change - the same card the archive renders, so the live career and
                the archived one tell the story identically.
              */}
              <JourneyTimeline seasons={career.seasonHistory} honors={career.honors} />
              <CareerJourney
                seasons={career.seasonHistory.slice(-14)}
                position={career.position}
                honors={career.honors}
              />
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
              /*
                The resolved outcome (v0.4.8). The engine picked it before this component mounted;
                the reveal now locks onto it instead of stopping on whichever label the reel
                happened to be showing.
              */
              resolvedOutcomeId={career.lastEventResult.outcomeId}
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
      /*
       * v0.9.1: the matchday itself is handled above as its own full screen. By the time this
       * renders the match has been played (or there was none to play - academy halves and
       * table-less levels), so this is the half summary and its continue into the engine.
       */
      return <MidSeasonCard career={career} onContinue={actions.continueMidSeason} />;

    case 'season_result': {
      /*
       * v0.9: the season's big moments interrupt BEFORE the numbers - a championship must not
       * look like another card. Each real moment (typed trophy, stored journey, the world's own
       * relegation) shows once via the same revealed-keys mechanism as the event reel; the
       * summary then follows with its own continue into the engine.
       */
      const moments = deriveSeasonMoments(career);
      const pending = moments.find((moment) => !revealed.includes(moment.key));
      if (pending) {
        return (
          <CareerMomentScreen
            moment={pending}
            onContinue={() => setRevealed((seen) => [...seen, pending.key])}
          />
        );
      }
      return <SeasonResultCard career={career} onContinue={actions.continueSeason} />;
    }

    case 'progression':
      return <ProgressionCard career={career} onContinue={actions.continueProgression} />;

    case 'youth_to_senior':
      return <YouthTransitionCard career={career} onChoose={actions.chooseYouthPath} />;

    case 'offseason':
      /*
       * v0.9: the full-screen career decision replaces the offer list. Same offers, same
       * accept/decline semantics - the presentation is the only thing that changed. The
       * academy-band flows (youth_to_senior) keep their own card: that fork has its own
       * dedicated ceremony already.
       */
      return (
        <DecisionScreen
          career={career}
          offers={career.pendingOffers}
          onAccept={actions.takeOffer}
          onDecline={actions.refuseOffers}
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

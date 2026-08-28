import { useEffect, useMemo, useRef, useState } from 'react';

import {
  calculateOutcomeDistribution,
  consequenceHints,
  hasHighUpside,
  RISK_LABELS,
} from '../game/decisionEngine';
import { CHOICE_RISK_LABELS } from '../ui/format';
import { currentTeamDisplay } from '../game/identity';
import { playerLeague } from '../game/worldEngine';
import { eventVisual, isMatchMoment, maccabiPresentation, matchMinute } from '../ui/eventVisuals';
import { currentLeagueContext } from '../game/leagueEngine';
import { matchContext, requirementOf } from '../game/matchEngine';
import { AmbientNewsHeader, MaccabiBanner, SamiOferHeader } from './MaccabiCards';
import { Ltr } from './primitives';
import type {
  Career,
  DecisionDistribution,
  DecisionOutcomeView,
  GameEvent,
  MatchContext,
  OutcomeValence,
} from '../types';

/**
 * The decision screen (v0.4.1).
 *
 * The player sees what can happen and how likely each result is, then commits. The percentages
 * come from `calculateOutcomeDistribution` - the same function the resolver uses - so nothing
 * here computes a probability. React renders the engine's numbers and nothing more.
 *
 * The reveal animation is presentation only. By the time it starts, the engine has already
 * resolved the outcome from the seeded stream; the animation just delays *showing* it. That is
 * what keeps careers reproducible: the animation cannot influence the result, and turning it off
 * changes nothing but the wait.
 */

const VALENCE_ICON: Record<OutcomeValence, string> = {
  majorPositive: '🟢',
  positive: '🟢',
  neutral: '⚪',
  negative: '🔴',
  majorNegative: '🔴',
};

/* ------------------------------------------------------------------ */
/* Outcome preview                                                     */
/* ------------------------------------------------------------------ */

function OutcomeList({ distribution }: { distribution: DecisionDistribution }): JSX.Element | null {
  if (distribution.outcomes.length < 2) return null;

  // Most likely first: the player is scanning for "what probably happens".
  const sorted = [...distribution.outcomes].sort((a, b) => b.percent - a.percent);

  return (
    <ul className="odds">
      {sorted.map((outcome) => (
        <li key={outcome.id} className={`odds-row valence-${outcome.valence}`}>
          <span className="odds-icon" aria-hidden>
            {VALENCE_ICON[outcome.valence]}
          </span>
          <span className="odds-label">{outcome.label}</span>
          <span className="odds-percent">{outcome.percent}%</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A stacked bar of the outcome split, ordered good -> neutral -> bad.
 *
 * Deliberately not colour-only: the segments carry a title and the detailed list underneath names
 * every outcome with its percentage, so nothing is communicated by hue alone.
 */
function OddsBar({ distribution }: { distribution: DecisionDistribution }): JSX.Element | null {
  if (distribution.outcomes.length < 2) return null;

  const order: OutcomeValence[] = [
    'majorPositive',
    'positive',
    'neutral',
    'negative',
    'majorNegative',
  ];
  const segments = order
    .map((valence) => ({
      valence,
      percent: distribution.outcomes
        .filter((o) => o.valence === valence)
        .reduce((sum, o) => sum + o.percent, 0),
    }))
    .filter((segment) => segment.percent > 0);

  return (
    <div className="odds-bar" role="img" aria-label={ariaFor(distribution)}>
      {segments.map((segment) => (
        <span
          key={segment.valence}
          className={`odds-seg valence-${segment.valence}`}
          style={{ width: `${segment.percent}%` }}
        />
      ))}
    </div>
  );
}

function ariaFor(distribution: DecisionDistribution): string {
  return distribution.outcomes.map((o) => `${o.label} ${o.percent}%`).join(', ');
}

interface ChoiceBlockProps {
  career: Career;
  event: GameEvent;
  choiceIndex: number;
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  disabled: boolean;
}

function ChoiceBlock({
  career,
  event,
  choiceIndex,
  expanded,
  onToggle,
  onChoose,
  disabled,
}: ChoiceBlockProps): JSX.Element {
  const choice = event.choices[choiceIndex]!;
  const distribution = useMemo(
    () => calculateOutcomeDistribution(career, event, choice, career.seasonSlot),
    [career, event, choice],
  );
  const hints = useMemo(() => consequenceHints(distribution, choice), [distribution, choice]);
  const probabilistic = distribution.outcomes.length >= 2;

  return (
    <div className={`choice-block risk-${choice.risk ?? 'balanced'}`}>
      <button
        type="button"
        className="btn btn-choice"
        onClick={onChoose}
        disabled={disabled}
      >
        <span>{choice.label}</span>
        <span className="hint">
          {probabilistic
            ? RISK_LABELS[distribution.risk]
            : (choice.hint ?? (choice.risk ? CHOICE_RISK_LABELS[choice.risk] : ''))}
          {probabilistic && hasHighUpside(distribution) ? ' · פוטנציאל גבוה' : ''}
        </span>
      </button>

      {probabilistic && (
        <>
          {/*
            An at-a-glance split, always visible. The detailed percentages are collapsed because
            four choices with four outcomes each is an unreadable wall on a 360px phone — but the
            player has to be able to *compare* choices without expanding every one, and a risk
            label alone does not let him do that. The bar is the comparison; the list is the detail.
          */}
          <OddsBar distribution={distribution} />

          <button type="button" className="odds-toggle" onClick={onToggle} disabled={disabled}>
            {expanded ? 'הסתר סיכויים' : 'הצג סיכויים'}
          </button>
          {expanded && (
            <>
              <OutcomeList distribution={distribution} />
              {hints.length > 0 && (
                <ul className="odds-hints">
                  {hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Match moment                                                        */
/* ------------------------------------------------------------------ */

/**
 * A scoreboard strip above a match-moment event.
 *
 * Shows only what is genuinely known: the minute, the player's own club, and the competition. The
 * engine does not simulate fixtures, so there is no opponent and no score to show — inventing
 * either would be the game telling the player something untrue, which is exactly the trust
 * problem the last two versions were about. What it *can* honestly do is make the moment feel
 * like it is happening in a match rather than in a paragraph.
 */
function MatchStrip({ career, event }: { career: Career; event: GameEvent }): JSX.Element {
  const minute = matchMinute(event);
  const team = currentTeamDisplay(career);
  const league = playerLeague(career);
  /*
   * v0.4.6: there is now a real fixture behind the moment.
   *
   * The strip used to name the player's own club and the league and stop there, which meant a
   * "biggest match of the season" was being played against nobody in particular. The opponent,
   * both table positions and the gap between them come from `matchContext`, so a match that
   * looks like a decider is one - and a match that is not one cannot be dressed as it.
   */
  const match = matchContext(career, undefined, requirementOf(event));
  const own = currentLeagueContext(career);

  return (
    <div className="match-strip">
      <div className="match-minute">
        <Ltr>{minute ?? '—'}</Ltr>
        <span aria-hidden>׳</span>
      </div>
      <div className="match-teams">
        <div className="match-home">
          {team.club}
          {own && (
            <span className="match-pos">
              {' · מקום '}
              <Ltr>{own.position}</Ltr>
            </span>
          )}
        </div>
        {match ? (
          <div className="match-away">
            {match.opponentName}
            {match.opponentPosition !== null && (
              <span className="match-pos">
                {' · מקום '}
                <Ltr>{match.opponentPosition}</Ltr>
              </span>
            )}
          </div>
        ) : (
          <div className="match-comp">{league.name}</div>
        )}
        {match && <MatchStakes match={match} /> }
      </div>
    </div>
  );
}

/**
 * Why this fixture matters, in one line.
 *
 * Only ever states what the context supports. The label and the gap are the same fact the event
 * was gated on, so a player reading "3 נקודות מפרידות ביניהן" is reading the number that decided
 * he was allowed to see this event at all.
 */
function MatchStakes({ match }: { match: MatchContext }): JSX.Element | null {
  const label = match.titleDecider
    ? 'משחק על האליפות'
    : match.promotionDecider
      ? 'משחק על העלייה'
      : match.relegationSixPointer
        ? 'קרב תחתית'
        : match.isDerby
          ? (match.rivalryName ?? 'דרבי')
          : match.rivalryName;

  if (!label && match.pointsGap === null) return null;

  return (
    <div className="match-stakes">
      {label && <span className="match-stakes-label">{label}</span>}
      {match.pointsGap !== null && match.pointsGap <= 8 && (
        <span className="match-gap">
          <Ltr>{match.pointsGap}</Ltr> נקודות מפרידות ביניהן
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

interface DecisionCardProps {
  career: Career;
  event: GameEvent;
  onChoose: (choiceId: string) => void;
}

export function DecisionCard({ career, event, onChoose }: DecisionCardProps): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  const visual = eventVisual(event, career);
  const asMatch = isMatchMoment(event, career);
  const maccabi = maccabiPresentation(event, career);

  return (
    <article
      className={`card event-card variant-${visual.variant} importance-${visual.importance}`}
    >
      <div className="stack">
        {/*
          A header strip that says what kind of moment this is. Events used to be
          indistinguishable from each other; the variant changes the accent, the icon and this
          label without becoming a different layout.
        */}
        <div className="event-head">
          <span className="event-head-icon" aria-hidden>
            {visual.icon}
          </span>
          <span className="event-head-label">{visual.label}</span>
          {visual.importance === 'major' && <span className="event-head-flag">רגע גדול</span>}
        </div>

        {/*
          Maccabi gets its own header (v0.4.5.1). Sami Ofer and news-from-home are distinct enough
          moments to deserve their own framing; everything else about the club gets the "מהבית"
          band so it cannot read as a message from the current club.
        */}
        {maccabi === 'sami_ofer' && <SamiOferHeader career={career} />}
        {maccabi === 'ambient_news' && <AmbientNewsHeader career={career} />}
        {maccabi === 'relationship' && <MaccabiBanner career={career} />}

        {asMatch && maccabi !== 'sami_ofer' && <MatchStrip career={career} event={event} />}

        {event.kicker && <div className="kicker">{event.kicker}</div>}
        <h2 className="card-title">{event.title}</h2>
        <p className="card-body">{event.description}</p>

        <div className="stack-sm" style={{ marginTop: 4 }}>
          {event.choices.map((choice, index) => (
            <ChoiceBlock
              key={choice.id}
              career={career}
              event={event}
              choiceIndex={index}
              expanded={expanded === choice.id}
              onToggle={() => setExpanded(expanded === choice.id ? null : choice.id)}
              onChoose={() => {
                if (committed) return;
                setCommitted(choice.id);
                onChoose(choice.id);
              }}
              disabled={committed !== null && committed !== choice.id}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal                                                             */
/* ------------------------------------------------------------------ */

/** Roughly how long the cycle runs before locking in. Short - this happens a lot. */
const REVEAL_MS = 1200;
const TICK_MS = 110;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Cycles through the outcomes that *were* possible, then settles on the one the engine already
 * chose.
 *
 * `resolvedId` is decided before this component mounts. Nothing here draws, rolls or randomises
 * anything that touches game state - the cycling order is cosmetic. Reduced-motion users skip
 * straight to the result.
 */
export function OutcomeReveal({
  outcomes,
  onDone,
}: {
  outcomes: DecisionOutcomeView[];
  onDone: () => void;
}): JSX.Element | null {
  const [index, setIndex] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (outcomes.length < 2 || prefersReducedMotion()) {
      onDone();
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed >= REVEAL_MS) {
        if (!done.current) {
          done.current = true;
          window.clearInterval(timer);
          onDone();
        }
        return;
      }
      setIndex((current) => current + 1);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [outcomes.length, onDone]);

  if (outcomes.length < 2) return null;
  const showing = outcomes[index % outcomes.length]!;

  return (
    <article className="card reveal-card">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="kicker">רגע…</div>
        <div className={`reveal-slot valence-${showing.valence}`} aria-live="polite">
          <span aria-hidden>{VALENCE_ICON[showing.valence]}</span> {showing.label}
        </div>
        <div className="reveal-bar">
          <span />
        </div>
      </div>
    </article>
  );
}

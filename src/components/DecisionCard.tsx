import { useEffect, useMemo, useRef, useState } from 'react';

import {
  calculateOutcomeDistribution,
  consequenceHints,
  hasHighUpside,
  RISK_LABELS,
} from '../game/decisionEngine';
import { CHOICE_RISK_LABELS } from '../ui/format';
import type {
  Career,
  DecisionDistribution,
  DecisionOutcomeView,
  GameEvent,
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
            Collapsed by default. Four choices with four outcomes each is an unreadable wall on a
            360px phone, and the risk label on the button is enough to choose by; the breakdown is
            there for a player who wants to weigh it properly.
          */}
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

  return (
    <article className="card event-card">
      <div className="stack">
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

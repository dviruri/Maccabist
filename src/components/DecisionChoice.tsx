import type { ReactNode } from 'react';

import { FACT_ICON, type ChoiceFact, type OutcomeSummary } from '../ui/decisionView';

/**
 * The career decision language (v0.9.5).
 *
 * Every decision in the game - a transfer, an event, the step out of the youth setup, the end of
 * the career - now reads the same way:
 *
 *   CONTEXT      what kind of moment this is, and what just happened
 *   DILEMMA      the question, as one line the player can answer
 *   CHOICES      each future as a card he can press
 *   CONSEQUENCE  what that future is made of, in facts the engine actually has
 *
 * ## The card IS the action
 *
 * That is the whole change. Before this, every decision ended in a pair of generic buttons under
 * a block of information: the screen told you things, and then separately asked you to press
 * ACCEPT or DECLINE. The player had to hold the information in his head and map it onto a verb.
 *
 * Here the choice carries its own consequences, and pressing it commits. There is no confirmation
 * step, because the card already said what pressing it does - a second dialog asking "are you
 * sure" would only be necessary if the first one had not.
 *
 * ## What a card may say
 *
 * Only what the game models. A fact on a card comes from a `TransferOffer` field, from career
 * state, or from `consequenceHints` - never from a sentence that sounds plausible. There is no
 * salary, no contract length, no guaranteed appearances and no invented percentage anywhere in
 * this file, and `tests/decisionLanguage.test.ts` checks the words rather than trusting the
 * intent.
 *
 * Percentages appear only where `calculateOutcomeDistribution` produced them, and only as its own
 * numbers regrouped (see `ui/decisionView.ts`). A choice with a single outcome shows its authored
 * hint and no odds at all, because it has no odds.
 */

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

/**
 * The frame a decision lives in.
 *
 * Four regions, and exactly one of them is allowed to move:
 *
 *   head     the question. NEVER scrolls, never gives way.
 *   context  everything that elaborates on it. Scrolls when there is not enough room.
 *   choices  the futures. NEVER scroll off; the decision is always reachable.
 *   footer   paging, when there is more than one offer.
 *
 * The head being pinned is not a detail, it is the product requirement. The first build put the
 * headline inside the scrolling region, and at 320x568 an offer rendered as a crest and two cards
 * with the question scrolled out of sight - the player could see what he was choosing between and
 * not what he was choosing about. A screen that can hide its own question is not a decision
 * screen, so the question is now structurally incapable of scrolling away.
 */
export function DecisionScene({
  head,
  context,
  choices,
  footer,
  className,
}: {
  head: ReactNode;
  context?: ReactNode;
  choices: ReactNode;
  footer?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`dc-scene${className ? ` ${className}` : ''}`}>
      <div className="dc-scene-head">{head}</div>
      {context && <div className="dc-scene-context">{context}</div>}
      <div className="dc-scene-choices">{choices}</div>
      {footer && <div className="dc-scene-footer">{footer}</div>}
    </div>
  );
}

/**
 * The question, stated once and stated large.
 *
 * `media` sets the scene, `kicker` says what kind of moment this is, `title` says what happened.
 * Nothing else belongs here - this region is pinned, so everything added to it is height taken
 * permanently from the choices. Prose, opinions and elaboration go in the scene's context.
 */
export function DecisionHead({
  kicker,
  title,
  media,
}: {
  kicker?: string;
  /**
   * A node, not a string, so a headline containing a NUMBER can bidi-isolate it. "אתה בן 35. כמה
   * עוד נשאר?" is Hebrew with a Latin-digit run in the middle, and the surrounding period can
   * migrate to the wrong side of the digits without an isolate.
   */
  title: ReactNode;
  media?: ReactNode;
}): JSX.Element {
  return (
    <div className="dc-context">
      {media}
      {kicker && <div className="dc-kicker">{kicker}</div>}
      <h1 className="dc-title">{title}</h1>
    </div>
  );
}

/**
 * How many choices sit side by side.
 *
 * Two comparable choices read best as a pair, and four read best as a grid - but only while the
 * Hebrew stays legible. The decision is handed to CSS (`dc-choices-2`, `dc-choices-4`) rather
 * than made here, because it depends on the viewport and not on the count alone: the same two
 * cards are a row at 390px and a stack at 320px. Nothing shrinks type to fit; a narrow screen
 * stacks instead.
 */
export function DecisionChoices({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}): JSX.Element {
  return <div className={`dc-choices dc-choices-${Math.min(count, 4)}`}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* The choice card                                                     */
/* ------------------------------------------------------------------ */

export interface DecisionChoiceCardProps {
  /** What pressing this does, phrased as the action. Never "accept". */
  title: string;
  /** One short line under the title - where he is going, or what he is choosing. */
  subtitle?: string;
  /** A crest, a badge, an emoji. Optional; the title carries the meaning. */
  icon?: ReactNode;
  /** At most three, from the engine. Rendered in order. */
  facts?: readonly ChoiceFact[];
  /** The engine's own percentages, regrouped. Absent when the choice is not probabilistic. */
  odds?: OutcomeSummary | null;
  /** A qualitative line shown when there are no odds - the choice's authored hint or risk band. */
  note?: string;
  onChoose: () => void;
  /** Pressed. Locks the card and marks it as the one taken. */
  selected?: boolean;
  /** Another card was pressed, or the choice is not available. */
  disabled?: boolean;
  /** Opens the details for THIS choice. Rendered as a footer link, outside the card's own press. */
  onDetails?: () => void;
  detailsLabel?: string;
  /** Visual weight. `quiet` is the stay-put side of a dilemma, not a lesser option. */
  tone?: 'default' | 'quiet';
}

/**
 * One future, as a pressable object.
 *
 * A `<button>` and not a div with a handler: it has to be reachable by keyboard and announced as
 * an action, and the whole surface is the target rather than a small control inside it. The one
 * thing that is NOT part of that target is `onDetails`, which is a separate button rendered
 * after it - nesting a button inside a button is invalid HTML and, worse, makes reading the
 * details indistinguishable from committing to the choice.
 */
export function DecisionChoiceCard({
  title,
  subtitle,
  icon,
  facts,
  odds,
  note,
  onChoose,
  selected = false,
  disabled = false,
  onDetails,
  detailsLabel = 'מה יכול לקרות?',
  tone = 'default',
}: DecisionChoiceCardProps): JSX.Element {
  return (
    <div
      className={`dc-choice-wrap${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <button
        type="button"
        className={`dc-choice dc-choice-${tone}`}
        onClick={onChoose}
        disabled={disabled || selected}
        aria-pressed={selected}
      >
        <span className="dc-choice-head">
          {icon && (
            <span className="dc-choice-icon" aria-hidden>
              {icon}
            </span>
          )}
          <span className="dc-choice-titles">
            <span className="dc-choice-title">{title}</span>
            {subtitle && <span className="dc-choice-sub">{subtitle}</span>}
          </span>
        </span>

        {facts && facts.length > 0 && (
          <span className="dc-facts">
            {facts.map((fact, i) => (
              <span key={`${fact.text}-${i}`} className={`dc-fact is-${fact.tone}`}>
                <span className="dc-fact-icon" aria-hidden>
                  {FACT_ICON[fact.tone]}
                </span>
                <span className="dc-fact-text">{fact.text}</span>
              </span>
            ))}
          </span>
        )}

        {/*
          The odds, when the engine has them. Three figures, not five - and never drawn for a
          choice whose distribution has one outcome, which is what `odds == null` means.
        */}
        {odds ? <OddsStrip odds={odds} /> : note ? <span className="dc-choice-note">{note}</span> : null}
      </button>

      {onDetails && (
        <button type="button" className="dc-choice-details" onClick={onDetails} disabled={disabled}>
          {detailsLabel}
        </button>
      )}
    </div>
  );
}

/**
 * The good / nothing / bad split, as a bar and three figures.
 *
 * Not colour alone: each figure carries a screen-reader label, and the exact per-outcome
 * percentages live in the details sheet. Zero-width segments are dropped so a 100/0/0 choice
 * does not render two invisible slivers with labels attached.
 */
function OddsStrip({ odds }: { odds: OutcomeSummary }): JSX.Element {
  const rows = [
    { key: 'good', tone: 'positive' as const, label: 'סיכוי טוב', percent: odds.good },
    { key: 'flat', tone: 'neutral' as const, label: 'ללא שינוי', percent: odds.flat },
    { key: 'bad', tone: 'negative' as const, label: 'סיכון', percent: odds.bad },
  ].filter((row) => row.percent > 0);

  return (
    <span className="dc-odds">
      <span
        className="dc-odds-bar"
        role="img"
        aria-label={rows.map((row) => `${row.label} ${row.percent}%`).join(', ')}
      >
        {rows.map((row) => (
          <span key={row.key} className={`dc-odds-seg is-${row.tone}`} style={{ width: `${row.percent}%` }} />
        ))}
      </span>
      <span className="dc-odds-figures">
        {rows.map((row) => (
          <span key={row.key} className={`dc-odds-figure is-${row.tone}`}>
            <span aria-hidden>{FACT_ICON[row.tone]}</span>
            {/*
              The percentage is a number in Hebrew text, so it is isolated: without this the
              browser's bidi algorithm can move the % sign to the wrong side of the digits.
            */}
            <bdi className="dc-odds-pct">{row.percent}%</bdi>
            <span className="sr-only">{row.label}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

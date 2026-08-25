import type { CareerEventResult, GameEvent } from '../types';
import { RISK_LABELS } from '../ui/format';
import { DeltaList } from './primitives';

interface EventCardProps {
  event: GameEvent;
  onChoose: (choiceId: string) => void;
}

/**
 * The decision. Choices carry a qualitative hint at most - never a percentage, because the
 * player should be weighing a judgement call, not solving an equation.
 */
export function EventCard({ event, onChoose }: EventCardProps): JSX.Element {
  return (
    <article className="card event-card">
      <div className="stack">
        {event.kicker && <div className="kicker">{event.kicker}</div>}
        <h2 className="card-title">{event.title}</h2>
        <p className="card-body">{event.description}</p>

        <div className="stack-sm" style={{ marginTop: 4 }}>
          {event.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={`btn btn-choice risk-${choice.risk ?? 'balanced'}`}
              onClick={() => onChoose(choice.id)}
            >
              <span>{choice.label}</span>
              <span className="hint">
                {choice.hint ?? (choice.risk ? RISK_LABELS[choice.risk] : '')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

interface OutcomeCardProps {
  result: CareerEventResult;
  onContinue: () => void;
  continueLabel: string;
}

/**
 * The outcome, deliberately shown on its own screen. Story first, numbers underneath - the
 * same choice can land here very differently in another career.
 */
export function OutcomeCard({ result, onContinue, continueLabel }: OutcomeCardProps): JSX.Element {
  return (
    <article className="card">
      <div className="stack">
        <div className={`outcome outcome-${result.tone}`}>
          <div className="choice-echo">בחרת: {result.choiceLabel}</div>
          <p className="outcome-text">{result.outcomeText}</p>
        </div>

        <DeltaList deltas={result.deltas} />

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </article>
  );
}

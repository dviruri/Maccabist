import type { CareerEventResult, GameEvent } from '../types';
import { DeltaList } from './primitives';

interface EventCardProps {
  event: GameEvent;
  onChoose: (choiceId: string) => void;
}

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
              className="btn btn-choice"
              onClick={() => onChoose(choice.id)}
            >
              <span>{choice.label}</span>
              {choice.hint && <span className="hint">{choice.hint}</span>}
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

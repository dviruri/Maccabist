/**
 * The outcome screen. The decision screen moved to DecisionCard in v0.4.1, which shows the real
 * odds before the player commits; this file is now only the result.
 */
import type { CareerEventResult } from '../types';
import { DeltaList } from './primitives';

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

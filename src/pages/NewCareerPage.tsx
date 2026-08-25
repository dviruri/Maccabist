import { useState } from 'react';

import { BrandRule } from '../components/primitives';
import { POSITION_LIST } from '../game/balance';
import type { NewCareerInput } from '../game/careerEngine';
import type { Position } from '../types';

interface Props {
  onCreate: (input: NewCareerInput) => void;
  onBack: () => void;
}

export function NewCareerPage({ onCreate, onBack }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('CM');

  const selected = POSITION_LIST.find((p) => p.id === position);

  return (
    <div className="shell narrow" style={{ paddingTop: 34 }}>
      <div className="stack">
        <BrandRule />
        <div className="kicker">קריירה חדשה</div>
        <h1 style={{ fontSize: 34 }}>מי אתה, ילד?</h1>
        <p className="card-body">
          אתה בן 9. בעוד שבוע האימון הראשון שלך במגרשי האימונים של מכבי חיפה.
        </p>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <div className="stack-sm">
          <label className="field-label" htmlFor="player-name">
            השם שלך
          </label>
          <input
            id="player-name"
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="איך יקראו לך ביציע?"
            maxLength={24}
            autoComplete="off"
          />
        </div>

        <div className="stack-sm" style={{ marginTop: 8 }}>
          <span className="field-label">העמדה שלך</span>
          <div className="position-grid">
            {POSITION_LIST.map((config) => (
              <button
                key={config.id}
                type="button"
                className="position-btn"
                aria-pressed={position === config.id}
                onClick={() => setPosition(config.id)}
              >
                <span className="emoji" aria-hidden>
                  {config.icon}
                </span>
                {config.label}
              </button>
            ))}
          </div>
          {selected && <p className="faint">{selected.description}</p>}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          onClick={() => onCreate({ playerName: name, position })}
        >
          לחתום במחלקת הילדים
        </button>

        <button type="button" className="btn btn-ghost" onClick={onBack}>
          חזרה
        </button>
      </div>
    </div>
  );
}

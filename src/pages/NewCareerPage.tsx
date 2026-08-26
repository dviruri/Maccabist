import { useState } from 'react';

import { PitchSelector } from '../components/PitchSelector';
import { BrandRule, Ltr } from '../components/primitives';
import { BIRTH_COHORT, FIRST_ACADEMY_SEASON } from '../game/balance';
import type { NewCareerInput } from '../game/careerEngine';
import type { Position } from '../types';
import { seasonLabel } from '../ui/format';

interface Props {
  onCreate: (input: NewCareerInput) => void;
  onBack: () => void;
}

const MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/** Days available for a month, so 31 February cannot be chosen. */
function daysInMonth(month: number): number {
  if (month === 2) return 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Name, date of birth, position. Deliberately nothing else - traits and potential are the
 * game's business, and a character sheet at nine years old would give the story away.
 */
export function NewCareerPage({ onCreate, onBack }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('CM');
  const [month, setMonth] = useState(6);
  const [day, setDay] = useState(15);

  const maxDay = daysInMonth(month);
  const safeDay = Math.min(day, maxDay);

  return (
    <div className="shell narrow" style={{ paddingTop: 30, paddingBottom: 40 }}>
      <div className="stack">
        <BrandRule />
        <div className="kicker">קריירה חדשה</div>
        <h1 style={{ fontSize: 32 }}>מי אתה, ילד?</h1>
        <p className="card-body">
          נולדת ב-<Ltr>{BIRTH_COHORT}</Ltr>, כמו כל השנתון שלך. עונת{' '}
          <Ltr>{seasonLabel(FIRST_ACADEMY_SEASON)}</Ltr> מתחילה - והמבחנים של מכבי חיפה
          מתחילים איתה.
        </p>
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        {/* ---------- name ---------- */}
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

        {/* ---------- date of birth ---------- */}
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <span className="field-label">תאריך הלידה שלך</span>
          <div className="dob-row">
            <div className="dob-field">
              <label className="dob-hint" htmlFor="dob-day">
                יום
              </label>
              <select
                id="dob-day"
                value={safeDay}
                onChange={(event) => setDay(Number(event.target.value))}
              >
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="dob-field">
              <label className="dob-hint" htmlFor="dob-month">
                חודש
              </label>
              <select
                id="dob-month"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
              >
                {MONTHS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="dob-locked">
              <span className="dob-hint">שנה</span>
              <div className="dob-locked-value" aria-label={`שנת הלידה ${BIRTH_COHORT}, קבועה`}>
                <span aria-hidden>🔒</span>
                <Ltr>{BIRTH_COHORT}</Ltr>
              </div>
            </div>
          </div>
          <p className="dob-hint">
            כל השנתון נולד ב-<Ltr>{BIRTH_COHORT}</Ltr> ומתקדם יחד. החודש קובע אם אתה מהבוגרים
            או מהצעירים בקבוצה - וזה מרגיש בגילים הצעירים.
          </p>
        </div>

        {/* ---------- position ---------- */}
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <span className="field-label">איפה אתה משחק?</span>
          <PitchSelector value={position} onChange={setPosition} />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() =>
            onCreate({ playerName: name, position, birthDay: safeDay, birthMonth: month })
          }
        >
          לצאת למבחנים
        </button>

        <button type="button" className="btn btn-ghost" onClick={onBack}>
          חזרה
        </button>
      </div>
    </div>
  );
}

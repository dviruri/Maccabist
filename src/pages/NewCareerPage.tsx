import { useState } from 'react';

import { PitchSelector } from '../components/PitchSelector';
import { BrandRule, Ltr } from '../components/primitives';
import { BIRTH_COHORT, FIRST_ACADEMY_SEASON, POSITIONS } from '../game/balance';
import { daysInMonth } from '../game/calendar';
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

/** What the engine calls a player who never gave a name. Shown so it is not a silent surprise. */
const FALLBACK_NAME = 'מכביסט';

/*
 * Day count comes from the shared calendar module, so the picker and the engine agree on what
 * a real date is. 2021 is not a leap year, so February offers 28 days - not 29.
 */

/**
 * Name, date of birth, position. Deliberately nothing else - traits and potential are the
 * game's business, and a character sheet at nine years old would give the story away.
 *
 * v0.4.5.1 rebuilds the screen as three numbered steps rather than a stack of form fields. Same
 * three inputs, but the framing matters: this is the only screen in the game where the player
 * makes something rather than choosing between things that happen to him, and it should read as
 * character creation, not as a signup form. The strip at the bottom reads back the boy he has
 * just described, so he leaves for the trials knowing who he is.
 */
export function NewCareerPage({ onCreate, onBack }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('CM');
  const [month, setMonth] = useState(6);
  const [day, setDay] = useState(15);

  const maxDay = daysInMonth(month, BIRTH_COHORT);
  const safeDay = Math.min(day, maxDay);

  const trimmed = name.trim();
  const finalName = trimmed || FALLBACK_NAME;

  return (
    <div className="shell narrow nc-page">
      <header className="nc-hero">
        <BrandRule />
        <div className="kicker">קריירה חדשה</div>
        <h1 className="nc-title">מי אתה, ילד?</h1>
        <p className="nc-intro">
          נולדת ב-<Ltr>{BIRTH_COHORT}</Ltr>, כמו כל השנתון שלך. עונת{' '}
          <Ltr>{seasonLabel(FIRST_ACADEMY_SEASON)}</Ltr> מתחילה - והמבחנים של מכבי חיפה מתחילים
          איתה.
        </p>
      </header>

      {/* ---------- 1 · name ---------- */}
      <Step index={1} label="השם שלך">
        <input
          id="player-name"
          className="text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="איך יקראו לך ביציע?"
          maxLength={24}
          autoComplete="off"
        />
        {/*
          The engine already falls back to מכביסט for an empty name. Saying so beats letting the
          player discover it on the next screen.
        */}
        {!trimmed && <p className="nc-hint">אם תשאיר ריק, יקראו לך {FALLBACK_NAME}.</p>}
      </Step>

      {/* ---------- 2 · date of birth ---------- */}
      <Step index={2} label="תאריך הלידה שלך">
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
        <p className="nc-hint">
          כל השנתון נולד ב-<Ltr>{BIRTH_COHORT}</Ltr> ומתקדם יחד. החודש קובע אם אתה מהבוגרים או
          מהצעירים בקבוצה - וזה מרגיש בגילים הצעירים.
        </p>
      </Step>

      {/* ---------- 3 · position ---------- */}
      <Step index={3} label="איפה אתה משחק?">
        <PitchSelector value={position} onChange={setPosition} />
      </Step>

      {/*
        Read back the boy he just described, in one line, before he goes. The name is the final
        name rather than the raw input, so the fallback is never a surprise.
      */}
      <div className="nc-summary" aria-live="polite">
        <span className="nc-summary-name">{finalName}</span>
        <span className="nc-summary-meta">
          {POSITIONS[position].label} · <Ltr>{safeDay}</Ltr> ב{MONTHS[month - 1]}{' '}
          <Ltr>{BIRTH_COHORT}</Ltr>
        </span>
      </div>

      <div className="nc-actions">
        <button
          type="button"
          className="btn btn-primary"
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

/**
 * One numbered step.
 *
 * The number is decorative - there is no gating and no wizard, because a three-field screen that
 * makes you press "next" twice is worse than a three-field screen. It exists to say "there are
 * three things here, and this is the first", which a bare stack of labels does not.
 */
function Step({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="nc-step">
      <div className="nc-step-head">
        <span className="nc-step-num" aria-hidden>
          {index}
        </span>
        <h2 className="nc-step-label">{label}</h2>
      </div>
      {children}
    </section>
  );
}

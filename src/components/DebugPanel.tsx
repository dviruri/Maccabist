import { useEffect, useState } from 'react';

import { EVENTS } from '../data/events';
import { autoStep, retire } from '../game/careerEngine';
import { simulateBatch } from '../game/simulate';
import { cloneCareer } from '../game/progressionEngine';
import { statusFromValue } from '../game/rules';
import type { Career } from '../types';

/**
 * Development-only tooling. Vite strips this in production builds because the whole
 * component is behind `import.meta.env.DEV` at the call site.
 */
export function DebugPanel({
  career,
  onChange,
}: {
  career: Career;
  onChange: (next: Career) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  /* Console utilities: window.maccabist.* */
  useEffect(() => {
    const api = {
      career,
      set: onChange,
      autoStep: () => onChange(autoStep(career)),
      run: (seasons = 5) => {
        let next = career;
        for (let i = 0; i < seasons * 6 && !next.retired; i += 1) next = autoStep(next);
        onChange(next);
      },
      retire: () => onChange(retire(career)),
      simulate: (count = 200) => simulateBatch(count, { playerName: 'sim', position: career.position }),
      events: EVENTS.map((e) => e.id),
    };
    (window as unknown as Record<string, unknown>).maccabist = api;
  }, [career, onChange]);

  const bump = (patch: Partial<Career>): void => {
    const next = cloneCareer(career);
    Object.assign(next, patch);
    next.status = statusFromValue(next.statusValue);
    onChange(next);
  };

  return (
    <div className="debug">
      <button type="button" className="debug-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '✕ debug' : '⚙ debug'}
      </button>

      {open && (
        <div className="debug-panel">
          <Row label="phase" value={career.phase} />
          <Row label="age" value={career.age} />
          <Row label="season" value={career.currentSeason} />
          <Row label="club" value={career.currentClubId} />
          <Row label="ability" value={career.ability.toFixed(1)} />
          <Row label="potential" value={career.hidden.potential.toFixed(0)} />
          <Row label="peak" value={career.peakAbility.toFixed(1)} />
          <Row label="maccabism" value={career.maccabism.toFixed(1)} />
          <Row label="reputation" value={career.reputation.toFixed(1)} />
          <Row label="status" value={`${career.statusValue.toFixed(0)} ${career.status}`} />
          <Row label="form" value={career.hidden.form.toFixed(0)} />
          <Row label="confidence" value={career.hidden.confidence.toFixed(0)} />
          <Row label="injuryRisk" value={career.hidden.injuryRisk.toFixed(0)} />
          <Row label="captain" value={String(career.captain)} />
          <Row label="maccabi apps" value={career.maccabi.appearances} />
          <Row label="seed" value={career.seed} />

          <div className="debug-actions">
            <button type="button" onClick={() => onChange(autoStep(career))}>
              step
            </button>
            <button
              type="button"
              onClick={() => {
                let next = career;
                for (let i = 0; i < 8 && !next.retired; i += 1) next = autoStep(next);
                onChange(next);
              }}
            >
              +season
            </button>
            <button type="button" onClick={() => bump({ age: career.age + 1 })}>
              age +1
            </button>
            <button type="button" onClick={() => bump({ ability: Math.min(100, career.ability + 10) })}>
              ability +10
            </button>
            <button
              type="button"
              onClick={() => bump({ statusValue: Math.min(100, career.statusValue + 15) })}
            >
              status +15
            </button>
            <button
              type="button"
              onClick={() => bump({ maccabism: Math.min(100, career.maccabism + 15) })}
            >
              maccabism +15
            </button>
            <button
              type="button"
              onClick={() => bump({ reputation: Math.min(100, career.reputation + 15) })}
            >
              rep +15
            </button>
            <button type="button" onClick={() => onChange(retire(career))}>
              retire
            </button>
          </div>
          <p className="faint" style={{ marginTop: 8 }}>
            גם ב־console: <code>window.maccabist</code>
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="debug-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

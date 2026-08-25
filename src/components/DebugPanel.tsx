import { useEffect, useState } from 'react';

import { STAGE_LADDER, stageLabel } from '../data/academy';
import { EVENTS_BY_ID, EVENT_POOL } from '../data/events';
import { autoStep, retire } from '../game/careerEngine';
import { conditionContext } from '../game/eventEngine';
import { outcomeProbabilities } from '../game/outcomeEngine';
import { cloneCareer } from '../game/progressionEngine';
import { promotionScore } from '../game/progressionEngine';
import { createRng } from '../game/random';
import { roleFromValue } from '../game/rules';
import { simulateBatch } from '../game/simulate';
import type { AcademyStage, Career } from '../types';

/**
 * Development-only tooling. The call site guards it behind `import.meta.env.DEV`, so Vite
 * drops the whole component from production builds.
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
        for (let i = 0; i < seasons * 8 && !next.retired; i += 1) next = autoStep(next);
        onChange(next);
      },
      retire: () => onChange(retire(career)),
      simulate: (count = 500) =>
        simulateBatch(count, { playerName: 'sim', position: career.position }),
      /** Outcome odds for the event on screen - the numbers the player never sees. */
      odds: () => debugOdds(career),
      events: EVENT_POOL.map((e) => e.id),
      forceEvent: (eventId: string) => {
        const next = cloneCareer(career);
        next.pendingEventIds = [eventId];
        next.phase = 'event';
        next.lastEventResult = null;
        onChange(next);
      },
      forceStage: (stage: AcademyStage) => {
        const next = cloneCareer(career);
        next.academyStage = stage;
        next.seasonsAtStage = 0;
        onChange(next);
      },
    };
    (window as unknown as Record<string, unknown>).maccabist = api;
  }, [career, onChange]);

  const patch = (changes: Partial<Career>): void => {
    const next = cloneCareer(career);
    Object.assign(next, changes);
    next.role = roleFromValue(next.roleValue);
    onChange(next);
  };

  const patchHidden = (changes: Partial<Career['hidden']>): void => {
    const next = cloneCareer(career);
    next.hidden = { ...next.hidden, ...changes };
    onChange(next);
  };

  const odds = debugOdds(career);
  const rng = createRng(career.rngState);

  return (
    <div className="debug">
      <button type="button" className="debug-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '✕ debug' : '⚙ debug'}
      </button>

      {open && (
        <div className="debug-panel">
          <Row label="seed" value={career.seed} />
          <Row label="phase" value={`${career.phase} / ${career.seasonSlot}`} />
          <Row label="age" value={career.age} />
          <Row label="season" value={career.currentSeason} />
          <Row label="academyStage" value={`${career.academyStage} (${stageLabel(career.academyStage)})`} />
          <Row label="seasonsAtStage" value={career.seasonsAtStage} />
          <Row label="olderGroup" value={career.olderGroup} />
          <Row label="club" value={career.currentClubId} />
          <Row label="ability" value={career.ability.toFixed(1)} />
          <Row label="potential" value={career.hidden.potential.toFixed(0)} />
          <Row label="peak" value={career.peakAbility.toFixed(1)} />
          <Row label="coachTrust" value={career.coachTrust.toFixed(1)} />
          <Row label="role" value={`${career.roleValue.toFixed(0)} ${career.role}`} />
          <Row label="form" value={career.hidden.form.toFixed(0)} />
          <Row label="confidence" value={career.hidden.confidence.toFixed(0)} />
          <Row label="discipline" value={career.hidden.discipline.toFixed(0)} />
          <Row label="injuryRisk" value={career.hidden.injuryRisk.toFixed(0)} />
          <Row label="maccabism" value={career.maccabism.toFixed(1)} />
          <Row label="reputation" value={career.reputation.toFixed(1)} />
          <Row label="promotionScore" value={promotionScore(career, 60, rng).toFixed(1)} />
          <Row label="maccabi apps" value={career.maccabi.appearances} />
          <Row label="flags" value={career.flags.join(',') || '—'} />

          {odds && (
            <div className="debug-odds">
              <div className="debug-odds-title">{odds.title}</div>
              {odds.choices.map((choice) => (
                <div key={choice.id}>
                  <div className="debug-odds-choice">{choice.label}</div>
                  {choice.outcomes.map((o) => (
                    <div key={o.id} className="debug-row">
                      <span>{o.id}</span>
                      <b>{(o.probability * 100).toFixed(1)}%</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="debug-actions">
            <button type="button" onClick={() => onChange(autoStep(career))}>
              step
            </button>
            <button
              type="button"
              onClick={() => {
                let next = career;
                for (let i = 0; i < 3 && !next.retired; i += 1) next = autoStep(next);
                onChange(next);
              }}
            >
              +half
            </button>
            <button
              type="button"
              onClick={() => {
                let next = career;
                const target = next.currentSeason + 1;
                for (let i = 0; i < 24 && !next.retired && next.currentSeason < target; i += 1) {
                  next = autoStep(next);
                }
                onChange(next);
              }}
            >
              +season
            </button>
            <button type="button" onClick={() => patch({ age: career.age + 1 })}>
              age +1
            </button>
            <button type="button" onClick={() => patch({ ability: Math.min(100, career.ability + 10) })}>
              ability +10
            </button>
            <button
              type="button"
              onClick={() => patch({ coachTrust: Math.min(100, career.coachTrust + 15) })}
            >
              trust +15
            </button>
            <button
              type="button"
              onClick={() => patch({ coachTrust: Math.max(0, career.coachTrust - 15) })}
            >
              trust -15
            </button>
            <button
              type="button"
              onClick={() => patch({ roleValue: Math.min(100, career.roleValue + 15) })}
            >
              role +15
            </button>
            <button type="button" onClick={() => patchHidden({ form: 90 })}>
              form 90
            </button>
            <button type="button" onClick={() => patchHidden({ potential: 95 })}>
              potential 95
            </button>
            <button type="button" onClick={() => patch({ olderGroup: 'playing' })}>
              play up
            </button>
            <button type="button" onClick={() => onChange(retire(career))}>
              retire
            </button>
          </div>

          <div className="debug-actions">
            {STAGE_LADDER.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => patch({ academyStage: stage, seasonsAtStage: 0 })}
              >
                {stageLabel(stage)}
              </button>
            ))}
          </div>

          <p className="faint" style={{ marginTop: 8 }}>
            גם ב־console: <code>window.maccabist</code>
          </p>
        </div>
      )}
    </div>
  );
}

interface DebugOdds {
  title: string;
  choices: { id: string; label: string; outcomes: { id: string; probability: number }[] }[];
}

/** Exact outcome probabilities for the event on screen. Debug only - never shown in game. */
function debugOdds(career: Career): DebugOdds | null {
  const eventId = career.pendingEventIds[0];
  if (!eventId || career.lastEventResult) return null;
  const event = EVENTS_BY_ID[eventId];
  if (!event) return null;

  const ctx = conditionContext(career, career.seasonSlot);
  return {
    title: event.title,
    choices: event.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      outcomes: outcomeProbabilities(choice.outcomes, career, ctx),
    })),
  };
}

function Row({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="debug-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

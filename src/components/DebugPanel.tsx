import { useEffect, useState } from 'react';

import { STAGE_LADDER, stageAfter, stageLabel } from '../data/academy';
import { getClub, MACCABI_ACADEMY_ID } from '../data/clubs';
import { EVENTS_BY_ID, EVENT_POOL } from '../data/events';
import { autoStep, retire } from '../game/careerEngine';
import { cohortLead, isPlayingUpACohort, naturalStage, relativeAgeBonus } from '../game/cohort';
import { matchesClubScope } from '../game/conditions';
import { validateCareerIntegrity } from '../game/integrity';
import {
  appearanceBreakdown,
  cupWins,
  leagueTitles,
  MACCABI_RELEVANCE_REASONS,
} from '../game/truth';
import { conditionContext } from '../game/eventEngine';
import { eligibleForRetrial, resolveRetrial } from '../game/originEngine';
import { recordMemory, seniorPhase, startArc } from '../game/memory';
import { outcomeProbabilities } from '../game/outcomeEngine';
import {
  cloneCareer,
  coachTrustBaseline,
  moveToClub,
  driftTrustTowardsBaseline,
  maybeChangeCoach,
  promotionScore,
  revealTrait,
} from '../game/progressionEngine';
import { formatBugReport } from '../game/bugReport';
import { createRng } from '../game/random';
import { isInAcademy, roleFromValue } from '../game/rules';
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

  const [copied, setCopied] = useState(false);
  const copyReport = (): void => {
    const text = formatBugReport(career);
    // Clipboard access can be blocked; the console copy is the fallback that always works.
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    // eslint-disable-next-line no-console
    console.log(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="debug">
      <button type="button" className="debug-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '✕ debug' : '⚙ debug'}
      </button>

      {open && (
        <div className="debug-panel">
          {/*
            v0.4.1: a reproducible bug report. Every coherence bug so far arrived as a sentence and
            then took a diagnostic script to locate; the state needed to reproduce one was always
            in the Career and simply unreachable from the game. Debug-only, so it never clutters
            normal play.
          */}
          <button type="button" className="debug-report" onClick={copyReport}>
            {copied ? '✓ הועתק' : '🐞 דווח על אירוע לא הגיוני'}
          </button>

          {/*
            Career integrity (v0.4.8, Phase 21). Every fact this career holds, checked against
            every other one. Development only.
          */}
          <IntegrityBlock career={career} />

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
          <Row label="leadership" value={career.hidden.leadership.toFixed(0)} />
          <Row label="promotionScore" value={promotionScore(career, 60, rng).toFixed(1)} />
          <Row label="maccabi apps" value={career.maccabi.appearances} />
          <Row label="flags" value={career.flags.join(',') || '—'} />

          {/* ---- v0.3.1: cohort, origin, club context ---- */}
          <Row
            label="dateOfBirth"
            value={`${career.dateOfBirth.day}.${career.dateOfBirth.month}.${career.dateOfBirth.year}`}
          />
          <Row label="birthCohort" value={career.birthCohort} />
          <Row label="seasonPoint" value={career.seasonPoint} />
          <Row
            label="naturalStage"
            value={`${naturalStage(career)} (${stageLabel(naturalStage(career))})`}
          />
          <Row label="currentStage" value={`${career.academyStage} (${stageLabel(career.academyStage)})`} />
          <Row label="cohortLead" value={cohortLead(career)} />
          <Row label="playingUp" value={isPlayingUpACohort(career) ? 'yes' : 'no'} />
          <Row label="relativeAge" value={relativeAgeBonus(career).toFixed(2)} />
          <Row label="origin" value={career.origin} />
          <Row
            label="trials"
            value={
              career.trials.length === 0
                ? '—'
                : career.trials.map((t) => `#${t.attempt}@${t.season}:${t.accepted ? 'in' : 'out'}`).join(' ')
            }
          />
          <Row label="retrialEligible" value={eligibleForRetrial(career) ? 'yes' : 'no'} />
          <Row label="club" value={`${career.currentClubId} (${getClub(career.currentClubId).name})`} />
          <Row
            label="clubScope"
            value={(['maccabi', 'nonMaccabi', 'abroad', 'formerMaccabi'] as const)
              .filter((s) => matchesClubScope(career, s))
              .join(',')}
          />

          {/* ---- v0.3: what the career remembers ---- */}
          <Row label="seniorPhase" value={isInAcademy(career) ? '—' : seniorPhase(career)} />
          <Row label="trustBaseline" value={coachTrustBaseline(career).toFixed(1)} />
          <Row label="newCoach" value={career.newCoachThisSeason ? 'yes' : 'no'} />
          <Row
            label="traits"
            value={
              career.traits.map((t) => `${t.id}${t.revealed ? '' : '(hidden)'}`).join(',') || '—'
            }
          />
          <Row
            label="active arcs"
            value={career.arcs.map((a) => `${a.id}:${a.stage}/${a.branch}`).join(' ') || '—'}
          />
          <Row label="done arcs" value={career.completedArcs.join(',') || '—'} />
          <Row
            label="memories"
            value={
              career.memories.length === 0
                ? '—'
                : career.memories
                    .slice(-6)
                    .map((m) => `${m.kind}@${m.season}`)
                    .join(' ')
            }
          />
          <Row
            label="milestones"
            value={
              career.milestones.length === 0
                ? '—'
                : `${career.milestones.length} (${career.milestones.slice(-2).map((m) => m.id).join(', ')})`
            }
          />

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

          {/* ---- v0.3: drive the story systems directly ---- */}
          <div className="debug-actions">
            <button
              type="button"
              title="force a coach change and the trust reset that comes with it"
              onClick={() => {
                const changed = maybeChangeCoach(career, createRng(Date.now() >>> 0));
                onChange({
                  ...driftTrustTowardsBaseline(changed.career, 0.65),
                  newCoachThisSeason: true,
                });
              }}
            >
              new coach
            </button>
            <button
              type="button"
              title="drop out of the eleven, to test recovery"
              onClick={() =>
                onChange({
                  ...career,
                  roleValue: 24,
                  role: 'squad',
                  coachTrust: 22,
                  memories: recordMemory(career, 'lost_starting_role'),
                })
              }
            >
              force role loss
            </button>
            <button
              type="button"
              title="reveal every trait this career has"
              onClick={() => {
                let next = career;
                for (const trait of career.traits) next = revealTrait(next, trait.id);
                onChange(next);
              }}
            >
              reveal traits
            </button>
            <button type="button" onClick={() => patchHidden({ leadership: 85 })}>
              leadership 85
            </button>
            {(['coach_relationship', 'older_group', 'injury_comeback', 'position_battle'] as const).map(
              (arc) => (
                <button
                  key={arc}
                  type="button"
                  title={`start the ${arc} arc`}
                  onClick={() => onChange({ ...career, arcs: startArc(career, arc, 'default') })}
                >
                  arc: {arc.replace(/_/g, ' ')}
                </button>
              ),
            )}
            {/* ---- v0.3.1: origin and club context ---- */}
            <button
              type="button"
              title="force the next repeat trial to be accepted"
              onClick={() => {
                const outcome = resolveRetrial(career, createRng(1));
                onChange({
                  ...outcome.career,
                  currentClubId: MACCABI_ACADEMY_ID,
                  trials: [
                    ...career.trials,
                    { ...outcome.trial, accepted: true, title: 'מכבי חיפה רוצה אותך' },
                  ],
                  phase: 'retrial',
                });
              }}
            >
              trial: accept
            </button>
            <button
              type="button"
              title="force the next repeat trial to be rejected"
              onClick={() => {
                const outcome = resolveRetrial(career, createRng(2));
                onChange({
                  ...career,
                  trials: [...career.trials, { ...outcome.trial, accepted: false, title: 'שוב לא' }],
                  phase: 'retrial',
                });
              }}
            >
              trial: reject
            </button>
            <button
              type="button"
              title="move to another Israeli club, to check club-context filtering"
              onClick={() => onChange(moveToClub(career, 'hapoel_hadera'))}
            >
              leave Maccabi
            </button>
            <button
              type="button"
              title="push up a cohort"
              onClick={() =>
                patch({ academyStage: stageAfter(career.academyStage, 1), olderGroup: 'playing' })
              }
            >
              force playing up
            </button>
            {(['major_injury', 'penalty_miss', 'older_group_failure', 'released_by_maccabi'] as const).map(
              (kind) => (
                <button
                  key={kind}
                  type="button"
                  title={`record the ${kind} memory so callbacks become eligible`}
                  onClick={() => onChange({ ...career, memories: recordMemory(career, kind) })}
                >
                  mem: {kind.replace(/_/g, ' ')}
                </button>
              ),
            )}
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
      outcomes: outcomeProbabilities(choice.outcomes, career, ctx, choice.risk),
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

/* ------------------------------------------------------------------ */
/* Career integrity (v0.4.8)                                           */
/* ------------------------------------------------------------------ */

/**
 * Does this career contradict itself?
 *
 * Lists violations by code with the detail line, so a strange screen can be traced to the fact
 * that disagrees rather than to a guess. Green when everything agrees, which is the normal state -
 * a scan of 1,500 simulated careers finds none.
 */
function IntegrityBlock({ career }: { career: Career }): JSX.Element {
  const violations = validateCareerIntegrity(career);
  const breakdown = appearanceBreakdown(career);

  return (
    <div className="debug-integrity">
      <div className={`debug-integrity-head ${violations.length === 0 ? 'is-ok' : 'is-bad'}`}>
        {violations.length === 0 ? '✅ career integrity' : `❌ ${violations.length} violations`}
      </div>

      {violations.map((v, i) => (
        <div key={`${v.code}-${i}`} className="debug-integrity-row">
          <b>{v.code}</b>
          {v.season !== undefined ? ` (${v.season})` : ''} — {v.detail}
        </div>
      ))}

      {/*
        The appearance equation, shown rather than merely asserted. If these ever fail to add up
        the number on the left will not equal the sum on the right, in front of whoever is looking.
      */}
      <Row
        label="apps senior"
        value={`${breakdown.total} = ${breakdown.maccabi} מכבי + ${breakdown.otherIsraeli} ישראל + ${breakdown.foreign} חו״ל`}
      />
      <Row label="apps youth" value={breakdown.youth} />
      <Row
        label="participation"
        value={
          career.seasonParticipation
            ? `${career.seasonParticipation.season}: ${career.seasonParticipation.appearances} apps, ${career.seasonParticipation.starts} starts${career.seasonParticipation.onFieldEventFired ? ', on-field event' : ''}`
            : 'none'
        }
      />
      <Row
        label="league titles"
        value={leagueTitles(career).map((t) => `${t.season} ${t.clubName}`).join(' | ') || 'none'}
      />
      <Row
        label="cups"
        value={cupWins(career).map((t) => `${t.season} ${t.clubName}`).join(' | ') || 'none'}
      />

      {/*
        Why Maccabism moved (Phase 24).

        The reported bug was the number changing for reasons that had nothing to do with Maccabi.
        The guard makes that impossible; this makes it checkable, by naming the cause and the
        relevance behind every recent change. `requested` and `applied` differ near the ceiling,
        where the headroom taper is doing its work - shown separately so the taper is visible
        rather than looking like a rounding error.
      */}
      <div className="debug-integrity-head">מכביסטיות — למה השתנתה</div>
      {(career.maccabismTrace ?? []).length === 0 ? (
        <div className="debug-integrity-row">לא השתנתה עדיין</div>
      ) : (
        [...(career.maccabismTrace ?? [])].reverse().map((t, i) => (
          <div key={`${t.source}-${t.season}-${i}`} className="debug-integrity-row">
            {t.season} <b>{t.source}</b> — {MACCABI_RELEVANCE_REASONS[t.relevance]} —{' '}
            {t.requested > 0 ? '+' : ''}
            {t.requested}
            {Math.abs(t.applied - t.requested) > 0.05 ? ` → ${t.applied.toFixed(1)}` : ''} ⇒{' '}
            {t.after.toFixed(1)}
          </div>
        ))
      )}
    </div>
  );
}

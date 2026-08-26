import { useState } from 'react';

import type { Career, Milestone } from '../types';
import { seasonLabel } from '../ui/format';
import { Ltr } from './primitives';

/**
 * ציר הזמן - the career told as a list of the moments that mattered.
 *
 * Reads straight off career.milestones, which the engine writes at the real story beats
 * (first appearance, an early promotion, a title, moving abroad, coming home, the armband).
 * Deliberately not every event: a timeline of forty training-ground conversations tells you
 * nothing.
 *
 * Collapsed by default so it never competes with the current decision.
 */
export function CareerTimeline({
  career,
  defaultOpen = false,
}: {
  career: Career;
  defaultOpen?: boolean;
}): JSX.Element | null {
  const [open, setOpen] = useState(defaultOpen);
  const milestones = career.milestones;
  if (milestones.length === 0) return null;

  const majorCount = milestones.filter((m) => m.major).length;

  return (
    <section className="card-flat timeline-panel">
      <button
        type="button"
        className="timeline-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="timeline-toggle-label">
          ציר הזמן
          <span className="timeline-count">
            <Ltr>{milestones.length}</Ltr> רגעים
            {majorCount > 0 && (
              <>
                {' · '}
                <Ltr>{majorCount}</Ltr> גדולים
              </>
            )}
          </span>
        </span>
        <span className="timeline-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <ol className="timeline-list">
          {milestones.map((milestone) => (
            <TimelineRow key={`${milestone.id}-${milestone.season}`} milestone={milestone} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineRow({ milestone }: { milestone: Milestone }): JSX.Element {
  return (
    <li className={`timeline-row${milestone.major ? ' is-major' : ''}`}>
      <span className="timeline-icon" aria-hidden>
        {milestone.icon}
      </span>
      <div className="timeline-body">
        <div className="timeline-season">
          <Ltr>{seasonLabel(milestone.season)}</Ltr>
          <span className="timeline-age">
            {' · גיל '}
            <Ltr>{milestone.age}</Ltr>
          </span>
        </div>
        <div className="timeline-text">{milestone.text}</div>
      </div>
    </li>
  );
}

import { useState } from 'react';

import { teamDisplayFor, teamDisplayLine } from '../game/identity';
import type { Career, Milestone } from '../types';
import { seasonLabel } from '../ui/format';
import { Ltr } from './primitives';

/**
 * סיפור הקריירה — the career told as the moments that mattered (v0.4.5.1).
 *
 * Reads straight off `career.milestones`, which the engine writes at the real story beats: the
 * first appearance, an early promotion, a title, moving abroad, coming home, the armband.
 * Deliberately not every event — a timeline of forty training-ground conversations tells you
 * nothing.
 *
 * v0.4.5.1 rebuilds it as an actual timeline rather than a list, and adds the thing that was
 * missing: **where he was at the time**. A milestone from 2035 belongs to the boy who was at
 * ילדים א׳ that season, not to the first-team player reading it twenty years later. The club and
 * stage are looked up from the season record for that year and rendered through the identity
 * module, so history keeps the wording that was true when it happened.
 */

/** Where the player was in a given season, from the record rather than from today's state. */
function eraFor(career: Career, season: number): string | null {
  const record = career.seasonHistory.find((s) => s.season === season);
  if (!record) return null;
  // `teamDisplayLine` is the module's own compact wording, loan spell included.
  return teamDisplayLine(teamDisplayFor(record.clubId, record.academyStage, record.onLoan));
}

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
          סיפור הקריירה
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
          {milestones.map((milestone, index) => {
            const era = eraFor(career, milestone.season);
            /*
             * Only print the era when it changed. Repeating "מכבי חיפה" down eleven rows adds
             * height and says nothing; printing it only on the rows where he actually moved turns
             * it into the signal it should be - you can see the shape of the career in the gaps.
             */
            const before = milestones[index - 1];
            const previous = before ? eraFor(career, before.season) : null;
            return (
              <TimelineRow
                key={`${milestone.id}-${milestone.season}`}
                milestone={milestone}
                era={era !== previous ? era : null}
                /* The spine should not run past the last node. */
                last={index === milestones.length - 1}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

function TimelineRow({
  milestone,
  era,
  last,
}: {
  milestone: Milestone;
  era: string | null;
  last: boolean;
}): JSX.Element {
  return (
    <li className={`tl-row${milestone.major ? ' is-major' : ''}${last ? ' is-last' : ''}`}>
      {/* The spine and node. Positioned on the inline-start edge, so RTL needs no mirroring. */}
      <div className="tl-spine" aria-hidden>
        <span className="tl-node">{milestone.icon}</span>
      </div>

      <div className="tl-body">
        <div className="tl-season">
          <Ltr>{seasonLabel(milestone.season)}</Ltr>
          <span className="tl-age">
            {' · גיל '}
            <Ltr>{milestone.age}</Ltr>
          </span>
        </div>
        <div className="tl-text">{milestone.text}</div>
        {/* Where he was that season - not where he is now. */}
        {era && <div className="tl-era">{era}</div>}
      </div>
    </li>
  );
}

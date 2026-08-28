import { useEffect, useState } from 'react';

import { ACHIEVEMENTS_BY_ID } from '../data/achievements';
import type { AcademyStage, Achievement, ProgressionResult } from '../types';
import { StageLadder } from './StageLadder';

interface CelebrationItem {
  key: string;
  icon: string;
  title: string;
  description: string;
  /**
   * Set only for an academy transition (v0.4.5.1). The moment then draws the step on the ladder
   * underneath the copy, so an early promotion reads as a jump rather than as a sentence.
   */
  ladder?: { from: AcademyStage; to: AcademyStage };
}

/**
 * Only genuinely meaningful milestones interrupt the flow: a jumped year, a band change,
 * a first senior contract, a major achievement. Everything else just lands in the list.
 */
export function Celebration({
  achievements,
  progression,
}: {
  achievements: Achievement[];
  progression?: ProgressionResult | null;
}): JSX.Element | null {
  const [queue, setQueue] = useState<CelebrationItem[]>([]);

  useEffect(() => {
    const items: CelebrationItem[] = [];

    // The academy ladder moment comes first - it is the headline of the season.
    if (progression?.major && progression.kind !== 'senior' && progression.kind !== 'released') {
      items.push({
        key: `prog-${progression.toStage}-${progression.kind}`,
        icon: progression.icon,
        title: progression.title,
        description: progression.detail,
        ladder: { from: progression.fromStage, to: progression.toStage },
      });
    }

    for (const a of achievements) {
      if (!ACHIEVEMENTS_BY_ID[a.id]?.major) continue;
      items.push({ key: `ach-${a.id}`, icon: a.icon, title: a.name, description: a.description });
    }

    setQueue(items);
  }, [achievements, progression]);

  const current = queue[0];
  if (!current) return null;

  const dismiss = (): void => setQueue((q) => q.slice(1));

  /*
   * A career moment (v0.4.5).
   *
   * The v0.4 version was a small green dialog box. This is the screen: full-bleed, poster
   * typography, floodlights behind it. These fire only for genuinely major beats — the queue
   * above is unchanged — so making them feel like an occasion costs nothing in pacing.
   *
   * Tap anywhere to continue, because a moment the player is enjoying should not require finding
   * a button, and one he has already read should take a single tap to clear.
   */
  return (
    <div className="moment" role="dialog" aria-live="polite" aria-modal="true" onClick={dismiss}>
      <div className="moment-lights" aria-hidden />
      <div className="moment-body">
        <div className="moment-icon" aria-hidden>
          {current.icon}
        </div>
        <h2 className="moment-title">{current.title}</h2>
        <p className="moment-desc">{current.description}</p>
        {current.ladder && (
          <StageLadder from={current.ladder.from} to={current.ladder.to} />
        )}
        {queue.length > 1 && (
          <div className="moment-count" aria-hidden>
            {queue.length - 1} עוד
          </div>
        )}
        <button type="button" className="btn btn-primary moment-btn" onClick={dismiss}>
          יאללה
        </button>
      </div>
    </div>
  );
}

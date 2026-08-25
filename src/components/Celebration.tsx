import { useEffect, useState } from 'react';

import { ACHIEVEMENTS_BY_ID } from '../data/achievements';
import type { Achievement } from '../types';

/**
 * Only genuinely meaningful milestones get the full-screen moment.
 * Everything else is simply added to the achievement list without interrupting the flow.
 */
export function Celebration({ achievements }: { achievements: Achievement[] }): JSX.Element | null {
  const [queue, setQueue] = useState<Achievement[]>([]);

  useEffect(() => {
    const major = achievements.filter((a) => ACHIEVEMENTS_BY_ID[a.id]?.major);
    setQueue(major);
  }, [achievements]);

  const current = queue[0];
  if (!current) return null;

  return (
    <div
      className="celebration"
      role="dialog"
      aria-live="polite"
      onClick={() => setQueue((q) => q.slice(1))}
    >
      <div className="celebration-card">
        <div className="celebration-icon" aria-hidden>
          {current.icon}
        </div>
        <div className="celebration-title">{current.name}</div>
        <div className="celebration-desc">{current.description}</div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 16 }}
          onClick={() => setQueue((q) => q.slice(1))}
        >
          יאללה
        </button>
      </div>
    </div>
  );
}

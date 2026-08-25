import { useEffect, useState } from 'react';

import { ACHIEVEMENTS_BY_ID } from '../data/achievements';
import type { Achievement, ProgressionResult } from '../types';

interface CelebrationItem {
  key: string;
  icon: string;
  title: string;
  description: string;
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

  return (
    <div className="celebration" role="dialog" aria-live="polite" onClick={dismiss}>
      <div className="celebration-card">
        <div className="celebration-icon" aria-hidden>
          {current.icon}
        </div>
        <div className="celebration-title">{current.title}</div>
        <div className="celebration-desc">{current.description}</div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={dismiss}>
          יאללה
        </button>
      </div>
    </div>
  );
}

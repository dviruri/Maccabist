import type { SeasonRecord } from '../types';
import { buildTimeline, countLabel, spellYears } from '../ui/format';
import { Ltr } from './primitives';

export function Timeline({ history }: { history: SeasonRecord[] }): JSX.Element | null {
  const spells = buildTimeline(history);
  if (spells.length === 0) return null;

  return (
    <div className="timeline">
      {spells.map((spell) => (
        <div key={spell.key} className={`timeline-item ${spell.isMaccabi ? 'is-maccabi' : ''}`}>
          <div className="timeline-years">
            <Ltr>{spellYears(spell)}</Ltr>
          </div>
          <div className="timeline-club">
            {spell.teamName}
            {spell.onLoan ? ' (השאלה)' : ''}
          </div>
          <div className="timeline-detail">
            {countLabel(spell.appearances, 'משחק אחד', 'משחקים')}
            {spell.goals > 0 ? ` · ${countLabel(spell.goals, 'שער אחד', 'שערים')}` : null}
            {spell.trophies > 0 ? ` · ${countLabel(spell.trophies, 'תואר אחד', 'תארים')} 🏆` : null}
          </div>
        </div>
      ))}
    </div>
  );
}

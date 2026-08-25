import type { SeasonRecord } from '../types';
import { buildTimeline, countLabel, spellYears } from '../ui/format';
import { Ltr } from './primitives';

export function Timeline({ history }: { history: SeasonRecord[] }): JSX.Element | null {
  const spells = buildTimeline(history);
  if (spells.length === 0) return null;

  return (
    <div className="timeline">
      {spells.map((spell, index) => (
        <div
          key={`${spell.clubId}-${spell.fromSeason}-${index}`}
          className={`timeline-item ${spell.isMaccabi ? 'is-maccabi' : ''}`}
        >
          <div className="timeline-years">
            <Ltr>{spellYears(spell)}</Ltr>
          </div>
          <div className="timeline-club">
            {spell.clubName}
            {spell.onLoan ? ' (השאלה)' : ''}
          </div>
          <div className="timeline-detail">
            {countLabel(spell.appearances, 'הופעה אחת', 'הופעות')}
            {spell.goals > 0 ? ` · ${countLabel(spell.goals, 'שער אחד', 'שערים')}` : null}
            {spell.trophies > 0 ? ` · ${countLabel(spell.trophies, 'תואר אחד', 'תארים')} 🏆` : null}
          </div>
        </div>
      ))}
    </div>
  );
}

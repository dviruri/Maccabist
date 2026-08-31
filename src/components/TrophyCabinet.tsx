import { useState } from 'react';

import { TROPHY_DEFS } from '../data/trophies';
import { HONOR_LABELS } from '../game/honorsEngine';
import type { IndividualHonor, IndividualHonorType, Trophy } from '../types';
import { seasonLabel } from '../ui/format';
import { HonorIcon, TrophyKindIcon, trophyIconKind, type TrophyIconKind } from './honorIcons';
import { Ltr } from './primitives';

/**
 * The Trophy Cabinet (v0.7, Checkpoint E).
 *
 * Derived from the typed trophy records and the stored honors list - never from narrative text,
 * table labels or achievement names. The icon semantics are the point: a league title shows a
 * championship PLATE, a cup shows a CUP, a promotion shows its own upward badge, and each
 * individual honor has its own mark. Grouped, counted, expandable to the seasons behind each.
 */

interface CabinetGroup {
  key: string;
  label: string;
  icon: JSX.Element;
  count: number;
  /** One line per win: season + context. */
  rows: { season: number; text: string }[];
}

function groupTrophies(trophies: readonly Trophy[]): CabinetGroup[] {
  const byId = new Map<string, Trophy[]>();
  for (const trophy of trophies) {
    byId.set(trophy.id, [...(byId.get(trophy.id) ?? []), trophy]);
  }
  // Cabinet order: plates first, cups, continental, youth. Prestige order, not insertion order.
  // v0.8: European trophies outrank domestic silverware in the cabinet's own hierarchy.
  const kindOrder: TrophyIconKind[] = ['ucl', 'uel', 'uecl', 'plate', 'cup', 'continental', 'youth'];
  return [...byId.entries()]
    .sort(
      (a, b) =>
        kindOrder.indexOf(trophyIconKind(a[0])) - kindOrder.indexOf(trophyIconKind(b[0])) ||
        b[1].length - a[1].length,
    )
    .map(([id, list]) => ({
      key: `trophy_${id}`,
      label: TROPHY_DEFS[id]?.name ?? id,
      icon: <TrophyKindIcon kind={trophyIconKind(id)} size={22} />,
      count: list.length,
      rows: list
        .slice()
        .sort((a, b) => a.season - b.season)
        .map((t) => ({ season: t.season, text: t.clubName })),
    }));
}

function groupHonors(honors: readonly IndividualHonor[]): CabinetGroup[] {
  const order: IndividualHonorType[] = [
    'player_of_season',
    'top_scorer',
    'assists_leader',
    'goalkeeper_of_season',
    'young_player_of_season',
  ];
  const byType = new Map<IndividualHonorType, IndividualHonor[]>();
  for (const honor of honors) {
    byType.set(honor.type, [...(byType.get(honor.type) ?? []), honor]);
  }
  return order
    .filter((type) => byType.has(type))
    .map((type) => ({
      key: `honor_${type}`,
      label: HONOR_LABELS[type],
      icon: <HonorIcon type={type} size={22} />,
      count: byType.get(type)!.length,
      rows: byType
        .get(type)!
        .slice()
        .sort((a, b) => a.season - b.season)
        .map((h) => ({
          season: h.season,
          text: `${h.league}${h.statValue !== undefined && (type === 'top_scorer' || type === 'assists_leader' || type === 'goalkeeper_of_season') ? ` · ${h.statValue}` : ''}`,
        })),
    }));
}

function CabinetItem({ group }: { group: CabinetGroup }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="cabinet-item">
      <button type="button" className="cabinet-item-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cabinet-icon" aria-hidden>
          {group.icon}
        </span>
        <span className="cabinet-label">{group.label}</span>
        <span className="cabinet-count">
          <Ltr>{group.count > 1 ? `×${group.count}` : ''}</Ltr>
        </span>
      </button>
      {open && (
        <ul className="cabinet-rows">
          {group.rows.map((row, i) => (
            <li key={i}>
              <Ltr>{seasonLabel(row.season)}</Ltr> — {row.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TrophyCabinet({
  trophies,
  honors,
  promotions = [],
}: {
  trophies: readonly Trophy[];
  honors: readonly IndividualHonor[];
  promotions?: readonly { season: number; detail?: string }[];
}): JSX.Element {
  const trophyGroups = groupTrophies(trophies);
  const honorGroups = groupHonors(honors);
  const promotionGroup: CabinetGroup | null =
    promotions.length > 0
      ? {
          key: 'promotions',
          label: 'עליות ליגה',
          icon: <TrophyKindIcon kind="promotion" size={22} />,
          count: promotions.length,
          rows: promotions
            .slice()
            .sort((a, b) => a.season - b.season)
            .map((p) => ({ season: p.season, text: p.detail ?? 'עלייה ליגה' })),
        }
      : null;

  if (trophyGroups.length === 0 && honorGroups.length === 0 && !promotionGroup) {
    return <p className="card-body cabinet-empty">הארון עוד ריק. זה מה שהופך את הראשון למתוק.</p>;
  }

  return (
    <div className="cabinet">
      {trophyGroups.length > 0 && (
        <section>
          <div className="kicker cabinet-kicker">תארים קבוצתיים</div>
          {trophyGroups.map((g) => (
            <CabinetItem key={g.key} group={g} />
          ))}
        </section>
      )}
      {promotionGroup && (
        <section>
          <div className="kicker cabinet-kicker">עליות ליגה</div>
          <CabinetItem group={promotionGroup} />
        </section>
      )}
      {honorGroups.length > 0 && (
        <section>
          <div className="kicker cabinet-kicker">תארים אישיים</div>
          {honorGroups.map((g) => (
            <CabinetItem key={g.key} group={g} />
          ))}
        </section>
      )}
    </div>
  );
}

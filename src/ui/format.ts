/** Presentation helpers. UI-only - the engine never imports this. */

import { getClub } from '../data/clubs';
import { POSITIONS, STAGE_LABELS, STATUS_ICONS, STATUS_LABELS } from '../game/balance';
import { stageForAge } from '../game/rules';
import type { Career, PlayerStatus, Position, SeasonRecord } from '../types';

export function positionLabel(position: Position): string {
  return POSITIONS[position].label;
}

export function positionIcon(position: Position): string {
  return POSITIONS[position].icon;
}

export function statusText(status: PlayerStatus): string {
  return STATUS_LABELS[status];
}

export function statusIcon(status: PlayerStatus): string {
  return STATUS_ICONS[status];
}

export function stageLabel(age: number): string {
  return STAGE_LABELS[stageForAge(age)];
}

/** 2038 -> "2037/38" — how a season is actually written on a shirt. */
export function seasonLabel(season: number): string {
  const start = season - 1;
  return `${start}/${String(season).slice(-2)}`;
}

export function clubName(clubId: string): string {
  return getClub(clubId).name;
}

export function shortClubName(clubId: string): string {
  const club = getClub(clubId);
  return club.shortName ?? club.name;
}

/** Consecutive seasons at the same club, collapsed into one timeline entry. */
export interface CareerSpell {
  clubId: string;
  clubName: string;
  fromSeason: number;
  toSeason: number;
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  onLoan: boolean;
  isMaccabi: boolean;
}

export function buildTimeline(history: SeasonRecord[]): CareerSpell[] {
  const spells: CareerSpell[] = [];

  for (const record of history) {
    const last = spells[spells.length - 1];
    if (last && last.clubId === record.clubId && last.onLoan === record.onLoan) {
      last.toSeason = record.season;
      last.appearances += record.stats.appearances;
      last.goals += record.stats.goals;
      last.assists += record.stats.assists;
      last.trophies += record.trophies.length;
      continue;
    }
    spells.push({
      clubId: record.clubId,
      clubName: record.clubName,
      fromSeason: record.season,
      toSeason: record.season,
      appearances: record.stats.appearances,
      goals: record.stats.goals,
      assists: record.stats.assists,
      trophies: record.trophies.length,
      onLoan: record.onLoan,
      isMaccabi: getClub(record.clubId).isMaccabi === true,
    });
  }

  return spells;
}

export function spellYears(spell: CareerSpell): string {
  return spell.fromSeason === spell.toSeason
    ? `${spell.fromSeason}`
    : `${spell.fromSeason}–${spell.toSeason}`;
}

/** Career years for the retirement card, e.g. "2044–2061". */
export function careerYears(career: Career): string {
  const first = career.seasonHistory[0]?.season ?? career.startSeason;
  const last = career.seasonHistory[career.seasonHistory.length - 1]?.season ?? career.currentSeason;
  return `${first}–${last}`;
}

export function goalContributionLabel(position: Position): string {
  return position === 'GK' ? 'שערים נקיים' : 'שערים';
}

/** Hebrew singular/plural: countLabel(1, 'שער אחד', 'שערים') -> "שער אחד". */
export function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : `${count} ${plural}`;
}

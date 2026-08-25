/** Presentation helpers. UI-only - the engine never imports this. */

import { stageLabel as academyStageLabel, stageConfig } from '../data/academy';
import { getClub } from '../data/clubs';
import { CAPTAIN_LABEL, POSITIONS, ROLE_ICONS, ROLE_LABELS } from '../game/balance';
import type {
  AcademyStage,
  Career,
  OlderGroupStatus,
  Position,
  SeasonRecord,
  TeamRole,
} from '../types';

export function positionLabel(position: Position): string {
  return POSITIONS[position].label;
}

export function positionIcon(position: Position): string {
  return POSITIONS[position].icon;
}

export function roleText(career: Career): string {
  return career.captain ? CAPTAIN_LABEL : ROLE_LABELS[career.role];
}

export function roleTextOf(role: TeamRole, captain = false): string {
  return captain ? CAPTAIN_LABEL : ROLE_LABELS[role];
}

export function roleIcon(career: Career): string {
  return career.captain ? '🅲' : ROLE_ICONS[career.role];
}

export function stageLabel(stage: AcademyStage): string {
  return academyStageLabel(stage);
}

/** "מכבי חיפה" for academy stages, the actual club once the player is a senior. */
export function teamLine(career: Career): string {
  const club = getClub(career.currentClubId);
  if (career.academyStage !== 'senior') return 'מכבי חיפה';
  return club.name;
}

/** The headline the career screen leads with: the academy stage, or the club. */
export function headlineTitle(career: Career): string {
  return career.academyStage === 'senior'
    ? getClub(career.currentClubId).name
    : stageLabel(career.academyStage);
}

export function headlineSubtitle(career: Career): string {
  return career.academyStage === 'senior' ? stageConfig('senior').league : 'מכבי חיפה';
}

export const OLDER_GROUP_LABELS: Record<OlderGroupStatus, string> = {
  none: '',
  training: 'מתאמן עם השנתון שמעליך',
  playing: 'משחק עם השנתון שמעליך',
};

export function olderGroupLine(career: Career): string | null {
  if (career.olderGroup === 'none') return null;
  return `⬆️ ${OLDER_GROUP_LABELS[career.olderGroup]}`;
}

/** 2038 -> "2037/38" — how a season is actually written on a shirt. */
export function seasonLabel(season: number): string {
  const start = season - 1;
  return `${start}/${String(season).slice(-2)}`;
}

export function clubName(clubId: string): string {
  return getClub(clubId).name;
}

/** Consecutive seasons at the same team, collapsed into one timeline entry. */
export interface CareerSpell {
  key: string;
  teamName: string;
  clubId: string;
  fromSeason: number;
  toSeason: number;
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  onLoan: boolean;
  isMaccabi: boolean;
  isAcademy: boolean;
}

export function buildTimeline(history: SeasonRecord[]): CareerSpell[] {
  const spells: CareerSpell[] = [];

  for (const record of history) {
    const last = spells[spells.length - 1];
    if (last && last.teamName === record.teamName && last.onLoan === record.onLoan) {
      last.toSeason = record.season;
      last.appearances += record.stats.appearances;
      last.goals += record.stats.goals;
      last.assists += record.stats.assists;
      last.trophies += record.trophies.length;
      continue;
    }
    spells.push({
      key: `${record.teamName}-${record.season}`,
      teamName: record.teamName,
      clubId: record.clubId,
      fromSeason: record.season,
      toSeason: record.season,
      appearances: record.stats.appearances,
      goals: record.stats.goals,
      assists: record.stats.assists,
      trophies: record.trophies.length,
      onLoan: record.onLoan,
      isMaccabi: getClub(record.clubId).isMaccabi === true,
      isAcademy: record.academyStage !== 'senior',
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

/** Hebrew singular/plural: countLabel(1, 'שער אחד', 'שערים') -> "שער אחד". */
export function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : `${count} ${plural}`;
}

/** Qualitative risk hint shown on a choice button - never a percentage. */
export const RISK_LABELS: Record<string, string> = {
  safe: 'בחירה בטוחה',
  balanced: 'מאוזן',
  risky: 'סיכון גבוה',
  opportunity: 'הזדמנות גדולה',
};

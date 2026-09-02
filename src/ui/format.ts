/** Presentation helpers. UI-only - the engine never imports this. */

import { stageLabel as academyStageLabel } from '../data/academy';
import { getClub } from '../data/clubs';
import { CAPTAIN_LABEL, POSITIONS, ROLE_ICONS, ROLE_LABELS } from '../game/balance';
import { currentTeamDisplay } from '../game/identity';
import { playerLeague } from '../game/worldEngine';
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

/**
 * The club the player is actually at. Never hard-coded to Maccabi (v0.3.1) - a player can be
 * at another academy from the age of nine if the trials said no.
 */
export function teamLine(career: Career): string {
  return getClub(career.currentClubId).name;
}

/** The headline the career screen leads with: the academy stage, or the club. */
/*
 * Both headline lines come from `currentTeamDisplay` (v0.4.1). The UI used to read the club id
 * and the stage itself and assemble wording from them, which is how a first-team player kept
 * being labelled with his old academy club record. There is now one source of truth.
 */
export function headlineTitle(career: Career): string {
  const display = currentTeamDisplay(career);
  return display.team ?? display.club;
}

/** Under the headline: the league for a senior, the club for an academy player. */
export function headlineSubtitle(career: Career): string {
  const display = currentTeamDisplay(career);
  if (display.unit === 'first_team') return playerLeague(career).name;
  return display.club;
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

/* Hebrew number agreement lives in game/hebrew, which has no imports - see the note there. */
export { countLabel } from '../game/hebrew';

/**
 * The author's own read on a choice, used when a choice has only one outcome and therefore no
 * distribution to derive a risk level from. Named distinctly from decisionEngine's RISK_LABELS,
 * which is keyed by the *measured* risk of a distribution rather than by the authored intent.
 */
export const CHOICE_RISK_LABELS: Record<string, string> = {
  safe: 'בחירה בטוחה',
  balanced: 'מאוזן',
  risky: 'סיכון גבוה',
  opportunity: 'הזדמנות גדולה',
};

/* ------------------------------------------------------------------ */
/* Form and confidence                                                 */
/* ------------------------------------------------------------------ */

export interface MoodChip {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * Form and confidence are hidden numbers and stay hidden: they surface as a short phrase
 * only when they are far enough from the middle to be worth mentioning. Two more progress
 * bars would say less and clutter more.
 */
export function moodChips(career: Career): MoodChip[] {
  const chips: MoodChip[] = [];
  const { form, confidence } = career.hidden;

  if (form >= 78) chips.push({ text: 'כושר מצוין', tone: 'good' });
  else if (form >= 64) chips.push({ text: 'כושר טוב', tone: 'good' });
  else if (form <= 30) chips.push({ text: 'תקופה קשה', tone: 'bad' });
  else if (form <= 42) chips.push({ text: 'לא בכושר', tone: 'bad' });

  if (confidence >= 78) chips.push({ text: 'ביטחון גבוה', tone: 'good' });
  else if (confidence <= 30) chips.push({ text: 'ביטחון שבור', tone: 'bad' });
  else if (confidence <= 42) chips.push({ text: 'חסר ביטחון', tone: 'bad' });

  return chips;
}

/* ------------------------------------------------------------------ */
/* Season progress                                                     */
/* ------------------------------------------------------------------ */

export interface SeasonPhaseStep {
  key: string;
  label: string;
  /** The step the player is on right now. */
  current: boolean;
  /** Already behind them this season. */
  done: boolean;
}

/**
 * A small five-step season indicator, so it is always obvious where in the year we are
 * without building a navigation system for it.
 */
export function seasonPhaseSteps(career: Career): SeasonPhaseStep[] {
  const order = ['preseason', 'first_half', 'mid', 'second_half', 'end'] as const;
  const labels: Record<(typeof order)[number], string> = {
    preseason: 'פתיחת עונה',
    first_half: 'מחצית ראשונה',
    mid: 'מחצית העונה',
    second_half: 'מחצית שנייה',
    end: 'סיום עונה',
  };

  let activeIndex: number;
  switch (career.phase) {
    case 'preseason':
      activeIndex = 0;
      break;
    case 'mid_season':
      activeIndex = 2;
      break;
    case 'season_result':
    case 'progression':
    case 'youth_to_senior':
    case 'offseason':
    case 'retirement_decision':
    case 'retired':
      activeIndex = 4;
      break;
    case 'event':
    default:
      // Which half an event belongs to is exactly what the season slot records.
      activeIndex = career.seasonSlot === 'early' ? 1 : career.seasonSlot === 'mid' ? 2 : 3;
      break;
  }

  return order.map((key, index) => ({
    key,
    label: labels[key],
    current: index === activeIndex,
    done: index < activeIndex,
  }));
}

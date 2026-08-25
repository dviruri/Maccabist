/**
 * Small pure helpers shared by every engine module.
 * Kept separate so the engines never import each other in a cycle.
 */

import { getClub, isAbroad, isMaccabiSenior, MACCABI_ID } from '../data/clubs';
import type { Career, CareerStage, PlayerStatus } from '../types';
import { POSITIONS, STAGE_BOUNDS, STATUS_LABELS, STATUS_TIERS, SEASON } from './balance';

export function stageForAge(age: number): CareerStage {
  const bound = STAGE_BOUNDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return bound?.stage ?? 'veteran';
}

export function statusFromValue(value: number): PlayerStatus {
  const tier = STATUS_TIERS.find((t) => value >= t.min);
  return tier?.status ?? 'academy';
}

export function statusLabel(status: PlayerStatus): string {
  return STATUS_LABELS[status];
}

/**
 * How strong the player looks to a coach picking a team: raw ability plus the
 * pull of an established status inside the squad.
 */
export function playerLevel(career: Career): number {
  return career.ability + (career.statusValue - 50) * SEASON.statusWeight;
}

export function currentClub(career: Career) {
  return getClub(career.currentClubId);
}

export function isAtMaccabi(career: Career): boolean {
  return getClub(career.currentClubId).isMaccabi === true;
}

export function isAtMaccabiSenior(career: Career): boolean {
  return isMaccabiSenior(career.currentClubId);
}

export function isPlayingAbroad(career: Career): boolean {
  return isAbroad(career.currentClubId);
}

export function isOnLoan(career: Career): boolean {
  return career.parentClubId !== null;
}

/** Position-adjusted goal contributions, used by the season rating and the Legend Score. */
export function outputScore(goals: number, assists: number, position: Career['position']): number {
  const config = POSITIONS[position];
  return (goals + assists * 0.7) * config.legendOutputFactor;
}

/** Age curve for playing time: teenagers and veterans lose minutes they would otherwise get. */
export function ageMinutesModifier(age: number): number {
  let modifier = 1;
  if (age < 21) modifier -= (21 - age) * SEASON.youngPenaltyPerYearUnder21;
  if (age > 32) modifier -= (age - 32) * SEASON.oldPenaltyPerYearOver32;
  return Math.max(0.25, modifier);
}

/** The clubs the player owns a legacy at - senior Maccabi only. */
export function countsForMaccabiLegacy(clubId: string, onLoan: boolean): boolean {
  return clubId === MACCABI_ID && !onLoan;
}

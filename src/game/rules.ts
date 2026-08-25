/**
 * Small pure helpers shared by every engine module.
 * Kept separate so the engines never import each other in a cycle.
 */

import { stageBand, stageConfig } from '../data/academy';
import { getClub, isAbroad, isMaccabiSenior, MACCABI_ID } from '../data/clubs';
import type { Career, LevelContext, StageBand, TeamRole } from '../types';
import { COACH_TRUST, POSITIONS, ROLE_LABELS, ROLE_TIERS, SEASON } from './balance';

export function roleFromValue(value: number): TeamRole {
  const tier = ROLE_TIERS.find((t) => value >= t.min);
  return tier?.role ?? 'squad';
}

export function roleLabel(role: TeamRole): string {
  return ROLE_LABELS[role];
}

export function bandOf(career: Career): StageBand {
  return stageBand(career.academyStage);
}

export function isInAcademy(career: Career): boolean {
  return career.academyStage !== 'senior';
}

/**
 * The level the player is actually playing at this season: the age group while he is in
 * the academy, the club once he is a senior. Everything downstream (minutes, ratings,
 * development, trophies) reads this rather than the club directly.
 */
export function levelContext(career: Career): LevelContext {
  if (isInAcademy(career)) {
    const stage = stageConfig(career.academyStage);
    const bump = SEASON.olderGroupQualityBump[career.olderGroup];
    return {
      teamName: stage.label,
      league: stage.league,
      quality: stage.quality + bump,
      development: stage.development,
      prestige: stage.band === 'u19' ? 16 : 6,
      seasonGames: stage.seasonGames,
      titleChance: stage.band === 'u19' ? 0.24 : 0.2,
      cupChance: stage.band === 'u19' ? 0.16 : 0.12,
      europeChance: 0,
      isAcademy: true,
    };
  }

  const club = getClub(career.currentClubId);
  return {
    teamName: club.name,
    league: club.league,
    quality: club.quality,
    development: club.development,
    prestige: club.prestige,
    seasonGames: club.seasonGames,
    titleChance: club.titleChance,
    cupChance: club.cupChance,
    europeChance: club.europeChance,
    isAcademy: false,
  };
}

/**
 * How strong the player looks to a coach picking a team: raw ability, the pull of an
 * established role, and how much the coach actually trusts him.
 */
export function playerLevel(career: Career): number {
  return (
    career.ability +
    (career.roleValue - 50) * SEASON.roleWeight +
    (career.coachTrust - 50) * COACH_TRUST.minutesInfluence
  );
}

export function currentClub(career: Career) {
  return getClub(career.currentClubId);
}

export function isAtMaccabi(career: Career): boolean {
  return getClub(career.currentClubId).isMaccabi === true;
}

export function isAtMaccabiSenior(career: Career): boolean {
  return isMaccabiSenior(career.currentClubId) && career.academyStage === 'senior';
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

/** Age curve for playing time: teenagers and veterans lose minutes among grown men. */
export function ageMinutesModifier(age: number): number {
  let modifier = 1;
  if (age < 21) modifier -= (21 - age) * SEASON.youngPenaltyPerYearUnder21;
  if (age > 32) modifier -= (age - 32) * SEASON.oldPenaltyPerYearOver32;
  return Math.max(0.25, modifier);
}

/** The clubs the player owns a legacy at - senior Maccabi only. */
export function countsForMaccabiLegacy(career: Career): boolean {
  return (
    career.academyStage === 'senior' &&
    career.currentClubId === MACCABI_ID &&
    career.parentClubId === null
  );
}

/** How far ahead of (or behind) his age group the player is. */
export function abilityVsLevel(career: Career): number {
  return career.ability - levelContext(career).quality;
}

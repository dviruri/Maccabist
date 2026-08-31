/**
 * Small pure helpers shared by every engine module.
 * Kept separate so the engines never import each other in a cycle.
 */

import { stageBand, stageConfig } from '../data/academy';
import { getClub, isAbroad, isMaccabiSenior, MACCABI_ID } from '../data/clubs';
import { leagueScheduleBreakdown, leagueSeasonGames } from './leagueSchedule';
import { currentLeagueOf } from './leagueTruth';
import type { Career, LevelContext, StageBand, TeamRole } from '../types';
import { COACH_TRUST, POSITIONS, ROLE_LABELS, ROLE_TIERS, SEASON } from './balance';
import { clamp } from './random';

/** Maccabi's academy is the yardstick every other youth setup is measured against. */
const MACCABI_ACADEMY_QUALITY = 30;

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
    const club = getClub(career.currentClubId);

    /*
     * The stage sets the age group; the club sets the standard (v0.3.1).
     *
     * נערים ב׳ at a small northern academy is not the same level as נערים ב׳ at Maccabi, and
     * previously it was - the club was ignored entirely for academy players. That made it
     * impossible for a boy Maccabi rejected to stand out where he landed, which is exactly
     * what has to happen for them to come back for him.
     */
    const clubFactor = clamp(club.quality / MACCABI_ACADEMY_QUALITY, 0.6, 1.15);
    const isMaccabiAcademy = club.isMaccabi === true;

    return {
      teamName: isMaccabiAcademy ? stage.label : `${club.name} - ${stage.label}`,
      league: stage.league,
      quality: stage.quality * clubFactor + bump,
      development: stage.development * (isMaccabiAcademy ? 1 : clubFactor),
      prestige: stage.band === 'u19' ? 16 : 6,
      seasonGames: stage.seasonGames,
      titleChance: stage.band === 'u19' ? 0.24 : 0.2,
      cupChance: stage.band === 'u19' ? 0.16 : 0.12,
      europeChance: 0,
      isAcademy: true,
    };
  }

  const club = getClub(career.currentClubId);
  /*
   * v0.6.5.2: the league and the schedule come from world state, not from the club record.
   *
   * `club.league` and `club.seasonGames` are where the club was when the dataset was written.
   * Once promotion and relegation move it, both are stale - a player relegated with his club
   * kept being told he was in Ligat Ha'Al, and kept playing that division's fixture count.
   */
  const league = currentLeagueOf(career.world, club);
  /*
   * v0.8: continental fixtures are REAL. Before Europe was simulated, strong clubs carried a
   * quality-based European allowance whether or not they had qualified for anything. Now the
   * season's European journey - simulated at preseason - says exactly how many European matches
   * this club plays this year, including a journey that started in Champions League qualifying
   * and ended in the Conference League. No journey, no European fixtures. A pre-v0.8 save
   * mid-season has no europe state and keeps the legacy allowance until its next preseason.
   */
  const journey = career.world.europe?.current?.playerJourney;
  const isIsraeli = club.country === 'ישראל';
  const seasonGames =
    career.world.europe && career.world.europe.current
      ? (() => {
          const base = leagueScheduleBreakdown(league.id, club.quality, isIsraeli);
          const continental =
            journey && journey.season === career.currentSeason && journey.clubId === club.id
              ? journey.matches
              : 0;
          return base.league + base.cup + continental;
        })()
      : leagueSeasonGames(league.id, club.quality, isIsraeli);
  return {
    teamName: club.name,
    league: league.name,
    quality: club.quality,
    development: club.development,
    prestige: club.prestige,
    seasonGames,
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

/**
 * Position-adjusted contribution, used by the Legend Score.
 *
 * v0.4.1: clean sheets count. `legendOutputFactor` (6 for a keeper, 0.85 for a striker) was meant
 * to compensate a goalkeeper for scoring rarely - but a keeper records zero goals and zero
 * assists over a whole career, and no multiplier scales zero. The result was that goalkeepers
 * scored *nothing at all* on the contribution component of the Legend Score, which is most of why
 * their careers read as less legendary than anyone else's.
 *
 * A keeper's contribution is the goals he prevents. That is what `cleanSheets` is for, and it was
 * being tracked and thrown away.
 */
export function outputScore(
  goals: number,
  assists: number,
  position: Career['position'],
  cleanSheets = 0,
): number {
  const config = POSITIONS[position];
  return (goals + assists * 0.7) * config.legendOutputFactor + cleanSheets * config.legendCleanSheetFactor;
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

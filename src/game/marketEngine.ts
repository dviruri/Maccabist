/**
 * The career ladder (v0.4).
 *
 * Where a player can move next should follow from what he has actually done, in both
 * directions. A breakout season at a small club opens doors upward; two years on a bench
 * abroad opens them downward. Careers that only ever climb are not football careers.
 *
 * Nothing here is a hard threshold. Everything is a weighted draw over clubs whose level sits
 * near the player's, so a good season improves the odds without ever guaranteeing a club.
 */

import { ALL_CLUBS, getClub, MACCABI_ID } from '../data/clubs';
import { getLeague, leagueLevel, type League } from '../data/leagues';
import type {
  Career,
  Club,
  ExpectedRole,
  MoveDirection,
  Position,
  SeasonRecord,
} from '../types';
import { MARKET } from './balance';
import { clamp, type Rng } from './random';
import { leagueOf } from './worldEngine';

/* ------------------------------------------------------------------ */
/* Where the player sits in the game                                   */
/* ------------------------------------------------------------------ */

/**
 * The player's current market level, 0-100.
 *
 * Deliberately weighted towards what is *visible*: what he did last season, at what level, in
 * what role. Hidden potential leaks in only slightly and only while he is young enough for
 * clubs to be buying a projection rather than a record.
 */
export function careerLevel(career: Career): number {
  const last = career.lastSeasonRecord;
  const league = leagueOf(career.world, career.currentClubId);

  const base = career.ability * MARKET.abilityWeight;
  const name = career.reputation * MARKET.reputationWeight;
  // Playing well in a strong league is worth more than the same season in a weak one.
  const stage = leagueLevel(league) * MARKET.leagueWeight;
  const standing = career.roleValue * MARKET.roleWeight;

  const form = last ? (last.stats.rating - 58) * MARKET.ratingWeight : 0;
  const minutes = last
    ? clamp(last.stats.appearances / Math.max(1, getClub(last.clubId).seasonGames), 0, 1) *
      MARKET.minutesWeight
    : 0;

  // Clubs pay for a projection while he is young; after that they pay for the record.
  const youth =
    career.age <= MARKET.projectionAge
      ? (career.hidden.potential - career.ability) * MARKET.potentialLeak
      : 0;

  const age = -Math.max(0, career.age - MARKET.peakAge) * MARKET.ageDecline;

  return clamp(base + name + stage + standing + form + minutes + youth + age);
}

/* ------------------------------------------------------------------ */
/* Position need                                                       */
/* ------------------------------------------------------------------ */

/**
 * How badly a club needs this position this summer, 0-1.
 *
 * Lightweight on purpose: no squads are simulated. It is a stable pseudo-random need per
 * club, position and season, so a club is consistently in the market for a keeper across one
 * window and not the next - which is enough to stop every club wanting every position equally.
 */
export function positionNeed(clubId: string, position: Position, season: number): number {
  // Cheap deterministic hash - stable for a given club/position/season, no RNG state needed.
  let hash = 2166136261;
  const key = `${clubId}|${position}|${season}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unit = ((hash >>> 0) % 1000) / 1000;
  return MARKET.needFloor + unit * (1 - MARKET.needFloor);
}

/* ------------------------------------------------------------------ */
/* Expected role                                                       */
/* ------------------------------------------------------------------ */

/**
 * What a club would be signing him to be.
 *
 * The gap between the player and the club's own level does most of the work: a player well
 * clear of a club's standard arrives as a star, a player well below it arrives as a project.
 * Position need shifts it, because a club short in your position promises more.
 */
export function expectedRoleAt(career: Career, club: Club, season: number): ExpectedRole {
  const need = positionNeed(club.id, career.position, season);
  const edge = career.ability - club.quality + (need - 0.5) * MARKET.needToEdge;

  // A young player below the level is a project, not a backup - clubs buy him to develop.
  if (edge < MARKET.projectEdge && career.age <= MARKET.projectionAge) return 'project';
  if (edge < MARKET.backupEdge) return 'backup';
  if (edge < MARKET.rotationEdge) return 'rotation';
  if (edge < MARKET.starterEdge) return 'starter';
  if (edge < MARKET.keyEdge) return 'key';
  return 'star';
}

export const EXPECTED_ROLE_LABELS: Record<ExpectedRole, string> = {
  star: 'כוכב',
  key: 'שחקן מוביל',
  starter: 'שחקן הרכב',
  rotation: 'רוטציה',
  backup: 'גיבוי',
  project: 'פרויקט לעתיד',
};

/** Roughly how much football an expected role implies, 0-1. Drives the arrival minutes. */
export const EXPECTED_ROLE_MINUTES: Record<ExpectedRole, number> = {
  star: 0.92,
  key: 0.82,
  starter: 0.7,
  rotation: 0.45,
  backup: 0.22,
  project: 0.18,
};

/** The role value a player arrives on, given what he was signed to be. */
export function arrivalRoleValue(role: ExpectedRole): number {
  return MARKET.arrivalRoleValue[role] ?? 48;
}

/* ------------------------------------------------------------------ */
/* Direction                                                           */
/* ------------------------------------------------------------------ */

export function moveDirection(career: Career, club: Club): MoveDirection {
  const from = leagueLevel(leagueOf(career.world, career.currentClubId));
  const to = leagueLevel(leagueOf(career.world, club.id));
  if (to - from >= MARKET.directionThreshold) return 'up';
  if (from - to >= MARKET.directionThreshold) return 'down';
  return 'lateral';
}

/* ------------------------------------------------------------------ */
/* Who wants him                                                       */
/* ------------------------------------------------------------------ */

/**
 * How interested a club is, as a weight.
 *
 * Clubs near the player's level are likeliest; a club far above him is a long shot and a club
 * far below him is only interested if he has fallen off. Position need multiplies throughout,
 * so a club that is set at his position rarely comes calling.
 */
export function clubInterest(career: Career, club: Club, season: number): number {
  const level = careerLevel(career);
  const target = leagueLevel(leagueOf(career.world, club.id)) * 0.55 + club.quality * 0.45;

  // A club will stretch a little above the player's level, but not far.
  const gap = target - level;
  const fit = Math.max(0, 1 - Math.abs(gap - MARKET.stretch) / MARKET.fitWidth);

  const need = positionNeed(club.id, career.position, season);
  const ageFactor = career.age <= MARKET.peakAge ? 1 : Math.max(0.2, 1 - (career.age - MARKET.peakAge) * 0.1);

  return fit * (MARKET.needFloor + need) * ageFactor;
}

/** Every senior club the player could conceivably move to. */
export function marketClubs(career: Career): Club[] {
  return ALL_CLUBS.filter((club) => club.isSenior === true && club.id !== career.currentClubId);
}

/**
 * Draws a destination. Returns null when nobody is interested, which is a real outcome - not
 * every player gets an offer every summer.
 */
export function drawDestination(
  career: Career,
  rng: Rng,
  filter?: (club: Club) => boolean,
): Club | null {
  const pool = filter ? marketClubs(career).filter(filter) : marketClubs(career);
  if (pool.length === 0) return null;
  return rng.weighted(pool, (club) => clubInterest(career, club, career.currentSeason));
}

/* ------------------------------------------------------------------ */
/* Qualitative hints                                                   */
/* ------------------------------------------------------------------ */

/**
 * Short qualitative notes for the offer card. Never a probability - the player should have to
 * weigh a decision, not read the odds off it.
 */
export function offerHints(career: Career, club: Club, role: ExpectedRole, season: number): string[] {
  const hints: string[] = [];
  const league = leagueOf(career.world, club.id);
  const current = leagueOf(career.world, career.currentClubId);
  const need = positionNeed(club.id, career.position, season);

  if (EXPECTED_ROLE_MINUTES[role] >= 0.7) hints.push('סיכוי גבוה לדקות');
  else if (EXPECTED_ROLE_MINUTES[role] <= 0.25) hints.push('תחרות קשה על ההרכב');

  const levelGap = leagueLevel(league) - leagueLevel(current);
  if (levelGap >= MARKET.directionThreshold) hints.push('ליגה חזקה יותר');
  else if (levelGap <= -MARKET.directionThreshold) hints.push('ליגה חלשה יותר');

  if (club.development >= MARKET.goodDevelopment) hints.push('מועדון עם פיתוח צעירים טוב');
  if (league.visibility >= MARKET.highVisibility) hints.push('חלון ראווה לאירופה');
  if (need >= MARKET.strongNeed) hints.push('המועדון מחפש בדיוק את העמדה שלך');

  return hints;
}

/* ------------------------------------------------------------------ */
/* Trajectory                                                          */
/* ------------------------------------------------------------------ */

/** Is the career going up, flat, or down? Reads the last few seasons. */
export function careerTrajectory(career: Career): MoveDirection {
  const recent = career.seasonHistory.filter((s) => s.academyStage === 'senior').slice(-3);
  if (recent.length < 2) return 'lateral';

  const first = recent[0] as SeasonRecord;
  const last = recent[recent.length - 1] as SeasonRecord;
  const delta = last.ability - first.ability + (last.coachTrust - first.coachTrust) * 0.3;

  if (delta >= MARKET.trajectoryUp) return 'up';
  if (delta <= -MARKET.trajectoryUp) return 'down';
  return 'lateral';
}

/** True when the player is clearly not playing where he is. */
export function isStagnating(career: Career): boolean {
  const last = career.lastSeasonRecord;
  if (!last) return false;
  const games = Math.max(1, getClub(last.clubId).seasonGames);
  return last.stats.appearances / games < MARKET.stagnationShare;
}

export function currentLeague(career: Career): League {
  return leagueOf(career.world, career.currentClubId);
}

export { MACCABI_ID, getLeague };

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

import { seasonFixtures } from './leagueTruth';
import { agentMarketFactor, clubManagerArchetype } from './peopleEngine';
import { ACTIVE_CLUBS, getClub, MACCABI_ID } from '../data/clubs';
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
  // v0.6.5.2: the denominator is last season's own schedule, not the club's current one.
  const minutes = last
    ? clamp(last.stats.appearances / Math.max(1, seasonFixtures(last, career.world)), 0, 1) *
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

/**
 * How high a club sits in a *career*, 0-100 (v0.4.1).
 *
 * Not the league, and not the squad, but both — plus what playing there does for a reputation.
 * This is the number transfer direction, career trajectory and offer wording all read, so that
 * "is this a step up?" has one answer everywhere.
 *
 * Reads the live world state, so a relegated Maccabi is genuinely a lower career level than it
 * was last season, and rises again when it comes back up.
 */
export function clubCareerLevel(career: Career, clubId: string): number {
  const club = getClub(clubId);
  const league = leagueOf(career.world, clubId);
  const w = MARKET.careerLevel;

  /*
   * v0.8: ACTUAL European football, modestly weighted on top of the static prior.
   *
   * `europeChance` remains the long-run attractiveness prior; a live entry this season adds a
   * bounded bonus scaled by competition tier - a Champions League campaign is worth more than a
   * Conference one, and none of it overrides the market/tier-first philosophy (the bonus is a
   * fraction of the europeChance term's own scale).
   */
  const entry =
    career.world.europe?.current?.entries.find((e) => e.clubId === clubId) ??
    career.world.europe?.nextEntries?.find((e) => e.clubId === clubId);
  const liveEurope =
    entry?.competition === 'uefa_champions_league'
      ? 40
      : entry?.competition === 'uefa_europa_league'
        ? 25
        : entry?.competition === 'uefa_conference_league'
          ? 14
          : 0;

  return clamp(
    leagueLevel(league) * w.league +
      club.quality * w.quality +
      club.prestige * w.prestige +
      league.visibility * w.visibility +
      club.europeChance * 100 * w.europe +
      liveEurope * w.europe,
  );
}

/**
 * Which way a move goes.
 *
 * Five bands, because "up" covers both a better club in the same league and a jump from the
 * Israeli second division to Serie A, and a career should not treat those as the same event.
 *
 * A `down` move is not automatically a bad decision — dropping a level to start every week is a
 * legitimate and often correct football choice. Direction describes the move, not its wisdom.
 */
export function moveDirection(career: Career, club: Club): MoveDirection {
  const from = clubCareerLevel(career, career.currentClubId);
  const to = clubCareerLevel(career, club.id);
  const delta = to - from;

  if (delta >= MARKET.majorStepThreshold) return 'major_up';
  if (delta >= MARKET.stepThreshold) return 'up';
  if (delta <= -MARKET.majorStepThreshold) return 'major_down';
  if (delta <= -MARKET.stepThreshold) return 'down';
  return 'lateral';
}

/** True for any upward move, so callers do not have to enumerate the bands. */
export function isUpwardMove(direction: MoveDirection): boolean {
  return direction === 'up' || direction === 'major_up';
}

export function isDownwardMove(direction: MoveDirection): boolean {
  return direction === 'down' || direction === 'major_down';
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
  /*
   * v0.6.4: ACTIVE_CLUBS, not ALL_CLUBS. A club that dropped out of the modelled divisions keeps
   * its identity so old saves read honestly, and must not be signable.
   */
  return ACTIVE_CLUBS.filter((club) => club.isSenior === true && club.id !== career.currentClubId);
}

/* ------------------------------------------------------------------ */
/* Market-first destination selection (v0.6.4)                         */
/* ------------------------------------------------------------------ */

/**
 * ## Why this is two steps rather than one
 *
 * Until v0.6.4 a destination was one weighted draw across every club in the world. That was fine
 * when the world had 35 clubs, and became a bug the moment v0.6.4 made ~200 clubs signable: under
 * a flat draw, a country's probability is proportional to **how many clubs it has**, so unifying
 * the club model would have quietly doubled the chance of moving to England and halved Cyprus.
 * More data would have meant a different game.
 *
 * So selection is explicitly two decisions:
 *
 *   1. WHICH MARKET - weighted by how well the market fits this player, and by the agent's
 *      contacts. Deliberately independent of club count: a 12-club and a 20-club league with the
 *      same standing are equally likely doors.
 *   2. WHICH CLUB INSIDE IT - weighted by the same `clubInterest` as before.
 *
 * P(club) = P(market) x P(club | market). Adding ten clubs to Serie A therefore changes *which*
 * Italian club calls, and not how often Italy calls at all. That is the whole contract, and
 * `tests/marketSelection.test.ts` measures it rather than trusting it.
 */

/** How well a market suits this player at all, before any club inside it is considered. */
function marketFit(career: Career, leagueId: string, pool: readonly Club[]): number {
  const league = getLeague(leagueId);
  const level = careerLevel(career);

  /*
   * Home first (v0.6.4). See MARKET.homeMarketBias: leaving the country is a bigger step than
   * changing clubs inside it, and this is where that is said out loud instead of being an
   * artefact of how many clubs each country happened to have in the dataset.
   */
  const home = getClub(career.currentClubId).country;
  const domestic = league.country === home ? MARKET.homeMarketBias : 1;

  /*
   * A market's standing is its own level, not its best club's - which is what makes this
   * count-independent. `stretch` lets a player look one step up, the same allowance
   * `clubInterest` gives inside a market.
   */
  const gap = leagueLevel(league) - level;
  const fit = Math.max(0, 1 - Math.abs(gap - MARKET.stretch) / MARKET.fitWidth);
  if (fit <= 0) return 0;

  /*
   * A market with nobody interested is not a market. This reads the pool for *presence* of a
   * plausible club, never for how many - `some`, not `length`, is the line that keeps club count
   * out of the market decision.
   */
  const reachable = pool.some((club) => clubInterest(career, club, career.currentSeason) > 0.02);
  return reachable ? fit * domestic : 0;
}

/**
 * The agent's contacts, at market level.
 *
 * v0.5 applied this per club, which under a flat draw was the same thing. Under market-first it
 * belongs here: an agent opens a *door*, and which club is behind it is football's business. The
 * contract is unchanged - a specialist makes his markets likelier and others less so, and no
 * factor is ever zero, so a poorly connected market is unlikely rather than closed.
 */
function agentMarketWeight(career: Career, pool: readonly Club[]): number {
  const sample = pool[0];
  return sample ? agentMarketFactor(career, sample) : 1;
}

/** The clubs of each market the player could plausibly join, keyed by league. */
function marketPools(career: Career, filter?: (club: Club) => boolean): Map<string, Club[]> {
  const pools = new Map<string, Club[]>();
  for (const club of marketClubs(career)) {
    if (filter && !filter(club)) continue;
    const leagueId = leagueOf(career.world, club.id).id;
    const pool = pools.get(leagueId);
    if (pool) pool.push(club);
    else pools.set(leagueId, [club]);
  }
  return pools;
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
  const pools = marketPools(career, filter);
  if (pools.size === 0) return null;

  // Step 1: the market.
  const markets = [...pools.keys()];
  const leagueId = rng.weighted(
    markets,
    (id) => marketFit(career, id, pools.get(id)!) * agentMarketWeight(career, pools.get(id)!),
  );
  if (!leagueId) return null;

  // Step 2: the club inside it.
  const pool = pools.get(leagueId)!;
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

  /*
   * v0.5, Phase 33: what kind of manager is waiting there - the concise version, no hidden
   * coefficients. Reads `clubManagerArchetype`, the same pure function `installManager` reads,
   * so the hint and the man who greets the player on arrival cannot disagree. Only shown when
   * the archetype would actually matter to this player's decision.
   */
  const archetype = clubManagerArchetype(career, club.id);
  if (archetype === 'youth_believer' && career.age < 21) hints.push('מאמן: מאמין בצעירים');
  else if (archetype === 'star_driven' && career.reputation < 55) hints.push('מאמן: מעדיף שחקנים מוכחים');
  else if (archetype === 'conservative') hints.push('מאמן: אמון נבנה אצלו לאט');
  else if (archetype === 'rotation') hints.push('מאמן: מסובב את הסגל');

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
  const games = Math.max(1, seasonFixtures(last, career.world));
  return last.stats.appearances / games < MARKET.stagnationShare;
}

export function currentLeague(career: Career): League {
  return leagueOf(career.world, career.currentClubId);
}

export { MACCABI_ID, getLeague };

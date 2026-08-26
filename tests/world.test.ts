/**
 * v0.4: the football world and the career ladder.
 *
 * These cover the rules a season-level world has to obey to be believable — a relegated club is
 * in the lower division next season, a loan is a spell somewhere else and not a formality, and a
 * move up is a move up regardless of which seed produced it.
 */

import { describe, expect, it } from 'vitest';

import { getClub, MACCABI_ID } from '../src/data/clubs';
import { getLeague } from '../src/data/leagues';
import { createCareer } from '../src/game/careerEngine';
import {
  careerLevel,
  drawDestination,
  expectedRoleAt,
  moveDirection,
  positionNeed,
} from '../src/game/marketEngine';
import { moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { applyAutomaticMoves, buildLoanOffers } from '../src/game/transferEngine';
import { applyPromotionRelegation, emptyWorld, leagueOf } from '../src/game/worldEngine';
import type { Career, ClubSeasonResult, SeasonRecord } from '../src/types';

const base = (seed = 11): Career => createCareer({ playerName: 'ל', position: 'CM', seed });

/** Two Israeli clubs at unambiguously different levels: top flight vs second division. */
const TOP = MACCABI_ID;
const SECOND = 'hapoel_afula';

const seasonAt = (clubId: string): SeasonRecord => ({
  season: 2041,
  age: 19,
  academyStage: 'senior',
  clubId,
  clubName: getClub(clubId).name,
  teamName: getClub(clubId).name,
  league: leagueOf(emptyWorld(), clubId).name,
  onLoan: false,
  stats: {
    appearances: 20,
    starts: 14,
    goals: 3,
    assists: 2,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 62,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 56,
  role: 'squad',
  coachTrust: 55,
  trophies: [],
  captain: false,
  olderGroup: 'none',
});

/**
 * A senior player at a given club. `lastSeasonRecord.clubId` is the *current* club: that is what
 * an established player looks like, and it is the field loan expiry reads.
 */
const seniorAt = (clubId: string, over: Partial<Career> = {}): Career => ({
  ...base(),
  academyStage: 'senior',
  currentClubId: clubId,
  currentSeason: 2042,
  age: 20,
  ability: 58,
  reputation: 20,
  roleValue: 30,
  lastSeasonRecord: seasonAt(clubId),
  ...over,
});

describe('promotion and relegation', () => {
  const relegation = (clubId: string): ClubSeasonResult => ({
    season: 2042,
    clubId,
    leagueId: 'il_premier',
    outcome: 'relegated',
    label: 'ירדה ליגה',
    playerImpact: 0.3,
  });

  it('moves a relegated club into the division below', () => {
    const club = MACCABI_ID;
    const world = applyPromotionRelegation(emptyWorld(), relegation(club));
    expect(leagueOf(world, club).id).toBe('il_leumit');
  });

  it('moves a promoted club into the division above', () => {
    const club = MACCABI_ID;
    const relegated = applyPromotionRelegation(emptyWorld(), relegation(club));
    const world = applyPromotionRelegation(relegated, {
      season: 2043,
      clubId: club,
      leagueId: 'il_leumit',
      outcome: 'promoted',
      label: 'עלתה ליגה',
      playerImpact: 0.4,
    });
    expect(leagueOf(world, club).id).toBe('il_premier');
  });

  it('leaves the world alone when the club stayed up', () => {
    const world = applyPromotionRelegation(emptyWorld(), {
      season: 2042,
      clubId: MACCABI_ID,
      leagueId: 'il_premier',
      outcome: 'mid_table',
      label: 'אמצע טבלה',
      playerImpact: 0.3,
    });
    expect(world.clubLeagues).toEqual({});
  });

  it('never relegates out of the bottom division', () => {
    const world = applyPromotionRelegation(emptyWorld(), {
      season: 2042,
      clubId: SECOND,
      leagueId: 'il_leumit',
      outcome: 'relegated',
      label: 'ירדה ליגה',
      playerImpact: 0.1,
    });
    // `il_leumit` has no `relegatesTo`, so the club stays put rather than vanishing.
    expect(getLeague('il_leumit').relegatesTo).toBeUndefined();
    expect(leagueOf(world, SECOND).id).toBe('il_leumit');
  });

  it('follows the player when his own club goes down', () => {
    const career = seniorAt(TOP);
    const dropped: Career = {
      ...career,
      world: applyPromotionRelegation(career.world, relegation(MACCABI_ID)),
    };
    expect(leagueOf(dropped.world, dropped.currentClubId).tier).toBe(2);
  });
});

describe('loans', () => {
  it('keeps the parent club while the player is away', () => {
    const career = seniorAt(TOP);
    const away = moveToClub(career, SECOND, { loan: true, loanSeasons: 1 });
    expect(away.currentClubId).toBe(SECOND);
    expect(away.parentClubId).toBe(MACCABI_ID);
  });

  it('does not expire before a season has been played', () => {
    const career = seniorAt(TOP);
    const away = moveToClub(career, SECOND, { loan: true, loanSeasons: 1 });
    // Straight into the new season: `lastSeasonRecord` is still the season at the parent club.
    const next = applyAutomaticMoves(away);
    expect(next.currentClubId).toBe(SECOND);
    expect(next.parentClubId).toBe(MACCABI_ID);
  });

  it('returns the player to the parent club after the loan season', () => {
    const career = seniorAt(TOP);
    const away = moveToClub(career, SECOND, { loan: true, loanSeasons: 1 });
    const played: Career = {
      ...away,
      lastSeasonRecord: { ...(away.lastSeasonRecord as SeasonRecord), clubId: SECOND },
    };
    const home = applyAutomaticMoves(played);
    expect(home.currentClubId).toBe(MACCABI_ID);
    expect(home.parentClubId).toBeNull();
  });

  it('offers a genuine choice between minutes and level', () => {
    const career = seniorAt(TOP);
    const offers = buildLoanOffers(career, createRng(7));
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.kind).toBe('loan');
      expect(offer.clubId).not.toBe(career.currentClubId);
      expect(offer.expectedRole).toBeDefined();
    }
  });
});

describe('the career ladder', () => {
  it('reads a move to a stronger league as upward and the reverse as downward', () => {
    expect(moveDirection(seniorAt(SECOND), getClub(TOP))).toBe('up');
    expect(moveDirection(seniorAt(TOP), getClub(SECOND))).toBe('down');
    // Two top-flight clubs are a sideways move however different their quality.
    expect(moveDirection(seniorAt(TOP), getClub('bnei_sakhnin'))).toBe('lateral');
  });

  it('rates the same player higher in a stronger league', () => {
    const weak = seniorAt(SECOND);
    const strong = seniorAt(TOP);
    expect(careerLevel(strong)).toBeGreaterThan(careerLevel(weak));
  });

  it('signs a player well clear of a club as a leader, and one below it as a squad man', () => {
    const strong = seniorAt(SECOND, { ability: 90 });
    const weak = seniorAt(SECOND, { ability: 30, age: 28 });
    const club = getClub(SECOND);
    const strongRole = expectedRoleAt(strong, club, 2042);
    const weakRole = expectedRoleAt(weak, club, 2042);
    expect(['star', 'key']).toContain(strongRole);
    expect(['backup', 'rotation']).toContain(weakRole);
  });

  it('treats a young player below the level as a project rather than a backup', () => {
    const kid = seniorAt(SECOND, { ability: 30, age: 18 });
    expect(expectedRoleAt(kid, getClub(TOP), 2042)).toBe('project');
  });

  it('gives a club a stable need for a position within a season, and varies it across seasons', () => {
    const a = positionNeed(MACCABI_ID, 'GK', 2042);
    expect(positionNeed(MACCABI_ID, 'GK', 2042)).toBe(a);
    const seasons = [2042, 2043, 2044, 2045, 2046].map((s) => positionNeed(MACCABI_ID, 'GK', s));
    expect(new Set(seasons).size).toBeGreaterThan(1);
    for (const need of seasons) {
      expect(need).toBeGreaterThanOrEqual(0);
      expect(need).toBeLessThanOrEqual(1);
    }
  });

  it('draws the same destination for the same seed', () => {
    const career = seniorAt(TOP);
    const first = drawDestination(career, createRng(99));
    const second = drawDestination(career, createRng(99));
    expect(first?.id).toBe(second?.id);
  });

  it('never draws the club the player is already at', () => {
    const career = seniorAt(TOP);
    for (let seed = 1; seed <= 60; seed += 1) {
      expect(drawDestination(career, createRng(seed))?.id).not.toBe(MACCABI_ID);
    }
  });
});

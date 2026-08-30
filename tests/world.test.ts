/**
 * v0.4: the football world and the career ladder.
 *
 * These cover the rules a season-level world has to obey to be believable — a relegated club is
 * in the lower division next season, a loan is a spell somewhere else and not a formality, and a
 * move up is a move up regardless of which seed produced it.
 */

import { describe, expect, it } from 'vitest';

import { DIRECTION_LABELS, DIRECTION_TONES } from '../src/components/OffersCard';
import { ALL_CLUBS, getClub, MACCABI_ID } from '../src/data/clubs';
import { WORLD_EVENTS } from '../src/data/events/worldEvents';
import { getLeague } from '../src/data/leagues';
import {
  beginSeason,
  continueAfterEvent,
  continueAfterOrigin,
  createCareer,
  hydrateCareer,
} from '../src/game/careerEngine';
import { conditionContext } from '../src/game/eventEngine';
import {
  careerLevel,
  clubCareerLevel,
  drawDestination,
  expectedRoleAt,
  isDownwardMove,
  isUpwardMove,
  moveDirection,
  positionNeed,
} from '../src/game/marketEngine';
import { cloneCareer, moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import {
  applyAutomaticMoves,
  buildLoanOffers,
  buildReturnHomeOffer,
} from '../src/game/transferEngine';
import {
  applyPromotionRelegation,
  clubStrengthVsLeague,
  emptyWorld,
  lastAmbientMaccabiSeason,
  leagueOf,
  playerImpact,
  recordMaccabiSeason,
  simulateClubSeason,
  simulateMaccabiSeason,
} from '../src/game/worldEngine';
import type { Career, ClubSeasonResult, MoveDirection, SeasonRecord } from '../src/types';

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

/*
 * v0.6.5 fixture note: hapoel_hadera was the canonical "weaker top-flight club" here, and the
 * pyramid moved under it - it now plays two tiers down in Liga Alef, which changes what a move
 * to or from it means. `hapoel_hadera` fixtures were repointed to `bnei_sakhnin` (a real
 * mid-table top-flight club); the assertions themselves are unchanged.
 */
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

  it('relegates a Leumit club into its correct Alef district (v0.6.5)', () => {
    /*
     * The trapdoor is real now. What this test used to prove - that the bottom division has no
     * relegatesTo - moved down two rungs: the Alef districts are the floor, checked below. What
     * Leumit relegation must prove instead is DISTRICT truth, because 'il_alef' is a
     * geography-resolved sentinel and a Rehovot club landing in the northern district would be
     * a quiet lie about the football map.
     */
    const relegated = applyPromotionRelegation(emptyWorld(), {
      season: 2042,
      clubId: 'hapoel_raanana',
      leagueId: 'il_leumit',
      outcome: 'relegated',
      label: 'ירדה ליגה',
      playerImpact: 0.1,
    });
    expect(relegated.clubLeagues['hapoel_raanana']).toBe('il_alef_south');
    const north = applyPromotionRelegation(emptyWorld(), {
      season: 2042,
      clubId: 'hapoel_acre',
      leagueId: 'il_leumit',
      outcome: 'relegated',
      label: 'ירדה ליגה',
      playerImpact: 0.1,
    });
    expect(north.clubLeagues['hapoel_acre']).toBe('il_alef_north');

    // And the floor really is the floor.
    const world = applyPromotionRelegation(emptyWorld(), {
      season: 2042,
      clubId: 'ms_tira',
      leagueId: 'il_alef_north',
      outcome: 'relegated',
      label: 'ירדה ליגה',
      playerImpact: 0.1,
    });
    // The Alef districts have no `relegatesTo` (Liga Bet is below the modelled world), so a
    // bottom-placed club stays put rather than vanishing.
    expect(getLeague('il_alef_north').relegatesTo).toBeUndefined();
    expect(leagueOf(world, 'ms_tira').id).toBe('il_alef_north');
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

describe('the club season, in events', () => {
  it('can plan a mid/late event that requires appearances', () => {
    /*
     * The whole season is planned at preseason, when firstHalfStats is still null. Read
     * naively that made every mid/late event with a minLastAppearances floor evaluate against
     * zero appearances and become unplannable — an entire class of events that silently never
     * fired. At planning time last season is the honest evidence.
     */
    const career: Career = {
      ...seniorAt(TOP),
      firstHalfStats: null,
      seasonSlot: 'preseason' as Career['seasonSlot'],
    };
    expect(conditionContext(career, 'late').appearances).toBe(20);
    expect(conditionContext(career, 'mid').appearances).toBe(20);
  });

  it('still reads this season once the first half has been played', () => {
    const career: Career = {
      ...seniorAt(TOP),
      firstHalfStats: { ...seasonAt(TOP).stats, appearances: 3 },
    };
    expect(conditionContext(career, 'mid').appearances).toBe(3);
  });

  it('gives every world event a reachable club-strength window', () => {
    // A window no club in the game satisfies is dead content, and that is how three of these
    // events shipped firing 0% of the time.
    for (const event of WORLD_EVENTS) {
      const c = event.conditions ?? {};
      if (c.minClubStrength === undefined && c.maxClubStrength === undefined) continue;
      const tiers = c.clubLeagueTier;
      const reachable = ALL_CLUBS.filter((club) => {
        if (club.isSenior !== true) return false;
        const league = leagueOf(emptyWorld(), club.id);
        if (tiers && !tiers.includes(league.tier)) return false;
        const strength = clubStrengthVsLeague(emptyWorld(), club.id);
        if (c.minClubStrength !== undefined && strength < c.minClubStrength) return false;
        if (c.maxClubStrength !== undefined && strength > c.maxClubStrength) return false;
        return true;
      });
      expect(reachable.length, `${event.id} matches no club`).toBeGreaterThan(0);
    }
  });
});

describe('saves written before the world existed', () => {
  /**
   * v0.4 added Career.world without bumping the schema, so a v0.3.1 save still passes the
   * version check and gets loaded — and the first thing the season loop does is read
   * world.clubLeagues. Before hydrateCareer, loading one crashed the game outright, which is
   * exactly the failure the checkpoint policy exists to prevent.
   */
  const v031Save = (): Career => {
    const fresh = createCareer({ playerName: 'ל', position: 'CM', seed: 5 });
    const plain = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
    delete plain.world;
    return plain as unknown as Career;
  };

  it('gets an empty world rather than a missing one', () => {
    const hydrated = hydrateCareer(v031Save());
    expect(hydrated.world).toBeDefined();
    expect(hydrated.world.clubLeagues).toEqual({});
    expect(hydrated.world.clubSeasons).toEqual([]);
  });

  it('can be played on without crashing', () => {
    let career = hydrateCareer(v031Save());
    expect(() => {
      for (let i = 0; i < 20 && !career.retired; i += 1) {
        switch (career.phase) {
          case 'origin':
            career = continueAfterOrigin(career);
            break;
          case 'preseason':
            career = beginSeason(career);
            break;
          case 'event':
            career = continueAfterEvent(career);
            break;
          default:
            i = 20;
        }
      }
    }).not.toThrow();
    expect(leagueOf(career.world, career.currentClubId)).toBeDefined();
  });

  it('leaves a career that already has a world untouched', () => {
    const fresh = createCareer({ playerName: 'ל', position: 'CM', seed: 5 });
    expect(hydrateCareer(fresh)).toBe(fresh);
  });
});

describe('the career ladder', () => {
  it('reads a move to a stronger league as upward and the reverse as downward', () => {
    expect(isUpwardMove(moveDirection(seniorAt(SECOND), getClub(TOP)))).toBe(true);
    expect(isDownwardMove(moveDirection(seniorAt(TOP), getClub(SECOND)))).toBe(true);
    // Two top-flight clubs at comparable career level are a sideways move.
    expect(moveDirection(seniorAt(TOP), getClub('maccabi_tel_aviv'))).toBe('lateral');
  });

  it('understands club level, not only which league it is', () => {
    /*
     * The v0.4 defect this replaced: direction read league level alone, so Hapoel Hadera ->
     * Maccabi Haifa and Maccabi Haifa -> Hapoel Hadera both came out "lateral" because they share
     * a division. A move's direction is about the club's career level.
     */
    expect(moveDirection(seniorAt('bnei_sakhnin'), getClub(TOP))).toBe('up');
    expect(moveDirection(seniorAt(TOP), getClub('bnei_sakhnin'))).toBe('down');
  });

  it('reserves the major bands for genuine leaps', () => {
    expect(moveDirection(seniorAt(SECOND), getClub(TOP))).toBe('major_up');
    expect(moveDirection(seniorAt(TOP), getClub(SECOND))).toBe('major_down');
    expect(moveDirection(seniorAt('napoli'), getClub('sturm_graz'))).toBe('major_down');
    // ...and not for a step between neighbours in the same division.
    expect(moveDirection(seniorAt('bnei_sakhnin'), getClub(TOP))).not.toBe('major_up');
  });

  it('ranks clubs by league, squad and prestige together', () => {
    const career = seniorAt(TOP);
    const level = (id: string): number => clubCareerLevel(career, id);
    expect(level('napoli')).toBeGreaterThan(level('benfica'));
    expect(level('benfica')).toBeGreaterThan(level(TOP));
    expect(level(TOP)).toBeGreaterThan(level('bnei_sakhnin'));
    expect(level('bnei_sakhnin')).toBeGreaterThan(level(SECOND));
  });

  it('lowers a club career level when it is relegated', () => {
    const career = seniorAt('bnei_sakhnin');
    const top = clubCareerLevel(career, TOP);
    const dropped: Career = {
      ...career,
      world: applyPromotionRelegation(career.world, {
        season: 2042,
        clubId: TOP,
        leagueId: 'il_premier',
        outcome: 'relegated',
        label: 'ירדה ליגה',
        playerImpact: 0.1,
      }),
    };
    expect(clubCareerLevel(dropped, TOP)).toBeLessThan(top);
    // Still the bigger club, though - a fallen giant is not Hapoel Hadera.
    expect(clubCareerLevel(dropped, TOP)).toBeGreaterThan(clubCareerLevel(dropped, 'bnei_sakhnin'));
  });

  it('treats direction as symmetric', () => {
    const pairs: Array<[string, string]> = [
      ['bnei_sakhnin', TOP],
      [SECOND, 'napoli'],
      ['sturm_graz', 'benfica'],
    ];
    for (const [a, b] of pairs) {
      expect(isUpwardMove(moveDirection(seniorAt(a), getClub(b)))).toBe(true);
      expect(isDownwardMove(moveDirection(seniorAt(b), getClub(a)))).toBe(true);
    }
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

describe('the ambient Maccabi world (v0.4.1)', () => {
  /*
   * v0.4 only simulated the club the player was standing in, so the moment he left, Maccabi
   * stopped existing until he came back — which undercuts the premise that Maccabi is the fixed
   * star he navigates by.
   */
  const away = (): Career => seniorAt('hapoel_afula');

  it('gives Maccabi a season while the player is elsewhere', () => {
    const career = away();
    const world = recordMaccabiSeason(career, createRng(3));
    expect((world.maccabiSeasons ?? []).length).toBe(1);
    expect((world.maccabiSeasons ?? [])[0]?.clubId).toBe(MACCABI_ID);
  });

  it('does not double-count when the player is actually there', () => {
    const home = seniorAt(TOP);
    expect(recordMaccabiSeason(home, createRng(3)).maccabiSeasons ?? []).toEqual([]);
  });

  it('credits the player with no impact on a season he was not part of', () => {
    const result = simulateMaccabiSeason(away(), createRng(9));
    expect(result.playerImpact).toBe(0);
  });

  it('survives cloning', () => {
    /*
     * cloneCareer rebuilt `world` field by field, which silently dropped maccabiSeasons the moment
     * it was added — every clone wiped the ambient world, so it read as permanently empty.
     */
    const career: Career = { ...away(), world: recordMaccabiSeason(away(), createRng(3)) };
    expect(cloneCareer(career).world.maccabiSeasons).toHaveLength(1);
  });

  it('can produce a bad Maccabi season, not only good ones', () => {
    /*
     * rng.gaussian is hard-bounded to +/- spread, so a club whose expected finish was five rungs
     * up could not be relegated at all — "strong clubs occasionally implode" was a comment
     * describing something the maths forbade. simulateMaccabiSeason uses a real normal now.
     */
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 4000; seed += 1) {
      outcomes.add(simulateMaccabiSeason(away(), createRng(seed)).outcome);
    }
    expect(outcomes).toContain('champion');
    expect(outcomes.size).toBeGreaterThan(4);
    // A dominant club should reach the bottom half sometimes, however rarely.
    expect(
      [...outcomes].some((o) => ['mid_table', 'lower_table', 'relegation_battle', 'relegated'].includes(o)),
    ).toBe(true);
  });

  it('reads only the seasons he missed when asking what Maccabi just did', () => {
    // Otherwise "they won it without you" fires for a player who lifted the trophy himself.
    const career = away();
    expect(lastAmbientMaccabiSeason(career)).toBeNull();
    const withSeason: Career = { ...career, world: recordMaccabiSeason(career, createRng(3)) };
    expect(lastAmbientMaccabiSeason(withSeason)).not.toBeNull();
  });
});

describe('a homecoming reads the current world (v0.4.1)', () => {
  it('advertises the division Maccabi is actually in', () => {
    const career: Career = {
      ...seniorAt('benfica'),
      maccabi: { ...seniorAt('benfica').maccabi, appearances: 150, seasons: 5, everLeft: true },
    };
    const relegated: Career = {
      ...career,
      world: applyPromotionRelegation(career.world, {
        season: 2042,
        clubId: MACCABI_ID,
        leagueId: 'il_premier',
        outcome: 'relegated',
        label: 'ירדה ליגה',
        playerImpact: 0,
      }),
    };
    // The static club record still says ליגת העל; the offer must not.
    expect(getClub(MACCABI_ID).league).toBe('ליגת העל');
    const offer = buildReturnHomeOffer(relegated);
    expect(offer.league).toBe(getLeague('il_leumit').name);
    expect(offer.leagueId).toBe('il_leumit');
  });

  it('advertises the top flight again once they are back', () => {
    const career: Career = {
      ...seniorAt('benfica'),
      maccabi: { ...seniorAt('benfica').maccabi, appearances: 150, seasons: 5, everLeft: true },
    };
    expect(buildReturnHomeOffer(career).leagueId).toBe('il_premier');
  });
});

describe('player impact on the club season (v0.4.1)', () => {
  const record = (over: Partial<SeasonRecord['stats']> = {}, ability = 70, trust = 60): SeasonRecord => ({
    ...seasonAt(TOP),
    ability,
    coachTrust: trust,
    stats: { ...seasonAt(TOP).stats, appearances: 40, starts: 38, rating: 70, ...over },
  });

  it('lets a key player help', () => {
    expect(playerImpact(seniorAt(TOP), record())).toBeGreaterThan(0);
  });

  it('lets a bad season from a key player hurt, a little', () => {
    const bad = playerImpact(seniorAt(TOP), record({ rating: 34 }, 44, 20));
    expect(bad).toBeLessThan(0);
    // But nobody relegates a club by himself: the floor is a fraction of the ceiling.
    expect(Math.abs(bad)).toBeLessThan(playerImpact(seniorAt(TOP), record({ rating: 82 }, 88, 90)));
  });

  it('barely registers either way for a backup', () => {
    const backup = playerImpact(seniorAt(TOP), record({ appearances: 4, starts: 1, rating: 34 }, 44, 20));
    expect(Math.abs(backup)).toBeLessThan(0.05);
  });
});

describe('offer direction labels (v0.4.5)', () => {
  /*
   * This shipped broken. The chip read `direction === 'up' ? 'צעד קדימה' : 'צעד אחורה'`, written
   * when MoveDirection had three values; v0.4.1 added major_up and major_down and the comparison
   * silently became false for them, so a Napoli offer to a Maccabi player was labelled "צעד
   * אחורה" while its own hints said "ליגה חזקה יותר". TypeScript could not catch it.
   */
  const ALL: MoveDirection[] = ['major_up', 'up', 'lateral', 'down', 'major_down'];

  it('labels every direction, or deliberately none', () => {
    for (const direction of ALL) {
      expect(DIRECTION_LABELS).toHaveProperty(direction);
      expect(DIRECTION_TONES).toHaveProperty(direction);
    }
    // Lateral is the only one without a badge: the expected role is the story there.
    expect(DIRECTION_LABELS.lateral).toBeNull();
  });

  it('never labels an upward move as a step back', () => {
    for (const direction of ['major_up', 'up'] as MoveDirection[]) {
      const label = DIRECTION_LABELS[direction];
      expect(label, direction).not.toBeNull();
      expect(label, direction).not.toContain('אחורה');
      expect(label, direction).not.toContain('ירידת');
      expect(['gold', 'green']).toContain(DIRECTION_TONES[direction]);
    }
  });

  it('never labels a downward move as progress', () => {
    for (const direction of ['down', 'major_down'] as MoveDirection[]) {
      expect(DIRECTION_LABELS[direction], direction).not.toContain('קדימה');
      expect(DIRECTION_LABELS[direction], direction).not.toContain('קפיצת');
      expect(DIRECTION_TONES[direction]).toBe('warn');
    }
  });

  it('matches what the engine actually reports for a real offer', () => {
    // Maccabi -> Napoli is a major step up; the chip must agree with clubCareerLevel.
    const direction = moveDirection(seniorAt(TOP), getClub('napoli'));
    expect(direction).toBe('major_up');
    expect(DIRECTION_TONES[direction]).toBe('gold');
  });
});

describe('promotion and relegation rates (v0.4.5.1)', () => {
  /*
   * Measured per season, which is the only way to tell whether a rate is sane - a 45%
   * career-lifetime figure over 17 seasons is arithmetic, not a balance problem.
   *
   * SECOND_OUTCOMES had four rungs, so 'promoted' was one outcome in four: a 25% base rate before
   * any strength adjustment, and 51% of all second-division seasons in practice. Real football is
   * nearer 15%. Six rungs brings it to ~18%.
   */
  it('gives the second division six rungs, so promotion is not one-in-four', () => {
    const career = seniorAt(SECOND);
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 4000; seed += 1) {
      outcomes.add(simulateClubSeason(career, seasonAt(SECOND), createRng(seed)).outcome);
    }
    // Every rung reachable, and enough of them that promotion is a minority outcome.
    expect(outcomes.size).toBeGreaterThanOrEqual(4);
    const promoted = Array.from({ length: 4000 }, (_, i) =>
      simulateClubSeason(career, seasonAt(SECOND), createRng(i + 1)).outcome,
    ).filter((o) => o === 'promoted').length;
    expect(promoted / 4000).toBeLessThan(0.35);
  });

  it('labels every outcome the ladders can produce', () => {
    const career = seniorAt(SECOND);
    for (let seed = 1; seed <= 2000; seed += 1) {
      const result = simulateClubSeason(career, seasonAt(SECOND), createRng(seed));
      expect(result.label, result.outcome).toBeTruthy();
    }
    const top = seniorAt(TOP);
    for (let seed = 1; seed <= 2000; seed += 1) {
      const result = simulateClubSeason(top, seasonAt(TOP), createRng(seed));
      expect(result.label, result.outcome).toBeTruthy();
    }
  });
});

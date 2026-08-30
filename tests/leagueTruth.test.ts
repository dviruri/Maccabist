/**
 * League truth: static identity vs current world vs completed season (v0.6.5.2, Checkpoint C).
 *
 * The bugs this suite was written to expose, all of the same shape - code reading a static
 * `Club` field as though it were a statement about the present:
 *
 *   1. A release offer from Hapoel Hadera advertised ליגת העל. The club has been in Liga Alef
 *      since the 2026/27 snapshot; only `club.league` still said otherwise, and the player
 *      signed into the division the ENGINE chose, so the text and the game disagreed.
 *   2. `levelContext` reported the same stale league, and with it the stale fixture count - a
 *      relegated player kept playing a top-flight schedule.
 *   3. Every historical denominator - impact, valuation, stagnation, the integrity ceiling,
 *      the season card - divided by the club's CURRENT schedule. Promote the club and a
 *      finished season was silently re-scored years after it ended.
 *
 * The third is the one with the hard rule attached: history is a record, not a query. A season
 * played in Liga Alef stays a Liga Alef season forever, and nothing here may re-derive it from
 * where the club plays today.
 */

import { describe, expect, it } from 'vitest';

import { ACTIVE_CLUBS, MACCABI_ID, getClub } from '../src/data/clubs';
import { getLeague } from '../src/data/leagues';
import { leagueShape } from '../src/data/leagueShape';
import { snapshotLeagueOf } from '../src/data/worldClubs';
import { createCareer } from '../src/game/careerEngine';
import {
  currentLeagueName,
  currentLeagueOf,
  historicalLeagueId,
  leagueSeasonGames,
  seasonFixtures,
} from '../src/game/leagueTruth';
import { createRng } from '../src/game/random';
import { levelContext } from '../src/game/rules';
import { generateOffers, seniorTransitionOffers } from '../src/game/transferEngine';
import { emptyWorld, leagueOf, playerImpact } from '../src/game/worldEngine';
import type { Career, SeasonRecord, WorldState } from '../src/types';

function player(overrides: Partial<Career> = {}, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 70,
    roleValue: 65,
    reputation: 50,
    currentSeason: 2044,
    ...overrides,
  };
}

function record(overrides: Partial<SeasonRecord> = {}): SeasonRecord {
  return {
    season: 2044,
    age: 24,
    academyStage: 'senior',
    clubId: MACCABI_ID,
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    onLoan: false,
    ability: 70,
    role: 'starter',
    stats: {
      appearances: 20,
      goals: 5,
      assists: 3,
      rating: 6.9,
      minutes: 1600,
      cleanSheets: 0,
      yellowCards: 2,
      redCards: 0,
    },
    ...overrides,
  } as SeasonRecord;
}

/** A world in which one club has been moved to a named league. */
function worldWith(clubId: string, leagueId: string): WorldState {
  return { ...emptyWorld(), clubLeagues: { [clubId]: leagueId } };
}

/* ------------------------------------------------------------------ */
/* A. Current world truth beats the static field                       */
/* ------------------------------------------------------------------ */

describe('A: the current league comes from the world, not the club record', () => {
  it('names the division the club is actually in, for every club', () => {
    const world = emptyWorld();
    for (const club of ACTIVE_CLUBS) {
      const snapshot = snapshotLeagueOf(club.id);
      if (!snapshot) continue;
      expect(currentLeagueName(world, club), club.id).toBe(getLeague(snapshot).name);
    }
  });

  it('disagrees with the static field exactly where the snapshot moved a club', () => {
    const world = emptyWorld();
    const moved = ACTIVE_CLUBS.filter((c) => {
      const snapshot = snapshotLeagueOf(c.id);
      return snapshot && getLeague(snapshot).name !== c.league;
    });
    // Not a hypothetical: the dataset really does carry clubs whose stored league is wrong.
    expect(moved.length).toBeGreaterThan(0);
    for (const club of moved) {
      expect(currentLeagueName(world, club)).not.toBe(club.league);
    }
  });

  it('follows a club that is relegated inside a career', () => {
    const club = getClub(MACCABI_ID);
    const before = currentLeagueName(emptyWorld(), club);
    const after = currentLeagueName(worldWith(MACCABI_ID, 'il_leumit'), club);
    expect(before).toBe('ליגת העל');
    expect(after).toBe('הליגה הלאומית');
  });

  it('agrees with worldEngine.leagueOf, which now delegates to it', () => {
    const world = worldWith('hapoel_hadera', 'il_premier');
    for (const club of ACTIVE_CLUBS) {
      expect(currentLeagueOf(world, club).id, club.id).toBe(leagueOf(world, club.id).id);
    }
  });
});

/* ------------------------------------------------------------------ */
/* B. levelContext                                                     */
/* ------------------------------------------------------------------ */

describe('B: the player level reflects where his club plays now', () => {
  it('reports Liga Alef when the world has put the club in Liga Alef', () => {
    const career = player({ world: worldWith(MACCABI_ID, 'il_alef_south') });
    expect(levelContext(career).league).toBe('ליגה א׳ דרום');
  });

  it('reports the moved club correctly even from the untouched snapshot', () => {
    const career = player({ currentClubId: 'hapoel_hadera' });
    expect(getClub('hapoel_hadera').league).toBe('ליגת העל'); // the stale field, still there
    expect(levelContext(career).league).toBe('ליגה א׳ דרום'); // the truth
  });

  it('changes the schedule to the one the new division actually plays', () => {
    /*
     * Note what this does NOT assert: that relegation means fewer games. Liga Alef has 18 clubs
     * to Ligat Ha'Al's 14, so its round-robin is 34 games against 26 + 7 playoff - a relegated
     * player plays a LONGER league season. The claim is only that the number follows the
     * division, which is the whole point.
     */
    const quality = getClub(MACCABI_ID).quality;
    const top = levelContext(player()).seasonGames;
    const alef = levelContext(player({ world: worldWith(MACCABI_ID, 'il_alef_south') })).seasonGames;
    expect(top).toBe(leagueSeasonGames('il_premier', quality, true));
    expect(alef).toBe(leagueSeasonGames('il_alef_south', quality, true));
    expect(alef).not.toBe(top);
  });

  it('stops counting European nights for a division that qualifies nobody', () => {
    const quality = getClub(MACCABI_ID).quality;
    expect(quality).toBeGreaterThanOrEqual(66); // otherwise this proves nothing
    const alefShape = leagueShape('il_alef_south');
    expect(alefShape?.europePlaces ?? 0).toBe(0);
    // Pure league + cup, with no continental fixtures smuggled in by club quality.
    expect(leagueSeasonGames('il_alef_south', quality, true)).toBe(
      ((alefShape?.size ?? 0) - 1) * 2 + 2,
    );
  });

  it("derives the round-robin from the division's real size", () => {
    for (const leagueId of ['il_premier', 'il_leumit', 'il_alef_north', 'il_alef_south']) {
      const size = leagueShape(leagueId)?.size ?? 0;
      // Quality 60 is below every European band, so this isolates league + playoff + cup.
      const games = leagueSeasonGames(leagueId, 60, true);
      const playoff = leagueId === 'il_premier' ? 7 : 0;
      expect(games, leagueId).toBe((size - 1) * 2 + playoff + 2);
    }
  });
});

/* ------------------------------------------------------------------ */
/* C. Offers                                                           */
/* ------------------------------------------------------------------ */

describe('C: every offer names the league the player would actually join', () => {
  it('never advertises a league the club is not in', () => {
    const world = worldWith('hapoel_hadera', 'il_premier');
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = player({ world, reputation: 30, ability: 58, roleValue: 40 }, seed);
      const offers = [
        ...generateOffers(career, createRng(seed)),
        ...seniorTransitionOffers(career, { path: 'contract_loan' } as never, createRng(seed)),
      ];
      for (const offer of offers) {
        const club = ACTIVE_CLUBS.find((c) => c.id === offer.clubId);
        if (!club) continue;
        expect(offer.league, `${offer.id}`).toBe(currentLeagueName(world, club));
      }
    }
  });

  it('says Liga Alef in the release offer body when the club is in Liga Alef', () => {
    /*
     * Scenario A from the brief, stated at the level the player sees: not just the `league`
     * field, but the sentence. The description interpolated `club.league` separately, so the
     * chip and the prose could disagree with each other as well as with the world.
     */
    const world = worldWith('hapoel_hadera', 'il_alef_south');
    let checked = 0;
    for (let seed = 1; seed <= 200 && checked < 3; seed += 1) {
      const career = player({ world, reputation: 20, ability: 55, roleValue: 30 }, seed);
      for (const offer of seniorTransitionOffers(career, { path: 'released' } as never, createRng(seed))) {
        if (offer.kind !== 'release' || offer.clubId !== 'hapoel_hadera') continue;
        checked += 1;
        expect(offer.league).toBe('ליגה א׳ דרום');
        expect(offer.description).toContain('ליגה א׳ דרום');
        expect(offer.description).not.toContain('מליגת העל');
      }
    }
    expect(checked, 'no release offer from Hapoel Hadera was generated to check').toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* D. History is a record, not a query                                 */
/* ------------------------------------------------------------------ */

describe('D: a completed season never changes league', () => {
  it('keeps the recorded league after the club is promoted twice', () => {
    const past = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום', leagueId: 'il_alef_south' });
    const laterWorld = worldWith('hapoel_hadera', 'il_premier');
    expect(historicalLeagueId(past)).toBe('il_alef_south');
    // The world has moved on. The record has not.
    expect(leagueOf(laterWorld, 'hapoel_hadera').id).toBe('il_premier');
    expect(historicalLeagueId(past)).toBe('il_alef_south');
  });

  it("scores a finished season against its own schedule, not the club's current one", () => {
    const alefSeason = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום', leagueId: 'il_alef_south' });
    const topSeason = record({ clubId: 'hapoel_hadera', league: 'ליגת העל', leagueId: 'il_premier' });
    const quality = getClub('hapoel_hadera').quality;
    expect(seasonFixtures(alefSeason)).toBe(leagueSeasonGames('il_alef_south', quality, true));
    expect(seasonFixtures(topSeason)).toBe(leagueSeasonGames('il_premier', quality, true));
    expect(seasonFixtures(alefSeason)).not.toBe(seasonFixtures(topSeason));

    // Promoting the club must not move either number.
    const before = seasonFixtures(alefSeason);
    void leagueOf(worldWith('hapoel_hadera', 'il_premier'), 'hapoel_hadera');
    expect(seasonFixtures(alefSeason)).toBe(before);
  });

  it('gives the same impact for a season however the world has changed since', () => {
    const past = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום', leagueId: 'il_alef_south' });
    const settled = player({ world: emptyWorld(), lastSeasonRecord: past });
    const promoted = player({ world: worldWith('hapoel_hadera', 'il_premier'), lastSeasonRecord: past });
    expect(playerImpact(promoted, past)).toBe(playerImpact(settled, past));
  });

  it('falls back to the recorded league NAME for a pre-v0.6.5.2 save', () => {
    /*
     * Old records carry only the display name. They must still resolve - a save from v0.6.5.1
     * cannot be told its history is unreadable - and must resolve to the league they name,
     * never to wherever the club sits today.
     */
    const old = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום' });
    expect(old.leagueId).toBeUndefined();
    expect(historicalLeagueId(old)).toBe('il_alef_south');
    expect(seasonFixtures(old)).toBe(leagueSeasonGames('il_alef_south', getClub('hapoel_hadera').quality, true));
  });

  it('returns a usable number for a record whose league cannot be resolved at all', () => {
    const strange = record({ league: 'ליגה שלא קיימת' });
    expect(historicalLeagueId(strange)).toBeNull();
    expect(seasonFixtures(strange)).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* E. The static fields, honestly labelled                             */
/* ------------------------------------------------------------------ */

describe('E: static club fields are identity, not state', () => {
  it('still exposes club.league, because old saves and unmodelled clubs need a fallback', () => {
    // Not a demand that it be right - a demand that nothing in the engine treats it as truth.
    expect(typeof getClub(MACCABI_ID).league).toBe('string');
  });

  it('keeps tier as a career band, decoupled from the division', () => {
    /*
     * Two clubs in the same division may sit in different tiers and that is correct: tier
     * answers "what kind of move is this for a player", not "which table is this club in".
     * The test pins the decoupling so nobody later "fixes" tier to match the league.
     */
    const premier = ACTIVE_CLUBS.filter((c) => snapshotLeagueOf(c.id) === 'il_premier');
    expect(new Set(premier.map((c) => c.tier)).size).toBeGreaterThan(1);
  });
});

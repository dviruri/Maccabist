/**
 * Match score orientation (v0.9.3, Phase 1).
 *
 * Playtesting found the matchday scoreboard reading backwards. Nothing was miscounted: the board
 * put the player's club first in the DOM (the RIGHT side, in an RTL document) and then printed
 * the score as one LTR string, so the digit drawn beside his club was the OPPONENT's. Correct
 * numbers, wrong pairing - and the pairing was left to text direction.
 *
 * These tests hold the rule that replaces it: `homeClubId`, `awayClubId`, `homeScore` and
 * `awayScore` mean one thing each, RTL may move a club to the other side of the screen and may
 * not move a number away from its club, and every matchday surface resolves to the same result.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import type { PresentationFixture } from '../src/game/fixture';
import { activeFixture } from '../src/game/fixture';
import {
  matchScoreView,
  matchScoreViewAfter,
  matchVerdict,
  scoringSide,
  verdictLabel,
} from '../src/game/matchScore';
import { buildMatchday } from '../src/game/matchdayPresenter';
import { createRng } from '../src/game/random';
import { playFirstHalf } from '../src/game/seasonEngine';
import { openWorldSeason } from '../src/game/worldEngine';
import type { Career } from '../src/types';

const ROOT = path.resolve(__dirname, '..');

/** A fixture with an explicit venue - the only thing the model needs beyond the two scores. */
function fixture(home: boolean): PresentationFixture {
  return {
    id: 'test_fixture',
    kind: 'league',
    season: 2044,
    competition: 'ליגת העל',
    playerClubId: MACCABI_ID,
    playerClubName: 'מכבי חיפה',
    opponentClubId: 'maccabi_netanya',
    opponentName: 'מכבי נתניה',
    home,
    homeClubId: home ? MACCABI_ID : 'maccabi_netanya',
    awayClubId: home ? 'maccabi_netanya' : MACCABI_ID,
    context: null,
    playerPosition: null,
    opponentPosition: null,
    pointsGap: null,
  };
}

describe('the four facts stay attached to the right clubs', () => {
  it('1: the home team wins 2-1', () => {
    // Player at home, two goals for, one against: Haifa 2 Netanya 1.
    const view = matchScoreView(fixture(true), 2, 1);
    expect(view.homeClubName).toBe('מכבי חיפה');
    expect(view.homeScore).toBe(2);
    expect(view.awayClubName).toBe('מכבי נתניה');
    expect(view.awayScore).toBe(1);
    expect(matchVerdict(view)).toBe('win');
  });

  it('2: the away team wins 1-2', () => {
    /*
     * The same two numbers with the venue flipped. `scoreFor` is ALWAYS the player's club, so a
     * 2-1 win away is Netanya 1 Haifa 2 - and this is precisely the case the old board got
     * wrong, because it never consulted the venue at all.
     */
    const view = matchScoreView(fixture(false), 2, 1);
    expect(view.homeClubName).toBe('מכבי נתניה');
    expect(view.homeScore).toBe(1);
    expect(view.awayClubName).toBe('מכבי חיפה');
    expect(view.awayScore).toBe(2);
    expect(matchVerdict(view)).toBe('win');
    expect(verdictLabel(view)).toBe('ניצחון');
  });

  it('3: a draw is a draw at either end', () => {
    for (const home of [true, false]) {
      const view = matchScoreView(fixture(home), 1, 1);
      expect(view.homeScore).toBe(1);
      expect(view.awayScore).toBe(1);
      expect(matchVerdict(view)).toBe('draw');
      expect(verdictLabel(view)).toBe('תיקו');
    }
  });

  it('4: the player club as home team occupies the home slot', () => {
    const view = matchScoreView(fixture(true), 0, 3);
    expect(view.playerIsHome).toBe(true);
    expect(view.home.isPlayerClub).toBe(true);
    expect(view.away.isPlayerClub).toBe(false);
    expect(view.homeClubId).toBe(MACCABI_ID);
    // Losing 0-3 at home reads as a home 0 and an away 3, not the other way round.
    expect(view.homeScore).toBe(0);
    expect(view.awayScore).toBe(3);
    expect(matchVerdict(view)).toBe('loss');
  });

  it('5: the player club as away team occupies the away slot', () => {
    const view = matchScoreView(fixture(false), 0, 3);
    expect(view.playerIsHome).toBe(false);
    expect(view.away.isPlayerClub).toBe(true);
    expect(view.awayClubId).toBe(MACCABI_ID);
    expect(view.homeClubId).toBe('maccabi_netanya');
    expect(view.homeScore).toBe(3);
    expect(view.awayScore).toBe(0);
    expect(matchVerdict(view)).toBe('loss');
  });

  it('the model agrees with the fixture it was built from, at every venue', () => {
    for (const home of [true, false]) {
      const f = fixture(home);
      const view = matchScoreView(f, 2, 1);
      expect(view.homeClubId).toBe(f.homeClubId);
      expect(view.awayClubId).toBe(f.awayClubId);
    }
  });
});

describe('6: RTL cannot invert the result', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
  const board = /\.gf-board\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

  it('the scoreboard container declares its own direction rather than inheriting RTL', () => {
    expect(board).toMatch(/direction:\s*ltr/);
  });

  it('each score cell is drawn adjacent to ITS OWN club cell', () => {
    /*
     * The structural invariant, checked in the layout rather than trusted. The score row must
     * read `away awayScore sep homeScore home`: every score touches the club it belongs to, and
     * the two clubs are at opposite ends. This is what makes the pairing independent of writing
     * direction - the bug was that it was not.
     */
    const areas = /grid-template-areas:\s*([^;]*);/.exec(board)?.[1] ?? '';
    const row = /'([^']*(?:awayScore|homeScore)[^']*)'/.exec(areas)?.[1]?.trim().split(/\s+/) ?? [];
    expect(row).toEqual(['away', 'awayScore', 'sep', 'homeScore', 'home']);
    expect(row.indexOf('awayScore') - row.indexOf('away')).toBe(1);
    expect(row.indexOf('home') - row.indexOf('homeScore')).toBe(1);
  });

  it('the model itself carries no layout at all', () => {
    // A pure record: nothing here can be reordered by a stylesheet or a document direction.
    const view = matchScoreView(fixture(true), 2, 1);
    expect(Object.values(view).some((value) => typeof value === 'function')).toBe(false);
    expect(view.homeScore + view.awayScore).toBe(3);
  });

  it('no matchday surface builds a score string of its own', () => {
    /*
     * The one-source rule, enforced. `.gf-md-numbers` was the old combined score element and
     * `MatchScoreboard` is the only component allowed to name a home or away score.
     */
    const matchday = fs.readFileSync(path.join(ROOT, 'src/components/Matchday.tsx'), 'utf8');
    expect(matchday).not.toContain('gf-md-numbers');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      );
    const offenders = walk(path.join(ROOT, 'src/components'))
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('MatchScoreboard.tsx'))
      .filter((file) => {
        /*
         * Comments stripped first. This assertion has now caught its own explanation twice -
         * once in Phase 2 on a doc comment naming a component that had MOVED, and once here on
         * a comment explaining why this very rule exists. A comment is not a rendering.
         */
        const text = fs
          .readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        return text.includes('homeScore') || text.includes('awayScore');
      });
    expect(offenders).toEqual([]);
  });
});

describe('7: the live timeline and the scoreboard agree at every beat', () => {
  it('every goal moment moves exactly one club, and only its own', () => {
    expect(scoringSide('player_goal')).toBe('player_club');
    expect(scoringSide('player_assist')).toBe('player_club');
    expect(scoringSide('team_goal')).toBe('player_club');
    expect(scoringSide('conceded')).toBe('opponent_club');
    for (const kind of ['kickoff', 'chance', 'save', 'big_save', 'booking', 'half_time', 'full_time'] as const) {
      expect(scoringSide(kind)).toBeNull();
    }
  });

  it('the revealed score never runs ahead of the story, and lands exactly on the result', () => {
    const career = midSeason();
    const matchday = buildMatchday(career);
    expect(matchday).not.toBeNull();
    const { fixture: f, moments, scoreFor, scoreAgainst } = matchday!;

    let previousFor = 0;
    let previousAgainst = 0;
    for (let revealed = 0; revealed <= moments.length; revealed += 1) {
      const view = matchScoreViewAfter(f, moments, revealed);
      const mine = view.playerIsHome ? view.homeScore : view.awayScore;
      const theirs = view.playerIsHome ? view.awayScore : view.homeScore;
      // Monotonic: a scoreboard cannot un-score a goal.
      expect(mine).toBeGreaterThanOrEqual(previousFor);
      expect(theirs).toBeGreaterThanOrEqual(previousAgainst);
      // Never ahead of the final result either.
      expect(mine).toBeLessThanOrEqual(scoreFor);
      expect(theirs).toBeLessThanOrEqual(scoreAgainst);
      previousFor = mine;
      previousAgainst = theirs;
    }

    const finalView = matchScoreViewAfter(f, moments, moments.length);
    expect(finalView).toEqual(matchScoreView(f, scoreFor, scoreAgainst));
  });

  it('the half-time score is the score at the half-time moment, in home/away terms', () => {
    const matchday = buildMatchday(midSeason())!;
    const halfTimeAt = matchday.moments.findIndex((moment) => moment.kind === 'half_time');
    expect(halfTimeAt).toBeGreaterThan(-1);
    const atHalfTime = matchScoreViewAfter(matchday.fixture, matchday.moments, halfTimeAt + 1);
    const goalsBefore = matchday.moments
      .slice(0, halfTimeAt + 1)
      .filter((moment) => scoringSide(moment.kind) !== null).length;
    expect(atHalfTime.homeScore + atHalfTime.awayScore).toBe(goalsBefore);
    // And the venue is still the fixture's, not the reveal's.
    expect(atHalfTime.playerIsHome).toBe(matchday.fixture.home);
  });
});

describe('8: matchday and match summary agree, on real careers', () => {
  it('the same fixture yields the same home/away result across many seeds', () => {
    let checked = 0;
    for (let seed = 1; seed <= 25; seed += 1) {
      const matchday = buildMatchday(midSeason(seed));
      if (!matchday) continue;
      checked += 1;
      const live = matchScoreViewAfter(matchday.fixture, matchday.moments, matchday.moments.length);
      const summary = matchScoreView(matchday.fixture, matchday.scoreFor, matchday.scoreAgainst);
      expect(live, `seed ${seed}`).toEqual(summary);
      /*
       * And the engine's own numbers survive the mapping: whichever slot the player's club
       * occupies, its score is the presenter's `scoreFor`.
       */
      const mine = summary.playerIsHome ? summary.homeScore : summary.awayScore;
      expect(mine, `seed ${seed}`).toBe(matchday.scoreFor);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('the fixture the home screen shows is the fixture the score is built on', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const career = midSeason(seed);
      const shown = activeFixture(career);
      const matchday = buildMatchday(career);
      if (!shown || !matchday) continue;
      const view = matchScoreView(matchday.fixture, matchday.scoreFor, matchday.scoreAgainst);
      expect(view.homeClubId, `seed ${seed}`).toBe(shown.homeClubId);
      expect(view.awayClubId, `seed ${seed}`).toBe(shown.awayClubId);
    }
  });
});

/** A senior career mid-season with a real simulated first half. */
function midSeason(seed = 5): Career {
  let career: Career = {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 72,
    roleValue: 62,
    currentSeason: 2044,
    seasonPoint: 'midseason',
    phase: 'mid_season',
  };
  career = { ...career, world: openWorldSeason(career, createRng(seed)) };
  career = playFirstHalf(career, createRng(seed + 1));
  return { ...career, seasonPoint: 'midseason', phase: 'mid_season' };
}

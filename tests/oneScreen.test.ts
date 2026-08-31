/**
 * One-screen game flow (v0.9.3).
 *
 * The measurement that matters here is a real browser at a real phone size, and it lives in
 * `scripts/viewportAudit.mjs` - a stylesheet cannot be unit-tested into fitting. What CAN be
 * held in a test is the information architecture that makes it fit, and that is what this file
 * guards: which screen owns which content, so the home screen cannot quietly grow a league
 * table again.
 *
 * The rule, stated once: HOME SUMMARISES, DESTINATIONS ARCHIVE. Every fact has exactly one full
 * rendering, in exactly one place.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { deriveCareerFeed } from '../src/game/careerFeed';
import { createRng } from '../src/game/random';
import { playFirstHalf } from '../src/game/seasonEngine';
import { openWorldSeason } from '../src/game/worldEngine';
import type { Career } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('the home screen holds no deep data surface', () => {
  const home = read('src/components/CareerHome.tsx');

  it('renders none of the archive components', () => {
    /*
     * Each of these has its own destination and its own screen. v0.9.2's home showed the league
     * strip and the whole Europe card inline, which is most of why the document wanted 1096px at
     * 390x844.
     */
    for (const component of [
      'LeagueTableCard',
      'EuropeStandings',
      'EuropeCard',
      'PlayerHub',
      'JourneyTimeline',
      'CareerJourney',
      'TrophyCabinet',
      'CareerTimeline',
      'LegacyCard',
      'PeopleCard',
    ]) {
      // `<Component` rather than the bare name: the file's own comment explains what MOVED,
      // and a doc comment is not a rendering.
      expect(home.includes(`<${component}`), `CareerHome renders ${component}`).toBe(false);
    }
  });

  it('caps the feed at two items and offers the rest as a destination', () => {
    const slice = /items\.slice\(0,\s*(\d+)\)/.exec(home);
    expect(slice, 'the home feed is not capped at all').not.toBeNull();
    expect(Number(slice![1])).toBeLessThanOrEqual(2);
    // And there is a way to reach the ones it did not show.
    expect(home).toContain('onOpenFeed');
  });

  it('reaches the league and Europe by a tap rather than by rendering them', () => {
    expect(home).toContain('onOpenTable');
    expect(home).toContain('onOpenEurope');
  });
});

describe('the destinations own the full renderings', () => {
  const page = read('src/pages/GamePage.tsx');

  it('the season strip and the Europe card render only inside sheets', () => {
    const firstSheet = page.indexOf('<Sheet');
    expect(firstSheet).toBeGreaterThan(0);
    for (const component of ['<SeasonStrip', '<EuropeCard', '<SeasonProgress', '<LeagueTableCard']) {
      const at = page.indexOf(component);
      expect(at, `${component} is missing entirely`).toBeGreaterThan(0);
      expect(at, `${component} renders above the sheets, i.e. on the home screen`).toBeGreaterThan(
        firstSheet,
      );
    }
  });

  it('nothing is rendered twice', () => {
    // One full rendering each: a duplicated card is two truths waiting to disagree.
    for (const component of ['<SeasonStrip', '<EuropeCard', '<EuropeStandings', '<LeagueTableCard']) {
      const count = page.split(component).length - 1;
      expect(count, `${component} appears ${count} times`).toBe(1);
    }
  });
});

describe('the matchday is a state machine, not a page', () => {
  const matchday = read('src/components/Matchday.tsx');
  const css = read('src/styles/gamefeel.css');

  it('has exactly four states, and derives which one is showing', () => {
    expect(matchday).toContain("type MatchdayState = 'preview' | 'live' | 'half_time' | 'full_time'");
    /*
     * Derived from `revealed`, not stored in a second piece of state. A stored state could drift
     * out of step with the story the reveal has actually told.
     */
    expect(matchday).toMatch(/const state: MatchdayState =/);
    expect(matchday).not.toMatch(/useState<MatchdayState>/);
    for (const state of ['preview', 'live', 'half_time', 'full_time']) {
      expect(matchday, `no branch for ${state}`).toContain(`state === '${state}'`);
    }
  });

  it('renders the moment list only inside the history panel', () => {
    /*
     * The v0.9.2 bug this replaces: every revealed moment stayed on screen, so full time sat
     * under a growing list. There is exactly one place that iterates the moments for display,
     * and it is behind the history button.
     */
    const iterations = matchday.match(/moments\.slice\(0, revealed\)\.map/g) ?? [];
    expect(iterations.length).toBe(1);
    const historyAt = matchday.indexOf('className="gf-md-history"');
    expect(historyAt).toBeGreaterThan(0);
    expect(matchday.indexOf('moments.slice(0, revealed).map')).toBeGreaterThan(historyAt);
  });

  it('gives the history its own scroll, so the match itself never needs one', () => {
    expect(/\.gf-md-history-list\s*\{[^}]*overflow-y:\s*auto/.test(css)).toBe(true);
    expect(/\.gf-matchday-screen\s*\{[^}]*height:\s*100dvh/.test(css)).toBe(true);
  });

  it('has one primary control and two visibly minor ones', () => {
    // The secondary actions are not GameButtons at all - that is what made all three equal.
    expect(matchday).toContain('gf-md-controls-minor');
    expect((matchday.match(/<GameButton/g) ?? []).length).toBe(2);
    expect((matchday.match(/className="gf-md-minor"/g) ?? []).length).toBe(2);
  });

  it('drops the app bottom padding for a screen that owns the viewport', () => {
    /*
     * `.app` adds 40px plus the safe-area inset for an ordinary page. A 100dvh child then makes
     * the document 884px tall at an 844px viewport - which is exactly what all four matchday
     * states measured before this rule existed.
     */
    expect(css).toContain('.app:has(.gf-matchday-screen)');
    expect(css).toContain('.app:has(.gf-moment-screen)');
  });
});

describe('a decision owns the viewport', () => {
  const page = read('src/pages/GamePage.tsx');
  const screen = read('src/components/DecisionScreen.tsx');

  it('renders no home scene while a choice is on screen', () => {
    expect(page).toContain('DECISION_PHASES');
    for (const phase of ['event', 'offseason', 'youth_to_senior', 'retirement_decision']) {
      expect(page, `${phase} is not a decision phase`).toContain(`'${phase}',`);
    }
    // The home scene is behind the guard, not beside it.
    expect(page).toContain('{!DECISION_PHASES.has(career.phase) && (');
  });

  it('keeps the bottom nav, so the table is still reachable before answering', () => {
    // Deliberate: the matchday and the ceremonies hide the nav, a decision does not.
    expect(page).toContain('<nav className="gf-bottomnav"');
  });

  it('shows no facts table on the deciding surface', () => {
    /*
     * The table is not gone - it moved into the details sheet. What must not happen is a
     * label-and-value grid dominating a screen whose subject is a choice.
     */
    const sheetAt = screen.indexOf('<Sheet');
    expect(sheetAt).toBeGreaterThan(0);
    expect(screen.indexOf('gf-dec-facts')).toBeGreaterThan(sheetAt);
    expect((screen.match(/<FactRow/g) ?? []).length).toBeGreaterThan(0);
    for (const at of [...screen.matchAll(/<FactRow/g)].map((m) => m.index ?? 0)) {
      expect(at, 'a FactRow renders outside the details sheet').toBeGreaterThan(sheetAt);
    }
  });

  it('pages offers with dots, not with a counter', () => {
    expect(screen).toContain('gf-dec-dots');
    expect(screen).toContain('gf-dec-dot-on');
    expect(screen).not.toContain('gf-dec-page-count');
    // Paging must not be able to lose an offer: the state is the index alone.
    expect((screen.match(/useState\(/g) ?? []).length).toBe(2);
  });

  it('carries the agent line and exactly two actions', () => {
    expect(screen).toContain('agentLine');
    expect((screen.match(/<GameButton/g) ?? []).length).toBe(2);
  });

  it('invents no contract facts', () => {
    /*
     * The game models no salary, no contract length and no appearance guarantee, so the decision
     * screen may not imply one. Checked as words rather than as intent.
     */
    for (const word of ['שכר', 'משכורת', 'בונוס', 'מיליון', '₪', 'יורו', 'דולר', 'עמלה']) {
      expect(screen.includes(word), `DecisionScreen mentions ${word}`).toBe(false);
    }
  });
});

describe('one navigation button, one destination', () => {
  const page = read('src/pages/GamePage.tsx');
  const home = read('src/components/CareerHome.tsx');

  it('has no toggling button left', () => {
    /*
     * v0.9.1 mapped five buttons onto six sheets, and מועדון resolved it by TOGGLING between the
     * people screen and the legacy record book - the same button meaning two things depending on
     * where you already were. Its own report called that out.
     */
    expect(page).not.toContain("'people'");
    expect(page).not.toContain("'legacy'");
    expect(page).toContain("'club'");
    /*
     * Every nav button either opens its own destination or closes it. A handler that sets a
     * DIFFERENT sheet is the toggle coming back.
     */
    for (const [, target, fallback] of page.matchAll(/setSheet\(sheet === '(\w+)' \? (null|'(\w+)') : '(\w+)'\)/g)) {
      expect(fallback).toBe('null');
      expect(target).toBeDefined();
    }
  });

  /**
   * The body of one sheet.
   *
   * Anchored on `<Sheet open={sheet === 'x'}` rather than on `sheet === 'x'`, which also matches
   * the nav button's own active-state check further up the file - the first version of these
   * three assertions sliced from the button and read the wrong sheet entirely.
   */
  const sheetBody = (id: string): string => {
    const at = page.indexOf(`<Sheet open={sheet === '${id}'}`);
    expect(at, `no sheet for ${id}`).toBeGreaterThan(0);
    return page.slice(at, page.indexOf('</Sheet>', at));
  };

  it('holds both club surfaces in the one destination the button opens', () => {
    const inside = sheetBody('club');
    expect(inside).toContain('<PeopleCard');
    expect(inside).toContain('<LegacyCard');
  });

  it('lands עוד on the story destination, showing the same lines it was truncating', () => {
    expect(home).toContain('export function CareerFeedFull');
    expect(sheetBody('timeline')).toContain('<CareerFeedFull');
    // One markup for a feed line, shared by both - so the home's two ARE the first two of these.
    expect((home.match(/className="gf-feed-item"/g) ?? []).length).toBe(1);
    expect((home.match(/deriveCareerFeed\(career\)/g) ?? []).length).toBe(2);
  });

  it('gives the career destination the trophies he has actually won', () => {
    expect(sheetBody('history')).toContain('<TrophyShowcase');
  });
});

describe('the feed is ordered by what a player acts on', () => {
  it('puts the agent first, then the coach, then the club, then media colour', () => {
    /*
     * Only the first two reach the home screen, so this order is a product decision rather than
     * a cosmetic one. Asserted on the real derivation, not on the source: a career with an offer
     * pending, a real coach relationship and a simulated half has all four speakers available.
     */
    const career = loud();
    const items = deriveCareerFeed(career);
    expect(items.length).toBeGreaterThan(1);
    const rank: Record<string, number> = { agent: 0, coach: 1, club: 2, media: 3, scout: 4 };
    const ranks = items.map((item) => rank[item.role] ?? 9);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('still returns at most four, and never a duplicate line', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const items = deriveCareerFeed(loud(seed));
      expect(items.length).toBeLessThanOrEqual(4);
      expect(new Set(items.map((item) => item.text)).size).toBe(items.length);
    }
  });
});

/** A senior career mid-season with a real simulated half - every feed speaker has material. */
function loud(seed = 5): Career {
  let career: Career = {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 26,
    ability: 76,
    roleValue: 70,
    coachTrust: 72,
    reputation: 66,
    currentSeason: 2046,
    seasonPoint: 'midseason',
    phase: 'mid_season',
  };
  career = { ...career, world: openWorldSeason(career, createRng(seed)) };
  career = playFirstHalf(career, createRng(seed + 1));
  return { ...career, seasonPoint: 'midseason', phase: 'mid_season' };
}

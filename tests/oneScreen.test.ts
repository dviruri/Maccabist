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
import { homeContextOf } from '../src/components/CareerHome';
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
    expect(page).toContain('const deciding = DECISION_PHASES.has(career.phase);');
    expect(page).toContain('{!deciding && (');
    // And the shell is exactly one viewport while a choice is on screen (Phase 8).
    expect(page).toContain("deciding ? ' play-fixed' : ''");
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
    /*
     * Paging must not be able to lose an offer, so nothing about an offer lives in state: the
     * index, whether the sheet is open, and which card has been committed. That last one is
     * v0.9.5's double-commit guard - see below.
     */
    expect((screen.match(/useState[<(]/g) ?? []).length).toBe(3);
  });

  it('ends in choice cards, not in a generic action row', () => {
    /*
     * The v0.9.5 grammar, asserted where it is easiest to regress. The screen used to be
     * information followed by two GameButtons labelled accept and decline; now the two sides of
     * the dilemma ARE the buttons, and pressing one commits. If a GameButton ever comes back to
     * this screen, the form has come back with it.
     */
    expect(screen).toContain('agentLine');
    expect(screen).not.toContain('<GameButton');
    expect((screen.match(/<DecisionChoiceCard/g) ?? []).length).toBe(2);
    /* One card for a mandatory offer: no stay side, because there is no stay. */
    expect(screen).toContain('count={mandatory ? 1 : 2}');
    expect(screen).toContain('{!mandatory && (');
  });

  it('guards against committing the same decision twice', () => {
    /* A second tap during the phase transition must not accept an offer and then decline it. */
    expect(screen).toContain('if (committed) return;');
    expect(screen).toContain("setCommitted('move')");
    expect(screen).toContain("setCommitted('stay')");
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

describe('typography fits one screen without shrinking', () => {
  const css = read('src/styles/gamefeel.css');

  it('declares the whole tier ladder', () => {
    for (const tier of [
      '--gf-score',
      '--gf-identity',
      '--gf-display',
      '--gf-hero',
      '--gf-number',
      '--gf-section',
      '--gf-lead',
      '--gf-body',
      '--gf-meta',
      '--gf-micro',
    ]) {
      expect(css.includes(`${tier}:`), `${tier} is not declared`).toBe(true);
    }
  });

  it('has no text below the 11.5px floor anywhere in the game layer', () => {
    /*
     * The brief's warning, made mechanical: do not solve one-screen layout by making fonts tiny.
     * Every literal size and every clamp minimum in this stylesheet is checked, so a future
     * "just drop it to 10px" is a failing test rather than a judgement call.
     */
    const tooSmall: string[] = [];
    for (const match of css.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1]!;
      // The decorative ghost glyph and the emoji sizes are not text a player reads.
      for (const number of value.match(/(\d+(?:\.\d+)?)px/g) ?? []) {
        const px = Number(number.replace('px', ''));
        // A clamp's MAXIMUM may legitimately be large; its minimum is the one that must hold.
        if (px < 11.5 && px > 0) tooSmall.push(`${value} (${number})`);
      }
    }
    expect(tooSmall).toEqual([]);
  });

  it('the priority elements resolve to a tier rather than to a magic number', () => {
    /*
     * The LAST declaration of a selector wins the cascade, so that is the one checked - a
     * regex-built lookup found the first and read an empty block on the first run.
     */
    const rule = (selector: string): string => {
      /*
       * Anchored on a line start. Without it, `.gf-md-now-text {` also matched the tail of
       * `.gf-md-now-break .gf-md-now-text {` - a compound rule, not the base one.
       */
      const at = css.lastIndexOf(`
${selector} {`);
      expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf('}', at));
    };
    expect(rule('.gf-board-num')).toContain('var(--gf-score)');
    expect(rule('.gf-hero-name')).toContain('var(--gf-identity)');
    expect(rule('.dc-title')).toContain('var(--gf-hero)');
    expect(rule('.gf-moment-title')).toContain('var(--gf-display)');
    expect(rule('.gf-md-ft')).toContain('var(--gf-display)');
    expect(rule('.gf-md-now-text')).toContain('var(--gf-hero)');
  });

  it('puts no bordered surface inside another one, in the game layer', () => {
    expect(css).toContain('.gf-glass .gf-glass');
    // Deliberately NOT a blanket .card .card reset - that would reach legacy surfaces blind.
    expect(css).not.toContain('.card .card {');
  });
});

describe('short viewports give way by showing less, not by shrinking', () => {
  const css = read('src/styles/gamefeel.css');

  it('has height tiers, because the one-screen rule is about height', () => {
    /*
     * v0.9.4 moved the aggressive tier from 620px to 660px: 360x640 is a real and common Android
     * and it fell in the gap between the tiers, getting the seam tightening and none of the content
     * reduction. This assertion caught that the threshold had moved AFTER the phase-1 commit had
     * already gone out - the focused run happened before the last CSS change of that phase.
     */
    for (const tier of ['max-height: 830px', 'max-height: 700px', 'max-height: 660px']) {
      expect(css.includes(`@media (${tier})`), `no ${tier} tier`).toBe(true);
    }
  });

  it('changes no font size inside any height tier', () => {
    /*
     * The brief's rule, enforced where it is easiest to break. Everything a short viewport does
     * is remove content or tighten space; if a `font-size` ever appears inside one of these
     * blocks, the release has started solving layout the forbidden way.
     *
     * Braces are counted rather than matched with a pattern - a media block contains nested
     * rules, so no single expression closes it correctly.
     */
    let from = css.indexOf('@media (max-height:');
    let checked = 0;
    while (from > -1) {
      const open = css.indexOf('{', from);
      let depth = 0;
      let i = open;
      for (; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const body = css.slice(open, i);
      expect(
        body.includes('font-size'),
        `a height tier changes a font size: ${body.slice(0, 200)}`,
      ).toBe(false);
      checked += 1;
      from = css.indexOf('@media (max-height:', i);
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('scopes the home feed rules so the story destination keeps the whole feed', () => {
    // Without the scope, dropping the second line on a 568px screen would truncate the full feed.
    expect(css).toContain('.gf-feed-home');
    expect(css).not.toMatch(/@media \(max-height[^{]*\{[^}]*\.gf-feed \.gf-feed-item/);
  });

  it('makes content reachable rather than hidden, wherever a region takes the scroll', () => {
    /*
     * The one thing the brief explicitly forbids: faking the measurement with overflow: hidden.
     * Every region that absorbs height in a tier scrolls, so its content is still reachable.
     */
    for (const selector of ['.event-choices', '.dc-scene-context', '.gf-md-history-list']) {
      /*
       * A RULE, not the first mention. Matching on the bare selector found the sentence in the
       * v0.9.5 block comment that explains which region takes the scroll and reported the
       * explanation as a missing rule. Requiring the opening brace finds the declaration whether
       * it is top level or nested inside a media query.
       */
      const at = css.indexOf(`${selector} {`);
      expect(at, `${selector} missing`).toBeGreaterThan(0);
      expect(css.slice(at, css.indexOf('}', at))).toContain('overflow-y: auto');
    }
  });

  it('drops the app bottom padding on every screen that owns its viewport', () => {
    /*
     * The same 40px, found three times by measurement: 884 against 844 on the matchday, 608
     * against 568 on the decision, and 40px of nothing under every screen with a bottom nav.
     */
    for (const rule of [
      '.app:has(.gf-matchday-screen)',
      '.app:has(.gf-moment-screen)',
      '.app:has(.play-fixed)',
      '.app:has(.gf-bottomnav)',
    ]) {
      expect(css.includes(rule), `${rule} is missing`).toBe(true);
    }
  });
});

describe('v0.9.4: every major moment is a full-screen state', () => {
  const page = read('src/pages/GamePage.tsx');
  const css = read('src/styles/gamefeel.css');

  it('resolves the season moments before the shell, not inside it', () => {
    /*
     * The bug this replaces: the season's moments were derived inside `PhaseView`, which renders in
     * `.play-main`. `season_result` is not a focused phase, so a championship arrived with the whole
     * home screen above it and the bottom navigation below it.
     */
    const derive = page.indexOf('deriveSeasonMoments(career)');
    const shell = page.indexOf('<div className={`shell play');
    expect(derive).toBeGreaterThan(0);
    expect(shell).toBeGreaterThan(0);
    expect(derive, 'season moments are derived after the shell opens').toBeLessThan(shell);
  });

  it('renders no moment screen inside the phase view any more', () => {
    const phaseView = page.slice(page.indexOf('function PhaseView'));
    expect(phaseView).not.toContain('<CareerMomentScreen');
    // And there is exactly one moment screen in the file: the full-screen one.
    expect((page.match(/<CareerMomentScreen/g) ?? []).length).toBe(1);
  });

  it('gives a full-screen state a width and a height its content uses', () => {
    /*
     * `.app` centres its child and `.shell` is what normally supplies the width, so a state that
     * returns before the shell had none: the championship rendered as a 240px column in the middle
     * of a 390px phone, subtitle wrapping into the button.
     */
    const rule = css.slice(css.indexOf('.gf-moment-screen,\n.gf-matchday-screen {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('width: var(--shell)');
    expect(css).toContain('.gf-moment-screen .gf-scene-content');
  });

  it('keeps the navigation off every full-screen state', () => {
    expect(css).toContain('.gf-matchday-screen ~ .gf-bottomnav');
    expect(css).toContain('.gf-moment-screen ~ .gf-bottomnav');
  });
});

describe('v0.9.4: the home screen has one contextual panel', () => {
  const home = read('src/components/CareerHome.tsx');

  it('picks exactly one state, in priority order', () => {
    const base = loud();
    /* An offer outranks everything: it is the most urgent thing a career can hold. */
    expect(
      homeContextOf({
        ...base,
        pendingOffers: [{ id: 'o', kind: 'transfer', clubId: 'bologna', clubName: 'בולוניה' } as never],
      }),
    ).toBe('offer');
    /* Europe outranks the feed when there is a real recorded campaign. */
    expect(homeContextOf(withEurope(base))).toBe('europe');
    /*
     * Otherwise the people around him - with Europe cleared explicitly, because a Maccabi Haifa
     * career in 2046 really does have a European campaign and the first version of this assertion
     * was testing the engine rather than the priority.
     */
    expect(homeContextOf({ ...base, world: { ...base.world, europe: null } as never })).toBe('feed');
  });

  it('an offer outranks Europe, so the two panels can never both appear', () => {
    const both = {
      ...withEurope(loud()),
      pendingOffers: [{ id: 'o', kind: 'transfer', clubId: 'bologna', clubName: 'בולוניה' } as never],
    };
    expect(homeContextOf(both)).toBe('offer');
  });

  it('drops the Europe chip when the panel is already saying it', () => {
    // Otherwise the screen says the competition in a chip and again in a panel three rows later.
    expect(home).toContain("showEurope={context !== 'europe'}");
  });

  it('shows a compact Europe status, not a journey', () => {
    /*
     * Competition, where he is in it, and a way to the rest. The entry route, every qualifying
     * round, the drop-downs, next season and the 36-club table all live in the Europe sheet.
     */
    expect(home).toContain('gf-context-euro');
    expect(home).toContain('לפרטים');
    expect(home).not.toContain('nextSeasonRoute');
    for (const component of ['EuropeCard', 'EuropeStandings', 'EuropeJourneySummary']) {
      expect(home.includes(`<${component}`), `home renders ${component}`).toBe(false);
    }
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

/** The same career with a recorded European campaign this season - the Europe context's trigger. */
function withEurope(career: Career): Career {
  return {
    ...career,
    world: {
      ...career.world,
      europe: {
        coefficients: { associations: {}, clubs: {} },
        history: [],
        current: {
          season: career.currentSeason,
          entries: [],
          winners: {} as never,
          maccabiJourney: null,
          playerJourney: {
            season: career.currentSeason,
            clubId: career.currentClubId,
            steps: [
              {
                kind: 'league_phase',
                competition: 'uefa_conference_league',
                position: 12,
                points: 10,
                won: 3,
                drawn: 1,
                lost: 2,
                goalsFor: 9,
                goalsAgainst: 7,
              },
            ],
            finalCompetition: 'uefa_conference_league',
            furthest: 'league_phase',
            matches: 6,
            wonCompetition: null,
            reachedFinal: false,
            reachedSemiFinal: false,
            reachedLeaguePhase: true,
          },
        },
      },
    } as never,
  };
}

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

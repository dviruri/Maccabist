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

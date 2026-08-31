/**
 * Major career moments (v0.9.3, Phase 5).
 *
 * Two rules this holds.
 *
 * ## The moment is happening to THIS player
 *
 * The art pack's moment images are SCENES, and several of them contain a generic footballer - a
 * championship celebration, a debut, a press presentation, a retirement. Drawn alone, a career's
 * biggest night showed somebody else. Every moment now carries a `mood`, and the screen renders
 * the career player through the age+position resolver on top of the supplied scene.
 *
 * ## A moment that only celebrates is a liar
 *
 * The v0.9 rule about confetti applies to poses too: a relegation night does not get a
 * celebration pose. `mood` is what makes that checkable rather than a matter of taste.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import {
  deriveArrivalMoment,
  deriveDebutMoment,
  deriveSeasonMoments,
  type CareerMoment,
} from '../src/components/CareerMoments';
import { createCareer } from '../src/game/careerEngine';
import { getCareerPlayerArt } from '../src/ui/playerArt';
import type { Career, SeasonRecord } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

const record = (over: Partial<SeasonRecord> = {}): SeasonRecord => ({
  season: 2046,
  age: 25,
  academyStage: 'senior',
  clubId: MACCABI_ID,
  clubName: 'מכבי חיפה',
  teamName: 'מכבי חיפה',
  league: 'ליגת העל',
  leagueId: 'il_premier',
  teamGames: 36,
  onLoan: false,
  stats: {
    appearances: 30,
    starts: 27,
    goals: 11,
    assists: 5,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 72,
    injuredGames: 0,
  },
  ability: 78,
  role: 'key',
  captain: false,
  olderGroup: 'none',
  trophies: [],
  ...over,
} as SeasonRecord);

function settled(over: Partial<SeasonRecord> = {}, world: Partial<Career['world']> = {}): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed: 5 });
  const settledRecord = record(over);
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: settledRecord.clubId,
    age: settledRecord.age,
    currentSeason: settledRecord.season,
    phase: 'season_result',
    seasonPoint: 'season_end',
    lastSeasonRecord: settledRecord,
    world: { ...base.world, ...world },
  };
}

describe('every moment says how the player should be drawn', () => {
  it('a championship, a cup and a European trophy are celebrations', () => {
    const moments = deriveSeasonMoments(
      settled({
        trophies: [
          { id: 'championship', name: 'אליפות', season: 2046, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 3 },
          { id: 'cup', name: 'גביע המדינה', season: 2046, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 1.5 },
        ],
      }),
    );
    expect(moments.length).toBeGreaterThanOrEqual(2);
    for (const moment of moments) expect(moment.mood).toBe('celebration');
  });

  it('a relegation is NOT a celebration', () => {
    /*
     * The same rule as the confetti: relegation gets a moment, and it gets an honest one. A
     * celebrating character on a relegation night would be the moment system lying about the
     * fact it exists to tell.
     */
    const career = settled({ clubId: MACCABI_ID }, {});
    const withRelegation: Career = {
      ...career,
      world: {
        ...career.world,
        clubSeasons: [
          ...career.world.clubSeasons.filter(
            (entry) => !(entry.season === 2046 && entry.clubId === MACCABI_ID),
          ),
          { season: 2046, clubId: MACCABI_ID, leagueId: 'il_premier', position: 14, outcome: 'relegated' } as never,
        ],
      },
    };
    const moments = deriveSeasonMoments(withRelegation);
    const relegation = moments.find((moment) => moment.key.startsWith('relegation_'));
    expect(relegation, 'no relegation moment derived').toBeDefined();
    expect(relegation!.mood).not.toBe('celebration');
    expect(relegation!.overlay).toBeUndefined();
  });

  it('the arrival and the debut both carry a mood', () => {
    const arriving: Career = {
      ...createCareer({ playerName: 'ת', position: 'ST', seed: 5 }),
      academyStage: 'senior',
      phase: 'preseason',
      currentClubId: 'hapoel_beer_sheva',
      currentSeason: 2047,
      seasonHistory: [record()],
    };
    const arrival = deriveArrivalMoment(arriving);
    expect(arrival).not.toBeNull();
    expect(arrival!.mood).toBe('celebration');

    const debuting: Career = {
      ...createCareer({ playerName: 'ת', position: 'ST', seed: 5 }),
      seasonHistory: [record({ season: 2042, age: 18 })],
      milestones: [
        { id: 'senior_debut', season: 2042, age: 18, icon: '👕', text: 'בכורה', major: true } as never,
      ],
    };
    const debut = deriveDebutMoment(debuting);
    expect(debut).not.toBeNull();
    expect(debut!.mood).toBe('celebration');
  });

  it('a mood is one of exactly three values, on every moment a career can produce', () => {
    const allowed = new Set<CareerMoment['mood']>(['celebration', 'hero', 'none']);
    const moments = deriveSeasonMoments(
      settled({
        trophies: [
          { id: 'uefa_conference_league', name: 'הקונפרנס ליג', season: 2046, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 4 },
        ],
      }),
    );
    for (const moment of moments) expect(allowed.has(moment.mood)).toBe(true);
  });
});

describe('the career player is drawn from the resolver, never baked into artwork', () => {
  const shell = read('src/components/gamefeel.tsx');
  const moments = read('src/components/CareerMoments.tsx');
  const retirement = read('src/pages/RetirementPage.tsx');
  const css = read('src/styles/gamefeel.css');

  it('MomentShell takes a player layer and the moment screen supplies it', () => {
    expect(shell).toContain('playerArt');
    expect(shell).toContain('gf-moment-player');
    expect(moments).toContain('getCareerPlayerArt(');
    // Resolved from his real age and position - not from the moment, not from the club.
    expect(moments).toContain('age: career.age, position: career.position');
  });

  it('passes the mood through as the pose, and draws nothing when the mood is none', () => {
    expect(moments).toContain("moment.mood === 'none'");
    expect(moments).toContain('context: moment.mood');
  });

  it('the retirement hero draws him too, at his retirement age', () => {
    expect(retirement).toContain('gf-moment-player');
    expect(retirement).toContain('career.retirementAge');
  });

  it('a scene becomes background atmosphere; a trophy stays the crisp object', () => {
    /*
     * The distinction that made this work. A scene contains its own generic footballer, so beside
     * the career player it read as a pasted rectangle with a second person in it - it is dimmed
     * and defocused behind him instead. A trophy is a transparent object with nobody in it, so it
     * keeps half the stage, crisp, at full opacity.
     */
    const withPlayer = /\.gf-moment-with-player \.gf-moment-art \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(withPlayer).toMatch(/opacity:\s*0\.[0-4]/);
    expect(withPlayer).toMatch(/blur\(/);
    const trophy =
      /\.gf-moment-with-player \.gf-moment-art\[src\*="\/trophies\/"\],[\s\S]*?\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(trophy).toMatch(/opacity:\s*1/);
    expect(trophy).toMatch(/filter:\s*none/);
  });

  it('every pose a mood can ask for resolves to a file that exists', () => {
    for (const age of [11, 16, 24, 35]) {
      for (const position of ['GK', 'ST', 'CB'] as const) {
        for (const context of ['celebration', 'hero'] as const) {
          const art = getCareerPlayerArt({ age, position, context });
          const local = art.replace(/^\//, '').replace(/^.*?assets\//, 'public/assets/');
          expect(fs.existsSync(path.join(ROOT, local)), art).toBe(true);
          // The GK rule from v0.9 still holds on moments.
          if (position === 'GK') expect(art).toContain('goalkeeper');
        }
      }
    }
  });
});

describe('a moment is a scene, not a page', () => {
  const shell = read('src/components/gamefeel.tsx');

  it('ends with one headline, one subtitle and one continue button', () => {
    const momentShell = shell.slice(shell.indexOf('export function MomentShell'));
    expect((momentShell.match(/<h1/g) ?? []).length).toBe(1);
    expect((momentShell.match(/gf-moment-sub/g) ?? []).length).toBe(1);
    expect((momentShell.match(/<GameButton/g) ?? []).length).toBe(1);
  });
});

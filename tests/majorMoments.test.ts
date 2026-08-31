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

/** A stored European journey for the settled record, at a given furthest stage. */
function journey(furthest: string, won: string | null): SeasonRecord['europe'] {
  return {
    season: 2046,
    clubId: MACCABI_ID,
    steps: [],
    finalCompetition: 'uefa_conference_league',
    furthest,
    matches: 8,
    wonCompetition: won,
    reachedFinal: furthest === 'final',
    reachedSemiFinal: furthest === 'sf' || furthest === 'final',
    reachedLeaguePhase: furthest !== 'entry',
  } as never;
}

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
    for (const moment of moments) {
      expect(moment.mood).toBe('celebration');
      /* A trophy night has a trophy on it - a real object, from the trophy folder. */
      expect(moment.object, moment.key).toMatch(/\/trophies\/trophy-/);
    }
  });

  it('dresses him in the club of THAT season, at the age he was', () => {
    /*
     * A championship won before a summer move is still that club's championship. The moment
     * carries the era, so the kit is the era's - not whichever shirt he happens to wear today.
     */
    const moments = deriveSeasonMoments(
      settled({
        clubId: 'hapoel_beer_sheva',
        clubName: 'הפועל באר שבע',
        age: 21,
        trophies: [
          { id: 'cup', name: 'גביע המדינה', season: 2046, clubId: 'hapoel_beer_sheva', clubName: 'הפועל באר שבע', weight: 1.5 },
        ],
      }),
    );
    expect(moments.length).toBeGreaterThan(0);
    for (const moment of moments) {
      expect(moment.kitClubId).toBe('hapoel_beer_sheva');
      expect(moment.age).toBe(21);
    }
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

  it('v0.9.4: gives a European knockout its own night, and does not repeat a trophy', () => {
    /*
     * Both read the SETTLED RECORD's own journey - historical truth, stored at settlement - rather
     * than live world state, so a moment about 2046 stays about 2046.
     */
    const reached = deriveSeasonMoments(settled({ europe: journey('qf', null) }));
    const knockout = reached.find((m) => m.key.startsWith('europe_ko_'));
    expect(knockout, 'no knockout moment for a quarter-final').toBeDefined();
    expect(knockout!.title).toContain('רבע גמר');
    expect(knockout!.mood).toBe('celebration');

    /* Winning it is the same evening told better, so the knockout scene stands down. */
    const won = deriveSeasonMoments(
      settled({
        europe: journey('final', 'uefa_conference_league'),
        trophies: [
          { id: 'uefa_conference_league', name: 'הקונפרנס ליג', season: 2046, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 4 },
        ],
      }),
    );
    expect(won.some((m) => m.key.startsWith('europe_ko_'))).toBe(false);
    expect(won.some((m) => m.key.startsWith('uefa_'))).toBe(true);

    /* A summer that ended in qualifying is not a knockout night. */
    const early = deriveSeasonMoments(settled({ europe: journey('entry', null) }));
    expect(early.some((m) => m.key.startsWith('europe_ko_'))).toBe(false);
  });

  it('v0.9.4: the first league phase is the qualification moment', () => {
    const base = settled({ europe: journey('league_phase', null) });
    const withMilestone: Career = {
      ...base,
      milestones: [
        { id: 'first_european_league_phase', season: 2046, age: 25, icon: '⭐', text: '', major: true } as never,
      ],
    };
    const moment = deriveSeasonMoments(withMilestone).find((m) => m.key.startsWith('europe_lp_'));
    expect(moment).toBeDefined();
    expect(moment!.title).toContain('שלב הליגה');
    /* Without the engine's own deduped milestone there is no moment - it is not re-derived here. */
    expect(deriveSeasonMoments(base).some((m) => m.key.startsWith('europe_lp_'))).toBe(false);
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

  it('MomentShell takes the career player, and the moment screen supplies him', () => {
    expect(shell).toContain('<PlayerRender');
    expect(shell).toContain('gf-moment-player');
    /*
     * Resolved through PlayerRender from the MOMENT's own age and club, not the career's current
     * ones: a championship won before a summer move is still that club's championship, and a debut
     * at eighteen shows the teen character for ever after.
     */
    expect(moments).toContain('age: moment.age ?? career.age');
    expect(moments).toContain('clubId: moment.kitClubId');
    expect(moments).toContain('position: career.position');
  });

  it('passes the mood through as the pose, and draws nothing when the mood is none', () => {
    expect(moments).toContain("moment.mood === 'none'");
    expect(moments).toContain('context: moment.mood');
  });

  it('the retirement hero draws him too, at his retirement age', () => {
    expect(retirement).toContain('<PlayerRender');
    expect(retirement).toContain('career.retirementAge');
  });

  it('v0.9.4: never puts a second footballer on the screen', () => {
    /*
     * The pack's moment images are complete scenes with a generic footballer painted into them.
     * v0.9.3 kept them behind the career player, dimmed and defocused, and that was still two
     * footballers - worse than one wrong one. A moment is composed now from layers with no people
     * in them, so the derivation may not reach for a scene at all.
     */
    for (const source of [moments, retirement]) {
      expect(source).not.toContain('getMomentArt');
      expect(source).not.toContain('getTransferArt');
    }
    /*
     * And the prop is named `object`, so the type itself refuses a scene. Scoped to MomentShell's
     * own body: matching `playerArt` across the whole file hit the `ui/playerArt` import path.
     */
    const momentShell = shell.slice(shell.indexOf('export function MomentShell'));
    expect(momentShell).toContain('object?: string;');
    expect(momentShell).not.toMatch(/art\?:/);
    expect(momentShell).not.toMatch(/playerArt/);
    /* Exactly one person can be rendered in a moment. */
    expect((momentShell.match(/<PlayerRender/g) ?? []).length).toBe(1);
  });

  it('a trophy stays a crisp object beside him', () => {
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

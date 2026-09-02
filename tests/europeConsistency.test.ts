/**
 * Every European surface tells the same story (v0.9.6.1, Phases 1, 2 and 5).
 *
 * ## The playtest bug
 *
 * The home screen said one competition and the Europe detail said another. Reproduced before the
 * fix with a constructed UCL -> UEL -> UECL journey at PRESEASON:
 *
 *   currentCampaign()        הקונפרנס ליג / שלב הליגה
 *   EuropeCards header       הקונפרנס ליג
 *   EuropeCards entry line   נכנסנו למוקדמות ליגת האלופות — סיבוב ראשון
 *
 * One card, two competitions - and both of the first two were the FINAL state of a season that
 * had not started.
 *
 * ## Why v0.9.6 did not catch it
 *
 * v0.9.6 gated `journey.steps`. But the journey also carries future-complete SCALARS -
 * `finalCompetition`, `reachedLeaguePhase`, `furthest`, `wonCompetition` - which describe the end
 * of a season the engine simulates in advance, and nothing gated those. `currentCampaign` read two
 * of them; the Europe card read another for its header, badge and tier styling.
 *
 * ## The rule now
 *
 * `visibleEuropeanCampaign` REPLAYS the revealed path and is the single answer every player-facing
 * current-season surface consumes. At full reveal the walk lands where `finalCompetition` would
 * have - derived rather than asserted.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEAGUE_PHASE, QUALIFYING_GRAPH } from '../src/data/uefa';
import { createCareer } from '../src/game/careerEngine';
import { europeReveal, visibleEuropeanCampaign } from '../src/game/europePresentation';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, EuropeanJourney, EuropeanStep, UefaCompetitionId } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const CLUB = 'maccabi_haifa';

function tie(
  stage: string,
  competition: UefaCompetitionId,
  won: boolean,
): Extract<EuropeanStep, { kind: 'tie' }> {
  return {
    kind: 'tie',
    tie: {
      stage,
      competition,
      opponentId: 'fld_x',
      opponentName: 'X',
      legs: [],
      aggFor: won ? 3 : 0,
      aggAgainst: won ? 1 : 2,
      won,
    },
  } as Extract<EuropeanStep, { kind: 'tie' }>;
}

function journeyOf(steps: EuropeanStep[], over: Partial<EuropeanJourney> = {}): EuropeanJourney {
  return {
    season: 2044,
    clubId: CLUB,
    steps,
    finalCompetition: 'uefa_conference_league',
    furthest: 'league_phase',
    matches: 10,
    wonCompetition: null,
    reachedFinal: false,
    reachedSemiFinal: false,
    reachedLeaguePhase: false,
    ...over,
  } as EuropeanJourney;
}

function careerWith(journey: EuropeanJourney, seasonPoint: string): Career {
  const base = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 1 });
  return {
    ...base,
    currentSeason: 2044,
    currentClubId: CLUB,
    seasonPoint,
    world: {
      ...base.world,
      europe: { current: { season: 2044, entries: [], playerJourney: journey } },
    },
  } as unknown as Career;
}

/* ---- The six routes the brief lists ---- */

const ROUTES: Record<string, { journey: EuropeanJourney; expect: Record<string, UefaCompetitionId | null> }> = {
  /* A. Champions League all the way. */
  'A ucl-through': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
        tie('ucl_q1', 'uefa_champions_league', true),
        tie('ucl_q2', 'uefa_champions_league', true),
        tie('ucl_q3', 'uefa_champions_league', true),
        tie('ucl_po', 'uefa_champions_league', true),
      ],
      { finalCompetition: 'uefa_champions_league', reachedLeaguePhase: true },
    ),
    expect: {
      preseason: 'uefa_champions_league',
      midseason: 'uefa_champions_league',
      season_end: 'uefa_champions_league',
    },
  },
  /* B. Champions League down to the Europa League. */
  'B ucl-to-uel': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
        tie('ucl_q1', 'uefa_champions_league', false),
        { kind: 'dropped', from: 'uefa_champions_league', to: 'uefa_europa_league', toEntry: 'uel_q3' },
        tie('uel_q3', 'uefa_europa_league', true),
      ],
      { finalCompetition: 'uefa_europa_league' },
    ),
    expect: {
      preseason: 'uefa_champions_league',
      midseason: 'uefa_europa_league',
      season_end: 'uefa_europa_league',
    },
  },
  /* C. The reported bug: Champions League all the way down to the Conference. */
  'C ucl-to-uel-to-uecl': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
        tie('ucl_q1', 'uefa_champions_league', false),
        { kind: 'dropped', from: 'uefa_champions_league', to: 'uefa_europa_league', toEntry: 'uel_q3' },
        tie('uel_q3', 'uefa_europa_league', false),
        { kind: 'dropped', from: 'uefa_europa_league', to: 'uefa_conference_league', toEntry: 'uecl_po' },
        tie('uecl_po', 'uefa_conference_league', true),
      ],
      { finalCompetition: 'uefa_conference_league', reachedLeaguePhase: true },
    ),
    expect: {
      preseason: 'uefa_champions_league',
      midseason: 'uefa_conference_league',
      season_end: 'uefa_conference_league',
    },
  },
  /* D. A direct Conference route - no drop anywhere. */
  'D direct-uecl': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_conference_league', entry: 'uecl_q2', reason: 'cup_winner' },
        tie('uecl_q2', 'uefa_conference_league', true),
      ],
      { finalCompetition: 'uefa_conference_league' },
    ),
    expect: {
      preseason: 'uefa_conference_league',
      midseason: 'uefa_conference_league',
      season_end: 'uefa_conference_league',
    },
  },
  /* E. Eliminated in qualifying with nowhere to drop to. */
  'E eliminated': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_conference_league', entry: 'uecl_q2', reason: 'league_position' },
        tie('uecl_q2', 'uefa_conference_league', false),
      ],
      { finalCompetition: 'uefa_conference_league', furthest: 'uecl_q2' },
    ),
    expect: {
      preseason: 'uefa_conference_league',
      midseason: 'uefa_conference_league',
      season_end: 'uefa_conference_league',
    },
  },
  /* F. A bye in qualifying - the v0.9.6 step, walked by the resolver. */
  'F bye': {
    journey: journeyOf(
      [
        { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
        tie('ucl_q1', 'uefa_champions_league', true),
        { kind: 'bye', competition: 'uefa_champions_league', stage: 'ucl_q2', advanceTo: 'ucl_q3' },
        tie('ucl_q3', 'uefa_champions_league', true),
      ],
      { finalCompetition: 'uefa_champions_league' },
    ),
    expect: {
      preseason: 'uefa_champions_league',
      midseason: 'uefa_champions_league',
      season_end: 'uefa_champions_league',
    },
  },
};

describe('the visible competition follows the revealed path, not the stored ending', () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(`resolves ${name} correctly at every reveal stage`, () => {
      for (const [seasonPoint, expected] of Object.entries(route.expect)) {
        const career = careerWith(route.journey, seasonPoint);
        const visible = visibleEuropeanCampaign(career, CLUB);
        expect(visible, `${name} @ ${seasonPoint}`).not.toBeNull();
        expect(visible!.competition, `${name} @ ${seasonPoint} (reveal=${europeReveal(career)})`).toBe(
          expected,
        );
      }
    });
  }

  it('reproduces the reported mismatch as FIXED: CL at preseason, Conference by midseason', () => {
    /*
     * The exact bug, pinned. Before the fix `currentCampaign` returned "הקונפרנס ליג / שלב הליגה"
     * here - the final state of a season with no matches played - while the same card's entry
     * line said the club had entered the Champions League.
     */
    const journey = ROUTES['C ucl-to-uel-to-uecl']!.journey;

    const pre = visibleEuropeanCampaign(careerWith(journey, 'preseason'), CLUB)!;
    expect(pre.competition).toBe('uefa_champions_league');
    /* And it must not claim the league phase before a qualifier has been played. */
    expect(pre.inLeaguePhase).toBe(false);
    expect(pre.stage).toBe(QUALIFYING_GRAPH['ucl_q1']!.label);

    const mid = visibleEuropeanCampaign(careerWith(journey, 'midseason'), CLUB)!;
    expect(mid.competition).toBe('uefa_conference_league');
    expect(mid.inLeaguePhase).toBe(true);
  });

  it('never reports the league phase before the revealed path reaches it', () => {
    for (const [name, route] of Object.entries(ROUTES)) {
      const pre = visibleEuropeanCampaign(careerWith(route.journey, 'preseason'), CLUB)!;
      /* Nobody enters directly into a league phase in these routes, so none may claim it. */
      expect(pre.inLeaguePhase, `${name} claimed the league phase at preseason`).toBe(false);
    }
  });

  it('does not invent a competition after elimination', () => {
    const career = careerWith(ROUTES['E eliminated']!.journey, 'midseason');
    const visible = visibleEuropeanCampaign(career, CLUB)!;
    expect(visible.eliminated).toBe(true);
    expect(visible.inLeaguePhase).toBe(false);
    /* The competition it went out OF is still nameable - that is not a future fact. */
    expect(visible.competition).toBe('uefa_conference_league');
  });

  it('agrees with the stored ending once the season is settled', () => {
    /*
     * The derived answer and the recorded one must converge at full reveal. If they ever diverge
     * there, the replay has a hole in it rather than the scalar being wrong.
     */
    for (const [name, route] of Object.entries(ROUTES)) {
      const career = careerWith(route.journey, 'season_end');
      const visible = visibleEuropeanCampaign(career, CLUB)!;
      expect(visible.competition, `${name}: derived vs recorded`).toBe(
        route.journey.finalCompetition,
      );
    }
  });
});

describe('real careers agree with themselves', () => {
  it('never has the visible competition contradict the revealed entry', () => {
    /*
     * The cross-surface property on real data: whatever the visible campaign says, the club must
     * genuinely be able to have got there from where it entered - so at entry reveal the visible
     * competition IS the entry competition.
     */
    const offenders: string[] = [];
    let checked = 0;
    for (let i = 0; i < 30; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 51000 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          const journey = career.world.europe?.current?.playerJourney;
          if (!journey || journey.clubId !== career.currentClubId) return;
          const visible = visibleEuropeanCampaign(career, career.currentClubId);
          if (!visible) return;
          checked += 1;
          if (europeReveal(career) !== 'entry') return;
          const entered = journey.steps.find((s) => s.kind === 'entered');
          if (entered && entered.kind === 'entered' && visible.competition !== entered.competition) {
            offenders.push(`${visible.competition} but entered ${entered.competition}`);
          }
          if (visible.inLeaguePhase && entered && entered.kind === 'entered' && entered.entry !== LEAGUE_PHASE) {
            offenders.push(`league phase claimed at entry reveal from ${entered.entry}`);
          }
        },
      });
    }
    expect(checked).toBeGreaterThan(100);
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe('no player-facing surface re-derives the competition', () => {
  const SURFACES = [
    'src/components/CareerHome.tsx',
    'src/components/EuropeCards.tsx',
    'src/components/EuropeStandings.tsx',
    'src/game/careerFeed.ts',
  ];

  it('reads finalCompetition nowhere outside a full-reveal branch', () => {
    /*
     * The static guard v0.9.6 was missing. It forbade `journey.steps.find/filter` and said nothing
     * about the future-complete scalars, which is exactly where the bug lived.
     *
     * `EuropeCards` is allowed two uses inside its settled state line, where the whole journey is
     * history by definition; everything else must go through the resolver.
     */
    for (const file of SURFACES) {
      const source = stripComments(read(file));
      const uses = (source.match(/finalCompetition/g) ?? []).length;
      if (file.endsWith('EuropeCards.tsx')) {
        expect(uses, `${file} uses finalCompetition outside the settled branch`).toBeLessThanOrEqual(2);
        continue;
      }
      expect(uses, `${file} reads finalCompetition`).toBe(0);
    }
  });

  it('reads reachedLeaguePhase only where the season is settled', () => {
    for (const file of ['src/components/CareerHome.tsx', 'src/game/careerFeed.ts']) {
      expect(stripComments(read(file)).includes('reachedLeaguePhase'), file).toBe(false);
    }
  });

  it('routes every surface through visibleEuropeanCampaign', () => {
    for (const file of SURFACES) {
      expect(stripComments(read(file)), `${file}`).toContain('visibleEuropeanCampaign');
    }
    /* And none of them calls the raw engine helper for current-season presentation. */
    for (const file of SURFACES) {
      expect(stripComments(read(file)).includes('currentCampaign('), `${file} uses currentCampaign`).toBe(false);
    }
  });
});

describe('a settled European season is described in the past tense', () => {
  it('never says the season is still ahead', () => {
    /*
     * "העונה האירופית לפנינו" - "the European season is ahead of us" - was printed at FULL reveal,
     * on a season that had already finished.
     */
    const source = stripComments(read('src/components/EuropeCards.tsx'));
    expect(source.includes('העונה האירופית לפנינו')).toBe(false);
  });

  it('describes the completed campaign from facts the journey already holds', () => {
    const source = stripComments(read('src/components/EuropeCards.tsx'));
    /* A trophy, the furthest knockout round, or the league phase - nothing invented. */
    expect(source).toContain('journey.wonCompetition');
    expect(source).toContain('KNOCKOUT_TITLES[journey.furthest]');
    expect(source).toContain('journey.reachedLeaguePhase');
  });
});

describe('the panel never vanishes on a real career', () => {
  /*
   * The guard the oneScreen fixture needed (v0.9.6.1).
   *
   * Deriving the competition by replaying revealed steps has one failure mode the scalar read did
   * not: if a journey has no revealed step naming a competition, there is nothing to show and the
   * Europe panel disappears. That would be a worse regression than the bug being fixed - a player
   * in the Conference League seeing no Europe at all for half a season.
   *
   * It cannot happen, because every journey opens with an `entered` step and `entered` is revealed
   * at every stage. That is asserted here against the ENGINE rather than assumed, which is exactly
   * what the hand-written fixture in tests/oneScreen.test.ts got wrong: it began at a final
   * league-phase table, a journey no season can produce, and so went silent under the new rule.
   */
  it('every engine journey opens with an entry step, and always resolves to a competition', () => {
    let journeys = 0;
    const silent: string[] = [];
    const badFirstStep: string[] = [];
    const diverged: string[] = [];
    let converged = 0;
    for (let i = 0; i < 12; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: (['ST', 'CM', 'CB', 'GK'] as const)[i % 4]!,
        seed: 900 + i,
        policy: balancedPolicy,
        onStep: (career: Career) => {
          const current = career.world.europe?.current;
          if (!current || current.season !== career.currentSeason) return;
          for (const journey of [current.playerJourney, current.maccabiJourney]) {
            if (!journey || journey.clubId !== career.currentClubId) continue;
            journeys += 1;
            if (journey.steps[0]?.kind !== 'entered') {
              badFirstStep.push(`${career.currentSeason}: opens with ${journey.steps[0]?.kind}`);
            }
            if (!visibleEuropeanCampaign(career, career.currentClubId)) {
              silent.push(
                `${career.currentSeason} ${career.seasonPoint}/${career.phase}: ` +
                  journey.steps.map((step) => step.kind).join(','),
              );
            }
            /*
             * And the replay has no holes on real data either. Forced to full reveal, walking the
             * steps must land on the competition the engine recorded - which is the whole basis
             * for dropping `finalCompetition` as a source. Asserted on engine journeys rather
             * than only on the six hand-built routes above, because a real season can drop
             * competitions in shapes the fixtures do not enumerate.
             */
            const settled = visibleEuropeanCampaign(
              { ...career, seasonPoint: 'season_end' } as Career,
              career.currentClubId,
            );
            if (settled) converged += 1;
            if (settled && settled.competition !== journey.finalCompetition) {
              diverged.push(
                `${career.currentSeason}: replay=${settled.competition} ` +
                  `recorded=${journey.finalCompetition} steps=${journey.steps.map((s) => s.kind).join(',')}`,
              );
            }
          }
        },
      });
    }
    expect(journeys, 'no European campaign was observed - the sweep proves nothing').toBeGreaterThan(50);
    expect([...new Set(badFirstStep)].slice(0, 5)).toEqual([]);
    expect([...new Set(silent)].slice(0, 5)).toEqual([]);
    expect(converged, 'the settled comparison never ran - it proves nothing').toBeGreaterThan(50);
    expect([...new Set(diverged)].slice(0, 5)).toEqual([]);
  });
});

describe('an eliminated campaign is presented as eliminated', () => {
  /*
   * v0.9.6.2. `eliminated` was already on the campaign and Home ignored it, so a club knocked
   * out in the play-off round rendered "קונפרנס ליג · פלייאוף" - identical in shape to a club
   * still playing in that round. The player could not tell a live campaign from a dead one.
   */
  const eliminatedInPlayoff: EuropeanJourney = {
    season: 2046,
    clubId: CLUB,
    steps: [
      { kind: 'entered', competition: 'uefa_conference_league', entry: 'uecl_po', reason: { kind: 'league_position', position: 3 } },
      tie('uecl_po', 'uefa_conference_league', false),
    ] as EuropeanStep[],
    finalCompetition: 'uefa_conference_league',
    furthest: 'uecl_po',
    matches: 2,
    wonCompetition: null,
    reachedFinal: false,
    reachedSemiFinal: false,
    reachedLeaguePhase: false,
  };

  it('reports the campaign as over, at the stage it actually ended', () => {
    const visible = visibleEuropeanCampaign(careerWith(eliminatedInPlayoff, 'midseason'), CLUB)!;
    expect(visible.eliminated).toBe(true);
    expect(visible.inLeaguePhase).toBe(false);
    expect(visible.stageShort).toBe('פלייאוף');
  });

  it('gives Home a compact stage that does not repeat the competition', () => {
    /*
     * The panel renders "{competitionName} · {stage}". With the graph's full label that read
     * "ליגת האלופות · מוקדמות ליגת האלופות — סיבוב ראשון".
     */
    const entryOnly: EuropeanJourney = {
      ...eliminatedInPlayoff,
      steps: [
        { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: { kind: 'champion' } },
      ] as EuropeanStep[],
    };
    const visible = visibleEuropeanCampaign(careerWith(entryOnly, 'preseason'), CLUB)!;
    expect(visible.stage).toContain(visible.competitionName);
    expect(visible.stageShort).not.toContain(visible.competitionName);
    expect(visible.stageShort).toBe('מוקדמות — סיבוב ראשון');
  });

  it('makes Home and the Europe card read elimination off the same field', () => {
    /*
     * The agreement the brief asks for, enforced at the source rather than by comparing two
     * rendered strings: neither surface may decide elimination for itself.
     */
    for (const file of ['src/components/CareerHome.tsx', 'src/components/EuropeCards.tsx']) {
      const source = stripComments(read(file));
      expect(source, `${file} ignores the eliminated flag`).toContain('eliminated');
      expect(source).toContain('stageShort');
    }
    /* And neither may treat "not in the league phase" as "knocked out". */
    for (const file of ['src/components/CareerHome.tsx', 'src/components/EuropeCards.tsx', 'src/game/careerFeed.ts']) {
      expect(stripComments(read(file)).includes('!visible.inLeaguePhase'), file).toBe(false);
      expect(stripComments(read(file)).includes('!campaign.inLeaguePhase'), file).toBe(false);
    }
  });

  it('still names the competition it went out of', () => {
    /* Elimination is not amnesia - the club was in the Conference League and that is a fact. */
    const visible = visibleEuropeanCampaign(careerWith(eliminatedInPlayoff, 'midseason'), CLUB)!;
    expect(visible.competition).toBe('uefa_conference_league');
  });
});

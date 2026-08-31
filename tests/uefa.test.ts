/**
 * Europe (v0.8): qualification, the graph, the journey, the trophy invariant.
 *
 * The structural claim under test everywhere here: a European trophy is the CONCLUSION of a
 * simulated competition - domestic result → entry → qualifying → (drop-down) → league phase →
 * knockouts → final - and can be produced no other way. The clearest regression this suite
 * exists to prevent: a club that never qualified for Europe being handed "Champions League
 * Winner" by a season-end roll, which is exactly what the game did before this version.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID, getClub } from '../src/data/clubs';
import {
  LEAGUE_PHASE,
  LP_DROP_TARGETS,
  OUT,
  QUALIFYING_GRAPH,
  QUALIFYING_ORDER,
  UEFA_COMPETITIONS,
} from '../src/data/uefa';
import { createCareer } from '../src/game/careerEngine';
import {
  emptyEuropeState,
  resolveEntriesFromResults,
  resolveNextEntries,
  simulateEuropeanSeason,
  type DomesticResult,
  type Participant,
} from '../src/game/uefaEngine';
import { playFirstHalf, playSecondHalf } from '../src/game/seasonEngine';
import { createRng } from '../src/game/random';
import type { Career, EuropeanEntry, EuropeanStep, UefaCompetitionId } from '../src/types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function seniorCareer(overrides: Partial<Career> = {}, seed = 7): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 74,
    currentSeason: 2044,
    ...overrides,
  };
}

const participantOf = (clubId: string): Participant => {
  try {
    const club = getClub(clubId);
    return {
      id: clubId,
      name: club.name,
      association: club.country,
      quality: club.quality,
      coefficient: Math.max(4, (club.quality - 55) * 1.1),
    };
  } catch {
    return { id: clubId, name: clubId, association: 'ישראל', quality: 60, coefficient: 5 };
  }
};

/** An Israeli domestic season with an exact, hand-written result. */
function israelResult(positions: string[], cupWinnerId: string): DomesticResult {
  return { association: 'ישראל', leagueId: 'il_premier', positions, cupWinnerId };
}

const IL_TABLE = [
  'maccabi_haifa',
  'maccabi_tel_aviv',
  'hapoel_jerusalem',
  'hapoel_beer_sheva',
  'beitar_jerusalem',
  'maccabi_netanya',
];

function entryOf(entries: EuropeanEntry[], clubId: string): EuropeanEntry | undefined {
  return entries.find((entry) => entry.clubId === clubId);
}

/* ------------------------------------------------------------------ */
/* The graph itself                                                    */
/* ------------------------------------------------------------------ */

describe('the qualification graph is a closed, auditable system', () => {
  it('routes every node somewhere real - no dangling destinations', () => {
    for (const node of Object.values(QUALIFYING_GRAPH)) {
      for (const dest of [node.winTo, node.loseTo]) {
        const valid =
          dest === LEAGUE_PHASE || dest === OUT || dest in QUALIFYING_GRAPH || dest in LP_DROP_TARGETS;
        expect(valid, `${node.id} → ${dest}`).toBe(true);
      }
    }
  });

  it('only ever drops DOWN: a loser never lands in a higher competition', () => {
    const tier = (c: UefaCompetitionId): number => UEFA_COMPETITIONS[c].tier;
    for (const node of Object.values(QUALIFYING_GRAPH)) {
      const dest = node.loseTo;
      if (dest === OUT) continue;
      const target =
        dest in LP_DROP_TARGETS ? LP_DROP_TARGETS[dest]! : QUALIFYING_GRAPH[dest]!.competition;
      expect(tier(target), `${node.id} loser must not climb`).toBeGreaterThanOrEqual(tier(node.competition));
    }
  });

  it('rewards losing late: a play-off loser parachutes into the lower league phase', () => {
    expect(QUALIFYING_GRAPH.ucl_po!.loseTo).toBe('uel_lp_drop');
    expect(LP_DROP_TARGETS.uel_lp_drop).toBe('uefa_europa_league');
    expect(QUALIFYING_GRAPH.uel_po!.loseTo).toBe('uecl_lp_drop');
    expect(LP_DROP_TARGETS.uecl_lp_drop).toBe('uefa_conference_league');
  });

  it('schedules every node exactly once', () => {
    expect([...QUALIFYING_ORDER].sort()).toEqual(Object.keys(QUALIFYING_GRAPH).sort());
  });

  it('lists every association explicitly - no association qualifies by silent default', () => {
    // The rule is structural: resolveEntriesFromResults skips any association not in the table.
    const results = [
      { association: 'אנדורה', leagueId: 'ad_league', positions: ['ad_club'], cupWinnerId: 'ad_club' },
    ];
    const resolved = resolveEntriesFromResults(results, null, participantOf);
    expect(resolved.entries).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Israel test matrix (Cases A-E)                                      */
/* ------------------------------------------------------------------ */

describe('Israel access: the required baseline', () => {
  it('A: the champion enters the Champions League QUALIFYING route, not the league phase', () => {
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'hapoel_beer_sheva')], null, participantOf);
    const champion = entryOf(resolved.entries, 'maccabi_haifa')!;
    expect(champion.competition).toBe('uefa_champions_league');
    expect(champion.reason).toBe('champion');
    expect(champion.entry).toBe('ucl_q1');
    expect(champion.entry).not.toBe(LEAGUE_PHASE); // qualifying, never automatic league phase
  });

  it('B: the cup winner enters the Europa League route', () => {
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'hapoel_beer_sheva')], null, participantOf);
    const cup = entryOf(resolved.entries, 'hapoel_beer_sheva')!;
    expect(cup.competition).toBe('uefa_europa_league');
    expect(cup.reason).toBe('cup_winner');
    expect(cup.entry).toBe('uel_q1');
  });

  it('C: second and third enter the Conference route', () => {
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'hapoel_beer_sheva')], null, participantOf);
    expect(entryOf(resolved.entries, 'maccabi_tel_aviv')!.competition).toBe('uefa_conference_league');
    expect(entryOf(resolved.entries, 'hapoel_jerusalem')!.competition).toBe('uefa_conference_league');
    expect(entryOf(resolved.entries, 'hapoel_jerusalem')!.reason).toBe('league_position');
  });

  it('D: cup winner = champion → no duplicate, the cup slot passes down the table', () => {
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'maccabi_haifa')], null, participantOf);
    const haifaEntries = resolved.entries.filter((entry) => entry.clubId === 'maccabi_haifa');
    expect(haifaEntries).toHaveLength(1);
    expect(haifaEntries[0]!.competition).toBe('uefa_champions_league'); // the better route wins

    /*
     * Redistribution is a promotion CHAIN, as in real domestic practice: the runner-up moves
     * up into the vacated Europa slot, third moves into the better Conference slot, and the
     * table extends one place - fourth enters Europe. Slots keep their routes; clubs shift up.
     */
    const redistributed = resolved.entries.find(
      (entry) => entry.competition === 'uefa_europa_league' && entry.association === 'ישראל',
    )!;
    expect(redistributed.clubId).toBe('maccabi_tel_aviv');
    expect(redistributed.reason).toBe('league_position');
    expect(redistributed.entry).toBe('uel_q1'); // the slot keeps its route; the club changes
    const fourth = entryOf(resolved.entries, 'hapoel_beer_sheva')!;
    expect(fourth.competition).toBe('uefa_conference_league');

    // No UEFA slot was lost and nobody holds two.
    const israeli = resolved.entries.filter((entry) => entry.association === 'ישראל');
    expect(israeli).toHaveLength(4);
    expect(new Set(israeli.map((entry) => entry.clubId)).size).toBe(4);
  });

  it('E: cup winner already qualified by league position → same deterministic redistribution', () => {
    // Maccabi Tel Aviv (2nd, already Conference-bound) wins the cup.
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'maccabi_tel_aviv')], null, participantOf);
    const telAviv = resolved.entries.filter((entry) => entry.clubId === 'maccabi_tel_aviv');
    expect(telAviv).toHaveLength(1);
    // The cup route outranks a league-position route, so MTA takes the Europa slot...
    expect(telAviv[0]!.competition).toBe('uefa_europa_league');
    // ...and its vacated Conference place passes down the table.
    const israeli = resolved.entries.filter((entry) => entry.association === 'ישראל');
    expect(israeli).toHaveLength(4);
    expect(new Set(israeli.map((entry) => entry.clubId)).size).toBe(4);
    const conference = israeli.filter((entry) => entry.competition === 'uefa_conference_league');
    expect(conference.map((entry) => entry.clubId).sort()).toEqual(['hapoel_beer_sheva', 'hapoel_jerusalem'].sort());
  });

  it('H: a club that did not qualify domestically holds no route at all', () => {
    const resolved = resolveEntriesFromResults([israelResult(IL_TABLE, 'hapoel_beer_sheva')], null, participantOf);
    expect(entryOf(resolved.entries, 'beitar_jerusalem')).toBeUndefined();
    expect(entryOf(resolved.entries, 'maccabi_netanya')).toBeUndefined();
  });
});

describe('titleholder access', () => {
  it('a Europa League winner enters next season’s Champions League, without a duplicate', () => {
    const titleholders = {
      uefa_champions_league: { clubId: 'real_madrid', name: 'ריאל מדריד' },
      uefa_europa_league: { clubId: 'maccabi_haifa', name: 'מכבי חיפה' },
      uefa_conference_league: { clubId: 'hapoel_beer_sheva', name: 'הפועל באר שבע' },
    };
    const resolved = resolveEntriesFromResults(
      [israelResult(IL_TABLE, 'hapoel_beer_sheva')],
      titleholders,
      participantOf,
    );
    const haifa = resolved.entries.filter((entry) => entry.clubId === 'maccabi_haifa');
    expect(haifa).toHaveLength(1);
    expect(haifa[0]!.reason).toBe('titleholder');
    expect(haifa[0]!.competition).toBe('uefa_champions_league');
    expect(haifa[0]!.entry).toBe(LEAGUE_PHASE); // the titleholder route IS direct
    // Conference winner → Europa League next season.
    const beerSheva = resolved.entries.filter((entry) => entry.clubId === 'hapoel_beer_sheva');
    expect(beerSheva).toHaveLength(1);
    expect(beerSheva[0]!.competition).toBe('uefa_europa_league');
    expect(beerSheva[0]!.reason).toBe('titleholder');
  });
});

/* ------------------------------------------------------------------ */
/* The simulated season: format and invariants                         */
/* ------------------------------------------------------------------ */

function fullSeason(seed = 11, watched: string[] = [MACCABI_ID]) {
  const career = seniorCareer({}, seed);
  const resolved = resolveNextEntries(career, career.currentSeason - 1);
  return {
    career,
    resolved,
    simulated: simulateEuropeanSeason(career, career.currentSeason, resolved.entries, resolved.standby, watched),
  };
}

describe('the simulated European season holds its format', () => {
  it('fills all three league phases to exactly 36', () => {
    for (const seed of [1, 11, 42]) {
      const { simulated } = fullSeason(seed);
      expect(simulated.audit.leaguePhaseSizes.uefa_champions_league).toBe(36);
      expect(simulated.audit.leaguePhaseSizes.uefa_europa_league).toBe(36);
      expect(simulated.audit.leaguePhaseSizes.uefa_conference_league).toBe(36);
    }
  });

  it('every winner passed through its own league phase - a trophy is a completed journey', () => {
    for (const seed of [1, 5, 11, 23, 42, 99]) {
      const { simulated } = fullSeason(seed);
      expect(simulated.audit.winnersFromLeaguePhase, `seed ${seed}`).toBe(true);
    }
  });

  it('is deterministic: same seed, same Europe, twice', () => {
    const a = fullSeason(17).simulated;
    const b = fullSeason(17).simulated;
    expect(a.state.winners).toEqual(b.state.winners);
    expect(a.state.playerJourney).toEqual(b.state.playerJourney);
  });

  it('gives a watched club a coherent journey: distinct league-phase opponents, correct match count', () => {
    // Find seeds where Maccabi reached a league phase and check the draw guarantees.
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed += 1) {
      const { simulated } = fullSeason(seed);
      const journey = simulated.state.playerJourney;
      if (!journey || !journey.reachedLeaguePhase) continue;
      checked += 1;
      const lp = journey.steps.find((step) => step.kind === 'league_phase') as
        | Extract<EuropeanStep, { kind: 'league_phase' }>
        | undefined;
      expect(lp).toBeDefined();
      const expectedMatches = UEFA_COMPETITIONS[lp!.competition].leaguePhaseMatches;
      expect(lp!.won + lp!.drawn + lp!.lost).toBe(expectedMatches);
      expect(lp!.position).toBeGreaterThanOrEqual(1);
      expect(lp!.position).toBeLessThanOrEqual(36);
      // A club finishing 25th-36th cannot appear in knockouts.
      const knockouts = journey.steps.filter(
        (step) => step.kind === 'tie' && ['ko_playoff', 'r16', 'qf', 'sf', 'final'].includes(step.tie.stage),
      );
      if (lp!.position > 24) expect(knockouts).toHaveLength(0);
      if (lp!.position <= 8) {
        // Direct to the round of 16: no ko_playoff tie may exist.
        expect(
          knockouts.some((step) => step.kind === 'tie' && step.tie.stage === 'ko_playoff'),
        ).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('never uses away goals: every tie is decided by aggregate, extra time or penalties', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const journey = fullSeason(seed).simulated.state.playerJourney;
      if (!journey) continue;
      for (const step of journey.steps) {
        if (step.kind !== 'tie') continue;
        if (step.tie.won) expect(step.tie.aggFor).toBeGreaterThan(step.tie.aggAgainst);
        else expect(step.tie.aggFor).toBeLessThan(step.tie.aggAgainst);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Cases F, G + the canonical story test                               */
/* ------------------------------------------------------------------ */

describe('drop-downs follow the configured graph (Cases F, G)', () => {
  it('a UCL qualifying loss lands exactly where the losing round says', () => {
    // Scan seeds for an Israeli champion losing in UCL qualifying, then assert the route.
    let checked = 0;
    for (let seed = 1; seed <= 120 && checked < 8; seed += 1) {
      const journey = fullSeason(seed).simulated.state.playerJourney;
      if (!journey) continue;
      const steps = journey.steps;
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i]!;
        if (step.kind !== 'tie' || step.tie.won || !step.tie.stage.startsWith('ucl_')) continue;
        const node = QUALIFYING_GRAPH[step.tie.stage]!;
        const next = steps[i + 1];
        checked += 1;
        if (node.loseTo in LP_DROP_TARGETS) {
          expect(next).toMatchObject({ kind: 'dropped', to: LP_DROP_TARGETS[node.loseTo] });
        } else {
          const destination = QUALIFYING_GRAPH[node.loseTo]!;
          expect(next).toMatchObject({ kind: 'dropped', to: destination.competition });
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the canonical journey exists: UCL qualifying → UEL qualifying → Conference, still alive', () => {
    /*
     * The story the release is named for: an Israeli champion starts the summer dreaming of
     * the Champions League and ends up playing Conference League football - legitimately, one
     * configured edge at a time. Scan for a seed that produced it, then assert every
     * transition; the seed then pins it as a deterministic regression fixture.
     */
    let found: { seed: number; steps: EuropeanStep[] } | null = null;
    for (let seed = 1; seed <= 400 && !found; seed += 1) {
      const journey = fullSeason(seed).simulated.state.playerJourney;
      if (!journey) continue;
      const competitions = journey.steps
        .filter((step): step is Extract<EuropeanStep, { kind: 'dropped' }> => step.kind === 'dropped')
        .map((step) => step.to);
      if (
        journey.steps[0]?.kind === 'entered' &&
        journey.steps[0].competition === 'uefa_champions_league' &&
        competitions.includes('uefa_europa_league') &&
        competitions.includes('uefa_conference_league')
      ) {
        found = { seed, steps: journey.steps };
      }
    }
    expect(found, 'no UCL→UEL→UECL journey in 400 seeds').not.toBeNull();
    const steps = found!.steps;
    // Entered the UCL route as champion-or-titleholder, dropped twice, each edge graph-legal.
    const drops = steps.filter(
      (step): step is Extract<EuropeanStep, { kind: 'dropped' }> => step.kind === 'dropped',
    );
    expect(drops[0]!.from).toBe('uefa_champions_league');
    expect(drops[0]!.to).toBe('uefa_europa_league');
    expect(drops[1]!.from).toBe('uefa_europa_league');
    expect(drops[1]!.to).toBe('uefa_conference_league');
  });
});

/* ------------------------------------------------------------------ */
/* The absurdity regression: structural impossibility                  */
/* ------------------------------------------------------------------ */

describe('the absurdity regression: no unearned European trophy, structurally', () => {
  it('a club with no entry cannot appear anywhere in the simulated season', () => {
    const { resolved, simulated } = fullSeason(3, ['hapoel_jerusalem']);
    if (resolved.entries.some((entry) => entry.clubId === 'hapoel_jerusalem')) return; // qualified fairly
    // Not entered → no journey, no trophy, no presence. Not "low probability" - absent.
    expect(simulated.state.playerJourney?.clubId).not.toBe('hapoel_jerusalem');
    for (const winner of Object.values(simulated.state.winners)) {
      expect(winner.clubId).not.toBe('hapoel_jerusalem');
    }
  });

  it('the season-end trophy roll is gone: a settled season with no journey wins nothing European', () => {
    const career = seniorCareer({}, 9);
    // A world with Europe state but NO journey for the player club - e.g. failed to qualify.
    career.world = {
      ...career.world,
      europe: { ...emptyEuropeState(), current: { season: 2044, entries: [], winners: {} as never, playerJourney: null, maccabiJourney: null } },
    };
    for (let seed = 1; seed <= 30; seed += 1) {
      const first = playFirstHalf({ ...career }, createRng(seed));
      const { record } = playSecondHalf(first, createRng(seed + 1));
      const european = record.trophies.filter((trophy) =>
        ['uefa_champions_league', 'uefa_europa_league', 'uefa_conference_league', 'champions_league', 'european_run'].includes(trophy.id),
      );
      expect(european, `seed ${seed}`).toEqual([]);
    }
  });

  it('a won journey is the ONLY source of a UEFA trophy, and it is deterministic', () => {
    const career = seniorCareer({}, 9);
    career.world = {
      ...career.world,
      europe: {
        ...emptyEuropeState(),
        current: {
          season: 2044,
          entries: [],
          winners: { uefa_conference_league: { clubId: MACCABI_ID, name: 'מכבי חיפה' } } as never,
          playerJourney: {
            season: 2044,
            clubId: MACCABI_ID,
            steps: [],
            finalCompetition: 'uefa_conference_league',
            furthest: 'champion',
            matches: 15,
            wonCompetition: 'uefa_conference_league',
            reachedFinal: true,
            reachedSemiFinal: true,
            reachedLeaguePhase: true,
          },
          maccabiJourney: null,
        },
      },
    };
    const first = playFirstHalf(career, createRng(31));
    const { record } = playSecondHalf(first, createRng(32));
    expect(record.trophies.some((trophy) => trophy.id === 'uefa_conference_league')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Old saves                                                           */
/* ------------------------------------------------------------------ */

describe('backward compatibility', () => {
  it('a career with no europe state still settles a season safely', () => {
    const base = seniorCareer({}, 13);
    // A pre-v0.8 save: strip the shell a fresh career is now born with.
    const { europe: _europe, ...oldWorld } = base.world;
    const career: Career = { ...base, world: oldWorld as Career['world'] };
    expect(career.world.europe).toBeUndefined();
    const first = playFirstHalf(career, createRng(1));
    const { record } = playSecondHalf(first, createRng(2));
    expect(record.teamGames).toBeGreaterThan(0);
    expect(record.segments!.length).toBeGreaterThan(0);
  });
});

/**
 * A European journey has no gaps (v0.9.6, Phase 1).
 *
 * ## The bug
 *
 * A playtest showed a campaign going qualifying round 1 -> qualifying round 3, with round 2 simply
 * absent. Round 2 had not been skipped: the club had been given a BYE, which is what happens to
 * the best-ranked entrant when a qualifying node has an odd field. The engine advanced the club
 * correctly and recorded nothing, so the graph was right and the STORY had a hole in it.
 *
 * ## The invariant
 *
 * Every qualifying node a campaign passes through must be accounted for by exactly one step -
 * `entered`, `tie`, `bye` or `dropped`. This test walks `QUALIFYING_GRAPH` from the entry node
 * along the path the steps describe, and fails if the path ever jumps a node.
 *
 * That is a stronger check than "a bye is recorded". It would also catch a future round added to
 * the graph that nothing renders, or a drop-down that lands somewhere the story never mentions.
 */

import { describe, expect, it } from 'vitest';

import { LEAGUE_PHASE, OUT, QUALIFYING_GRAPH } from '../src/data/uefa';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { EuropeanJourney } from '../src/types';

/**
 * Walk a journey's steps as a path through the qualifying graph.
 *
 * Returns the list of breaks: places where the story moved from one node to another that is not
 * the declared destination of the first. An empty list means the campaign's own steps describe a
 * connected route.
 */
function gapsIn(journey: EuropeanJourney): string[] {
  const gaps: string[] = [];
  /* Where the story says the club currently is. Null until it has entered somewhere. */
  let at: string | null = null;

  const nodeOf = (id: string): string | null => (id in QUALIFYING_GRAPH ? id : null);

  for (const step of journey.steps) {
    switch (step.kind) {
      case 'entered':
        at = nodeOf(step.entry);
        break;
      case 'tie': {
        const stage = nodeOf(step.tie.stage);
        /* Knockout ties are not qualifying nodes; they are past this graph entirely. */
        if (!stage) break;
        if (at !== null && at !== stage) gaps.push(`${at} -> ${stage} (tie with no route)`);
        /* A win advances to winTo; a loss is followed by a `dropped` step or the run ends. */
        at = step.tie.won ? QUALIFYING_GRAPH[stage]!.winTo : QUALIFYING_GRAPH[stage]!.loseTo;
        break;
      }
      case 'bye': {
        const stage = nodeOf(step.stage);
        if (!stage) break;
        if (at !== null && at !== stage) gaps.push(`${at} -> ${stage} (bye with no route)`);
        at = step.advanceTo;
        break;
      }
      case 'dropped':
        /*
         * A drop is the loser's declared destination, so the story is already there - this only
         * confirms where "there" is.
         */
        at = step.toEntry;
        break;
      default:
        break;
    }
    if (at === LEAGUE_PHASE || at === OUT) break;
  }
  return gaps;
}

/** Every qualifying stage the journey actually mentions, in order. */
function stagesMentioned(journey: EuropeanJourney): string[] {
  const stages: string[] = [];
  for (const step of journey.steps) {
    if (step.kind === 'tie' && step.tie.stage in QUALIFYING_GRAPH) stages.push(step.tie.stage);
    if (step.kind === 'bye') stages.push(step.stage);
  }
  return stages;
}

describe('the qualifying story is a connected path', () => {
  it('never jumps a qualifying round in a real career', () => {
    /*
     * Real careers rather than a constructed field: the bug was found by playing, and the pairing
     * that produces a bye depends on how many clubs happen to land on a node that season.
     */
    const gaps: string[] = [];
    let journeys = 0;
    let byes = 0;

    for (let i = 0; i < 40; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 6000 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          const journey = career.world.europe?.current?.playerJourney;
          if (!journey) return;
          journeys += 1;
          byes += journey.steps.filter((s) => s.kind === 'bye').length;
          gaps.push(...gapsIn(journey).map((gap) => `seed ${career.seed}: ${gap}`));
        },
      });
    }

    expect(journeys).toBeGreaterThan(50);
    expect([...new Set(gaps)]).toEqual([]);
    /* And the case that caused the bug really does occur, or this test proves nothing. */
    expect(byes).toBeGreaterThan(0);
  });

  it('explains the exact jump that was reported: Q1 straight to Q3', () => {
    /*
     * The reported symptom, asserted directly. Whenever a campaign's story moves between two
     * qualifying rounds that are not adjacent in the graph, there must be a step accounting for
     * every node in between - which, for the case that shipped, is the bye at round 2.
     *
     * Constructed odd fields were tried first and are not used: `simulateEuropeanSeason` always
     * merges EUROPEAN_FIELD into the draw, so the entrant count at any node is not something a
     * caller can dictate. Real careers produce real byes, and this looks at those.
     */
    const unexplained: string[] = [];
    let byesSeen = 0;
    let midRoundByes = 0;

    for (let i = 0; i < 60; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 8000 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          const journey = career.world.europe?.current?.playerJourney;
          if (!journey) return;
          const stages = stagesMentioned(journey);
          for (let n = 1; n < stages.length; n += 1) {
            const from = stages[n - 1]!;
            const to = stages[n]!;
            /*
             * Consecutive mentioned stages must be one hop apart in the graph - the winner's
             * route or the loser's. Anything else is a round the story passed over.
             */
            const node = QUALIFYING_GRAPH[from]!;
            if (node.winTo !== to && node.loseTo !== to) {
              unexplained.push(`seed ${career.seed}: ${from} -> ${to}`);
            }
          }
          for (const step of journey.steps) {
            if (step.kind !== 'bye') continue;
            byesSeen += 1;
            /* A bye at a round that is neither the first nor the last is the reported shape. */
            if (QUALIFYING_GRAPH[step.stage]!.winTo !== LEAGUE_PHASE) midRoundByes += 1;
          }
        },
      });
    }

    expect([...new Set(unexplained)]).toEqual([]);
    expect(byesSeen, 'no bye occurred, so this proves nothing').toBeGreaterThan(0);
    expect(midRoundByes, 'no mid-qualifying bye occurred - the reported shape').toBeGreaterThan(0);
  });

  it('gives a bye no opponent, no score and no match', () => {
    /*
     * The honesty half. A bye must not acquire a fixture to make the row look like the others -
     * and it must not count as a match played, because none was.
     */
    for (let i = 0; i < 20; i += 1) {
      simulateCareer({
        playerName: 'אורי דביר',
        position: 'ST',
        seed: 7000 + i,
        policy: balancedPolicy,
        onStep: (career) => {
          const journey = career.world.europe?.current?.playerJourney;
          if (!journey) return;
          for (const step of journey.steps) {
            if (step.kind !== 'bye') continue;
            /* The shape is exactly four fields; anything else would be an invented fact. */
            expect(Object.keys(step).sort()).toEqual(['advanceTo', 'competition', 'kind', 'stage']);
          }
          /* Matches counts real fixtures: two legs per tie, and nothing for a bye. */
          const ties = journey.steps.filter((s) => s.kind === 'tie').length;
          expect(journey.matches).toBeGreaterThanOrEqual(ties);
        },
      });
    }
  });

  it('presents a bye in both Europe views, and invents nothing', () => {
    const source = readEuropeCards();
    expect(source).toContain("step.kind === 'bye'");
    expect(source).toContain("case 'bye':");
    expect(source).toContain('ByeLine');
    /* A bye line may not render a scoreline or an aggregate. */
    const bye = source.slice(source.indexOf('function ByeLine'), source.indexOf('function ByeLine') + 700);
    for (const banned of ['aggFor', 'aggAgainst', 'legs', 'opponentName', 'won']) {
      expect(bye.includes(banned), `ByeLine references ${banned}`).toBe(false);
    }
  });
});

describe('recording a bye changed the story and not the football', () => {
  it('draws nothing: the bye branch pushes a record and consumes no randomness', () => {
    /*
     * The step is appended to `steps`, which is a record of what happened. If the branch had
     * taken an rng draw, every downstream roll in the European season would shift and the
     * same-seed regression would move - so this checks the branch itself.
     */
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../src/game/uefaEngine.ts'), 'utf8');

    const at = source.indexOf('if (entrants.length % 2 === 1) {');
    expect(at).toBeGreaterThan(-1);
    const branch = source.slice(at, source.indexOf('// Seeded pairing', at));
    expect(branch).toContain("kind: 'bye'");
    for (const banned of ['rng.', 'playTie', 'playLeg', 'Math.random']) {
      expect(branch.includes(banned), `the bye branch calls ${banned}`).toBe(false);
    }
    /* And it must not award coefficient points or matches - a bye earns neither. */
    expect(branch.includes('coefficientPoints')).toBe(false);
    expect(branch.includes('matches +=')).toBe(false);
  });
});

function readEuropeCards(): string {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  return fs.readFileSync(path.resolve(__dirname, '../src/components/EuropeCards.tsx'), 'utf8');
}

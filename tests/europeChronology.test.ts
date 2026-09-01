/**
 * Europe may not reveal the future (v0.9.6, Phase 2).
 *
 * ## The leak
 *
 * `simulateEuropeanSeason` runs the whole continental season the moment it starts. That is right
 * for a deterministic engine and wrong as a source of truth for a screen: from the first preseason
 * beat, `world.europe.current.playerJourney` already contains the final league-phase table, the
 * knockout draw, the elimination and the trophy.
 *
 * Nothing stopped the UI reading it, and the home screen did:
 *
 *     const phase = journey?.steps.find((step) => step.kind === 'league_phase');
 *     const where = phase ? `מקום ${phase.position}` : ...
 *
 * so the Europe panel printed the club's FINAL standing before a European match had been played.
 *
 * ## What is asserted here
 *
 * The engine keeps simulating everything - that is not the bug and is not changed. What must hold
 * is that `europePresentation` never hands a component a fact the player has not lived through,
 * and that the components ask it rather than reading the journey directly.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  europeReveal,
  mayShowKnockouts,
  mayShowLeaguePhaseTable,
  mayShowQualifying,
  revealedFurthest,
  revealedSteps,
} from '../src/game/europePresentation';
import { QUALIFYING_GRAPH } from '../src/data/uefa';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, EuropeanJourney } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Every (career, journey) pair a real career passes through, with its European season live. */
function journeyMoments(seeds: number): { career: Career; journey: EuropeanJourney }[] {
  const moments: { career: Career; journey: EuropeanJourney }[] = [];
  for (let i = 0; i < seeds; i += 1) {
    simulateCareer({
      playerName: 'אורי דביר',
      position: 'ST',
      seed: 9100 + i,
      policy: balancedPolicy,
      onStep: (career) => {
        const journey = career.world.europe?.current?.playerJourney;
        if (journey && journey.clubId === career.currentClubId) moments.push({ career, journey });
      },
    });
  }
  return moments;
}

describe('the reveal stage follows the career, not the simulation', () => {
  it('maps the game\'s own seasonPoint onto three stages', () => {
    const base = { seasonPoint: 'preseason', phase: 'preseason', retired: false } as unknown as Career;
    expect(europeReveal(base)).toBe('entry');
    expect(europeReveal({ ...base, seasonPoint: 'midseason' } as Career)).toBe('qualifying');
    expect(europeReveal({ ...base, seasonPoint: 'season_end' } as Career)).toBe('full');
    /* Settlement is full regardless of where seasonPoint happens to be. */
    expect(europeReveal({ ...base, phase: 'season_result' } as Career)).toBe('full');
    expect(europeReveal({ ...base, retired: true } as Career)).toBe('full');
  });

  it('gates each class of fact at the right stage', () => {
    const at = (seasonPoint: string): Career =>
      ({ seasonPoint, phase: 'event', retired: false }) as unknown as Career;

    expect(mayShowQualifying(at('preseason'))).toBe(false);
    expect(mayShowQualifying(at('midseason'))).toBe(true);

    /* The table and the knockouts are results, and belong only to settlement. */
    expect(mayShowLeaguePhaseTable(at('preseason'))).toBe(false);
    expect(mayShowLeaguePhaseTable(at('midseason'))).toBe(false);
    expect(mayShowLeaguePhaseTable(at('season_end'))).toBe(true);
    expect(mayShowKnockouts(at('midseason'))).toBe(false);
    expect(mayShowKnockouts(at('season_end'))).toBe(true);
  });
});

describe('early in the season, nothing about the future is reachable', () => {
  const moments = journeyMoments(30);

  it('has real journeys to interrogate, at every stage', () => {
    expect(moments.length).toBeGreaterThan(100);
    const stages = new Set(moments.map((m) => europeReveal(m.career)));
    /* If the sweep never reaches an early stage, this whole file proves nothing. */
    expect(stages.has('entry')).toBe(true);
    expect(stages.has('full')).toBe(true);
  });

  it('never exposes the final league-phase table before settlement', () => {
    const leaks: string[] = [];
    for (const { career, journey } of moments) {
      if (europeReveal(career) === 'full') continue;
      const shown = revealedSteps(career, journey);
      for (const step of shown) {
        if (step.kind === 'league_phase') {
          leaks.push(`${europeReveal(career)}: position ${step.position} exposed`);
        }
      }
    }
    expect([...new Set(leaks)]).toEqual([]);
  });

  it('never exposes a knockout tie, an elimination or a trophy before settlement', () => {
    const leaks: string[] = [];
    for (const { career, journey } of moments) {
      const reveal = europeReveal(career);
      if (reveal === 'full') continue;
      for (const step of revealedSteps(career, journey)) {
        if (step.kind === 'champion') leaks.push(`${reveal}: champion exposed`);
        if (step.kind === 'tie' && !(step.tie.stage in QUALIFYING_GRAPH)) {
          leaks.push(`${reveal}: knockout ${step.tie.stage} vs ${step.tie.opponentName} exposed`);
        }
      }
    }
    expect([...new Set(leaks)]).toEqual([]);
  });

  it('says nothing at all about results before the season starts', () => {
    /*
     * At entry reveal the only honest facts are which competition and where the club came in -
     * both of which live on the `entered` step. Anything else would be a result.
     */
    for (const { career, journey } of moments) {
      if (europeReveal(career) !== 'entry') continue;
      const kinds = new Set(revealedSteps(career, journey).map((step) => step.kind));
      expect([...kinds].filter((kind) => kind !== 'entered')).toEqual([]);
      expect(revealedFurthest(career, journey)).toBeNull();
    }
  });

  it('shows the completed qualifying path once the summer is behind him', () => {
    /*
     * The other half of the rule: the gate must not be so tight that it hides the past. A club
     * that played qualifying ties must be able to see them by midseason.
     */
    let sawQualifying = false;
    for (const { career, journey } of moments) {
      if (europeReveal(career) !== 'qualifying') continue;
      const shown = revealedSteps(career, journey);
      if (shown.some((step) => step.kind === 'tie' || step.kind === 'bye')) sawQualifying = true;
      /* And the full journey is never SHORTER than what is revealed from it. */
      expect(shown.length).toBeLessThanOrEqual(journey.steps.length);
    }
    expect(sawQualifying, 'no qualifying path was ever revealed at midseason').toBe(true);
  });

  it('reveals everything once the season is settled', () => {
    for (const { career, journey } of moments) {
      if (europeReveal(career) !== 'full') continue;
      expect(revealedSteps(career, journey)).toEqual(journey.steps);
      expect(revealedFurthest(career, journey)).toBe(journey.furthest);
    }
  });
});

describe('chronology is decided in one place', () => {
  it('routes every component through the presentation authority', () => {
    /*
     * The rule that keeps this from rotting: a component may not reach into `journey.steps` and
     * decide for itself. If a fourth consumer appears and reads the journey directly, it inherits
     * the bug this phase removed - so the direct reads are forbidden here.
     */
    for (const file of [
      'src/components/CareerHome.tsx',
      'src/components/EuropeCards.tsx',
      'src/components/EuropeStandings.tsx',
    ]) {
      const source = stripComments(read(file));
      if (!source.includes('playerJourney') && !source.includes('journey.steps')) continue;
      expect(source, `${file} does not consult europePresentation`).toContain('europePresentation');
      /* `journey.steps` may only be passed TO the authority, never filtered in the component. */
      expect(
        source.includes('journey.steps.find') || source.includes('journey.steps.filter'),
        `${file} reads journey.steps directly`,
      ).toBe(false);
    }
  });

  it('keeps the standings sheet closed until the table is history', () => {
    const source = stripComments(read('src/components/EuropeStandings.tsx'));
    expect(source).toContain('mayShowLeaguePhaseTable(career)');
  });

  it('invents no partial standings anywhere', () => {
    /*
     * The engine has no halfway table. The honest answer for a league phase in progress is to say
     * so - not to compute a plausible-looking one, which would swap a premature truth for a
     * fabricated one.
     */
    const source = stripComments(read('src/game/europePresentation.ts'));
    for (const banned of ['Math.random', 'rng', 'slice(0, ', 'position:']) {
      expect(source.includes(banned), `europePresentation fabricates via ${banned}`).toBe(false);
    }
  });
});

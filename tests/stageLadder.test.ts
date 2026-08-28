/**
 * v0.4.5.1 Phase 8: the academy ladder drawn under an age-group transition.
 *
 * The point of the ladder is that an early promotion should be legible as a *jump* without
 * reading the title - two rungs light up instead of one. That is a property of `rungState`, so
 * that is what is tested here.
 */

import { describe, expect, it } from 'vitest';

import { LAST_YOUTH_STAGE, stageOrder, STAGE_LADDER } from '../src/data/academy';
import { rungState } from '../src/components/StageLadder';
import type { AcademyStage } from '../src/types';

/** How many rungs light up as "covered this season" for a given step. */
function gained(from: AcademyStage, to: AcademyStage): AcademyStage[] {
  return STAGE_LADDER.filter((stage) => rungState(stage, from, to) === 'gained');
}

describe('the ladder marks the step that was taken', () => {
  it('lights one rung for an ordinary promotion', () => {
    expect(gained('children_b', 'children_a')).toEqual(['children_a']);
  });

  it('lights two rungs for an early promotion, so a jump looks like a jump', () => {
    // This is the whole reason the ladder is drawn rather than described.
    expect(gained('children_a', 'youth_b')).toEqual(['youth_c', 'youth_b']);
  });

  it('lights nothing when the cohort caught up and he did not move', () => {
    expect(gained('youth_b', 'youth_b')).toEqual([]);
  });

  it('counts the rung he started on as covered, not as a gap', () => {
    /*
     * `from` used to fall through to neither branch, leaving a grey rung between the covered
     * road and the newly lit one - which read as a missing step rather than as the place he was
     * standing.
     */
    expect(rungState('children_a', 'children_a', 'youth_b')).toBe('behind');
  });

  it('leaves everything past the new rung ahead of him', () => {
    const ahead = STAGE_LADDER.filter((s) => rungState(s, 'children_b', 'children_a') === 'ahead');
    expect(ahead[0]).toBe('youth_c');
    expect(ahead).toContain('senior');
  });

  it('classifies every rung exactly once, for every step on the ladder', () => {
    for (let i = 0; i < STAGE_LADDER.length - 1; i += 1) {
      const from = STAGE_LADDER[i] as AcademyStage;
      const to = STAGE_LADDER[i + 1] as AcademyStage;
      const states = STAGE_LADDER.map((s) => rungState(s, from, to));
      expect(states, `${from} -> ${to}`).toHaveLength(STAGE_LADDER.length);
      expect(states.filter((s) => s === 'gained'), `${from} -> ${to}`).toHaveLength(1);
      expect(states.filter((s) => s === 'behind'), `${from} -> ${to}`).toHaveLength(i + 1);
    }
  });

  it('puts בוגרים at the end of the ladder, past the last youth stage', () => {
    // The ladder ends at נוער; senior is a transition with a decision attached, not a rung.
    expect(STAGE_LADDER[STAGE_LADDER.length - 1]).toBe('senior');
    expect(stageOrder('senior')).toBe(stageOrder(LAST_YOUTH_STAGE) + 1);
  });
});

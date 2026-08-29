/**
 * Controlled scenarios for v0.6.2.
 *
 * Ten careers constructed to sit exactly on the four targets - derby leakage, terminology, the two
 * greatness axes, and the cup as an authoritative fact - rather than sampled and hoped for. The
 * population tests elsewhere say "this does not happen"; these say "here is the specific case, and
 * here is what it does".
 */

import { describe, expect, it } from 'vitest';

import { ACHIEVEMENT_DEFS } from '../src/data/achievements';
import { MACCABI_ID } from '../src/data/clubs';
import { EVENT_POOL } from '../src/data/events';
import { rivalryBetween } from '../src/data/rivalries';
import { createCareer } from '../src/game/careerEngine';
import { cupFinalOpponent, isCupFinalDerby, reachedCupFinal, wonCupThisSeason } from '../src/game/cupEngine';
import { isEventEligible } from '../src/game/eventEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { LEGACY_MILESTONES, globalCareerScore, maccabiLegacyComponents, maccabiLegacyScore } from '../src/game/maccabiLegacy';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, CupSeasonState, Trophy } from '../src/types';

const HAPOEL_HAIFA = 'hapoel_haifa';
const KFAR_SABA = 'hapoel_kfar_saba';

function seniorAt(clubId: string, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability: 76,
    roleValue: 72,
    currentSeason: 2044,
  };
}

function withCup(career: Career, cup: Partial<CupSeasonState>): Career {
  return {
    ...career,
    world: {
      ...career.world,
      cup: {
        season: career.currentSeason,
        clubId: career.currentClubId,
        trophyId: 'cup',
        run: 'winners',
        finalOpponentId: null,
        ...cup,
      },
    },
  };
}

function cupTrophy(career: Career): Trophy {
  return {
    id: 'cup',
    name: 'גביע המדינה',
    season: career.currentSeason,
    clubId: career.currentClubId,
    clubName: career.currentClubId,
    weight: 3,
  };
}

const wonFinal = EVENT_POOL.find((e) => e.id === 'sen_cup_final_won')!;
const lostFinal = EVENT_POOL.find((e) => e.id === 'sen_cup_final_lost')!;

/* ================================================================== */

describe('v0.6.2 A. the reported career: a cup final that is not a derby', () => {
  it('reaches the final, wins it, and collects no derby anything', () => {
    const career = withCup(seniorAt(KFAR_SABA), {
      run: 'winners',
      finalOpponentId: 'hapoel_umm_al_fahm',
    });
    expect(reachedCupFinal(career)).toBe(true);
    expect(isCupFinalDerby(career)).toBe(false);

    const derbyIds = new Set(
      ACHIEVEMENT_DEFS.filter((a) => a.category === 'derby').map((a) => a.id),
    );
    const granted = wonFinal.choices.flatMap((c) =>
      c.outcomes.map((o) => o.effects?.achievement).filter(Boolean),
    );
    for (const id of granted) expect(derbyIds.has(id as string)).toBe(false);
    expect(granted).toContain('cup_final_hero');
  });
});

describe('v0.6.2 B. a cup final that genuinely IS a derby', () => {
  it('is a derby because the finalists are rivals, not because the event said so', () => {
    const career = withCup(seniorAt(MACCABI_ID), {
      run: 'runner_up',
      finalOpponentId: HAPOEL_HAIFA,
    });
    expect(rivalryBetween(MACCABI_ID, HAPOEL_HAIFA)?.type).toBe('localDerby');
    expect(isCupFinalDerby(career)).toBe(true);

    // And the event that fires is still the cup event, gated on the cup and not on the derby.
    expect(lostFinal.conditions.requiresDerby).toBeUndefined();
    expect(lostFinal.conditions.cupFinal).toBe('lost');
  });
});

describe('v0.6.2 C. a final won', () => {
  it('offers the won variant only, and the trophy agrees with the state', () => {
    const career = withCup(seniorAt(MACCABI_ID), {
      run: 'winners',
      finalOpponentId: 'maccabi_tel_aviv',
    });
    expect(isEventEligible(lostFinal, career, 'late')).toBe(false);
    expect(wonCupThisSeason(career)).toBe(true);

    const withTrophy = { ...career, trophies: [cupTrophy(career)] };
    const codes = validateCareerIntegrity(withTrophy).map((v) => v.code);
    expect(codes).not.toContain('cup_trophy_without_cup_win');
    expect(codes).not.toContain('cup_trophy_kind_mismatch');
  });
});

describe('v0.6.2 D. a final lost', () => {
  it('offers the lost variant only, and a cup trophy would be a violation', () => {
    const career = withCup(seniorAt(MACCABI_ID), {
      run: 'runner_up',
      finalOpponentId: 'maccabi_tel_aviv',
    });
    expect(isEventEligible(wonFinal, career, 'late')).toBe(false);
    expect(wonCupThisSeason(career)).toBe(false);
    expect(cupFinalOpponent(career)).toBe('maccabi_tel_aviv');

    const lying = { ...career, trophies: [cupTrophy(career)] };
    expect(validateCareerIntegrity(lying).map((v) => v.code)).toContain('cup_trophy_without_cup_win');
  });
});

describe('v0.6.2 E. a cup run that never reached a final', () => {
  it('supports no cup-final event and no cup trophy', () => {
    const career = withCup(seniorAt(MACCABI_ID), { run: 'semi_final', finalOpponentId: null });
    for (const slot of ['early', 'mid', 'late'] as const) {
      expect(isEventEligible(wonFinal, career, slot)).toBe(false);
      expect(isEventEligible(lostFinal, career, slot)).toBe(false);
    }
    const lying = { ...career, trophies: [cupTrophy(career)] };
    expect(validateCareerIntegrity(lying).map((v) => v.code)).toContain('cup_trophy_without_cup_win');
  });
});

describe('v0.6.2 F. a pre-v0.6.2 save with no cup state', () => {
  it('loses cup-final events for the season in progress and crashes nothing', () => {
    const career = seniorAt(MACCABI_ID);
    expect(career.world.cup).toBeUndefined();
    expect(reachedCupFinal(career)).toBe(false);
    expect(wonCupThisSeason(career)).toBe(false);
    expect(cupFinalOpponent(career)).toBeNull();
    expect(isCupFinalDerby(career)).toBe(false);
    for (const slot of ['early', 'mid', 'late'] as const) {
      expect(isEventEligible(wonFinal, career, slot)).toBe(false);
      expect(isEventEligible(lostFinal, career, slot)).toBe(false);
    }
    // And a cup he won under the old engine is not retroactively a violation.
    const old = { ...career, trophies: [{ ...cupTrophy(career), season: 2040 }] };
    expect(validateCareerIntegrity(old).map((v) => v.code)).not.toContain(
      'cup_trophy_without_cup_win',
    );
  });
});

describe('v0.6.2 G. stale cup state', () => {
  it('is a violation in its own right rather than something quietly ignored', () => {
    const career = withCup(seniorAt(MACCABI_ID), { run: 'winners' });

    const wrongSeason = { ...career, currentSeason: career.currentSeason + 1 };
    expect(validateCareerIntegrity(wrongSeason).map((v) => v.code)).toContain(
      'cup_state_out_of_scope',
    );

    const wrongClub = { ...career, currentClubId: HAPOEL_HAIFA };
    expect(validateCareerIntegrity(wrongClub).map((v) => v.code)).toContain(
      'cup_state_out_of_scope',
    );
  });
});

describe('v0.6.2 H. a derby honour on a career that never had a rival', () => {
  it('is caught by the validator', () => {
    const career = seniorAt(KFAR_SABA);
    const lying: Career = {
      ...career,
      seasonHistory: [],
      achievements: [
        {
          id: 'derby_moment',
          name: 'הרגע בדרבי',
          description: 'שער שהשתיק אצטדיון שלם.',
          season: career.currentSeason,
          icon: '🔥',
        },
      ],
    };
    expect(validateCareerIntegrity(lying).map((v) => v.code)).toContain(
      'derby_claim_without_rival',
    );
  });

  it('is not raised for a career that once played somewhere with a rival', () => {
    const career = seniorAt(KFAR_SABA);
    const honest: Career = {
      ...career,
      seasonHistory: [
        {
          season: 2041,
          age: 23,
          academyStage: 'senior',
          clubId: MACCABI_ID,
          clubName: 'מכבי חיפה',
          teamName: 'מכבי חיפה',
          league: 'ליגת העל',
          onLoan: false,
          stats: {
            appearances: 30,
            starts: 28,
            goals: 9,
            assists: 4,
            cleanSheets: 0,
            goalsConceded: 0,
            rating: 72,
            injuredGames: 0,
          },
          firstHalf: null,
          ability: 74,
          role: career.role,
          coachTrust: 60,
          trophies: [],
          captain: false,
          olderGroup: career.olderGroup,
        },
      ],
      achievements: [
        {
          id: 'derby_moment',
          name: 'הרגע בדרבי',
          description: 'שער שהשתיק אצטדיון שלם.',
          season: 2041,
          icon: '🔥',
        },
      ],
    };
    expect(validateCareerIntegrity(honest).map((v) => v.code)).not.toContain(
      'derby_claim_without_rival',
    );
  });
});

describe('v0.6.2 I. terminology', () => {
  it('never calls an all-competition figure a league figure', () => {
    /*
     * v0.6.1 rescoped the historical dataset to all competitions and left the word ליגה on the
     * milestones that read from it. Legacy prose is the surface a player actually reads, so it is
     * the surface the audit walks.
     */
    for (const milestone of LEGACY_MILESTONES) {
      const text = `${milestone.text ?? ''}`;
      expect(text.includes('הופעות ליגה'), milestone.id).toBe(false);
    }
    const career = simulateCareer({
      playerName: 'ת',
      position: 'ST',
      seed: 31,
      policy: balancedPolicy,
    });
    for (const component of maccabiLegacyComponents(career)) {
      expect(`${component.label} ${component.detail ?? ''}`).not.toContain('הופעות ליגה');
    }
  });
});

describe('v0.6.2 J. two greatness axes, and only two', () => {
  it('exposes Global Career and Maccabi Legacy as independent numbers', () => {
    const career = simulateCareer({
      playerName: 'ת',
      position: 'ST',
      seed: 77,
      policy: balancedPolicy,
    });
    const global = globalCareerScore(career);
    const legacy = maccabiLegacyScore(career);
    for (const score of [global, legacy]) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the retirement screen off the old Legend Score', () => {
    /*
     * A source assertion rather than a rendered one: the poster must not read `legend.score`, and
     * a file that does not reference it cannot show it. `legend` itself stays on the career for
     * save compatibility and for the endings prose.
     */
    const source = readRetirementSource();
    expect(source).not.toMatch(/legend\?\.score/);

    /*
     * Comments are stripped first. The file explains at length why מדד אגדה was retired, and a
     * naive substring search reads its own justification as a violation - which is how a guard
     * ends up forbidding the note that documents it.
     */
    const rendered = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rendered).toContain('מורשת מכבי');
    expect(rendered).toContain('קריירה עולמית');
    expect(rendered).not.toContain('מדד אגדה');

    // Exactly two score labels on the poster: the two axes and nothing beside them.
    const labels = rendered.match(/poster-score-label/g) ?? [];
    expect(labels.length).toBe(2);
  });
});

function readRetirementSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  return fs.readFileSync(path.resolve(__dirname, '../src/pages/RetirementPage.tsx'), 'utf8');
}

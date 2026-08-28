/**
 * v0.4 Phase 0.2 / 0.3: professional-football eligibility, and the final youth transition.
 *
 * The rule these guard is a football rule, not a balance number: a twelve year old cannot
 * train with the first team, sit on a senior bench, or be offered a professional contract.
 * Playtesting found all three happening, because `seniorPhases` is derived from appearances
 * and age and is therefore defined for a child too.
 */

import { describe, expect, it } from 'vitest';

import { STAGE_LADDER, stageOrder } from '../src/data/academy';
import { EVENT_POOL } from '../src/data/events';
import { FIRST_ACADEMY_SEASON } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import { naturalStageFor, nextNaturalStage } from '../src/game/cohort';
import { matchesConditions } from '../src/game/conditions';
import {
  allowsExceptionalSeniorContact,
  allowsProfessionalEvent,
  allowsSeniorContact,
  isSenior,
  NO_PROFESSIONAL_CONTACT_STAGES,
} from '../src/game/eligibility';
import { isEventEligible } from '../src/game/eventEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { evaluateSeniorTransition } from '../src/game/transferEngine';
import type { AcademyStage, Career, GameEvent } from '../src/types';

const base = (seed = 5): Career => createCareer({ playerName: 'א', position: 'CM', seed });

/** A deliberately outstanding player, to prove the gate holds even for a prodigy. */
const prodigyAt = (stage: AcademyStage): Career => ({
  ...base(),
  academyStage: stage,
  currentSeason: FIRST_ACADEMY_SEASON + stageOrder(stage),
  ability: 75,
  coachTrust: 90,
  roleValue: 88,
  reputation: 50,
  hidden: { ...base().hidden, potential: 96, form: 85, confidence: 85 },
});

const ctx = { appearances: 10, phase: 'early' as const };

function allText(event: GameEvent): string {
  return [
    event.title,
    event.description,
    event.kicker ?? '',
    ...event.choices.flatMap((c) => [c.label, c.hint ?? '', ...c.outcomes.map((o) => o.text)]),
  ].join(' ');
}

/* ------------------------------------------------------------------ */

describe('professional eligibility by stage', () => {
  it('allows nothing professional below נערים א׳, even for a prodigy', () => {
    for (const stage of NO_PROFESSIONAL_CONTACT_STAGES) {
      const career = prodigyAt(stage);
      expect(allowsSeniorContact(career), stage).toBe(false);
      expect(allowsExceptionalSeniorContact(career), stage).toBe(false);
      expect(allowsProfessionalEvent(career), stage).toBe(false);
    }
  });

  it('allows first-team contact normally from נוער', () => {
    const career = prodigyAt('u19');
    expect(allowsSeniorContact(career)).toBe(true);
    expect(allowsProfessionalEvent(career)).toBe(true);
  });

  it('treats a senior player as eligible for everything professional', () => {
    const career: Career = { ...base(), academyStage: 'senior', age: 24 };
    expect(isSenior(career)).toBe(true);
    expect(allowsProfessionalEvent(career)).toBe(true);
  });

  it('lets an extraordinary נערים א׳ player get a look - but only an extraordinary one', () => {
    const prodigy = prodigyAt('youth_a');
    expect(allowsExceptionalSeniorContact(prodigy)).toBe(true);

    // Good, but not extraordinary on every axis: still no.
    const goodNotGreat: Career = { ...prodigy, coachTrust: 55 };
    expect(allowsExceptionalSeniorContact(goodNotGreat)).toBe(false);

    const notFarEnoughAhead: Career = { ...prodigy, ability: 60 };
    expect(allowsExceptionalSeniorContact(notFarEnoughAhead)).toBe(false);

    const lowerPotential: Career = {
      ...prodigy,
      hidden: { ...prodigy.hidden, potential: 70 },
    };
    expect(allowsExceptionalSeniorContact(lowerPotential)).toBe(false);
  });

  it('does not treat the exceptional case as normal senior contact', () => {
    // The distinction matters: contract events must not use allowsExceptionalYouth.
    expect(allowsSeniorContact(prodigyAt('youth_a'))).toBe(false);
  });
});

describe('professional conditions', () => {
  it('blocks a professional-flagged event below נוער', () => {
    for (const stage of NO_PROFESSIONAL_CONTACT_STAGES) {
      expect(
        matchesConditions(prodigyAt(stage), { requiresProfessionalFootball: true }, ctx),
        stage,
      ).toBe(false);
    }
    expect(matchesConditions(prodigyAt('u19'), { requiresProfessionalFootball: true }, ctx)).toBe(
      true,
    );
  });

  it('lets allowsExceptionalYouth reach an extraordinary נערים א׳ player only', () => {
    const conditions = { requiresProfessionalFootball: true, allowsExceptionalYouth: true };
    expect(matchesConditions(prodigyAt('youth_a'), conditions, ctx)).toBe(true);
    // Same flag, ordinary player: still blocked.
    const ordinary: Career = { ...prodigyAt('youth_a'), coachTrust: 45, ability: 55 };
    expect(matchesConditions(ordinary, conditions, ctx)).toBe(false);
    // And it never opens the door lower down.
    expect(matchesConditions(prodigyAt('youth_b'), conditions, ctx)).toBe(false);
  });

  it('makes seniorPhases imply professional football', () => {
    /*
     * This was the actual bug: seniorPhase() is computed from appearances and age, so it
     * returns 'breakthrough' for a nine year old and breakthrough events reached children.
     */
    expect(matchesConditions(prodigyAt('pre_b'), { seniorPhases: ['breakthrough'] }, ctx)).toBe(
      false,
    );
    expect(matchesConditions(prodigyAt('children_a'), { seniorPhases: ['breakthrough'] }, ctx)).toBe(
      false,
    );
  });
});

describe('no professional event leaks into childhood', () => {
  /** Words that only belong to professional football. */
  const PRO_WORDS = ['הקבוצה הבוגרת', 'סגל הבוגרים', 'חוזה בוגרים', 'חוזה מקצועני'];

  it('never offers a professional-flavoured event in a forbidden stage', () => {
    const offenders: string[] = [];

    for (const stage of NO_PROFESSIONAL_CONTACT_STAGES) {
      const career = prodigyAt(stage);
      for (const slot of ['early', 'mid', 'late'] as const) {
        for (const event of EVENT_POOL) {
          if (!isEventEligible(event, career, slot)) continue;
          const text = allText(event);
          for (const word of PRO_WORDS) {
            if (!text.includes(word)) continue;
            offenders.push(`${event.id} @ ${stage} ("${word}")`);
          }
        }
      }
    }

    expect([...new Set(offenders)], [...new Set(offenders)].join('; ')).toEqual([]);
  });

  it('never offers a promotion-category event to a child', () => {
    const youngStages: AcademyStage[] = ['pre_b', 'pre_a', 'children_c', 'children_b'];
    for (const stage of youngStages) {
      const career = prodigyAt(stage);
      for (const event of EVENT_POOL) {
        if (!isEventEligible(event, career, 'early')) continue;
        expect(event.category, `${event.id} @ ${stage}`).not.toBe('promotion');
      }
    }
  });
});

/* ------------------------------------------------------------------ */

describe('the final youth transition', () => {
  /** A נוער player whose cohort has reached senior football - the normal case. */
  const finalYouthSeason = (overrides: Partial<Career> = {}): Career => ({
    ...base(),
    academyStage: 'u19',
    currentSeason: FIRST_ACADEMY_SEASON + stageOrder('u19'),
    ability: 55,
    coachTrust: 45,
    roleValue: 45,
    ...overrides,
  });

  it('never keeps a player in youth once his cohort has reached senior football', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const career = finalYouthSeason({ ability: 40 + (seed % 30), coachTrust: seed % 80 });
      // His cohort is senior next season, so there is no youth team left for him.
      expect(nextNaturalStage(career)).toBe('senior');
      const verdict = evaluateSeniorTransition(career, createRng(seed));
      expect(verdict.path, `seed ${seed}`).not.toBe('another_year');
    }
  });

  it('still allows another נוער season for a player whose cohort has not caught up', () => {
    // Pushed up early: at נוער while his own year is still at נערים א׳.
    const early = finalYouthSeason({
      currentSeason: FIRST_ACADEMY_SEASON + stageOrder('youth_a'),
      age: 17,
    });
    expect(naturalStageFor(early.birthCohort, early.currentSeason)).toBe('youth_a');
    expect(nextNaturalStage(early)).toBe('u19');

    let sawAnotherYear = false;
    for (let seed = 1; seed <= 200 && !sawAnotherYear; seed += 1) {
      if (evaluateSeniorTransition(early, createRng(seed)).path === 'another_year') {
        sawAnotherYear = true;
      }
    }
    expect(sawAnotherYear).toBe(true);
  });

  it('always resolves the final youth season into a real outcome', () => {
    const paths = new Set<string>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const career = finalYouthSeason({
        ability: 30 + (seed % 50),
        coachTrust: seed % 95,
        roleValue: seed % 90,
        reputation: seed % 60,
      });
      paths.add(evaluateSeniorTransition(career, createRng(seed)).path);
    }
    // Contract, contract+loan and release must all be reachable.
    expect(paths.has('contract') || paths.has('contract_loan')).toBe(true);
    expect(paths.has('released')).toBe(true);
    expect(paths.has('another_year')).toBe(false);
  });

  it('leaves nobody stranded in the academy in full simulated careers', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const career = simulateCareer({ playerName: 'א', position: 'CM', seed, policy: balancedPolicy });
      const academy = career.seasonHistory.filter((s) => s.academyStage !== 'senior');
      for (const season of academy) {
        const natural = naturalStageFor(career.birthCohort, season.season);
        // Nobody plays youth football after his cohort has turned professional.
        expect(
          stageOrder(natural) <= stageOrder('u19'),
          `seed ${seed}: youth season ${season.season} but cohort is ${natural}`,
        ).toBe(true);
      }
    }
  });

  it('keeps the ladder intact', () => {
    expect(NO_PROFESSIONAL_CONTACT_STAGES.every((s) => STAGE_LADDER.includes(s))).toBe(true);
    expect(NO_PROFESSIONAL_CONTACT_STAGES).not.toContain('u19');
    expect(NO_PROFESSIONAL_CONTACT_STAGES).not.toContain('youth_a');
  });
});

/**
 * The people around the career (v0.5).
 *
 * The controlled scenarios from the brief (Phases 53-64) plus the architecture invariants
 * (Phase 74): identity persistence, name determinism, trust scoping, eligibility, market
 * modifiers, negotiation limits, position fit, diminishing returns, the Maccabism guard, and
 * save/load round-tripping.
 *
 * The style follows the reconciliation suite: controlled scenarios use hand-built state so the
 * assertion is exact; population claims sweep real simulated careers.
 */

import { describe, expect, it } from 'vitest';

import { getClub, MACCABI_ID } from '../src/data/clubs';
import { AGENT_ARCHETYPES, MANAGER_ARCHETYPES, specialtiesFor } from '../src/data/people';
import { PEOPLE_EVENTS } from '../src/data/events/peopleEvents';
import { autoStep, createCareer, hydrateCareer } from '../src/game/careerEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { drawDestination, marketClubs } from '../src/game/marketEngine';
import { generateOffers } from '../src/game/transferEngine';
import {
  agentEligible,
  agentMarketFactor,
  agentOfferFactor,
  clubManagerArchetype,
  endManagerTenure,
  initialManagerTrust,
  installManager,
  managerBaselineDelta,
  managerLoanFactor,
  managerMinutesFactor,
  negotiateExpectedRole,
  personalCoachDevBonus,
  replaceManager,
  scaleTrustMove,
  signAgent,
  startPersonalCoach,
} from '../src/game/peopleEngine';
import { applyEffects, moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, ManagerArchetypeId } from '../src/types';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function seniorAt(clubId: string, seed = 7): Career {
  let career = createCareer({ playerName: 'ת', position: 'CM', seed });
  career = {
    ...career,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 19,
    ability: 62,
    reputation: 40,
  };
  // Re-seat the manager at the club we just teleported to - tests bypass moveToClub on purpose.
  return installManager(endManagerTenure(career, true));
}

/** Install a successor of a named archetype, for the archetype-leakage comparison. */
function installNamedSuccessor(career: Career, archetypeId: ManagerArchetypeId): Career {
  const closed = endManagerTenure(career, false);
  return withManagerArchetype(installManager(closed), archetypeId);
}

function withManagerArchetype(career: Career, archetypeId: ManagerArchetypeId): Career {
  const manager = career.people?.manager;
  if (!manager) throw new Error('fixture has no manager');
  return {
    ...career,
    people: {
      ...career.people!,
      manager: { ...manager, person: { ...manager.person, archetypeId } },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scenario A (Phase 53): the youth believer                           */
/* ------------------------------------------------------------------ */

describe('A. youth believer vs conservative, otherwise identical', () => {
  const base = seniorAt(MACCABI_ID);
  const believer = withManagerArchetype(base, 'youth_believer');
  const conservative = withManagerArchetype(base, 'conservative');

  it('meaningfully increases the opportunity, without guaranteeing anything', () => {
    const up = managerMinutesFactor(believer);
    const down = managerMinutesFactor(conservative);
    expect(up).toBeGreaterThan(down);
    // Meaningful - a real gap between the two managers for the same player...
    expect(up / down).toBeGreaterThan(1.1);
    // ...and a tilt, not a guarantee: bounded well below "decides selection".
    expect(up).toBeLessThan(1.2);
    expect(down).toBeGreaterThan(0.85);
  });

  it('starts the young unknown higher on trust, still nowhere near trusted', () => {
    const up = managerBaselineDelta(believer);
    const down = managerBaselineDelta(conservative);
    expect(up).toBeGreaterThan(down);
    expect(Math.abs(up)).toBeLessThan(15);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario B (Phase 54): the conservative can still be won over       */
/* ------------------------------------------------------------------ */

describe('B. conservative manager', () => {
  const career = withManagerArchetype(seniorAt(MACCABI_ID), 'conservative');

  it('slows the climb without closing it', () => {
    const climb = scaleTrustMove(career, 4);
    expect(climb).toBeLessThan(4);
    expect(climb).toBeGreaterThan(0); // strong performance still moves him
  });
});

/* ------------------------------------------------------------------ */
/* Scenario C (Phase 55): a manager change is a new page               */
/* ------------------------------------------------------------------ */

describe('C. new manager after trust 85', () => {
  it('recalculates rather than inheriting, and preserves the old relationship', () => {
    const before = { ...seniorAt(MACCABI_ID), coachTrust: 85 };
    const after = replaceManager(before, createRng(3));

    // The old relationship is history now, with its trust snapshotted at 85.
    const closed = after.people?.managerHistory.at(-1);
    expect(closed?.finalTrust).toBe(85);
    expect(closed?.toSeason).toBe(before.currentSeason);

    // A different person is in charge, with a different archetype.
    expect(after.people?.manager?.person.id).not.toBe(before.people?.manager?.person.id);
    expect(after.people?.manager?.person.archetypeId).not.toBe(
      before.people?.manager?.person.archetypeId,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Scenario D (Phase 56): a transfer swaps the relationship            */
/* ------------------------------------------------------------------ */

describe('D. transfer from Maccabi to AZ Alkmaar', () => {
  it('closes the Maccabi tenure, opens the Dutch one, keeps agent and coach', () => {
    let career = seniorAt(MACCABI_ID);
    career = signAgent(career, 'family');
    career = startPersonalCoach(career, 'technical');
    const agentId = career.people?.agent?.person.id;
    const coachId = career.people?.personalCoach?.person.id;
    const oldManagerId = career.people?.manager?.person.id;
    const trustBefore = career.coachTrust;

    const moved = moveToClub(career, 'az_alkmaar');

    // Old relationship closed with the trust he actually left on.
    const closed = moved.people?.managerHistory.at(-1);
    expect(closed?.clubId).toBe(MACCABI_ID);
    expect(closed?.person.id).toBe(oldManagerId);
    expect(closed?.finalTrust).toBe(Math.round(trustBefore));

    // New manager manages the new club - the trust-ownership invariant.
    expect(moved.people?.manager?.clubId).toBe('az_alkmaar');
    expect(moved.people?.manager?.person.id).not.toBe(oldManagerId);
    // A Dutch club's manager draws from the Dutch pool.
    expect(moved.people?.manager?.person.country).toBe(getClub('az_alkmaar').country);

    // The people who travel with a player travelled.
    expect(moved.people?.agent?.person.id).toBe(agentId);
    expect(moved.people?.personalCoach?.person.id).toBe(coachId);

    expect(validateCareerIntegrity(moved)).toEqual([]);
  });

  it('finds the same manager again on a return, and knows him', () => {
    const career = seniorAt(MACCABI_ID);
    const originalManager = career.people?.manager?.person.id;
    const away = moveToClub(career, 'az_alkmaar');
    const back = moveToClub(away, MACCABI_ID);
    expect(back.people?.manager?.person.id).toBe(originalManager);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario E (Phase 57): the Europe specialist's actual markets       */
/* ------------------------------------------------------------------ */

describe('E. europe specialist shifts the destination distribution', () => {
  it('tilts draws toward his markets without adding a single club', () => {
    const noAgent = { ...seniorAt(MACCABI_ID), ability: 68, reputation: 55 };
    const withAgent = signAgent(noAgent, 'europe_specialist');
    const markets = AGENT_ARCHETYPES.europe_specialist.markets;

    // The candidate pool is identical - the agent modifies weights, never eligibility.
    expect(marketClubs(withAgent).map((c) => c.id)).toEqual(marketClubs(noAgent).map((c) => c.id));

    let inMarketPlain = 0;
    let inMarketAgent = 0;
    const draws = 600;
    for (let i = 1; i <= draws; i += 1) {
      const a = drawDestination(noAgent, createRng(i));
      const b = drawDestination(withAgent, createRng(i));
      if (a && markets.includes(a.country)) inMarketPlain += 1;
      if (b && markets.includes(b.country)) inMarketAgent += 1;
    }
    expect(inMarketAgent).toBeGreaterThan(inMarketPlain * 1.15);
  });

  it('never zeroes a market he does not know', () => {
    const career = signAgent(seniorAt(MACCABI_ID), 'europe_specialist');
    for (const club of marketClubs(career)) {
      expect(agentMarketFactor(career, club)).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Scenario F (Phase 58): the dealmaker's tradeoff                     */
/* ------------------------------------------------------------------ */

describe('F. aggressive agent', () => {
  it('generates more conversations than the family agent', () => {
    const dealer = signAgent(seniorAt(MACCABI_ID), 'dealmaker');
    const family = signAgent(seniorAt(MACCABI_ID), 'family');
    expect(agentOfferFactor(dealer)).toBeGreaterThan(agentOfferFactor(family));
  });

  it('cannot negotiate a backup into a star, or an implausible player into anything', () => {
    const career = signAgent(seniorAt(MACCABI_ID), 'super_agent');
    const club = getClub('az_alkmaar');

    // The middle of the ladder can move one step - and only when ability is close.
    const plausible = { ...career, ability: club.quality + 2 };
    const outcomes = new Set<string>();
    for (let i = 0; i < 200; i += 1) outcomes.add(negotiateExpectedRole(plausible, club, 'rotation', createRng(i)));
    expect([...outcomes].sort()).toEqual(['rotation', 'starter']);

    // Never above starter, whatever the negotiation stat.
    for (let i = 0; i < 100; i += 1) {
      expect(negotiateExpectedRole(plausible, club, 'backup', createRng(i))).not.toBe('starter');
      expect(['key', 'star']).not.toContain(negotiateExpectedRole(plausible, club, 'rotation', createRng(i)));
    }

    // A player far below the club's level gets no bump at all.
    const implausible = { ...career, ability: club.quality - 15 };
    for (let i = 0; i < 100; i += 1) {
      expect(negotiateExpectedRole(implausible, club, 'rotation', createRng(i))).toBe('rotation');
    }
  });
});

/* ------------------------------------------------------------------ */
/* Scenario G (Phase 59): loyalty stays viable                         */
/* ------------------------------------------------------------------ */

describe('G. refusing the super-agent', () => {
  it('is not punished by the event itself', () => {
    const event = PEOPLE_EVENTS.find((e) => e.id === 'ppl_agent_loyalty_moment');
    const stay = event?.choices.find((c) => c.id === 'stay_loyal');
    expect(stay).toBeDefined();
    for (const outcome of stay?.outcomes ?? []) {
      expect(outcome.tone).not.toBe('bad');
      const effects = outcome.effects ?? {};
      expect(effects.agentRelationship ?? 0).toBeGreaterThanOrEqual(0);
      expect(effects.reputation ?? 0).toBeGreaterThanOrEqual(0);
      expect(effects.confidence ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Scenario H (Phase 60): position fit                                 */
/* ------------------------------------------------------------------ */

describe('H. goalkeeper coaching is for goalkeepers', () => {
  it('offers a keeper the keeper specialties and no finishing work', () => {
    const ids = specialtiesFor('GK').map((s) => s.id);
    expect(ids).toContain('goalkeeping');
    expect(ids).not.toContain('finishing');
    expect(ids).not.toContain('speed');
    expect(ids).not.toContain('technical');
  });

  it('refuses a mismatched specialist, fail-closed', () => {
    const keeper = { ...seniorAt(MACCABI_ID), position: 'GK' as const };
    const after = startPersonalCoach(keeper, 'finishing');
    expect(after.people?.personalCoach ?? null).toBeNull();
  });

  it('gates every position-specific coach event on the position', () => {
    for (const event of PEOPLE_EVENTS) {
      const specialties = event.conditions.personalCoachSpecialties ?? [];
      if (specialties.includes('goalkeeping')) {
        expect(event.conditions.positions, event.id).toEqual(['GK']);
      }
      /*
       * A finishing-only event needs no position gate of its own: a goalkeeper can never HAVE a
       * finishing coach (startPersonalCoach is fail-closed and the GK focus event offers none),
       * so requiring the specialty transitively requires the position. What must hold is that
       * any explicit position list stays coherent with the specialty.
       */
      if (specialties.length > 0 && specialties.every((sp) => sp === 'finishing')) {
        expect(event.conditions.positions ?? [], event.id).not.toContain('GK');
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Scenario I (Phase 61): diminishing returns                          */
/* ------------------------------------------------------------------ */

describe('I. the specialist helps the developing player most', () => {
  it('diminishes with ability and never reads Potential', () => {
    const base = startPersonalCoach(seniorAt(MACCABI_ID), 'technical');
    const developing = { ...base, ability: 58 };
    const made = { ...base, ability: 80 };
    const finished = { ...base, ability: 86 };

    expect(personalCoachDevBonus(developing)).toBeGreaterThan(personalCoachDevBonus(made));
    expect(personalCoachDevBonus(finished)).toBe(0);

    // The bonus is identical whatever the hidden ceiling is - Potential is not an input.
    const lowPotential = { ...developing, hidden: { ...developing.hidden, potential: 60 } };
    const highPotential = { ...developing, hidden: { ...developing.hidden, potential: 95 } };
    expect(personalCoachDevBonus(lowPotential)).toBe(personalCoachDevBonus(highPotential));
  });

  it('never changes hidden Potential through effects either', () => {
    const career = seniorAt(MACCABI_ID);
    const rng = createRng(2);
    const after = applyEffects(career, { startPersonalCoach: 'technical' }, rng).career;
    expect(after.hidden.potential).toBe(career.hidden.potential);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario J (Phase 62): the Maccabism guard holds                    */
/* ------------------------------------------------------------------ */

describe('J. people cannot move Maccabism by accident', () => {
  it('keeps every people-event Maccabism mutation explicitly tagged', () => {
    for (const event of PEOPLE_EVENTS) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (outcome.effects?.maccabism) {
            expect(outcome.maccabiRelevance, `${event.id}/${outcome.id}`).toBeDefined();
            expect(outcome.maccabiRelevance).not.toBe('none');
          }
        }
      }
    }
  });

  it('drops an untagged delta from a people effect at the guard', () => {
    const career = signAgent(seniorAt(MACCABI_ID), 'family');
    const rng = createRng(4);
    const after = applyEffects(career, { maccabism: 8, agentRelationship: 5 }, rng).career;
    expect(after.maccabism).toBe(career.maccabism);
    expect(after.people?.agent?.relationship).toBe((career.people?.agent?.relationship ?? 0) + 5);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario K (Phase 63): history points at the right person           */
/* ------------------------------------------------------------------ */

describe('K. the debut memory survives manager changes', () => {
  it('keeps referencing the man who actually gave it', () => {
    let found = 0;
    for (let seed = 1; seed <= 60 && found < 5; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'CM', seed, policy: balancedPolicy });
      const memory = career.memories.find((m) => m.kind === 'manager_gave_debut');
      if (!memory?.personId) continue;
      found += 1;

      const people = career.people!;
      const everyone = [
        ...(people.manager ? [people.manager] : []),
        ...people.managerHistory,
      ];
      const giver = everyone.find((t) => t.person.id === memory.personId);
      expect(giver, `seed ${seed}: debut memory points at nobody`).toBeDefined();
      expect(giver?.gaveDebut).toBe(true);
      // And the name recorded at the time is the name the person still has.
      expect(memory.detail).toBe(giver?.person.name);
    }
    expect(found).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario L (Phase 64): save/load identity                           */
/* ------------------------------------------------------------------ */

describe('L. save/load preserves people exactly', () => {
  it('round-trips ids, names, relationships and the next step', () => {
    let career = createCareer({ playerName: 'ת', position: 'ST', seed: 42 });
    for (let i = 0; i < 30 && !career.retired; i += 1) career = autoStep(career);

    const saved = JSON.parse(JSON.stringify(career)) as Career;
    const loaded = hydrateCareer(saved);

    expect(loaded.people).toEqual(career.people);
    expect(loaded.rngState).toBe(career.rngState);

    // Same next outcome - the whole point of seeded determinism.
    const a = autoStep(career);
    const b = autoStep(loaded);
    expect(b.rngState).toBe(a.rngState);
    expect(b.people?.manager?.person.id).toBe(a.people?.manager?.person.id);
  });

  it('generates the same people for the same seed, every time', () => {
    const runs = [1, 2].map(() => {
      let career = createCareer({ playerName: 'ת', position: 'CM', seed: 99 });
      for (let i = 0; i < 40 && !career.retired; i += 1) career = autoStep(career);
      return career;
    });
    expect(runs[0]!.people?.manager?.person.name).toBe(runs[1]!.people?.manager?.person.name);
    expect(runs[0]!.people?.agent?.person.name ?? null).toBe(runs[1]!.people?.agent?.person.name ?? null);
  });
});


/* ------------------------------------------------------------------ */
/* v0.5.1 Scenario A: the manager-change trust flow                    */
/* ------------------------------------------------------------------ */

describe('v0.5.1 A. manager change: trust belongs to the man in the chair', () => {
  /** Youth believer, trust 82, replaced by whoever the seed produces. */
  function frozen(seed: number): Career {
    const base = withManagerArchetype(seniorAt(MACCABI_ID, seed), 'youth_believer');
    return { ...base, coachTrust: 82, ability: 70, reputation: 48 };
  }

  it('stores the outgoing final trust EXACTLY, undisturbed by the successor', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const before = frozen(seed);
      const after = replaceManager(before, createRng(seed));
      const closed = after.people?.managerHistory.at(-1);
      expect(closed?.finalTrust, `seed ${seed}`).toBe(82);
      expect(closed?.person.archetypeId).toBe('youth_believer');
    }
  });

  it('derives the new trust from the NEW archetype, not the old one', () => {
    /*
     * The bug this pins: v0.5 drifted trust toward `coachTrustBaseline` inside
     * `maybeChangeCoach`, before the successor was installed - so the baseline read the
     * OUTGOING manager's archetype. A conservative successor inherited a youth believer's
     * generosity, and the drifted number was then filed as the outgoing manager's final trust.
     *
     * Same player, same seed, same everything except who takes over. If the old archetype were
     * still leaking in, these two would be identical.
     */
    const base = { ...frozen(9), age: 19 };
    const believerNext = { ...base };
    const conservativeNext = { ...base };

    const withBeliever = installNamedSuccessor(believerNext, 'youth_believer');
    const withConservative = installNamedSuccessor(conservativeNext, 'conservative');

    const a = initialManagerTrust(withBeliever, createRng(5));
    const b = initialManagerTrust(withConservative, createRng(5));
    expect(a).toBeGreaterThan(b);
  });

  it('neither copies 82 nor resets to a constant 50', () => {
    /*
     * "Not 50" is a distributional claim, not a per-seed one - a continuous derivation is
     * allowed to pass through any particular value, and one seed in sixty rounding to 50 is a
     * coincidence rather than a reset. What must not happen is a CONSTANT.
     */
    const results = new Set<number>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const trust = replaceManager(frozen(seed), createRng(seed)).coachTrust;
      expect(trust, `seed ${seed}`).not.toBe(82);
      results.add(Math.round(trust));
    }
    expect(results.size).toBeGreaterThan(8);
    const atFifty = [...results].filter((v) => v === 50).length;
    expect(atFifty).toBeLessThan(3);
  });

  it('is deterministic for the same seed and state', () => {
    const a = replaceManager(frozen(11), createRng(11));
    const b = replaceManager(frozen(11), createRng(11));
    expect(b.coachTrust).toBe(a.coachTrust);
    expect(b.people?.manager?.person.id).toBe(a.people?.manager?.person.id);
    expect(b.people?.manager?.person.name).toBe(a.people?.manager?.person.name);
  });

  it('keeps coachTrust the single authoritative value - no second copy on the tenure', () => {
    const after = replaceManager(frozen(3), createRng(3));
    const tenure = after.people?.manager as unknown as Record<string, unknown>;
    // The open tenure must carry no trust field at all; the career owns it.
    expect(tenure?.['trust']).toBeUndefined();
    expect(tenure?.['finalTrust']).toBeUndefined();
    expect(validateCareerIntegrity(after)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* v0.5.1 Scenarios B & C: off-screen manager continuity               */
/* ------------------------------------------------------------------ */

describe('v0.5.1 B/C. clubs manage themselves while the player is away', () => {
  function continuityRate(gap: number): number {
    let same = 0;
    const runs = 400;
    for (let seed = 1; seed <= runs; seed += 1) {
      const career = seniorAt(MACCABI_ID, seed);
      const original = career.people!.manager!.person.id;
      const away = moveToClub(career, 'az_alkmaar');
      const later = { ...away, currentSeason: away.currentSeason + gap };
      const back = moveToClub(later, MACCABI_ID);
      if (back.people?.manager?.person.id === original) same += 1;
    }
    return same / runs;
  }

  it('B. usually finds the same man after one season away', () => {
    const rate = continuityRate(1);
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.95); // "often", not "always"
  });

  it('C. rarely finds him after a decade', () => {
    expect(continuityRate(10)).toBeLessThan(0.15);
  });

  it('decays monotonically with the length of the absence', () => {
    const short = continuityRate(1);
    const medium = continuityRate(4);
    const long = continuityRate(10);
    expect(short).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(long);
  });

  it('is deterministic, and preserves the old manager historically', () => {
    const career = seniorAt(MACCABI_ID, 21);
    const original = career.people!.manager!.person;
    const away = moveToClub(career, 'az_alkmaar');
    const later = { ...away, currentSeason: away.currentSeason + 10 };

    const a = moveToClub(later, MACCABI_ID);
    const b = moveToClub(later, MACCABI_ID);
    expect(b.people?.manager?.person.id).toBe(a.people?.manager?.person.id);

    // Whoever is in the chair now, the spell the player actually lived is still on record.
    const historical = a.people?.managerHistory.find((t) => t.person.id === original.id);
    expect(historical?.person.name).toBe(original.name);
    expect(historical?.toSeason).toBeDefined();
  });
});


/* ------------------------------------------------------------------ */
/* v0.5.1 Scenarios D & E: manager loan willingness                    */
/* ------------------------------------------------------------------ */

describe('v0.5.1 D/E. the manager has a view on loans', () => {
  /** A young fringe player: eligible for a loan, not in anyone's plans. */
  function fringeYouth(archetype: ManagerArchetypeId): Career {
    const base = withManagerArchetype(seniorAt(MACCABI_ID, 4), archetype);
    return { ...base, age: 20, roleValue: 30, ability: 58 };
  }

  it('D. a willing manager makes the loan route more likely', () => {
    const willing = managerLoanFactor(fringeYouth('conservative'));
    const reluctant = managerLoanFactor(fringeYouth('rotation'));
    expect(willing).toBeGreaterThan(reluctant);
    expect(willing).toBeGreaterThan(1);
  });

  it('E. a manager with plans for him keeps him, without making a loan impossible', () => {
    const fringe = fringeYouth('rotation');
    const wanted = { ...fringe, roleValue: 60 };
    expect(managerLoanFactor(wanted)).toBeLessThan(managerLoanFactor(fringe));
    // Reduced, never zero - the door stays open.
    expect(managerLoanFactor(wanted)).toBeGreaterThan(0);
  });

  it('cannot bypass loan eligibility, whatever the manager wants', () => {
    /*
     * The factor multiplies a CHANCE. Eligibility - age, appearances, already-on-loan - is a
     * separate boolean gate upstream, so the most loan-happy manager in the game generates
     * nothing for a player who does not qualify.
     */
    const veteran = {
      ...withManagerArchetype(seniorAt(MACCABI_ID, 8), 'conservative'),
      age: 33,
      roleValue: 30,
    };
    for (let seed = 1; seed <= 120; seed += 1) {
      const offers = generateOffers(veteran, createRng(seed));
      expect(offers.some((o) => o.kind === 'loan'), `seed ${seed}`).toBe(false);
    }
  });

  it('is inert inside the academy, like every other archetype modifier', () => {
    const boy = createCareer({ playerName: 'ת', position: 'CM', seed: 5 });
    expect(managerLoanFactor(boy)).toBe(1);
  });

  it('changes the observed loan rate across real offer generation', () => {
    const count = (archetype: ManagerArchetypeId): number => {
      const career = fringeYouth(archetype);
      let loans = 0;
      for (let seed = 1; seed <= 500; seed += 1) {
        if (generateOffers(career, createRng(seed)).some((o) => o.kind === 'loan')) loans += 1;
      }
      return loans;
    };
    expect(count('conservative')).toBeGreaterThan(count('rotation'));
  });
});

/* ------------------------------------------------------------------ */
/* Architecture invariants (Phase 74)                                  */
/* ------------------------------------------------------------------ */

describe('people architecture', () => {
  it('gates representation on the stage, never on numeric age', () => {
    const boy = createCareer({ playerName: 'ת', position: 'CM', seed: 5 });
    expect(agentEligible(boy)).toBe(false); // pre_b
    expect(agentEligible({ ...boy, academyStage: 'children_a' })).toBe(false);
    expect(agentEligible({ ...boy, academyStage: 'youth_a' })).toBe(true);
    expect(agentEligible({ ...boy, academyStage: 'senior' })).toBe(true);
  });

  it('keeps the archetype modifiers inert inside the academy', () => {
    const boy = createCareer({ playerName: 'ת', position: 'CM', seed: 6 });
    expect(managerMinutesFactor(boy)).toBe(1);
    expect(managerBaselineDelta(boy)).toBe(0);
    expect(scaleTrustMove(boy, 3)).toBe(3);
  });

  it('shows the transfer hint from the same fact the arrival reads', () => {
    const career = seniorAt(MACCABI_ID);
    const hinted = clubManagerArchetype(career, 'az_alkmaar');
    const arrived = moveToClub(career, 'az_alkmaar');
    expect(arrived.people?.manager?.person.archetypeId).toBe(hinted);
  });

  it('has no universally best manager archetype', () => {
    // Every archetype must give up something: no profile dominates every modifier direction.
    for (const archetype of Object.values(MANAGER_ARCHETYPES)) {
      const advantages = [
        archetype.youthMinutesFactor > 1,
        archetype.trustGainFactor > 1,
        archetype.trustLossFactor < 1,
        archetype.youthTrustDelta > 0,
        archetype.reputationBias > 0,
      ].filter(Boolean).length;
      expect(advantages, archetype.id).toBeLessThan(5);
    }
  });

  it('keeps every simulated career integrity-clean with people active', () => {
    for (let seed = 200; seed <= 260; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'WG', seed, policy: balancedPolicy });
      expect(validateCareerIntegrity(career), `seed ${seed}`).toEqual([]);
    }
  });
});

/**
 * Derby semantics (v0.6.2, Part 1).
 *
 * v0.6.1 validated that no event's TEXT used the word דרבי without derby gating. That guard was
 * too narrow, and playtesting proved it: `sen_cup_final` never wrote the word anywhere - it
 * simply awarded the `derby_moment` achievement ("הרגע בדרבי"), so a Hapoel Kfar Saba player who
 * won a State Cup final against Umm al-Fahm collected a derby honour. Widening the audit found a
 * second one: `cb_penalty_again`, a redemption penalty with no opponent condition, recorded the
 * `derby_hero` MEMORY.
 *
 * The lesson is architectural rather than textual: derby-ness is carried by achievements,
 * memories and milestone ids as much as by prose, so the guard is now typed. An achievement
 * declares the context it claims; the validator checks the event granting it actually guarantees
 * that context.
 */

import { describe, expect, it } from 'vitest';

import { ACHIEVEMENT_DEFS } from '../src/data/achievements';
import { EVENT_POOL } from '../src/data/events';
import { RIVALRIES, derbyRival, rivalryBetween } from '../src/data/rivalries';
import { createCareer } from '../src/game/careerEngine';
import { isEventEligible } from '../src/game/eventEngine';
import { isDerbyEligible } from '../src/game/worldPredicates';
import type { Career, GameEvent } from '../src/types';

const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENT_DEFS.map((a) => [a.id, a]));

/** Everything an event can hand the player that carries derby meaning. */
function derbyClaims(event: GameEvent): string[] {
  const claims: string[] = [];
  for (const choice of event.choices) {
    for (const outcome of choice.outcomes) {
      const effects = outcome.effects;
      if (!effects) continue;

      const achievement = effects.achievement
        ? ACHIEVEMENTS_BY_ID.get(effects.achievement)
        : undefined;
      if (achievement?.category === 'derby') {
        claims.push(`achievement:${effects.achievement}`);
      }

      const remembered = Array.isArray(effects.remember)
        ? effects.remember
        : effects.remember
          ? [effects.remember]
          : [];
      for (const memory of remembered) {
        if (String(memory).includes('derby')) claims.push(`memory:${memory}`);
      }

      const milestoneId = effects.milestone?.id ?? '';
      const milestoneText = effects.milestone?.text ?? '';
      if (milestoneId.includes('derby') || milestoneText.includes('דרבי')) {
        claims.push(`milestone:${milestoneId}`);
      }
    }
  }
  return claims;
}

function isDerbyGated(event: GameEvent): boolean {
  return (
    event.conditions.requiresDerby === true ||
    (event.conditions.rivalryTypes?.includes('localDerby') ?? false)
  );
}

describe('v0.6.2 derby content requires an authoritative derby', () => {
  it('gates every event that awards a derby achievement, memory or milestone', () => {
    /*
     * The assertion that would have caught the reported bug. It reads the EFFECTS, not the
     * prose, so a silent achievement id can no longer slip past.
     */
    const offenders: string[] = [];
    for (const event of EVENT_POOL) {
      const claims = derbyClaims(event);
      if (claims.length === 0) continue;
      if (!isDerbyGated(event)) offenders.push(`${event.id}: ${claims.join(', ')}`);
    }
    expect(offenders, 'events granting derby content without derby gating').toEqual([]);
  });

  it('keeps the cup final on its own achievement, not a derby one', () => {
    const cupFinal = EVENT_POOL.find((e) => e.id === 'sen_cup_final');
    expect(cupFinal).toBeDefined();

    const awarded = cupFinal!.choices.flatMap((c) =>
      c.outcomes.map((o) => o.effects?.achievement).filter(Boolean),
    );
    expect(awarded).not.toContain('derby_moment');
    expect(awarded).toContain('cup_final_hero');

    const hero = ACHIEVEMENTS_BY_ID.get('cup_final_hero');
    expect(hero?.name).toBe('גיבור הגמר');
    expect(hero?.category).toBe('cup');
  });

  it('declares a category on every achievement that claims a context', () => {
    /*
     * Typed metadata is the primary architecture (1.5). An achievement whose NAME promises a
     * derby must say so in its category, or the validator above cannot protect it.
     */
    for (const achievement of ACHIEVEMENT_DEFS) {
      const claimsDerby = `${achievement.name} ${achievement.description}`.includes('דרבי');
      if (claimsDerby) {
        expect(achievement.category, `${achievement.id} names a derby`).toBe('derby');
      }
    }
  });

  it('lets no derby memory kind be recorded by an ungated event', () => {
    const offenders: string[] = [];
    for (const event of EVENT_POOL) {
      if (isDerbyGated(event)) continue;
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          const remembered = Array.isArray(outcome.effects?.remember)
            ? outcome.effects!.remember
            : outcome.effects?.remember
              ? [outcome.effects.remember]
              : [];
          for (const memory of remembered) {
            if (String(memory).includes('derby')) {
              offenders.push(`${event.id}/${outcome.id}: ${String(memory)}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ================================================================== */
/* Scenario A — the reported career, end to end                        */
/* ================================================================== */

describe('v0.6.2 A. Kfar Saba vs Umm al-Fahm carries zero derby content', () => {
  const KFAR_SABA = 'hapoel_kfar_saba';
  const UMM_AL_FAHM = 'hapoel_umm_al_fahm';

  function seniorAt(clubId: string, seed = 5): Career {
    const base = createCareer({ playerName: 'ת', position: 'ST', seed });
    return { ...base, academyStage: 'senior', currentClubId: clubId, age: 26, ability: 74, roleValue: 70 };
  }

  it('has no rivalry, so no derby anything', () => {
    expect(rivalryBetween(KFAR_SABA, UMM_AL_FAHM)).toBeNull();
    expect(derbyRival(KFAR_SABA)).toBeNull();
    expect(isDerbyEligible(seniorAt(KFAR_SABA))).toBe(false);
  });

  it('cannot reach any event that would hand him derby content', () => {
    const career = seniorAt(KFAR_SABA);
    const derbyContentEvents = EVENT_POOL.filter((e) => derbyClaims(e).length > 0);
    expect(derbyContentEvents.length, 'no derby content in the pool at all?').toBeGreaterThan(0);

    for (const slot of ['early', 'mid', 'late'] as const) {
      const reachable = derbyContentEvents.filter((e) => isEventEligible(e, career, slot));
      expect(reachable.map((e) => e.id), `slot ${slot}`).toEqual([]);
    }
  });

  it('specifically: the cup final is reachable and hands him no derby honour', () => {
    /*
     * The exact reported path. The cup final may well be eligible for this player - that is the
     * point of the event - and what it gives him must contain no derby claim.
     */
    const cupFinal = EVENT_POOL.find((e) => e.id === 'sen_cup_final')!;
    expect(derbyClaims(cupFinal)).toEqual([]);
  });
});

/* ================================================================== */
/* Scenario B — a real derby still works                               */
/* ================================================================== */

describe('v0.6.2 B. authoritative derbies are untouched', () => {
  it('still recognises the Haifa derby and keeps its content reachable', () => {
    expect(rivalryBetween('maccabi_haifa', 'hapoel_haifa')?.type).toBe('localDerby');

    const base = createCareer({ playerName: 'ת', position: 'ST', seed: 7 });
    const career: Career = {
      ...base,
      academyStage: 'senior',
      currentClubId: 'maccabi_haifa',
      age: 26,
      ability: 74,
      roleValue: 70,
    };
    expect(isDerbyEligible(career)).toBe(true);

    // The derby achievement and memory still exist and still belong to derby events.
    const derbyEvents = EVENT_POOL.filter((e) => derbyClaims(e).length > 0);
    expect(derbyEvents.map((e) => e.id)).toContain('sen_derby_moment');
    for (const event of derbyEvents) expect(isDerbyGated(event)).toBe(true);
  });

  it('keeps localDerby the only rivalry type that earns the word', () => {
    for (const rivalry of RIVALRIES.filter((r) => r.type !== 'localDerby')) {
      expect(rivalry.name, rivalry.name).not.toContain('דרבי');
    }
  });
});

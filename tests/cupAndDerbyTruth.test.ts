/**
 * Cup and match-context truth (v0.6.1, Checkpoint C).
 *
 * Two guarantees the game makes to the player and must not break:
 *
 *   "זכית בגביע המדינה"  - then that trophy exists everywhere his career is summed up.
 *   "זה דרבי"            - then there is actually a derby, per authoritative rivalry data.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { derbyRival, RIVALRIES, rivalryBetween } from '../src/data/rivalries';
import { TROPHY_DEFS } from '../src/data/trophies';
import { createCareer } from '../src/game/careerEngine';
import { isEventEligible } from '../src/game/eventEngine';
import { matchContext, requirementOf } from '../src/game/matchEngine';
import { moveToClub } from '../src/game/progressionEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { trophySummary } from '../src/game/truth';
import { isDerbyEligible } from '../src/game/worldPredicates';
import type { Career, SeasonRecord, Trophy } from '../src/types';

const KFAR_SABA = 'hapoel_kfar_saba';
const UMM_AL_FAHM = 'hapoel_umm_al_fahm';

function seniorAt(clubId: string, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'ST', seed });
  return { ...base, academyStage: 'senior', currentClubId: clubId, age: 25, ability: 70 };
}

/* ================================================================== */
/* C8 / Scenario F — Kfar Saba vs Umm al-Fahm is not a derby           */
/* ================================================================== */

describe('C8. Hapoel Kfar Saba vs Umm al-Fahm is never a derby', () => {
  const career = seniorAt(KFAR_SABA);

  it('has no rivalry between them in the authoritative data', () => {
    expect(rivalryBetween(KFAR_SABA, UMM_AL_FAHM)).toBeNull();
    expect(rivalryBetween(UMM_AL_FAHM, KFAR_SABA)).toBeNull();
    expect(derbyRival(KFAR_SABA)).toBeNull();
    expect(derbyRival(UMM_AL_FAHM)).toBeNull();
  });

  it('makes the club derby-ineligible', () => {
    expect(isDerbyEligible(career)).toBe(false);
  });

  it('lets no derby-gated event reach him, in any slot', () => {
    const derbyEvents = EVENT_POOL.filter((e) => e.conditions.requiresDerby === true);
    expect(derbyEvents.length).toBeGreaterThan(0);
    for (const slot of ['early', 'mid', 'late'] as const) {
      const eligible = derbyEvents.filter((e) => isEventEligible(e, career, slot));
      expect(eligible.map((e) => e.id), `slot ${slot}`).toEqual([]);
    }
  });

  it('builds no derby match context for him', () => {
    for (const event of EVENT_POOL.filter((e) => e.conditions.requiresDerby === true)) {
      const context = matchContext(career, undefined, requirementOf(event));
      // Either no fixture at all, or one that does not claim to be a derby.
      if (context) expect((context as { isDerby?: boolean }).isDerby).not.toBe(true);
    }
  });

  it('produces zero occurrences of the word across his whole career', () => {
    /*
     * The end-to-end version of the same claim: play real careers at Kfar Saba and assert the
     * word never appears in anything the player would read.
     */
    for (let seed = 1; seed <= 25; seed += 1) {
      const played = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      const atKfarSaba = played.seasonHistory.some((s) => s.clubId === KFAR_SABA);
      if (!atKfarSaba) continue;

      // Anything written while he was there must not call it a derby unless he had a real one.
      const seasonsThere = new Set(
        played.seasonHistory.filter((s) => s.clubId === KFAR_SABA).map((s) => s.season),
      );
      const derbyText = played.milestones.filter(
        (m) => seasonsThere.has(m.season) && m.text.includes('דרבי'),
      );
      expect(derbyText.map((m) => m.text), `seed ${seed}`).toEqual([]);
    }
  });
});

/* ================================================================== */
/* C10 — no event may say דרבי without derby eligibility               */
/* ================================================================== */

describe('C10. the word דרבי requires authoritative derby eligibility', () => {
  it('gates every event whose text uses it', () => {
    const offenders: string[] = [];
    for (const event of EVENT_POOL) {
      const text = [
        event.kicker ?? '',
        event.title,
        event.description,
        ...event.choices.flatMap((c) => [
          c.label,
          ...c.outcomes.flatMap((o) => [o.text, o.preview ?? '', o.effects?.milestone?.text ?? '']),
        ]),
      ].join(' ');
      if (!text.includes('דרבי')) continue;

      const gated =
        event.conditions.requiresDerby === true ||
        (event.conditions.rivalryTypes?.includes('localDerby') ?? false);
      if (!gated) offenders.push(event.id);
    }
    expect(offenders, 'events using דרבי without derby gating').toEqual([]);
  });

  it('only calls localDerby a derby - a major rivalry is not one', () => {
    /*
     * The Israeli Clasico (Maccabi Haifa vs Maccabi Tel Aviv) is a huge match and NOT a derby.
     * `matchContext` must keep those separate, which is what stops "big match" drifting into
     * the word over time.
     */
    const clasico = rivalryBetween('maccabi_haifa', 'maccabi_tel_aviv');
    expect(clasico?.type).toBe('majorRivalry');
    expect(clasico?.type).not.toBe('localDerby');

    const derbies = RIVALRIES.filter((r) => r.type === 'localDerby');
    expect(derbies.length).toBeGreaterThan(0);
    for (const derby of derbies) {
      expect(derby.name).toContain('דרבי');
    }
    // ...and no non-derby rivalry may be named one.
    for (const rivalry of RIVALRIES.filter((r) => r.type !== 'localDerby')) {
      expect(rivalry.name, rivalry.name).not.toContain('דרבי');
    }
  });
});

/* ================================================================== */
/* Scenario H — a real derby still works                               */
/* ================================================================== */

describe('H. an authoritative derby is still a derby', () => {
  it('recognises the Haifa derby and keeps its events reachable', () => {
    expect(rivalryBetween('maccabi_haifa', 'hapoel_haifa')?.type).toBe('localDerby');
    expect(derbyRival('maccabi_haifa')).toBe('hapoel_haifa');
    expect(isDerbyEligible(seniorAt('maccabi_haifa'))).toBe(true);
  });
});

/* ================================================================== */
/* C1-C3 / Scenario G — the State Cup, everywhere it should be         */
/* ================================================================== */

describe('G. a State Cup won away from Maccabi persists through the whole career', () => {
  function cupTrophy(clubId: string, clubName: string, season: number): Trophy {
    return {
      id: 'cup',
      name: TROPHY_DEFS.cup.name,
      season,
      clubId,
      clubName,
      weight: TROPHY_DEFS.cup.weight,
    };
  }

  function seasonAt(clubId: string, clubName: string, season: number, trophies: Trophy[] = []): SeasonRecord {
    return {
      season,
      age: 25,
      academyStage: 'senior',
      clubId,
      clubName,
      teamName: clubName,
      league: 'ליגת העל',
      onLoan: false,
      stats: { appearances: 30, starts: 28, goals: 8, assists: 4, cleanSheets: 0, goalsConceded: 0, rating: 72, injuredGames: 0 },
      firstHalf: null,
      ability: 72,
      role: 'starter',
      coachTrust: 70,
      trophies,
      captain: false,
      olderGroup: 'none',
    };
  }

  it('C1. the trophy is typed, and named גביע המדינה - never a generic word', () => {
    expect(TROPHY_DEFS.cup.id).toBe('cup');
    expect(TROPHY_DEFS.cup.name).toBe('גביע המדינה');
  });

  it('C3. survives in the season record, the career summary, and a later transfer', () => {
    const trophy = cupTrophy(KFAR_SABA, 'הפועל כפר סבא', 2042);
    const base = seniorAt(KFAR_SABA, 9);
    const career: Career = {
      ...base,
      seasonHistory: [...base.seasonHistory, seasonAt(KFAR_SABA, 'הפועל כפר סבא', 2042, [trophy])],
      trophies: [...base.trophies, trophy],
    };

    // In the season record...
    const record = career.seasonHistory.find((s) => s.season === 2042);
    expect(record?.trophies.map((t) => t.name)).toContain('גביע המדינה');

    // ...in the career summary, by NAME rather than as a count...
    const summary = trophySummary(career);
    const cup = summary.find((g) => g.id === 'cup');
    expect(cup?.name).toBe('גביע המדינה');
    expect(cup?.count).toBe(1);
    expect(cup?.clubs).toEqual(['הפועל כפר סבא']);
    expect(cup?.allAtMaccabi).toBe(false);

    // ...exactly once...
    expect(summary.filter((g) => g.id === 'cup')).toHaveLength(1);

    // ...and it survives moving to another club.
    const moved = moveToClub(career, 'maccabi_haifa');
    const afterMove = trophySummary(moved).find((g) => g.id === 'cup');
    expect(afterMove?.name).toBe('גביע המדינה');
    expect(afterMove?.clubs).toEqual(['הפועל כפר סבא']);
  });

  it('does not credit it to Maccabi Legacy when it was won elsewhere', () => {
    const trophy = cupTrophy(KFAR_SABA, 'הפועל כפר סבא', 2042);
    const base = seniorAt(KFAR_SABA, 11);
    const career: Career = { ...base, trophies: [...base.trophies, trophy] };
    expect(career.trophies).toHaveLength(1);
    expect(career.maccabi.cups).toBe(0);
  });

  it('groups repeat wins rather than losing them, and keeps both clubs', () => {
    const base = seniorAt(KFAR_SABA, 13);
    const career: Career = {
      ...base,
      trophies: [
        ...base.trophies,
        cupTrophy(KFAR_SABA, 'הפועל כפר סבא', 2042),
        cupTrophy('maccabi_haifa', 'מכבי חיפה', 2046),
      ],
    };
    const cup = trophySummary(career).find((g) => g.id === 'cup');
    expect(cup?.count).toBe(2);
    expect(cup?.clubs).toEqual(['הפועל כפר סבא', 'מכבי חיפה']);
    expect(cup?.allAtMaccabi).toBe(false);
  });

  it('reconciles with the trophy list over real simulated careers', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60 && checked < 12; seed += 1) {
      const career = simulateCareer({ playerName: 'ת', position: 'ST', seed, policy: balancedPolicy });
      if (career.trophies.length === 0) continue;
      checked += 1;
      const summed = trophySummary(career).reduce((total, g) => total + g.count, 0);
      expect(summed, `seed ${seed}`).toBe(career.trophies.length);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

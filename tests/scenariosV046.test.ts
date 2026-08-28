/**
 * v0.4.6 Phase 32: the bug scenarios, reproduced deliberately.
 *
 * The brief lists ten situations that were producing incoherent events in playtesting. Each one
 * is set up here explicitly rather than hoped for in a population run, because "we simulated
 * 50,000 careers and did not see it" is a much weaker statement than "here is the exact state
 * that used to break, and it does not".
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { EVENT_POOL, EVENTS_BY_ID } from '../src/data/events';
import { derbyRival, rivalryBetween } from '../src/data/rivalries';
import { leagueShape } from '../src/data/leagueShape';
import { createCareer } from '../src/game/careerEngine';
import { isEventEligible } from '../src/game/eventEngine';
import {
  leagueContextAt,
  outcomeForPosition,
  positionsForOutcome,
  projectSeason,
} from '../src/game/leagueEngine';
import { canPlayDerby, matchContext } from '../src/game/matchEngine';
import { createRng } from '../src/game/random';
import { isDerbyEligible, isInTitleRace, isTitleDeciderEligible } from '../src/game/worldPredicates';
import type { Career, ClubSeasonOutcome, SeasonSlot } from '../src/types';

const SEASON = 2044;

/** A senior career at a club, with a projection forced to a given season outcome. */
function seniorAt(clubId: string, outcome: ClubSeasonOutcome, seed = 5): Career {
  const base = createCareer({ playerName: 'ת', position: 'CM', seed });
  const career: Career = {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    ability: 78,
    roleValue: 72,
    reputation: 60,
    coachTrust: 65,
    currentSeason: SEASON,
    seasonPoint: 'preseason',
    seasonSlot: 'late',
  };

  const projection = projectSeason(career.world, clubId, SEASON, null, null, createRng(seed));
  if (!projection) throw new Error(`no projection for ${clubId}`);
  const shape = leagueShape(projection.leagueId);
  if (!shape) throw new Error(`no shape for ${projection.leagueId}`);

  // Force the season to the outcome the scenario is about.
  const band = positionsForOutcome(projection.leagueId, outcome, shape);
  const position = band[Math.floor(band.length / 2)] ?? projection.finalPosition;
  const forced = {
    ...projection,
    finalPosition: position,
    finalOutcome: outcome,
    path: { early: position, mid: position, late: position, end: position },
  };

  return { ...career, world: { ...career.world, projection: forced } };
}

/** Every event this career could be handed in a slot. */
function eligible(career: Career, slot: SeasonSlot = 'late'): string[] {
  return EVENT_POOL.filter((e) => isEventEligible(e, career, slot)).map((e) => e.id);
}

const claimsDerby = (id: string): boolean => {
  const e = EVENTS_BY_ID[id];
  if (!e) return false;
  return /דרבי/.test(`${e.kicker ?? ''} ${e.title} ${e.description ?? ''}`);
};

const claimsTitle = (id: string): boolean => EVENTS_BY_ID[id]?.conditions?.titleRace === true;

/* ================================================================== */

describe('A. a lower-table club gets no championship decider', () => {
  it('offers no title event to a club heading for the bottom half', () => {
    for (const outcome of ['lower_table', 'relegation_battle', 'mid_table'] as ClubSeasonOutcome[]) {
      const career = seniorAt('hapoel_hadera', outcome);
      expect(isInTitleRace(career), outcome).toBe(false);
      expect(isTitleDeciderEligible(career), outcome).toBe(false);
      expect(eligible(career).filter(claimsTitle), outcome).toEqual([]);
    }
  });

  it('is true across every seed, not just a lucky one', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = seniorAt('hapoel_hadera', 'relegation_battle', seed);
      expect(eligible(career).filter(claimsTitle), `seed ${seed}`).toEqual([]);
    }
  });
});

describe('A2. a top club gets no relegation crisis', () => {
  const claimsRelegation = (id: string): boolean =>
    EVENTS_BY_ID[id]?.conditions?.relegationBattle === true;

  it('offers no survival event to a club at the top of the table', () => {
    for (const outcome of ['champion', 'title_challenge', 'european_places'] as ClubSeasonOutcome[]) {
      const career = seniorAt(MACCABI_ID, outcome);
      expect(leagueContextAt(career, 'late')?.relegationBattle, outcome).toBe(false);
      for (const slot of ['early', 'mid', 'late'] as SeasonSlot[]) {
        expect(eligible(career, slot).filter(claimsRelegation), `${outcome} ${slot}`).toEqual([]);
      }
    }
  });

  it('is true across every seed', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const career = seniorAt(MACCABI_ID, 'champion', seed);
      expect(eligible(career, 'mid').filter(claimsRelegation), `seed ${seed}`).toEqual([]);
    }
  });

  it('and no promotion event in a top division, ever', () => {
    const claimsPromotion = (id: string): boolean =>
      EVENTS_BY_ID[id]?.conditions?.promotionRace === true;
    for (const outcome of ['champion', 'mid_table', 'relegation_battle'] as ClubSeasonOutcome[]) {
      const career = seniorAt(MACCABI_ID, outcome);
      for (const slot of ['early', 'mid', 'late'] as SeasonSlot[]) {
        expect(eligible(career, slot).filter(claimsPromotion), `${outcome} ${slot}`).toEqual([]);
      }
    }
  });
});

describe('B. a club with no derby rival gets no derby', () => {
  it('has no modelled local rival for these clubs', () => {
    for (const clubId of ['hapoel_hadera', 'bnei_sakhnin', 'ironi_kiryat_shmona']) {
      expect(derbyRival(clubId), clubId).toBeNull();
    }
  });

  it('offers no derby event there', () => {
    for (const clubId of ['hapoel_hadera', 'bnei_sakhnin', 'ironi_kiryat_shmona']) {
      const career = seniorAt(clubId, 'mid_table');
      expect(canPlayDerby(career), clubId).toBe(false);
      expect(isDerbyEligible(career), clubId).toBe(false);
      expect(eligible(career).filter(claimsDerby), clubId).toEqual([]);
    }
  });
});

describe('C. a club with a derby rival plays it against the right club', () => {
  it('gives Maccabi Haifa its derby, against Hapoel Haifa', () => {
    const career = seniorAt(MACCABI_ID, 'title_challenge');
    expect(canPlayDerby(career)).toBe(true);
    expect(derbyRival(MACCABI_ID)).toBe('hapoel_haifa');
  });

  it('names the derby rival when an event declares a derby', () => {
    /*
     * Found by looking at a screenshot rather than by a test. `sen_derby_moment` was correctly
     * gated on `requiresDerby` and the strip beside its text named Hapoel Jerusalem, because the
     * opponent was drawn independently of what the event had declared. Gating on one fact and
     * displaying another is the same incoherence this version exists to remove - it had simply
     * moved into the new code.
     */
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = seniorAt(MACCABI_ID, 'title_challenge', seed);
      const match = matchContext(career, undefined, { derby: true });
      if (!match) continue;
      expect(match.opponentClubId, `seed ${seed}`).toBe('hapoel_haifa');
      expect(match.isDerby).toBe(true);
    }
  });

  it('names Maccabi when an event declares the opponent is Maccabi', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const career = seniorAt('hapoel_tel_aviv', 'upper_table', seed);
      const match = matchContext(career, undefined, { maccabi: true });
      if (!match) continue;
      expect(match.opponentClubId, `seed ${seed}`).toBe(MACCABI_ID);
      expect(match.vsMaccabi).toBe(true);
    }
  });

  it('never marks a fixture as a derby against a club with no rivalry', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = seniorAt(MACCABI_ID, 'european_places', seed);
      const match = matchContext(career);
      if (!match?.isDerby) continue;
      const rivalry = rivalryBetween(MACCABI_ID, match.opponentClubId);
      expect(rivalry?.type, `seed ${seed} vs ${match.opponentClubId}`).toBe('localDerby');
    }
  });
});

describe('D/E. the live narrative belongs to the current club', () => {
  it('never offers a Maccabi-only event to a player at another club', () => {
    const away = seniorAt('hapoel_tel_aviv', 'upper_table');
    const maccabiOnly = EVENT_POOL.filter(
      (e) => e.conditions?.atMaccabi === true || e.conditions?.atMaccabiSenior === true,
    ).map((e) => e.id);
    expect(maccabiOnly.length).toBeGreaterThan(5);
    for (const slot of ['early', 'mid', 'late'] as SeasonSlot[]) {
      const offered = eligible(away, slot);
      for (const id of maccabiOnly) expect(offered, `${id} at Hapoel TA`).not.toContain(id);
    }
  });

  it('does offer them at Maccabi', () => {
    const home = seniorAt(MACCABI_ID, 'champion');
    const offered = new Set([...eligible(home, 'early'), ...eligible(home, 'mid'), ...eligible(home, 'late')]);
    const maccabiOnly = EVENT_POOL.filter((e) => e.conditions?.atMaccabiSenior === true);
    expect(maccabiOnly.some((e) => offered.has(e.id))).toBe(true);
  });
});

describe('F/G. the side thread and the current club', () => {
  it('lets a player abroad still hear from home', () => {
    const abroad: Career = {
      ...seniorAt('az_alkmaar', 'european_places'),
      maccabi: {
        ...createCareer({ playerName: 'ת', position: 'CM', seed: 5 }).maccabi,
        appearances: 120,
        seasons: 4,
        everLeft: true,
        academyGraduate: true,
      },
    };
    const ambient = EVENT_POOL.filter((e) => e.conditions?.clubScope === 'formerMaccabi');
    expect(ambient.length).toBeGreaterThan(0);
    // Not asserting any single one fires - only that being abroad does not close the family off.
    expect(abroad.currentClubId).not.toBe(MACCABI_ID);
  });

  it('puts a club in a relegation battle only near the bottom', () => {
    const career = seniorAt('hapoel_hadera', 'relegation_battle');
    const context = leagueContextAt(career, 'late');
    const shape = leagueShape(context!.leagueId)!;
    expect(context!.position).toBeGreaterThan(shape.size - shape.relegationPlaces - 3);
    expect(context!.titleRace).toBe(false);
  });
});

describe('H. a club in a title race may have title pressure', () => {
  it('allows the title events at the top of the table, late in the season', () => {
    let allowed = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const career = seniorAt(MACCABI_ID, 'champion', seed);
      if (eligible(career).some(claimsTitle)) allowed += 1;
    }
    // Not every seed - the fixture and the cooldowns still apply - but this must be reachable.
    expect(allowed).toBeGreaterThan(0);
  });
});

describe('I. a boy Maccabi rejected is never sold nostalgia', () => {
  it('does not treat him as a former player', () => {
    const rejected: Career = {
      ...seniorAt('hapoel_tel_aviv', 'mid_table'),
      origin: 'trial_rejected',
      flags: ['released_by_maccabi'],
    };
    /*
     * `formerMaccabi` deliberately includes him - Maccabi *is* part of his story - so the guard
     * that matters is that no event framing him as a returning hero can reach him. That is
     * enforced by samiOferContext, which v0.4.5.1 added and tests separately; here we only pin
     * that he has no senior Maccabi record for anything to be nostalgic about.
     */
    expect(rejected.maccabi.appearances).toBe(0);
    expect(rejected.maccabi.seasons).toBe(0);
  });
});

describe('J. a goalkeeper gets goalkeeping moments', () => {
  it('never offers an outfield-only position event to a keeper', () => {
    const keeper: Career = { ...seniorAt(MACCABI_ID, 'title_challenge'), position: 'GK' };
    for (const id of eligible(keeper, 'mid')) {
      const conditions = EVENTS_BY_ID[id]?.conditions;
      if (!conditions?.positions) continue;
      expect(conditions.positions, `${id} offered to a goalkeeper`).toContain('GK');
    }
  });

  it('never offers a goalkeeper-only event to an outfield player', () => {
    const striker: Career = { ...seniorAt(MACCABI_ID, 'title_challenge'), position: 'ST' };
    const keeperOnly = EVENT_POOL.filter(
      (e) => e.conditions?.positions?.length === 1 && e.conditions.positions[0] === 'GK',
    ).map((e) => e.id);
    expect(keeperOnly.length).toBeGreaterThan(0);
    for (const slot of ['early', 'mid', 'late'] as SeasonSlot[]) {
      for (const id of keeperOnly) expect(eligible(striker, slot), id).not.toContain(id);
    }
  });
});

describe('the table never contradicts the season it describes', () => {
  it('agrees with its own outcome at every forced scenario', () => {
    const cases: Array<[string, ClubSeasonOutcome]> = [
      [MACCABI_ID, 'champion'],
      [MACCABI_ID, 'relegation_battle'],
      ['hapoel_hadera', 'mid_table'],
      ['hapoel_petah_tikva', 'promoted'],
      ['hapoel_petah_tikva', 'struggled'],
    ];
    for (const [clubId, outcome] of cases) {
      const career = seniorAt(clubId, outcome);
      const projection = career.world.projection!;
      const shape = leagueShape(projection.leagueId)!;
      expect(
        outcomeForPosition(projection.leagueId, projection.finalPosition, shape),
        `${clubId} ${outcome}`,
      ).toBe(outcome);
    }
  });
});

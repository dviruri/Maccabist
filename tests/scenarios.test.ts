/**
 * v0.4.1 Phase 25: controlled scenarios.
 *
 * The other test files check rules in isolation. These walk a specific situation end to end and
 * assert the thing a *player* would notice — the scenarios the brief names, one test each, so a
 * regression reads as "scenario B broke" rather than as an assertion failure somewhere in the
 * transfer engine.
 */

import { describe, expect, it } from 'vitest';

import { getClub, MACCABI_ACADEMY_ID, MACCABI_ID } from '../src/data/clubs';
import { EVENTS_BY_ID } from '../src/data/events';
import { getLeague } from '../src/data/leagues';
import { LEAVING } from '../src/game/balance';
import * as CE from '../src/game/careerEngine';
import { currentTeamDisplay, hasCoherentIdentity, teamUnitOf } from '../src/game/identity';
import { crowdResponse, maccabiRelationship } from '../src/game/maccabiEngine';
import { clubCareerLevel, isDownwardMove, isUpwardMove, moveDirection } from '../src/game/marketEngine';
import { moveToClub } from '../src/game/progressionEngine';
import { createRng } from '../src/game/random';
import { balancedPolicy, boldPolicy, simulateCareer } from '../src/game/simulate';
import { buildReturnHomeOffer } from '../src/game/transferEngine';
import { computeLegendScore } from '../src/game/legendEngine';
import { ARCHETYPES } from '../src/game/storyEngine';
import { LEGENDARY_ENDINGS } from '../src/pages/RetirementPage';
import { applyPromotionRelegation, recordMaccabiSeason } from '../src/game/worldEngine';
import type { Career, Position, SeasonRecord } from '../src/types';

const fresh = (position: Position = 'CM', seed = 4): Career =>
  CE.createCareer({ playerName: 'ל', position, seed });

const seniorAt = (clubId: string, over: Partial<Career> = {}): Career => ({
  ...fresh(),
  academyStage: 'senior',
  currentClubId: clubId,
  age: 25,
  ability: 68,
  reputation: 50,
  roleValue: 58,
  ...over,
});

const seasonAt = (clubId: string, stage: Career['academyStage'] = 'senior'): SeasonRecord => ({
  season: 2045,
  age: 24,
  academyStage: stage,
  clubId,
  clubName: getClub(clubId).name,
  teamName: getClub(clubId).name,
  league: 'ליגת העל',
  onLoan: false,
  stats: {
    appearances: 30,
    starts: 26,
    goals: 6,
    assists: 4,
    cleanSheets: 8,
    goalsConceded: 24,
    rating: 68,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 68,
  role: 'starter',
  coachTrust: 62,
  trophies: [],
  captain: false,
  olderGroup: 'none',
});

/** Plays a whole career and returns every intermediate state, for end-to-end assertions. */
function playThrough(seed: number, policy = balancedPolicy, position: Position = 'CM'): Career[] {
  let career = fresh(position, seed);
  const rng = createRng((career.seed ^ 0x5bf03635) >>> 0);
  const states: Career[] = [];
  let steps = 0;
  while (!career.retired && steps < 900) {
    steps += 1;
    states.push(career);
    switch (career.phase) {
      case 'origin':
        career = CE.continueAfterOrigin(career);
        break;
      case 'retrial':
        career = CE.continueAfterRetrial(career);
        break;
      case 'preseason':
        career = CE.beginSeason(career);
        break;
      case 'event': {
        if (career.lastEventResult) {
          career = CE.continueAfterEvent(career);
          break;
        }
        const id = career.pendingEventIds[0];
        if (!id) {
          career = CE.continueAfterEvent(career);
          break;
        }
        career = CE.answerEvent(career, id, policy.pickChoice(EVENTS_BY_ID[id]!, career, rng));
        break;
      }
      case 'mid_season':
        career = CE.continueAfterMidSeason(career);
        break;
      case 'season_result':
        career = CE.continueAfterSeason(career);
        break;
      case 'progression':
        career = CE.continueAfterProgression(career);
        break;
      case 'offseason': {
        const pick = policy.pickOffer(career.pendingOffers, career, rng);
        career = pick ? CE.chooseOffer(career, pick) : CE.rejectOffers(career);
        break;
      }
      case 'youth_to_senior':
        career = CE.resolveYouthTransition(career, career.pendingOffers[0]?.id ?? null);
        break;
      case 'retirement_decision':
        career = CE.decideRetirement(career, policy.pickRetirement(career, rng));
        break;
      default:
        steps = 900;
    }
  }
  states.push(career);
  return states;
}

describe('A. Maccabi academy to a normal senior transition', () => {
  it('never shows academy wording once he is a first-team player', () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      for (const state of playThrough(seed)) {
        expect(hasCoherentIdentity(state)).toBe(true);
        if (state.academyStage !== 'senior') continue;
        checked += 1;
        const line = currentTeamDisplay(state).full;
        expect(line).not.toContain('מחלקת');
        expect(teamUnitOf(state)).toBe('first_team');
      }
    }
    expect(checked, 'no senior states seen - the scenario did not run').toBeGreaterThan(100);
  });
});

describe('B. an exceptional נערים א׳ prodigy reaching the first team', () => {
  it('cannot get there on the academy ladder alone', () => {
    /*
     * The v0.4 defect: 'senior' is the last entry in STAGE_LADDER, so a נערים א׳ early promotion
     * could land on it, moving the stage without moving the club. He then read as
     * "מכבי חיפה - מחלקת ילדים" for the rest of his career.
     */
    const prodigy: Career = {
      ...fresh(),
      academyStage: 'youth_a',
      currentClubId: MACCABI_ACADEMY_ID,
      ability: 82,
      coachTrust: 95,
      roleValue: 92,
    };
    const promoted = CE.continueAfterSeason({
      ...prodigy,
      phase: 'season_result',
      lastSeasonRecord: seasonAt(MACCABI_ACADEMY_ID, 'youth_a'),
    });
    expect(hasCoherentIdentity(promoted)).toBe(true);
  });

  it('shows מכבי חיפה, not academy wording, once he is actually promoted', () => {
    const boy: Career = {
      ...fresh(),
      academyStage: 'youth_a',
      currentClubId: MACCABI_ACADEMY_ID,
      ability: 82,
    };
    const promoted = moveToClub(boy, MACCABI_ID);
    expect(promoted.academyStage).toBe('senior');
    expect(currentTeamDisplay(promoted).full).toBe('מכבי חיפה');
    expect(currentTeamDisplay(promoted).team).toBeNull();
  });
});

describe('C. a long goalkeeping career', () => {
  it('outlasts an outfield career', () => {
    const ages = (position: Position): number[] => {
      const out: number[] = [];
      for (let seed = 1; seed <= 200; seed += 1) {
        const career = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
        if (career.seasonHistory.some((s) => s.academyStage === 'senior')) {
          out.push(career.retirementAge ?? career.age);
        }
      }
      return out;
    };
    const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
    expect(mean(ages('GK'))).toBeGreaterThan(mean(ages('ST')) + 1.5);
  });
});

describe('D-F. bold play: success, collapse, and recovery', () => {
  const careers = Array.from({ length: 400 }, (_, i) =>
    simulateCareer({ playerName: 'ל', position: 'CM', seed: i + 1, policy: boldPolicy }),
  );

  it('D. produces spectacular careers', () => {
    const spectacular = careers.filter((c) => (c.legend?.score ?? 0) >= 80);
    expect(spectacular.length).toBeGreaterThan(0);
  });

  it('E. produces collapses too', () => {
    /*
     * The threshold was `< 10` and is now `< 15`, because v0.4.8 removed passive Maccabism drift.
     * A career that went abroad used to bleed Maccabism every half-season simply for being there,
     * which dragged the bottom of the Legend Score distribution below ten. That drift was the bug;
     * the floor moving is its consequence, not a regression.
     *
     * The property being tested is unchanged: bold play can end badly. Measured over the same 400
     * careers - min 10, 4 under 15, 48 under 20, max 98.
     */
    const collapsed = careers.filter((c) => (c.legend?.score ?? 0) < 15);
    expect(collapsed.length).toBeGreaterThan(0);
    // And the spread is still real, which is what "collapse" is relative to.
    const best = Math.max(...careers.map((c) => c.legend?.score ?? 0));
    expect(best).toBeGreaterThan(70);
  });

  it('F. produces careers that dropped a level and climbed back', () => {
    const rebuilt = careers.filter((c) => c.memories.some((m) => m.kind === 'rebuilt_career'));
    expect(rebuilt.length).toBeGreaterThan(0);
  });
});

describe('G-I. move direction reads club level, not only league', () => {
  it('G. a smaller domestic club to Maccabi is upward', () => {
    expect(moveDirection(seniorAt('hapoel_hadera'), getClub(MACCABI_ID))).toBe('up');
    expect(isUpwardMove(moveDirection(seniorAt('hapoel_afula'), getClub(MACCABI_ID)))).toBe(true);
  });

  it('H. Maccabi to a smaller Israeli club is downward', () => {
    expect(isDownwardMove(moveDirection(seniorAt(MACCABI_ID), getClub('hapoel_hadera')))).toBe(true);
    expect(moveDirection(seniorAt(MACCABI_ID), getClub('hapoel_afula'))).toBe('major_down');
  });

  it('I. dropping from a big European club to regain minutes is a career-level drop', () => {
    // Down in level, and legitimately so - the label describes the move, not its wisdom.
    const direction = moveDirection(seniorAt('napoli'), getClub('sturm_graz'));
    expect(isDownwardMove(direction)).toBe(true);
    expect(clubCareerLevel(seniorAt('napoli'), 'sturm_graz')).toBeLessThan(
      clubCareerLevel(seniorAt('napoli'), 'napoli'),
    );
  });
});

describe('J. Maccabi wins a title while the player is abroad', () => {
  it('records a season he was not part of', () => {
    const abroad = seniorAt('benfica');
    let world = abroad.world;
    for (let seed = 1; seed <= 20; seed += 1) {
      world = recordMaccabiSeason({ ...abroad, world }, createRng(seed));
    }
    expect((world.maccabiSeasons ?? []).length).toBe(20);
    // Over twenty seasons a dominant club wins it at least once.
    expect((world.maccabiSeasons ?? []).some((s) => s.outcome === 'champion')).toBe(true);
  });
});

describe('K-L. facing Maccabi depends on whether he was ever theirs', () => {
  const facing = (over: Partial<Career>): Career => ({
    ...seniorAt('bnei_sakhnin'),
    ...over,
  });

  it('K. a former Maccabi player gets a history-aware reception', () => {
    const beloved = facing({
      maccabi: {
        ...fresh().maccabi,
        appearances: 260,
        seasons: 8,
        academySeasons: 9,
        academyGraduate: true,
        everLeft: true,
      },
    });
    expect(maccabiRelationship(beloved)).not.toBe('stranger');
    expect(crowdResponse(beloved)).toBe('warm');
  });

  it('K. a defector is booed however good he was', () => {
    const traitor = facing({
      currentClubId: LEAVING.rivalClubIds[0] as string,
      maccabi: { ...fresh().maccabi, appearances: 260, seasons: 8, everLeft: true },
      seasonHistory: [seasonAt(MACCABI_ID), seasonAt(LEAVING.rivalClubIds[0] as string)],
    });
    expect(maccabiRelationship(traitor)).toBe('traitor');
    expect(crowdResponse(traitor)).toBe('hostile');
  });

  it('L. a player Maccabi rejected as a child gets no nostalgia', () => {
    /*
     * The brief is explicit: do NOT use former-player wording for someone who never played there.
     * He is a stranger to that crowd, and the indifference is its own kind of sad.
     */
    const rejected = facing({
      flags: ['released_by_maccabi'],
      maccabi: { ...fresh().maccabi, appearances: 0, seasons: 0, academySeasons: 0 },
    });
    expect(maccabiRelationship(rejected)).toBe('stranger');
    expect(crowdResponse(rejected)).toBe('indifferent');
  });
});

describe('M. a homecoming after Maccabi were relegated', () => {
  it('advertises the division they are actually in', () => {
    const away: Career = {
      ...seniorAt('benfica'),
      maccabi: { ...fresh().maccabi, appearances: 180, seasons: 6, everLeft: true },
    };
    const relegated: Career = {
      ...away,
      world: applyPromotionRelegation(away.world, {
        season: 2046,
        clubId: MACCABI_ID,
        leagueId: 'il_premier',
        outcome: 'relegated',
        label: 'ירדה ליגה',
        playerImpact: 0,
      }),
    };
    const offer = buildReturnHomeOffer(relegated);
    expect(offer.leagueId).toBe('il_leumit');
    expect(offer.league).toBe(getLeague('il_leumit').name);
    // And says so in the text, rather than letting the player find out after signing.
    expect(offer.description).toContain('בליגה הלאומית');
  });
});

describe('N. the retirement poster (v0.4.5)', () => {
  /*
   * The poster's gold treatment follows the ending *title* rather than the raw score, because the
   * two can disagree — the engine awards "אגדה ירוקה" on career shape, not on the number. A poster
   * whose headline says legend while its treatment says ordinary is incoherent.
   *
   * The ids come from careerArchetype in storyEngine, NOT from data/endings.ts, which only
   * supplies a fallback description. Using the wrong set is exactly the bug this pins.
   */
  it('names archetypes that actually exist', () => {
    const known = new Set(ARCHETYPES.map((a) => a.id));
    for (const id of LEGENDARY_ENDINGS) {
      expect(known, `${id} is not a careerArchetype id`).toContain(id);
    }
  });

  it('picks the archetypes that describe a legend', () => {
    const legendary = ARCHETYPES.filter((a) => LEGENDARY_ENDINGS.includes(a.id));
    expect(legendary).toHaveLength(LEGENDARY_ENDINGS.length);
    // They should be the top of the priority order, or the gold is going to the wrong careers.
    const topPriority = Math.max(...ARCHETYPES.map((a) => a.priority));
    expect(Math.max(...legendary.map((a) => a.priority))).toBe(topPriority);
  });

  it('gives a genuine Maccabi legend the legendary ending', () => {
    const career = createCareerAt(MACCABI_ID);
    const legend = computeLegendScore({
      ...career,
      maccabi: {
        ...career.maccabi,
        appearances: 384,
        seasons: 13,
        championships: 6,
        captainSeasons: 5,
        academyGraduate: true,
      },
    });
    expect(LEGENDARY_ENDINGS).toContain(legend.ending.id);
  });
});

function createCareerAt(clubId: string): Career {
  return {
    ...fresh(),
    academyStage: 'senior',
    currentClubId: clubId,
    retired: true,
    retirementAge: 35,
    age: 35,
  };
}

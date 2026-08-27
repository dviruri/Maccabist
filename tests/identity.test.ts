/**
 * v0.4.1 Phase 1: club identity, team unit and development stage as three separate things.
 *
 * These exist because of a real playtest report: a player promoted to the Maccabi first team was
 * described as "מכבי חיפה - מחלקת ילדים" for the rest of his career. The cause was not a string —
 * it was the academy ladder advancing the *stage* to senior without anything moving the *club*,
 * which was possible because 'senior' is the last entry in STAGE_LADDER.
 *
 * So there are two things to guard: that the state can never become incoherent, and that nothing
 * assembles team wording outside `identity.ts`.
 */

import { describe, expect, it } from 'vitest';

import { STAGE_LADDER, stageOrder } from '../src/data/academy';
import { getClub, MACCABI_ACADEMY_ID, MACCABI_ID } from '../src/data/clubs';
import { EVENTS_BY_ID } from '../src/data/events';
import { FIRST_ACADEMY_SEASON } from '../src/game/balance';
import * as CE from '../src/game/careerEngine';
import {
  clubDisplayName,
  currentTeamDisplay,
  hasCoherentIdentity,
  isFirstTeam,
  teamDisplayFor,
  teamUnitFor,
  teamUnitOf,
} from '../src/game/identity';
import { createRng } from '../src/game/random';
import { balancedPolicy, riskTakerPolicy } from '../src/game/simulate';
import { headlineSubtitle, headlineTitle } from '../src/ui/format';
import type { AcademyStage, Career } from '../src/types';

const base = (seed = 7): Career => createCareerAt('pre_b', seed);

function createCareerAt(stage: AcademyStage, seed = 7): Career {
  const career = CE.createCareer({ playerName: 'ל', position: 'CM', seed });
  return {
    ...career,
    academyStage: stage,
    currentSeason: FIRST_ACADEMY_SEASON + stageOrder(stage),
  };
}

const senior = (clubId: string, seed = 7): Career => ({
  ...CE.createCareer({ playerName: 'ל', position: 'CM', seed }),
  academyStage: 'senior',
  currentClubId: clubId,
});

describe('team unit', () => {
  it('separates academy, youth and first team', () => {
    expect(teamUnitFor('pre_b')).toBe('academy');
    expect(teamUnitFor('children_a')).toBe('academy');
    expect(teamUnitFor('youth_a')).toBe('academy');
    expect(teamUnitFor('u19')).toBe('youth');
    expect(teamUnitFor('senior')).toBe('first_team');
  });

  it('is derived from the stage, not the club', () => {
    // Same club id, different unit - which is exactly why the two cannot be one concept.
    expect(teamUnitOf(createCareerAt('youth_b'))).toBe('academy');
    expect(teamUnitOf(senior(MACCABI_ID))).toBe('first_team');
    expect(isFirstTeam(senior(MACCABI_ID))).toBe(true);
    expect(isFirstTeam(createCareerAt('u19'))).toBe(false);
  });
});

describe('team display', () => {
  it('names the club without an age-group suffix', () => {
    // The academy club record is called "מכבי חיפה - מחלקת ילדים" because it doubles as a club
    // id. That suffix belongs to the unit, and must not leak into the club name.
    expect(clubDisplayName(MACCABI_ACADEMY_ID)).toBe('מכבי חיפה');
    expect(clubDisplayName(MACCABI_ID)).toBe('מכבי חיפה');
    expect(getClub(MACCABI_ACADEMY_ID).name).toContain('מחלקת');
  });

  it('shows club and age group for an academy player', () => {
    const display = currentTeamDisplay(createCareerAt('youth_a'));
    expect(display.club).toBe('מכבי חיפה');
    expect(display.team).toBe('נערים א׳');
    expect(display.full).toBe('מכבי חיפה — נערים א׳');
  });

  it('shows נוער for a u19 player', () => {
    expect(currentTeamDisplay(createCareerAt('u19')).full).toBe('מכבי חיפה — נוער');
  });

  it('shows the club alone for a first-team player', () => {
    const display = currentTeamDisplay(senior(MACCABI_ID));
    expect(display.club).toBe('מכבי חיפה');
    expect(display.team).toBeNull();
    expect(display.full).toBe('מכבי חיפה');
    // Never "בוגרים" - nobody refers to a first-team footballer by his age group.
    expect(display.full).not.toContain('בוגרים');
  });

  it('never says מחלקת ילדים for a first-team player', () => {
    for (const clubId of [MACCABI_ID, 'hapoel_afula', 'benfica']) {
      const display = currentTeamDisplay(senior(clubId));
      expect(display.full).not.toContain('מחלקת');
      expect(display.full).not.toContain('נוער');
    }
  });

  it('renders a historical season with the wording that was true then', () => {
    // A retired first-team player's נערים ב׳ season is still נערים ב׳. That is history, not stale.
    const past = teamDisplayFor(MACCABI_ACADEMY_ID, 'youth_b');
    expect(past.full).toBe('מכבי חיפה — נערים ב׳');
    expect(past.unit).toBe('academy');
  });

  it('marks a loan spell', () => {
    const away = teamDisplayFor('hapoel_afula', 'senior', true);
    expect(away.onLoan).toBe(true);
    expect(away.full).toBe(getClub('hapoel_afula').name);
  });
});

describe('the UI headline uses the same source of truth', () => {
  it('titles an academy player with his age group and a senior with his club', () => {
    expect(headlineTitle(createCareerAt('children_b'))).toBe('ילדים ב׳');
    expect(headlineTitle(senior(MACCABI_ID))).toBe('מכבי חיפה');
  });

  it('subtitles an academy player with a clean club name', () => {
    expect(headlineSubtitle(createCareerAt('youth_c'))).toBe('מכבי חיפה');
    expect(headlineSubtitle(createCareerAt('youth_c'))).not.toContain('מחלקת');
  });

  it('subtitles a first-team player with his actual league', () => {
    expect(headlineSubtitle(senior(MACCABI_ID))).toBe('ליגת העל');
    expect(headlineSubtitle(senior('benfica'))).not.toBe('ליגת העל');
  });
});

describe('identity coherence', () => {
  it('rejects a senior stage at a non-senior club', () => {
    const broken: Career = { ...base(), academyStage: 'senior', currentClubId: MACCABI_ACADEMY_ID };
    expect(hasCoherentIdentity(broken)).toBe(false);
  });

  it('rejects an academy stage at a senior club', () => {
    const broken: Career = { ...base(), academyStage: 'youth_a', currentClubId: MACCABI_ID };
    expect(hasCoherentIdentity(broken)).toBe(false);
  });

  it('accepts the two legitimate combinations', () => {
    expect(hasCoherentIdentity(createCareerAt('youth_a'))).toBe(true);
    expect(hasCoherentIdentity(senior(MACCABI_ID))).toBe(true);
  });

  it('never puts senior on the academy ladder', () => {
    // 'senior' is the last entry in STAGE_LADDER, and clamping to the ladder length is what let a
    // נערים א׳ early promotion land on it. Reaching senior football is a transition, not a rung.
    expect(STAGE_LADDER[STAGE_LADDER.length - 1]).toBe('senior');
    expect(stageOrder('senior')).toBe(STAGE_LADDER.length - 1);
  });

  it('repairs a save that was written in the broken state', () => {
    const broken: Career = {
      ...base(),
      academyStage: 'senior',
      currentClubId: MACCABI_ACADEMY_ID,
    };
    const fixed = CE.hydrateCareer(broken);
    expect(hasCoherentIdentity(fixed)).toBe(true);
    // He is a senior; it was the club that was never updated. Do not demote him.
    expect(fixed.academyStage).toBe('senior');
    expect(fixed.currentClubId).toBe(MACCABI_ID);
    expect(currentTeamDisplay(fixed).full).toBe('מכבי חיפה');
  });
});

describe('across whole simulated careers', () => {
  const playThrough = (seed: number, policy: typeof balancedPolicy): Career[] => {
    let career: Career = CE.createCareer({ playerName: 'ל', position: 'CM', seed });
    const rng = createRng((career.seed ^ 0x5bf03635) >>> 0);
    const seen: Career[] = [];
    let steps = 0;
    while (!career.retired && steps < 900) {
      steps += 1;
      seen.push(career);
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
          career = CE.answerEvent(
            career,
            id,
            policy.pickChoice(EVENTS_BY_ID[id]!, career, rng),
          );
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
    return seen;
  };

  it('keeps club, unit and stage coherent at every step', () => {
    for (const policy of [balancedPolicy, riskTakerPolicy]) {
      for (let seed = 1; seed <= 60; seed += 1) {
        for (const state of playThrough(seed, policy)) {
          expect(
            hasCoherentIdentity(state),
            `seed ${seed}: ${state.academyStage} at ${state.currentClubId}`,
          ).toBe(true);
        }
      }
    }
  });

  it('never shows academy wording to a first-team player', () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      for (const state of playThrough(seed, balancedPolicy)) {
        if (state.academyStage !== 'senior') continue;
        const line = currentTeamDisplay(state).full;
        expect(line).not.toContain('מחלקת');
        expect(line).not.toContain('נוער');
      }
    }
  });

  it('writes clean club and team names into every season record', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const final = playThrough(seed, balancedPolicy).at(-1) as Career;
      for (const record of final.seasonHistory) {
        expect(record.clubName).not.toContain('מחלקת');
        if (record.academyStage === 'senior') {
          expect(record.teamName).not.toContain('מחלקת');
          expect(record.teamName).not.toContain('נוער');
        }
      }
    }
  });
});

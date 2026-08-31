/**
 * European state separation (v0.9.1, Phase 3).
 *
 * The playtest bug: a club actually playing in the Conference League, with the UI announcing
 * "Champions League - direct league phase". Two facts had been collapsed into one field -
 * where a club STARTED, and what it earned for NEXT season. These tests keep them apart.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { currentCampaign, europeanStatusLine, nextSeasonRoute } from '../src/game/europeStatus';
import { resolveEntriesFromResults, type DomesticResult, type Participant } from '../src/game/uefaEngine';
import type { Career, EuropeanJourney, EuropeState } from '../src/types';

function baseCareer(): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'ST', seed: 3 }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    currentSeason: 2044,
    age: 24,
  };
}

/** A journey that ENTERED the Champions League and fell all the way to the Conference. */
function droppedJourney(): EuropeanJourney {
  return {
    season: 2044,
    clubId: MACCABI_ID,
    steps: [
      { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
      { kind: 'dropped', from: 'uefa_champions_league', to: 'uefa_europa_league', toEntry: 'uel_q3' },
      { kind: 'dropped', from: 'uefa_europa_league', to: 'uefa_conference_league', toEntry: 'uecl_po' },
    ],
    finalCompetition: 'uefa_conference_league',
    furthest: 'league_phase',
    matches: 8,
    wonCompetition: null,
    reachedFinal: false,
    reachedSemiFinal: false,
    reachedLeaguePhase: true,
  };
}

function withEurope(career: Career, europe: Partial<EuropeState>): Career {
  return {
    ...career,
    world: {
      ...career.world,
      europe: { coefficients: { associations: {}, clubs: {} }, history: [], ...europe } as EuropeState,
    },
  };
}

describe('current campaign follows the drop-downs', () => {
  it('a club that fell from the UCL to the UECL reads Conference League NOW', () => {
    const career = withEurope(baseCareer(), {
      current: {
        season: 2044,
        // The stored entry still says Champions League - that is history, not the campaign.
        entries: [
          {
            clubId: MACCABI_ID,
            clubName: 'מכבי חיפה',
            association: 'ישראל',
            competition: 'uefa_champions_league',
            entry: 'ucl_q1',
            reason: 'champion',
          },
        ],
        winners: {} as never,
        playerJourney: droppedJourney(),
        maccabiJourney: null,
      },
    });

    const now = currentCampaign(career, MACCABI_ID)!;
    expect(now.competition).toBe('uefa_conference_league');
    expect(now.certainty).toBe('campaign');
    expect(europeanStatusLine(career, MACCABI_ID)).toContain('קונפרנס');
    expect(europeanStatusLine(career, MACCABI_ID)).not.toContain('אלופות');
  });

  it('the journey still records the Champions League origin - history is not rewritten', () => {
    const journey = droppedJourney();
    expect(journey.steps[0]).toMatchObject({ kind: 'entered', competition: 'uefa_champions_league' });
    expect(journey.finalCompetition).toBe('uefa_conference_league');
  });

  it('a qualifying entry is never rendered as a league-phase place', () => {
    const career = withEurope(baseCareer(), {
      current: {
        season: 2044,
        entries: [
          {
            clubId: 'hapoel_beer_sheva',
            clubName: 'הפועל באר שבע',
            association: 'ישראל',
            competition: 'uefa_champions_league',
            entry: 'ucl_q1',
            reason: 'champion',
          },
        ],
        winners: {} as never,
        playerJourney: null,
        maccabiJourney: null,
      },
    });
    const status = currentCampaign(career, 'hapoel_beer_sheva')!;
    expect(status.inLeaguePhase).toBe(false);
    expect(status.stage).toContain('מוקדמות');
    expect(europeanStatusLine(career, 'hapoel_beer_sheva')).not.toContain('שלב הליגה');
  });
});

describe('next season is a different question', () => {
  it('is never presented as a present fact', () => {
    const career = withEurope(baseCareer(), {
      current: null,
      nextEntries: [
        {
          clubId: MACCABI_ID,
          clubName: 'מכבי חיפה',
          association: 'ישראל',
          competition: 'uefa_champions_league',
          entry: 'ucl_q1',
          reason: 'champion',
        },
      ],
    });
    expect(currentCampaign(career, MACCABI_ID)).toBeNull();
    const next = nextSeasonRoute(career, MACCABI_ID)!;
    expect(next.competition).toBe('uefa_champions_league');
    expect(next.inLeaguePhase).toBe(false);
    const line = europeanStatusLine(career, MACCABI_ID)!;
    expect(line).toContain('בעונה הבאה');
    expect(line).toContain('מוקדמות');
  });

  it('Israeli 2nd place earns a Conference route - never a Champions League entry', () => {
    const participantOf = (clubId: string): Participant => ({
      id: clubId,
      name: clubId,
      association: 'ישראל',
      quality: 70,
      coefficient: 10,
    });
    const results: DomesticResult[] = [
      {
        association: 'ישראל',
        leagueId: 'il_premier',
        positions: ['maccabi_haifa', 'maccabi_tel_aviv', 'hapoel_jerusalem', 'hapoel_beer_sheva'],
        cupWinnerId: 'hapoel_beer_sheva',
      },
    ];
    const resolved = resolveEntriesFromResults(results, null, participantOf);
    const second = resolved.entries.find((e) => e.clubId === 'maccabi_tel_aviv')!;
    expect(second.competition).toBe('uefa_conference_league');

    const career = withEurope(baseCareer(), { current: null, nextEntries: resolved.entries });
    const line = europeanStatusLine(career, 'maccabi_tel_aviv')!;
    expect(line).toContain('בעונה הבאה');
    expect(line).not.toContain('אלופות');
  });

  it('the Israeli champion earns a QUALIFYING route, not a league-phase place', () => {
    const participantOf = (clubId: string): Participant => ({
      id: clubId,
      name: clubId,
      association: 'ישראל',
      quality: 70,
      coefficient: 10,
    });
    const resolved = resolveEntriesFromResults(
      [
        {
          association: 'ישראל',
          leagueId: 'il_premier',
          positions: ['maccabi_haifa', 'maccabi_tel_aviv', 'hapoel_jerusalem', 'hapoel_beer_sheva'],
          cupWinnerId: 'hapoel_beer_sheva',
        },
      ],
      null,
      participantOf,
    );
    const career = withEurope(baseCareer(), { current: null, nextEntries: resolved.entries });
    const next = nextSeasonRoute(career, 'maccabi_haifa')!;
    expect(next.competition).toBe('uefa_champions_league');
    expect(next.inLeaguePhase).toBe(false); // qualifying, never "direct league phase"
    expect(europeanStatusLine(career, 'maccabi_haifa')).not.toContain('שלב הליגה');
  });
});

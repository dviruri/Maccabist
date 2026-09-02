/**
 * The career feed (v0.9.1, Phase 5): varied wording, identical honesty.
 *
 * v0.9 said the same coach sentence every beat of a whole career. These tests demand variety
 * across beats AND determinism within one, and check that variety never became invention.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { deriveCareerFeed } from '../src/game/careerFeed';
import { createRng } from '../src/game/random';
import { openWorldSeason } from '../src/game/worldEngine';
import { LEAGUE_PHASE } from '../src/data/uefa';
import type { Career, EuropeanStep, SeasonPoint, UefaCompetitionId } from '../src/types';

function seniorCareer(overrides: Partial<Career> = {}, seed = 4): Career {
  const base: Career = {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 74,
    roleValue: 70,
    currentSeason: 2044,
    ...overrides,
  };
  return { ...base, world: openWorldSeason(base, createRng(seed)) };
}

describe('determinism within a beat', () => {
  it('renders the same feed twice for the same state', () => {
    const career = seniorCareer();
    expect(deriveCareerFeed(career)).toEqual(deriveCareerFeed(career));
  });

  it('consumes nothing from the career', () => {
    const career = seniorCareer();
    const before = career.rngState;
    deriveCareerFeed(career);
    expect(career.rngState).toBe(before);
  });
});

describe('variety across beats', () => {
  it('the coach does not repeat one sentence across seasons in the same situation', () => {
    const lines = new Set<string>();
    for (let season = 2044; season <= 2055; season += 1) {
      const career = seniorCareer({ currentSeason: season });
      const coach = deriveCareerFeed(career).find((item) => item.role === 'coach');
      if (coach) lines.add(coach.text);
    }
    // Same role, same club, twelve seasons: the wording must move.
    expect(lines.size).toBeGreaterThan(1);
  });

  it('varies across season points too', () => {
    const lines = new Set<string>();
    for (const point of ['preseason', 'midseason', 'season_end'] as SeasonPoint[]) {
      const career = seniorCareer({ seasonPoint: point });
      const coach = deriveCareerFeed(career).find((item) => item.role === 'coach');
      if (coach) lines.add(coach.text);
    }
    expect(lines.size).toBeGreaterThan(1);
  });

  it('never shows the same sentence twice in one feed', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const items = deriveCareerFeed(seniorCareer({}, seed));
      expect(new Set(items.map((i) => i.text)).size).toBe(items.length);
    }
  });
});

describe('variety is wording, never invented fact', () => {
  it('says nothing about offers when there are none', () => {
    const career = seniorCareer({ pendingOffers: [], reputation: 20 });
    const agent = deriveCareerFeed(career).find((item) => item.role === 'agent');
    expect(agent).toBeUndefined();
  });

  it('quotes the real country of a real foreign offer', () => {
    const career = seniorCareer({
      pendingOffers: [
        {
          id: 'o1',
          kind: 'transfer',
          clubId: 'ajax',
          clubName: 'אייאקס',
          league: 'האירדיוויזי',
          country: 'הולנד',
          title: 't',
          description: 'd',
          acceptEffects: {},
          declineEffects: {},
          acceptLabel: 'a',
          declineLabel: 'b',
        },
      ],
    });
    const agent = deriveCareerFeed(career).find((item) => item.role === 'agent')!;
    expect(agent.text).toContain('הולנד');
  });

  it('quotes only real half-season numbers in media lines', () => {
    const career = seniorCareer({
      firstHalfStats: {
        appearances: 14,
        starts: 13,
        goals: 7,
        assists: 2,
        cleanSheets: 0,
        goalsConceded: 0,
        rating: 68,
        injuredGames: 0,
      },
    });
    const media = deriveCareerFeed(career).find((item) => item.role === 'journalist');
    if (media && /\d/.test(media.text)) {
      // Any number it quotes must be one the half really contains.
      const numbers = media.text.match(/\d+/g)!.map(Number);
      for (const n of numbers) expect([7, 14, 2, 13]).toContain(n);
    }
  });

  it('stays silent on media before there is evidence to talk about', () => {
    const career = seniorCareer({ firstHalfStats: null });
    expect(deriveCareerFeed(career).find((item) => item.role === 'journalist')).toBeUndefined();
  });

  it('caps the feed at four items', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      expect(deriveCareerFeed(seniorCareer({}, seed)).length).toBeLessThanOrEqual(4);
    }
  });
});

/* ------------------------------------------------------------------ */
/* European state (v0.9.6.2)                                           */
/* ------------------------------------------------------------------ */

/**
 * The club line must describe the European state the player is actually in.
 *
 * Before v0.9.6.2 the pool was chosen with `inLeaguePhase ? europe_lp : europe_out`, so
 * `!inLeaguePhase` meant "eliminated". A club alive in qualifying - which is where a Maccabi
 * season starts - was told the European summer had ended early before it had played a qualifier.
 */

const OUT_WORDING = ['נגמר מוקדם', 'אירופה נסגרה'];
const QUALIFYING_WORDING = ['במוקדמות', 'אירופה מתחילה'];

function withJourney(career: Career, steps: EuropeanStep[], seasonPoint: SeasonPoint): Career {
  return {
    ...career,
    seasonPoint,
    world: {
      ...career.world,
      europe: {
        coefficients: { associations: {}, clubs: {} },
        history: [],
        current: {
          season: career.currentSeason,
          entries: [],
          winners: {} as never,
          maccabiJourney: null,
          playerJourney: {
            season: career.currentSeason,
            clubId: career.currentClubId,
            steps,
            finalCompetition: 'uefa_conference_league',
            furthest: 'league_phase',
            matches: 0,
            wonCompetition: null,
            reachedFinal: false,
            reachedSemiFinal: false,
            reachedLeaguePhase: false,
          },
        },
      },
    } as never,
  };
}

const entered = (competition: UefaCompetitionId, entry: string): EuropeanStep =>
  ({ kind: 'entered', competition, entry, reason: { kind: 'league_position', position: 2 } }) as EuropeanStep;

function clubLine(career: Career): string {
  return deriveCareerFeed(career).find((item) => item.role === 'club-director')?.text ?? '';
}

describe('the club line tells the truth about Europe', () => {
  it('does not call an active Champions League qualifier a finished season', () => {
    const line = clubLine(
      withJourney(seniorCareer(), [entered('uefa_champions_league', 'ucl_q1')], 'preseason'),
    );
    expect(line).not.toBe('');
    for (const wrong of OUT_WORDING) expect(line).not.toContain(wrong);
    expect(QUALIFYING_WORDING.some((right) => line.includes(right))).toBe(true);
  });

  it('does not call an active Conference qualifier a finished season either', () => {
    const line = clubLine(
      withJourney(seniorCareer(), [entered('uefa_conference_league', 'uecl_q2')], 'preseason'),
    );
    for (const wrong of OUT_WORDING) expect(line).not.toContain(wrong);
    expect(QUALIFYING_WORDING.some((right) => line.includes(right))).toBe(true);
  });

  it('says the league phase when the club is in the league phase', () => {
    const line = clubLine(
      withJourney(
        seniorCareer(),
        [entered('uefa_conference_league', LEAGUE_PHASE)],
        'midseason',
      ),
    );
    for (const wrong of OUT_WORDING) expect(line).not.toContain(wrong);
    expect(line).toContain('קונפרנס ליג');
  });

  it('only says Europe is over once the club is actually out', () => {
    const line = clubLine(
      withJourney(
        seniorCareer(),
        [
          entered('uefa_conference_league', 'uecl_q2'),
          {
            kind: 'tie',
            tie: {
              competition: 'uefa_conference_league',
              stage: 'uecl_q2',
              opponentName: 'יריבה',
              won: false,
            },
          } as EuropeanStep,
        ],
        'midseason',
      ),
    );
    expect(OUT_WORDING.some((right) => line.includes(right))).toBe(true);
  });

  it('does not promise nights that have already happened once the season is settled', () => {
    const line = clubLine(
      withJourney(seniorCareer(), [entered('uefa_conference_league', LEAGUE_PHASE)], 'season_end'),
    );
    /* "לילות גדולים מחכים" is a promise, and at season end there is nothing left to wait for. */
    expect(line).not.toContain('מחכים');
    /* Either settled variant is fine; both are past tense. */
    expect(['הסתיים', 'סיימנו'].some((past) => line.includes(past)), line).toBe(true);
  });

  it('never leaks a competition the revealed path has not reached', () => {
    /*
     * The journey ENDS in the Conference League - `finalCompetition` says so - but at preseason
     * only the Champions League entry is revealed, so that is the only competition nameable.
     */
    const line = clubLine(
      withJourney(
        seniorCareer(),
        [
          entered('uefa_champions_league', 'ucl_q1'),
          {
            kind: 'tie',
            tie: { competition: 'uefa_champions_league', stage: 'ucl_q1', opponentName: 'יריבה', won: false },
          } as EuropeanStep,
          { kind: 'dropped', to: 'uefa_conference_league', toEntry: 'uecl_q3' } as EuropeanStep,
        ],
        'preseason',
      ),
    );
    expect(line).toContain('ליגת האלופות');
    expect(line).not.toContain('קונפרנס');
  });

  it('is deterministic for an identical European state', () => {
    const career = withJourney(seniorCareer(), [entered('uefa_champions_league', 'ucl_q1')], 'preseason');
    expect(clubLine(career)).toBe(clubLine(career));
  });

  it('attaches ב to a competition name as Hebrew requires', () => {
    /*
     * "ב" swallows the definite ה: it is "בקונפרנס ליג", never "בהקונפרנס ליג". The pool used to
     * interpolate the bare name straight after a ב, which shipped both broken forms.
     */
    const line = clubLine(
      withJourney(seniorCareer(), [entered('uefa_conference_league', LEAGUE_PHASE)], 'midseason'),
    );
    expect(line).not.toContain('בה');
  });
});

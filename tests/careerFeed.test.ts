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
import type { Career, SeasonPoint } from '../src/types';

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

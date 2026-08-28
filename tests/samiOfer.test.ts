/**
 * v0.4.5.1 Phases 2-4: the Maccabi family, and who the crowd thinks you are.
 *
 * The brief is explicit about one distinction being critical: a player Maccabi turned away as a
 * child and who never wore the shirt is **not** a former hero returning. Framing him as one would
 * be the game telling him a story about himself that never happened.
 *
 * The relationship model cannot tell those two apart on its own - both come out as `stranger` -
 * which is exactly why `samiOferContext` exists and why these tests are worth having.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { EVENTS_BY_ID } from '../src/data/events';
import { LEAVING } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import {
  maccabiRelationship,
  SAMI_OFER_CROWD,
  SAMI_OFER_LINES,
  SAMI_OFER_TITLES,
  samiOferContext,
  wasRejectedAsAChild,
  type SamiOferContext,
} from '../src/game/maccabiEngine';
import { maccabiPresentation } from '../src/ui/eventVisuals';
import type { Career, GameEvent, SeasonRecord } from '../src/types';

const RIVAL = LEAVING.rivalClubIds[0] as string;

const base = (over: Partial<Career> = {}): Career => ({
  ...createCareer({ playerName: 'ל', position: 'CM', seed: 12 }),
  academyStage: 'senior',
  currentClubId: 'bnei_sakhnin',
  age: 28,
  ...over,
});

const seniorSeason = (clubId: string): SeasonRecord => ({
  season: 2048,
  age: 27,
  academyStage: 'senior',
  clubId,
  clubName: clubId,
  teamName: clubId,
  league: 'ליגת העל',
  onLoan: false,
  stats: {
    appearances: 30,
    starts: 27,
    goals: 5,
    assists: 4,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 70,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 74,
  role: 'star',
  coachTrust: 66,
  trophies: [],
  captain: false,
  olderGroup: 'none',
});

/* ---- the histories ---- */

const legend = (): Career => {
  const career = base();
  return {
    ...career,
    maccabi: {
      ...career.maccabi,
      appearances: 312,
      seasons: 11,
      championships: 4,
      cups: 2,
      captainSeasons: 4,
      academyGraduate: true,
      academySeasons: 9,
      everLeft: true,
    },
    seasonHistory: [seniorSeason(MACCABI_ID)],
  };
};

const defector = (): Career => {
  const career = base({ currentClubId: RIVAL });
  return {
    ...career,
    maccabi: {
      ...career.maccabi,
      appearances: 190,
      seasons: 6,
      academyGraduate: true,
      academySeasons: 9,
      everLeft: true,
    },
    seasonHistory: [seniorSeason(MACCABI_ID), seniorSeason(RIVAL)],
  };
};

const rejectedChild = (): Career => {
  const career = base({ origin: 'trial_rejected' });
  return {
    ...career,
    flags: ['released_by_maccabi'],
    maccabi: { ...career.maccabi, appearances: 0, seasons: 0, academySeasons: 0 },
  };
};

const noHistory = (): Career => base();

describe('who Maccabi turned away', () => {
  it('recognises a boy they rejected who never played for them', () => {
    expect(wasRejectedAsAChild(rejectedChild())).toBe(true);
  });

  it('does not count a player who was released and then made it anyway', () => {
    // Released at eighteen, signed back later, played 90 games. That is a different story.
    const cameGood: Career = {
      ...rejectedChild(),
      maccabi: { ...rejectedChild().maccabi, appearances: 90, seasons: 3 },
    };
    expect(wasRejectedAsAChild(cameGood)).toBe(false);
  });

  it('does not count a player with no Maccabi history at all', () => {
    expect(wasRejectedAsAChild(noHistory())).toBe(false);
  });
});

describe('the Sami Ofer context', () => {
  it('reads a legend, a defector, a rejected boy and a stranger differently', () => {
    expect(samiOferContext(legend())).toBe('returning_legend');
    expect(samiOferContext(defector())).toBe('hostile_return');
    expect(samiOferContext(rejectedChild())).toBe('rejected_child');
    expect(samiOferContext(noHistory())).toBe('no_history');
  });

  it('separates the rejected boy from the stranger, which the relationship model cannot', () => {
    /*
     * This is the whole point. Both are `stranger` to the relationship model - neither ever played
     * for the club - and they could not be more different to the player.
     */
    expect(maccabiRelationship(rejectedChild())).toBe('stranger');
    expect(maccabiRelationship(noHistory())).toBe('stranger');
    expect(samiOferContext(rejectedChild())).not.toBe(samiOferContext(noHistory()));
  });

  it('never frames a player who was never theirs as returning', () => {
    for (const context of ['rejected_child', 'no_history'] as SamiOferContext[]) {
      expect(SAMI_OFER_TITLES[context]).not.toContain('חוזרים');
    }
    for (const context of [
      'returning_legend',
      'respected_return',
      'quiet_return',
      'hostile_return',
    ] as SamiOferContext[]) {
      expect(SAMI_OFER_TITLES[context]).toContain('חוזרים');
    }
  });

  it('gives the rejected boy the line the brief asks for', () => {
    // Not nostalgia. The club that would not have him is standing in front of him.
    expect(SAMI_OFER_LINES.rejected_child).toContain('לא קיבל אותך');
    expect(SAMI_OFER_LINES.rejected_child).not.toContain('בצד השני.');
  });

  it('has a title, a line and a crowd response for every context', () => {
    const all: SamiOferContext[] = [
      'returning_legend',
      'respected_return',
      'quiet_return',
      'hostile_return',
      'rejected_child',
      'no_history',
    ];
    for (const context of all) {
      expect(SAMI_OFER_TITLES[context], context).toBeTruthy();
      expect(SAMI_OFER_LINES[context], context).toBeTruthy();
      expect(SAMI_OFER_CROWD[context], context).toBeTruthy();
    }
  });

  it('is a derivation, so the same career always gets the same reception', () => {
    const career = legend();
    const first = samiOferContext(career);
    for (let i = 0; i < 20; i += 1) expect(samiOferContext(career)).toBe(first);
  });

  it('boos service when it ended badly', () => {
    // A defector has more Maccabi appearances than most; the stand does not net that off.
    expect(defector().maccabi.appearances).toBeGreaterThan(150);
    expect(SAMI_OFER_CROWD.hostile_return).toContain('בוז');
  });
});

describe('which Maccabi presentation an event gets', () => {
  const at = (career: Career, eventId: string): string =>
    maccabiPresentation(EVENTS_BY_ID[eventId] as GameEvent, career);

  it('gives the stadium events the Sami Ofer treatment', () => {
    expect(at(legend(), 'mac_return_to_sami_ofer_warm')).toBe('sami_ofer');
    expect(at(defector(), 'mac_return_to_sami_ofer_hostile')).toBe('sami_ofer');
    expect(at(legend(), 'mac_scored_against_them')).toBe('sami_ofer');
  });

  it('gives the ambient events the news treatment', () => {
    expect(at(legend(), 'amb_they_won_it_without_you')).toBe('ambient_news');
    expect(at(legend(), 'amb_they_went_down')).toBe('ambient_news');
  });

  it('gives everything else about the club the מהבית band', () => {
    expect(at(legend(), 'mac_they_still_watch')).toBe('relationship');
    expect(at(legend(), 'mac_asked_about_them')).toBe('relationship');
  });

  it('gives a player who is actually at Maccabi none of them', () => {
    const home: Career = { ...legend(), currentClubId: MACCABI_ID };
    for (const id of ['mac_return_to_sami_ofer_warm', 'amb_they_won_it_without_you']) {
      expect(at(home, id)).toBe('none');
    }
  });
});

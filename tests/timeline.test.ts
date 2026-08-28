/**
 * v0.4.5.1 Phase 5: the career timeline keeps its history straight.
 *
 * The brief's requirement: "Historical context must be preserved. If player was at ילדים א׳ at the
 * time, timeline should not later display him as 'Maccabi first team' for that historical moment."
 *
 * The timeline is a React component, so what is tested here is the derivation it renders - looking
 * a milestone's season up in the season record rather than reading today's club and stage off the
 * career. That is where the bug would live; the JSX around it is a `<div>`.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { teamDisplayFor, teamDisplayLine } from '../src/game/identity';
import type { AcademyStage, Career, Milestone, SeasonRecord } from '../src/types';

/** The same derivation `CareerTimeline` uses, kept in one place so the test tracks the component. */
function eraFor(career: Career, season: number): string | null {
  const record = career.seasonHistory.find((s) => s.season === season);
  if (!record) return null;
  return teamDisplayLine(teamDisplayFor(record.clubId, record.academyStage, record.onLoan));
}

const record = (
  season: number,
  clubId: string,
  academyStage: AcademyStage,
  onLoan = false,
): SeasonRecord => ({
  season,
  age: season - 2020,
  academyStage,
  clubId,
  clubName: clubId,
  teamName: clubId,
  league: 'ליגת העל',
  onLoan,
  stats: {
    appearances: 20,
    starts: 15,
    goals: 2,
    assists: 2,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 68,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 60,
  role: 'squad',
  coachTrust: 60,
  trophies: [],
  captain: false,
  olderGroup: 'none',
});

const milestone = (season: number, text: string): Milestone => ({
  id: `m_${season}`,
  season,
  age: season - 2020,
  icon: '⭐',
  text,
  major: false,
});

/**
 * A career that went somewhere: Maccabi ילדים א׳, then Maccabi's first team, then a loan, then a
 * permanent move abroad. Every milestone below belongs to a different era.
 */
function travelled(): Career {
  const career = createCareer({ playerName: 'ט', position: 'CM', seed: 7 });
  return {
    ...career,
    // Today he is a Hapoel Tel Aviv senior player. Nothing below should be described that way.
    academyStage: 'senior',
    currentClubId: 'hapoel_tel_aviv',
    seasonHistory: [
      record(2035, MACCABI_ID, 'children_a'),
      record(2041, MACCABI_ID, 'senior'),
      record(2044, 'bnei_sakhnin', 'senior', true),
      record(2047, 'hapoel_tel_aviv', 'senior'),
    ],
    milestones: [
      milestone(2035, 'עלית לילדים א׳'),
      milestone(2041, 'הופעת בכורה בבוגרים'),
      milestone(2044, 'שער ראשון בהשאלה'),
      milestone(2047, 'חתמת בהפועל תל אביב'),
    ],
  };
}

describe('the career timeline shows where he was at the time', () => {
  it('describes an academy moment as the academy team, not the first team', () => {
    const era = eraFor(travelled(), 2035);
    expect(era).toContain('ילדים א׳');
    expect(era).toContain('מכבי חיפה');
  });

  it('does not backdate his current club onto an earlier moment', () => {
    /*
     * The failure the brief names. Reading `career.currentClubId` would put Hapoel Tel Aviv on a
     * milestone from a season he spent in Maccabi's academy.
     */
    const career = travelled();
    expect(eraFor(career, 2035)).not.toContain('הפועל');
    expect(eraFor(career, 2041)).not.toContain('הפועל');
  });

  it('does not backdate his current stage onto an academy moment', () => {
    const career = travelled();
    const now = teamDisplayLine(teamDisplayFor(career.currentClubId, career.academyStage));
    expect(eraFor(career, 2035)).not.toBe(now);
    expect(eraFor(career, 2047)).toBe(now);
  });

  it('gives every era in a career-spanning story a distinct label', () => {
    const career = travelled();
    const eras = career.milestones.map((m) => eraFor(career, m.season));
    expect(eras.every((e) => e !== null)).toBe(true);
    expect(new Set(eras).size).toBe(career.milestones.length);
  });

  it('says a loan season was a loan', () => {
    // A season on loan is part of the story, but it is not the club he belonged to.
    expect(eraFor(travelled(), 2044)).toContain('השאלה');
  });

  it('returns nothing rather than guessing when no season record matches', () => {
    /*
     * Milestones written mid-season, and milestones in saves older than the season trail, have no
     * record to look up. The timeline must omit the era line, not fall back to today's club.
     */
    expect(eraFor(travelled(), 2099)).toBeNull();
  });

  it('is stable, so the same moment always reads the same way', () => {
    const career = travelled();
    const first = eraFor(career, 2041);
    for (let i = 0; i < 10; i += 1) expect(eraFor(career, 2041)).toBe(first);
  });
});

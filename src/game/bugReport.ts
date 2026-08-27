/**
 * Reproducible bug reports (v0.4.1 Phase 19).
 *
 * Every coherence bug in this project so far was reported as a sentence — "it said מחלקת ילדים
 * after I got promoted" — and then took a diagnostic script to locate. The information needed to
 * reproduce one is all in the Career; it just was not reachable from the game.
 *
 * This builds a structured snapshot a tester can paste into an issue. Deliberately in the engine
 * rather than the debug component, so it can also be called from a test or a script, and so the
 * fields stay right when the model changes.
 *
 * Hidden attributes are included: this is a developer tool behind the debug panel, not something
 * shown during play, and leaving out potential would make half the reports unactionable.
 */

import { getClub } from '../data/clubs';
import { formatDateOfBirth } from './calendar';
import { currentTeamDisplay, teamUnitOf } from './identity';
import { maccabiRelationship, maccabiStandingScore } from './maccabiEngine';
import { expectedRoleAt } from './marketEngine';
import { seniorPhase } from './memory';
import { naturalStageFor } from './cohort';
import { leagueOf, lastMaccabiSeason } from './worldEngine';
import type { Career } from '../types';

export interface BugReport {
  version: string;
  seed: number;
  rngState: number;
  season: number;
  seasonPoint: string;
  seasonSlot: string;
  dateOfBirth: string;
  age: number;
  position: string;
  naturalStage: string;
  currentStage: string;
  teamUnit: string;
  teamDisplay: string;
  currentClub: string;
  parentClub: string | null;
  league: string;
  expectedRole: string;
  actualRole: string;
  ability: number;
  potential: number;
  coachTrust: number;
  maccabism: number;
  maccabiRelationship: string;
  maccabiStanding: number;
  maccabiLeague: string;
  maccabiLastSeason: string | null;
  event: {
    id: string;
    title: string;
    choiceId: string;
    choiceLabel: string;
    outcomeId: string;
    odds: string[];
  } | null;
  activeArcs: string[];
  recentMemories: string[];
  flags: string[];
}

const VERSION = 'v0.4.1';

/** A structured snapshot of everything needed to reproduce what the tester just saw. */
export function buildBugReport(career: Career): BugReport {
  const result = career.lastEventResult;
  const club = getClub(career.currentClubId);
  const maccabiSeason = lastMaccabiSeason(career);

  return {
    version: VERSION,
    seed: career.seed,
    // The RNG state is what makes the *next* draw reproducible, not just the career so far.
    rngState: career.rngState,
    season: career.currentSeason,
    seasonPoint: career.seasonPoint,
    seasonSlot: career.seasonSlot,
    dateOfBirth: formatDateOfBirth(career.dateOfBirth),
    age: career.age,
    position: career.position,
    naturalStage: naturalStageFor(career.dateOfBirth.year, career.currentSeason),
    currentStage: career.academyStage,
    teamUnit: teamUnitOf(career),
    teamDisplay: currentTeamDisplay(career).full,
    currentClub: career.currentClubId,
    parentClub: career.parentClubId,
    league: leagueOf(career.world, career.currentClubId).id,
    expectedRole: expectedRoleAt(career, club, career.currentSeason),
    actualRole: career.role,
    ability: Math.round(career.ability),
    potential: Math.round(career.hidden.potential),
    coachTrust: Math.round(career.coachTrust),
    maccabism: Math.round(career.maccabism),
    maccabiRelationship: maccabiRelationship(career),
    maccabiStanding: Math.round(maccabiStandingScore(career)),
    maccabiLeague: leagueOf(career.world, 'maccabi_haifa').id,
    maccabiLastSeason: maccabiSeason ? `${maccabiSeason.season} ${maccabiSeason.outcome}` : null,
    event: result
      ? {
          id: result.eventId,
          title: result.eventTitle,
          choiceId: result.choiceId,
          choiceLabel: result.choiceLabel,
          outcomeId: result.outcomeId,
          // The odds the player was actually looking at, which is the point of the whole system.
          odds: (result.odds ?? []).map((o) => `${o.id}=${o.percent}%`),
        }
      : null,
    activeArcs: career.arcs.map((arc) => `${arc.id}@${arc.stage}:${arc.branch}`),
    // Enough for context without pasting a whole career.
    recentMemories: career.memories.slice(-8).map((m) => `${m.season}:${m.kind}`),
    flags: [...career.flags],
  };
}

/** The report as text, ready to paste into an issue. */
export function formatBugReport(career: Career, note = ''): string {
  const report = buildBugReport(career);
  const lines = [
    `MACCABIST ${report.version} — דיווח על אירוע לא הגיוני`,
    note ? `\nהערה: ${note}` : '',
    '',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
  ];
  return lines.filter((line) => line !== '').join('\n');
}

/** Also exposed for the senior-phase context, which is derived rather than stored. */
export function bugReportPhase(career: Career): string {
  return seniorPhase(career);
}

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
import { EVENTS_BY_ID } from '../data/events';
import { naturalStageFor } from './cohort';
import { currentLeagueContext, maccabiLeagueContext } from './leagueEngine';
import { matchContext } from './matchEngine';
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
  /**
   * The live world (v0.4.6).
   *
   * A tester reporting "I got a title event and we were eleventh" needs to be able to show the
   * table state the event was judged against. Without it the report says what happened and not
   * why it was allowed to.
   */
  world: {
    leaguePosition: number | null;
    leagueSize: number | null;
    points: number | null;
    played: number | null;
    titleRace: boolean;
    europeRace: boolean;
    relegationBattle: boolean;
    promotionRace: boolean;
    midTable: boolean;
    finalProjection: string | null;
    maccabiPosition: number | null;
  };
  /** The fixture the event is about, when there is one. */
  match: {
    opponent: string;
    opponentPosition: number | null;
    rivalryType: string | null;
    isDerby: boolean;
    importance: string;
    titleDecider: boolean;
    relegationSixPointer: boolean;
    promotionDecider: boolean;
    vsMaccabi: boolean;
  } | null;
  event: {
    id: string;
    title: string;
    /** Which world/match conditions the event declared, so eligibility can be checked by eye. */
    eligibilityPredicates: string[];
    choiceId: string;
    choiceLabel: string;
    outcomeId: string;
    odds: string[];
  } | null;
  activeArcs: string[];
  recentMemories: string[];
  flags: string[];
}

const VERSION = 'v0.4.6';

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
    world: worldSnapshot(career),
    match: matchSnapshot(career),
    maccabiLastSeason: maccabiSeason ? `${maccabiSeason.season} ${maccabiSeason.outcome}` : null,
    event: result
      ? {
          id: result.eventId,
          title: result.eventTitle,
          eligibilityPredicates: declaredPredicates(result.eventId),
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

/* ------------------------------------------------------------------ */
/* The live world (v0.4.6)                                             */
/* ------------------------------------------------------------------ */

/**
 * The table state an event was judged against.
 *
 * "I got a title event and we were eleventh" is only actionable if the report can show what the
 * table said at the time. Without this the report records what happened and not why it was
 * allowed to happen, which is the harder half of a bug.
 */
function worldSnapshot(career: Career): BugReport['world'] {
  const context = currentLeagueContext(career);
  const maccabi = maccabiLeagueContext(career);
  const projection = career.world.projection;

  return {
    leaguePosition: context?.position ?? null,
    leagueSize: context?.leagueSize ?? null,
    points: context?.points ?? null,
    played: context?.played ?? null,
    titleRace: context?.titleRace ?? false,
    europeRace: context?.europeRace ?? false,
    relegationBattle: context?.relegationBattle ?? false,
    promotionRace: context?.promotionRace ?? false,
    midTable: context?.midTable ?? false,
    /*
     * Where the season is already committed to end. This is the single most useful line for
     * checking a "how was that event allowed?" report, because it is what the late-slot gating
     * was decided against months before the event fired.
     */
    finalProjection: projection
      ? `${projection.finalOutcome} (${projection.finalPosition}/${projection.leagueSize})`
      : null,
    maccabiPosition: maccabi?.position ?? null,
  };
}

function matchSnapshot(career: Career): BugReport['match'] {
  const match = matchContext(career);
  if (!match) return null;
  return {
    opponent: match.opponentName,
    opponentPosition: match.opponentPosition,
    rivalryType: match.rivalryType,
    isDerby: match.isDerby,
    importance: match.importance,
    titleDecider: match.titleDecider,
    relegationSixPointer: match.relegationSixPointer,
    promotionDecider: match.promotionDecider,
    vsMaccabi: match.vsMaccabi,
  };
}

/**
 * Which world and match conditions this event declared.
 *
 * The "why was this eligible?" half of Phase 10. Listing the predicates the event itself asked
 * for, next to the world snapshot above, lets a tester check the two against each other without
 * reading the source.
 */
function declaredPredicates(eventId: string): string[] {
  const conditions = EVENTS_BY_ID[eventId]?.conditions;
  if (!conditions) return [];

  const keys: Array<keyof typeof conditions> = [
    'titleRace',
    'europeRace',
    'relegationBattle',
    'promotionRace',
    'midTable',
    'championClinched',
    'relegationConfirmed',
    'clubOverperforming',
    'clubUnderperforming',
    'minLeaguePosition',
    'maxLeaguePosition',
    'requiresLeagueTable',
    'requiresDerby',
    'rivalryTypes',
    'matchImportance',
    'titleDecider',
    'relegationSixPointer',
    'promotionDecider',
    'vsMaccabi',
    'vsFormerClub',
    'clubScope',
    'atMaccabi',
    'atMaccabiSenior',
    'abroad',
    'onLoan',
  ];

  const out: string[] = [];
  for (const key of keys) {
    const value = conditions[key];
    if (value === undefined) continue;
    out.push(`${key}=${Array.isArray(value) ? value.join('|') : String(value)}`);
  }
  return out;
}

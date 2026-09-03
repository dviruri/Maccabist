/**
 * The typed analytics events (v0.9.6.4).
 *
 * Every payload below is written out field by field. That is the point: a whitelist is what makes
 * "no player-entered name is ever sent" true by construction rather than by review. There is no
 * spread of a `Career` anywhere in this file, and `playerName` is never read.
 *
 * Two firing styles, and the difference is deliberate:
 *
 *   MOMENTS   season_completed, senior_debut, transfer_completed, career_completed
 *             Reported only when observed as a transition from a previous career state. A career
 *             that already had 200 appearances when it loaded did not just make its debut.
 *
 *   STATE     europe_reached
 *             Reported on first observation, deduped per career-season. A campaign becomes
 *             visible at a single preseason beat, and a player who refreshes past that beat would
 *             otherwise never be counted as having reached Europe that year. The cost is that a
 *             career already mid-campaign when analytics arrives reports it once.
 *
 * `career_started` and `career_resumed` belong to neither: they are explicit user actions and are
 * called directly from the two places in `useGame` that perform them.
 */

import { visibleEuropeanCampaign } from '../game/europePresentation';
import { isInAcademy } from '../game/rules';
import type { Career, SeasonRecord } from '../types';
import { alreadySent, emit, sessionId } from './analytics';

/* ------------------------------------------------------------------ */
/* Career lifecycle                                                    */
/* ------------------------------------------------------------------ */

/**
 * THE metric. Fires once, from the single action that creates and commits a new career.
 *
 * Not from hydrate, not from load, not from a mount, not from a render - `useGame.startCareer` is
 * the only caller, and it is the only code path in the app that calls `createCareer`. A save
 * written before v0.9.6.4 can therefore never produce one: resuming does not go through here.
 */
export function trackCareerStarted(career: Career): void {
  emit('career_started', `career_started:${career.id}`, {
    position: career.position,
    origin: career.origin,
    starting_stage: career.academyStage,
    start_season: career.startSeason,
  });
}

/**
 * An existing save being actively resumed. NOT the career count.
 *
 * Keyed by browser session as well as career, so re-entering the same career from the welcome
 * screen twice in one sitting reports once, while returning tomorrow reports again.
 */
export function trackCareerResumed(career: Career): void {
  emit('career_resumed', `career_resumed:${career.id}:${sessionId()}`, {
    position: career.position,
    career_age: career.age,
    current_stage: career.academyStage,
    season_number: career.currentSeason,
    retired: career.retired === true,
  });
}

function trackSeasonCompleted(career: Career, record: SeasonRecord): void {
  emit('season_completed', `season_completed:${career.id}:${record.season}`, {
    season_number: record.season,
    career_age: record.age,
    position: career.position,
    club_id: record.clubId,
    team_unit: record.academyStage,
    on_loan: record.onLoan,
    appearances: record.stats.appearances,
    goals: record.stats.goals,
    assists: record.stats.assists,
    clean_sheets: record.stats.cleanSheets,
    won_league: record.trophies.some(
      (trophy) => trophy.id === 'championship' || trophy.id === 'foreign_championship',
    ),
    won_domestic_cup: record.trophies.some(
      (trophy) => trophy.id === 'cup' || trophy.id === 'foreign_cup',
    ),
  });
}

/**
 * The first genuine senior APPEARANCE - not senior age, not joining a senior squad.
 *
 * Uses the game's own canonical milestone predicate (`first_senior_appearance` in
 * game/milestones): out of the academy, and at least one appearance recorded.
 */
function seniorDebutReached(career: Career): boolean {
  return !isInAcademy(career) && career.stats.appearances > 0;
}

function trackSeniorDebut(career: Career): void {
  emit('senior_debut', `senior_debut:${career.id}`, {
    career_age: career.age,
    position: career.position,
    club_id: career.currentClubId,
    season_number: career.currentSeason,
  });
}

function trackTransferCompleted(previous: Career, career: Career): void {
  emit(
    'transfer_completed',
    `transfer_completed:${career.id}:${career.currentSeason}:${previous.currentClubId}:${career.currentClubId}`,
    {
      season_number: career.currentSeason,
      career_age: career.age,
      position: career.position,
      from_club_id: previous.currentClubId,
      to_club_id: career.currentClubId,
      move_type: moveType(previous, career),
    },
  );
}

/**
 * Three values, because two would be a lie.
 *
 * A loan is `parentClubId !== null`, so coming BACK from one is also a club change - and
 * labelling that "permanent" would report a transfer that never happened. Still low cardinality;
 * the extra value exists because the data would otherwise be wrong, not for completeness.
 */
function moveType(previous: Career, career: Career): 'permanent' | 'loan' | 'loan_return' {
  if (career.parentClubId !== null) return 'loan';
  if (previous.parentClubId !== null && career.currentClubId === previous.parentClubId) {
    return 'loan_return';
  }
  return 'permanent';
}

/**
 * Reaching Europe, read through the chronology-aware authority rather than the journey's
 * future-complete scalars.
 *
 * `visibleEuropeanCampaign` is the same helper the UI uses (v0.9.6.1 onwards), so analytics
 * cannot report a competition the player has not been told about yet - which `finalCompetition`
 * would have done from the first preseason beat.
 */
function trackEuropeReached(career: Career): void {
  const campaign = visibleEuropeanCampaign(career, career.currentClubId);
  if (!campaign) return;
  emit('europe_reached', `europe_reached:${career.id}:${career.currentSeason}`, {
    season_number: career.currentSeason,
    career_age: career.age,
    club_id: career.currentClubId,
    competition: campaign.competition,
    entry_stage: campaign.inLeaguePhase ? 'league_phase' : 'qualifying',
  });
}

function trackCareerCompleted(career: Career): void {
  const trophies = career.trophies ?? [];
  emit('career_completed', `career_completed:${career.id}`, {
    position: career.position,
    retirement_age: career.age,
    senior_seasons: career.seasonHistory.filter((record) => record.academyStage === 'senior').length,
    appearances: career.stats.appearances,
    goals: career.stats.goals,
    assists: career.stats.assists,
    clean_sheets: career.stats.cleanSheets,
    league_titles: trophies.filter(
      (trophy) => trophy.id === 'championship' || trophy.id === 'foreign_championship',
    ).length,
    domestic_cups: trophies.filter((trophy) => trophy.id === 'cup' || trophy.id === 'foreign_cup')
      .length,
    european_trophies: trophies.filter((trophy) => trophy.id.startsWith('uefa_')).length,
    legend_score: career.legend ? Math.round(career.legend.score) : 0,
    final_club_id: career.currentClubId,
  });
}

/* ------------------------------------------------------------------ */
/* The observer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Compares two consecutive career states and reports whatever genuinely happened between them.
 *
 * Called from one effect in `useGame`, which is downstream of every gameplay action - so this sees
 * each transition once, wherever in the engine it came from, and no screen has to remember to
 * report anything.
 *
 * `previous === null` is the baseline: the first career state of a session, whether freshly
 * created or loaded from disk. Nothing transitioned into being, so no moment is reported. This is
 * what stops a loaded save re-reporting a debut it made eight seasons ago.
 *
 * Pure with respect to the game: it reads `Career` and returns nothing. No mutation, no RNG.
 */
export function reportCareerProgress(previous: Career | null, career: Career): void {
  try {
    /* A different career means a switch, not a transition. Treat it as a fresh baseline. */
    if (previous && previous.id !== career.id) return;

    if (previous) {
      for (const record of career.seasonHistory.slice(previous.seasonHistory.length)) {
        trackSeasonCompleted(career, record);
      }
      if (!seniorDebutReached(previous) && seniorDebutReached(career)) {
        trackSeniorDebut(career);
      }
      if (previous.currentClubId !== career.currentClubId) {
        trackTransferCompleted(previous, career);
      }
      if (!previous.retired && career.retired) {
        trackCareerCompleted(career);
      }
    }

    /* State-based - see the note at the top of this file. */
    if (!alreadySent(`europe_reached:${career.id}:${career.currentSeason}`)) {
      trackEuropeReached(career);
    }
  } catch {
    /* A reporting bug must never surface as a gameplay bug. */
  }
}

import { LEAGUE_PHASE, QUALIFYING_GRAPH, UEFA_COMPETITIONS } from '../data/uefa';
import type { Career, UefaCompetitionId } from '../types';

/**
 * Two different European facts, kept apart (v0.9.1, Phase 3).
 *
 * ## The bug
 *
 * Playtesting saw a club actually playing in the Conference League while the UI announced
 * "Champions League - direct league phase". Two causes, both from treating one field as an
 * answer to two questions:
 *
 *   1. `europe.current.entries` holds where a club STARTED the season. A club that entered the
 *      Champions League qualifiers and dropped to the Conference League still has a
 *      `uefa_champions_league` entry - it is history, not its current campaign.
 *   2. `europe.nextEntries` holds NEXT season's earned route, and the UI fell back to it when a
 *      current entry was missing, presenting a future qualification as a present fact.
 *
 * ## The separation
 *
 *   `currentCampaign`  - what the club is playing RIGHT NOW. For a club whose journey the world
 *                        records (the player's club, Maccabi) this is the journey's
 *                        `finalCompetition`, which drop-downs update - so a club that fell to
 *                        the Conference League reads Conference League. For any other club only
 *                        the entry is known, and the answer says so rather than guessing.
 *
 *   `nextSeasonRoute`  - the route earned for NEXT season, from the v0.8 resolver's own
 *                        `nextEntries`. Never rendered as a present fact, always labelled
 *                        "בעונה הבאה".
 *
 * Neither function re-derives UEFA allocation: both read what the v0.8 engine already decided.
 */

export interface EuropeanStatus {
  competition: UefaCompetitionId;
  competitionName: string;
  /** Hebrew phrase for where in the competition this is - qualifying round or league phase. */
  stage: string;
  /** True only when this is the league phase proper, not a qualifying route. */
  inLeaguePhase: boolean;
  /**
   * How confident this is. `campaign` means the club's live journey said so; `entry` means only
   * its starting route is known (a club the world does not record a journey for) - the UI must
   * phrase those differently, because a starting route is not a current campaign.
   */
  certainty: 'campaign' | 'entry';
}

function stageOf(entry: string): { stage: string; inLeaguePhase: boolean } {
  if (entry === LEAGUE_PHASE) return { stage: 'שלב הליגה', inLeaguePhase: true };
  const node = QUALIFYING_GRAPH[entry];
  return { stage: node ? node.label : 'מוקדמות', inLeaguePhase: false };
}

/**
 * What this club is playing in Europe THIS season, or null if it is not in Europe at all.
 *
 * The player's own club and Maccabi have recorded journeys, so their answer is the live one,
 * drop-downs included. Everyone else is reported at `entry` certainty.
 */
export function currentCampaign(career: Career, clubId: string): EuropeanStatus | null {
  const europe = career.world.europe;
  const current = europe?.current;
  if (!current || current.season !== career.currentSeason) return null;

  /* A recorded journey is the truth - it follows every drop-down. */
  for (const journey of [current.playerJourney, current.maccabiJourney]) {
    if (journey && journey.clubId === clubId) {
      return {
        competition: journey.finalCompetition,
        competitionName: UEFA_COMPETITIONS[journey.finalCompetition].name,
        stage: journey.reachedLeaguePhase ? 'שלב הליגה' : 'מוקדמות',
        inLeaguePhase: journey.reachedLeaguePhase,
        certainty: 'campaign',
      };
    }
  }

  /* Otherwise all that is known is where they entered. Reported as exactly that. */
  const entry = current.entries.find((e) => e.clubId === clubId);
  if (!entry) return null;
  const { stage, inLeaguePhase } = stageOf(entry.entry);
  return {
    competition: entry.competition,
    competitionName: UEFA_COMPETITIONS[entry.competition].name,
    stage,
    inLeaguePhase,
    certainty: 'entry',
  };
}

/** The route this club earned for NEXT season, from the v0.8 resolver. Never a present fact. */
export function nextSeasonRoute(career: Career, clubId: string): EuropeanStatus | null {
  const entry = career.world.europe?.nextEntries?.find((e) => e.clubId === clubId);
  if (!entry) return null;
  const { stage, inLeaguePhase } = stageOf(entry.entry);
  return {
    competition: entry.competition,
    competitionName: UEFA_COMPETITIONS[entry.competition].name,
    stage,
    inLeaguePhase,
    certainty: 'entry',
  };
}

/**
 * One line for a club's European standing, correctly qualified in both senses of the word.
 *
 * Current campaign first; if there is none, next season's earned route, explicitly marked as
 * next season. The league-phase distinction is never blurred: a qualifying route says
 * מוקדמות, and only an actual league-phase place says שלב הליגה.
 */
export function europeanStatusLine(career: Career, clubId: string): string | null {
  const now = currentCampaign(career, clubId);
  if (now) {
    return now.inLeaguePhase
      ? `${now.competitionName} — שלב הליגה`
      : `${now.competitionName} — ${now.certainty === 'campaign' ? 'מוקדמות' : now.stage}`;
  }
  const next = nextSeasonRoute(career, clubId);
  if (next) {
    return next.inLeaguePhase
      ? `בעונה הבאה: ${next.competitionName} — שלב הליגה`
      : `בעונה הבאה: ${next.stage}`;
  }
  return null;
}

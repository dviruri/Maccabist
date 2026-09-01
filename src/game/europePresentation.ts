import type { Career, EuropeanJourney, EuropeanStep } from '../types';
import { QUALIFYING_GRAPH } from '../data/uefa';

/**
 * What the player is allowed to KNOW about Europe right now (v0.9.6, Phase 2).
 *
 * ## The problem this exists to solve
 *
 * `simulateEuropeanSeason` runs the entire continental season the moment it begins. That is the
 * right design for a deterministic engine - the whole world moves at once, and a save cannot
 * disagree with itself - but it means `world.europe.current.playerJourney` contains the FINAL
 * league-phase table, the knockout draw, the elimination and the trophy from the first preseason
 * beat onwards.
 *
 * Nothing stopped the UI reading it. The home screen's Europe panel did:
 *
 *     const phase = journey?.steps.find((step) => step.kind === 'league_phase');
 *     const where = phase ? `מקום ${phase.position}` : ...
 *
 * so it printed the club's FINAL European standing before a single European match had been
 * played. Not a display quirk - the player was being shown the end of a story he had not started.
 *
 * ## One authority, not a check per component
 *
 * Chronology is decided here and nowhere else. Three consumers ask this module what may be shown -
 * the home panel, the Europe card, the standings sheet - so they cannot drift apart, and a fourth
 * consumer added later inherits the rule instead of reinventing it.
 *
 * ## The stages, from the career's own model
 *
 * No invented calendar and no fake dates. The game already tracks `seasonPoint`, and the real
 * European calendar maps onto it cleanly: qualifying is played over the summer, the league phase
 * runs through the middle of the season, the knockouts finish it.
 *
 *   preseason   ENTRY       which competition, and where the club enters. Nothing has happened yet.
 *   midseason   QUALIFYING  the summer is history, so the qualifying path is fair game. The league
 *                           phase is UNDER WAY - it has no final table yet, and inventing partial
 *                           standings would be a different lie from the one being removed.
 *   season_end  FULL        the season is settled; the whole journey is the record.
 */

export type EuropeReveal = 'entry' | 'qualifying' | 'full';

/**
 * How much of the European season the player has lived through.
 *
 * Reads `seasonPoint`, which is the game's own model of where in the year a career is. The
 * settlement phases are treated as full regardless, because that is where the season summary and
 * the archive are written and both are records of a completed season.
 */
export function europeReveal(career: Career): EuropeReveal {
  if (career.phase === 'season_result' || career.phase === 'retirement_decision' || career.retired) {
    return 'full';
  }
  switch (career.seasonPoint) {
    case 'preseason':
      return 'entry';
    case 'midseason':
      return 'qualifying';
    case 'season_end':
    default:
      return 'full';
  }
}

/** True when qualifying results may be shown - the summer is behind the player. */
export function mayShowQualifying(career: Career): boolean {
  return europeReveal(career) !== 'entry';
}

/**
 * True when the league-phase TABLE may be shown.
 *
 * Only at full reveal. There is no partial-standings state in the engine, so anything earlier
 * would either expose the final table or require inventing a halfway one - and a made-up table is
 * not an improvement on a premature real one.
 */
export function mayShowLeaguePhaseTable(career: Career): boolean {
  return europeReveal(career) === 'full';
}

/** True when knockout results, eliminations and trophies may be shown. */
export function mayShowKnockouts(career: Career): boolean {
  return europeReveal(career) === 'full';
}

/**
 * The journey, cut down to what the player has actually lived through.
 *
 * Every consumer that renders steps should render THESE, not `journey.steps`. The cut is by step
 * kind rather than by index, because a journey's shape varies - a club can drop competitions
 * twice before reaching a league phase - and counting steps would be guessing.
 */
export function revealedSteps(career: Career, journey: EuropeanJourney): EuropeanStep[] {
  const reveal = europeReveal(career);
  if (reveal === 'full') return journey.steps;

  return journey.steps.filter((step) => {
    switch (step.kind) {
      case 'entered':
        /* Where the club entered is known the moment the draw is made. */
        return true;
      case 'dropped':
        /*
         * A drop-down is the CONSEQUENCE of a qualifying result, so it is known exactly when that
         * result is. At entry reveal it would say the club had already lost a round it has not
         * played.
         */
        return reveal === 'qualifying';
      case 'tie':
        /* Qualifying ties are summer football; knockout ties are the spring and are never early. */
        return reveal === 'qualifying' && step.tie.stage in QUALIFYING_GRAPH;
      case 'bye':
        return reveal === 'qualifying';
      case 'league_phase':
      case 'champion':
        /* The final table and the trophy belong to settlement. */
        return false;
      default:
        return false;
    }
  });
}

/**
 * Where the campaign stands, in one line, honestly for this moment.
 *
 * Returns null when there is nothing truthful to add beyond the competition itself - the caller
 * then shows the entry stage, which is a fact from the draw rather than a result.
 */
export function europeStateLine(career: Career, journey: EuropeanJourney): string | null {
  switch (europeReveal(career)) {
    case 'entry':
      /*
       * Nothing has been played. Deliberately silent about how it goes - the club's own entry
       * route is the caller's business and is not a result.
       */
      return null;
    case 'qualifying':
      /*
       * Qualifying is decided; the league phase is not. "בעיצומו" is the honest word for a
       * competition in progress whose table the game cannot partially compute.
       */
      return journey.reachedLeaguePhase ? 'העפלנו לשלב הליגה — שלב הליגה בעיצומו' : null;
    case 'full':
    default:
      return null;
  }
}

/**
 * The furthest stage that may be NAMED right now.
 *
 * `journey.furthest` is the end of the whole season, so quoting it early tells the player how far
 * he is going to get. At entry reveal there is no progress to report at all; at qualifying reveal
 * the honest ceiling is the league phase, which he has genuinely reached.
 */
export function revealedFurthest(career: Career, journey: EuropeanJourney): string | null {
  switch (europeReveal(career)) {
    case 'entry':
      return null;
    case 'qualifying':
      return journey.reachedLeaguePhase ? 'league_phase' : journey.furthest;
    case 'full':
    default:
      return journey.furthest;
  }
}

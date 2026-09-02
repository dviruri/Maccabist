import type { Career, EuropeanJourney, EuropeanStep, UefaCompetitionId } from '../types';
import { LEAGUE_PHASE, QUALIFYING_GRAPH, UEFA_COMPETITIONS } from '../data/uefa';

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

/* ------------------------------------------------------------------ */
/* What competition is he in RIGHT NOW                                 */
/* ------------------------------------------------------------------ */

/**
 * The competition and stage the player is allowed to believe he is in at this moment.
 *
 * `eliminated` means the revealed path ended in a qualifying defeat with no drop-down: the
 * campaign is over and there is no current competition to name. The competition field then holds
 * the last one he was actually in, which is what "we went out of the Europa League" needs.
 */
export interface VisibleEuropeanCampaign {
  competition: UefaCompetitionId;
  competitionName: string;
  /** Hebrew phrase for where in the competition this is. */
  stage: string;
  /** True only in the league phase proper, never a qualifying route. */
  inLeaguePhase: boolean;
  /** The revealed path ended in a defeat with nowhere to drop to. */
  eliminated: boolean;
  reveal: EuropeReveal;
}

function stageLabel(node: string): { stage: string; inLeaguePhase: boolean } {
  if (node === LEAGUE_PHASE) return { stage: 'שלב הליגה', inLeaguePhase: true };
  return { stage: QUALIFYING_GRAPH[node]?.label ?? 'מוקדמות', inLeaguePhase: false };
}

/**
 * THE answer to "which European competition am I in", for every player-facing current-season
 * surface (v0.9.6.1).
 *
 * ## Why filtering `journey.steps` was not enough
 *
 * v0.9.6 stopped components rendering future STEPS. But the journey carries future-complete
 * SCALARS too - `finalCompetition`, `reachedLeaguePhase`, `furthest`, `wonCompetition` - and those
 * describe the END of a season the engine simulated in advance. They were never gated.
 *
 * So `currentCampaign` read `finalCompetition` and `reachedLeaguePhase`, and at PRESEASON a club
 * that had entered the Champions League and would eventually fall to the Conference already
 * reported "הקונפרנס ליג / שלב הליגה". Reproduced before the fix: the same Europe card printed
 * "הקונפרנס ליג" in its header and "נכנסנו למוקדמות ליגת האלופות" three lines below it.
 *
 * ## How this answers instead
 *
 * It REPLAYS the revealed path. Nothing is read off a scalar; the competition is wherever the
 * revealed steps have carried the club, using the same `QUALIFYING_GRAPH` the engine walks:
 *
 *   entered  start here, in this competition
 *   tie      won -> `winTo` (another round, or the league phase). Lost -> await a drop.
 *   bye      -> `advanceTo`
 *   dropped  a new competition, and a new node inside it
 *
 * A lost tie with no drop after it is elimination, and no current competition is invented.
 *
 * At FULL reveal every step is revealed, so the walk naturally lands on the same place
 * `finalCompetition` would have - derived rather than asserted, which is the point.
 */
export function visibleEuropeanCampaign(
  career: Career,
  clubId: string,
): VisibleEuropeanCampaign | null {
  const current = career.world.europe?.current;
  if (!current || current.season !== career.currentSeason) return null;

  const journey = [current.playerJourney, current.maccabiJourney].find(
    (candidate) => candidate && candidate.clubId === clubId,
  );
  const reveal = europeReveal(career);

  if (!journey) {
    /*
     * No recorded journey - a club the world does not watch. All that is known is where it
     * entered, which is a fact from the draw and safe at any reveal.
     */
    const entry = current.entries.find((e) => e.clubId === clubId);
    if (!entry) return null;
    const { stage, inLeaguePhase } = stageLabel(entry.entry);
    return {
      competition: entry.competition,
      competitionName: UEFA_COMPETITIONS[entry.competition].name,
      stage,
      inLeaguePhase,
      eliminated: false,
      reveal,
    };
  }

  let competition: UefaCompetitionId | null = null;
  let node: string | null = null;
  let eliminated = false;

  for (const step of revealedSteps(career, journey)) {
    switch (step.kind) {
      case 'entered':
        competition = step.competition;
        node = step.entry;
        eliminated = false;
        break;
      case 'tie': {
        const graphNode = QUALIFYING_GRAPH[step.tie.stage];
        /* A knockout tie is past qualifying; the competition does not change there. */
        if (!graphNode) break;
        competition = step.tie.competition;
        if (step.tie.won) {
          node = graphNode.winTo;
          eliminated = false;
        } else {
          /*
           * Out of this round. Whether that ends the campaign depends on whether a `dropped`
           * step follows - which the next iteration will say. Marked eliminated for now so a
           * defeat that is the LAST revealed step reads as one.
           */
          eliminated = true;
        }
        break;
      }
      case 'bye':
        competition = step.competition;
        node = step.advanceTo;
        eliminated = false;
        break;
      case 'dropped':
        competition = step.to;
        node = step.toEntry;
        eliminated = false;
        break;
      case 'league_phase':
        competition = step.competition;
        node = LEAGUE_PHASE;
        eliminated = false;
        break;
      default:
        break;
    }
  }

  if (!competition) return null;
  const { stage, inLeaguePhase } = stageLabel(node ?? '');
  return {
    competition,
    competitionName: UEFA_COMPETITIONS[competition].name,
    stage,
    inLeaguePhase: inLeaguePhase && !eliminated,
    eliminated,
    reveal,
  };
}

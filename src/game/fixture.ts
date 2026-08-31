import { QUALIFYING_GRAPH, UEFA_COMPETITIONS } from '../data/uefa';
import { clubDisplayName } from './identity';
import { currentPhase, currentTable } from './leagueEngine';
import { matchContext } from './matchEngine';
import { levelContext } from './rules';
import type { Career, EuropeanStep, MatchContext, UefaCompetitionId } from '../types';

/**
 * THE presentation fixture (v0.9.1, Phase 1).
 *
 * ## The bug this exists to make impossible
 *
 * v0.9 let two screens answer the same question independently: the career home derived a "next
 * match" from the nearest table rival, while the matchday derived its opponent from
 * `matchContext`. Both were deterministic and both were reasonable - and they disagreed, so
 * playtesting saw Maccabi Netanya on the home screen and Maccabi Tel Aviv after kickoff. That is
 * the same class of defect this codebase has been removing since v0.4.8: two systems answering
 * one question, with the disagreement shown to the player.
 *
 * From here there is ONE answer. Every presentation surface - home hero, scoreboard, crests,
 * timeline, summary - reads `activeFixture(career)`. Nothing derives an opponent itself.
 *
 * ## Why this is not a fixture engine
 *
 * Maccabist simulates seasons, not calendars, and v0.9.1 is not the release that changes that.
 * A fixture here is the current BEAT's match: one deterministic pairing derived from state that
 * already exists (the projection's table seed and the season phase, via `matchContext`), stable
 * for as long as the beat is, and replaced when the beat advances. No fixture list is invented.
 *
 * ## Priority: stored competitions always win
 *
 * A cup final and a European tie are real stored facts with real named opponents. They outrank
 * the generic league beat, because presenting a generic league opponent while the engine holds
 * a committed cup final would be the same lie in a different costume.
 *
 * Between the two stored kinds the order is: cup final, then European tie. Both are true, so
 * the ordering is a presentation choice rather than a correctness one - the final is a single
 * match that decides a trophy this season, and it is the rarer state to be in. It is fixed and
 * documented here so it cannot drift into being decided differently by two screens.
 */

export type FixtureKind = 'league' | 'cup_final' | 'european';

export interface PresentationFixture {
  /** Stable identity for this beat's match - the reveal/dedupe key every screen shares. */
  id: string;
  kind: FixtureKind;
  season: number;
  /** Hebrew competition label for headers. */
  competition: string;
  competitionId?: UefaCompetitionId;
  playerClubId: string;
  playerClubName: string;
  opponentClubId: string;
  opponentName: string;
  home: boolean;
  homeClubId: string;
  awayClubId: string;
  /** Round or stage label where one exists (cup final, European stage). */
  stage?: string;
  /** The league match context, when this beat is a league match - carries table facts. */
  context: MatchContext | null;
  /** The player club's own table position when known - the other half of "מקום 1 נגד מקום 2". */
  playerPosition: number | null;
  /** Opponent's table position when known. */
  opponentPosition: number | null;
  /** Points between the clubs when both are in the same table. */
  pointsGap: number | null;
}

/**
 * The current beat's fixture, or null when there is nothing to present (academy football with
 * no table, a settled season, a career with no projection).
 *
 * Deterministic in the career: the same career state always yields the same fixture, which is
 * exactly what makes the home/matchday invariant testable.
 */
export function activeFixture(career: Career): PresentationFixture | null {
  const playerClubId = career.currentClubId;
  const playerClubName = clubDisplayName(playerClubId);
  const season = career.currentSeason;

  const build = (
    partial: Omit<PresentationFixture, 'playerClubId' | 'playerClubName' | 'season' | 'homeClubId' | 'awayClubId'>,
  ): PresentationFixture => ({
    ...partial,
    season,
    playerClubId,
    playerClubName,
    homeClubId: partial.home ? playerClubId : partial.opponentClubId,
    awayClubId: partial.home ? partial.opponentClubId : playerClubId,
  });

  /* ---- 1. A committed cup final: a real stored opponent ---- */
  const cup = career.world.cup;
  if (
    cup &&
    cup.season === season &&
    cup.finalOpponentId &&
    (cup.run === 'winners' || cup.run === 'runner_up') &&
    career.seasonPoint !== 'season_end'
  ) {
    return build({
      id: `cup_final_${season}`,
      kind: 'cup_final',
      competition: cup.trophyId === 'youth_cup' ? 'גביע הנוער' : 'גביע המדינה',
      opponentClubId: cup.finalOpponentId,
      opponentName: clubDisplayName(cup.finalOpponentId),
      // A final is played at a neutral venue - neither club is at home.
      home: false,
      stage: 'הגמר',
      context: null,
      playerPosition: null,
      opponentPosition: null,
      pointsGap: null,
    });
  }

  /* ---- 2. A European tie from the stored journey ---- */
  const journey = career.world.europe?.current?.playerJourney;
  if (journey && journey.season === season && journey.clubId === playerClubId && career.seasonPoint !== 'season_end') {
    const knockout = journey.steps.find(
      (step): step is Extract<EuropeanStep, { kind: 'tie' }> =>
        step.kind === 'tie' && !(step.tie.stage in QUALIFYING_GRAPH),
    );
    if (knockout) {
      return build({
        id: `euro_${knockout.tie.competition}_${knockout.tie.stage}_${season}`,
        kind: 'european',
        competition: UEFA_COMPETITIONS[knockout.tie.competition].name,
        competitionId: knockout.tie.competition,
        opponentClubId: knockout.tie.opponentId,
        opponentName: knockout.tie.opponentName,
        home: knockout.tie.legs[0]?.home ?? true,
        stage: EURO_STAGE_LABELS[knockout.tie.stage] ?? undefined,
        context: null,
        playerPosition: null,
        opponentPosition: null,
        pointsGap: null,
      });
    }
  }

  /* ---- 3. The league beat ---- */
  const context = matchContext(career, currentPhase(career));
  if (!context) return null;
  const table = currentTable(career);
  const playerPosition = table?.rows.find((row) => row.clubId === playerClubId)?.position ?? null;
  return build({
    id: `league_${season}_${currentPhase(career)}_${context.opponentClubId}`,
    kind: 'league',
    competition: context.isDerby && context.rivalryName ? context.rivalryName : levelContext(career).league,
    opponentClubId: context.opponentClubId,
    opponentName: context.opponentName,
    home: context.home,
    context,
    playerPosition,
    opponentPosition: context.opponentPosition,
    pointsGap: context.pointsGap,
  });
}

const EURO_STAGE_LABELS: Record<string, string> = {
  ko_playoff: 'פלייאוף הנוקאאוט',
  r16: 'שמינית הגמר',
  qf: 'רבע הגמר',
  sf: 'חצי הגמר',
  final: 'הגמר',
};

import type { PresentationFixture } from './fixture';
import type { MatchMoment } from './matchdayPresenter';

/**
 * THE match score model (v0.9.3, Phase 1).
 *
 * ## The bug this exists to make impossible
 *
 * Manual playtesting found the matchday scoreboard reading backwards. The cause was structural
 * rather than arithmetic. The board placed the player's club first in the DOM, which in an RTL
 * document puts it on the RIGHT, and then printed the score as a single LTR string:
 *
 *     [ opponent ]        2 : 1        [ player's club ]
 *
 * The digits are laid out left to right, so the one adjacent to the player's club is the SECOND
 * of them - the opponent's goals. Every number was correct and the screen still told a lie,
 * because the pairing of number to club was left to text direction.
 *
 * Football semantics do not depend on a writing system. `homeClubId`, `awayClubId`, `homeScore`
 * and `awayScore` mean exactly one thing; RTL may decide which side of the screen a club is
 * drawn on, and nothing else. So the score is no longer a string at all - it is this model, and
 * the scoreboard component positions each number into the same cell as its own club through
 * explicit grid areas in an explicitly LTR container. Direction cannot reorder it.
 *
 * ## One source
 *
 * Everything that shows a matchday score - the live board, half time, full time, the summary
 * verdict, the timeline tally - derives from this module. There is no second place that pairs a
 * number with a club, which is the only way to keep them from disagreeing again.
 *
 * The engine's own numbers are player-relative (`scoreFor` / `scoreAgainst`), because that is
 * how the presenter derives them from the player's real half. Mapping those onto home/away
 * happens HERE, once, using the fixture's `home` flag.
 */

export interface MatchSide {
  clubId: string;
  clubName: string;
  score: number;
  /** True for the career player's own club - the side the verdict is written from. */
  isPlayerClub: boolean;
}

export interface MatchScoreViewModel {
  /* The four facts, named so they cannot be misread. */
  homeClubId: string;
  homeClubName: string;
  awayClubId: string;
  awayClubName: string;
  homeScore: number;
  awayScore: number;
  /** Which slot the career player's club occupies. */
  playerIsHome: boolean;
  /** The same two facts as sides, for a component that wants to iterate. */
  home: MatchSide;
  away: MatchSide;
}

/** The player's result, always read from the player's own club's side of the model. */
export type MatchVerdict = 'win' | 'draw' | 'loss';

/**
 * Which club a revealed moment scored for.
 *
 * The presenter writes moments from the player's point of view - his goal, his assisted goal, a
 * team goal, a goal conceded - so the mapping is fixed and total. `null` is a moment that does
 * not change the score at all (kickoff, a save, half time), and the exhaustive switch is what
 * makes a future moment kind impossible to forget: adding one without a case is a type error.
 */
export function scoringSide(kind: MatchMoment['kind']): 'player_club' | 'opponent_club' | null {
  switch (kind) {
    case 'player_goal':
    case 'player_assist':
    /*
     * An assist moment IS the assisted goal. It was missing from the v0.9 tally, which is how
     * the scoreboard could sit one goal behind its own timeline.
     */
    case 'team_goal':
      return 'player_club';
    case 'conceded':
      return 'opponent_club';
    case 'kickoff':
    /* Coming off the bench changes the story, never the scoreboard (v0.9.6.6). */
    case 'sub_on':
    case 'chance':
    case 'save':
    case 'big_save':
    case 'booking':
    case 'half_time':
    case 'full_time':
      return null;
    default:
      return null;
  }
}

/**
 * Build the model from the fixture and the player-relative goals.
 *
 * `scoreFor` is always the player's club and `scoreAgainst` always the opposition, whichever
 * end of the fixture they are playing at. The fixture's own `home` flag - the same field the
 * career home screen renders "בבית / בחוץ" from - decides the slots.
 */
export function matchScoreView(
  fixture: PresentationFixture,
  scoreFor: number,
  scoreAgainst: number,
): MatchScoreViewModel {
  const player: MatchSide = {
    clubId: fixture.playerClubId,
    clubName: fixture.playerClubName,
    score: scoreFor,
    isPlayerClub: true,
  };
  const opponent: MatchSide = {
    clubId: fixture.opponentClubId,
    clubName: fixture.opponentName,
    score: scoreAgainst,
    isPlayerClub: false,
  };
  const home = fixture.home ? player : opponent;
  const away = fixture.home ? opponent : player;

  return {
    homeClubId: home.clubId,
    homeClubName: home.clubName,
    awayClubId: away.clubId,
    awayClubName: away.clubName,
    homeScore: home.score,
    awayScore: away.score,
    playerIsHome: fixture.home,
    home,
    away,
  };
}

/**
 * The live model: the score as the story has been told so far, never ahead of it.
 *
 * `revealed` is the number of moments the screen has shown. Counting the goals inside them -
 * rather than easing towards the final score - is what keeps the board equal to the timeline at
 * every single beat, including half time.
 */
export function matchScoreViewAfter(
  fixture: PresentationFixture,
  moments: readonly MatchMoment[],
  revealed: number,
): MatchScoreViewModel {
  let scoreFor = 0;
  let scoreAgainst = 0;
  for (const moment of moments.slice(0, Math.max(0, revealed))) {
    const side = scoringSide(moment.kind);
    if (side === 'player_club') scoreFor += 1;
    if (side === 'opponent_club') scoreAgainst += 1;
  }
  return matchScoreView(fixture, scoreFor, scoreAgainst);
}

/** The player's own verdict. Read from his club's side, so home/away cannot invert it. */
export function matchVerdict(view: MatchScoreViewModel): MatchVerdict {
  const mine = view.playerIsHome ? view.homeScore : view.awayScore;
  const theirs = view.playerIsHome ? view.awayScore : view.homeScore;
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'loss';
  return 'draw';
}

const VERDICT_LABELS: Record<MatchVerdict, string> = {
  win: 'ניצחון',
  draw: 'תיקו',
  loss: 'הפסד',
};

export function verdictLabel(view: MatchScoreViewModel): string {
  return VERDICT_LABELS[matchVerdict(view)];
}

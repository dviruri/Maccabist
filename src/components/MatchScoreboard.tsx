import type { MatchScoreViewModel } from '../game/matchScore';
import { ClubCrest } from './ClubCrest';

/**
 * THE scoreboard (v0.9.3, Phase 1).
 *
 * The only place in the game that draws a match score. Every matchday state - preview, live,
 * half time, full time - renders this component from the one `MatchScoreViewModel`, so a number
 * cannot end up beside the wrong club in one state and the right one in another.
 *
 * ## Why this is a grid with named areas rather than a flex row and a string
 *
 * The v0.9 board was `[club] [score string] [club]` in a flex row, inheriting the document's
 * RTL direction. That made the visual order a consequence of text direction, and the score
 * itself a single LTR run - so the digit drawn next to the player's club was the OPPONENT's.
 *
 * Here the container is explicitly `direction: ltr` and every cell names its own grid area:
 *
 *     away  awayScore  :  homeScore  home
 *
 * Away on the left, home on the right - the Hebrew convention of the home club leading from the
 * right - with each number in the cell touching its own club. The layout does not consult
 * direction, so RTL cannot invert it. Club NAMES are RTL, because they are Hebrew text; the
 * scoreboard's geometry is not.
 *
 * DOM order is home-first, which is how a football result is spoken and read aloud, while the
 * grid areas decide where each cell is drawn. The two are independent on purpose.
 */
export function MatchScoreboard({
  view,
  statusLabel,
  caption,
}: {
  view: MatchScoreViewModel;
  /** Minute, 'מחצית', 'סיום' - the match's clock state, above the score. */
  statusLabel?: string;
  /** One quiet line under the board: venue, stage, table position. */
  caption?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="gf-board">
      {statusLabel && <div className="gf-board-status">{statusLabel}</div>}

      {/* home first in reading order; `grid-area` puts it on the right */}
      <div className={`gf-board-club gf-board-home${view.home.isPlayerClub ? ' gf-board-mine' : ''}`}>
        <ClubCrest clubId={view.homeClubId} name={view.homeClubName} size="large" />
        <span className="gf-board-name">{view.homeClubName}</span>
        <span className="gf-board-venue">בית</span>
      </div>
      {/* keyed on the score so a goal retriggers the pulse once, rather than looping */}
      <div className="gf-board-num gf-board-num-home" key={`h${view.homeScore}`}>
        {view.homeScore}
      </div>
      <div className="gf-board-sep" aria-hidden>
        :
      </div>
      <div className="gf-board-num gf-board-num-away" key={`a${view.awayScore}`}>
        {view.awayScore}
      </div>
      <div className={`gf-board-club gf-board-away${view.away.isPlayerClub ? ' gf-board-mine' : ''}`}>
        <ClubCrest clubId={view.awayClubId} name={view.awayClubName} size="large" />
        <span className="gf-board-name">{view.awayClubName}</span>
        <span className="gf-board-venue">חוץ</span>
      </div>

      {/*
        The result in words, for a screen reader - which reads DOM order and would otherwise get
        "2" and "1" as bare cells with no idea which club each belongs to.
      */}
      <span className="sr-only">
        {`${view.homeClubName} ${view.homeScore} - ${view.awayClubName} ${view.awayScore}`}
      </span>

      {caption && <div className="gf-board-caption">{caption}</div>}
    </div>
  );
}

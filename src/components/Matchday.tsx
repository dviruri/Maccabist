import { useState } from 'react';

import { matchScoreViewAfter, matchVerdict, verdictLabel } from '../game/matchScore';
import type { MatchMoment, MatchdayPresentation } from '../game/matchdayPresenter';
import type { Career } from '../types';
import { MatchScoreboard } from './MatchScoreboard';
import { PlayerRender } from './PlayerRender';
import { CinematicBackdrop, GameButton } from './gamefeel';
import { Ltr } from './primitives';

/**
 * יום המשחק (v0.9, Phase 3 · rebuilt as a state machine in v0.9.3, Phase 3).
 *
 * The match is already decided - the presenter derived it from the half the engine really
 * simulated - so what unfolds here is the TELLING. "המשך" costs nothing, "לסיום" reveals
 * everything at once, and nothing in this component touches career state: its only outward act
 * is the onContinue at full time.
 *
 * ## v0.9.3: one state at a time
 *
 * v0.9.1 gave the matchday its own screen and v0.9.2 gave it a dominant scoreboard, but it still
 * behaved like a page: every revealed moment stayed stacked on screen, so by full time the
 * verdict sat under a growing list and the player scrolled to find the button. A match is not a
 * document of a match.
 *
 * So there are now four explicit states, and exactly one of them is on screen:
 *
 *     PREVIEW  →  LIVE  ⇄  HALF TIME  →  FULL TIME
 *
 * The state is DERIVED from how much has been revealed rather than stored, so it cannot drift
 * out of step with the story: the moment at the head of the reveal decides it. Earlier moments
 * are not deleted - they move behind "מה קרה במשחק", which is a list and is allowed to scroll
 * because it is data rather than the game.
 *
 * The player art is now one atmospheric layer behind all four states instead of a section that
 * only the preview had. Score truth on screen is unchanged: a goal is not on the scoreboard
 * until its moment has been revealed, so the board always equals the story so far - and since
 * v0.9.3 the board is `MatchScoreboard`, the only thing in the game that draws a score.
 */

const MOMENT_ICONS: Record<MatchMoment['kind'], string> = {
  kickoff: '⏱️',
  chance: '⚡',
  player_goal: '⚽',
  player_assist: '🎯',
  team_goal: '⚽',
  conceded: '🥅',
  save: '🧤',
  big_save: '🧤',
  booking: '🟨',
  half_time: '⏸️',
  full_time: '🏁',
};

type MatchdayState = 'preview' | 'live' | 'half_time' | 'full_time';

export function MatchdayExperience({
  career,
  matchday,
  onContinue,
  autoReveal = false,
  revealTo,
}: {
  career: Career;
  /** THE fixture's matchday, built by the caller so the screen and the router agree. */
  matchday: MatchdayPresentation;
  onContinue: () => void;
  /** Preview-only: start at full time, so the gallery can inspect the conclusion. */
  autoReveal?: boolean;
  /** Preview-only: start mid-match, so the gallery can inspect a live state. */
  revealTo?: number;
}): JSX.Element {
  const { fixture, moments } = matchday;
  const total = moments.length;
  const [revealed, setRevealed] = useState(
    autoReveal ? total : revealTo !== undefined ? Math.min(total, revealTo) : 0,
  );
  const [showHistory, setShowHistory] = useState(false);

  const done = revealed >= total;
  const current = revealed > 0 ? moments[revealed - 1]! : null;
  const state: MatchdayState = done
    ? 'full_time'
    : revealed === 0
      ? 'preview'
      : current!.kind === 'half_time'
        ? 'half_time'
        : 'live';

  /*
   * The score, from THE model (v0.9.3). The component no longer counts goals or pairs numbers
   * with clubs - `matchScoreViewAfter` does both, in home/away terms - so this screen and its
   * own summary cannot disagree, and RTL cannot invert either of them.
   */
  const view = matchScoreViewAfter(fixture, moments, revealed);
  const isKeeper = career.position === 'GK';
  /*
   * The pose changes with the state; the KIT never does (v0.9.4). He wears his club's colours at
   * kickoff, at half time and at full time, home or away - a shirt that changed with the venue or
   * with the reading direction would be the same class of lie as a reversed scoreline.
   */
  const context = done && matchday.played ? (isKeeper ? 'save' : 'celebration') : 'hero';

  /*
   * Pacing (v0.9.1): ONE meaningful moment per primary tap - v0.9 advanced two, which made the
   * story feel skipped past. Fast-forward jumps to the next moment that matters (a player
   * moment, a goal, half time) and skip goes to full time, so neither control is meaningless.
   */
  const nextBeat = (): number => {
    for (let i = revealed + 1; i < total; i += 1) {
      const moment = moments[i]!;
      if (moment.big || moment.kind === 'half_time' || moment.kind === 'team_goal' || moment.kind === 'conceded') {
        return i + 1;
      }
    }
    return total;
  };

  const statusLabel =
    state === 'preview'
      ? 'לפני שריקה'
      : state === 'half_time'
        ? 'מחצית'
        : state === 'full_time'
          ? 'סיום'
          : `${current!.minute}'`;

  return (
    <div className="gf-matchday-screen">
      <CinematicBackdrop backdrop="matchday-crowd" className="gf-matchday">
        {/* ---- the fixture, once, at the top ---- */}
        <div className="gf-kicker gf-md-kicker">
          יום המשחק · {matchday.competitionLabel}
          {fixture.stage ? ` · ${fixture.stage}` : ''}
        </div>

        <MatchScoreboard
          view={view}
          statusLabel={statusLabel}
          caption={
            fixture.opponentPosition !== null ? (
              <>
                {'היריבה במקום '}
                <Ltr>{fixture.opponentPosition}</Ltr>
              </>
            ) : undefined
          }
        />

        {/*
          ---- the stage: the player behind, ONE state in front ----

          The art is a depth layer for every state, not a section of its own. It is allowed to sit
          behind the state text, which is why the text carries its own shadow.
        */}
        <div className={`gf-md-stage gf-md-stage-${state}`}>
          <PlayerRender
            className="gf-md-art"
            age={career.age}
            position={career.position}
            clubId={career.currentClubId}
            seed={career.seed}
            season={career.currentSeason}
            context={context}
          />

          {state === 'preview' && (
            <p className="gf-md-status">
              {matchday.played
                ? matchday.started
                  ? 'אתה בהרכב הפותח.'
                  : 'אתה בסגל. תהיה מוכן מהספסל.'
                : 'הפעם מהיציע. המשחק לא מחכה לאף אחד.'}
            </p>
          )}

          {state === 'live' && (
            <div className={`gf-md-now${current!.big ? ' gf-md-now-big' : ''}`} aria-live="polite">
              <div className="gf-md-now-minute">
                <Ltr>{`${current!.minute}'`}</Ltr>
              </div>
              <div className="gf-md-now-icon" aria-hidden>
                {MOMENT_ICONS[current!.kind]}
              </div>
              <div className="gf-md-now-text">{current!.text}</div>
            </div>
          )}

          {state === 'half_time' && (
            <div className="gf-md-now gf-md-now-break" aria-live="polite">
              <div className="gf-md-now-text">מחצית</div>
              <div className="gf-md-now-sub">
                {/*
                  Read through `matchVerdict`, not by comparing homeScore to awayScore. The
                  component has no business pairing a number with a club - that is exactly the
                  reasoning the Phase 1 bug came from, and its own test caught this line.
                */}
                {matchVerdict(view) === 'draw'
                  ? 'שוויון בהפסקה. מחצית שלמה לשנות אותו.'
                  : matchVerdict(view) === 'win'
                    ? 'מובילים בהפסקה. עוד מחצית להחזיק.'
                    : 'מפגרים בהפסקה. יש עוד מחצית שלמה.'}
              </div>
            </div>
          )}

          {state === 'full_time' && (
            <div className="gf-md-ft-block">
              {/* the verdict is read from the player's own side of the model, not from digit order */}
              <div className="gf-md-ft">{verdictLabel(view)}</div>
              <div className="gf-md-ft-sub">
                {fixture.kind === 'cup_final'
                  ? matchVerdict(view) === 'win'
                    ? 'הגביע שלנו.'
                    : 'הגמר אבד.'
                  : `${fixture.competition} · ${fixture.opponentName}`}
              </div>
              <div className="gf-md-facts">
                {/* the anchor to truth: the real numbers this matchday was drawn from */}
                {matchday.factsLine}
              </div>
            </div>
          )}

          {/*
            ---- what already happened ----

            The history the screen used to stack in front of the player. A list, opened on demand
            and scrollable INSIDE itself, so the match never becomes a document of itself.
          */}
          {revealed > 1 && !showHistory && (
            <button type="button" className="gf-md-history-open" onClick={() => setShowHistory(true)}>
              מה קרה במשחק
            </button>
          )}
          {showHistory && (
            <div className="gf-md-history" role="dialog" aria-label="מה קרה במשחק">
              <div className="gf-md-history-list">
                {moments.slice(0, revealed).map((moment, index) => (
                  <div key={index} className={`gf-md-line${moment.big ? ' gf-md-line-big' : ''}`}>
                    <span className="gf-md-line-minute">
                      <Ltr>{`${moment.minute}'`}</Ltr>
                    </span>
                    <span className="gf-md-line-icon" aria-hidden>
                      {MOMENT_ICONS[moment.kind]}
                    </span>
                    <span className="gf-md-line-text">{moment.text}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="gf-md-history-close" onClick={() => setShowHistory(false)}>
                סגור
              </button>
            </div>
          )}
        </div>

        {/*
          ---- controls: one primary, the rest visibly secondary ----

          v0.9.2 gave three buttons equal visual weight, which made none of them the obvious one.
        */}
        <div className="gf-md-controls">
          {state === 'full_time' ? (
            <GameButton onClick={onContinue}>
              {fixture.kind === 'league' ? 'לסיכום המחצית' : 'חזרה לקריירה'}
            </GameButton>
          ) : (
            <>
              <GameButton onClick={() => setRevealed((r) => Math.min(total, r + 1))}>
                {state === 'preview' ? 'שריקת פתיחה' : 'המשך'}
              </GameButton>
              {revealed > 0 && (
                <div className="gf-md-controls-minor">
                  <button type="button" className="gf-md-minor" onClick={() => setRevealed(nextBeat())}>
                    הרגע הבא
                  </button>
                  <button type="button" className="gf-md-minor" onClick={() => setRevealed(total)}>
                    לסיום
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </CinematicBackdrop>
    </div>
  );
}

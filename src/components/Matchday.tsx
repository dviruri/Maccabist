import { useState } from 'react';

import { matchScoreViewAfter, verdictLabel } from '../game/matchScore';
import type { MatchMoment, MatchdayPresentation } from '../game/matchdayPresenter';
import type { Career } from '../types';
import { getCareerPlayerArt } from '../ui/playerArt';
import { MatchScoreboard } from './MatchScoreboard';
import { CinematicBackdrop, GameButton } from './gamefeel';
import { Ltr } from './primitives';

/**
 * יום המשחק (v0.9, Phase 3).
 *
 * The staged reveal of the presenter's matchday: preview → kickoff → moments, one tap at a
 * time → half time → second half → full time → the player's summary. The match is already
 * decided (the presenter derived it from the real half); what unfolds is the TELLING, so
 * "continue" costs nothing and "לדלג" reveals everything at once. Nothing here touches state -
 * the component's only outward act is the onContinue at full time.
 *
 * Score truth on screen: until a goal's moment has been revealed it is not on the scoreboard,
 * so the scoreboard always equals the story so far.
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

export function MatchdayExperience({
  career,
  matchday,
  onContinue,
  autoReveal = false,
}: {
  career: Career;
  /** THE fixture's matchday, built by the caller so the screen and the router agree. */
  matchday: MatchdayPresentation;
  onContinue: () => void;
  /** Preview-only: start at full time, so the gallery can inspect the conclusion. */
  autoReveal?: boolean;
}): JSX.Element {
  const [revealed, setRevealed] = useState(autoReveal ? matchday.moments.length : 0);

  const { fixture, moments } = matchday;
  const total = moments.length;
  const done = revealed >= total;
  const visible = moments.slice(0, revealed);

  /*
   * The score, from THE model (v0.9.3).
   *
   * The component no longer counts goals or pairs numbers with clubs - `matchScoreViewAfter`
   * does both, in home/away terms, so this screen and the summary below it cannot disagree and
   * RTL cannot invert either of them. It still equals the story revealed so far and is never
   * ahead of it, which is what the `revealed` count buys.
   */
  const view = matchScoreViewAfter(fixture, moments, revealed);
  const lastMinute = visible[visible.length - 1]?.minute ?? 0;
  const isKeeper = career.position === 'GK';
  const art = getCareerPlayerArt({
    age: career.age,
    position: career.position,
    context: done && matchday.played ? (isKeeper ? 'save' : 'celebration') : 'hero',
  });

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

  return (
    <div className="gf-matchday-screen">
    <CinematicBackdrop backdrop="matchday-crowd" className="gf-matchday">
      <div className="gf-md-head">
        <div className="gf-kicker">יום המשחק · {matchday.competitionLabel}</div>
        <MatchScoreboard
          view={view}
          statusLabel={revealed === 0 ? 'לפני שריקה' : done ? 'סיום' : `${lastMinute}'`}
          caption={
            /*
              No "בבית / בחוץ" here any more: the board itself now labels each club's end, and
              saying it twice was how the screen used to compensate for a scoreline that did not
              carry the venue.
            */
            <>
              {fixture.stage ?? ''}
              {fixture.opponentPosition !== null && (
                <>
                  {fixture.stage ? ' · ' : ''}
                  {'היריבה במקום '}
                  <Ltr>{fixture.opponentPosition}</Ltr>
                </>
              )}
            </>
          }
        />
      </div>

      {revealed === 0 && (
        <div className="gf-md-preview">
          <img className="gf-md-art" src={art} alt="" aria-hidden />
          <p className="gf-md-status">
            {matchday.played
              ? matchday.started
                ? 'אתה בהרכב הפותח.'
                : 'אתה בסגל. תהיה מוכן מהספסל.'
              : 'הפעם מהיציע. המשחק לא מחכה לאף אחד.'}
          </p>
        </div>
      )}

      {revealed > 0 && (
        <div className="gf-md-timeline" aria-live="polite">
          {visible.map((moment, index) => (
            <div key={index} className={`gf-md-moment${moment.big ? ' gf-md-moment-big' : ''}`}>
              <span className="gf-md-moment-minute">
                <Ltr>{`'${moment.minute}`}</Ltr>
              </span>
              <span className="gf-md-moment-icon" aria-hidden>
                {MOMENT_ICONS[moment.kind]}
              </span>
              <span className="gf-md-moment-text">{moment.text}</span>
            </div>
          ))}
        </div>
      )}

      {done && (
        <>
          {/* v0.9.2: full time is a conclusion - the verdict first, then the numbers. */}
          {/* the verdict is read from the player's own side of the model, not from digit order */}
          <div className="gf-md-ft">{verdictLabel(view)}</div>
          <div className="gf-md-ft-sub">
            {fixture.kind === 'cup_final'
              ? verdictLabel(view) === 'ניצחון'
                ? 'הגביע שלנו.'
                : 'הגמר אבד.'
              : `${fixture.competition} · ${fixture.opponentName}`}
          </div>
          <div className="gf-md-facts">
            {/* the anchor to truth: the real numbers this matchday was drawn from */}
            {matchday.factsLine}
          </div>
        </>
      )}

      <div className="gf-md-controls">
        {!done ? (
          <>
            <GameButton onClick={() => setRevealed((r) => Math.min(total, r + 1))}>
              {revealed === 0 ? 'שריקת פתיחה' : 'המשך'}
            </GameButton>
            {revealed > 0 && (
              <GameButton tone="ghost" onClick={() => setRevealed(nextBeat())}>
                הרגע הבא
              </GameButton>
            )}
            <GameButton tone="ghost" onClick={() => setRevealed(total)}>
              לסיום
            </GameButton>
          </>
        ) : (
          <GameButton onClick={onContinue}>לסיכום המחצית</GameButton>
        )}
      </div>
    </CinematicBackdrop>
    </div>
  );
}

import { useMemo, useState } from 'react';

import { clubDisplayName } from '../game/identity';
import { buildMatchday, type MatchMoment } from '../game/matchdayPresenter';
import type { Career } from '../types';
import { getCareerPlayerArt } from '../ui/playerArt';
import { ClubCrest } from './ClubCrest';
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
  onContinue,
}: {
  career: Career;
  onContinue: () => void;
}): JSX.Element | null {
  const matchday = useMemo(() => buildMatchday(career), [career]);
  const [revealed, setRevealed] = useState(0);
  if (!matchday) return null;

  const { context, moments } = matchday;
  const total = moments.length;
  const done = revealed >= total;
  const visible = moments.slice(0, revealed);

  /* The scoreboard equals the story revealed so far - never ahead of it. */
  let shownFor = 0;
  let shownAgainst = 0;
  for (const moment of visible) {
    // The assist moment IS the assisted goal - it counts on the scoreboard like any other.
    if (moment.kind === 'player_goal' || moment.kind === 'team_goal' || moment.kind === 'player_assist') {
      shownFor += 1;
    }
    if (moment.kind === 'conceded') shownAgainst += 1;
  }
  const lastMinute = visible[visible.length - 1]?.minute ?? 0;

  const clubName = clubDisplayName(career.currentClubId);
  const isKeeper = career.position === 'GK';
  const art = getCareerPlayerArt({
    age: career.age,
    position: career.position,
    context: done && matchday.played ? (isKeeper ? 'save' : 'celebration') : 'hero',
  });

  return (
    <CinematicBackdrop backdrop="matchday-crowd" className="gf-matchday">
      <div className="gf-md-head">
        <div className="gf-kicker">יום המשחק · {matchday.competitionLabel}</div>
        <div className="gf-md-board">
          <div className="gf-md-club">
            <ClubCrest clubId={career.currentClubId} size="large" />
            <span>{clubName}</span>
          </div>
          <div className="gf-md-score">
            <div className="gf-md-minute">
              {revealed === 0 ? 'לפני שריקה' : done ? 'סיום' : <Ltr>{`'${lastMinute}`}</Ltr>}
            </div>
            {/* keyed on the score so a goal retriggers the pulse - one beat, not a loop */}
            <div className="gf-md-numbers" key={`${shownFor}:${shownAgainst}`}>
              <Ltr>
                {shownFor}:{shownAgainst}
              </Ltr>
            </div>
          </div>
          <div className="gf-md-club">
            <ClubCrest clubId={context.opponentClubId} name={context.opponentName} size="large" />
            <span>{context.opponentName}</span>
          </div>
        </div>
        {context.opponentPosition !== null && (
          <div className="gf-md-caption">
            {context.home ? 'בבית' : 'בחוץ'} · היריבה במקום <Ltr>{context.opponentPosition}</Ltr>
          </div>
        )}
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
        <div className="gf-md-facts">
          {/* the anchor to truth: the real half numbers this matchday was drawn from */}
          {matchday.factsLine}
        </div>
      )}

      <div className="gf-md-controls">
        {!done ? (
          <>
            <GameButton onClick={() => setRevealed((r) => Math.min(total, r + (r === 0 ? 1 : 2)))}>
              {revealed === 0 ? 'שריקת פתיחה' : 'המשך'}
            </GameButton>
            <GameButton tone="ghost" onClick={() => setRevealed(total)}>
              לדלג
            </GameButton>
          </>
        ) : (
          <GameButton onClick={onContinue}>לסיכום המחצית</GameButton>
        )}
      </div>
    </CinematicBackdrop>
  );
}

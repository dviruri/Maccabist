import { deriveCareerFeed } from '../game/careerFeed';
import { getPersonArt } from '../ui/playerArt';
import { activeFixture, knownCupFinal } from '../game/fixture';
import { isInAcademy } from '../game/rules';
import type { Career } from '../types';
import { ClubCrest } from './ClubCrest';
import { CinematicBackdrop, GameSectionTitle, PlayerHero } from './gamefeel';

/**
 * The cinematic career home (v0.9, Phase 2).
 *
 * The concept's four questions, answered in order: WHO AM I (the hero) → WHERE AM I (club in
 * the hero) → WHAT IS NEXT (the next-chapter fixture hero) → WHAT IS HAPPENING (the feed).
 *
 * ## The honesty rule that shaped this file
 *
 * The engine simulates seasons, not a fixture calendar - there is no literal "next match"
 * object. So the fixture hero shows the season's next REAL chapter, derived from state that
 * actually exists: a pending cup final names the real final opponent the cup state committed
 * to; a European knockout names the real tie from the stored journey; otherwise the league
 * hero shows the player's actual table position against the nearest real rival - "מקום 1 נגד
 * מקום 2", which is the concept's own caption. Nothing invents a kickoff time the game does
 * not model; the timing line speaks in season phases, which are real.
 *
 * The feed is deterministic templates over live state - coach lines from the actual role and
 * trust, agent lines from actual pending offers, media lines from actual mid-season form,
 * Europe lines from the actual journey. No rng is consumed; the same state renders the same
 * feed.
 */

/* ------------------------------------------------------------------ */
/* The next chapter                                                    */
/* ------------------------------------------------------------------ */

/**
 * The next-match hero, rendered from THE fixture (v0.9.1).
 *
 * v0.9 derived its own opponent here - the nearest table rival - while the matchday derived a
 * different one. Both are gone: `activeFixture` is the single answer, so the crest the player
 * sees on the home screen is the crest he sees after kickoff, always.
 */
function NextChapterHero({ career }: { career: Career }): JSX.Element | null {
  const fixture = activeFixture(career);
  const teasedFinal = knownCupFinal(career);
  if (!fixture) return null;

  const caption =
    fixture.kind === 'cup_final'
      ? 'משחק אחד על תואר'
      : fixture.kind === 'european'
        ? 'לילה אירופי'
        : fixture.playerPosition !== null && fixture.opponentPosition !== null
          ? `מקום ${fixture.playerPosition} נגד מקום ${fixture.opponentPosition}`
          : fixture.opponentPosition !== null
            ? `היריבה במקום ${fixture.opponentPosition}`
            : fixture.home
              ? 'בבית'
              : 'בחוץ';

  const timing =
    fixture.kind === 'cup_final'
      ? career.seasonPoint === 'midseason'
        ? 'בהמשך העונה'
        : 'לקראת סוף העונה'
      : fixture.kind === 'european'
        ? 'באביב'
        : career.seasonPoint === 'preseason'
          ? 'פתיחת העונה'
          : career.seasonPoint === 'midseason'
            ? 'בהמשך המחזור'
            : 'סיום העונה';

  return (
    <div className={`gf-next${fixture.kind === 'european' ? ' gf-next-euro' : ''}`}>
      <div className="gf-next-title">המשחק הבא</div>
      <div className="gf-kicker">
        {fixture.competition}
        {fixture.stage ? ` · ${fixture.stage}` : ''}
      </div>
      <div className="gf-next-clubs">
        <div className="gf-next-club">
          <ClubCrest clubId={fixture.playerClubId} name={fixture.playerClubName} size="large" />
          <span>{fixture.playerClubName}</span>
        </div>
        <span className="gf-next-vs" aria-hidden>
          VS
        </span>
        <div className="gf-next-club">
          <ClubCrest clubId={fixture.opponentClubId} name={fixture.opponentName} size="large" />
          <span>{fixture.opponentName}</span>
        </div>
      </div>
      <div className="gf-next-caption">{caption}</div>
      <div className="gf-next-timing">{timing}</div>
      {/*
        v0.9.2: the cup final is committed early and played last. It may be TEASED here - the
        club knows who it would meet - but the fixture above stays the season's actual next
        match, because known is not active.
      */}
      {teasedFinal && fixture.kind !== 'cup_final' && (
        <div className="gf-next-tease">
          🏆 {teasedFinal.competition}: {teasedFinal.opponentName} — בסיום העונה
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The feed                                                            */
/* ------------------------------------------------------------------ */

/**
 * מה קורה עכשיו בקריירה. The derivation moved to `game/careerFeed.ts` in v0.9.1 - contextual
 * pools with deterministic dedupe, so the coach stops repeating one sentence for a whole career
 * while staying just as grounded in live state.
 */
function CareerFeed({ career }: { career: Career }): JSX.Element | null {
  const items = deriveCareerFeed(career);
  if (items.length === 0) return null;
  return (
    <div className="gf-feed">
      <GameSectionTitle>מה קורה עכשיו בקריירה</GameSectionTitle>
      {items.map((item, index) => (
        <div key={index} className="gf-feed-item">
          <img className="gf-feed-face" src={getPersonArt(item.role)} alt="" aria-hidden loading="lazy" />
          <div className="gf-feed-body">
            <span className="gf-feed-role">{item.roleLabel}</span>
            <p className="gf-feed-text">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

/**
 * The home scene at the top of the play screen. `focused` collapses it to the compact hero
 * while a decision or event is active - the meta must never push the choice below the fold.
 */
export function CareerHomeScene({
  career,
  focused,
  onOpenCareer,
}: {
  career: Career;
  focused: boolean;
  onOpenCareer: () => void;
}): JSX.Element {
  return (
    <CinematicBackdrop backdrop={isInAcademy(career) ? 'training' : 'home-dark'}>
      <button type="button" className="gf-hero-tap" onClick={onOpenCareer} aria-label="פרטי הקריירה">
        <PlayerHero career={career} compact={focused} />
      </button>
      {!focused && (
        <>
          <NextChapterHero career={career} />
          <CareerFeed career={career} />
        </>
      )}
    </CinematicBackdrop>
  );
}

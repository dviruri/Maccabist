import { MACCABI_ID } from '../data/clubs';
import { getLeague } from '../data/leagues';
import { currentLeagueContext, maccabiLeagueContext } from '../game/leagueEngine';
import type { Career, LeagueContext } from '../types';
import { seasonPhaseSteps } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { Ltr } from './primitives';

/**
 * Where are we, in one line (v0.4.7).
 *
 * v0.4.6 answered this with a card containing a seven-row table — about 370px of the gameplay
 * screen, above the event. The information was right and the placement was wrong: what a player
 * needs in order to answer the question in front of him is not the table, it is *what the table
 * means*. Four points off Europe. Two above the drop. In the promotion places.
 *
 * So this is the summary, and the table itself is one tap away (Phase 4). The summary is derived
 * from the same authoritative `leagueContext` the events are gated on, so the strip and the event
 * pool can never disagree — if it says title race, a title-race event can fire.
 *
 * Current club first, Maccabi second and visibly smaller. That is the v0.4.6 product invariant
 * made visual: the club he actually represents owns the line.
 */
export function SeasonStrip({
  career,
  onOpenTable,
}: {
  career: Career;
  onOpenTable: () => void;
}): JSX.Element | null {
  const context = currentLeagueContext(career);
  const maccabi = maccabiLeagueContext(career);
  const atMaccabi = career.currentClubId === MACCABI_ID;

  // Youth football has no table, and inventing one would be the opposite of this version's point.
  if (!context) return null;

  const league = getLeague(context.leagueId);
  const rounds = (context.leagueSize - 1) * 2;
  const phase = seasonPhaseSteps(career).find((step) => step.current)?.label ?? null;

  return (
    <div className="strip">
      <button
        type="button"
        className="strip-main"
        onClick={onOpenTable}
        aria-label={`טבלת ${league.name}, מקום ${context.position}`}
      >
        <span className="strip-pos">
          <Ltr>{context.position}</Ltr>
        </span>
        <span className="strip-lines">
          <span className="strip-league">
            {league.name}
            <span className="strip-round">
              {' · מחזור '}
              <Ltr>
                {context.played}/{rounds}
              </Ltr>
            </span>
            {/*
              The season phase, folded in here (v0.4.7). It used to be a five-dot strip of its own
              between the season context and the event - about 55px, for one word of information.
              The shape of the season is worth saying; it is not worth a module.
            */}
            {phase && <span className="strip-phase">{` · ${phase}`}</span>}
          </span>
          <span className="strip-context">{stakesText(context)}</span>
        </span>
        <span className="strip-open" aria-hidden>
          טבלה
        </span>
      </button>

      {/*
        Maccabi, only when he is somewhere else (Phase 3.3). At Maccabi the strip above already IS
        the Maccabi season, and printing it twice would be the screen not knowing what it is
        looking at.
      */}
      {!atMaccabi && maccabi && <MaccabiLine maccabi={maccabi} />}
    </div>
  );
}

/**
 * What the table means, rather than what it says.
 *
 * Reads gaps in preference to labels: "4 נק׳ מאירופה" tells a player more than "מאבק על אירופה",
 * and it is the number the event gating actually used.
 */
export function stakesText(context: LeagueContext): string {
  const n = (value: number): string => String(Math.abs(Math.round(value)));

  if (context.championClinched) return 'האליפות בכיס';
  if (context.promotionClinched) return 'העלייה מובטחת';
  if (context.relegationConfirmed) return 'הירידה סופית';

  if (context.titleRace) {
    if (context.position === 1) {
      // Top of the table: the interesting number is the cushion, not the deficit.
      return 'בפסגה';
    }
    return `${n(context.pointsFromTop)} נק׳ מהפסגה`;
  }
  if (context.promotionRace && context.pointsFromPromotion !== null) {
    return context.pointsFromPromotion <= 0
      ? 'במקום עלייה'
      : `${n(context.pointsFromPromotion)} נק׳ ממקום עלייה`;
  }
  if (context.relegationBattle && context.pointsFromSafety !== null) {
    return context.pointsFromSafety >= 0
      ? `${n(context.pointsFromSafety)} נק׳ מעל הקו האדום`
      : `${n(context.pointsFromSafety)} נק׳ מתחת לקו`;
  }
  if (context.europeRace && context.pointsFromEurope !== null) {
    return context.pointsFromEurope <= 0
      ? 'במקומות אירופה'
      : `${n(context.pointsFromEurope)} נק׳ מאירופה`;
  }
  if (context.overperforming) return 'מעל הציפיות';
  if (context.underperforming) return 'מתחת לציפיות';
  return 'אמצע הטבלה';
}

/** Maccabi's own position, deliberately quieter than the line above it. */
function MaccabiLine({ maccabi }: { maccabi: LeagueContext }): JSX.Element {
  const league = getLeague(maccabi.leagueId);

  return (
    <div className="strip-maccabi">
      <ClubCrest clubId={MACCABI_ID} size="small" />
      <span className="strip-maccabi-name">מכבי חיפה</span>
      <span className="strip-maccabi-pos">
        מקום <Ltr>{maccabi.position}</Ltr>
      </span>
      <span className="strip-maccabi-league">{league.name}</span>
    </div>
  );
}

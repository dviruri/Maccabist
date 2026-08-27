/**
 * The player's standing with Maccabi (v0.4).
 *
 * This is deliberately *not* Maccabism. Maccabism is what the player feels about the club and it
 * is his to spend; standing is what the club and the stand feel about him, and he only ever earns
 * it. The two come apart constantly, and that gap is most of the drama: a boy released at fifteen
 * can stay a Maccabist his whole life and still be a stranger at Sami Ofer, and a captain who
 * walks out for a rival keeps every appearance he ever made and is booed anyway.
 *
 * Nothing is stored. Standing is derived from the record and the memories, so it cannot drift out
 * of sync with what actually happened and old saves get a correct value for free.
 *
 * The product invariant this serves: THE PLAYER MAY LEAVE MACCABI. MACCABI NEVER LEAVES THE
 * PLAYER'S STORY. A player who has gone is still *someone* to this club - just not always someone
 * they are glad to see.
 */

import { MACCABI_ID } from '../data/clubs';
import type { Career, MaccabiRelationship, MaccabiStanding } from '../types';
import { LEAVING, MACCABI_BOND } from './balance';
import { countMemories, hasMemory } from './memory';
import { clamp } from './random';
import { leagueOf } from './worldEngine';

/* ------------------------------------------------------------------ */
/* Where he stands                                                     */
/* ------------------------------------------------------------------ */

export function isAtMaccabi(career: Career): boolean {
  return career.currentClubId === MACCABI_ID;
}

/** Did he ever actually play senior football for them, as opposed to passing through the academy? */
export function playedForMaccabi(career: Career): boolean {
  return career.maccabi.appearances > 0;
}

/**
 * What he gave the club, 0-100.
 *
 * Service, not sentiment: games, seasons, trophies and the armband. Academy years count, but far
 * less than senior appearances - a decade in the youth teams is a bond, not a career.
 */
export function maccabiService(career: Career): number {
  const m = career.maccabi;
  const b = MACCABI_BOND;

  const games = Math.min(b.appearanceCap, m.appearances) * b.perAppearance;
  const seasons = m.seasons * b.perSeason;
  const silver = (m.championships + m.cups) * b.perTrophy + m.europeanRuns * b.perEuropeanRun;
  const armband = m.captainSeasons * b.perCaptainSeason;
  const academy = Math.min(b.academyCap, m.academySeasons * b.perAcademySeason);
  const graduate = m.academyGraduate ? b.graduateBonus : 0;

  return clamp(games + seasons + silver + armband + academy + graduate);
}

/**
 * What he cost them, 0-100. Only ever about *how* he left, never about leaving.
 *
 * Leaving is a normal part of a career and the ideal Maccabist career includes Europe. What the
 * stand remembers is the manner of it: a rival shirt, a refused contract, a public row.
 */
export function maccabiGrievance(career: Career): number {
  const b = MACCABI_BOND;
  let grievance = career.maccabi.betrayalMoments * b.perBetrayal;

  if (joinedRivalFromMaccabi(career)) grievance += b.rivalDefection;
  if (hasMemory(career, 'rejected_maccabi')) grievance += b.rejectedReturn;
  if (hasMemory(career, 'celebrated_against_maccabi')) grievance += b.celebrated;

  // Credit for the gestures that are only meaningful once you have gone.
  grievance -= career.maccabi.loyaltyMoments * b.perLoyalty;
  if (hasMemory(career, 'refused_to_celebrate')) grievance -= b.refusedToCelebrate;
  if (hasMemory(career, 'returned_home')) grievance -= b.cameBack;

  return clamp(grievance);
}

/**
 * True when the player left Maccabi's senior side directly for a domestic rival.
 *
 * Read off the season trail rather than stored, so it stays right for saves made before this
 * existed. Loan seasons are skipped: a spell somewhere else is not a defection, and the club he
 * is loaned to is not the club he chose.
 */
export function joinedRivalFromMaccabi(career: Career): boolean {
  const seasons = career.seasonHistory.filter(
    (s) => s.academyStage === 'senior' && !s.onLoan,
  );
  for (let i = 0; i < seasons.length - 1; i += 1) {
    const from = seasons[i];
    const to = seasons[i + 1];
    if (from?.clubId === MACCABI_ID && to && LEAVING.rivalClubIds.includes(to.clubId)) return true;
  }
  return false;
}

/**
 * The single number behind the relationship, -100..100.
 *
 * Negative is not "disliked" so much as "owed an explanation" - the club's memory of a player who
 * took more than he gave.
 */
export function maccabiStandingScore(career: Career): number {
  return clamp(maccabiService(career) - maccabiGrievance(career), -100, 100);
}

/* ------------------------------------------------------------------ */
/* The relationship                                                    */
/* ------------------------------------------------------------------ */

/**
 * How Maccabi sees him.
 *
 * Order matters. Betrayal overrides service, because that is how crowds work: a traitor with 200
 * games is still a traitor. Everything else is a threshold on the standing score, with
 * `son_of_the_club` reserved for a graduate who actually became someone there.
 */
export function maccabiRelationship(career: Career): MaccabiRelationship {
  const b = MACCABI_BOND;
  const score = maccabiStandingScore(career);

  if (joinedRivalFromMaccabi(career) || maccabiGrievance(career) >= b.traitorGrievance) {
    return 'traitor';
  }
  // Never played, never really left: he is simply not part of their story yet.
  if (!playedForMaccabi(career) && career.maccabi.academySeasons === 0) return 'stranger';

  if (score >= b.iconScore && career.maccabi.academyGraduate) return 'son_of_the_club';
  if (score >= b.iconScore) return 'icon';
  if (score >= b.belovedScore) return 'beloved';
  if (score >= b.respectedScore) return 'respected';
  if (score >= b.knownScore) return 'known';
  return 'stranger';
}

export const RELATIONSHIP_LABELS: Record<MaccabiRelationship, string> = {
  son_of_the_club: 'בן המועדון',
  icon: 'אייקון',
  beloved: 'אהוב הקהל',
  respected: 'מוערך',
  known: 'מוכר',
  stranger: 'זר',
  traitor: 'בוגד',
};

/** One line for the UI, written from the stand's point of view. */
export const RELATIONSHIP_NOTES: Record<MaccabiRelationship, string> = {
  son_of_the_club: 'גדלת שם, פרצת שם, והפכת לאחד משלהם. זה לא נמחק.',
  icon: 'השם שלך נאמר בסמי עופר בלי להסביר מי אתה.',
  beloved: 'הם זוכרים אותך לטובה. תמיד יהיה מי שימחא לך כפיים.',
  respected: 'עשית את שלך בכבוד. אין טינה, אין געגוע גדול.',
  known: 'הם יודעים מי אתה. זה בערך הכל.',
  stranger: 'עברת שם. הקהל לא באמת מכיר אותך.',
  traitor: 'יש חולצות שלא סולחים עליהן.',
};

/* ------------------------------------------------------------------ */
/* Facing them                                                         */
/* ------------------------------------------------------------------ */

/**
 * What the away end does when he touches the ball at Sami Ofer.
 *
 * A player is only booed if there is something to boo. Indifference is the common case and it is
 * its own kind of sad - most careers pass through a club without leaving a mark on it.
 */
export function crowdResponse(career: Career): MaccabiStanding {
  const relationship = maccabiRelationship(career);
  if (relationship === 'traitor') return 'hostile';
  if (relationship === 'stranger' || relationship === 'known') return 'indifferent';
  return 'warm';
}

/** True when the player could plausibly face Maccabi this season. */
export function canFaceMaccabi(career: Career): boolean {
  if (isAtMaccabi(career)) return false;
  if (career.academyStage !== 'senior') return false;
  // The top flight meets them twice a season. Anything else needs a European draw or a cup tie,
  // which this world does not simulate, so the honest answer is no.
  return (
    leagueOf(career.world, career.currentClubId).id ===
    leagueOf(career.world, MACCABI_ID).id
  );
}

/** How many times the player has already faced them, for anti-repetition. */
export function timesFacedMaccabi(career: Career): number {
  return countMemories(career, 'played_against_maccabi');
}

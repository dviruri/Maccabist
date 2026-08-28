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

/* ------------------------------------------------------------------ */
/* Walking back into Sami Ofer (v0.4.5.1)                              */
/* ------------------------------------------------------------------ */

/**
 * Why this player is standing in that stadium.
 *
 * The brief's requirement is that the reception "must come from actual Maccabi Relationship /
 * history. Do not invent it randomly." So this is a derivation, not a draw — the same career
 * always produces the same context.
 *
 * The distinction that matters most is `rejected_child`. A boy Maccabi turned away at nine and who
 * never played for them is **not** a former hero returning, and framing him as one would be the
 * game telling him a story about himself that never happened. The crowd does not know who he is.
 * He knows exactly who they are. That asymmetry is the whole moment, and it is the opposite of
 * nostalgia.
 */
export type SamiOferContext =
  /** Former captain or long-serving great. The stand stands up. */
  | 'returning_legend'
  /** Served them well and left properly. Warm, unsentimental. */
  | 'respected_return'
  /** Was there, made no mark. Nobody looks up. */
  | 'quiet_return'
  /** Left for a rival, or left badly. They have not forgotten. */
  | 'hostile_return'
  /** They released him as a boy. He never wore the shirt. Not a homecoming. */
  | 'rejected_child'
  /** No history at all. Just another away player. */
  | 'no_history';

/** True when Maccabi turned him away and he never went on to play for their senior side. */
export function wasRejectedAsAChild(career: Career): boolean {
  const turnedAway =
    career.origin === 'trial_rejected' ||
    career.flags.includes('released_by_maccabi') ||
    hasMemory(career, 'failed_first_maccabi_trial') ||
    hasMemory(career, 'released_by_maccabi');
  return turnedAway && !playedForMaccabi(career);
}

/**
 * The context for a return to Sami Ofer, from history alone.
 *
 * Order matters. Hostility overrides service, because that is how crowds work. And the
 * rejected-child case is checked before the "no history" fallback, because those two look
 * identical to the relationship model - both are `stranger` - and could not be more different
 * to the player.
 */
export function samiOferContext(career: Career): SamiOferContext {
  const relationship = maccabiRelationship(career);

  if (relationship === 'traitor') return 'hostile_return';

  if (playedForMaccabi(career)) {
    if (relationship === 'son_of_the_club' || relationship === 'icon') return 'returning_legend';
    if (relationship === 'beloved' || relationship === 'respected') return 'respected_return';
    return 'quiet_return';
  }

  if (wasRejectedAsAChild(career)) return 'rejected_child';
  return 'no_history';
}

/** The headline for each context. Never "a hero returns" for someone who was never one. */
export const SAMI_OFER_TITLES: Record<SamiOferContext, string> = {
  returning_legend: 'חוזרים לסמי עופר',
  respected_return: 'חוזרים לסמי עופר',
  quiet_return: 'חוזרים לסמי עופר',
  hostile_return: 'חוזרים לסמי עופר',
  // Not "חוזרים" - he was never here.
  rejected_child: 'סמי עופר, בצד השני',
  no_history: 'סמי עופר',
};

export const SAMI_OFER_LINES: Record<SamiOferContext, string> = {
  returning_legend: 'הפעם בצד השני.',
  respected_return: 'הפעם בצד השני.',
  quiet_return: 'הפעם בצד השני.',
  hostile_return: 'הפעם בצד השני.',
  rejected_child: 'המועדון שלא קיבל אותך בילדות עומד עכשיו מולך.',
  no_history: 'אצטדיון שאתה מכיר רק מהטלוויזיה.',
};

/** What the stand actually does. */
export const SAMI_OFER_CROWD: Record<SamiOferContext, string> = {
  returning_legend: 'היציע קם על הרגליים. חלק מהם שרים את השם שלך.',
  respected_return: 'מחיאות כפיים מכובדות מכל האצטדיון.',
  quiet_return: 'אף אחד לא מרים את הראש. עברת כאן, וזה הכל.',
  hostile_return: 'שריקות בוז מכל היציעים. הם לא סלחו.',
  rejected_child: 'הם לא מזהים אותך. אתה מזהה כל פינה במקום הזה.',
  no_history: 'קהל אדיש, כמו לכל שחקן אורח.',
};


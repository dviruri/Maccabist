/**
 * Who the player is, where he plays, and what to call it (v0.4.1).
 *
 * Three concepts that the codebase used to conflate into one club id:
 *
 *   CLUB IDENTITY   which club he belongs to        maccabi_haifa
 *   TEAM UNIT       which side of it he plays for   academy | youth | first_team
 *   STAGE           where he is in his development  youth_a | u19 | senior
 *
 * They are genuinely independent. A boy at Maccabi's academy and a Maccabi first-team player
 * share a club and share nothing else; a נוער player and a נערים ב׳ player share a club and a
 * unit but not a stage. Collapsing them into "which club id is stored" is what produced the
 * playtest bug where a player promoted to the first team was still described for the rest of his
 * career as "מכבי חיפה - מחלקת ילדים".
 *
 * Everything here is DERIVED. Nothing is stored, so it cannot go stale, old saves get correct
 * answers for free, and there is no second copy of the truth to drift.
 *
 * The UI must never assemble team wording itself. It calls `currentTeamDisplay` and renders what
 * it gets back — that is the whole point of this module.
 */

import { stageBand, stageLabel } from '../data/academy';
import { worldClubById } from '../data/worldClubs';
import { getClub, MACCABI_ACADEMY_ID, MACCABI_ID } from '../data/clubs';
import type { AcademyStage, Career, TeamDisplay, TeamUnit } from '../types';

/* ------------------------------------------------------------------ */
/* Team unit                                                           */
/* ------------------------------------------------------------------ */

/**
 * Which side of the club he plays for.
 *
 * Derived from the stage rather than the club id, because the club id alone cannot tell you: a
 * Maccabi academy player and a Maccabi first-team player can both legitimately be "at Maccabi".
 */
export function teamUnitFor(stage: AcademyStage): TeamUnit {
  if (stage === 'senior') return 'first_team';
  return stageBand(stage) === 'u19' ? 'youth' : 'academy';
}

export function teamUnitOf(career: Career): TeamUnit {
  return teamUnitFor(career.academyStage);
}

export function isFirstTeam(career: Career): boolean {
  return teamUnitOf(career) === 'first_team';
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

/**
 * The club's real name, independent of which team he plays for.
 *
 * The academy and youth club records carry a suffixed name ("מכבי חיפה - מחלקת ילדים") because
 * they double as the player's club id while he is a boy. That suffix belongs to the *unit*, not
 * to the club, so it is stripped here and re-derived from the stage. Otherwise "מכבי חיפה -
 * מחלקת ילדים — נערים א׳" is what a screen ends up printing.
 */
export function clubDisplayName(clubId: string): string {
  if (clubId === MACCABI_ACADEMY_ID || clubId === 'maccabi_youth') return getClub(MACCABI_ID).name;
  /*
   * v0.6.4: every world club now has a real `Club` record, so `getClub` answers for all of them.
   * The world lookup stays as a guard for an id that resolves nowhere else - an inactive club
   * carried in a very old save, for instance - because a career's history must stay readable.
   */
  try {
    return getClub(clubId).name;
  } catch {
    return worldClubById(clubId)?.name ?? clubId;
  }
}

/**
 * What to call the team the player is in *right now*.
 *
 * `club` is always the club. `team` is the age group or unit, and is null for a first-team
 * player — because "מכבי חיפה — בוגרים" is not how anyone refers to a first-team footballer.
 */
export function currentTeamDisplay(career: Career): TeamDisplay {
  return teamDisplayFor(career.currentClubId, career.academyStage, career.parentClubId !== null);
}

/**
 * The same wording for an arbitrary club/stage pair.
 *
 * Season records store their own club and stage, so history renders through this with the values
 * that were true at the time — a retired first-team player's נערים ב׳ season still reads
 * "מכבי חיפה — נערים ב׳", which is correct, not stale.
 */
export function teamDisplayFor(
  clubId: string,
  stage: AcademyStage,
  onLoan = false,
): TeamDisplay {
  const club = clubDisplayName(clubId);
  const unit = teamUnitFor(stage);

  return {
    club,
    team: unit === 'first_team' ? null : stageLabel(stage),
    unit,
    onLoan,
    full: unit === 'first_team' ? club : `${club} — ${stageLabel(stage)}`,
  };
}

/**
 * A Hebrew inseparable prefix on a CLUB name (v0.9.3, corrected v0.9.6.2).
 *
 * ל / ב / מ swallow a following definite ARTICLE - that is why `inCompetition` turns
 * "הקונפרנס ליג" into "בקונפרנס ליג". This function generalised that rule to club names, and
 * that was wrong: in a club name the leading ה is part of the name, not an article.
 *
 * The result was shipped in the matchday timeline, which writes a line for every goal, and on
 * the decision card:
 *
 *   שער לפועל באר שבע     should be   שער להפועל באר שבע
 *   נשאר בפועל תל אביב     should be   נשאר בהפועל תל אביב
 *
 * Worse on transliterations, where the ה is simply the first letter and stripping it destroys
 * the name outright - 37 clubs in the database begin with one:
 *
 *   המבורג   -> למבורג        היידנהיים -> ליידנהיים
 *   הופנהיים -> לופנהיים      הרקליס    -> לרקליס
 *   האל סיטי -> לאל סיטי
 *
 * Israeli football writes "ניצחון להפועל", "שער להפועל", "עבר להפועל" - the ה stays. So a club
 * name simply takes the prefix, and the contraction rule stays where it belongs, on competition
 * names, in `inCompetition`.
 */
export function withHebrewPrefix(prefix: string, name: string): string {
  return `${prefix}${name}`;
}

/** One string for compact places (timeline rows, chips). */
export function teamDisplayLine(display: TeamDisplay): string {
  return display.onLoan ? `${display.full} · בהשאלה` : display.full;
}

/* ------------------------------------------------------------------ */
/* Coherence                                                           */
/* ------------------------------------------------------------------ */

/**
 * Is this career's club/stage pair possible?
 *
 * A senior stage at a non-senior club, or an academy stage at a senior club, means something
 * moved one without the other. Used by `hydrateCareer` to repair saves written before the ladder
 * was capped, and asserted in tests so the combination cannot come back.
 */
export function hasCoherentIdentity(career: Career): boolean {
  const senior = getClub(career.currentClubId).isSenior === true;
  return senior === (career.academyStage === 'senior');
}

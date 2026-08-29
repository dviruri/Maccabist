/**
 * How a career begins, and the road back if it begins badly.
 *
 * Maccabist always starts with Maccabi as the goal, and never guarantees Maccabi. A small
 * number of children are spotted by a scout; everyone else goes to the trials, and the trials
 * can say no. Saying no is not game over - it is the question the version is built around:
 * «אם הדלת של מכבי לא נפתחה - איך תגרום להם להתחרט?»
 *
 * Pure functions over a Career plus an Rng. No React, no side effects.
 */

import { endManagerTenure, initialManagerTrust, installManager, rngFor } from './peopleEngine';
import { MACCABI_ACADEMY_ID } from '../data/clubs';
import { stageConfig } from '../data/academy';
import { EXTERNAL_YOUTH_CLUBS } from '../data/youthClubs';
import type { Career, TeamRole, TrialResult } from '../types';
import { ORIGIN } from './balance';
import { relativeAgeBonus } from './cohort';
import { hasTrait, recordMemory } from './memory';
import { addMilestone } from './progressionEngine';
import type { Rng } from './random';

/* ------------------------------------------------------------------ */
/* The first trials                                                    */
/* ------------------------------------------------------------------ */

/**
 * How the trial panel rates a nine year old.
 *
 * Ability dominates, potential leaks through only indirectly (nobody can see it yet), and the
 * relative-age effect matters here more than anywhere else in the game - being eleven months
 * older is very visible at nine.
 */
export function trialScore(career: Career, rng: Rng): number {
  const o = ORIGIN;
  return (
    career.ability * o.trialAbilityWeight +
    career.hidden.potential * o.trialPotentialWeight +
    career.hidden.confidence * o.trialConfidenceWeight +
    relativeAgeBonus(career) * 2 +
    (hasTrait(career, 'self_believer') ? 4 : 0) +
    (hasTrait(career, 'hard_worker') ? 3 : 0) +
    rng.gaussian(0, o.trialNoise)
  );
}

/*
 * The opening copy lives here rather than in the component. OriginReveal used to carry its own
 * copy of the scouted text, which meant two strings that had to be kept in step by hand and
 * silently diverged the moment either was edited.
 */
export const ACCEPTED_COPY = {
  title: 'התקבלת למכבי חיפה',
  description:
    'שלושה אימוני מבחן, ואז שיחה קצרה עם מנהל המחלקה. "נתראה באוגוסט." זה כל מה שהוא אמר, וזה הספיק.',
  icon: '💚',
};

export const REJECTED_COPY = {
  title: 'הפעם זה לא הספיק',
  description:
    'המאמן אומר את זה בעדינות, וזה עדיין נחתך. הדרך למכבי תהיה קצת יותר ארוכה - היא לא נסגרה.',
  icon: '🚪',
};

export const SCOUTED_COPY = {
  title: 'אותרת על ידי מכבי',
  description:
    'סקאוט של מכבי חיפה ראה אותך בטורניר ילדים והזמין אותך ישר למחלקה, בלי מבחנים. זה קורה למעטים.',
  icon: '⭐',
};

/**
 * Decides how the career opens. Called once at creation.
 *
 * Being scouted correlates with talent but guarantees nothing - a prodigy can still fail, and
 * the trials can still reject a boy who turns out to be the best of his year.
 */
export function resolveOrigin(career: Career, rng: Rng): Career {
  // A scout's eye is drawn to talent, so this leans on potential without being decided by it.
  const scoutChance =
    ORIGIN.scoutedChance * (career.hidden.potential >= 88 ? 2.2 : career.hidden.potential >= 78 ? 1.4 : 0.7);

  if (rng.chance(Math.min(0.3, scoutChance))) {
    let next: Career = { ...career, origin: 'scouted' };
    next.memories = recordMemory(next, 'scouted_by_maccabi');
    next = addMilestone(next, {
      id: 'origin_scouted',
      icon: SCOUTED_COPY.icon,
      text: 'סקאוט של מכבי חיפה הזמין אותך ישר למחלקה',
      major: true,
    });
    return next;
  }

  const score = trialScore(career, rng);
  const accepted = score >= ORIGIN.trialThreshold;
  const trial: TrialResult = {
    accepted,
    attempt: 1,
    season: career.currentSeason,
    ...(accepted ? ACCEPTED_COPY : REJECTED_COPY),
  };

  let next: Career = {
    ...career,
    origin: accepted ? 'trial_accepted' : 'trial_rejected',
    trials: [trial],
  };

  if (accepted) {
    next.memories = recordMemory(next, 'passed_first_maccabi_trial');
    next = addMilestone(next, {
      id: 'origin_trial_passed',
      icon: '💚',
      text: 'עברת את המבחנים של מכבי חיפה',
      major: true,
    });
    return next;
  }

  /* ---------- rejected: the career continues elsewhere ---------- */
  next.memories = recordMemory(next, 'failed_first_maccabi_trial');
  const club = rng.pick(EXTERNAL_YOUTH_CLUBS);
  next.currentClubId = club.id;
  next = addMilestone(next, {
    id: 'origin_trial_failed',
    icon: '🚪',
    // He attended the trials - he did not pass them. "לא התקבלת למבחנים" says he never got in the door.
    text: `לא עברת את המבחנים של מכבי חיפה. הצטרפת ל${club.name}`,
    major: true,
  });
  return next;
}

/* ------------------------------------------------------------------ */
/* The road back                                                       */
/* ------------------------------------------------------------------ */

/** Whether Maccabi would look at this player again this season. */
export function eligibleForRetrial(career: Career): boolean {
  if (career.currentClubId === MACCABI_ACADEMY_ID) return false;
  if (career.academyStage === 'senior') return false;
  if (career.trials.length >= ORIGIN.maxTrials) return false;

  const previousTrial = career.trials[career.trials.length - 1];
  if (
    previousTrial &&
    career.currentSeason - previousTrial.season < ORIGIN.retrialCooldownSeasons
  ) {
    return false;
  }

  /*
   * They only come back for someone who is standing out where he is - measured against the
   * level he plays at rather than a flat ability number, because a ten year old's raw ability
   * is low everywhere. What matters is being clearly better than the boys around him.
   *
   * Judged on the season just finished, via lastSeasonRecord. This check runs after the
   * academy ladder has already moved him up, so reading the *current* stage would compare
   * last season's ability against next season's tougher level and understate him - which is
   * why no scout ever came back.
   */
  const lastSeason = career.lastSeasonRecord;
  if (!lastSeason) return false;

  const levelPlayed = stageConfig(lastSeason.academyStage).quality;
  const standingOut = lastSeason.ability - levelPlayed >= ORIGIN.retrialAbilityEdge;
  const wasImportant = ROLE_ORDER.indexOf(lastSeason.role) >= ROLE_ORDER.indexOf('starter');
  return standingOut && wasImportant;
}

/** Team roles from least to most important, for "was he a regular?" comparisons. */
const ROLE_ORDER: readonly TeamRole[] = ['squad', 'rotation', 'starter', 'key', 'star', 'icon'];

/**
 * How Maccabi rates the player now - judged on what he has done at his own club rather than
 * on a single afternoon's trial.
 */
export function retrialScore(career: Career, rng: Rng): number {
  const o = ORIGIN;
  const lastSeason = career.lastSeasonRecord;
  const rating = lastSeason?.stats.rating ?? 55;
  return (
    career.ability * o.retrialAbilityWeight +
    career.roleValue * o.retrialRoleWeight +
    career.reputation * o.retrialReputationWeight +
    (rating - 58) * 0.5 +
    relativeAgeBonus(career) +
    rng.gaussian(0, o.trialNoise)
  );
}

export interface RetrialOutcome {
  career: Career;
  accepted: boolean;
  trial: TrialResult;
}

/** A second (or third) look. This is meant to feel like a big moment either way. */
export function resolveRetrial(career: Career, rng: Rng): RetrialOutcome {
  const attempt = career.trials.length + 1;
  const accepted = retrialScore(career, rng) >= ORIGIN.retrialThreshold;

  const trial: TrialResult = accepted
    ? {
        accepted: true,
        attempt,
        season: career.currentSeason,
        title: 'מכבי חיפה רוצה אותך',
        description:
          'שנים אחרי שאמרו לך לא, אותה מחלקה מזמינה אותך בחזרה - והפעם הם אלה שרוצים.',
        icon: '💚',
      }
    : {
        accepted: false,
        attempt,
        season: career.currentSeason,
        title: 'שוב לא',
        description: 'הגעת מוכן יותר, וזה עדיין לא נפתח. יש דלתות שנפתחות רק מהכיוון השני.',
        icon: '🚪',
      };

  let next: Career = { ...career, trials: [...career.trials, trial] };
  next.memories = recordMemory(next, 'returned_for_second_trial');

  if (!accepted) return { career: next, accepted, trial };

  next = {
    ...next,
    currentClubId: MACCABI_ACADEMY_ID,
    origin: next.origin,
  };
  /*
   * v0.5: joining Maccabi mid-childhood is a club change like any other, and it happens outside
   * `moveToClub` - so the coach relationship is swapped here explicitly. The external club's
   * coach closes with his trust snapshot; Maccabi's age-group coach takes over.
   */
  next = installManager(endManagerTenure(next, true));
  next.memories = recordMemory(next, 'joined_maccabi_late');
  next = addMilestone(next, {
    id: 'joined_maccabi_late',
    icon: '💚',
    // He may still be a child - "מחלקת הנוער" would be wrong wording for a ten year old.
    text: `הצטרפת למכבי חיפה בגיל ${next.age}`,
    major: true,
  });
  /*
   * A new academy, a new coach: the relationship starts fresh (v0.5.1 - through the same helper
   * every other new-manager moment uses, rather than a hardcoded 48, so an academy coach's
   * opening view of a boy reads his actual situation and not a constant).
   */
  next.coachTrust = initialManagerTrust(next, rngFor(next, 'academy-arrival'), {
    carryover: 0.1,
  });
  return { career: next, accepted, trial };
}

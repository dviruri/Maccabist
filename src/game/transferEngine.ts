/**
 * Transfers, loans, the youth -> senior transition, and the homecoming mechanic.
 *
 * Nothing here is a hard threshold like `ability > 80 => Premier League`.
 * Destinations are drawn with weighted eligibility, so a great season improves your
 * chances without ever guaranteeing a specific club.
 */

import { agentLoanFactor, agentOfferFactor, negotiateExpectedRole } from './peopleEngine';
import { stageOrder } from '../data/academy';
import { ALL_CLUBS, getClub, MACCABI_ID } from '../data/clubs';
import type {
  Career,
  Club,
  HomecomingKind,
  MaccabiRelevance,
  ProgressionResult,
  TransferOffer,
} from '../types';
import { HOMECOMING, LEAVING, TRANSFERS, YOUTH_TO_SENIOR } from './balance';
import { nextNaturalStage } from './cohort';
import {
  careerTrajectory,
  drawDestination,
  expectedRoleAt,
  EXPECTED_ROLE_LABELS,
  EXPECTED_ROLE_MINUTES,
  isDownwardMove,
  isStagnating,
  moveDirection,
  offerHints,
} from './marketEngine';
import { maccabiRelationship } from './maccabiEngine';
import { hasMemory, hasTrait } from './memory';
import { leagueOf } from './worldEngine';
import { leagueLevel } from '../data/leagues';
import { applyEffects, cloneCareer, moveToClub } from './progressionEngine';
import { clamp, type Rng } from './random';
import { isAtMaccabiSenior, isInAcademy, isOnLoan } from './rules';

/**
 * Small additive floor so a destination draw is never empty, but low enough that a club the
 * player clearly cannot play for stays unlikely rather than becoming a coin flip.
 */
const RELEASE_INTEREST_FLOOR = 0.05;

/** A rough 0-100 read of how attractive the player is on the market. */
export function marketValue(career: Career): number {
  return clamp(career.ability * 0.5 + career.reputation * 0.55 + career.roleValue * 0.08);
}

/** Weighted eligibility: clubs near (or a bit above) the player's level are the likeliest. */
export function interestWeight(career: Career, club: Club): number {
  const value = marketValue(career);
  const clubLevel = club.quality * 0.6 + club.prestige * 0.55;
  const diff = clubLevel - value;
  const base = Math.max(0, 1 - Math.abs(diff - 4) / 26);
  const tierMultiplier =
    club.tier === 'euro_top'
      ? 0.5
      : club.tier === 'euro_mid'
        ? 0.85
        : club.tier === 'euro_dev'
          ? 1.1
          : 1;
  const ageMultiplier = career.age <= 27 ? 1 : Math.max(0.25, 1 - (career.age - 27) * 0.12);
  return base * tierMultiplier * ageMultiplier;
}

function offerChance(career: Career): number {
  const lastRating = career.lastSeasonRecord?.stats.rating ?? 55;
  const raw =
    TRANSFERS.baseOfferChance +
    career.reputation * TRANSFERS.reputationWeight +
    (lastRating - 58) * TRANSFERS.ratingWeight -
    Math.abs(career.age - TRANSFERS.peakAge) * TRANSFERS.ageFalloff +
    career.hidden.transferBoost;
  /*
   * v0.5, Phase 8: the agent's phone. A dealmaker generates more conversations, a family agent
   * fewer - a multiplier on the probability an offer arrives, applied to a chance the world's
   * own rules already computed. No agent, no change: the market as it always was.
   */
  return clamp(raw * agentOfferFactor(career), 0, 0.95) as number;
}

/* ------------------------------------------------------------------ */
/* Offer builders                                                      */
/* ------------------------------------------------------------------ */

/**
 * How much leaving costs, in context.
 *
 * Leaving is not automatically betrayal. Walking out at 18 having barely played is a very
 * different act from joining a big European club at 24 with 150 games and championships
 * behind you - and going straight to a domestic rival is worse than either. The ideal
 * Maccabist career genuinely can include Europe, so staying forever must not be the
 * mathematically optimal answer.
 */
export function leavingContext(career: Career, club: Club): {
  maccabism: number;
  betrayal: boolean;
  memory: 'left_young' | 'left_established' | null;
  note: string;
} {
  if (!isAtMaccabiSenior(career)) {
    /*
     * Leaving the academy or a loan spell is not a betrayal of anything.
     *
     * v0.4.8: and leaving a club that is not Maccabi is not a Maccabi event at all. This returned
     * -4 or -2 unconditionally, so a rejected boy moving from Hapoel Afula to Hapoel Kfar Saba -
     * two clubs with nothing to do with Maccabi - lost Maccabism for it. The penalty now applies
     * only when the club he is leaving actually is Maccabi's.
     */
    const leavingMaccabi = getClub(career.currentClubId).isMaccabi === true;
    if (!leavingMaccabi) {
      return { maccabism: 0, betrayal: false, memory: null, note: '' };
    }
    const abroad = club.country !== 'ישראל';
    return {
      maccabism: abroad ? -4 : -2,
      betrayal: false,
      memory: 'left_young',
      note: '',
    };
  }

  const m = LEAVING;
  const rival = m.rivalClubIds.includes(club.id);
  const abroad = club.country !== 'ישראל';
  const established =
    career.maccabi.appearances >= m.establishedAppearances ||
    career.maccabi.seasons >= m.establishedSeasons;

  if (rival) {
    return {
      maccabism: m.rivalPenalty,
      betrayal: true,
      memory: 'left_established',
      note: 'ליריבה ישירה. את זה לא שוכחים.',
    };
  }

  if (abroad && established) {
    // The move everyone in the stand understands, and most of them wanted for you.
    return {
      maccabism: m.earnedEuropePenalty,
      betrayal: false,
      memory: 'left_established',
      note: 'אחרי כל מה שנתת כאן, אף אחד לא יקרא לך בוגד.',
    };
  }
  if (abroad) {
    return {
      maccabism: m.earlyEuropePenalty,
      betrayal: false,
      memory: 'left_young',
      note: 'צעיר, ובאמצע הדרך. חלק יבינו, חלק פחות.',
    };
  }
  return {
    maccabism: established ? m.domesticEstablishedPenalty : m.domesticEarlyPenalty,
    betrayal: !established,
    memory: established ? 'left_established' : 'left_young',
    note: '',
  };
}

function transferOffer(club: Club, career: Career, rng?: Rng): TransferOffer {
  const abroad = club.country !== 'ישראל';
  const leaving = leavingContext(career, club);
  const atMaccabi = isAtMaccabiSenior(career);

  const league = leagueOf(career.world, club.id);
  /*
   * v0.5, Phase 8.2: the agent may talk one step up the middle of the ladder - backup to
   * rotation, rotation to starter - and only when the player's ability makes the promise
   * keepable. What the club offers is still `expectedRoleAt`; negotiation adjusts the deal,
   * never the player's actual standing once he arrives and has to earn it.
   */
  const offered = expectedRoleAt(career, club, career.currentSeason);
  const role = rng ? negotiateExpectedRole(career, club, offered, rng) : offered;
  const direction = moveDirection(career, club);
  const roleLabel = EXPECTED_ROLE_LABELS[role];

  /*
   * The description says what he is being signed to be, because that is the actual decision.
   * "A bigger club wants you" is not information; "a bigger club wants you as a backup" is.
   */
  const roleLine =
    role === 'star' || role === 'key'
      ? `הם רוצים אותך בתור ${roleLabel}.`
      : role === 'project'
        ? 'הם רוצים לפתח אותך לטווח הארוך.'
        : `התפקיד המוצע: ${roleLabel}.`;

  return {
    id: `transfer_${club.id}`,
    kind: 'transfer',
    clubId: club.id,
    clubName: club.name,
    league: league.name,
    country: club.country,
    leagueId: league.id,
    leagueLevel: Math.round(leagueLevel(league)),
    expectedRole: role,
    direction,
    hints: offerHints(career, club, role, career.currentSeason),
    title: abroad ? `הצעה מ${club.name}` : `${club.name} רוצה אותך`,
    description:
      (abroad
        ? `${club.name} מ${club.country} הגישה הצעה רשמית. ${league.name}, אצטדיון אחר, שפה אחרת. `
        : `${club.name} מציעה לך חוזה. `) +
      roleLine +
      (leaving.note ? ` ${leaving.note}` : ''),
    acceptEffects: {
      reputation: abroad ? 6 : 1,
      maccabism: leaving.maccabism,
      confidence: 4,
      ...(leaving.betrayal ? { flags: ['betrayal_moment' as const] } : {}),
      ...(leaving.memory ? { remember: leaving.memory } : {}),
    },
    declineEffects: {
      maccabism: atMaccabi ? 7 : 0,
      roleValue: atMaccabi ? 2 : 0,
      ...(atMaccabi
        ? { flags: ['loyalty_moment' as const], remember: 'refused_transfer' as const }
        : {}),
    },
    acceptLabel: 'לחתום',
    declineLabel: 'לסרב',
  };
}

function loanOffer(club: Club, career: Career): TransferOffer {
  const league = leagueOf(career.world, club.id);
  const role = expectedRoleAt(career, club, career.currentSeason);
  const regular = EXPECTED_ROLE_MINUTES[role] >= 0.7;

  return {
    id: `loan_${club.id}`,
    kind: 'loan',
    clubId: club.id,
    clubName: club.name,
    league: league.name,
    country: club.country,
    leagueId: league.id,
    leagueLevel: Math.round(leagueLevel(league)),
    expectedRole: role,
    direction: moveDirection(career, club),
    hints: offerHints(career, club, role, career.currentSeason),
    title: `השאלה ל${club.name}`,
    // Never names Maccabi: a loan is not always from Maccabi any more.
    description: regular
      ? `${club.name} רוצה אותך בהשאלה לעונה, ושם תשחק כל שבוע. משחקים ברגליים שווים יותר מאימונים.`
      : `${club.name} רוצה אותך בהשאלה לעונה - ליגה חזקה יותר, אבל תצטרך להיאבק על הדקות.`,
    acceptEffects: { confidence: 3 },
    declineEffects: { minutesModifier: 0.85 },
    acceptLabel: 'לצאת להשאלה',
    declineLabel: 'להישאר',
  };
}

/** Which kind of homecoming story this is. They are not the same event. */
export type { HomecomingKind };

/**
 * Which return story this is (v0.4).
 *
 * Order matters, most specific first. The boy who was released and came back a genuine star is a
 * different story from an ordinary redemption, and it is the single best story this game can
 * tell - so it is checked before everything else.
 */
export function homecomingKind(career: Career): HomecomingKind {
  const wasReleased =
    career.flags.includes('released_by_maccabi') || hasMemory(career, 'released_by_maccabi');

  if (wasReleased && career.ability >= HOMECOMING.primeAbility) return 'rejected_child_star';
  if (wasReleased && !career.maccabi.everLeft) return 'redemption';

  if (career.age >= HOMECOMING.veteranAge) return 'veteran_farewell';

  // Coming home to lead is about standing in a dressing room, not raw ability.
  if (
    career.hidden.leadership >= HOMECOMING.leaderLeadership &&
    career.age >= HOMECOMING.leaderMinAge &&
    (career.captain || hasTrait(career, 'leader'))
  ) {
    return 'returning_leader';
  }

  // A real European career behind him changes what the return means to everyone.
  if (hasMemory(career, 'first_move_abroad') && career.reputation >= HOMECOMING.europeReputation) {
    return 'european_returnee';
  }

  if (career.age <= HOMECOMING.primeMaxAge && career.ability >= HOMECOMING.primeAbility) {
    return 'prime_hero';
  }
  return 'successful_return';
}

/**
 * Whether Maccabi would make the call at all.
 *
 * The relationship system finally makes this answerable properly: a player who left them for a
 * domestic rival does not get a homecoming, however good he is. That is not a balance decision,
 * it is the same rule the crowd applies.
 */
export function homecomingPossible(career: Career): boolean {
  return maccabiRelationship(career) !== 'traitor';
}

const HOMECOMING_COPY: Record<HomecomingKind, { title: string; description: string; maccabism: number }> = {
  prime_hero: {
    title: 'מכבי חיפה רוצה אותך בחזרה - עכשיו',
    description:
      'אתה בשיא, ויש לך חוזה שאומר את זה. במכבי יודעים כמה זה יעלה, ובכל זאת הרימו טלפון. יציע שלם מחכה לתשובה.',
    maccabism: 24,
  },
  successful_return: {
    title: 'מכבי חיפה רוצה אותך בחזרה',
    description:
      'המועדון שגידל אותך רוצה שתחזור הביתה. פחות כסף, פחות זוהר, ואצטדיון שיודע את השם שלך.',
    maccabism: 18,
  },
  veteran_farewell: {
    title: 'לסגור מעגל בירוק',
    description:
      'לא בשביל הכדורגל - בשביל הסיפור. לסיים במקום שבו התחלת, מול הקהל שראה אותך בן תשע.',
    maccabism: 14,
  },
  redemption: {
    title: 'המועדון שוויתר עליך רוצה אותך בחזרה',
    description:
      'שחררו אותך בגיל 18 ואמרו שאתה לא מספיק. עכשיו הם מתקשרים. יש בזה משהו מתוק ומר בו-זמנית.',
    maccabism: 20,
  },
  rejected_child_star: {
    title: 'הילד ששחררו חוזר ככוכב',
    description:
      'הם אמרו לך שאתה לא מספיק טוב, ואתה הלכת והפכת לאחד הטובים בליגה. עכשיו הם מבקשים ממך לחזור, ואתה זה שמחזיק את הטלפון.',
    maccabism: 26,
  },
  returning_leader: {
    title: 'הם צריכים מישהו שיוביל',
    description:
      'חדר הלבשה צעיר, עונה קשה מאחור, ומועדון שמחפש מבוגר אחראי שיחזיק את זה. הם חושבים שזה אתה.',
    maccabism: 20,
  },
  european_returnee: {
    title: 'חזרה מאירופה',
    description:
      'עשית את הדרך החוצה, וזה הצליח. עכשיו יש שיחה על לסגור את המעגל - עם שם שכבר לא צריך הסבר.',
    maccabism: 22,
  },
};

export function buildReturnHomeOffer(career: Career): TransferOffer {
  const club = getClub(MACCABI_ID);
  const kind = homecomingKind(career);
  const copy = HOMECOMING_COPY[kind];

  /*
   * The league comes from the live world state (v0.4.1), not from the club record.
   *
   * `club.league` is the static "ליגת העל" written in the data. If Maccabi have been relegated,
   * the homecoming offer was still advertising the top flight - and if they had climbed back, it
   * would have been right again by accident. A player deciding whether to go home has to be told
   * which division he would actually be playing in.
   */
  const league = leagueOf(career.world, MACCABI_ID);
  const role = expectedRoleAt(career, club, career.currentSeason);
  const inSecondDivision = league.tier >= 2;

  return {
    id: 'return_maccabi',
    kind: 'return_home',
    clubId: club.id,
    clubName: club.name,
    league: league.name,
    country: club.country,
    leagueId: league.id,
    leagueLevel: Math.round(leagueLevel(league)),
    expectedRole: role,
    direction: moveDirection(career, club),
    hints: offerHints(career, club, role, career.currentSeason),
    title: copy.title,
    description:
      copy.description +
      (inSecondDivision
        ? ' הם בליגה הלאומית עכשיו. זה חלק מהעסקה.'
        : ''),
    acceptEffects: {
      maccabism: copy.maccabism,
      confidence: 5,
      reputation: kind === 'prime_hero' ? 2 : -2,
      flags: ['loyalty_moment'],
      remember: 'returned_home',
      milestone: {
        // Same id as the automatic check in milestones.ts, so the richer copy here wins and
        // the generic one is deduplicated away rather than both appearing.
        id: 'returned_home',
        icon: '💚',
        text:
          kind === 'prime_hero'
            ? 'חזרת הביתה בשיא הקריירה'
            : kind === 'redemption'
              ? 'חזרת למועדון שוויתר עליך'
              : 'חזרת הביתה למכבי חיפה',
        major: true,
      },
    },
    declineEffects: { maccabism: -9, remember: 'rejected_maccabi' },
    acceptLabel: 'לחזור הביתה',
    declineLabel: 'עוד לא',
  };
}

function releaseOffer(club: Club): TransferOffer {
  return {
    id: `release_${club.id}`,
    kind: 'release',
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    country: club.country,
    title: `${club.name} מציעה לך חוזה`,
    description: `במכבי חיפה החליטו לא להמשיך איתך. ${club.name} מ${club.league} מוכנה לתת לך במה. לא ככה דמיינת את זה, אבל זה כדורגל.`,
    acceptEffects: {
      maccabism: -8,
      confidence: -6,
      flags: ['released_by_maccabi'],
      remember: 'released_by_maccabi',
      milestone: {
        id: 'released_by_maccabi',
        icon: '🚪',
        text: `מכבי חיפה לא המשיכה איתך. חתמת ב${club.name}`,
        major: true,
      },
    },
    declineEffects: {},
    acceptLabel: 'לחתום',
    declineLabel: '',
    mandatory: true,
  };
}

/* ------------------------------------------------------------------ */
/* Youth -> senior: the biggest moment of the youth career             */
/* ------------------------------------------------------------------ */

export type SeniorPath = 'contract' | 'contract_loan' | 'another_year' | 'released';

export interface SeniorVerdict {
  path: SeniorPath;
  score: number;
  title: string;
  description: string;
  icon: string;
}

/** How ready the נוער player looks to the first team. */
export function seniorReadinessScore(career: Career, rng: Rng): number {
  return (
    career.ability * YOUTH_TO_SENIOR.abilityWeight +
    career.coachTrust * YOUTH_TO_SENIOR.coachTrustWeight +
    career.hidden.potential * YOUTH_TO_SENIOR.potentialWeight +
    career.reputation * YOUTH_TO_SENIOR.reputationWeight +
    career.hidden.form * YOUTH_TO_SENIOR.formWeight +
    (career.flags.includes('first_team_radar') ? 6 : 0) +
    (career.flags.includes('tournament_star') ? 4 : 0) +
    (career.flags.includes('discipline_problem') ? -6 : 0) +
    rng.gaussian(0, YOUTH_TO_SENIOR.noise)
  );
}

/**
 * The verdict at the end of נוער. Four paths, and only one of them ends the Maccabi story -
 * and even that one is a beginning, not an ending.
 */
export function evaluateSeniorTransition(career: Career, rng: Rng): SeniorVerdict {
  const score = seniorReadinessScore(career, rng);
  /*
   * Once the player's own birth cohort has reached senior football, there is no youth team
   * left for him to spend another year in (v0.4 Phase 0.3). Keeping him in נוער past that
   * point was the engine quietly violating its own cohort model to delay a hard decision.
   *
   * A player pushed up early can still legitimately get another נוער season - his cohort has
   * not arrived yet - which is why this asks the cohort rather than his age.
   */
  const cohortStillYouth = stageOrder(nextNaturalStage(career)) <= stageOrder('u19');
  const mustDecide =
    !cohortStillYouth ||
    career.age >= YOUTH_TO_SENIOR.decisionAge ||
    career.seasonsAtStage >= 2;

  if (score >= YOUTH_TO_SENIOR.contractThreshold) {
    const withLoan = rng.chance(YOUTH_TO_SENIOR.loanRecommendationChance);
    return withLoan
      ? {
          path: 'contract_loan',
          score,
          title: 'חוזה בוגרים - והשאלה',
          description:
            'מכבי חיפה חותמת איתך חוזה בוגרים. מנהל הספורט אומר בפה מלא שהתוכנית היא עונה אחת בהשאלה, ואז חזרה הביתה.',
          icon: '📄',
        }
      : {
          path: 'contract',
          score,
          title: 'חתמת חוזה בוגרים!',
          description:
            'הדבר שרדפת אחריו מגיל תשע. חולצה של הקבוצה הבוגרת של מכבי חיפה, עם המספר שלך על הגב.',
          icon: '💚',
        };
  }

  if (score >= YOUTH_TO_SENIOR.loanThreshold) {
    return {
      path: 'contract_loan',
      score,
      title: 'חוזה - אבל לא כאן, עדיין',
      description:
        'המועדון מאמין בך מספיק כדי לחתום, ולא מספיק כדי לשחק. יוצאים להשאלה ומוכיחים.',
      icon: '📄',
    };
  }

  if (score >= YOUTH_TO_SENIOR.anotherYearThreshold && !mustDecide) {
    return {
      path: 'another_year',
      score,
      title: 'עוד עונה בנוער',
      description:
        'עוד לא. במועדון רוצים לראות אותך עוד שנה בנוער לפני שמחליטים. הדלת לא נסגרה.',
      icon: '⏳',
    };
  }

  return {
    path: 'released',
    score,
    title: 'לא קיבלת חוזה',
    description:
      'עשית את כל הדרך מטרום ב׳, וזה נגמר בשיחה של ארבע דקות. אבל קריירה לא נגמרת בגיל 18 - היא רק מתחילה במקום אחר.',
    icon: '🚪',
  };
}

/** Builds the offers the player chooses between after the נוער verdict. */
export function seniorTransitionOffers(
  career: Career,
  verdict: SeniorVerdict,
  rng: Rng,
): TransferOffer[] {
  if (verdict.path === 'contract' || verdict.path === 'contract_loan') {
    const club = getClub(MACCABI_ID);
    const offers: TransferOffer[] = [
      {
        id: 'senior_contract',
        kind: 'promotion',
        clubId: club.id,
        clubName: club.name,
        league: club.league,
        country: club.country,
        title: 'לחתום בבוגרים של מכבי חיפה',
        description:
          'החולצה הירוקה של הקבוצה הראשונה. מכאן זה כבר כדורגל של גברים.',
        acceptEffects: { maccabism: 12, confidence: 8, reputation: 6 },
        declineEffects: {},
        acceptLabel: 'לחתום',
        declineLabel: '',
      },
    ];

    if (verdict.path === 'contract_loan') {
      const destinations = ALL_CLUBS.filter(
        (c) => c.tier === 'israeli_mid' || c.tier === 'israeli_low',
      );
      const chosen = rng.weighted(destinations, (c) => interestWeight(career, c) + 0.25);
      if (chosen) {
        offers.push({
          id: `senior_loan_${chosen.id}`,
          kind: 'loan',
          clubId: chosen.id,
          clubName: chosen.name,
          league: chosen.league,
          country: chosen.country,
          title: `לחתום ולצאת להשאלה ל${chosen.name}`,
          description: `לחתום במכבי ולצאת מיד ל${chosen.name} - שם תשחק כל שבוע במקום לחכות בתור.`,
          acceptEffects: { maccabism: 8, confidence: 5, reputation: 4 },
          declineEffects: {},
          acceptLabel: 'לחתום ולצאת להשאלה',
          declineLabel: '',
        });
      }
    }
    return offers;
  }

  if (verdict.path === 'released') {
    /*
     * Two real alternatives - being released is a fork in the story, not the end of it.
     *
     * Deliberately no israeli_top here: a club that has just decided not to keep an 18 year
     * old does not hand him to the best side in the league, and landing at quality 66+ would
     * bury him on the bench and quietly end the career. The story continues further down the
     * pyramid, where he actually plays.
     */
    const destinations = ALL_CLUBS.filter(
      (c) => c.tier === 'israeli_mid' || c.tier === 'israeli_low',
    ).filter((c) => c.id !== MACCABI_ID);
    const offers: TransferOffer[] = [];
    // The floor stays small so club fit dominates - otherwise every club looks equally likely
    // to a low-value player, whose real interest weights are all near zero.
    const first = rng.weighted(destinations, (c) => interestWeight(career, c) + RELEASE_INTEREST_FLOOR);
    if (first) offers.push(releaseOffer(first));
    const second = rng.weighted(
      destinations.filter((c) => c.id !== first?.id),
      (c) => interestWeight(career, c) + RELEASE_INTEREST_FLOOR,
    );
    if (second) offers.push(releaseOffer(second));
    return offers;
  }

  return [];
}

/** Applies a "one more youth season" verdict. */
export function stayAnotherYouthYear(career: Career): Career {
  const next = cloneCareer(career);
  next.academyStage = 'u19';
  next.seasonsAtStage += 1;
  next.hidden.promotionBoost += 4;
  return next;
}

/* ------------------------------------------------------------------ */
/* Senior offers                                                       */
/* ------------------------------------------------------------------ */

/** Offers waiting for a senior player at the end of a season. Usually none. */
export function generateOffers(career: Career, rng: Rng): TransferOffer[] {
  if (isInAcademy(career)) return [];

  const offers: TransferOffer[] = [];
  const club = getClub(career.currentClubId);

  /* ---------- squeezed out of the squad ---------- */
  if (isAtMaccabiSenior(career) && !isOnLoan(career) && career.age >= 22) {
    const recent = career.seasonHistory.slice(-2);
    const starved =
      recent.length === 2 &&
      recent.every((s) => s.stats.appearances < 10) &&
      career.roleValue < 50;
    if (starved) {
      const destinations = ALL_CLUBS.filter(
        (c) =>
          c.isSenior &&
          (c.tier === 'israeli_mid' || c.tier === 'israeli_low' || c.tier === 'israeli_top'),
      ).filter((c) => c.id !== MACCABI_ID);
      const chosen = rng.weighted(destinations, (c) => interestWeight(career, c) + 0.2);
      if (chosen) return [releaseOffer(chosen)];
    }
  }

  /* ---------- loan (v0.4: any club, not just Maccabi, and a real choice) ---------- */
  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;
  const loanEligible =
    !isOnLoan(career) &&
    career.age >= TRANSFERS.loanMinAge &&
    career.age <= TRANSFERS.loanMaxAge &&
    lastApps <= TRANSFERS.loanMaxAppearances;
  /*
   * v0.5, Phase 35: a networker's speciality is knowing where a young player would actually
   * play. The agent factor multiplies the chance the loan conversation happens; eligibility
   * above stays exactly the world's own rule.
   */
  if (
    loanEligible &&
    rng.chance((TRANSFERS.loanChance + career.hidden.transferBoost * 0.5) * agentLoanFactor(career))
  ) {
    offers.push(...buildLoanOffers(career, rng));
  }

  /* ---------- homecoming ---------- */
  if (!club.isMaccabi && !isOnLoan(career)) {
    let chance =
      TRANSFERS.returnBaseChance +
      career.maccabism * TRANSFERS.returnMaccabismWeight +
      career.hidden.transferBoost * 0.5;
    if (career.age >= TRANSFERS.returnAgeBonusFrom) {
      chance += (career.age - TRANSFERS.returnAgeBonusFrom) * TRANSFERS.returnAgeBonusPerYear;
    }
    /*
     * A homecoming has to feel like an event, not an annual reminder. Maccabi has to
     * actually want the player: good enough for the level, not priced out, and either a
     * genuine former Maccabist or someone who has made a name worth bringing home.
     */
    const maccabi = getClub(MACCABI_ID);
    const goodEnough = career.ability >= maccabi.quality - TRANSFERS.returnAbilityMargin;
    const notTooExpensive = career.reputation < 88 || career.age > 29;
    const ourOwn =
      career.maccabi.everLeft ||
      career.flags.includes('released_by_maccabi') ||
      career.maccabi.academyGraduate;
    // Coming home twice is not a story, it is a commute.
    const notAlreadyBack = !career.maccabi.returned;

    if (
      goodEnough &&
      notTooExpensive &&
      ourOwn &&
      notAlreadyBack &&
      homecomingPossible(career) &&
      rng.chance(clamp(chance, 0, 0.5))
    ) {
      offers.push(buildReturnHomeOffer(career));
    }
  }

  /*
   * ---------- the career ladder (v0.4) ----------
   *
   * Two independent draws, so a career can move in either direction and sometimes gets a
   * genuine choice between them. Upward interest comes from having done well; downward
   * interest comes from not playing, and is what stops a career from silently dying on a
   * bench it cannot leave.
   */
  if (!isOnLoan(career)) {
    if (rng.chance(offerChance(career))) {
      const up = drawDestination(career, rng, (c) => !isDownwardMove(moveDirection(career, c)));
      if (up) offers.push(transferOffer(up, career, rng));
    }

    // Not playing, or going backwards: clubs lower down come calling.
    const fading = isStagnating(career) || careerTrajectory(career) === 'down';
    if (fading && rng.chance(TRANSFERS.stepDownChance)) {
      const down = drawDestination(career, rng, (c) => isDownwardMove(moveDirection(career, c)));
      if (down && !offers.some((o) => o.clubId === down.id)) {
        offers.push(transferOffer(down, career, rng));
      }
    }
  }

  return offers.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Loans (v0.4 Phase 3)                                                */
/* ------------------------------------------------------------------ */

/**
 * A loan should be a decision, not a formality.
 *
 * Offers up to two destinations at different levels, so the obvious choice is never simply
 * "the bigger club": a rotation role at a top-flight side against near-guaranteed football a
 * division below is exactly the dilemma young players actually face.
 */
export function buildLoanOffers(career: Career, rng: Rng): TransferOffer[] {
  const offers: TransferOffer[] = [];

  // Somewhere he would be a regular - usually a level down.
  const regular = drawDestination(
    career,
    rng,
    (club) => EXPECTED_ROLE_MINUTES[expectedRoleAt(career, club, career.currentSeason)] >= 0.7,
  );
  if (regular) offers.push(loanOffer(regular, career));

  // Somewhere better, where he would have to fight for it.
  const tougher = drawDestination(
    career,
    rng,
    (club) =>
      club.id !== regular?.id &&
      !isDownwardMove(moveDirection(career, club)) &&
      EXPECTED_ROLE_MINUTES[expectedRoleAt(career, club, career.currentSeason)] < 0.7,
  );
  if (tougher) offers.push(loanOffer(tougher, career));

  return offers;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export function acceptOffer(career: Career, offerId: string, rng: Rng): Career {
  const offer = career.pendingOffers.find((o) => o.id === offerId);
  if (!offer) return career;

  /*
   * An accepted offer is a decision about leaving or coming back, so its Maccabism effect is
   * licensed (v0.4.8). `leavingContext` returns zero when the club being left is not Maccabi's,
   * so declaring relevance here cannot smuggle a delta into an unrelated move.
   */
  let next = applyEffects(career, offer.acceptEffects, rng, offerRelevance(offer), `offer:${offer.id}`).career;
  const cameFromAcademy = isInAcademy(career);

  if (offer.kind === 'loan') {
    // A youth player signing straight into a loan still belongs to Maccabi.
    if (cameFromAcademy) {
      next = moveToClub(next, MACCABI_ID);
      next = moveToClub(next, offer.clubId, { loan: true, loanSeasons: 1 });
    } else {
      next = moveToClub(next, offer.clubId, { loan: true, loanSeasons: 1 });
    }
  } else {
    next = moveToClub(next, offer.clubId, offer.expectedRole ? { expectedRole: offer.expectedRole } : {});
  }

  if (cameFromAcademy && (offer.kind === 'promotion' || offer.kind === 'loan')) {
    next = cloneCareer(next);
    next.maccabi.academyGraduate = true;
  }

  /*
   * Which return story this was, recorded at the moment it happened (v0.4).
   *
   * It has to be stored rather than recomputed: homecomingKind reads age, ability and standing,
   * all of which have moved on by the time anyone looks at a finished career - so recomputing it
   * at retirement made every homecoming look like a veteran's farewell.
   */
  if (offer.kind === 'return_home') {
    next = cloneCareer(next);
    next.maccabi.returnKind = homecomingKind(career);
  }

  next = cloneCareer(next);
  next.pendingOffers = [];
  return next;
}

export function declineAllOffers(career: Career, rng: Rng): Career {
  let next = career;
  for (const offer of career.pendingOffers) {
    if (offer.mandatory) continue;
    next = applyEffects(next, offer.declineEffects, rng, offerRelevance(offer), `offer:decline:${offer.id}`).career;
  }
  next = cloneCareer(next);
  next.pendingOffers = [];
  return next;
}

/**
 * Loan expiry happens without a decision.
 *
 * This runs at the top of the new season, before a ball is kicked, so it must only count down a
 * loan the player has actually *played*. A loan agreed in the summer has `lastSeasonRecord` still
 * pointing at the parent club; without that guard a one-season loan expired the instant it was
 * signed and the player was back home having never appeared for the loan club.
 */
export function applyAutomaticMoves(career: Career): Career {
  let next = career;
  const parentClubId = next.parentClubId;
  if (parentClubId !== null && next.lastSeasonRecord?.clubId === next.currentClubId) {
    next = cloneCareer(next);
    next.loanSeasonsLeft -= 1;
    if (next.loanSeasonsLeft <= 0) {
      next = moveToClub(next, parentClubId, { returningFromLoan: true });
    }
  }
  return next;
}

/** Progression result shown when the youth verdict sends the player elsewhere. */
export function verdictToProgression(
  career: Career,
  verdict: SeniorVerdict,
): ProgressionResult {
  return {
    /*
     * "another year in נוער" is a genuine extra year - נוער is the top of the ladder, so there
     * is no cohort above it to move up to, and the club choosing to keep him another season is
     * a real decision rather than the invalid academy repeat that v0.3.1 removed.
     */
    kind:
      verdict.path === 'released'
        ? 'released'
        : verdict.path === 'another_year'
          ? 'cohort_caught_up'
          : 'senior',
    fromStage: career.academyStage,
    toStage: verdict.path === 'another_year' ? 'u19' : 'senior',
    title: verdict.title,
    detail: verdict.description,
    icon: verdict.icon,
    major: true,
  };
}

/**
 * What a transfer offer is, in Maccabism terms (v0.4.8).
 *
 * A return-home offer is a decision about coming back; everything else that carries a Maccabism
 * effect is a decision about leaving. The guard needs one of the two, and `leavingContext` has
 * already zeroed the delta for moves that do not involve Maccabi at all.
 */
function offerRelevance(offer: TransferOffer): MaccabiRelevance {
  return offer.kind === 'return_home' ? 'return' : 'leaving';
}

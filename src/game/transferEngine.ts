/**
 * Transfers, loans, the youth -> senior transition, and the homecoming mechanic.
 *
 * Nothing here is a hard threshold like `ability > 80 => Premier League`.
 * Destinations are drawn with weighted eligibility, so a great season improves your
 * chances without ever guaranteeing a specific club.
 */

import { ALL_CLUBS, getClub, MACCABI_ID } from '../data/clubs';
import type { Career, Club, ProgressionResult, TransferOffer } from '../types';
import { TRANSFERS, YOUTH_TO_SENIOR } from './balance';
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

function transferableClubs(career: Career): Club[] {
  return ALL_CLUBS.filter(
    (club) => club.isSenior === true && club.id !== career.currentClubId && club.id !== MACCABI_ID,
  );
}

function offerChance(career: Career): number {
  const lastRating = career.lastSeasonRecord?.stats.rating ?? 55;
  const raw =
    TRANSFERS.baseOfferChance +
    career.reputation * TRANSFERS.reputationWeight +
    (lastRating - 58) * TRANSFERS.ratingWeight -
    Math.abs(career.age - TRANSFERS.peakAge) * TRANSFERS.ageFalloff +
    career.hidden.transferBoost;
  return clamp(raw, 0, 0.95) as number;
}

/* ------------------------------------------------------------------ */
/* Offer builders                                                      */
/* ------------------------------------------------------------------ */

function transferOffer(club: Club, career: Career): TransferOffer {
  const abroad = club.country !== 'ישראל';
  return {
    id: `transfer_${club.id}`,
    kind: 'transfer',
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    country: club.country,
    title: abroad ? `הצעה מ${club.name}` : `${club.name} רוצה אותך`,
    description: abroad
      ? `${club.name} מ${club.country} הגישה הצעה רשמית. ${club.league}, אצטדיון אחר, שפה אחרת.`
      : `${club.name} מציעה לך חוזה ומקום מרכזי בקבוצה.`,
    acceptEffects: {
      reputation: abroad ? 6 : 1,
      maccabism: isAtMaccabiSenior(career) ? -10 : abroad ? -4 : -2,
      confidence: 4,
      flags: isAtMaccabiSenior(career) ? ['betrayal_moment'] : [],
    },
    declineEffects: {
      maccabism: isAtMaccabiSenior(career) ? 7 : 0,
      roleValue: isAtMaccabiSenior(career) ? 2 : 0,
      flags: isAtMaccabiSenior(career) ? ['loyalty_moment'] : [],
    },
    acceptLabel: 'לחתום',
    declineLabel: 'לסרב',
  };
}

function loanOffer(club: Club): TransferOffer {
  return {
    id: `loan_${club.id}`,
    kind: 'loan',
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    country: club.country,
    title: `השאלה ל${club.name}`,
    description: `${club.name} רוצה אותך בהשאלה לעונה. שם תשחק כל שבוע - ותחזור לחיפה עם משחקים ברגליים.`,
    acceptEffects: { confidence: 3 },
    declineEffects: { maccabism: 3, minutesModifier: 0.85 },
    acceptLabel: 'לצאת להשאלה',
    declineLabel: 'להישאר',
  };
}

function returnHomeOffer(career: Career): TransferOffer {
  const club = getClub(MACCABI_ID);
  const isComingBack = career.maccabi.everLeft || career.flags.includes('released_by_maccabi');
  return {
    id: 'return_maccabi',
    kind: 'return_home',
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    country: club.country,
    title: isComingBack ? 'מכבי חיפה רוצה אותך בחזרה' : 'מכבי חיפה מציעה לך חוזה',
    description: isComingBack
      ? 'המועדון שגידל אותך רוצה שתחזור הביתה. פחות כסף, פחות זוהר, ואצטדיון שיודע את השם שלך.'
      : 'מכבי חיפה מציעה לך לחזור למקום שממנו התחלת הכול.',
    acceptEffects: { maccabism: 16, confidence: 5, reputation: -2, flags: ['loyalty_moment'] },
    declineEffects: { maccabism: -9 },
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
    acceptEffects: { maccabism: -8, confidence: -6, flags: ['released_by_maccabi'] },
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
  const mustDecide =
    career.age >= YOUTH_TO_SENIOR.decisionAge || career.seasonsAtStage >= 2;

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

  /* ---------- loan ---------- */
  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;
  const loanEligible =
    isAtMaccabiSenior(career) &&
    !isOnLoan(career) &&
    career.age >= TRANSFERS.loanMinAge &&
    career.age <= TRANSFERS.loanMaxAge &&
    lastApps <= TRANSFERS.loanMaxAppearances;
  if (loanEligible && rng.chance(TRANSFERS.loanChance + career.hidden.transferBoost * 0.5)) {
    const destinations = ALL_CLUBS.filter(
      (c) => c.tier === 'israeli_mid' || c.tier === 'israeli_low' || c.tier === 'israeli_top',
    ).filter((c) => c.id !== MACCABI_ID);
    const chosen = rng.weighted(destinations, (c) => interestWeight(career, c) + 0.2);
    if (chosen) offers.push(loanOffer(chosen));
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
    // Measured against Maccabi's own squad strength rather than a flat number, so a
    // mid-table journeyman does not get a call from the club that let him go.
    const maccabi = getClub(MACCABI_ID);
    const goodEnough = career.ability >= maccabi.quality - TRANSFERS.returnAbilityMargin;
    const notTooExpensive = career.reputation < 88 || career.age > 29;
    if (goodEnough && notTooExpensive && rng.chance(clamp(chance, 0, 0.85))) {
      offers.push(returnHomeOffer(career));
    }
  }

  /* ---------- regular transfer ---------- */
  if (!isOnLoan(career) && rng.chance(offerChance(career))) {
    const candidates = transferableClubs(career);
    const chosen = rng.weighted(candidates, (c) => interestWeight(career, c));
    if (chosen) offers.push(transferOffer(chosen, career));
  }

  return offers.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export function acceptOffer(career: Career, offerId: string, rng: Rng): Career {
  const offer = career.pendingOffers.find((o) => o.id === offerId);
  if (!offer) return career;

  let next = applyEffects(career, offer.acceptEffects, rng).career;
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
    next = moveToClub(next, offer.clubId);
  }

  if (cameFromAcademy && (offer.kind === 'promotion' || offer.kind === 'loan')) {
    next = cloneCareer(next);
    next.maccabi.academyGraduate = true;
  }

  next = cloneCareer(next);
  next.pendingOffers = [];
  return next;
}

export function declineAllOffers(career: Career, rng: Rng): Career {
  let next = career;
  for (const offer of career.pendingOffers) {
    if (offer.mandatory) continue;
    next = applyEffects(next, offer.declineEffects, rng).career;
  }
  next = cloneCareer(next);
  next.pendingOffers = [];
  return next;
}

/** Loan expiry happens without a decision. */
export function applyAutomaticMoves(career: Career): Career {
  let next = career;
  const parentClubId = next.parentClubId;
  if (parentClubId !== null) {
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
    kind: verdict.path === 'released' ? 'released' : verdict.path === 'another_year' ? 'stay' : 'senior',
    fromStage: career.academyStage,
    toStage: verdict.path === 'another_year' ? 'u19' : 'senior',
    title: verdict.title,
    detail: verdict.description,
    icon: verdict.icon,
    major: true,
  };
}

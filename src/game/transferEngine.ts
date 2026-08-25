/**
 * Transfers, loans, promotions, releases and the homecoming mechanic.
 *
 * Nothing here is a hard threshold like `ability > 80 => Premier League`.
 * Destinations are drawn with weighted eligibility, so a great season improves your
 * chances without ever guaranteeing a specific club.
 */

import {
  ALL_CLUBS,
  getClub,
  MACCABI_ACADEMY_ID,
  MACCABI_ID,
  MACCABI_YOUTH_ID,
} from '../data/clubs';
import type { Career, Club, TransferOffer } from '../types';
import { TRANSFERS } from './balance';
import { applyEffects, cloneCareer, moveToClub } from './progressionEngine';
import { clamp, type Rng } from './random';
import { isAtMaccabiSenior, isOnLoan } from './rules';

/** A rough 0-100 read of how attractive the player is on the market. */
export function marketValue(career: Career): number {
  return clamp(career.ability * 0.5 + career.reputation * 0.55 + career.statusValue * 0.08);
}

/** Weighted eligibility: clubs near (or a bit above) the player's level are the likeliest. */
export function interestWeight(career: Career, club: Club): number {
  const value = marketValue(career);
  const clubLevel = club.quality * 0.6 + club.prestige * 0.55;
  const diff = clubLevel - value;
  // Sweet spot is slightly above the player's current level.
  const base = Math.max(0, 1 - Math.abs(diff - 4) / 26);
  const tierMultiplier =
    club.tier === 'euro_top' ? 0.5 : club.tier === 'euro_mid' ? 0.85 : club.tier === 'euro_dev' ? 1.1 : 1;
  const ageMultiplier = career.age <= 27 ? 1 : Math.max(0.25, 1 - (career.age - 27) * 0.12);
  return base * tierMultiplier * ageMultiplier;
}

function transferableClubs(career: Career): Club[] {
  return ALL_CLUBS.filter(
    (club) =>
      club.isSenior === true && club.id !== career.currentClubId && club.id !== MACCABI_ID,
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
      ? `${club.name} מ${club.country} הגישה הצעה רשמית. ${club.league}, אצטדיון אחר, שפה אחרת - וקפיצת מדרגה בקריירה.`
      : `${club.name} מציעה לך חוזה ומקום מרכזי בקבוצה.`,
    acceptEffects: {
      reputation: abroad ? 6 : 1,
      maccabism: isAtMaccabiSenior(career) ? -10 : abroad ? -4 : -2,
      confidence: 4,
      flags: isAtMaccabiSenior(career) ? ['betrayal_moment'] : [],
    },
    declineEffects: {
      maccabism: isAtMaccabiSenior(career) ? 7 : 0,
      statusValue: isAtMaccabiSenior(career) ? 2 : 0,
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
  const isComingBack = career.maccabi.everLeft;
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

function promotionOffer(): TransferOffer {
  const club = getClub(MACCABI_ID);
  return {
    id: 'promotion_senior',
    kind: 'promotion',
    clubId: club.id,
    clubName: club.name,
    league: club.league,
    country: club.country,
    title: 'עולים לבוגרים',
    description:
      'המועדון מעלה אותך רשמית לסגל הבוגרים של מכבי חיפה. החולצה הירוקה, האמיתית, עם המספר על הגב.',
    acceptEffects: { maccabism: 10, confidence: 6, reputation: 4 },
    declineEffects: {},
    acceptLabel: 'לחתום ולעלות',
    declineLabel: '',
    mandatory: true,
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
    title: `לא נשארת. ${club.name} מציעה חוזה.`,
    description: `מכבי חיפה החליטה לא להמשיך איתך. ${club.name} מ${club.league} מוכנה לתת לך במה. לא ככה דמיינת את זה, אבל זה כדורגל.`,
    acceptEffects: { maccabism: -8, confidence: -6 },
    declineEffects: {},
    acceptLabel: 'לחתום',
    declineLabel: '',
    mandatory: true,
  };
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Builds the offers waiting for the player at the end of a season.
 * Returns an empty array most seasons - not every summer brings a decision.
 */
export function generateOffers(career: Career, rng: Rng): TransferOffer[] {
  const offers: TransferOffer[] = [];
  const club = getClub(career.currentClubId);
  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;

  /* ---------- academy pathway ---------- */
  if (club.id === MACCABI_YOUTH_ID) {
    const readiness = career.ability + career.statusValue * 0.25 + rng.range(-6, 6);
    if (career.age >= 17 && readiness >= 62) return [promotionOffer()];
    if (career.age >= TRANSFERS.releaseAge && career.ability < TRANSFERS.releaseAbilityThreshold) {
      const destinations = ALL_CLUBS.filter(
        (c) => c.tier === 'israeli_low' || c.tier === 'israeli_mid',
      );
      const chosen = rng.weighted(destinations, (c) => interestWeight(career, c) + 0.15);
      if (chosen) return [releaseOffer(chosen)];
    }
    if (career.age >= 19 && readiness >= 55) return [promotionOffer()];
    return [];
  }
  if (club.tier === 'academy') return [];

  /* ---------- loan ---------- */
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

  /* ---------- squeezed out of the squad ---------- */
  if (isAtMaccabiSenior(career) && !isOnLoan(career) && career.age >= 22) {
    const recent = career.seasonHistory.slice(-2);
    const starved =
      recent.length === 2 && recent.every((s) => s.stats.appearances < 10) && career.statusValue < 50;
    if (starved) {
      const destinations = ALL_CLUBS.filter(
        (c) => c.isSenior && (c.tier === 'israeli_mid' || c.tier === 'israeli_low' || c.tier === 'israeli_top'),
      ).filter((c) => c.id !== MACCABI_ID);
      const chosen = rng.weighted(destinations, (c) => interestWeight(career, c) + 0.2);
      if (chosen) return [releaseOffer(chosen)];
    }
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
    // Maccabi only comes calling for players who can actually help them.
    const goodEnough = career.ability >= 55;
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

  if (offer.kind === 'loan') {
    next = moveToClub(next, offer.clubId, { loan: true, loanSeasons: 1 });
  } else {
    const wasYouth = next.currentClubId === MACCABI_YOUTH_ID;
    next = moveToClub(next, offer.clubId);
    if (offer.kind === 'promotion' && wasYouth) {
      next = cloneCareer(next);
      next.maccabi.academyGraduate = true;
    }
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

/* ------------------------------------------------------------------ */
/* Automatic movements                                                 */
/* ------------------------------------------------------------------ */

/** Loan expiry and the academy -> youth step happen without a decision. */
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

  if (next.currentClubId === MACCABI_ACADEMY_ID && next.age >= 13) {
    next = moveToClub(next, MACCABI_YOUTH_ID);
  }

  return next;
}

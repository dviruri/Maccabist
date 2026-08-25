/**
 * Every tunable number in the game lives here.
 * If you want to rebalance Maccabist, this is the file you edit first.
 */

import type { Position, TeamRole } from '../types';

export const START_AGE = 9;
export const START_SEASON_MIN = 2028;
export const START_SEASON_MAX = 2034;

/** Retirement can start being offered here; it becomes increasingly likely afterwards. */
export const RETIREMENT_MIN_AGE = 33;
export const RETIREMENT_FORCED_AGE = 41;

/* ------------------------------------------------------------------ */
/* Team role ladder                                                    */
/* ------------------------------------------------------------------ */

export const ROLE_TIERS: ReadonlyArray<{ role: TeamRole; min: number }> = [
  { role: 'icon', min: 90 },
  { role: 'star', min: 78 },
  { role: 'key', min: 64 },
  { role: 'starter', min: 50 },
  { role: 'rotation', min: 32 },
  { role: 'squad', min: 0 },
];

export const ROLE_LABELS: Record<TeamRole, string> = {
  squad: 'שחקן סגל',
  rotation: 'שחקן רוטציה',
  starter: 'שחקן הרכב',
  key: 'שחקן מוביל',
  star: 'כוכב הקבוצה',
  icon: 'סמל המועדון',
};

export const ROLE_ICONS: Record<TeamRole, string> = {
  squad: '👕',
  rotation: '🔄',
  starter: '⭐',
  key: '🔑',
  star: '🌟',
  icon: '👑',
};

export const CAPTAIN_LABEL = 'קפטן';

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

export interface PositionConfig {
  id: Position;
  label: string;
  short: string;
  icon: string;
  description: string;
  /** Goals per appearance for a 70-ability player in a decent side. */
  goalRate: number;
  assistRate: number;
  cleanSheetRate: number;
  /** How much scoring output feeds the season rating. */
  outputWeight: number;
  /** Multiplies goals+assists in the Legend Score so a keeper is not punished. */
  legendOutputFactor: number;
  /** Goals conceded per appearance at a league-average level (keepers only). */
  concededRate: number;
}

export const POSITIONS: Record<Position, PositionConfig> = {
  GK: {
    id: 'GK',
    label: 'שוער',
    short: 'שוער',
    icon: '🧤',
    description: 'האחרון שנשאר. שער נקי שווה יותר מכל שער.',
    goalRate: 0.002,
    assistRate: 0.006,
    cleanSheetRate: 0.34,
    outputWeight: 0.15,
    legendOutputFactor: 6,
    concededRate: 1.15,
  },
  CB: {
    id: 'CB',
    label: 'בלם',
    short: 'בלם',
    icon: '🛡️',
    description: 'הקיר. הקהל אוהב הצלה על הקו כמו שער.',
    goalRate: 0.055,
    assistRate: 0.03,
    cleanSheetRate: 0.3,
    outputWeight: 0.3,
    legendOutputFactor: 3.2,
    concededRate: 0,
  },
  FB: {
    id: 'FB',
    label: 'מגן',
    short: 'מגן',
    icon: '🏃',
    description: 'עולה ויורד את כל הקו. ריצות בלי סוף.',
    goalRate: 0.05,
    assistRate: 0.13,
    cleanSheetRate: 0.26,
    outputWeight: 0.45,
    legendOutputFactor: 2.4,
    concededRate: 0,
  },
  CM: {
    id: 'CM',
    label: 'קשר',
    short: 'קשר',
    icon: '🎯',
    description: 'הקצב של הקבוצה עובר דרך הרגליים שלך.',
    goalRate: 0.14,
    assistRate: 0.2,
    cleanSheetRate: 0,
    outputWeight: 0.7,
    legendOutputFactor: 1.5,
    concededRate: 0,
  },
  WG: {
    id: 'WG',
    label: 'כנף',
    short: 'כנף',
    icon: '⚡',
    description: 'אחד על אחד, קו לבן, והקהל קם.',
    goalRate: 0.3,
    assistRate: 0.27,
    cleanSheetRate: 0,
    outputWeight: 0.95,
    legendOutputFactor: 1,
    concededRate: 0,
  },
  ST: {
    id: 'ST',
    label: 'חלוץ',
    short: 'חלוץ',
    icon: '🎽',
    description: 'נמדד בשערים. תמיד. גם כשלא הוגן.',
    goalRate: 0.52,
    assistRate: 0.14,
    cleanSheetRate: 0,
    outputWeight: 1.1,
    legendOutputFactor: 0.85,
    concededRate: 0,
  },
};

export const POSITION_LIST: PositionConfig[] = [
  POSITIONS.GK,
  POSITIONS.CB,
  POSITIONS.FB,
  POSITIONS.CM,
  POSITIONS.WG,
  POSITIONS.ST,
];

/* ------------------------------------------------------------------ */
/* Starting attributes                                                 */
/* ------------------------------------------------------------------ */

export const START = {
  abilityMin: 14,
  abilityMax: 24,
  /** Hidden talent ceiling, never shown to the player. */
  potentialMin: 62,
  potentialMax: 92,
  wonderkidChance: 0.07,
  wonderkidPotentialMin: 92,
  wonderkidPotentialMax: 99,
  coachTrustMin: 44,
  coachTrustMax: 62,
  maccabismMin: 55,
  maccabismMax: 75,
  reputation: 2,
  roleValue: 26,
  confidence: 55,
  form: 55,
  discipline: 60,
  injuryRisk: 16,
  pressure: 38,
};

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

export const PROGRESSION = {
  /** Base ability growth per season by age band. */
  growthByAge: [
    { maxAge: 12, growth: 3.4 },
    { maxAge: 15, growth: 4.3 },
    { maxAge: 18, growth: 4.2 },
    { maxAge: 21, growth: 3.5 },
    { maxAge: 24, growth: 2.4 },
    { maxAge: 27, growth: 1.3 },
    { maxAge: 30, growth: 0.4 },
    { maxAge: 33, growth: -1.2 },
    { maxAge: 36, growth: -2.8 },
    { maxAge: 99, growth: -4.5 },
  ],
  potentialPullStrength: 1.15,
  clubDevelopmentSwing: 0.45,
  minutesSwing: 0.6,
  ratingSwing: 0.35,
  /** Coach trust buys coaching attention, which compounds into development. */
  coachTrustSwing: 0.3,
  /**
   * Potential is a soft ceiling, not a wall. A player having an exceptional season with
   * high confidence can push past it, slowly.
   */
  overshoot: {
    /** Season rating needed before a player can grow beyond his potential. */
    minRating: 72,
    minConfidence: 62,
    /** Fraction of normal growth applied above the ceiling. */
    rate: 0.28,
    /** How far above potential a player can ever get. */
    maxAbove: 8,
  },
  confidenceBaseline: 55,
  confidenceRecovery: 0.35,
  formVolatility: 14,
};

/* ------------------------------------------------------------------ */
/* Coach trust                                                         */
/* ------------------------------------------------------------------ */

export const COACH_TRUST = {
  /** Per-half movement driven by performance rating. */
  ratingWeight: 0.22,
  ratingPivot: 57,
  /** Playing regularly keeps the coach on your side. */
  minutesWeight: 6,
  /** Discipline and form nudge it too. */
  disciplinePivot: 60,
  disciplineWeight: 0.05,
  /** Trust drifts back towards the middle - nobody stays a favourite forever for free. */
  drift: 0.06,
  driftTarget: 52,
  maxMovePerHalf: 12,
  /** How strongly trust buys playing time (added to the minutes model). */
  minutesInfluence: 0.32,
  /** How strongly trust drives the in-team role. */
  roleInfluence: 0.35,
};

/* ------------------------------------------------------------------ */
/* Season simulation                                                   */
/* ------------------------------------------------------------------ */

export const SEASON = {
  minutesBase: 0.4,
  minutesSpread: 32,
  minutesMin: 0.02,
  minutesMax: 0.98,
  /** Academy and youth teams rotate everyone - nobody is a total spectator there. */
  youthMinutesFloor: 0.3,
  /** Role contributes to the fight for minutes on top of raw ability. */
  roleWeight: 0.3,
  youngPenaltyPerYearUnder21: 0.035,
  oldPenaltyPerYearOver32: 0.05,
  /** Playing up an age group is harder - fewer minutes, faster development. */
  olderGroupMinutesPenalty: { none: 1, training: 0.94, playing: 0.82 },
  olderGroupQualityBump: { none: 0, training: 3, playing: 7 },
  olderGroupDevelopment: { none: 1, training: 1.1, playing: 1.22 },
  injuryDivisor: 190,
  injuryGamesMin: 2,
  injuryGamesMax: 12,
  ratingBase: 46,
  ratingAbilityWeight: 0.42,
  ratingFormWeight: 0.16,
  ratingConfidenceWeight: 0.07,
  ratingOutputWeight: 16,
  ratingNoise: 7,
  reputationGainMax: 12,
  reputationDecayNoMinutes: 3,
  maccabismPerSeasonAtMaccabi: 2.2,
  maccabismPerSeasonAbroad: -2.6,
  maccabismPerSeasonOtherIsraeli: -1.4,
  maccabismLoanSoftening: 0.4,
  roleMoveMax: 14,
  /** Appearances needed before a season counts towards the Maccabi legacy. */
  minAppearancesForSeason: 8,
};

/* ------------------------------------------------------------------ */
/* Academy promotion                                                   */
/* ------------------------------------------------------------------ */

export const PROMOTION = {
  /** Weights on the end-of-season promotion score. */
  coachTrustWeight: 0.42,
  roleWeight: 0.24,
  /** How far ahead of the age group the player is. */
  abilityEdgeWeight: 1.15,
  ratingWeight: 0.2,
  potentialWeight: 0.05,
  /** Playing up already proves the point. */
  olderGroupBonus: { none: 0, training: 5, playing: 11 },
  noise: 11,
  /*
   * Both thresholds are set from the measured in-play score distribution
   * (scripts/simulate.ts and the ladder diagnostic): median ~14, p95 ~30, p99 ~38.
   */
  /**
   * Score needed to skip a level entirely - up near p99, so it stays a genuine surprise.
   * At 92 it was unreachable and early promotion was dead content, firing in 0.00% of careers.
   */
  earlyThreshold: 40,
  /**
   * Score needed for the normal one-step promotion.
   *
   * At 30 this sat above the median, so ~45% of season-ends failed the roll: players repeated
   * nearly every age group and did not leave the academy until 24. The ladder is meant to run
   * roughly one stage per year from 9, with repeating a year as the exception that carries a
   * message, so this sits near p10 instead.
   */
  normalThreshold: 1,
  /** A player can only be fast-tracked so often. */
  maxEarlyPromotions: 2,
  /** Repeating a level twice in a row is not allowed - the ladder keeps moving. */
  maxSeasonsAtStage: 2,
};

/* ------------------------------------------------------------------ */
/* Youth -> senior transition                                          */
/* ------------------------------------------------------------------ */

export const YOUTH_TO_SENIOR = {
  /** Earliest age the נוער player can be pushed into the first team. */
  minAge: 17,
  /** By this age the club must decide one way or the other. */
  decisionAge: 19,
  abilityWeight: 0.42,
  coachTrustWeight: 0.3,
  potentialWeight: 0.12,
  reputationWeight: 0.1,
  formWeight: 0.06,
  noise: 12,
  /*
   * Score thresholds for the four paths, set from the measured readiness distribution.
   * At 62/50/41 roughly 86% of careers were released and only ~13% signed, which is closer
   * to a real academy's attrition than to a game anyone wants to replay - the fantasy has to
   * be reachable while still being the minority outcome.
   */
  contractThreshold: 50,
  loanThreshold: 40,
  anotherYearThreshold: 33,
  /** Chance a contract offer comes bundled with a loan recommendation. */
  loanRecommendationChance: 0.42,
};

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export const EVENTS = {
  /** Weight multiplier applied to an event already seen in this career. */
  repeatPenalty: 0.35,
  /** Weight multiplier for an event whose category already appeared this season. */
  sameCategoryPenalty: 0.25,
  /** Default cooldown for events that do not declare one. */
  defaultCooldownSeasons: 3,
  /** Rare events are throttled hard so they stay special. */
  rarityWeight: { common: 1, uncommon: 0.55, rare: 0.14 },
  /** Chance the late-season "key moment" slot is used at all. */
  lateSlotChance: 0.45,
  /** Two injury or discipline events back to back feels punishing - block it. */
  blockedRepeatCategories: ['injury', 'discipline'] as const,
};

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

export const TRANSFERS = {
  baseOfferChance: 0.16,
  reputationWeight: 0.011,
  ratingWeight: 0.006,
  peakAge: 24,
  ageFalloff: 0.035,
  loanChance: 0.55,
  loanMinAge: 17,
  loanMaxAge: 23,
  loanMaxAppearances: 12,
  /*
   * Coming home is rolled once per off-season, so these have to stay small: a 0.5 per-season
   * chance compounds to a near-certainty across a 15 season senior career, which is how more
   * than half of all careers used to end up back at Maccabi. Kept low so a homecoming is a
   * story beat rather than the default path.
   */
  returnBaseChance: 0.006,
  returnAgeBonusFrom: 28,
  returnAgeBonusPerYear: 0.012,
  returnMaccabismWeight: 0.0004,
  /** Maccabi only comes calling for a player who could actually hold a place in the side. */
  returnAbilityMargin: 8,
};

/* ------------------------------------------------------------------ */
/* Legend Score weights - the headline formula                         */
/* ------------------------------------------------------------------ */

export const LEGEND = {
  weights: {
    appearances: 20,
    output: 12,
    seasons: 11,
    titles: 19,
    captain: 8,
    academy: 5,
    maccabism: 13,
    homecoming: 6,
    europe: 6,
  },
  targets: {
    appearances: 430,
    output: 190,
    seasons: 15,
    titles: 11,
    captain: 7,
    homecomingSeasons: 5,
    europe: 40,
  },
  betrayalPenalty: 3.5,
  loyaltyBonus: 2,
  neverPlayedForMaccabiCap: 34,
};

export const TROPHY_WEIGHTS = {
  championship: 1,
  cup: 0.55,
  superCup: 0.3,
  europeanRun: 0.7,
  foreignChampionship: 0.6,
  foreignCup: 0.35,
  championsLeague: 1.4,
};

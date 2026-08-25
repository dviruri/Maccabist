/**
 * Every tunable number in the game lives here.
 * If you want to rebalance Maccabist, this is the file you edit first.
 */

import type { CareerStage, PlayerStatus, Position } from '../types';

export const START_AGE = 9;
export const START_SEASON_MIN = 2028;
export const START_SEASON_MAX = 2034;

/** Retirement can start being offered here; it becomes increasingly likely afterwards. */
export const RETIREMENT_MIN_AGE = 33;
export const RETIREMENT_FORCED_AGE = 41;

/* ------------------------------------------------------------------ */
/* Career stages                                                       */
/* ------------------------------------------------------------------ */

export const STAGE_BOUNDS: ReadonlyArray<{ stage: CareerStage; minAge: number; maxAge: number }> = [
  { stage: 'kids', minAge: 0, maxAge: 12 },
  { stage: 'youth', minAge: 13, maxAge: 15 },
  { stage: 'breakthrough_youth', minAge: 16, maxAge: 18 },
  { stage: 'breakthrough', minAge: 19, maxAge: 23 },
  { stage: 'prime', minAge: 24, maxAge: 30 },
  { stage: 'veteran', minAge: 31, maxAge: 99 },
];

export const STAGE_LABELS: Record<CareerStage, string> = {
  kids: 'מחלקת ילדים',
  youth: 'מחלקת נוער',
  breakthrough_youth: 'על סף הבוגרים',
  breakthrough: 'פריצה',
  prime: 'שיא הקריירה',
  veteran: 'ותיק',
};

/* ------------------------------------------------------------------ */
/* Status ladder                                                       */
/* ------------------------------------------------------------------ */

export const STATUS_TIERS: ReadonlyArray<{ status: PlayerStatus; min: number }> = [
  { status: 'icon', min: 90 },
  { status: 'star', min: 78 },
  { status: 'key_player', min: 64 },
  { status: 'starter', min: 50 },
  { status: 'rotation', min: 36 },
  { status: 'squad', min: 24 },
  { status: 'prospect', min: 12 },
  { status: 'academy', min: 0 },
];

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  academy: 'חניך אקדמיה',
  prospect: 'כישרון מבטיח',
  squad: 'שחקן סגל',
  rotation: 'שחקן רוטציה',
  starter: 'שחקן הרכב',
  key_player: 'שחקן מפתח',
  star: 'כוכב הקבוצה',
  icon: 'סמל המועדון',
};

export const STATUS_ICONS: Record<PlayerStatus, string> = {
  academy: '🌱',
  prospect: '✨',
  squad: '👕',
  rotation: '🔄',
  starter: '⭐',
  key_player: '🔑',
  star: '🌟',
  icon: '👑',
};

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
  /** Assists per appearance for a 70-ability player. */
  assistRate: number;
  /** Clean sheets are only tracked for goalkeepers and defenders. */
  cleanSheetRate: number;
  /** How much scoring output feeds the season rating (attackers are judged on goals). */
  outputWeight: number;
  /** Multiplies goals+assists in the Legend Score so a keeper is not punished. */
  legendOutputFactor: number;
  /** Ability at which the position peaks a little later / earlier. */
  peakAgeOffset: number;
}

export const POSITIONS: Record<Position, PositionConfig> = {
  GK: {
    id: 'GK',
    label: 'שוער',
    short: 'שוער',
    icon: '🧤',
    description: 'האחרון שנשאר. שער נקי שווה יותר מכל שער.',
    goalRate: 0.002,
    assistRate: 0.008,
    cleanSheetRate: 0.34,
    outputWeight: 0.15,
    legendOutputFactor: 6,
    peakAgeOffset: 4,
  },
  CB: {
    id: 'CB',
    label: 'בלם',
    short: 'בלם',
    icon: '🛡️',
    description: 'הקיר. הקהל אוהב הצלה על הקו כמו שער.',
    goalRate: 0.055,
    assistRate: 0.035,
    cleanSheetRate: 0.3,
    outputWeight: 0.3,
    legendOutputFactor: 3.2,
    peakAgeOffset: 2,
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
    peakAgeOffset: 0,
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
    peakAgeOffset: 1,
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
    peakAgeOffset: -1,
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
    peakAgeOffset: 0,
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
  abilityMin: 16,
  abilityMax: 26,
  potentialMin: 52,
  potentialMax: 96,
  /** Small chance of a generational talent. */
  wonderkidChance: 0.08,
  wonderkidPotentialMin: 90,
  maccabismMin: 55,
  maccabismMax: 75,
  reputation: 3,
  statusValue: 8,
  confidence: 55,
  form: 55,
  discipline: 60,
  injuryRisk: 18,
  pressure: 40,
};

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

export const PROGRESSION = {
  /** Base growth per season by age bracket (before club/minutes/potential modifiers). */
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
  /** Growth is scaled by how far the player still is from their potential. */
  potentialPullStrength: 1.15,
  /** How much a club's development rating swings growth (multiplier range). */
  clubDevelopmentSwing: 0.45,
  /** How much playing time swings growth. */
  minutesSwing: 0.6,
  /** How much a strong season rating swings growth. */
  ratingSwing: 0.35,
  /** Confidence drifts back to this baseline each season. */
  confidenceBaseline: 55,
  confidenceRecovery: 0.35,
  formVolatility: 14,
};

/* ------------------------------------------------------------------ */
/* Season simulation                                                   */
/* ------------------------------------------------------------------ */

export const SEASON = {
  /** Minutes share = clamp(base + (playerLevel - clubQuality) / spread). */
  minutesBase: 0.42,
  minutesSpread: 34,
  minutesMin: 0.02,
  minutesMax: 0.98,
  /** Academy and youth teams rotate everyone - nobody is a total spectator there. */
  youthMinutesFloor: 0.35,
  /** Status contributes to the fight for minutes on top of raw ability. */
  statusWeight: 0.35,
  /** Young players get fewer minutes than their ability suggests. */
  youngPenaltyPerYearUnder21: 0.035,
  /** Veterans lose a bit of playing time. */
  oldPenaltyPerYearOver32: 0.05,
  /** Injury: chance per season = injuryRisk / this. */
  injuryDivisor: 190,
  injuryGamesMin: 3,
  injuryGamesMax: 22,
  /** Rating model. */
  ratingBase: 46,
  ratingAbilityWeight: 0.42,
  ratingFormWeight: 0.16,
  ratingOutputWeight: 16,
  ratingNoise: 7,
  /** Reputation gain per season = f(rating, prestige, trophies). */
  reputationGainMax: 12,
  reputationDecayNoMinutes: 3,
  /** Maccabism drift. */
  maccabismPerSeasonAtMaccabi: 2.2,
  maccabismPerSeasonAbroad: -2.6,
  maccabismPerSeasonOtherIsraeli: -1.4,
  maccabismLoanSoftening: 0.4,
  /** Status movement per season based on performance vs squad quality. */
  statusMoveMax: 14,
  /** Appearances needed before a season counts towards the Maccabi legacy. */
  minAppearancesForSeason: 8,
};

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

export const TRANSFERS = {
  /** Base chance of any offer arriving at the end of a season. */
  baseOfferChance: 0.16,
  /** Reputation is the main driver of foreign interest. */
  reputationWeight: 0.011,
  /** A big season adds interest. */
  ratingWeight: 0.006,
  /** Peak transfer age; interest falls away from it. */
  peakAge: 24,
  ageFalloff: 0.035,
  /** Chance of a loan offer for a young player starved of minutes. */
  loanChance: 0.55,
  loanMinAge: 17,
  loanMaxAge: 23,
  loanMaxAppearances: 12,
  /** Return-home mechanic. */
  returnBaseChance: 0.14,
  returnAgeBonusFrom: 27,
  returnAgeBonusPerYear: 0.05,
  returnMaccabismWeight: 0.0055,
  /** Chance the academy graduate is released if he never breaks through. */
  releaseAbilityThreshold: 55,
  releaseAge: 20,
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
    /** Maccabi senior appearances for full marks. */
    appearances: 430,
    /** Position-adjusted goal contributions for full marks. */
    output: 190,
    /** Seasons in a Maccabi senior shirt for full marks. */
    seasons: 15,
    /** Weighted trophy points for full marks. */
    titles: 11,
    /** Captain seasons for full marks. */
    captain: 7,
    /** Seasons played after coming home for full marks. */
    homecomingSeasons: 5,
    /** European prestige points (prestige-weighted seasons abroad + euro trophies). */
    europe: 40,
  },
  /** Pushing to leave hurts the legacy. */
  betrayalPenalty: 3.5,
  loyaltyBonus: 2,
  /** A player who never played a senior Maccabi game is capped here. */
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

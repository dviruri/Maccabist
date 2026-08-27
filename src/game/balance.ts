/**
 * Every tunable number in the game lives here.
 * If you want to rebalance Maccabist, this is the file you edit first.
 */

import type { Position, TeamRole } from '../types';

/**
 * The world has a fixed timeline (v0.3.1). Every career starts in the same season with the
 * same birth cohort, so "which age group am I in?" has one correct answer rather than being
 * re-derived from a numeric age.
 */
export const BIRTH_COHORT = 2021;
/** Season 2031 == "2030/31", the season the 2021 cohort arrives at טרום ב׳. */
export const FIRST_ACADEMY_SEASON = 2031;

export const START_AGE = 9;

/** A small, fading, academy-only physical-maturity effect from the birth month. */
export const RELATIVE_AGE = {
  /** Added to the effective level of a player born Jan-Mar. */
  earlyYearBonus: 2.4,
  /** Subtracted for a player born Oct-Dec. */
  lateYearBonus: 2.4,
  /** Fades linearly to nothing across this many rungs of the ladder. */
  fadeOverStages: 8,
};

/** How likely a career is to begin already inside Maccabi, spotted by a scout. */
export const ORIGIN = {
  scoutedChance: 0.08,
  /** Trial scoring. Nothing here is shown to the player as a percentage. */
  trialAbilityWeight: 1.5,
  trialPotentialWeight: 0.35,
  trialConfidenceWeight: 0.25,
  trialNoise: 14,
  /**
   * Score needed to be taken on at the first trials.
   *
   * Set from the measured score distribution (centre ~69, sd ~8) to reject roughly a quarter
   * to a third of children. At 52 it rejected 0.8%, which made the whole trials system - and
   * the road back that hangs off it - unreachable content. It should be a real risk without
   * making a game called Maccabist mostly not about Maccabi.
   */
  trialThreshold: 65,
  /** A later trial is judged against what he has actually done since. */
  retrialAbilityWeight: 1.1,
  retrialRoleWeight: 0.35,
  retrialReputationWeight: 0.45,
  /**
   * A second look is a real test, not a formality. At 58, 90% of invited players got in.
   */
  retrialThreshold: 70,
  /** Never in consecutive seasons. */
  retrialCooldownSeasons: 2,
  maxTrials: 3,
  /**
   * Chance per eligible season that Maccabi actually comes looking. Low, so being invited
   * back is an event rather than an annual formality - and the eligibility gate above already
   * requires the player to be standing out where he is.
   */
  retrialInviteChance: 0.45,
  /** Must be clearly better than the level he currently plays at. */
  retrialAbilityEdge: 5,
  retrialMinRole: 48,
};

/**
 * What it takes for a נערים א׳ player to get a look from the first team (v0.4 Phase 0).
 *
 * Deliberately demanding on several axes at once so it cannot be reached by being merely good
 * at one thing. A sixteen year old training with the professionals should be a story, not a
 * stage of development.
 */
export const SENIOR_ELIGIBILITY = {
  /** How far clear of his own age group he has to be. */
  exceptionalAbilityEdge: 12,
  exceptionalPotential: 86,
  exceptionalCoachTrust: 72,
  exceptionalRoleValue: 72,
  exceptionalForm: 62,
};

/* ------------------------------------------------------------------ */
/* Football World (v0.4)                                               */
/* ------------------------------------------------------------------ */

/**
 * Season-level world simulation. Kept to a handful of numbers because the whole point is that
 * a club season costs a few RNG calls, not a fixture list.
 */
export const WORLD = {
  /** How many quality points separate "relegation fodder" from "champion" in a division. */
  strengthSpread: 16,
  /** How far a club's strength shifts its expected finish, in ladder positions. */
  strengthToPositions: 2.6,
  /** How far a season's luck can move it. */
  seasonVariance: 1.5,

  /** A player below this share of the club's games does not move the needle at all. */
  impactMinShare: 0.25,
  impactEdgeSpread: 14,
  impactScale: 0.62,
  impactMax: 1,
  /** How far maximum player impact shifts the finish, in ladder positions. */
  impactToPositions: 1.4,

  /** How many club seasons to keep on the career. Enough for callbacks, not a full history. */
  keepClubSeasons: 30,

  /** Player impact at or above which he genuinely shaped the season. */
  contributionThreshold: 0.25,
  /** ...and at which carrying a small club counts as a breakout. */
  breakoutImpact: 0.39,
  /**
   * League prestige at or below which a club counts as "small".
   *
   * Was 42, which included ליגת העל itself (prestige 40) - so carrying Maccabi to a title
   * counted as a small-club breakout and the memory fired in 68% of careers. Only the second
   * division and the smallest European leagues qualify.
   */
  smallClubPrestige: 32,
};

/* ------------------------------------------------------------------ */
/* The career market (v0.4)                                            */
/* ------------------------------------------------------------------ */

/**
 * The career ladder. Everything here is a weight, not a threshold - a good season improves the
 * odds of a better club without ever guaranteeing one, and a bad run genuinely opens doors
 * downward.
 */
export const MARKET = {
  /* ---- what the player is worth on the market ---- */
  abilityWeight: 0.5,
  reputationWeight: 0.22,
  leagueWeight: 0.16,
  roleWeight: 0.1,
  ratingWeight: 0.35,
  minutesWeight: 8,
  /** Clubs buy a projection while he is young, and a record after that. */
  projectionAge: 23,
  potentialLeak: 0.16,
  peakAge: 28,
  ageDecline: 1.6,

  /* ---- position need ---- */
  /** Every club has at least this much interest in every position. */
  needFloor: 0.25,
  /** How much a strong need shifts the expected role, in ability points. */
  needToEdge: 14,
  strongNeed: 0.78,

  /* ---- expected role, by how far clear of the club's level he is ---- */
  projectEdge: -12,
  backupEdge: -6,
  rotationEdge: 0,
  starterEdge: 7,
  keyEdge: 14,
  /** Where a player starts in the pecking order, given what he was signed to be. */
  arrivalRoleValue: {
    star: 82,
    key: 70,
    starter: 58,
    rotation: 40,
    backup: 26,
    project: 22,
  } as Record<string, number>,

  /* ---- who is interested ---- */
  /** Clubs will stretch this far above the player's level. */
  stretch: 3,
  fitWidth: 24,
  /** League-level gap that counts as a genuine step up or down. */
  directionThreshold: 6,

  /* ---- hints ---- */
  goodDevelopment: 74,
  highVisibility: 70,

  /**
   * Appearances across every spell abroad below which the move abroad did not work out.
   * Roughly a season and a half of regular football - less than that is not a European career.
   */
  failedAbroadAppearances: 40,

  /* ---- trajectory ---- */
  trajectoryUp: 4,
  /** Share of his club's games below which a player is not really playing. */
  stagnationShare: 0.35,
};

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
  /** Dressing-room standing at nine years old - barely formed, and it grows with the career. */
  leadership: 34,
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

  /*
   * Arriving at a new club (v0.3.1). Trust belongs to a coaching relationship, so a move
   * starts a new one rather than carrying the old number across.
   */
  transferBaseline: 46,
  transferLevelWeight: 0.8,
  transferReputationWeight: 0.12,
  /** Only a trace of the old relationship survives, as reputation rather than trust. */
  transferCarryover: 0.15,
  /** A homecoming arrives with goodwill an ordinary signing does not get. */
  homecomingGoodwill: 6,
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
  /*
   * Re-measured for v0.3.1. Fixing the roleValue collapse (see resolveAcademyProgression)
   * lifted the whole promotion-score distribution - median 14 -> 29, p95 30 -> 67 - so the
   * old threshold of 40 was suddenly being crossed on 21% of transitions and 49% of careers
   * were getting a fast-track. Set near p98 so an early promotion stays uncommon.
   */
  /**
   * Re-tuned for v0.4 Phase 0.5. Playing up should be exciting, not routine: at 78 it was
   * reaching ~21% of careers. Set near the top of the measured score distribution so roughly
   * one career in seven sees a genuine fast-track.
   */
  earlyThreshold: 88,
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
  /** An early promotion really does put you among older boys - standing resets. */
  earlyPromotionRoleDrop: 16,
  earlyPromotionTrustDrop: 7,
  /** The cohort moving up together is a step in standard, not a change of standing. */
  normalPromotionRoleDrop: 2,
  /** How far ahead of his own birth cohort a player may ever be registered. */
  maxCohortLead: 2,
  /**
   * Standing gained when the player's own cohort arrives in the group he was already playing
   * in - he goes from being the youngest in the room to one of the older boys.
   */
  cohortCaughtUpRoleGain: 7,
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
  contractThreshold: 62,
  loanThreshold: 52,
  anotherYearThreshold: 44,
  /** Chance a contract offer comes bundled with a loan recommendation. */
  loanRecommendationChance: 0.42,
};

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export const EVENTS = {
  /**
   * Weight multiplier applied to an event the moment after it has been seen. The penalty
   * fades back towards 1 over `repeatRecoverySeasons`, so a story from a decade ago is not
   * suppressed as hard as one from last season.
   */
  repeatPenalty: 0.12,
  /**
   * How long a seen event stays suppressed before it is fully back in the pool. A senior
   * career runs ~15 seasons, so a short window lets everything come round twice.
   */
  repeatRecoverySeasons: 16,
  /** Weight multiplier for an event whose category already appeared this season. */
  sameCategoryPenalty: 0.25,
  /**
   * Milder penalty for a category seen in the last few seasons. Stops a career turning into
   * four coach conversations in a row across consecutive seasons.
   */
  recentCategoryPenalty: 0.55,
  recentCategoryWindowSeasons: 2,
  /** Default cooldown for events that do not declare one. */
  defaultCooldownSeasons: 3,
  /** Rare events are throttled hard so they stay special. */
  rarityWeight: { common: 1, uncommon: 0.55, rare: 0.14 },
  /**
   * A risky choice is meant to be high variance, not a worse bet.
   *
   * Measured across the whole event pool, the good outcomes of risky choices were weighted
   * so low that risky came out at an expected value of -1.4 against +3.7 for safe: taking
   * the bold option was strictly dominated, and a player who always went for it finished
   * with an average peak ability of 55 and a Legend Score of 4, versus 78 and 44 for a
   * balanced player. That is a trap, not a decision.
   *
   * This lifts the weight of the good outcomes of a risky choice so the upside is worth
   * reaching for, while the downside stays exactly as painful as it is written.
   */
  riskyUpsideBoost: 2,
  /**
   * ...and when it does come off, it pays bigger. Scales the developmental upside of a good
   * outcome on a risky choice.
   *
   * Probability alone could not fix this. Pushing riskyUpsideBoost high enough to reach EV
   * parity renormalises the distribution until the "gamble" mostly succeeds, which removes
   * the drama the choice exists for. Widening the payoff instead keeps the odds genuinely
   * uncertain while making risk mean higher variance rather than a worse bet - more
   * failures, but also the exceptional careers that only bold play reaches.
   */
  riskyUpsideGain: 1.6,
  /** Chance the late-season "key moment" slot is used at all. */
  lateSlotChance: 0.45,
  /** Two injury or discipline events back to back feels punishing - block it. */
  blockedRepeatCategories: ['injury', 'discipline'] as const,
};

/* ------------------------------------------------------------------ */
/* Senior career phases (v0.3)                                         */
/* ------------------------------------------------------------------ */

/**
 * Thresholds for the derived senior phase, which decides which slice of the senior event
 * pool a player sees. Derived from what he has actually done, not just his age.
 */
export const SENIOR_PHASES = {
  /** Still a breakthrough story below this many career appearances... */
  breakthroughAppearances: 45,
  /** ...as long as he is not already too old for it to read as a breakthrough. */
  breakthroughMaxAge: 24,
  primeMinAge: 24,
  primeRole: 62,
  veteranAge: 32,
  /** A fading 30-31 year old is already living the veteran story. */
  veteranRole: 52,
};

/* ------------------------------------------------------------------ */
/* Recovery (v0.3)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Coach trust used to be a one-way street: a bad spell cut minutes, which cut development,
 * which cut trust again, and the career never came back. These give a player real routes out
 * without erasing what happened.
 */
export const RECOVERY = {
  /**
   * At the start of each season trust drifts towards a baseline set by how good the player
   * actually is for the level. Deliberately partial - history still matters.
   */
  seasonDriftToBaseline: 0.3,
  /** The baseline itself, before the ability-for-level adjustment. */
  baselineAnchor: 48,
  /** How much being better (or worse) than the level moves the baseline. */
  baselineAbilityWeight: 0.55,
  /** A trusted veteran keeps some credit in the bank. */
  baselineSeasonsWeight: 0.8,
  baselineSeasonsCap: 6,

  /** Chance per season that the club changes coach, giving a stuck player a clean-ish slate. */
  coachChangeChance: 0.16,
  /** How far a new coach pulls trust back towards the baseline. */
  coachChangeDrift: 0.65,

  /** A run of good form rebuilds trust faster than the normal drift. */
  formRecoveryRating: 68,
  formRecoveryBonus: 3.5,

  /**
   * Floor on the accumulated one-season minutes penalty. Without it, a few bad outcomes in
   * the same season multiply into effectively no playing time - and no minutes means no
   * development and no chance to change the coach's mind, which is the mechanism that turned
   * one bad run into a dead career.
   */
  minutesModifierFloor: 0.4,
};

/* ------------------------------------------------------------------ */
/* Captaincy (v0.3)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Captaincy came out of role value alone, so it happened to roughly every successful Maccabi
 * player. It now needs standing in the dressing room as well as quality on the pitch.
 */
export const CAPTAINCY = {
  minRoleValue: 76,
  minLeadership: 70,
  minMaccabiSeasons: 5,
  minAge: 25,
  minCoachTrust: 60,
  /** Even when everything lines up, the armband is a decision someone else makes. */
  chance: 0.26,
  /** Being the obvious leader in the room makes it likelier. */
  leaderTraitBonus: 0.22,
};

/* ------------------------------------------------------------------ */
/* Traits (v0.3)                                                       */
/* ------------------------------------------------------------------ */

export const TRAITS = {
  /** Chance a career gets a second trait on top of its first. */
  secondTraitChance: 0.38,
  /** Growth multiplier for a late bloomer before/after the turn. */
  lateBloomerEarlyGrowth: 0.82,
  lateBloomerLateGrowth: 1.3,
  lateBloomerTurnAge: 20,
  /** Multiplier on injury rolls. */
  injuryProneRisk: 1.5,
  /** Discipline drift for a hot head, per half season. */
  hotHeadedDiscipline: -1.6,
  /** Extra development for a hard worker. */
  hardWorkerGrowth: 1.12,
  /** A professional loses less form and recovers confidence faster. */
  professionalFormFloor: 6,
  /** Confidence baseline shift for a self-believer. */
  selfBelieverConfidence: 8,
  /** Leadership head start. */
  leaderLeadership: 18,
  /** Rating bonus in the big moments. */
  bigGameRating: 4,
};

/* ------------------------------------------------------------------ */
/* Leaving Maccabi (v0.3) - contextual, not automatic betrayal         */
/* ------------------------------------------------------------------ */

/** Which homecoming story a return reads as. */
export const HOMECOMING = {
  /* v0.4 archetypes. A return is not one event. */
  /** Coming home to lead is about standing in a dressing room, not raw ability. */
  leaderLeadership: 62,
  leaderMinAge: 27,
  /** A European career has to have actually amounted to something to change the story. */
  europeReputation: 62,
  primeMaxAge: 28,
  primeAbility: 76,
  veteranAge: 33,
};

export const LEAVING = {
  /** Going straight to one of these is the one move the stand never forgives. */
  rivalClubIds: ['maccabi_tel_aviv', 'hapoel_tel_aviv', 'beitar_jerusalem', 'hapoel_beer_sheva'],
  rivalPenalty: -26,
  /** Earned the right to go: a real European move after real service. */
  earnedEuropePenalty: -2,
  establishedAppearances: 120,
  establishedSeasons: 5,
  /** Young and off to Europe for the money - understandable, but it costs. */
  earlyEuropePenalty: -11,
  domesticEarlyPenalty: -14,
  domesticEstablishedPenalty: -6,
};

/* ------------------------------------------------------------------ */
/* Standing with Maccabi (v0.4)                                        */
/* ------------------------------------------------------------------ */

/**
 * What the club remembers. Service is scaled so that a full senior career at Maccabi reaches the
 * top band on its own, while a whole youth career without a senior appearance does not - the
 * academy is a bond, not a claim.
 */
export const MACCABI_BOND = {
  /* Service */
  /**
   * Measured, not guessed: among players who make Maccabi's senior side the median career there
   * is ~217 appearances over 7 seasons, and the top 1% reach ~760. An earlier pass used 0.28 per
   * appearance capped at 220, which put more than half of them at a saturated 100 and made "son
   * of the club" a 40% outcome. These weights keep the median around the middle band and leave
   * the top two bands for careers that really were exceptional.
   */
  perAppearance: 0.1,
  appearanceCap: 400,
  perSeason: 1.6,
  perTrophy: 3,
  perEuropeanRun: 2,
  perCaptainSeason: 3,
  perAcademySeason: 1.2,
  /** A decade of youth football, alone, tops out well below "respected". */
  academyCap: 10,
  graduateBonus: 5,

  /* Grievance */
  perBetrayal: 14,
  rivalDefection: 55,
  rejectedReturn: 18,
  celebrated: 12,
  perLoyalty: 8,
  refusedToCelebrate: 14,
  cameBack: 20,

  /**
   * Bands.
   *
   * Set against the measured score distribution so the top two are genuinely rare and the middle
   * is not a hole. A career spent entirely in the youth teams scores ~15 and should land exactly
   * on "known" - the academy makes you familiar, not beloved.
   */
  traitorGrievance: 50,
  iconScore: 85,
  belovedScore: 62,
  respectedScore: 38,
  knownScore: 14,
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
  /*
   * These stay small because the offer is rolled every off-season a player spends away, so
   * whatever looks like a modest per-season chance compounds hard across a senior career.
   * At 0.006/0.0004/0.012 the per-season chance was only ~5%, and 39% of all careers still
   * ended up coming home - which makes a homecoming routine rather than a story.
   */
  returnBaseChance: 0.004,
  returnAgeBonusFrom: 29,
  returnAgeBonusPerYear: 0.006,
  returnMaccabismWeight: 0.0002,
  /** Maccabi only comes calling for a player who could actually hold a place in the side. */
  returnAbilityMargin: 8,
  /**
   * Chance a fading player gets an offer from further down (v0.4). This is what stops a
   * career quietly dying on a bench it cannot leave.
   */
  stepDownChance: 0.55,
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

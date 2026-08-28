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
  /**
   * How far a season's luck can move a club, in ladder positions (standard deviation).
   *
   * Applied through `rng.normal`, which has real tails - `rng.gaussian` is hard-bounded to +/-
   * its spread, so before v0.4.1 a club whose expected finish was five rungs up could not be
   * relegated at all. Adding tails initially pushed relegation to 53.8% of careers, so this was
   * tightened: the point was to make the outlier *possible*, not common.
   */
  seasonVariance: 1.15,
  /**
   * How far a club's finish strays from its preseason projection, in *table positions*, as a
   * fraction of the division's size (v0.4.6).
   *
   * The old `seasonVariance` is expressed in outcome rungs, and rescaling it to a table produced
   * a league far too orderly: promotion fell to 5.4% of second-division seasons, against 17.7%
   * in v0.4.5.1 and roughly 12-15% in real football, because reaching the top two from a
   * mid-table projection needed a 2.3-sigma season. Real tables are much less obedient than
   * squad strength implies - 0.2 puts the standard deviation at about three places in a
   * fourteen-club division, which is what actually happens.
   */
  tableVariance: 0.2,

  /** A player below this share of the club's games does not move the needle at all. */
  impactMinShare: 0.25,
  impactEdgeSpread: 14,
  impactScale: 0.62,
  impactMax: 1,
  /**
   * How far a bad season can drag a club down (v0.4.1). Much smaller than the ceiling: a player
   * can help win a league, but nobody relegates a club by himself.
   */
  impactMinimum: 0.35,
  /** How far maximum player impact shifts the finish, in ladder positions. */
  impactToPositions: 1.4,

  /** How many club seasons to keep on the career. Enough for callbacks, not a full history. */
  keepClubSeasons: 30,

  /** Player impact at or above which he genuinely shaped the season. */
  contributionThreshold: 0.25,
  /** ...and at which carrying a small club counts as a breakout. */
  /**
   * Recalibrated for the v0.4.5 appearance model (v0.4.5.1).
   *
   * `playerImpact` scales with appearance share, and v0.4.5 cut that share from ~83% to ~74% to
   * fix appearance inflation - without moving this threshold, which had been calibrated against
   * the inflated numbers. Impact at small clubs now peaks at 0.450 with a 99th percentile of
   * 0.380, so a bar of 0.39 was cleared by 6 qualifying seasons out of 1,696 and the memory
   * collapsed from 2.4% of careers to 0.33%.
   *
   * Swept against the new distribution and then verified end to end, because the sweep and the
   * real recording path disagreed by about a point: 0.34 measured 3.6% of balanced careers rather
   * than the predicted 2.8%. 0.355 measures 1.9% of balanced careers - close to the pre-regression
   * 2.4% and where a "carried them" story belongs: notable, not something most careers collect.
   *
   * The loyalist policy sits higher at 3.9%, which is coherent rather than a miscalibration: a good
   * player who spends a decade at one small club has many more chances to carry it once.
   */
  breakoutImpact: 0.355,
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

  /* ---- club career level (v0.4.1) ---- */
  /**
   * What makes a club a step up in a *career*, not just in a league table.
   *
   * League level alone could not distinguish Hapoel Hadera -> Maccabi Haifa from the reverse:
   * same division, so both read "lateral". Squad strength and prestige are what actually differ
   * between two clubs in one league, so they carry most of the weight; the league sets the floor.
   */
  careerLevel: {
    league: 0.34,
    quality: 0.3,
    prestige: 0.24,
    /** Being seen. A shop-window league matters to a career even at a mid club. */
    visibility: 0.07,
    europe: 0.05,
  },
  /**
   * Career-level gap that counts as a step, and as a leap.
   *
   * Set from the measured spread of club career levels, which runs 23.5 (Hapoel Afula) to 85.9
   * (Atletico) - a 62-point range. At 5/15 every move in the game came out "major", including two
   * mid-table clubs swapping. These put Hadera -> Maccabi at a genuine step up (18.6) while
   * reserving "major" for Maccabi -> Napoli (25.9) and Afula -> Maccabi (34.3), and leave two
   * comparable top-flight clubs lateral.
   */
  stepThreshold: 7,
  majorStepThreshold: 22,

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
/**
 * When a career ends (v0.4.1).
 *
 * v0.4 used a single window for everyone and every position retired at 36/37/38 with no spread at
 * all. Retirement is now read from context: how far past his position's curve he is, how much
 * ability he has lost from his peak, whether he is still playing, and whether he is still wanted.
 *
 * Goalkeepers get a genuinely later window because goalkeeping ages differently - but the same
 * context terms apply, so a keeper who stops playing at 34 still retires at 34.
 */
export const RETIREMENT = {
  outfield: { pressureFrom: 31, forced: 39 },
  /** Later on both ends. Not "every keeper plays to 40" - the context terms still bite. */
  goalkeeper: { pressureFrom: 34, forced: 43 },

  /** How fast the pressure builds once he is past the window. */
  perYear: 0.17,
  /** Ability lost from peak. A player who can still do it usually wants to keep doing it. */
  declineWeight: 0.016,
  /** Not playing is the single biggest reason careers end. */
  lowMinutesThreshold: 12,
  lowMinutesPressure: 0.22,
  /** ...and being out of the pecking order entirely. */
  benchRoleValue: 32,
  benchPressure: 0.12,
  consideredPressure: 0.08,

  /**
   * A career that is over before the position's window opens. Losing this much of your peak while
   * not playing is finished at any age - otherwise a keeper who collapsed at 31 had no exit at all
   * and limped on to 34 before the model would even consider it.
   */
  collapseDrop: 9,
  earlyExitFrom: 28,

  /**
   * A player still performing at a high level has every reason to carry on, which is what makes
   * the rare 37-38 year old outfielder happen without letting everyone reach it.
   */
  eliteAbility: 78,
  eliteAppearances: 24,
  eliteRelief: 0.42,

  /** How readily each simulated persona calls it a day. Human players decide for themselves. */
  policyThreshold: { balanced: 0.5, loyal: 0.42, ambitious: 0.58, riskTaker: 0.62 },
};

/** Kept for the phase machine and old call sites; the real cap is position-aware. */
export const RETIREMENT_MIN_AGE = RETIREMENT.outfield.pressureFrom;
export const RETIREMENT_FORCED_AGE = RETIREMENT.goalkeeper.forced;

/* ------------------------------------------------------------------ */
/* Team role ladder                                                    */
/* ------------------------------------------------------------------ */

/**
 * The squad-role ladder. Tops out at `star` (v0.4.5.1).
 *
 * `icon` used to sit above it at 90, which made "club symbol" something you got for being better
 * than your teammates: 91% of careers reached it, after 3.8 seasons, and only 12.6% of those
 * players had ever captained the side. Legacy now lives in its own dimension - see LEGACY below
 * and `legacyEngine.ts` - and this ladder answers only "how much does he play".
 */
export const ROLE_TIERS: ReadonlyArray<{ role: TeamRole; min: number }> = [
  { role: 'star', min: 78 },
  { role: 'key', min: 64 },
  { role: 'starter', min: 50 },
  { role: 'rotation', min: 32 },
  { role: 'squad', min: 0 },
];

/**
 * What it takes to become part of a club's identity (v0.4.5.1).
 *
 * Time floors are ANDs so nothing here can be short-circuited by being good; the achievement
 * clause is an OR, because a one-club servant who never won anything is still an icon, and so is
 * a captain, and so is a winner.
 */
export const LEGACY = {
  /*
   * Calibrated against the measured tenure distribution, not guessed.
   *
   * Across 1,800 careers the median spell at one club is 5 seasons and 136 appearances, the median
   * *longest* spell is 12 seasons, and the median tenure yields 1 trophy. A first pass at 5
   * seasons / 110 appearances therefore sat below the median and handed icon status to 77% of
   * careers - the same failure the split was supposed to end, one level down.
   */
  favouriteSeasons: 4,
  favouriteAppearances: 90,

  /** Around the 70th percentile of tenure, plus something to show for it. */
  iconSeasons: 9,
  iconAppearances: 280,
  /** Median tenure produces 1 trophy, so one alone proves nothing. Captaincy does - 13% ever get it. */
  iconTrophies: 2,
  iconCaptainSeasons: 1,

  /** A one-club career, essentially. */
  legendSeasons: 14,
  legendAppearances: 480,
  legendTrophies: 4,
  legendCaptainSeasons: 3,
};

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
  /**
   * What a clean sheet is worth on the Legend Score's contribution component (v0.4.1).
   *
   * Calibrated by measurement across 700 careers per position, iterating until no position sat
   * far from the rest. A first pass overshot: goalkeepers went from bottom (39.0) to top (45.4)
   * and centre backs became the new outliers. Final spread is GK 44.6 to CB 41.7 - positions feel
   * different without any of them being disadvantaged.
   */
  legendCleanSheetFactor: number;
  /**
   * How hard late-career decline hits this position (v0.4.1). Goalkeeping depends less on the
   * physical qualities that fade first, so a keeper holds his level longer.
   */
  declineFactor: number;
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
    /*
     * Benchmarks set from measurement (v0.4.1), not intuition.
     *
     * The concede model actually produces a 0.317 clean-sheet rate for keepers, 0.283 for centre
     * backs and 0.246 for full backs - all *below* the benchmarks they were scored against, so
     * the term meant to reward a good defensive season was a permanent penalty for an average
     * one. Centred slightly under the measured rate so a genuinely good season pays.
     */
    cleanSheetRate: 0.3,
    /** Zero, so the goal-output term is skipped entirely rather than always maximally negative. */
    outputWeight: 0,
    legendOutputFactor: 6,
    legendCleanSheetFactor: 1.05,
    declineFactor: 0.55,
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
    cleanSheetRate: 0.27,
    outputWeight: 0.3,
    legendOutputFactor: 3.2,
    legendCleanSheetFactor: 0.85,
    declineFactor: 0.85,
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
    cleanSheetRate: 0.235,
    outputWeight: 0.45,
    legendOutputFactor: 2.4,
    legendCleanSheetFactor: 0.6,
    declineFactor: 0.95,
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
    legendCleanSheetFactor: 0,
    declineFactor: 1,
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
    legendCleanSheetFactor: 0,
    declineFactor: 1,
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
    legendCleanSheetFactor: 0,
    declineFactor: 1,
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
  /**
   * A footballing ceiling, not a mathematical one (v0.4.5).
   *
   * At 0.98 the cap was reachable and constantly reached: the median senior season was played at
   * a 100% appearance share. Nobody plays every match of a season - rotation, suspensions, minor
   * knocks and cup rest all take games away from even a first-choice player. 0.88 of ~42 games is
   * about 37, which is a heavy but believable season for a star.
   */
  minutesMax: 0.88,

  /**
   * Where standing settles, given how good he is for the club (v0.4.5).
   *
   * roleValue used to accumulate without an equilibrium and saturated at 100 for most careers.
   * These put a player at his club's level around "starter" (52) and one ten points clear of it
   * around "star" (80), with the pull below returning him if he overshoots on a hot streak.
   */
  roleCeilingBase: 52,
  roleCeilingPerPoint: 1.9,
  /** How hard standing is dragged back when it is above where he belongs, per half-season. */
  roleCeilingPull: 0.45,
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
  /**
   * Season-to-season variance in performance, as a true standard deviation (v0.4.5.1).
   *
   * Read literally now that this feeds `rng.normal`. Under the old bounded `gaussian` the same
   * number produced sd 2.33 and could never exceed +/-6.9, so this is a smaller nominal value
   * that delivers a slightly *larger* central spread and, for the first time, real tails.
   */
  ratingNoise: 3.4,
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
  riskyUpsideBoost: 2.6,
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
  riskyUpsideGain: 2.1,
  /** Chance the late-season "key moment" slot is used at all. */
  lateSlotChance: 0.45,
  /**
   * How often a two-event season puts its second event late rather than mid (v0.4.6).
   *
   * The senior stage budgets one or two events, so the three-slot branch never ran there and the
   * late slot was never allocated at all - making every senior `slots: ['late']` event
   * unreachable. This does not add events, it moves when the second one lands.
   */
  lateInsteadOfMidChance: 0.32,
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
  minutesModifierFloor: 0.5,
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

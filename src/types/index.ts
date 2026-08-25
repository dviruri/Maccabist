/**
 * Maccabist domain model (v0.2).
 * Everything here is plain data - no React, no DOM, no side effects.
 * The whole Career object is JSON-serialisable so it can be saved, replayed and simulated headlessly.
 */

/* ------------------------------------------------------------------ */
/* Player basics                                                       */
/* ------------------------------------------------------------------ */

export type Position = 'GK' | 'CB' | 'FB' | 'CM' | 'WG' | 'ST';

/**
 * The Maccabi Haifa academy ladder. This - not age - is the player's identity
 * for the whole youth career.
 */
export type AcademyStage =
  | 'pre_b' // טרום ב׳
  | 'pre_a' // טרום א׳
  | 'children_c' // ילדים ג׳
  | 'children_b' // ילדים ב׳
  | 'children_a' // ילדים א׳
  | 'youth_c' // נערים ג׳
  | 'youth_b' // נערים ב׳
  | 'youth_a' // נערים א׳
  | 'u19' // נוער
  | 'senior'; // בוגרים

/** Coarse grouping used to theme events and pacing. */
export type StageBand = 'children' | 'teens' | 'u19' | 'senior';

/** The player's role inside the team he is currently part of. */
export type TeamRole = 'squad' | 'rotation' | 'starter' | 'key' | 'star' | 'icon';

/** Whether the player has been pulled up to the age group above him. */
export type OlderGroupStatus = 'none' | 'training' | 'playing';

/* ------------------------------------------------------------------ */
/* Clubs                                                               */
/* ------------------------------------------------------------------ */

export type ClubTier =
  | 'academy'
  | 'youth'
  | 'israeli_top'
  | 'israeli_mid'
  | 'israeli_low'
  | 'euro_dev'
  | 'euro_mid'
  | 'euro_top';

export interface Club {
  id: string;
  name: string;
  shortName?: string;
  country: string;
  league: string;
  /** Squad strength, 0-100. Drives how hard it is to get minutes. */
  quality: number;
  /** How much international recognition playing here brings, 0-100. */
  prestige: number;
  /** How well the club develops players, 0-100. */
  development: number;
  tier: ClubTier;
  titleChance: number;
  cupChance: number;
  europeChance: number;
  isMaccabi?: boolean;
  /** Only the senior team counts towards the Maccabi legacy stats. */
  isSenior?: boolean;
  seasonGames: number;
}

/**
 * The competitive level the player is actually playing at this season.
 * For academy players it comes from the academy stage, for everyone else from the club.
 */
export interface LevelContext {
  /** Display name of the team ("נערים ב׳" / "מכבי חיפה"). */
  teamName: string;
  league: string;
  quality: number;
  development: number;
  prestige: number;
  seasonGames: number;
  titleChance: number;
  cupChance: number;
  europeChance: number;
  isAcademy: boolean;
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export interface SeasonStats {
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Goalkeepers only. */
  goalsConceded: number;
  /** Average performance rating, 0-100. */
  rating: number;
  injuredGames: number;
}

export interface CareerStats {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

/** Everything the Legend Score cares about regarding the player's bond with the club. */
export interface MaccabiRecord {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  seasons: number;
  championships: number;
  cups: number;
  europeanRuns: number;
  captainSeasons: number;
  academyGraduate: boolean;
  everLeft: boolean;
  returned: boolean;
  returnAge: number | null;
  seasonsAfterReturn: number;
  loyaltyMoments: number;
  betrayalMoments: number;
  debutAge: number | null;
  /** Seasons completed inside the Maccabi youth structure. */
  academySeasons: number;
  /** Times the player was pushed up an age group early. */
  earlyPromotions: number;
}

export interface Trophy {
  id: string;
  name: string;
  season: number;
  clubId: string;
  clubName: string;
  weight: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  season: number;
  icon: string;
}

export interface SeasonRecord {
  season: number;
  age: number;
  academyStage: AcademyStage;
  clubId: string;
  clubName: string;
  /** The age-group / senior team actually played for. */
  teamName: string;
  league: string;
  onLoan: boolean;
  stats: SeasonStats;
  firstHalf: SeasonStats | null;
  ability: number;
  role: TeamRole;
  trophies: Trophy[];
  captain: boolean;
  olderGroup: OlderGroupStatus;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export type EventCategory =
  | 'development'
  | 'coach'
  | 'competition'
  | 'match_moment'
  | 'injury'
  | 'discipline'
  | 'opportunity'
  | 'promotion'
  | 'contract'
  | 'transfer'
  | 'family'
  | 'random'
  | 'rare';

/** Which part of the season an event can appear in. */
export type SeasonSlot = 'early' | 'mid' | 'late';

export type CareerFlag =
  | 'loyalty_moment'
  | 'betrayal_moment'
  | 'wants_transfer'
  | 'wants_loan'
  | 'refused_captaincy'
  | 'retirement_considered'
  | 'agent_signed'
  | 'academy_star'
  | 'fan_favourite'
  | 'coach_favourite'
  | 'injury_prone'
  | 'discipline_problem'
  | 'first_team_radar'
  | 'tournament_star'
  | 'released_by_maccabi';

export interface EventConditions {
  minAge?: number;
  maxAge?: number;
  stages?: AcademyStage[];
  bands?: StageBand[];
  positions?: Position[];
  notPositions?: Position[];
  minAbility?: number;
  maxAbility?: number;
  minPotential?: number;
  minMaccabism?: number;
  maxMaccabism?: number;
  minReputation?: number;
  maxReputation?: number;
  minCoachTrust?: number;
  maxCoachTrust?: number;
  minForm?: number;
  maxForm?: number;
  minConfidence?: number;
  maxConfidence?: number;
  minRoleValue?: number;
  maxRoleValue?: number;
  roles?: TeamRole[];
  olderGroup?: OlderGroupStatus[];
  atMaccabi?: boolean;
  atMaccabiSenior?: boolean;
  abroad?: boolean;
  onLoan?: boolean;
  isCaptain?: boolean;
  hasLeftMaccabi?: boolean;
  /** Appearances so far this season (mid/late slots) or last season (early slot). */
  minLastAppearances?: number;
  maxLastAppearances?: number;
  requiresFlags?: CareerFlag[];
  forbidsFlags?: CareerFlag[];
}

/** Attributes an outcome weight modifier can read. */
export type ModifierAttribute =
  | 'ability'
  | 'potential'
  | 'form'
  | 'confidence'
  | 'coachTrust'
  | 'maccabism'
  | 'reputation'
  | 'discipline'
  | 'roleValue'
  | 'age'
  | 'injuryRisk'
  | 'abilityVsLevel';

/**
 * Data-driven probability tuning. An outcome's weight is its baseWeight multiplied by every
 * modifier whose threshold the player meets, so event designers tune odds without touching
 * engine code.
 */
export interface OutcomeModifier {
  attribute: ModifierAttribute;
  /** Applies when the attribute is strictly above this value. */
  above?: number;
  /** Applies when the attribute is strictly below this value. */
  below?: number;
  multiplier: number;
}

export type Tone = 'good' | 'bad' | 'neutral';

export interface EventEffects {
  ability?: number;
  potential?: number;
  maccabism?: number;
  reputation?: number;
  coachTrust?: number;
  /** Moves the player's standing inside the current team. */
  roleValue?: number;
  confidence?: number;
  form?: number;
  discipline?: number;
  injuryRisk?: number;
  pressure?: number;
  /** 0-1 chance of picking up an injury that damages the coming half-season. */
  injuryChance?: number;
  transferChance?: number;
  /** Multiplier applied to the remaining playing time this season. */
  minutesModifier?: number;
  /** Moves the player to / from the age group above. */
  olderGroup?: OlderGroupStatus;
  /** Additive bonus to this season's academy promotion roll. */
  promotionBoost?: number;
  flags?: CareerFlag[];
  clearFlags?: CareerFlag[];
  achievement?: string;
  transferTo?: string;
  captain?: boolean;
}

export interface EventOutcome {
  id: string;
  /** Weight before modifiers. Relative to the other outcomes of the same choice. */
  baseWeight: number;
  /** Outcome is impossible unless these hold. */
  conditions?: EventConditions;
  modifiers?: OutcomeModifier[];
  tone: Tone;
  /** Short Hebrew narrative - the story comes first, numbers second. */
  text: string;
  effects: EventEffects;
}

/** Qualitative hint shown on a choice button instead of raw percentages. */
export type ChoiceRisk = 'safe' | 'balanced' | 'risky' | 'opportunity';

export interface EventChoice {
  id: string;
  label: string;
  hint?: string;
  risk?: ChoiceRisk;
  /** Applied on every outcome of this choice. Use sparingly - the outcomes carry the story. */
  effects?: EventEffects;
  outcomes: EventOutcome[];
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  kicker?: string;
  category: EventCategory;
  /** Rare events are held back so they do not show up in every career. */
  rarity?: 'common' | 'uncommon' | 'rare';
  conditions: EventConditions;
  weight: number;
  slots?: SeasonSlot[];
  oncePerCareer?: boolean;
  oncePerStage?: boolean;
  /** Minimum seasons before this event may fire again. */
  cooldownSeasons?: number;
  choices: EventChoice[];
}

export interface AttributeDelta {
  key: string;
  label: string;
  from: number;
  to: number;
}

export interface CareerEventResult {
  eventId: string;
  eventTitle: string;
  category: EventCategory;
  season: number;
  age: number;
  stage: AcademyStage;
  choiceId: string;
  choiceLabel: string;
  outcomeId: string;
  outcomeText: string;
  tone: Tone;
  deltas: AttributeDelta[];
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

export type OfferKind =
  | 'transfer'
  | 'loan'
  | 'return_home'
  | 'contract'
  | 'release'
  | 'promotion';

export interface TransferOffer {
  id: string;
  kind: OfferKind;
  clubId: string;
  clubName: string;
  league: string;
  country: string;
  title: string;
  description: string;
  acceptEffects: EventEffects;
  declineEffects: EventEffects;
  acceptLabel: string;
  declineLabel: string;
  mandatory?: boolean;
}

/* ------------------------------------------------------------------ */
/* Career flow                                                         */
/* ------------------------------------------------------------------ */

export type CareerPhase =
  | 'preseason' // season intro
  | 'event' // answering an event (any slot)
  | 'mid_season' // half-way summary
  | 'season_result' // full season summary
  | 'progression' // academy promotion / role change
  | 'youth_to_senior' // the big transition out of נוער
  | 'offseason' // transfers / loans / contracts
  | 'retirement_decision'
  | 'retired';

/** What the academy promotion roll decided at the end of a season. */
export type ProgressionKind =
  | 'normal' // one step up the ladder
  | 'early' // skipped a level
  | 'stay' // repeated the level
  | 'senior' // promoted to the first team
  | 'released' // Maccabi did not keep him
  | 'none'; // senior player, nothing to report

export interface ProgressionResult {
  kind: ProgressionKind;
  fromStage: AcademyStage;
  toStage: AcademyStage;
  title: string;
  detail: string;
  icon: string;
  /** Worth a full celebration overlay. */
  major: boolean;
}

/** Snapshot of the visible metrics at kick-off, so the season summary can show real movement. */
export interface SeasonOpening {
  ability: number;
  coachTrust: number;
  maccabism: number;
  reputation: number;
  roleValue: number;
}

export interface HiddenAttributes {
  /** Talent ceiling. Never shown, and not an absolute cap. */
  potential: number;
  form: number;
  confidence: number;
  injuryRisk: number;
  discipline: number;
  pressure: number;
  /** One-season multiplier on playing time (from events). */
  minutesModifier: number;
  transferBoost: number;
  /** One-season additive bonus to the promotion roll. */
  promotionBoost: number;
}

export interface Career {
  id: string;
  schemaVersion: number;
  createdAt: number;
  playerName: string;
  position: Position;

  age: number;
  startAge: number;
  currentSeason: number;
  startSeason: number;

  ability: number;
  hidden: HiddenAttributes;

  maccabism: number;
  reputation: number;
  /** אמון המאמן - one of the most important academy variables. */
  coachTrust: number;
  /** Numeric backing for `role`. */
  roleValue: number;
  role: TeamRole;

  academyStage: AcademyStage;
  olderGroup: OlderGroupStatus;
  /** Seasons spent at the current academy stage (drives repeat / early promotion). */
  seasonsAtStage: number;

  currentClubId: string;
  parentClubId: string | null;
  loanSeasonsLeft: number;

  captain: boolean;
  captainSeasons: number;

  stats: CareerStats;
  maccabi: MaccabiRecord;
  peakAbility: number;

  seasonHistory: SeasonRecord[];
  trophies: Trophy[];
  achievements: Achievement[];
  eventsHistory: CareerEventResult[];
  flags: CareerFlag[];

  phase: CareerPhase;
  /** Which part of the season the loop is in. */
  seasonSlot: SeasonSlot;
  pendingEventIds: string[];
  /** Events already scheduled for the later slots of this season. */
  plannedEvents: { slot: SeasonSlot; eventId: string }[];
  pendingOffers: TransferOffer[];

  /** Stats accumulated in the first half of the season in progress. */
  firstHalfStats: SeasonStats | null;
  seasonOpening: SeasonOpening | null;
  lastSeasonRecord: SeasonRecord | null;
  lastSeasonDeltas: AttributeDelta[];
  lastEventResult: CareerEventResult | null;
  lastAchievements: Achievement[];
  lastProgression: ProgressionResult | null;

  retired: boolean;
  retirementAge: number | null;
  legend: LegendResult | null;

  seed: number;
  rngState: number;
}

/* ------------------------------------------------------------------ */
/* Legend Score                                                        */
/* ------------------------------------------------------------------ */

export interface LegendComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface LegendResult {
  score: number;
  components: LegendComponent[];
  ending: CareerEnding;
}

export interface CareerEnding {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
}

/* ------------------------------------------------------------------ */
/* Meta progression / persistence                                      */
/* ------------------------------------------------------------------ */

export interface CareerSummary {
  id: string;
  playerName: string;
  position: Position;
  startSeason: number;
  endSeason: number;
  legendScore: number;
  endingId: string;
  endingTitle: string;
  maccabiAppearances: number;
  championships: number;
  finishedAt: number;
}

export interface MetaProgress {
  careersPlayed: number;
  bestLegendScore: number;
  bestCareer: CareerSummary | null;
  totalChampionships: number;
  recentCareers: CareerSummary[];
}

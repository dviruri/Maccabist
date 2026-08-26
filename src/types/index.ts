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
  /** Recorded so recovery from a bad spell can actually be measured. */
  coachTrust: number;
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
  | 'team'
  | 'injury'
  | 'discipline'
  | 'opportunity'
  | 'pressure'
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

/* ------------------------------------------------------------------ */
/* Career memory (v0.3)                                                */
/* ------------------------------------------------------------------ */

/**
 * A meaningful thing that happened, which later events are allowed to reference.
 *
 * Deliberately a small curated vocabulary rather than a bag of booleans on the Career: an
 * event declares the memory it needs, the engine looks it up, and no gameplay code has to
 * know which specific event wrote it.
 */
export type MemoryKind =
  // academy
  | 'early_promotion'
  | 'repeated_a_year'
  | 'academy_captain'
  | 'older_group_success'
  | 'older_group_failure'
  | 'first_team_noticed'
  | 'tournament_star'
  // setbacks
  | 'lost_starting_role'
  | 'major_injury'
  | 'coach_conflict'
  | 'penalty_miss'
  | 'big_mistake'
  | 'confidence_crisis'
  // highs
  | 'derby_hero'
  | 'cup_final_hero'
  | 'european_night'
  | 'title_winner'
  | 'goal_streak'
  // career direction
  | 'left_young'
  | 'left_established'
  | 'released_by_maccabi'
  | 'returned_home'
  | 'rejected_maccabi'
  | 'refused_transfer'
  | 'forced_transfer'
  | 'struggled_abroad'
  | 'loan_success';

export interface CareerMemory {
  kind: MemoryKind;
  season: number;
  age: number;
  stage: AcademyStage;
  /** Optional detail for templating, e.g. a club name. */
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* Story arcs (v0.3)                                                   */
/* ------------------------------------------------------------------ */

/**
 * Multi-event storylines. An arc is just an id, a stage counter and a branch label; the
 * events themselves declare where they sit in the arc, so adding an arc is data work.
 */
export type ArcId =
  | 'coach_relationship'
  | 'older_group'
  | 'injury_comeback'
  | 'position_battle'
  | 'europe_move'
  | 'contract_standoff'
  | 'homecoming';

export interface ActiveArc {
  id: ArcId;
  /** How far along the arc is. Events gate on this. */
  stage: number;
  startedSeason: number;
  /** Which way the story went, so follow-ups can differ. */
  branch: string;
}

/** What an event needs from an arc in order to appear. */
export interface ArcRequirement {
  id: ArcId;
  minStage?: number;
  maxStage?: number;
  /** Only for these branches. */
  branches?: string[];
  /** Minimum seasons since the arc started - lets a callback land later, not next week. */
  minSeasonsSinceStart?: number;
}

/* ------------------------------------------------------------------ */
/* Traits (v0.3)                                                       */
/* ------------------------------------------------------------------ */

/**
 * A small personality layer - one or two per career, not a Football Manager attribute sheet.
 * Traits start hidden and are revealed through narrative, which is far more satisfying than
 * showing a character sheet to a nine year old.
 */
export type TraitId =
  | 'professional'
  | 'leader'
  | 'big_game'
  | 'late_bloomer'
  | 'injury_prone'
  | 'hot_headed'
  | 'hard_worker'
  | 'self_believer';

export interface CareerTrait {
  id: TraitId;
  revealed: boolean;
  revealedSeason: number | null;
}

/* ------------------------------------------------------------------ */
/* Milestones (v0.3)                                                   */
/* ------------------------------------------------------------------ */

/** A story beat worth putting on the career timeline. Not every event qualifies. */
export interface Milestone {
  id: string;
  season: number;
  age: number;
  icon: string;
  text: string;
  /** Worth highlighting in the timeline and the retirement story. */
  major: boolean;
}

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

  /* ---------- v0.3: memory, arcs, traits ---------- */
  /** Every one of these must have happened at some point. */
  requiresMemory?: MemoryKind[];
  /** None of these may have happened. */
  forbidsMemory?: MemoryKind[];
  /** The required memory must be at least this many seasons old - callbacks need distance. */
  memoryMinSeasonsAgo?: number;
  /** ...and no older than this, so a callback stays relevant. */
  memoryMaxSeasonsAgo?: number;
  /** The player must be inside this arc, at the given stage/branch. */
  requiresArc?: ArcRequirement;
  /** Not while this arc is still running. */
  forbidsActiveArc?: ArcId;
  /** Only after this arc finished. */
  requiresCompletedArc?: ArcId;
  /** The player must have this trait (revealed or not). */
  requiresTrait?: TraitId[];
  minLeadership?: number;
  /** Senior career phase, so the senior pool can evolve with the player. */
  seniorPhases?: SeniorPhase[];
}

/**
 * Where a senior player is in his professional life. Derived from age, role and appearances -
 * never stored - so the senior event pool changes shape as the career moves on.
 */
export type SeniorPhase = 'breakthrough' | 'established' | 'prime' | 'veteran';

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

/** Weight tuning that keys off a trait rather than a number. */
export interface TraitModifier {
  trait: TraitId;
  multiplier: number;
}

/** Weight tuning that keys off something that happened earlier in the career. */
export interface MemoryModifier {
  memory: MemoryKind;
  /** Applies when the memory is absent instead of present. */
  absent?: boolean;
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

  /* ---------- v0.3 ---------- */
  /** Record something the rest of the career is allowed to remember. */
  remember?: MemoryKind;
  /** Open a storyline. */
  startArc?: ArcId;
  /** Which way the story went - read by later events in the same arc. */
  arcBranch?: string;
  /** Push the current arc one step forward. */
  advanceArc?: ArcId;
  /** Close the storyline out. */
  completeArc?: ArcId;
  /** Reveal a trait the player has, if he has it. */
  revealTrait?: TraitId;
  leadership?: number;
  /** Put a beat on the career timeline. */
  milestone?: { id: string; icon: string; text: string; major?: boolean };
}

export interface EventOutcome {
  id: string;
  /** Weight before modifiers. Relative to the other outcomes of the same choice. */
  baseWeight: number;
  /** Outcome is impossible unless these hold. */
  conditions?: EventConditions;
  modifiers?: OutcomeModifier[];
  /** Weight tuning from traits and from what happened earlier in the career. */
  traitModifiers?: TraitModifier[];
  memoryModifiers?: MemoryModifier[];
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
  /**
   * Dressing-room standing. Drives captaincy, which used to fall out of role value alone and
   * so happened to almost every successful player. Never shown as a bar.
   */
  leadership: number;
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

  /* ---------- v0.3: the career remembers itself ---------- */
  memories: CareerMemory[];
  arcs: ActiveArc[];
  completedArcs: ArcId[];
  traits: CareerTrait[];
  /** Meaningful story beats, for the timeline and the retirement narrative. */
  milestones: Milestone[];

  phase: CareerPhase;
  /** A new coach arrived this preseason - events can react, and the UI can mention it. */
  newCoachThisSeason: boolean;
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

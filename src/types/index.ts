/**
 * Maccabist domain model.
 * Everything here is plain data - no React, no DOM, no side effects.
 * The whole Career object is JSON-serialisable so it can be saved, replayed and simulated headlessly.
 */

/* ------------------------------------------------------------------ */
/* Player basics                                                       */
/* ------------------------------------------------------------------ */

export type Position = 'GK' | 'CB' | 'FB' | 'CM' | 'WG' | 'ST';

export type CareerStage =
  | 'kids' // 9-12
  | 'youth' // 13-15
  | 'breakthrough_youth' // 16-18
  | 'breakthrough' // 19-23
  | 'prime' // 24-30
  | 'veteran'; // 31+

/** Descriptive standing inside the current club. Derived from a numeric 0-100 statusValue. */
export type PlayerStatus =
  | 'academy'
  | 'prospect'
  | 'squad'
  | 'rotation'
  | 'starter'
  | 'key_player'
  | 'star'
  | 'icon';

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
  /** Short name used in tight UI spots (timeline, chips). */
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
  /** Per-season chance of winning the domestic league. */
  titleChance: number;
  /** Per-season chance of winning the domestic cup. */
  cupChance: number;
  /** Per-season chance of a memorable European run. */
  europeChance: number;
  /** True for every Maccabi Haifa entity (academy / youth / senior). */
  isMaccabi?: boolean;
  /** Only the senior team counts towards the Maccabi legacy stats. */
  isSenior?: boolean;
  /** Number of competitive games in a season at this level. */
  seasonGames: number;
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
  /** Average season performance rating, 0-100. */
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
  /** Seasons played for Maccabi after coming back home. */
  seasonsAfterReturn: number;
  /** Loyalty flashpoints: turned down a big money move, stayed when it hurt, etc. */
  loyaltyMoments: number;
  /** Times the player pushed to leave / forced a transfer. */
  betrayalMoments: number;
  debutAge: number | null;
}

export interface Trophy {
  id: string;
  name: string;
  season: number;
  clubId: string;
  clubName: string;
  /** Weight used by the Legend Score. */
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
  clubId: string;
  clubName: string;
  league: string;
  onLoan: boolean;
  stats: SeasonStats;
  ability: number;
  status: PlayerStatus;
  trophies: Trophy[];
  captain: boolean;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export interface EventConditions {
  minAge?: number;
  maxAge?: number;
  stages?: CareerStage[];
  minAbility?: number;
  maxAbility?: number;
  minMaccabism?: number;
  maxMaccabism?: number;
  minReputation?: number;
  maxReputation?: number;
  minStatusValue?: number;
  maxStatusValue?: number;
  atMaccabi?: boolean;
  atMaccabiSenior?: boolean;
  abroad?: boolean;
  onLoan?: boolean;
  isCaptain?: boolean;
  hasLeftMaccabi?: boolean;
  /** Appearances in the previous season. */
  minLastAppearances?: number;
  maxLastAppearances?: number;
  /** Event can only ever fire once per career. */
  once?: boolean;
}

export interface EventEffects {
  ability?: number;
  potential?: number;
  maccabism?: number;
  reputation?: number;
  statusValue?: number;
  confidence?: number;
  form?: number;
  discipline?: number;
  injuryRisk?: number;
  pressure?: number;
  /** 0-1 chance of picking up an injury that damages the coming season. */
  injuryChance?: number;
  /** Additive bonus to the chance of receiving offers at the end of the season. */
  transferChance?: number;
  /** Multiplier applied to next season's playing time. */
  minutesModifier?: number;
  /** Flags recorded on the career (loyalty moments, transfer requests, ...). */
  flags?: CareerFlag[];
  /** Grants an achievement by id. */
  achievement?: string;
  /** Immediately moves the player to this club (used by a few decisive youth events). */
  transferTo?: string;
  /** Hands over (or takes away) the captain's armband. */
  captain?: boolean;
}

export type CareerFlag =
  | 'loyalty_moment'
  | 'betrayal_moment'
  | 'wants_transfer'
  | 'wants_loan'
  | 'refused_captaincy'
  | 'retirement_considered'
  | 'agent_signed'
  | 'academy_star'
  | 'fan_favourite';

export interface EventOutcome {
  /** Weight for weighted random selection between outcomes. */
  weight: number;
  /** Short Hebrew text shown after the decision. */
  text: string;
  effects: EventEffects;
  tone?: 'good' | 'bad' | 'neutral';
}

export interface EventChoice {
  id: string;
  label: string;
  /** Optional one-line hint about the trade-off. */
  hint?: string;
  /** Deterministic effects applied on every outcome of this choice. */
  effects?: EventEffects;
  /** Weighted random outcomes. Exactly one is picked. */
  outcomes?: EventOutcome[];
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  /** Optional flavour line shown above the title. */
  kicker?: string;
  conditions: EventConditions;
  weight: number;
  choices: EventChoice[];
}

export type Tone = 'good' | 'bad' | 'neutral';

export interface AttributeDelta {
  key: string;
  label: string;
  from: number;
  to: number;
}

export interface CareerEventResult {
  eventId: string;
  eventTitle: string;
  season: number;
  age: number;
  choiceId: string;
  choiceLabel: string;
  outcomeText: string;
  tone: Tone;
  deltas: AttributeDelta[];
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

export type OfferKind = 'transfer' | 'loan' | 'return_home' | 'contract' | 'release' | 'promotion';

export interface TransferOffer {
  id: string;
  kind: OfferKind;
  clubId: string;
  clubName: string;
  league: string;
  country: string;
  title: string;
  description: string;
  /** Effects applied if the offer is accepted. */
  acceptEffects: EventEffects;
  /** Effects applied if the offer is turned down. */
  declineEffects: EventEffects;
  acceptLabel: string;
  declineLabel: string;
  /** Some moves (release, promotion) cannot be refused. */
  mandatory?: boolean;
}

/* ------------------------------------------------------------------ */
/* Career                                                              */
/* ------------------------------------------------------------------ */

export type CareerPhase =
  | 'preseason' // showing state, events queued
  | 'event' // player is answering an event
  | 'season_result' // showing the simulated season
  | 'offseason' // transfer / loan / contract decision
  | 'retirement_decision' // continue for another season, or hang them up
  | 'retired';

export interface HiddenAttributes {
  potential: number;
  form: number;
  confidence: number;
  injuryRisk: number;
  discipline: number;
  pressure: number;
  /** Temporary multiplier applied to next season's playing time (from events). */
  minutesModifier: number;
  /** Temporary additive bonus to offer generation. */
  transferBoost: number;
}

export interface Career {
  id: string;
  createdAt: number;
  playerName: string;
  position: Position;

  age: number;
  startAge: number;
  /** Calendar year the current season ends in (e.g. 2035). */
  currentSeason: number;
  startSeason: number;

  ability: number;
  hidden: HiddenAttributes;

  maccabism: number;
  reputation: number;
  statusValue: number;
  status: PlayerStatus;

  currentClubId: string;
  /** Set while on loan - the club that owns the player. */
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
  seenEventIds: string[];
  flags: CareerFlag[];

  phase: CareerPhase;
  pendingEventIds: string[];
  pendingOffers: TransferOffer[];
  lastSeasonRecord: SeasonRecord | null;
  lastSeasonDeltas: AttributeDelta[];
  lastEventResult: CareerEventResult | null;
  /** Achievements unlocked by the most recent step, for the celebration layer. */
  lastAchievements: Achievement[];

  retired: boolean;
  retirementAge: number | null;
  legend: LegendResult | null;

  /** Seeded RNG state - makes a career fully reproducible and resumable. */
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

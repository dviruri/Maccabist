import type { RivalryType } from '../data/rivalries';

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

/**
 * Which side of a club the player is in (v0.4.1).
 *
 * Separate from both the club and the development stage. Derived from the stage, never stored -
 * see `src/game/identity.ts` for why these are three concepts rather than one.
 */
export type TeamUnit = 'academy' | 'youth' | 'first_team';

/** Everything the UI needs to name the team the player is in. Built by the engine, not React. */
export interface TeamDisplay {
  /** The club, always. Never carries an age-group suffix. */
  club: string;
  /** The age group, or null for a first-team player. */
  team: string | null;
  unit: TeamUnit;
  onLoan: boolean;
  /** Ready to print: the club alone for a senior, "club — age group" otherwise. */
  full: string;
}

/**
 * How much the player plays. A squad-role ladder, nothing more.
 *
 * 'icon' is retained so season records written before v0.4.5.1 still parse, but `roleFromValue`
 * no longer produces it - being a club's symbol is a matter of history, not of being the best
 * player in the dressing room. See `LegacyStatus` and `src/game/legacyEngine.ts`.
 */
export type TeamRole = 'squad' | 'rotation' | 'starter' | 'key' | 'star' | 'icon';

/**
 * What the club's supporters think you are (v0.4.5.1).
 *
 * Deliberately separate from TeamRole. A player can be his club's best footballer in his first
 * season; he cannot be its symbol in his first season. Derived from tenure - seasons,
 * appearances, captaincy, trophies - and never from ability.
 */
export type LegacyStatus = 'none' | 'fan_favourite' | 'icon' | 'legend';

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

/**
 * Which return story a homecoming is (v0.4). Lives here rather than in the engine because the
 * career data model records it, and it is fixed at the moment of the return.
 */
export type HomecomingKind =
  | 'prime_hero'
  | 'successful_return'
  | 'veteran_farewell'
  | 'redemption'
  | 'rejected_child_star'
  | 'returning_leader'
  | 'european_returnee';

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
  /**
   * Which homecoming story it was, fixed at the moment of the return. Optional because saves
   * written before v0.4 have a return but no record of what kind it was.
   */
  returnKind?: HomecomingKind;
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
  | 'rare'
  /** v0.5: agents, managers, personal coaches - the recurring humans. */
  | 'people';

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
/* Birth date and cohort (v0.3.1)                                      */
/* ------------------------------------------------------------------ */

/**
 * A real date of birth, stored as plain numbers.
 *
 * Deliberately not a Date or a timestamp: football age and cohort maths must be exact and
 * timezone-independent, and a UTC timestamp for "17 December 2021" can render as the 16th or
 * the 18th depending on where the browser is.
 */
export interface DateOfBirth {
  day: number;
  month: number;
  /** Locked to the cohort year. The player picks only the day and month. */
  year: number;
}

/**
 * Where in the season the world currently is. We do not simulate day by day - three
 * checkpoints are enough for the displayed age to move naturally through a season.
 */
export type SeasonPoint = 'preseason' | 'midseason' | 'season_end';

/* ------------------------------------------------------------------ */
/* Career origin (v0.3.1)                                              */
/* ------------------------------------------------------------------ */

/**
 * How the career started. Maccabist always begins with Maccabi as the goal, but never
 * guarantees Maccabi.
 */
export type CareerOrigin =
  /** Spotted by a Maccabi scout and invited straight in. Rare. */
  | 'scouted'
  /** Went to the trials and got in. */
  | 'trial_accepted'
  /** Went to the trials and did not get in - the career continues elsewhere. */
  | 'trial_rejected';

export interface TrialResult {
  accepted: boolean;
  /** Which attempt this was: 1 for the first trials at nine years old. */
  attempt: number;
  season: number;
  /** Narrative shown to the player. Never a percentage. */
  title: string;
  description: string;
  icon: string;
}

/* ------------------------------------------------------------------ */
/* Football World (v0.4)                                               */
/* ------------------------------------------------------------------ */

/**
 * How a club's season went, as a category rather than a table position.
 *
 * Categories keep the world cheap enough to simulate 100,000 careers while still giving a
 * career the context it needs: "we nearly went down and you kept us up" is a different story
 * from "we won it".
 */
export type ClubSeasonOutcome =
  // top divisions
  | 'champion'
  | 'title_challenge'
  | 'european_places'
  | 'upper_table'
  | 'mid_table'
  | 'lower_table'
  | 'relegation_battle'
  | 'relegated'
  // second divisions
  | 'promoted'
  | 'promotion_challenge'
  | 'second_upper_half'
  | 'second_mid_table'
  | 'second_lower_half'
  | 'struggled';

export interface ClubSeasonResult {
  /** Where the club actually finished (v0.4.6). Optional: pre-v0.4.6 results have no table. */
  finalPosition?: number;
  season: number;
  clubId: string;
  leagueId: string;
  outcome: ClubSeasonOutcome;
  /** Hebrew summary line, e.g. "מאבק על מקומות אירופה". */
  label: string;
  /** How much the player moved this result, 0-1. Zero for a squad player. */
  playerImpact: number;
}

/**
 * The world outside the player, carried on the career so it stays seeded and serialisable.
 *
 * Deliberately sparse: only clubs that have actually moved division are recorded, and only the
 * player's own club seasons are kept. There is no attempt to run every league.
 */
/* ------------------------------------------------------------------ */
/* Live league state (v0.4.6)                                          */
/* ------------------------------------------------------------------ */

/**
 * Where the season has got to, for table purposes.
 *
 * Deliberately the existing `SeasonSlot` plus a terminal `end`, rather than a new six-phase
 * model. The event planner already works in early/mid/late slots, and a table phase that does
 * not line up with the slot an event was planned for would reintroduce exactly the mismatch
 * v0.4.6 exists to remove.
 */
export type SeasonPhase = SeasonSlot | 'end';

/** One line of a league table. */
export interface TableRow {
  clubId: string;
  /** Carried on the row so filler clubs need no Club record. */
  name: string;
  position: number;
  played: number;
  points: number;
  goalDifference: number;
}

export interface LeagueTable {
  leagueId: string;
  season: number;
  phase: SeasonPhase;
  rows: TableRow[];
}

/**
 * A club's whole season, decided at preseason.
 *
 * This is the change that makes v0.4.6 possible. The season outcome used to be drawn at season
 * *end*, while `planSeason` picks every event for the year at preseason - so a late-slot
 * title-decider was chosen months before anyone knew the club would finish eleventh. Deciding
 * the shape of the season up front means event eligibility can be gated on it.
 *
 * The path is stored rather than the tables: a table is a pure function of the projection, so
 * saves stay small and a reloaded season reproduces exactly the same table.
 */
export interface SeasonProjection {
  season: number;
  clubId: string;
  leagueId: string;
  /** Size of the division this season, so position reads correctly against it. */
  leagueSize: number;
  /** Where the club ends up, 1-based. */
  finalPosition: number;
  /** The outcome category that position corresponds to. */
  finalOutcome: ClubSeasonOutcome;
  /** Position at each phase, converging on finalPosition. */
  path: Record<SeasonPhase, number>;
  /** Seed for deriving the rest of the table deterministically. */
  tableSeed: number;
}

/**
 * What the club is actually fighting for, derived from the projection.
 *
 * This is the authoritative world state that events gate on. Nothing may claim a title race,
 * a relegation battle or a promotion push except by asking this.
 */
export interface LeagueContext {
  leagueId: string;
  phase: SeasonPhase;
  position: number;
  leagueSize: number;
  points: number;
  played: number;
  /** Points behind the leader; 0 when top. */
  pointsFromTop: number;
  /** Points to the European places, or null where the league has none modelled. */
  pointsFromEurope: number | null;
  /** Points above the relegation zone, or null where the league has none. */
  pointsFromSafety: number | null;
  /** Points to the promotion places, or null in a top division. */
  pointsFromPromotion: number | null;
  titleRace: boolean;
  europeRace: boolean;
  midTable: boolean;
  relegationBattle: boolean;
  promotionRace: boolean;
  championClinched: boolean;
  promotionClinched: boolean;
  relegationConfirmed: boolean;
  /** Doing clearly better, or worse, than the squad's quality implies. */
  overperforming: boolean;
  underperforming: boolean;
}

/**
 * How big a match this is (v0.4.6). Derived, never asserted by an event.
 */
export type MatchImportance = 'routine' | 'important' | 'huge';

/**
 * The fixture an event is talking about.
 *
 * Derived from the career and the live table rather than stored, so there is always a real club
 * on the other side of it in a real table position. An event may only use a label - דרבי, משחק
 * אליפות, קרב תחתית - that this context actually supports.
 */
export interface MatchContext {
  opponentClubId: string;
  opponentName: string;
  /** Where the opponent sits, or null if they are not in a modelled table. */
  opponentPosition: number | null;
  home: boolean;
  rivalryType: RivalryType | null;
  rivalryName: string | null;
  /** True only for a modelled local derby. Not a synonym for "important". */
  isDerby: boolean;
  importance: MatchImportance;
  titleDecider: boolean;
  relegationSixPointer: boolean;
  promotionDecider: boolean;
  vsMaccabi: boolean;
  vsFormerClub: boolean;
  /** Points between the two clubs, or null when the opponent has no table row. */
  pointsGap: number | null;
}

/**
 * What the player has actually played this season (v0.4.8).
 *
 * The authoritative participation record, and the thing every on-field event is gated on. Before
 * this, `match_moment` events gated on `roleValue` - which is standing in the squad, not playing -
 * so a backup with a decent reputation could be handed "minute 88, the ball reaches you" in a
 * season he finished with zero appearances. Nought of twenty-one match events checked.
 *
 * Written by the season engine as each half is played, reset at preseason. Optional because
 * v0.4.7 saves have none; `hydrateCareer` rebuilds it from the last season record.
 */
export interface SeasonParticipation {
  /** The season this ledger describes. A stale season means "nothing played yet". */
  season: number;
  appearances: number;
  starts: number;
  /**
   * Set when an on-field event has been delivered this season.
   *
   * The reconciliation flag. If an event told the player he was on the pitch, the season cannot
   * settle with zero appearances - the event is evidence, and settlement honours it rather than
   * contradicting it.
   */
  onFieldEventFired?: boolean;
}

export interface WorldState {
  /**
   * The player's club's season, decided at preseason (v0.4.6). Optional: v0.4.5.1 saves have
   * none, and `hydrateCareer` projects one deterministically rather than leaving it null.
   */
  projection?: SeasonProjection | null;
  /** Maccabi's own season, tracked in parallel so it has a table wherever the player is. */
  maccabiProjection?: SeasonProjection | null;
  /**
   * Maccabi's own seasons while the player was elsewhere (v0.4.1).
   *
   * Kept apart from `clubSeasons` so the season summary still shows the player's own club and
   * nothing confuses whose campaign a result belonged to. Optional because v0.4 saves have none.
   */
  maccabiSeasons?: ClubSeasonResult[];
  /** clubId -> leagueId, for clubs that have been promoted or relegated. */
  clubLeagues: Record<string, string>;
  /** The player's club's season results, most recent last. */
  clubSeasons: ClubSeasonResult[];
}

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
  | 'loan_success'
  // origin (v0.3.1)
  | 'scouted_by_maccabi'
  | 'passed_first_maccabi_trial'
  | 'failed_first_maccabi_trial'
  | 'returned_for_second_trial'
  | 'joined_maccabi_late'
  | 'signed_after_external_breakthrough'
  | 'youngest_in_cohort_thriving'
  // Football World (v0.4)
  | 'won_promotion'
  | 'suffered_relegation'
  | 'survived_relegation_battle'
  | 'won_title_outside_maccabi'
  /*
   * v0.4.6: the near misses.
   *
   * A season spent in a title race that ended without the title, or a promotion push that fell
   * short, is one of the most callback-able things that can happen to a career - and until the
   * live table existed the game had no way to know it had happened, because an outcome
   * category was only drawn at the final whistle.
   */
  | 'fought_for_title'
  | 'missed_promotion'
  | 'breakout_at_small_club'
  | 'moved_up_a_level'
  | 'moved_down_a_level'
  | 'first_move_abroad'
  | 'failed_abroad'
  | 'rebuilt_career'
  | 'returned_to_israel'
  | 'direct_europe_from_non_maccabi'
  | 'loan_breakthrough'
  // Maccabi relationship (v0.4)
  | 'played_against_maccabi'
  | 'scored_against_maccabi'
  | 'refused_to_celebrate'
  | 'celebrated_against_maccabi'
  | 'booed_at_sami_ofer'
  | 'applauded_at_sami_ofer'
  // The ambient Maccabi world (v0.4.1) - things the club did while he was elsewhere
  | 'maccabi_title_without_me'
  | 'maccabi_relegated_while_away'
  | 'maccabi_asked_about_me'
  // People (v0.5) - narrative facts about relationships, each carrying a personId
  | 'signed_with_agent'
  | 'changed_agent'
  | 'rejected_elite_agent'
  | 'agent_opened_market'
  | 'manager_gave_debut'
  | 'manager_showed_faith'
  | 'manager_conflict'
  | 'manager_left'
  | 'new_manager_page'
  | 'personal_coach_started'
  | 'personal_coach_breakthrough'
  // Maccabi Legacy (v0.6) - the moments the club's history books notice
  | 'maccabi_century'
  | 'maccabi_top10_appearances'
  | 'maccabi_appearance_record'
  | 'first_maccabi_captaincy';

export interface CareerMemory {
  kind: MemoryKind;
  season: number;
  age: number;
  stage: AcademyStage;
  /** Optional detail for templating, e.g. a club name. */
  detail?: string;
  /**
   * Who was involved (v0.5, Phase 2). A memory referencing a person keeps referencing the SAME
   * person for life - the manager who gave the debut stays that manager, whoever is in charge
   * now. Career Memory stores narrative facts about relationships; it is never a second source
   * of football-stat truth.
   */
  personId?: string;
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
  | 'homecoming'
  /** v0.4: relegated, and what he did about it. Runs off the football-world memories. */
  | 'fall_and_rise';

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

/**
 * Which club situation an event belongs to (v0.3.1).
 *
 * Playtesting found Maccabi-specific events firing at other clubs. Rather than relying on
 * every author remembering `atMaccabi: true`, the scope is explicit and the event-audit test
 * checks that anything mentioning Maccabi in its text declares one.
 */
/**
 * How an outcome relates to Maccabi, for the Maccabism guard (v0.4.8).
 *
 * Deliberately narrow. "The player is currently at Maccabi" is *not* on this list: training hard
 * at Maccabi is training hard, and it should not make a man more of a Maccabist by itself. What
 * moves the number is a decision about the club - its identity, its supporters, its people, or
 * leaving and coming back.
 */
export type MaccabiRelevance =
  /** Not about Maccabi. May not change Maccabism. */
  | 'none'
  /** The club's identity, colours, history - what it means to wear the shirt. */
  | 'identity'
  /** The supporters, at Sami Ofer or anywhere else. */
  | 'fans'
  /** Former teammates, coaches, people from the club. */
  | 'people'
  /** Leaving Maccabi, or being asked to. */
  | 'leaving'
  /** Coming back, or being asked to. */
  | 'return'
  /** Facing them. */
  | 'opponent';

/* ------------------------------------------------------------------ */
/* People (v0.5)                                                       */
/* ------------------------------------------------------------------ */

/*
 * v0.5's product goal in one sentence: the career should contain recurring human relationships,
 * so that at retirement the player remembers not only which clubs he played for but who believed
 * in him, who pushed him to leave, and who gave him his chance.
 *
 * Three person types, deliberately no more - the brief is explicit that this must not grow into
 * a social graph. Every person is fictional, generated from seeded name pools, and keeps a stable
 * id for life: the agent who signed him at sixteen is the same object in a memory at thirty-five.
 */
export type PersonType = 'agent' | 'club_manager' | 'personal_coach';

export type AgentArchetypeId =
  /** Patient, protective, strong at home. The relationship is the product. */
  | 'family'
  /** Knows every Israeli chairman. Loans and role-fit moves. */
  | 'israel_networker'
  /** Opens specific foreign markets. Less useful for a domestic step. */
  | 'europe_specialist'
  /** Pushes upward. More offers, more ambition, more risk of a bad fit. */
  | 'dealmaker'
  /** Rare, reputation-gated, wide reach - and less patience for sentiment. */
  | 'super_agent';

export type ManagerArchetypeId =
  /** Gives young players real chances. */
  | 'youth_believer'
  /** Trust must be earned. Leans on the established. */
  | 'conservative'
  /** Role fit and discipline over flair. */
  | 'disciplinarian'
  /** Rotates the squad - more opportunities, less stability. */
  | 'rotation'
  /** Reputation and ability carry the day. Hard on unknowns, good for stars. */
  | 'star_driven'
  /** Trust moves fast in both directions. */
  | 'short_fuse';

export type CoachSpecialtyId =
  | 'goalkeeping'
  | 'technical'
  | 'fitness'
  | 'mental'
  | 'finishing'
  | 'speed';

/**
 * A person with a stable identity (v0.5, Phase 1).
 *
 * The id is deterministic - generated from the career's seeded rng and a per-career sequence
 * number - and NEVER regenerated. If the name were re-rolled per event, "the manager who gave
 * you your debut" would be a different man every time the sentence was rendered.
 */
export interface PersonIdentity {
  id: string;
  type: PersonType;
  /** Full display name, Hebrew or Hebrew-transliterated. */
  name: string;
  /** Surname alone, for compact UI. */
  shortName: string;
  /** AgentArchetypeId | ManagerArchetypeId | CoachSpecialtyId, by type. */
  archetypeId: string;
  createdSeason: number;
  /** Name-pool provenance - one of the modelled club countries. */
  country: string;
}

/**
 * One manager's spell with the player (v0.5, Phase 15).
 *
 * THE SCOPING RULE: `career.coachTrust` IS the relationship with the *current* manager - there
 * is deliberately no `trust` field on the open tenure, because two copies of one number is the
 * exact defect v0.4.8 existed to remove. Trust is snapshotted into `finalTrust` only when the
 * relationship ends (the manager leaves, or the player does).
 */
export interface ManagerTenure {
  person: PersonIdentity;
  clubId: string;
  fromSeason: number;
  /** Set when the relationship ends. An open tenure has no end. */
  toSeason?: number;
  /** Where trust stood when it ended. The current relationship lives in `career.coachTrust`. */
  finalTrust?: number;
  /** This manager handed the player his senior debut. Callback material for life. */
  gaveDebut?: boolean;
}

/** The player's representation (v0.5, Phases 3-5). */
export interface AgentBond {
  person: PersonIdentity;
  /** 0-100. Separate from Maccabism and from Coach Trust, and never shown as a giant bar. */
  relationship: number;
  sinceSeason: number;
  /** Set when the player moves on. */
  endedSeason?: number;
  /** Advice bookkeeping, so later events can honestly reference the pattern. */
  advicesFollowed: number;
  advicesRejected: number;
}

/** A personal specialist the player trains with outside the club (v0.5, Phases 21-26). */
export interface PersonalCoachBond {
  person: PersonIdentity;
  specialty: CoachSpecialtyId;
  sinceSeason: number;
  endedSeason?: number;
  /** Full seasons of work together - feeds the breakthrough arc, not a stat bonus. */
  seasonsTogether: number;
}

/**
 * Everything people (v0.5).
 *
 * Optional on Career so every v0.4.8 save loads; `hydrateCareer` builds it, seeding the current
 * manager relationship from the existing Coach Trust so nothing is lost (Phase 15.1).
 */
export interface PeopleState {
  /** The current club's manager. His trust IS `career.coachTrust`. */
  manager: ManagerTenure | null;
  /** Every ended manager relationship, oldest first. */
  managerHistory: ManagerTenure[];
  agent: AgentBond | null;
  agentHistory: AgentBond[];
  personalCoach: PersonalCoachBond | null;
  personalCoachHistory: PersonalCoachBond[];
  /**
   * Last-known manager at clubs the player has met, with the dates that make continuity
   * decidable (v0.5.1). Not a world simulation - only clubs the player knew, and the question
   * is only ever asked when he comes back.
   */
  clubManagers: Record<string, ClubManagerRecord>;
  /** Monotonic sequence for person ids, so they never collide. */
  personSeq: number;
  /** Season a people-family event last fired, for anti-spam pacing (Phase 42). */
  lastPeopleEventSeason?: number;
}

/**
 * A club's last-known manager, and when the player last saw him (v0.5.1).
 *
 * `lastSeenSeason` is what makes off-screen continuity honest: a player who leaves for one
 * season should usually find the same man, and one who leaves for a decade should not. Storing
 * the date rather than a precomputed answer means the question is asked when it matters, from
 * the club's own history rather than from the player's memory of it.
 */
export interface ClubManagerRecord {
  person: PersonIdentity;
  installedSeason: number;
  lastSeenSeason: number;
}

/** One recorded Maccabism change (v0.4.8, Phase 24). */
export interface MaccabismTraceEntry {
  season: number;
  /** What caused it - an event id, or a transfer offer. */
  source: string;
  relevance: MaccabiRelevance;
  /** What the outcome asked for, before the headroom taper. */
  requested: number;
  /** What was actually applied. Differs from `requested` near the ceiling. */
  applied: number;
  /** The value afterwards. */
  after: number;
}

export type ClubScope =
  /** Only while actually at Maccabi Haifa (academy or senior). */
  | 'maccabi'
  /** Generic - reads naturally at whatever club the player is at. Text must not name a club. */
  | 'currentClub'
  /** Only while somewhere other than Maccabi. */
  | 'nonMaccabi'
  /** Only while outside Israel. */
  | 'abroad'
  /** Has Maccabi history but is currently elsewhere - the "they are still watching" events. */
  | 'formerMaccabi'
  /** Truly universal. */
  | 'any';

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
  /**
   * Which club context this event belongs to (v0.3.1). The single most useful guard against
   * immersion-breaking events: a Maccabi song in the stands makes no sense at Hapoel Afula.
   */
  clubScope?: ClubScope;
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

  /* ---------- v0.4: professional-football eligibility ---------- */
  /**
   * This event belongs to professional football - senior training, a bench call, a contract,
   * a debut. Requires נוער or above. Implied automatically by `seniorPhases`, because a
   * senior *phase* is meaningless for a child and used to let breakthrough events reach
   * nine year olds.
   */
  requiresProfessionalFootball?: boolean;
  /**
   * ...but this particular event may also reach an extraordinary נערים א׳ player. Use only for
   * things like "the first-team coach came to watch", never for contracts.
   */
  allowsExceptionalYouth?: boolean;

  /* ---------- v0.4: standing with Maccabi ---------- */
  /**
   * How the club remembers him. This is what lets one event text serve a returning hero and a
   * booed defector without either reading wrong, and it is the intended way to write anything
   * about Maccabi for a player who is no longer there.
   */
  maccabiRelationship?: MaccabiRelationship[];
  /** What the Sami Ofer crowd would do, which is not always what his record deserves. */
  crowdResponse?: MaccabiStanding[];
  /** He must once have played senior football for Maccabi (the academy alone does not count). */
  playedForMaccabi?: boolean;
  /** He must be somewhere he could actually meet them - same division, not their own player. */
  canFaceMaccabi?: boolean;

  /* ---------- v0.4.1: the ambient Maccabi world ---------- */
  /**
   * Maccabi's own last season, while the player was elsewhere. This is what lets a story exist
   * about the club rather than only about the player.
   */
  maccabiSeasonOutcome?: ClubSeasonOutcome[];
  /** Maccabi won the league in a season he was not there for. */
  maccabiWonWithoutHim?: boolean;
  /** Maccabi is having a bad time: a poor season, or in the second division. */
  maccabiInCrisis?: boolean;

  /* ---------- v0.4: the club's own season ---------- */
  /** Which division the club is in. 1 is a top flight, 2 a second division. */
  clubLeagueTier?: number[];
  /**
   * How the club stands relative to its own division, -1..1.
   *
   * This is what an in-season event can honestly know: the table is only resolved at season end,
   * but everyone at the club knows in August whether they are expected to go up, stay up, or
   * fight. A strongly negative value is a relegation candidate; strongly positive in tier 2 is a
   * promotion favourite.
   */
  minClubStrength?: number;
  maxClubStrength?: number;

  /* ---------- v0.4.6: what the club is actually fighting for ---------- */
  /*
   * These read the live table via `leagueContext`, which is committed at preseason - so an event
   * planned in August for the late slot is gated on the season the club will actually have, not
   * on last year's finish or on nothing at all.
   *
   * Every one of them fails closed. A career with no table (youth football, a league with no
   * modelled shape) matches none of these conditions rather than all of them, so an event about
   * a title race can never reach a fifteen year old.
   */
  /** The club is genuinely in contention at the top. */
  titleRace?: boolean;
  /** Chasing a European place, and not already in the title race. */
  europeRace?: boolean;
  /** Close enough to the drop for it to be the story. */
  relegationBattle?: boolean;
  /** Second division, in the promotion picture. */
  promotionRace?: boolean;
  /** None of the above: the season has nothing riding on it. */
  midTable?: boolean;
  /** The title is mathematically settled. */
  championClinched?: boolean;
  /** Going down is mathematically settled. */
  relegationConfirmed?: boolean;
  /** Doing clearly better, or worse, than the squad's quality implies. */
  clubOverperforming?: boolean;
  clubUnderperforming?: boolean;
  /** League position, 1 = top. `maxLeaguePosition: 4` means "fourth or better". */
  minLeaguePosition?: number;
  maxLeaguePosition?: number;
  /** The event needs a modelled league table to exist at all. */
  requiresLeagueTable?: boolean;

  /* ---------- v0.4.8: participation ---------- */
  /**
   * The event puts the player on the pitch, so he must actually be playing (Phase 3.2).
   *
   * Checked against the participation ledger once a half has been played, and against a
   * noise-free minutes projection before that - because `planSeason` chooses the whole season at
   * preseason, when nothing has been played and the ledger is empty by definition.
   *
   * Everything a player can receive while *not* playing - training, a conversation with the
   * coach, frustration on the bench, media, a loan discussion - is unaffected.
   */
  requiresAppearance?: boolean;
  /** Stronger: he has to have been in the starting eleven, not a substitute. */
  requiresStart?: boolean;

  /* ---------- v0.4.6: the fixture ---------- */
  /**
   * The event describes a derby.
   *
   * True means the club must have a modelled local rival *in the same division this season*.
   * This is the condition that makes `rare_derby_legend` - a derby event that carried no club
   * condition whatsoever - impossible to fire at a club with no derby.
   */
  requiresDerby?: boolean;
  /** Any modelled rivalry of these types against a club in the same division. */
  rivalryTypes?: RivalryType[];
  /** How big the fixture is. Derived from the table, never asserted by the event. */
  matchImportance?: MatchImportance[];
  /** The match can genuinely decide the title. Requires a late-phase title race on both sides. */
  titleDecider?: boolean;
  /** Two clubs in the relegation fight, close together. */
  relegationSixPointer?: boolean;
  /** A promotion decider, which only a second division can have. */
  promotionDecider?: boolean;
  /** The opponent is Maccabi. */
  vsMaccabi?: boolean;
  /** The opponent is a club he used to play for. */
  vsFormerClub?: boolean;

  /* ---------- v0.5: people ---------- */
  /** The player must have (or must not have) representation. */
  requiresAgent?: boolean;
  forbidsAgent?: boolean;
  /** Only when the player's stage makes representation plausible (Phase 6). */
  agentEligibleStage?: boolean;
  /** The current agent must be one of these styles. */
  agentArchetypes?: AgentArchetypeId[];
  /** Bounds on the agent relationship - a conflict event needs a strained one. */
  minAgentRelationship?: number;
  maxAgentRelationship?: number;
  /** The current manager must be one of these kinds of manager. */
  managerArchetypes?: ManagerArchetypeId[];
  /** The current manager handed the player his senior debut - callback material. */
  managerGaveDebut?: boolean;
  /** A specialist is (or is not) currently working with the player. */
  requiresPersonalCoach?: boolean;
  forbidsPersonalCoach?: boolean;
  /** ...of one of these specialties. */
  personalCoachSpecialties?: CoachSpecialtyId[];
  /** Seasons with the current specialist - a breakthrough needs history behind it. */
  minCoachSeasonsTogether?: number;
  /** The club changed manager this season - the "new page" events key on this. */
  newManagerThisSeason?: boolean;
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
  /**
   * A club id, or the pool sentinel `'external_youth'` to draw a youth club. Naming a pool
   * keeps a destination age-appropriate and stops one club dominating a career path.
   */
  transferTo?: string;
  captain?: boolean;

  /* ---------- v0.3 ---------- */
  /**
   * Record something the rest of the career is allowed to remember. A list when one outcome
   * establishes several facts at once - scoring against Maccabi is also *facing* them, and an
   * event that only wrote the headline memory left the plainer one unrecorded.
   */
  remember?: MemoryKind | MemoryKind[];
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

  /* ---------- v0.5: people ---------- */
  /** Sign with an agent of this style. Ends the previous bond honestly if one exists. */
  signAgent?: AgentArchetypeId;
  /** Part ways with the current agent, without a successor. */
  dropAgent?: boolean;
  /** Move the agent relationship. Separate from Maccabism and from Coach Trust. */
  agentRelationship?: number;
  /** Record that the player followed / ignored the agent's advice, for later callbacks. */
  agentAdvice?: 'followed' | 'rejected';
  /** Start working with a personal specialist. Position fit is validated fail-closed. */
  startPersonalCoach?: CoachSpecialtyId;
  /** Stop the personal-coach work. */
  endPersonalCoach?: boolean;
}

export interface EventOutcome {
  id: string;
  /**
   * Why this outcome is allowed to move Maccabism (v0.4.8).
   *
   * Maccabism is what the player feels about one club, and it was drifting because of events at
   * other clubs entirely. An outcome that declares a non-zero `maccabism` effect must say what
   * about Maccabi happened; `eventValidation` fails the build otherwise, and the runtime guard
   * zeroes the delta if it somehow gets through.
   *
   * `'none'` is the default and means the outcome may not touch Maccabism at all.
   */
  maccabiRelevance?: MaccabiRelevance;
  /** Weight before modifiers. Relative to the other outcomes of the same choice. */
  baseWeight: number;
  /** Outcome is impossible unless these hold. */
  conditions?: EventConditions;
  modifiers?: OutcomeModifier[];
  /** Weight tuning from traits and from what happened earlier in the career. */
  traitModifiers?: TraitModifier[];
  memoryModifiers?: MemoryModifier[];
  tone: Tone;
  /**
   * What this outcome would mean, shown *before* the player chooses (v0.4.6).
   *
   * Without one, the preview falls back to a global label table and then to the valence, which
   * is how a player ended up being offered "תוצאה טובה 30% / תוצאה רעה 30%". That tells him
   * nothing he could not have guessed - the whole point of showing odds is to show odds *on
   * something specific*.
   *
   * Deliberately separate from `text`. `text` is the resolution and is written in the past
   * tense; showing it before the roll would both spoil the result and read as though it had
   * already happened. This is the possibility, short and in the present or future.
   */
  preview?: string;
  /** Short Hebrew narrative - the story comes first, numbers second. */
  text: string;
  effects: EventEffects;
}

/** Qualitative hint shown on a choice button instead of raw percentages. */
export type ChoiceRisk = 'safe' | 'balanced' | 'risky' | 'opportunity';

/* ---------- Decisions with visible odds (v0.4.1) ---------- */

/**
 * How good or bad an outcome is, for presentation only.
 *
 * The engine owns this classification; the UI renders it. A colour must never be what decides
 * whether something counts as a disaster.
 */
export type OutcomeValence =
  | 'majorPositive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'majorNegative';

export type RiskLevel = 'low' | 'medium' | 'high';

/** One possible outcome, as shown to the player before he chooses. */
export interface DecisionOutcomeView {
  id: string;
  /** Short label. The full narrative text is only revealed after the choice. */
  label: string;
  valence: OutcomeValence;
  /** Exact normalised probability, 0-1. */
  probability: number;
  /** Integer percentage. Across a distribution these sum to exactly 100. */
  percent: number;
  /** Effective weight, kept so the resolver can draw from this same object. */
  weight: number;
}

/**
 * Everything about one choice's uncertainty.
 *
 * Produced by `calculateOutcomeDistribution` and consumed by BOTH the UI preview and the
 * resolver, which is what guarantees the displayed odds are the odds that were used.
 */
export interface DecisionDistribution {
  eventId: string;
  choiceId: string;
  /** Only outcomes that are actually possible for this player. */
  outcomes: DecisionOutcomeView[];
  totalWeight: number;
  risk: RiskLevel;
  /** Combined probability of a positive / negative result, 0-1. */
  upside: number;
  downside: number;
}

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
  /**
   * The odds this result was drawn from (v0.4.1).
   *
   * Recorded so the reveal animation can cycle through exactly what was possible, and so a bug
   * report can show the probabilities the player was actually looking at. Optional because
   * results written before v0.4.1 do not have it.
   */
  odds?: DecisionOutcomeView[];
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

/**
 * What a club is signing the player to be (v0.4).
 *
 * Joining a bigger club as a backup is not automatically better than staying where you are as
 * a star, and the expected role is what makes that a real dilemma rather than a formality.
 */
export type ExpectedRole = 'star' | 'key' | 'starter' | 'rotation' | 'backup' | 'project';

/** Where a move sits relative to where the player currently is. */
/**
 * Five bands rather than three (v0.4.1).
 *
 * League level alone could not tell Hapoel Hadera -> Maccabi Haifa from Maccabi Haifa -> Hapoel
 * Hadera: same division, so both read "lateral". A move's direction is about the club's career
 * level, not just which competition it plays in.
 */
export type MoveDirection = 'major_up' | 'up' | 'lateral' | 'down' | 'major_down';

/**
 * How Maccabi sees the player (v0.4).
 *
 * The mirror of Maccabism, and deliberately not the same thing: Maccabism is what the player
 * feels and spends, this is what the club remembers and he can only earn. Always derived from
 * the record, never stored.
 */
export type MaccabiRelationship =
  | 'son_of_the_club'
  | 'icon'
  | 'beloved'
  | 'respected'
  | 'known'
  | 'stranger'
  | 'traitor';

/** What the Sami Ofer crowd does when he touches the ball in someone else's shirt. */
export type MaccabiStanding = 'warm' | 'indifferent' | 'hostile';

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

  /* ---------- v0.4: what the UI needs to make this a real decision ---------- */
  leagueId?: string;
  /** How strong the destination league is, 0-100. */
  leagueLevel?: number;
  expectedRole?: ExpectedRole;
  direction?: MoveDirection;
  /** Qualitative hints only - never a probability. */
  hints?: string[];
}

/* ------------------------------------------------------------------ */
/* Career flow                                                         */
/* ------------------------------------------------------------------ */

export type CareerPhase =
  /** v0.3.1: how the career began - scouted, or the Maccabi trials. Shown once. */
  | 'origin'
  /** v0.3.1: a later trial for a player Maccabi turned down. */
  | 'retrial'
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
  | 'normal' // one step up the ladder with the cohort
  | 'early' // pushed up ahead of the cohort
  /**
   * Same age group as last season because the player's own cohort has arrived in it. Only
   * reachable after an early promotion, and explicitly NOT repeating a year - see
   * resolveAcademyProgression.
   */
  | 'cohort_caught_up'
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

  /**
   * Football age at the current season point, derived from `dateOfBirth`. Kept on the object
   * because almost everything reads it, but it is never the source of truth for the academy
   * stage - see `naturalStage()`.
   */
  age: number;
  startAge: number;
  currentSeason: number;
  startSeason: number;

  /* ---------- v0.3.1 ---------- */
  dateOfBirth: DateOfBirth;
  /** Birth year. The whole cohort moves up the ladder together. */
  birthCohort: number;
  /** Where in the season we are, so the displayed age moves naturally through the year. */
  seasonPoint: SeasonPoint;
  origin: CareerOrigin;
  /** Every Maccabi trial the player has attended, in order. */
  trials: TrialResult[];

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
  /** The football world around the player (v0.4). */
  world: WorldState;
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
  /**
   * What he has actually played this season (v0.4.8).
   *
   * The authoritative participation record. Optional so v0.4.7 saves load; `hydrateCareer`
   * rebuilds it rather than leaving on-field events ungated.
   */
  seasonParticipation?: SeasonParticipation;
  /**
   * The people around the career (v0.5). Optional so v0.4.8 saves load; `hydrateCareer`
   * migrates, seeding the current manager's relationship from the existing `coachTrust`.
   */
  people?: PeopleState;
  /**
   * Maccabi Legacy milestones already announced (v0.6). The ONLY persisted legacy state -
   * everything else derives from season records. Exists so a milestone fires exactly once,
   * and so a loaded veteran career is marked as having already passed 50/100/200 rather than
   * being showered with three retroactive celebrations (Phase 45).
   */
  legacyMilestones?: string[];
  /**
   * The last few Maccabism changes, with why each was allowed (v0.4.8, Phase 24).
   *
   * The reported bug was Maccabism moving for reasons that had nothing to do with Maccabi, and the
   * fix is a guard that is easy to state and impossible to see. This makes it visible: every entry
   * names what moved the number and under which relevance, so "why did that go up" has an answer
   * on the screen instead of in a diff.
   *
   * Bounded and optional - a trace that grows without limit is a save-size bug.
   */
  maccabismTrace?: MaccabismTraceEntry[];
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

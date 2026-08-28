/**
 * The public API of the game engine.
 *
 * React only ever calls these functions - it never touches the other engine modules.
 * Every function takes a Career and returns a new Career, with the RNG state carried
 * inside the career itself so a save file resumes the exact same random stream.
 *
 * The season is a small state machine:
 *
 *   preseason → [early event] → first half → [mid summary] → [mid event]
 *             → second half → [late key moment] → season summary
 *             → progression / youth-to-senior / transfers → next season
 */

import { FIRST_STAGE, stageConfig } from '../data/academy';
import { MACCABI_ACADEMY_ID, MACCABI_ID, getClub } from '../data/clubs';
import { hasCoherentIdentity } from './identity';
import { EVENTS_BY_ID } from '../data/events';
import { TRAIT_DEFS } from '../data/traits';
import type {
  AttributeDelta,
  Career,
  CareerTrait,
  ClubSeasonResult,
  DateOfBirth,
  MemoryKind,
  Position,
  SeasonSlot,
  TraitId,
} from '../types';
import {
  BIRTH_COHORT,
  CAPTAINCY,
  FIRST_ACADEMY_SEASON,
  ORIGIN,
  RECOVERY,
  WORLD,
  RETIREMENT,
  START,
  START_AGE,
  TRAITS,
} from './balance';
import { daysInMonth, resolveDateOfBirth } from './calendar';
import {
  emptyWorld,
  isGoodSeason,
  leagueOf,
  clubResultFromProjection,
  openWorldSeason,
  recordClubSeason,
  recordMaccabiSeason,
  settleWorldProjection,
} from './worldEngine';
import { ageAt } from './cohort';
import { eligibleForRetrial, resolveOrigin, resolveRetrial } from './originEngine';
import { planSeason, resolveEventChoice } from './eventEngine';
import { outcomeForPosition, projectSeason } from './leagueEngine';
import { leagueShape } from '../data/leagueShape';
import { LEAGUE_TROPHY_IDS } from './truth';
import { mayDeliverOnField, openParticipation } from './participation';
import { computeLegendScore } from './legendEngine';
import { hasTrait, recordMemory } from './memory';
import { advancePeopleSeason, migratePeople, replaceManager } from './peopleEngine';
import {
  addMilestone,
  applyEffects,
  checkAchievements,
  cloneCareer,
  driftTrustTowardsBaseline,
  endOfSeasonReset,
  maybeChangeCoach,
  resolveAcademyProgression,
} from './progressionEngine';
import { clamp, createRng, randomSeed, round, type Rng } from './random';
import { isAtMaccabiSenior, isInAcademy, roleFromValue } from './rules';
import { revealRemainingTraits } from './traitReveal';
import { playFirstHalf, playSecondHalf } from './seasonEngine';
import {
  acceptOffer as acceptTransferOffer,
  applyAutomaticMoves,
  declineAllOffers,
  evaluateSeniorTransition,
  generateOffers,
  seniorTransitionOffers,
  stayAnotherYouthYear,
  verdictToProgression,
} from './transferEngine';

/**
 * Bumped for v0.3.1: date of birth, birth cohort, season point, origin and trials. A v0.3
 * save has none of these fields, so it cannot be migrated meaningfully - the versioned
 * storage layer drops it and the welcome screen explains why.
 */
export const SCHEMA_VERSION = 4;

/**
 * Fills in anything a save written by an earlier build of this schema version is missing.
 *
 * v0.4 added `Career.world` without bumping the schema, because every other v0.3.1 field is
 * still valid and dropping a career in progress would be a worse outcome than migrating it. But
 * a save written before the world existed has no `world` at all, and the first thing the season
 * loop does is read `world.clubLeagues` - so loading one crashed the game outright.
 *
 * Called on load rather than everywhere the field is read: one place to add to, and the engine
 * stays free to assume a well-formed Career.
 */
export function hydrateCareer(career: Career): Career {
  let next = career;

  if (!next.world || !Array.isArray(next.world.clubSeasons)) {
    next = {
      ...next,
      world: {
        clubLeagues: next.world?.clubLeagues ?? {},
        clubSeasons: next.world?.clubSeasons ?? [],
      },
    };
  }

  /*
   * Repair the stale-identity bug (v0.4.1).
   *
   * Until the academy ladder was capped at נוער, a נערים א׳ player with an early promotion could
   * land on 'senior' as an ordinary rung - moving the stage without ever moving the club. Saves
   * written in that state have academyStage 'senior' and currentClubId 'maccabi_academy', and
   * every screen reads "מכבי חיפה - מחלקת ילדים" for the rest of the career.
   *
   * The player is a senior; it is the club that was never updated. Put him where the transition
   * should have put him rather than demoting him back into the youth teams, which would undo
   * seasons he has actually played.
   */
  if (!hasCoherentIdentity(next) && next.academyStage === 'senior') {
    next = { ...next, currentClubId: MACCABI_ID };
  }

  /*
   * Give a pre-v0.4.6 save a live league table (v0.4.6).
   *
   * Saves written before this version have no `world.projection`, so a career loaded mid-season
   * would have no table, no league position and no world-state conditions - the game would work,
   * but the season would be blank until the next preseason. Projecting one here fills that in.
   *
   * Seeded from the career's own `rngState` and season rather than from a fresh random, so
   * loading the same save twice produces the same table. The career's rngState is deliberately
   * *not* advanced: consuming a draw here would change every subsequent event in a save made
   * before this code existed, which is a much worse thing to do to someone's career than a
   * missing table.
   */
  if (!next.world.projection && !isInAcademy(next) && !next.retired) {
    const migrated = projectSeason(
      next.world,
      next.currentClubId,
      next.currentSeason,
      next.lastSeasonRecord,
      next,
      createRng((next.rngState ^ (next.currentSeason * 2654435761)) >>> 0),
    );
    if (migrated) {
      const maccabi =
        next.currentClubId === MACCABI_ID
          ? null
          : projectSeason(
              next.world,
              MACCABI_ID,
              next.currentSeason,
              null,
              null,
              createRng((next.rngState ^ 0x4d414343 ^ next.currentSeason) >>> 0),
            );
      next = { ...next, world: { ...next.world, projection: migrated, maccabiProjection: maccabi } };
    }
  }

  /*
   * Rebuild the participation ledger for a pre-v0.4.8 save (Phase 18).
   *
   * Without one, `canBeOnField` falls back to the projection for the whole season - so a save
   * loaded mid-season could still receive an on-field event the player is not entitled to. The
   * last season record is the authoritative history for a *finished* season, so the ledger is
   * rebuilt from it when it belongs to the current season, and opened empty otherwise.
   */
  if (!next.seasonParticipation && !next.retired) {
    const record = next.lastSeasonRecord;
    next =
      record && record.season === next.currentSeason
        ? {
            ...next,
            seasonParticipation: {
              season: next.currentSeason,
              appearances: record.stats.appearances,
              starts: record.stats.starts,
            },
          }
        : { ...next, seasonParticipation: openParticipation(next.currentSeason) };
  }

  /*
   * Remove a league title that the authoritative table contradicts (Phase 18).
   *
   * A v0.4.7 save can contain a championship rolled from `club.titleChance` in a season the club
   * finished fifth - that is the reported bug, and it is already written into the career. It is
   * safely correctable because the world record holds the finishing position, so the contradiction
   * is decidable rather than guessed at.
   *
   * Conservative on purpose: only a title whose season has a recorded position that is NOT first
   * is removed. A title with no matching world record is left alone, because there is nothing to
   * check it against and destroying history on a guess is worse than an inconsistency.
   */
  const contradicted = next.trophies.filter((trophy) => {
    if (!LEAGUE_TROPHY_IDS.includes(trophy.id)) return false;
    if (trophy.id === 'youth_championship') return false;
    const result = next.world.clubSeasons.find(
      (s) => s.season === trophy.season && s.clubId === trophy.clubId,
    );
    if (!result || result.finalPosition === undefined) return false;
    const shape = leagueShape(result.leagueId);
    if (!shape) return false;
    return outcomeForPosition(result.leagueId, result.finalPosition, shape) !== 'champion';
  });
  if (contradicted.length > 0) {
    next = { ...next, trophies: next.trophies.filter((t) => !contradicted.includes(t)) };
  }

  /*
   * Recompute the Maccabi trophy counters from the trophy list (Phase 18).
   *
   * These were incremented inside a branch that excludes loan spells, so a title won on loan at
   * Maccabi awarded the trophy and counted nothing - and the counters are what the retirement
   * poster and two achievements read. `playSecondHalf` now recalculates rather than increments, and
   * an existing save is corrected here for the same reason: the trophy list is the record of what
   * was won, and the counter is only a cached read of it.
   *
   * Also runs after the contradicted-title removal above, deliberately - a save that loses a
   * phantom championship must lose the count with it.
   */
  const countMaccabi = (...ids: string[]): number =>
    next.trophies.filter((t) => t.clubId === MACCABI_ID && ids.includes(t.id)).length;
  const championships = countMaccabi('championship');
  const cups = countMaccabi('cup');
  const europeanRuns = countMaccabi('european_run', 'champions_league');
  if (
    next.maccabi.championships !== championships ||
    next.maccabi.cups !== cups ||
    next.maccabi.europeanRuns !== europeanRuns
  ) {
    next = { ...next, maccabi: { ...next.maccabi, championships, cups, europeanRuns } };
  }

  /*
   * People for a pre-v0.5 save (Phase 49).
   *
   * The one migration that matters is Coach Trust: the number in the save already IS a
   * relationship with somebody - the player just never knew his name. So the current club's
   * manager is instantiated deterministically from the seed, and the existing trust becomes his,
   * unchanged. No agent and no personal coach are invented, because the save knows of none, and
   * a migration that guessed at history would be writing fiction into a career that has one.
   */
  next = migratePeople(next);

  return next;
}

/** Runs `fn` with a fresh Rng seeded from the career and stores the advanced state back. */
function withRng<T extends { rngState: number }>(career: T, fn: (rng: Rng) => T): T {
  const rng = createRng(career.rngState);
  const result = fn(rng);
  return { ...result, rngState: rng.getState() };
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export interface NewCareerInput {
  playerName: string;
  position: Position;
  /** Day and month of birth. The year is always the cohort year. */
  birthDay?: number;
  birthMonth?: number;
  /** Optional fixed seed - the same seed and the same decisions reproduce the career. */
  seed?: number;
}

export function createCareer(input: NewCareerInput): Career {
  const seed = input.seed ?? randomSeed();
  const rng = createRng(seed);

  const isWonderkid = rng.chance(START.wonderkidChance);
  const potential = isWonderkid
    ? rng.int(START.wonderkidPotentialMin, START.wonderkidPotentialMax)
    : rng.int(START.potentialMin, START.potentialMax);

  const traits = rollTraits(rng);
  const hasLeaderTrait = traits.some((t) => t.id === 'leader');
  const hasSelfBelief = traits.some((t) => t.id === 'self_believer');
  const hasInjuryProne = traits.some((t) => t.id === 'injury_prone');

  /*
   * A chosen date is stored exactly as chosen. A random one picks a real month first and
   * then a day that exists in it, so no career is ever born on 31 February.
   */
  const birthMonth = input.birthMonth ?? rng.int(1, 12);
  const birthDay = input.birthDay ?? rng.int(1, daysInMonth(birthMonth, BIRTH_COHORT));
  const dateOfBirth: DateOfBirth = resolveDateOfBirth(birthDay, birthMonth, BIRTH_COHORT);

  const career: Career = {
    id: `career_${seed.toString(36)}_${Date.now().toString(36)}`,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
    playerName: input.playerName.trim() || 'מכביסט',
    position: input.position,

    age: START_AGE,
    startAge: START_AGE,
    // Fixed world timeline (v0.3.1) - no longer randomised per career.
    currentSeason: FIRST_ACADEMY_SEASON,
    startSeason: FIRST_ACADEMY_SEASON,

    dateOfBirth,
    birthCohort: BIRTH_COHORT,
    seasonPoint: 'preseason',
    // Overwritten by resolveOrigin() below; every career passes through Maccabi's door.
    origin: 'trial_accepted',
    trials: [],

    ability: rng.int(START.abilityMin, START.abilityMax),
    hidden: {
      potential,
      form: START.form + rng.int(-6, 6),
      confidence:
        START.confidence + rng.int(-6, 6) + (hasSelfBelief ? TRAITS.selfBelieverConfidence : 0),
      injuryRisk: START.injuryRisk + rng.int(-6, 8) + (hasInjuryProne ? 10 : 0),
      discipline: START.discipline + rng.int(-10, 12),
      pressure: START.pressure + rng.int(-8, 8),
      leadership: START.leadership + rng.int(-12, 12) + (hasLeaderTrait ? TRAITS.leaderLeadership : 0),
      minutesModifier: 1,
      transferBoost: 0,
      promotionBoost: 0,
    },

    maccabism: rng.int(START.maccabismMin, START.maccabismMax),
    reputation: START.reputation,
    coachTrust: rng.int(START.coachTrustMin, START.coachTrustMax),
    roleValue: START.roleValue + rng.int(-6, 6),
    role: 'squad',

    academyStage: FIRST_STAGE,
    olderGroup: 'none',
    seasonsAtStage: 0,

    currentClubId: MACCABI_ACADEMY_ID,
    parentClubId: null,
    loanSeasonsLeft: 0,

    captain: false,
    captainSeasons: 0,

    stats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0 },
    maccabi: {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      seasons: 0,
      championships: 0,
      cups: 0,
      europeanRuns: 0,
      captainSeasons: 0,
      academyGraduate: false,
      everLeft: false,
      returned: false,
      returnAge: null,
      seasonsAfterReturn: 0,
      loyaltyMoments: 0,
      betrayalMoments: 0,
      debutAge: null,
      academySeasons: 0,
      earlyPromotions: 0,
    },
    peakAbility: 0,

    seasonHistory: [],
    trophies: [],
    achievements: [],
    eventsHistory: [],
    flags: [],

    memories: [],
    arcs: [],
    completedArcs: [],
    traits,
    world: emptyWorld(),
    /*
     * The timeline opens at birth, not at joining a club - because whether he joins Maccabi
     * at all is now the first thing that happens to him, and resolveOrigin writes that beat.
     */
    milestones: [
      {
        id: 'born',
        season: FIRST_ACADEMY_SEASON,
        age: 0,
        icon: '🎂',
        text: `נולדת ב-${dateOfBirth.day}.${dateOfBirth.month}.${BIRTH_COHORT}`,
        major: false,
      },
    ],

    // The career opens on how it began, not on the first season.
    phase: 'origin',
    newCoachThisSeason: false,
    seasonSlot: 'early',
    pendingEventIds: [],
    plannedEvents: [],
    pendingOffers: [],

    firstHalfStats: null,
    /*
     * A fresh career opens its own participation ledger (v0.4.8), so `hydrateCareer` stays a pure
     * migration for old saves rather than something every new career also passes through.
     */
    seasonParticipation: { season: FIRST_ACADEMY_SEASON, appearances: 0, starts: 0 },
    seasonOpening: null,
    lastSeasonRecord: null,
    lastSeasonDeltas: [],
    lastEventResult: null,
    lastAchievements: [],
    lastProgression: null,

    retired: false,
    retirementAge: null,
    legend: null,

    seed,
    rngState: rng.getState(),
  };

  career.peakAbility = career.ability;
  career.role = roleFromValue(career.roleValue);
  career.age = ageAt(dateOfBirth, career.currentSeason, 'preseason');
  career.startAge = career.age;

  // Every career passes through Maccabi's door - it just does not always open.
  const originated = resolveOrigin(career, rng);

  /*
   * People are built AFTER the origin resolves (v0.5) - origin can place a rejected boy at an
   * external youth club by writing `currentClubId` directly, and building people first would
   * hand him Maccabi's age-group coach at a club Maccabi turned him away from. Done here rather
   * than in `hydrateCareer` for the same reason as the participation ledger above: hydration
   * stays a pure migration for old saves.
   */
  return migratePeople(originated);
}

/**
 * Turns a club's season into things the career will remember (v0.4).
 *
 * Only the beats worth referencing later - a promotion won, a relegation suffered, a title
 * lifted somewhere other than Haifa. A mid-table finish is not a memory.
 */
function recordWorldMemories(career: Career, result: ClubSeasonResult): Career {
  const contributed = result.playerImpact >= WORLD.contributionThreshold;
  let next = career;

  const remember = (kind: MemoryKind): void => {
    next = { ...next, memories: recordMemory(next, kind) };
  };

  if (result.outcome === 'promoted') {
    remember('won_promotion');
    next = addMilestone(next, {
      id: `promotion_${result.season}`,
      icon: '⬆️',
      text: `עלית לליגה הבכירה עם ${getClub(result.clubId).name}`,
      major: true,
    });
  }

  if (result.outcome === 'relegated') {
    remember('suffered_relegation');
    next = addMilestone(next, {
      id: `relegation_${result.season}`,
      icon: '⬇️',
      text: `ירדת ליגה עם ${getClub(result.clubId).name}`,
      major: true,
    });
  }

  if (result.outcome === 'relegation_battle' && contributed) {
    remember('survived_relegation_battle');
  }

  // A title anywhere but Maccabi is its own kind of story.
  if (result.outcome === 'champion' && result.clubId !== MACCABI_ID) {
    remember('won_title_outside_maccabi');
    next = addMilestone(next, {
      id: `title_elsewhere_${result.season}`,
      icon: '🏆',
      text: `אלוף עם ${getClub(result.clubId).name}`,
      major: true,
    });
  }

  /*
   * The near misses (v0.4.6).
   *
   * A season spent in a title race that ended without the title, or a promotion push that fell
   * short, is among the most callback-able things a career can carry. The game could not record
   * it before, because the season's shape only existed as an outcome category drawn at the final
   * whistle - there was no "we were in it" to remember.
   */
  if (result.outcome === 'title_challenge') remember('fought_for_title');
  if (result.outcome === 'promotion_challenge') remember('missed_promotion');

  // Carrying a small club to something it had no business achieving.
  if (result.playerImpact >= WORLD.breakoutImpact && isGoodSeason(result.outcome)) {
    const league = leagueOf(next.world, result.clubId);
    if (league.prestige <= WORLD.smallClubPrestige) remember('breakout_at_small_club');
  }

  return next;
}

/**
 * One or two hidden traits. They stay unrevealed until the career shows them, which is far
 * more satisfying than handing the player a character sheet at age nine.
 */
function rollTraits(rng: Rng): CareerTrait[] {
  const first = rng.weighted(TRAIT_DEFS, (t) => t.weight);
  if (!first) return [];

  const traits: CareerTrait[] = [{ id: first.id, revealed: false, revealedSeason: null }];
  if (rng.chance(TRAITS.secondTraitChance)) {
    const second = rng.weighted(
      TRAIT_DEFS.filter((t) => t.id !== first.id && !conflictsWith(first.id, t.id)),
      (t) => t.weight,
    );
    if (second) traits.push({ id: second.id, revealed: false, revealedSeason: null });
  }
  return traits;
}

/** Some pairs would read as nonsense together. */
function conflictsWith(a: TraitId, b: TraitId): boolean {
  const pairs: ReadonlyArray<readonly [TraitId, TraitId]> = [
    ['professional', 'hot_headed'],
    ['self_believer', 'late_bloomer'],
  ];
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/* ------------------------------------------------------------------ */
/* Season flow                                                         */
/* ------------------------------------------------------------------ */

function snapshotOpening(career: Career): Career {
  const next = cloneCareer(career);
  next.seasonOpening = {
    ability: career.ability,
    coachTrust: career.coachTrust,
    maccabism: career.maccabism,
    reputation: career.reputation,
    roleValue: career.roleValue,
  };
  return next;
}

function loadSlotEvents(career: Career, slot: SeasonSlot): Career {
  const next = cloneCareer(career);
  next.seasonSlot = slot;
  /*
   * The hard participation gate (v0.4.8, Phase 3.3).
   *
   * Planning happens at preseason on a noise-free projection, because nothing has been played yet.
   * By the time a mid- or late-slot event is *delivered* the first half is a fact, so an event
   * that puts the player on the pitch is dropped here if it turns out he is not on it. This is
   * what makes "zero appearances means zero on-field moments" true rather than intended.
   */
  next.pendingEventIds = next.plannedEvents
    .filter((p) => p.slot === slot)
    .filter((p) => {
      const event = EVENTS_BY_ID[p.eventId];
      if (event?.conditions?.requiresAppearance !== true) return true;
      return mayDeliverOnField(next);
    })
    .map((p) => p.eventId);
  next.plannedEvents = next.plannedEvents.filter((p) => p.slot !== slot);
  return next;
}

function seasonDeltas(career: Career): AttributeDelta[] {
  const open = career.seasonOpening;
  if (!open) return [];
  const rows: AttributeDelta[] = [
    { key: 'ability', label: 'יכולת', from: Math.round(open.ability), to: Math.round(career.ability) },
    {
      key: 'coachTrust',
      label: 'אמון המאמן',
      from: Math.round(open.coachTrust),
      to: Math.round(career.coachTrust),
    },
    {
      key: 'maccabism',
      label: 'מכביסטיות',
      from: Math.round(open.maccabism),
      to: Math.round(career.maccabism),
    },
    {
      key: 'reputation',
      label: 'מוניטין',
      from: Math.round(open.reputation),
      to: Math.round(career.reputation),
    },
  ];
  return rows.filter((row) => row.from !== row.to);
}

/**
 * The single driver that walks a season forward from wherever it currently is.
 * Every UI "continue" ends up here.
 */
function advanceSeasonFlow(career: Career): Career {
  return withRng(career, (rng) => {
    let next = cloneCareer(career);

    // An event is waiting in the current slot - hand it to the player.
    if (next.pendingEventIds.length > 0) {
      next.phase = 'event';
      return next;
    }

    if (next.seasonSlot === 'early') {
      next = playFirstHalf(next, rng);
      // The calendar has reached January - a winter birthday lands here.
      next.seasonPoint = 'midseason';
      next.age = ageAt(next.dateOfBirth, next.currentSeason, 'midseason');
      next = loadSlotEvents(next, 'mid');
      if (stageConfig(next.academyStage).showMidSeason) {
        next.phase = 'mid_season';
        return next;
      }
      if (next.pendingEventIds.length > 0) {
        next.phase = 'event';
        return next;
      }
      // fall through to the second half
    }

    if (next.seasonSlot === 'mid') {
      const played = playSecondHalf(next, rng);
      next = loadSlotEvents(played.career, 'late');
      if (next.pendingEventIds.length > 0) {
        next.phase = 'event';
        return next;
      }
    }

    // Season is done - May/June, so a spring birthday lands here.
    next = cloneCareer(next);
    next.seasonPoint = 'season_end';
    next.age = ageAt(next.dateOfBirth, next.currentSeason, 'season_end');

    /*
     * The world has a season too (v0.4). Only for senior football - youth results are the age
     * group's, not a club's league campaign - and it runs after the player's season so his
     * contribution can shape the outcome.
     */
    if (!isInAcademy(next)) {
      /*
       * v0.4.6: the outcome is no longer drawn here.
       *
       * It was decided at preseason by `projectSeason`, because `planSeason` picks every event
       * for the year at preseason too - and an outcome drawn after the events were chosen is
       * exactly how a club that finished eleventh ended up with a late title-decider. What
       * happens now is that the player's *actual* season settles his club's final position
       * within the band the projection already committed to, and the recorded result is read off
       * that position. Table and outcome cannot disagree, because one is derived from the other.
       */
      next.world = settleWorldProjection(next, rng);
      const clubResult = clubResultFromProjection(next, rng);
      next.world = recordClubSeason(next, clubResult);
      next = recordWorldMemories(next, clubResult);

      /*
       * Maccabi has a season whether he is there or not (v0.4.1).
       *
       * Without this the club stopped existing the moment he left, which undercuts the whole
       * premise - Maccabi is meant to be the fixed star he navigates by, not a place he happens
       * to be standing in. No-ops when he is actually there, since his own club season already
       * covered it.
       */
      next.world = recordMaccabiSeason(next, rng);
    }

    next.lastSeasonDeltas = seasonDeltas(next);
    next.phase = 'season_result';
    return next;
  });
}

/** Preseason -> partial recovery, then plan the season's decision points and start it. */
export function beginSeason(career: Career): Career {
  const prepared = withRng(career, (rng) => {
    /*
     * Recovery happens before the snapshot, so the season summary shows movement from where
     * the player actually starts the year. Trust drifts part of the way back towards what his
     * ability deserves, and the club occasionally changes coach - which is the main way a
     * player buried by one bad relationship gets a fresh look.
     */
    let next = driftTrustTowardsBaseline(career, RECOVERY.seasonDriftToBaseline);
    const coach = maybeChangeCoach(next, rng);
    next = coach.career;
    /*
     * v0.5: the coach change is now a person change. The outgoing manager's relationship is
     * closed with its trust snapshot, a successor with a different archetype takes over, and
     * both moments are remembered with the person attached - which is what lets an event years
     * later say who left, by name, and be right.
     */
    if (coach.changed) {
      const leaving = next.people?.manager?.person;
      next = replaceManager(next, rng);
      if (leaving) {
        next = cloneCareer(next);
        next.memories = recordMemory(next, 'manager_left', leaving.name, leaving.id);
        const incoming = next.people?.manager?.person;
        if (incoming) {
          next.memories = recordMemory(next, 'new_manager_page', incoming.name, incoming.id);
        }
      }
    }
    next = advancePeopleSeason(next);

    next = snapshotOpening(next);
    next.newCoachThisSeason = coach.changed;
    /*
     * The world's season is decided before the player's is planned (v0.4.6). Order matters
     * here and nowhere else: `planSeason` gates events on `leagueContext`, which reads the
     * projection, so projecting afterwards would leave every world-state condition looking at
     * last season's table.
     */
    next.world = openWorldSeason(next, rng);
    next.plannedEvents = planSeason(next, rng);
    next.lastEventResult = null;
    next.lastAchievements = [];
    next.lastProgression = null;
    next.firstHalfStats = null;
    /*
     * A fresh participation ledger (v0.4.8). Nothing has been played, so on-field events for the
     * early slot are judged on the noise-free projection rather than on last season's football.
     */
    next.seasonParticipation = openParticipation(next.currentSeason);
    next = loadSlotEvents(next, 'early');
    return next;
  });
  return advanceSeasonFlow(prepared);
}

/** Applies a decision. The career stays in the `event` phase so the outcome can be shown. */
export function answerEvent(career: Career, eventId: string, choiceId: string): Career {
  return withRng(career, (rng) => {
    const { career: next } = resolveEventChoice(career, eventId, choiceId, rng, career.seasonSlot);
    return next;
  });
}

/** After the outcome card: next event in this slot, or on with the season. */
export function continueAfterEvent(career: Career): Career {
  const cleared = cloneCareer(career);
  cleared.lastEventResult = null;
  cleared.lastAchievements = [];
  return advanceSeasonFlow(cleared);
}

/** After the mid-season card. */
export function continueAfterMidSeason(career: Career): Career {
  return advanceSeasonFlow(career);
}

/* ------------------------------------------------------------------ */
/* End of season                                                       */
/* ------------------------------------------------------------------ */

/** Season summary -> academy promotion, the נוער verdict, or the senior transfer window. */
export function continueAfterSeason(career: Career): Career {
  const rating = career.lastSeasonRecord?.stats.rating ?? 55;

  const resolved = withRng(career, (rng) => {
    let next = endOfSeasonReset(career);
    next.lastAchievements = [];

    /* ---------- the big one: leaving נוער ---------- */
    if (next.academyStage === 'u19' && next.age >= 17) {
      const verdict = evaluateSeniorTransition(next, rng);
      next = cloneCareer(next);
      next.lastProgression = verdictToProgression(next, verdict);
      next.pendingOffers = seniorTransitionOffers(next, verdict, rng);
      if (verdict.path === 'another_year') {
        next = stayAnotherYouthYear(next);
        next.lastProgression = verdictToProgression(career, verdict);
      }
      next.phase = 'youth_to_senior';
      return next;
    }

    /* ---------- academy ladder ---------- */
    if (isInAcademy(next)) {
      const promoted = resolveAcademyProgression(next, rating, rng);
      next = cloneCareer(promoted.career);
      next.lastProgression = promoted.result;
      const checked = checkAchievements(next);
      next = checked.career;
      next.lastAchievements = checked.unlocked;
      next.phase = 'progression';
      return next;
    }

    /* ---------- senior transfer window ---------- */
    next = maybeAwardCaptaincy(next, rng);
    next.pendingOffers = generateOffers(next, rng);
    next.phase = next.pendingOffers.length > 0 ? 'offseason' : 'preseason';
    return next;
  });

  // Quiet summer for a senior player - roll straight into the next season.
  return resolved.phase === 'preseason' ? advanceYear(resolved) : resolved;
}

/** After the origin reveal - the first season can begin. */
export function continueAfterOrigin(career: Career): Career {
  const next = cloneCareer(career);
  next.phase = 'preseason';
  return next;
}

/** After a repeat trial, accepted or not. */
export function continueAfterRetrial(career: Career): Career {
  return advanceYear(career);
}

/**
 * After the promotion card.
 *
 * This is where Maccabi may come back for a player they turned down - the road back only
 * exists if something checks for it, and the end of an academy season is when scouts decide.
 */
export function continueAfterProgression(career: Career): Career {
  const withRetrial = withRng(career, (rng) => {
    if (!eligibleForRetrial(career)) return career;
    if (!rng.chance(ORIGIN.retrialInviteChance)) return career;
    const outcome = resolveRetrial(career, rng);
    const next = cloneCareer(outcome.career);
    next.phase = 'retrial';
    return next;
  });

  // A trial result is a screen of its own; otherwise roll straight into the next season.
  return withRetrial.phase === 'retrial' ? withRetrial : advanceYear(withRetrial);
}

/** The player picks one of the paths offered by the נוער verdict. */
export function resolveYouthTransition(career: Career, offerId: string | null): Career {
  if (offerId === null) {
    // "Another year in נוער" - nothing to sign.
    return advanceYear(career);
  }
  return chooseOffer(career, offerId);
}

export function chooseOffer(career: Career, offerId: string): Career {
  const moved = withRng(career, (rng) => acceptTransferOffer(career, offerId, rng));
  return advanceYear(moved);
}

export function rejectOffers(career: Career): Career {
  const stayed = withRng(career, (rng) => declineAllOffers(career, rng));
  return advanceYear(stayed);
}

/* ------------------------------------------------------------------ */
/* Year rollover + retirement                                          */
/* ------------------------------------------------------------------ */

/**
 * The armband.
 *
 * Used to fall out of role value alone, which meant it happened to roughly every successful
 * Maccabi player. It now needs standing in the dressing room (hidden leadership) as well as
 * quality on the pitch, plus years served and a coach who rates you - and even then someone
 * else makes the call.
 */
function maybeAwardCaptaincy(career: Career, rng: Rng): Career {
  if (career.captain) return career;
  if (!isAtMaccabiSenior(career)) return career;
  if (career.flags.includes('refused_captaincy')) return career;

  const c = CAPTAINCY;
  if (career.roleValue < c.minRoleValue) return career;
  if (career.hidden.leadership < c.minLeadership) return career;
  if (career.maccabi.seasons < c.minMaccabiSeasons) return career;
  if (career.age < c.minAge) return career;
  if (career.coachTrust < c.minCoachTrust) return career;

  const chance = c.chance + (hasTrait(career, 'leader') ? c.leaderTraitBonus : 0);
  if (!rng.chance(chance)) return career;

  let next = cloneCareer(career);
  next.captain = true;
  next = addMilestone(next, {
    id: 'became_captain',
    icon: '👑',
    text: 'מונית לקפטן של מכבי חיפה',
    major: true,
  });
  return next;
}

/** The window a position's careers run in. Goalkeepers get a later one on both ends. */
export function retirementWindow(career: Career): { pressureFrom: number; forced: number } {
  return career.position === 'GK' ? RETIREMENT.goalkeeper : RETIREMENT.outfield;
}

export function forcedRetirementAge(career: Career): number {
  return retirementWindow(career).forced;
}

/**
 * How much the career is pulling towards the end, 0-1 (v0.4.1).
 *
 * Read from context rather than from age alone. Age opens the window; what closes the career is
 * losing ability, losing minutes, or losing your place - which is why a keeper who stops playing
 * at 34 retires at 34 while one who is still first choice can go on.
 */
export function retirementChance(career: Career): number {
  const window = retirementWindow(career);
  const r = RETIREMENT;

  /*
   * A career can end before its position's window opens (v0.4.1).
   *
   * Without this a goalkeeper whose level had collapsed at 31 simply had no exit - the window
   * does not open until 34, so the model offered him nothing and the career limped on. A player
   * who has lost a lot of what he had and is no longer playing is finished whatever his age.
   */
  const finishedEarly =
    career.peakAbility - career.ability >= r.collapseDrop &&
    (career.lastSeasonRecord?.stats.appearances ?? 0) < r.lowMinutesThreshold;

  const opensAt = finishedEarly ? Math.min(window.pressureFrom, r.earlyExitFrom) : window.pressureFrom;
  if (career.age < opensAt) return 0;

  let chance = (career.age - opensAt + 1) * r.perYear;
  chance += Math.max(0, career.peakAbility - career.ability) * r.declineWeight;

  const lastApps = career.lastSeasonRecord?.stats.appearances ?? 0;
  if (lastApps < r.lowMinutesThreshold) chance += r.lowMinutesPressure;
  if (career.roleValue < r.benchRoleValue) chance += r.benchPressure;
  if (career.flags.includes('retirement_considered')) chance += r.consideredPressure;

  // Still doing it at a high level, still playing every week: there is no reason to stop.
  if (career.ability >= r.eliteAbility && lastApps >= r.eliteAppearances) {
    chance *= 1 - r.eliteRelief;
  }

  return clamp(chance, 0, 0.97) as number;
}

/** Ages the player a year, applies automatic moves and decides whether the end is near. */
export function advanceYear(career: Career): Career {
  const aged = withRng(career, (rng) => {
    let next = cloneCareer(career);
    next.currentSeason += 1;
    next.seasonPoint = 'preseason';
    // Age is derived from the date of birth, never incremented - that is what lets two players
    // in the same cohort be a year apart in displayed age while sharing an age group.
    next.age = ageAt(next.dateOfBirth, next.currentSeason, 'preseason');
    next.seasonSlot = 'early';
    next.pendingEventIds = [];
    next.plannedEvents = [];
    next.pendingOffers = [];
    next.firstHalfStats = null;
    next = applyAutomaticMoves(next);

    const checked = checkAchievements(next);
    next = checked.career;
    next.lastAchievements = checked.unlocked;

    if (next.age >= forcedRetirementAge(next)) {
      next.phase = 'retirement_decision';
      return next;
    }
    next.phase = rng.chance(retirementChance(next)) ? 'retirement_decision' : 'preseason';
    return next;
  });

  return aged.age >= forcedRetirementAge(aged) ? retire(aged) : aged;
}

export type RetirementDecision = 'continue' | 'retire';

export function decideRetirement(career: Career, decision: RetirementDecision): Career {
  if (decision === 'retire') return retire(career);
  return withRng(career, (rng) => {
    const next = cloneCareer(
      /*
       * v0.4.8: the `maccabism: 2` that used to be here is gone. Deciding to play one more season
       * is a decision about your own body and your own hunger; it is not a statement about
       * Maccabi, and it fired wherever the player happened to be.
       */
      applyEffects(career, { form: 4, injuryRisk: 6, confidence: 3 }, rng).career,
    );
    next.phase = 'preseason';
    return next;
  });
}

export function retire(career: Career): Career {
  // Anything the career never got round to showing is named now, as part of the closing story.
  const next = cloneCareer(revealRemainingTraits(career));
  next.retired = true;
  next.retirementAge = next.age;
  next.phase = 'retired';
  next.pendingEventIds = [];
  next.plannedEvents = [];
  next.pendingOffers = [];
  next.legend = computeLegendScore(next);
  next.ability = round(next.ability, 1);
  return next;
}

/* ------------------------------------------------------------------ */
/* Convenience                                                         */
/* ------------------------------------------------------------------ */

export function clubOf(career: Career) {
  return getClub(career.currentClubId);
}

/**
 * One "click" of the game loop, choosing at random whenever a decision is required.
 * Used by the debug panel; the headless simulator has its own policy-driven version.
 */
export function autoStep(career: Career): Career {
  const rng = createRng((career.rngState ^ 0x9e3779b9) >>> 0);
  switch (career.phase) {
    case 'origin':
      return continueAfterOrigin(career);
    case 'retrial':
      return continueAfterRetrial(career);
    case 'preseason':
      return beginSeason(career);
    case 'event': {
      if (career.lastEventResult) return continueAfterEvent(career);
      const eventId = career.pendingEventIds[0];
      const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
      if (!event || !eventId) return continueAfterEvent(career);
      return answerEvent(career, eventId, rng.pick(event.choices).id);
    }
    case 'mid_season':
      return continueAfterMidSeason(career);
    case 'season_result':
      return continueAfterSeason(career);
    case 'progression':
      return continueAfterProgression(career);
    case 'youth_to_senior': {
      const offer = career.pendingOffers[0];
      return resolveYouthTransition(career, offer ? offer.id : null);
    }
    case 'offseason': {
      const mandatory = career.pendingOffers.find((o) => o.mandatory);
      if (mandatory) return chooseOffer(career, mandatory.id);
      if (career.pendingOffers.length > 0 && rng.chance(0.5)) {
        return chooseOffer(career, rng.pick(career.pendingOffers).id);
      }
      return rejectOffers(career);
    }
    case 'retirement_decision':
      return decideRetirement(career, rng.chance(0.5) ? 'continue' : 'retire');
    default:
      return career;
  }
}

/**
 * Headless career simulation.
 *
 * The UI is not involved at any point here, which is the whole reason the engine is
 * separated from React: `simulateCareer()` can be run tens of thousands of times to check
 * that the academy, the probabilities and the Legend Score are producing sane distributions.
 */

import { stageOrder } from '../data/academy';
import { getClub, MACCABI_ID } from '../data/clubs';
import { EVENTS_BY_ID } from '../data/events';
import type { Career, ChoiceRisk, EventChoice, GameEvent, Position, TransferOffer } from '../types';
import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterMidSeason,
  continueAfterOrigin,
  continueAfterProgression,
  continueAfterRetrial,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  resolveYouthTransition,
  type NewCareerInput,
  type RetirementDecision,
  retirementChance,
} from './careerEngine';
import { naturalStageFor } from './cohort';
import { RETIREMENT } from './balance';
import { maccabiRelationship } from './maccabiEngine';
import { hasMemory } from './memory';
import { leagueOf } from './worldEngine';
import { MACCABI_EVENTS } from '../data/events/maccabiEvents';
import { WORLD_EVENTS } from '../data/events/worldEvents';
import type { MemoryKind } from '../types';

/** Event ids for the two v0.4 families, so the metrics never drift from the data. */
const MACCABI_EVENT_IDS: ReadonlySet<string> = new Set(MACCABI_EVENTS.map((e) => e.id));
const WORLD_EVENT_IDS: ReadonlySet<string> = new Set(WORLD_EVENTS.map((e) => e.id));

/** The v0.4 memories that say what shape a career had. */
const WORLD_MEMORY_KINDS: readonly MemoryKind[] = [
  'won_promotion',
  'suffered_relegation',
  'won_title_outside_maccabi',
  'first_move_abroad',
  'returned_to_israel',
  'failed_abroad',
  'moved_up_a_level',
  'moved_down_a_level',
  'rebuilt_career',
  'breakout_at_small_club',
];
import { createRng, type Rng } from './random';

export interface CareerPolicy {
  pickChoice(event: GameEvent, career: Career, rng: Rng): string;
  pickOffer(offers: TransferOffer[], career: Career, rng: Rng): string | null;
  pickRetirement(career: Career, rng: Rng): RetirementDecision;
}

/** Decides at random. The baseline for "what does an average career look like". */
/**
 * When a simulated persona decides it is over (v0.4.1).
 *
 * Reads the engine's own retirement pressure rather than a hard-coded age. The old policies said
 * things like "retire at 36", which meant every position in every simulation retired at 36-38 with
 * no spread at all - the longevity model was there and never got to speak. A human player decides
 * for himself; these thresholds just make the personas differ in how stubborn they are.
 */
function callsItADay(career: Career, threshold: number): RetirementDecision {
  return retirementChance(career) >= threshold ? 'retire' : 'continue';
}

export const randomPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => rng.pick(event.choices).id,
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    if (offers.length === 0) return null;
    return rng.chance(0.5) ? rng.pick(offers).id : null;
  },
  pickRetirement: (_career, rng) => (rng.chance(0.55) ? 'continue' : 'retire'),
};

/**
 * The "go for it" player: takes every opportunity, and gambles when he is in shape to carry
 * the downside. Deliberately not the same as riskTakerPolicy - a player who picks the
 * riskiest option forty times in a row regardless of his situation is not ambitious, he is
 * a stress test, and that is what riskTakerPolicy is for.
 */
export const ambitiousPolicy: CareerPolicy = {
  pickChoice: (event, career, rng) => {
    const chances = event.choices.filter((c) => c.risk === 'opportunity');
    if (chances.length > 0) return rng.pick(chances).id;

    // Gamble only when form and confidence can absorb a bad outcome.
    const canAbsorb = career.hidden.confidence >= 50 && career.hidden.form >= 48;
    const risky = event.choices.filter((c) => c.risk === 'risky');
    if (risky.length > 0 && canAbsorb) return rng.pick(risky).id;

    const steady = event.choices.filter((c) => c.risk === 'balanced' || c.risk === 'safe');
    return steady.length > 0 ? rng.pick(steady).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    return offers.length > 0 ? rng.pick(offers).id : null;
  },
  pickRetirement: (career) => callsItADay(career, RETIREMENT.policyThreshold.ambitious),
};

/**
 * Reads the situation instead of always reaching for the same lever: pushes when things are
 * going well, protects itself when form or confidence has gone, and takes the chances that
 * a young player should take. The closest thing to "how a thoughtful player actually plays".
 */
export const balancedPolicy: CareerPolicy = {
  pickChoice: (event, career, rng) => {
    const byRisk = (risk: ChoiceRisk): EventChoice[] => event.choices.filter((c) => c.risk === risk);
    const struggling = career.hidden.confidence < 42 || career.hidden.form < 42;
    const developing = career.age <= 17;

    // In a bad spell, steady the ship rather than gamble on top of a gamble.
    const preferred = struggling
      ? [...byRisk('safe'), ...byRisk('balanced')]
      : developing
        ? [...byRisk('opportunity'), ...byRisk('balanced')]
        : [...byRisk('balanced'), ...byRisk('opportunity'), ...byRisk('safe')];

    const pool = preferred.length > 0 ? preferred : event.choices;
    return rng.pick(pool).id;
  },
  pickOffer: (offers, career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;

    // Signing for the first team, or coming home, is never turned down.
    const home = offers.find((o) => o.kind === 'promotion' || o.kind === 'return_home');
    if (home) return home.id;

    // Not playing? Go and play somewhere.
    const starved = (career.lastSeasonRecord?.stats.appearances ?? 0) < 10;
    const loan = offers.find((o) => o.kind === 'loan');
    if (loan && starved) return loan.id;

    // A move abroad is worth it once established, and more tempting at the right age.
    const transfer = offers.find((o) => o.kind === 'transfer');
    if (transfer && career.age >= 21 && career.roleValue >= 55 && rng.chance(0.55)) {
      return transfer.id;
    }
    return null;
  },
  pickRetirement: (career) => callsItADay(career, RETIREMENT.policyThreshold.balanced),
};

/**
 * The extreme baseline: always reaches for the biggest upside no matter the situation, and
 * eats every downside. Not a model of a real player - it exists to show where the tail of
 * the distribution actually is, and to catch the case where bold play is a trap.
 */
export const riskTakerPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    const risky = event.choices.filter((c) => c.risk === 'risky');
    if (risky.length > 0) return rng.pick(risky).id;
    const bold = event.choices.filter((c) => c.risk === 'opportunity');
    return bold.length > 0 ? rng.pick(bold).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    // Chase the move: abroad first, then anything at all.
    const abroad = offers.find((o) => o.kind === 'transfer' && o.country !== 'ישראל');
    if (abroad) return abroad.id;
    return offers.length > 0 ? rng.pick(offers).id : null;
  },
  pickRetirement: (career) => callsItADay(career, RETIREMENT.policyThreshold.riskTaker),
};

/** A one-club man: takes the safe road and never leaves willingly. */
export const loyalPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    const safe = event.choices.filter((c) => c.risk === 'safe' || c.risk === 'balanced');
    return safe.length > 0 ? rng.pick(safe).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    const home = offers.find((o) => o.kind === 'return_home' || o.kind === 'promotion');
    return home?.id ?? null;
  },
  pickRetirement: (career) => callsItADay(career, RETIREMENT.policyThreshold.loyal),
};

export interface SimulateOptions extends NewCareerInput {
  policy?: CareerPolicy;
  /** Safety valve so a bug can never hang a batch run. */
  maxSteps?: number;
}

export function simulateCareer(options: SimulateOptions): Career {
  const { policy = randomPolicy, maxSteps = 1200, ...input } = options;
  let career = createCareer(input);
  const rng = createRng((career.seed ^ 0x5bf03635) >>> 0);

  let steps = 0;
  while (!career.retired && steps < maxSteps) {
    steps += 1;
    switch (career.phase) {
      // v0.3.1: how the career began, and any later trial, are screens with no decision.
      case 'origin':
        career = continueAfterOrigin(career);
        break;
      case 'retrial':
        career = continueAfterRetrial(career);
        break;
      case 'preseason':
        career = beginSeason(career);
        break;
      case 'event': {
        if (career.lastEventResult) {
          career = continueAfterEvent(career);
          break;
        }
        const eventId = career.pendingEventIds[0];
        const event = eventId ? EVENTS_BY_ID[eventId] : undefined;
        if (!event || !eventId) {
          career = continueAfterEvent(career);
          break;
        }
        career = answerEvent(career, eventId, policy.pickChoice(event, career, rng));
        break;
      }
      case 'mid_season':
        career = continueAfterMidSeason(career);
        break;
      case 'season_result':
        career = continueAfterSeason(career);
        break;
      case 'progression':
        career = continueAfterProgression(career);
        break;
      case 'youth_to_senior': {
        const pick = policy.pickOffer(career.pendingOffers, career, rng);
        career = resolveYouthTransition(career, pick ?? career.pendingOffers[0]?.id ?? null);
        break;
      }
      case 'offseason': {
        const pick = policy.pickOffer(career.pendingOffers, career, rng);
        career = pick ? chooseOffer(career, pick) : rejectOffers(career);
        break;
      }
      case 'retirement_decision':
        career = decideRetirement(career, policy.pickRetirement(career, rng));
        break;
      default:
        break;
    }
  }

  return career;
}

/* ------------------------------------------------------------------ */
/* Batch analysis                                                      */
/* ------------------------------------------------------------------ */

/** The Legend Score buckets used to check that a high score still feels special. */
export const LEGEND_BUCKETS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: '0-39', min: 0, max: 39 },
  { label: '40-59', min: 40, max: 59 },
  { label: '60-74', min: 60, max: 74 },
  { label: '75-84', min: 75, max: 84 },
  { label: '85-89', min: 85, max: 89 },
  { label: '90-94', min: 90, max: 94 },
  { label: '95+', min: 95, max: 100 },
];

/**
 * v0.3.1: how careers begin, and what happens to the ones Maccabi turned away.
 *
 * `invalidNaturalStageRepeats` is the acceptance criterion for the whole version and must be
 * zero: a player registered with his own birth cohort cannot repeat that age group.
 */
export interface OriginMetrics {
  scoutedDirectly: number;
  trialAccepted: number;
  trialRejected: number;
  /** Of those rejected at nine: what became of them. */
  rejectedLaterInvited: number;
  rejectedLaterJoinedMaccabi: number;
  rejectedNeverJoinedMaccabi: number;
  rejectedReachedSeniorFootball: number;
  rejectedPlayedForMaccabiSeniors: number;
  rejectedPlayedAbroad: number;
  /** MUST be 0 - see the no-repeat rule in progressionEngine. */
  invalidNaturalStageRepeats: number;
  /** Also must be 0: nobody may be registered below his own cohort. */
  registeredBehindCohort: number;
  /** The legal case - a player who was ahead, whose year caught up. */
  cohortCaughtUp: number;
  fullEarlyPromotions: number;
}

export interface AcademyMetrics {
  /** Share of ladder transitions that were a normal one-step promotion. */
  normalPromotionShare: number;
  /** Share that skipped a level. */
  earlyPromotionShare: number;
  /** Share that repeated the age group. */
  repeatedYearShare: number;
  /** Average age at which the player left the youth structure. */
  averageAgeLeavingAcademy: number;
  /** Average number of seasons spent in the academy. */
  averageAcademySeasons: number;
}

/**
 * Can a career come back from a bad spell?
 *
 * A "slump" is a season where coach trust fell below the threshold, or the player dropped
 * out of the starting eleven having been in it. Recovery means reaching starter or better
 * within the following few seasons. Neither ~0% (a single bad event ends you) nor ~100%
 * (nothing has consequences) is the game we want.
 */
export interface RecoveryMetrics {
  /** Careers that hit at least one slump. */
  careersWithSlump: number;
  /** Of those slumps, the share that recovered to starter or better in time. */
  recoveryRate: number;
  /** Average seasons taken to come back, over the slumps that did. */
  averageSeasonsToRecover: number;
  /** Slumps observed in total. */
  slumpCount: number;
}

export interface RepetitionMetrics {
  /** Average number of events a career saw more than once. */
  averageRepeatedEvents: number;
  /** Average length of the longest run of the same category back to back. */
  averageLongestCategoryRun: number;
  /** Worst single run of one category seen anywhere in the batch. */
  worstCategoryRun: number;
  /** Share of careers whose whole event sequence is identical to another career's. */
  duplicateSequenceShare: number;
  /** Average events seen per career. */
  averageEventsPerCareer: number;
  /** Distinct events used across the whole batch. */
  distinctEventsUsed: number;
}

export interface BatchResult {
  count: number;
  /** Share of careers that ever pulled on a senior Maccabi shirt. */
  reachedMaccabiSeniors: number;
  /** Share that never got there. */
  failedToReachMaccabiSeniors: number;
  /** Share that were promoted from נוער straight into the first team. */
  academyGraduates: number;
  /** Share that were skipped up an age group at least once. */
  earlyPromotion: number;
  /** Share that ever trained or played with the age group above. */
  playedWithOlderGroup: number;
  /** Share that hit at least 'starter' role in a senior season. */
  reachedStarter: number;
  /** Share that hit at least 'key' role in a senior season. */
  reachedKeyPlayer: number;
  captain: number;
  /** Share not kept by Maccabi at the end of נוער. */
  releasedFromAcademy: number;
  /** Share squeezed out of the first team after having signed for it. */
  releasedFromSeniorTeam: number;
  /** Share that left Maccabi for a club outside Israel. */
  leftForEurope: number;
  /** Share that came back to Maccabi after leaving. */
  returnedToMaccabi: number;
  rareBreakthrough: number;
  averagePeakAbility: number;
  averageLegendScore: number;
  averageMaccabiAppearances: number;
  averageCareerSeasons: number;
  averageRetirementAge: number;
  /** Count of careers per Legend Score bucket. */
  legendDistribution: Record<string, number>;
  endings: Record<string, number>;
  byPosition: Record<string, { count: number; peakAbility: number; legend: number; reachedSeniors: number }>;
  academy: AcademyMetrics;
  origin: OriginMetrics;
  recovery: RecoveryMetrics;
  repetition: RepetitionMetrics;
  /** Legend Score spread - the decisions-vs-luck question needs more than a mean. */
  legendMedian: number;
  legendStdDev: number;
  /** Share carrying at least one career memory / running at least one story arc. */
  withMemories: number;
  withStoryArcs: number;
  averageMilestones: number;
  averageTraitsRevealed: number;

  /** v0.4: does the football world actually happen to the player? */
  world: WorldMetrics;
  /** v0.4: does Maccabi stay in the story of a player who left? */
  maccabiStory: MaccabiStoryMetrics;
}

/** How much of the season-level world a career actually meets. */
export interface WorldMetrics {
  wonPromotion: number;
  sufferedRelegation: number;
  wonTitleOutsideMaccabi: number;
  playedAbroad: number;
  cameBackToIsrael: number;
  failedAbroad: number;
  hadALoanSpell: number;
  movedUp: number;
  movedDown: number;
  rebuiltCareer: number;
  breakoutAtSmallClub: number;
  /** Distinct senior clubs, and seasons spent outside a top flight. */
  averageSeniorClubs: number;
  averageSecondDivisionSeasons: number;
  /** Share seeing at least one club-season event. */
  sawAWorldEvent: number;
}

/** Whether the product invariant holds: the player may leave, Maccabi never leaves the story. */
export interface MaccabiStoryMetrics {
  /** Distribution of the derived relationship at the end of the career. */
  relationships: Record<string, number>;
  /** Share who left and still met Maccabi in an event afterwards. */
  metMaccabiAfterLeaving: number;
  /** ...as a share of those who left at all - the number the invariant is really about. */
  metMaccabiGivenLeft: number;
  facedThemInAMatch: number;
  scoredAgainstThem: number;
  refusedToCelebrate: number;
  offeredAHomecoming: number;
  cameHome: number;
  /** Homecoming archetype mix, as a share of careers that came home. */
  homecomingKinds: Record<string, number>;
}

/** Every event flagged `rare` in the data - no hand-maintained list to drift out of date. */
const RARE_EVENT_IDS: ReadonlySet<string> = new Set(
  Object.values(EVENTS_BY_ID)
    .filter((event) => event.rarity === 'rare')
    .map((event) => event.id),
);

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

const RECOVERY_ROLES = ['starter', 'key', 'star', 'icon'];

/**
 * Finds every slump in a career and reports whether it was recovered from within
 * `window` seasons.
 */
export function findRecoveries(
  career: Career,
  trustFloor = 35,
  window = 3,
): { slumps: number; recovered: number; seasonsToRecover: number[] } {
  /*
   * Senior seasons only, and not the closing two.
   *
   * Academy seasons are the wrong place to look: being a squad player at eleven is normal,
   * and the ladder knocks role value down at every promotion by design, so scanning them
   * reported that 99% of careers "slumped" and made the metric meaningless. A 35 year old
   * losing his place is likewise the career ending rather than a slump to recover from.
   */
  const senior = career.seasonHistory.filter((s) => s.academyStage === 'senior');
  const history = senior.slice(0, Math.max(0, senior.length - 2));
  let slumps = 0;
  let recovered = 0;
  const seasonsToRecover: number[] = [];
  let inSlump = false;

  for (let i = 0; i < history.length; i += 1) {
    const season = history[i];
    if (!season) continue;

    const wasStarter = RECOVERY_ROLES.includes(season.role);
    const previous = history[i - 1];
    const droppedOut = previous !== undefined && RECOVERY_ROLES.includes(previous.role) && !wasStarter;
    const lowTrust = season.coachTrust < trustFloor;

    if (!inSlump && (lowTrust || droppedOut)) {
      inSlump = true;
      slumps += 1;
      // Did he get back into the side within the window?
      for (let j = i + 1; j <= i + window && j < history.length; j += 1) {
        const later = history[j];
        if (!later) continue;
        if (RECOVERY_ROLES.includes(later.role) && later.coachTrust >= trustFloor) {
          recovered += 1;
          seasonsToRecover.push(j - i);
          break;
        }
      }
    } else if (inSlump && wasStarter && !lowTrust) {
      // Out of the hole - a later relapse counts as a new slump.
      inSlump = false;
    }
  }

  return { slumps, recovered, seasonsToRecover };
}

function longestCategoryRun(career: Career): number {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const entry of career.eventsHistory) {
    run = entry.category === previous ? run + 1 : 1;
    previous = entry.category;
    longest = Math.max(longest, run);
  }
  return longest;
}

function repeatedEventCount(career: Career): number {
  const seen = new Map<string, number>();
  for (const entry of career.eventsHistory) {
    seen.set(entry.eventId, (seen.get(entry.eventId) ?? 0) + 1);
  }
  let repeated = 0;
  for (const times of seen.values()) if (times > 1) repeated += 1;
  return repeated;
}

/* ------------------------------------------------------------------ */
/* Matched-seed comparison                                             */
/* ------------------------------------------------------------------ */

export interface PairedResult {
  /** Mean Legend Score per strategy, over the same set of seeds. */
  meanByStrategy: Record<string, number>;
  medianByStrategy: Record<string, number>;
  stdDevByStrategy: Record<string, number>;
  reachedSeniorsByStrategy: Record<string, number>;
  peakAbilityByStrategy: Record<string, number>;
  /**
   * How often each strategy beat the baseline on the *same* seed. This is the number that
   * answers "do decisions matter, or is it just the seed?" - if decisions were irrelevant it
   * would sit at 50%.
   */
  winRateVsBaseline: Record<string, number>;
  /** Mean within-seed Legend Score difference against the baseline. */
  meanDeltaVsBaseline: Record<string, number>;
  /** Spread of outcomes across seeds for one fixed strategy - the luck component. */
  baselineSeedStdDev: number;
  /** Spread of strategy means on a fixed seed, averaged - the decision component. */
  meanWithinSeedSpread: number;
  seeds: number;
  baseline: string;
}

/**
 * Runs every strategy against the same seeds, so decision quality can be separated from
 * luck. Same underlying random stream at career creation; the strategies then diverge
 * precisely because they decide differently.
 */
export function simulatePaired(
  seeds: number,
  policies: Record<string, CareerPolicy>,
  options: Omit<SimulateOptions, 'seed' | 'policy'> & { rotatePositions?: boolean },
  baseline = 'random',
): PairedResult {
  const names = Object.keys(policies);
  const scores: Record<string, number[]> = {};
  const peaks: Record<string, number[]> = {};
  const reached: Record<string, number> = {};
  const wins: Record<string, number> = {};
  const deltas: Record<string, number[]> = {};
  for (const name of names) {
    scores[name] = [];
    peaks[name] = [];
    reached[name] = 0;
    wins[name] = 0;
    deltas[name] = [];
  }

  const { rotatePositions, ...careerOptions } = options;
  const withinSeedSpreads: number[] = [];

  for (let i = 0; i < seeds; i += 1) {
    const seed = batchSeed(i);
    const position = rotatePositions
      ? (POSITION_ROTATION[i % POSITION_ROTATION.length] as Position)
      : careerOptions.position;

    const seedScores: Record<string, number> = {};
    for (const name of names) {
      const policy = policies[name];
      if (!policy) continue;
      const career = simulateCareer({ ...careerOptions, position, seed, policy });
      const score = career.legend?.score ?? 0;
      seedScores[name] = score;
      scores[name]?.push(score);
      peaks[name]?.push(career.peakAbility);
      if (career.maccabi.appearances > 0) reached[name] = (reached[name] ?? 0) + 1;
    }

    const base = seedScores[baseline] ?? 0;
    for (const name of names) {
      const score = seedScores[name] ?? 0;
      if (score > base) wins[name] = (wins[name] ?? 0) + 1;
      deltas[name]?.push(score - base);
    }

    // How far apart the strategies landed on this one seed.
    const values = Object.values(seedScores);
    withinSeedSpreads.push(Math.max(...values) - Math.min(...values));
  }

  const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const build = (fn: (xs: number[]) => number): Record<string, number> =>
    Object.fromEntries(names.map((n) => [n, fn(scores[n] ?? [])]));

  return {
    meanByStrategy: build(mean),
    medianByStrategy: build(median),
    stdDevByStrategy: build(stdDev),
    peakAbilityByStrategy: Object.fromEntries(names.map((n) => [n, mean(peaks[n] ?? [])])),
    reachedSeniorsByStrategy: Object.fromEntries(
      names.map((n) => [n, (reached[n] ?? 0) / seeds]),
    ),
    winRateVsBaseline: Object.fromEntries(names.map((n) => [n, (wins[n] ?? 0) / seeds])),
    meanDeltaVsBaseline: Object.fromEntries(names.map((n) => [n, mean(deltas[n] ?? [])])),
    baselineSeedStdDev: stdDev(scores[baseline] ?? []),
    meanWithinSeedSpread: mean(withinSeedSpreads),
    seeds,
    baseline,
  };
}

/** Deterministic seed for career `i` of a batch, so batches are comparable across policies. */
export function batchSeed(index: number): number {
  return ((index + 1) * 2654435761) >>> 0;
}

/** Fixed rotation so a batch covers every position evenly and reproducibly. */
const POSITION_ROTATION: readonly Position[] = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST'];

export interface BatchOptions extends Omit<SimulateOptions, 'seed'> {
  /** Cycle through every position instead of simulating one, for whole-game metrics. */
  rotatePositions?: boolean;
}

/** Runs many careers and reports aggregates - the starting point for balancing. */
export function simulateBatch(count: number, options: BatchOptions): BatchResult {
  const endings: Record<string, number> = {};
  const byPosition: BatchResult['byPosition'] = {};
  const legendDistribution: Record<string, number> = {};
  for (const bucket of LEGEND_BUCKETS) legendDistribution[bucket.label] = 0;

  let reachedSeniors = 0;
  let graduates = 0;
  let early = 0;
  let olderGroup = 0;
  let starter = 0;
  let keyPlayer = 0;
  let captain = 0;
  let released = 0;
  let releasedFromSenior = 0;
  let europe = 0;
  let returned = 0;
  let rare = 0;
  let peakSum = 0;
  let legendSum = 0;
  let appsSum = 0;
  let seasonsSum = 0;
  let ageSum = 0;

  const legendScores: number[] = [];
  let slumpCareers = 0;
  let slumpTotal = 0;
  let recoveredTotal = 0;
  const recoverySeasons: number[] = [];
  let memoryCareers = 0;
  let arcCareers = 0;
  let milestoneTotal = 0;
  let revealedTotal = 0;

  let originScouted = 0;
  let originAccepted = 0;
  let originRejected = 0;
  let rejInvited = 0;
  let rejJoined = 0;
  let rejSenior = 0;
  let rejMaccabiSeniors = 0;
  let rejAbroad = 0;
  let invalidRepeats = 0;
  let behindCohort = 0;
  let cohortCaughtUpCount = 0;
  let fullEarlyPromotions = 0;

  let ladderNormal = 0;
  let ladderEarly = 0;
  let ladderStayed = 0;
  let academySeasonsSum = 0;
  let ageLeavingSum = 0;
  let ageLeavingCount = 0;

  let repeatedSum = 0;
  let categoryRunSum = 0;
  let worstCategoryRun = 0;
  let eventsSum = 0;
  const distinctEvents = new Set<string>();
  const sequenceCounts = new Map<string, number>();

  /* ---- v0.4: world and Maccabi story ---- */
  const worldCount: Record<string, number> = {};
  const bump = (key: string): void => { worldCount[key] = (worldCount[key] ?? 0) + 1; };
  let seniorClubsSum = 0;
  let secondDivisionSeasonsSum = 0;
  const relationships: Record<string, number> = {};
  const homecomingKinds: Record<string, number> = {};
  let leftMaccabi = 0;
  let metMaccabiAfterLeaving = 0;

  const { rotatePositions, ...careerOptions } = options;

  for (let i = 0; i < count; i += 1) {
    const position = rotatePositions
      ? (POSITION_ROTATION[i % POSITION_ROTATION.length] as Position)
      : careerOptions.position;
    const career = simulateCareer({ ...careerOptions, position, seed: batchSeed(i) });

    if (career.maccabi.appearances > 0) reachedSeniors += 1;
    if (career.maccabi.academyGraduate) graduates += 1;
    if (career.maccabi.earlyPromotions > 0) early += 1;
    /*
     * The released_by_maccabi flag covers two different stories - not being kept at 18, and
     * being squeezed out of the first team at 25 - so they get counted separately. Without
     * this, "released" and "academy graduate" summed to over 100% and neither meant anything.
     */
    if (career.flags.includes('released_by_maccabi')) {
      if (career.maccabi.academyGraduate) releasedFromSenior += 1;
      else released += 1;
    }
    if (career.maccabi.captainSeasons > 0) captain += 1;
    if (career.maccabi.returned) returned += 1;
    if (career.eventsHistory.some((e) => RARE_EVENT_IDS.has(e.eventId))) rare += 1;
    if (career.seasonHistory.some((s) => s.olderGroup !== 'none')) olderGroup += 1;
    // "Europe" here means any season actually played at a club outside Israel.
    if (career.seasonHistory.some((s) => getClub(s.clubId).country !== 'ישראל')) europe += 1;

    /*
     * Scoped to senior Maccabi seasons on purpose. "Became a starter" somewhere in the
     * Israeli lower divisions happens to almost everyone over a 15 season career and says
     * nothing about the fantasy this game is about; holding down a place at Maccabi does.
     */
    const maccabiSeniorSeasons = career.seasonHistory.filter(
      (s) => s.academyStage === 'senior' && s.clubId === MACCABI_ID && !s.onLoan,
    );
    if (maccabiSeniorSeasons.some((s) => ['starter', 'key', 'star', 'icon'].includes(s.role))) starter += 1;
    if (maccabiSeniorSeasons.some((s) => ['key', 'star', 'icon'].includes(s.role))) keyPlayer += 1;

    peakSum += career.peakAbility;
    const score = career.legend?.score ?? 0;
    legendSum += score;
    appsSum += career.maccabi.appearances;
    seasonsSum += career.seasonHistory.length;
    ageSum += career.retirementAge ?? career.age;

    /* ---- v0.4: did the world happen to him, and did Maccabi stay in the story? ---- */
    for (const kind of WORLD_MEMORY_KINDS) if (hasMemory(career, kind)) bump(kind);
    if (career.seasonHistory.some((s2) => s2.onLoan)) bump('loan');

    const seniorSeasons = career.seasonHistory.filter((s2) => s2.academyStage === 'senior');
    seniorClubsSum += new Set(seniorSeasons.map((s2) => s2.clubId)).size;
    secondDivisionSeasonsSum += seniorSeasons.filter(
      (s2) => leagueOf(career.world, s2.clubId).tier >= 2,
    ).length;
    if (career.eventsHistory.some((e) => WORLD_EVENT_IDS.has(e.eventId))) bump('worldEvent');

    const relationship = maccabiRelationship(career);
    relationships[relationship] = (relationships[relationship] ?? 0) + 1;

    /*
     * The product invariant, measured: of the players who left, how many still met Maccabi in
     * their story afterwards? Counted from the ex-Maccabi event family plus the memories those
     * events write, so it reflects what the player actually saw rather than what was possible.
     */
    const everAway =
      career.maccabi.everLeft ||
      career.flags.includes('released_by_maccabi') ||
      (career.maccabi.academyGraduate && career.currentClubId !== MACCABI_ID);
    if (everAway) {
      leftMaccabi += 1;
      if (career.eventsHistory.some((e) => MACCABI_EVENT_IDS.has(e.eventId))) {
        metMaccabiAfterLeaving += 1;
      }
    }
    if (hasMemory(career, 'played_against_maccabi')) bump('facedThem');
    if (hasMemory(career, 'scored_against_maccabi')) bump('scoredAgainst');
    if (hasMemory(career, 'refused_to_celebrate')) bump('refusedToCelebrate');
    if (hasMemory(career, 'booed_at_sami_ofer') || hasMemory(career, 'applauded_at_sami_ofer')) {
      bump('facedThem');
    }
    if (career.maccabi.returned) {
      bump('cameHome');
      // Read the kind stored at the time of the return, not recomputed from the retired player.
      const kind = career.maccabi.returnKind;
      if (kind) homecomingKinds[kind] = (homecomingKinds[kind] ?? 0) + 1;
    }

    const bucket = LEGEND_BUCKETS.find((b) => score >= b.min && score <= b.max);
    if (bucket) legendDistribution[bucket.label] = (legendDistribution[bucket.label] ?? 0) + 1;

    const endingId = career.legend?.ending.title ?? 'none';
    endings[endingId] = (endings[endingId] ?? 0) + 1;

    const pos = byPosition[career.position] ?? {
      count: 0,
      peakAbility: 0,
      legend: 0,
      reachedSeniors: 0,
    };
    pos.count += 1;
    pos.peakAbility += career.peakAbility;
    pos.legend += score;
    if (career.maccabi.appearances > 0) pos.reachedSeniors += 1;
    byPosition[career.position] = pos;

    legendScores.push(score);

    /* ---------------- recovery, memory, arcs ---------------- */
    const rec = findRecoveries(career);
    if (rec.slumps > 0) slumpCareers += 1;
    slumpTotal += rec.slumps;
    recoveredTotal += rec.recovered;
    recoverySeasons.push(...rec.seasonsToRecover);

    if (career.memories.length > 0) memoryCareers += 1;
    if (career.completedArcs.length > 0 || career.arcs.length > 0) arcCareers += 1;
    milestoneTotal += career.milestones.length;
    revealedTotal += career.traits.filter((t) => t.revealed).length;

    /* ---------------- origin, and the road back ---------------- */
    if (career.origin === 'scouted') originScouted += 1;
    else if (career.origin === 'trial_accepted') originAccepted += 1;
    else {
      originRejected += 1;
      if (career.trials.some((t) => t.attempt > 1)) rejInvited += 1;
      if (hasMemory(career, 'joined_maccabi_late')) rejJoined += 1;
      if (career.seasonHistory.some((s) => s.academyStage === 'senior' && s.stats.appearances > 0)) {
        rejSenior += 1;
      }
      if (career.maccabi.appearances > 0) rejMaccabiSeniors += 1;
      if (career.seasonHistory.some((s) => getClub(s.clubId).country !== 'ישראל' && s.stats.appearances > 5)) {
        rejAbroad += 1;
      }
    }

    /* ---------------- cohort invariants ---------------- */
    const academySeasonsForCohort = career.seasonHistory.filter((s) => s.academyStage !== 'senior');
    for (let s = 0; s < academySeasonsForCohort.length - 1; s += 1) {
      const from = academySeasonsForCohort[s];
      const to = academySeasonsForCohort[s + 1];
      if (!from || !to) continue;
      // נוער is the club's youth-to-senior decision, not the academy ladder.
      if (stageOrder(from.academyStage) >= stageOrder('u19')) continue;

      const naturalNow = naturalStageFor(career.birthCohort, from.season);
      const naturalNext = naturalStageFor(career.birthCohort, to.season);
      if (stageOrder(to.academyStage) < stageOrder(naturalNext)) behindCohort += 1;
      if (from.academyStage === to.academyStage) {
        if (stageOrder(from.academyStage) > stageOrder(naturalNow)) cohortCaughtUpCount += 1;
        else invalidRepeats += 1;
      }
      if (stageOrder(to.academyStage) - stageOrder(from.academyStage) >= 2) fullEarlyPromotions += 1;
    }

    /* ---------------- academy ladder ---------------- */
    const academySeasons = career.seasonHistory.filter((s) => s.academyStage !== 'senior');
    academySeasonsSum += academySeasons.length;
    const lastAcademy = academySeasons[academySeasons.length - 1];
    if (lastAcademy) {
      ageLeavingSum += lastAcademy.age + 1;
      ageLeavingCount += 1;
    }
    for (let s = 0; s < academySeasons.length - 1; s += 1) {
      const from = academySeasons[s];
      const to = academySeasons[s + 1];
      if (!from || !to) continue;
      const jump = stageOrder(to.academyStage) - stageOrder(from.academyStage);
      if (jump >= 2) ladderEarly += 1;
      else if (jump === 1) ladderNormal += 1;
      else if (jump === 0) ladderStayed += 1;
    }

    /* ---------------- repetition ---------------- */
    repeatedSum += repeatedEventCount(career);
    const run = longestCategoryRun(career);
    categoryRunSum += run;
    worstCategoryRun = Math.max(worstCategoryRun, run);
    eventsSum += career.eventsHistory.length;
    for (const entry of career.eventsHistory) distinctEvents.add(entry.eventId);
    const signature = career.eventsHistory.map((e) => e.eventId).join('>');
    sequenceCounts.set(signature, (sequenceCounts.get(signature) ?? 0) + 1);
  }

  for (const key of Object.keys(byPosition)) {
    const p = byPosition[key];
    if (!p) continue;
    p.peakAbility = p.peakAbility / p.count;
    p.legend = p.legend / p.count;
    p.reachedSeniors = p.reachedSeniors / p.count;
  }

  let duplicated = 0;
  for (const times of sequenceCounts.values()) if (times > 1) duplicated += times;
  const ladderTransitions = ladderNormal + ladderEarly + ladderStayed;

  const share = (key: string): number => (worldCount[key] ?? 0) / count;

  return {
    count,
    reachedMaccabiSeniors: reachedSeniors / count,
    failedToReachMaccabiSeniors: 1 - reachedSeniors / count,
    academyGraduates: graduates / count,
    earlyPromotion: early / count,
    playedWithOlderGroup: olderGroup / count,
    reachedStarter: starter / count,
    reachedKeyPlayer: keyPlayer / count,
    captain: captain / count,
    releasedFromAcademy: released / count,
    releasedFromSeniorTeam: releasedFromSenior / count,
    leftForEurope: europe / count,
    returnedToMaccabi: returned / count,
    rareBreakthrough: rare / count,
    averagePeakAbility: peakSum / count,
    averageLegendScore: legendSum / count,
    averageMaccabiAppearances: appsSum / count,
    averageCareerSeasons: seasonsSum / count,
    averageRetirementAge: ageSum / count,
    legendDistribution,
    endings,
    byPosition,
    legendMedian: median(legendScores),
    legendStdDev: stdDev(legendScores),
    withMemories: memoryCareers / count,
    withStoryArcs: arcCareers / count,
    averageMilestones: milestoneTotal / count,
    averageTraitsRevealed: revealedTotal / count,
    origin: {
      scoutedDirectly: originScouted / count,
      trialAccepted: originAccepted / count,
      trialRejected: originRejected / count,
      rejectedLaterInvited: originRejected > 0 ? rejInvited / originRejected : 0,
      rejectedLaterJoinedMaccabi: originRejected > 0 ? rejJoined / originRejected : 0,
      rejectedNeverJoinedMaccabi: originRejected > 0 ? 1 - rejJoined / originRejected : 0,
      rejectedReachedSeniorFootball: originRejected > 0 ? rejSenior / originRejected : 0,
      rejectedPlayedForMaccabiSeniors: originRejected > 0 ? rejMaccabiSeniors / originRejected : 0,
      rejectedPlayedAbroad: originRejected > 0 ? rejAbroad / originRejected : 0,
      invalidNaturalStageRepeats: invalidRepeats,
      registeredBehindCohort: behindCohort,
      cohortCaughtUp: cohortCaughtUpCount,
      fullEarlyPromotions,
    },
    recovery: {
      careersWithSlump: slumpCareers / count,
      recoveryRate: slumpTotal > 0 ? recoveredTotal / slumpTotal : 0,
      averageSeasonsToRecover:
        recoverySeasons.length > 0
          ? recoverySeasons.reduce((a, b) => a + b, 0) / recoverySeasons.length
          : 0,
      slumpCount: slumpTotal,
    },
    academy: {
      normalPromotionShare: ladderTransitions > 0 ? ladderNormal / ladderTransitions : 0,
      earlyPromotionShare: ladderTransitions > 0 ? ladderEarly / ladderTransitions : 0,
      repeatedYearShare: ladderTransitions > 0 ? ladderStayed / ladderTransitions : 0,
      averageAgeLeavingAcademy: ageLeavingCount > 0 ? ageLeavingSum / ageLeavingCount : 0,
      averageAcademySeasons: academySeasonsSum / count,
    },
    repetition: {
      averageRepeatedEvents: repeatedSum / count,
      averageLongestCategoryRun: categoryRunSum / count,
      worstCategoryRun,
      duplicateSequenceShare: duplicated / count,
      averageEventsPerCareer: eventsSum / count,
      distinctEventsUsed: distinctEvents.size,
    },
    world: {
      wonPromotion: share('won_promotion'),
      sufferedRelegation: share('suffered_relegation'),
      wonTitleOutsideMaccabi: share('won_title_outside_maccabi'),
      playedAbroad: share('first_move_abroad'),
      cameBackToIsrael: share('returned_to_israel'),
      failedAbroad: share('failed_abroad'),
      hadALoanSpell: share('loan'),
      movedUp: share('moved_up_a_level'),
      movedDown: share('moved_down_a_level'),
      rebuiltCareer: share('rebuilt_career'),
      breakoutAtSmallClub: share('breakout_at_small_club'),
      averageSeniorClubs: seniorClubsSum / count,
      averageSecondDivisionSeasons: secondDivisionSeasonsSum / count,
      sawAWorldEvent: share('worldEvent'),
    },
    maccabiStory: {
      relationships,
      metMaccabiAfterLeaving: metMaccabiAfterLeaving / count,
      metMaccabiGivenLeft: leftMaccabi > 0 ? metMaccabiAfterLeaving / leftMaccabi : 0,
      facedThemInAMatch: share('facedThem'),
      scoredAgainstThem: share('scoredAgainst'),
      refusedToCelebrate: share('refusedToCelebrate'),
      offeredAHomecoming: share('cameHome'),
      cameHome: share('cameHome'),
      homecomingKinds,
    },
  };
}

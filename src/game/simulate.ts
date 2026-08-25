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
  continueAfterProgression,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  resolveYouthTransition,
  type NewCareerInput,
  type RetirementDecision,
} from './careerEngine';
import { createRng, type Rng } from './random';

export interface CareerPolicy {
  pickChoice(event: GameEvent, career: Career, rng: Rng): string;
  pickOffer(offers: TransferOffer[], career: Career, rng: Rng): string | null;
  pickRetirement(career: Career, rng: Rng): RetirementDecision;
}

/** Decides at random. The baseline for "what does an average career look like". */
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

/** Always takes the boldest option available - the "go for it" player. */
export const ambitiousPolicy: CareerPolicy = {
  pickChoice: (event, _career, rng) => {
    const bold = event.choices.filter((c) => c.risk === 'opportunity' || c.risk === 'risky');
    return bold.length > 0 ? rng.pick(bold).id : rng.pick(event.choices).id;
  },
  pickOffer: (offers, _career, rng) => {
    const mandatory = offers.find((o) => o.mandatory);
    if (mandatory) return mandatory.id;
    return offers.length > 0 ? rng.pick(offers).id : null;
  },
  pickRetirement: (career) => (career.age >= 35 ? 'retire' : 'continue'),
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
  pickRetirement: (career, rng) => {
    const apps = career.lastSeasonRecord?.stats.appearances ?? 0;
    if (career.age >= 36) return 'retire';
    if (apps < 8 && rng.chance(0.6)) return 'retire';
    return 'continue';
  },
};

/** Always reaches for the biggest upside, and eats the downside when it comes. */
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
  pickRetirement: (career) => (career.age >= 37 ? 'retire' : 'continue'),
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
  pickRetirement: (career) => (career.age >= 36 ? 'retire' : 'continue'),
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
  repetition: RepetitionMetrics;
}

/** Every event flagged `rare` in the data - no hand-maintained list to drift out of date. */
const RARE_EVENT_IDS: ReadonlySet<string> = new Set(
  Object.values(EVENTS_BY_ID)
    .filter((event) => event.rarity === 'rare')
    .map((event) => event.id),
);

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
  };
}

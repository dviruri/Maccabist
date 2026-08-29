/**
 * Maccabi Legacy (v0.6) - what this career actually means in Maccabi Haifa history.
 *
 * FOUR CONCEPTS, DELIBERATELY SEPARATE, AND THIS MODULE IS ONLY THE FOURTH:
 *
 *   ABILITY          how good the player is right now.
 *   GLOBAL CAREER    how impressive the whole football career is, anywhere on earth
 *                    (`globalCareerScore` below - peak, trophies wherever won, longevity).
 *   MACCABISM        how the player FEELS about Maccabi (v0.4.8's guarded identity stat).
 *   MACCABI LEGACY   what the player DID in green, measured against the men who did it before.
 *
 * A world-class career with three Maccabi appearances scores enormous globally and almost
 * nothing here. A one-club captain who never impressed Europe can top this scale. That tension
 * is the product: the game must be able to say "you were a great footballer" and "you were not
 * a Maccabi legend" in the same breath.
 *
 * TRUTH DISCIPLINE (Phase 2): every fact is derived from settled SeasonRecords and the trophy
 * list via the v0.4.8 truth patterns. Nothing here reads transfer offers, narrative text,
 * league-name strings, or memories-as-statistics. Academy football never contaminates senior
 * records (Phase 3); loan spells at other clubs never count as Maccabi football (Phase 38);
 * trophies count only when won AT Maccabi (Phase 40). Everything is deterministic - no RNG
 * anywhere in this module (Phase 46).
 */

import { MACCABI_ID } from '../data/clubs';
import {
  historicalLadder,
  historicalRecord,
  MACCABI_PANTHEON,
  type MaccabiHistoricalPlayer,
  type RecordCategoryId,
} from '../data/maccabiHistory';
import { maccabiRelationship } from './maccabiEngine';
import { clamp, round } from './random';
import { outputScore } from './rules';
import { isForeignSeason, isMaccabiSeason, seniorSeasons } from './truth';
import type { Career, MemoryKind, SeasonRecord } from '../types';

/* ------------------------------------------------------------------ */
/* Facts: what actually happened, in green                             */
/* ------------------------------------------------------------------ */

/**
 * Every Maccabi senior fact the legacy reads, summed straight off the season records.
 *
 * `career.maccabi.*` counters exist and v0.4.8 validates them, but this module re-derives from
 * the records on principle: the brief's rule is "settled SeasonRecords are the source", and a
 * derivation cannot drift from itself.
 */
export interface MaccabiLegacyFacts {
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Seasons with at least one Maccabi senior appearance. */
  seasons: number;
  championships: number;
  cups: number;
  captainSeasons: number;
  academyGraduate: boolean;
  returned: boolean;
  seasonsAfterReturn: number;
  /** Age at first Maccabi senior appearance, null if it never happened. */
  debutAge: number | null;
}

/** A Maccabi senior season the player actually played for Maccabi (not on loan elsewhere). */
function maccabiSeniorRecords(career: Career): SeasonRecord[] {
  return seniorSeasons(career).filter((s) => isMaccabiSeason(s) && !s.onLoan);
}

export function maccabiLegacyFacts(career: Career): MaccabiLegacyFacts {
  const records = maccabiSeniorRecords(career);
  const played = records.filter((s) => s.stats.appearances > 0);

  let appearances = 0;
  let starts = 0;
  let goals = 0;
  let assists = 0;
  let cleanSheets = 0;
  let captainSeasons = 0;
  let debutAge: number | null = null;
  for (const record of records) {
    appearances += record.stats.appearances;
    starts += record.stats.starts;
    goals += record.stats.goals;
    assists += record.stats.assists;
    cleanSheets += record.stats.cleanSheets;
    if (record.captain && record.stats.appearances > 0) captainSeasons += 1;
    if (debutAge === null && record.stats.appearances > 0) debutAge = record.age;
  }

  const championships = career.trophies.filter(
    (t) => t.clubId === MACCABI_ID && t.id === 'championship',
  ).length;
  const cups = career.trophies.filter((t) => t.clubId === MACCABI_ID && t.id === 'cup').length;

  return {
    appearances,
    starts,
    goals,
    assists,
    cleanSheets,
    seasons: played.length,
    championships,
    cups,
    captainSeasons,
    academyGraduate: career.maccabi.academyGraduate,
    returned: career.maccabi.returned,
    seasonsAfterReturn: career.maccabi.seasonsAfterReturn,
    debutAge,
  };
}

/* ------------------------------------------------------------------ */
/* The Maccabi Legacy Score                                            */
/* ------------------------------------------------------------------ */

/** Diminishing returns: the 50th appearance builds a name, the 450th builds a statue slowly. */
function curve(value: number, target: number, exponent = 0.7): number {
  if (target <= 0) return 0;
  return clamp(Math.min(1, value / target) ** exponent, 0, 1);
}

export interface LegacyComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

/**
 * The score's shape, tuned against the real pantheon rather than invented:
 *
 *   longevity target 420    between Benado (400) and Katan (464) - a full club life
 *   seasons target 12       a genuine era, not a spell
 *   titles target           4 championships (Boccoli's haul) + a cup rounds to full marks
 *   captaincy target 5      Katan wore it for eight years; five earns the leadership name
 *
 * Weights follow Phase 10's dimensions. The relationship modifier is capped at 6 of 100:
 * Maccabism 100 with 8 appearances is a devoted fan, not a club legend (Phase 36), and the
 * cap plus the appearance-gated story points make that structural.
 */
const LEGACY_WEIGHTS = {
  longevity: 26,
  seasons: 10,
  achievement: 24,
  leadership: 14,
  contribution: 14,
  story: 6,
  relationship: 6,
} as const;

const LEGACY_TARGETS = {
  appearances: 420,
  seasons: 12,
  titlePoints: 4.6, // championships + cups*0.6: four titles and a cup
  captainSeasons: 5,
  contribution: 60, // position-normalised outputScore at "great career" level
} as const;

export function maccabiLegacyComponents(career: Career): LegacyComponent[] {
  const f = maccabiLegacyFacts(career);
  const w = LEGACY_WEIGHTS;
  const t = LEGACY_TARGETS;

  /*
   * Position fairness (Phase 11): `outputScore` already normalises - a keeper's clean sheets
   * and a striker's goals both land on the same scale - and appearances/seasons/titles/captaincy
   * are position-blind. A goalkeeper reaches every rank without scoring once.
   */
  const contribution = outputScore(f.goals, f.assists, career.position, f.cleanSheets);
  const titlePoints = f.championships + f.cups * 0.6;

  /*
   * Club story (Phase 10): facts only, each counted once (Phase 13) - the homecoming is read
   * from the career record, never from memories, and a return only means something if football
   * followed it (Phase 17's rule, applied to points as well as archetypes).
   */
  const realReturn = f.returned && f.seasonsAfterReturn >= 2 && f.appearances >= 40;
  const storyPoints =
    (f.academyGraduate ? 0.5 : 0) + (realReturn ? 0.5 : 0);

  /*
   * The relationship modifier (Phase 36): capped, and gated on actually having played - the
   * feeling amplifies a legacy, it cannot substitute for one.
   */
  const relationshipGate = curve(f.appearances, 120, 1);
  const relationshipPoints = (career.maccabism / 100) * w.relationship * relationshipGate;

  const components: LegacyComponent[] = [
    {
      key: 'longevity',
      label: 'הופעות בירוק',
      points: curve(f.appearances, t.appearances) * w.longevity,
      max: w.longevity,
      detail: `${f.appearances} הופעות ליגה`,
    },
    {
      key: 'seasons',
      label: 'עונות במכבי',
      points: curve(f.seasons, t.seasons) * w.seasons,
      max: w.seasons,
      detail: `${f.seasons} עונות`,
    },
    {
      key: 'achievement',
      label: 'תארים עם מכבי',
      points: curve(titlePoints, t.titlePoints, 0.8) * w.achievement,
      max: w.achievement,
      detail: `${f.championships} אליפויות, ${f.cups} גביעים`,
    },
    {
      key: 'leadership',
      label: 'מנהיגות',
      points: curve(f.captainSeasons, t.captainSeasons, 0.8) * w.leadership,
      max: w.leadership,
      detail: f.captainSeasons > 0 ? `${f.captainSeasons} עונות עם הסרט` : 'בלי הסרט',
    },
    {
      key: 'contribution',
      label: 'תרומה במגרש',
      points: curve(contribution, t.contribution) * w.contribution,
      max: w.contribution,
      detail:
        career.position === 'GK'
          ? `${f.cleanSheets} שערים נקיים`
          : `${f.goals} שערים, ${f.assists} בישולים`,
    },
    {
      key: 'story',
      label: 'הסיפור המכבי',
      points: storyPoints * w.story,
      max: w.story,
      detail: [f.academyGraduate ? 'בוגר המחלקה' : null, realReturn ? 'חזרה אמיתית' : null]
        .filter(Boolean)
        .join(' · ') || '—',
    },
    {
      key: 'relationship',
      label: 'הקשר עם הקהל',
      points: relationshipPoints,
      max: w.relationship,
      detail: `מכביסטיות ${Math.round(career.maccabism)}`,
    },
  ];

  return components.map((c) => ({ ...c, points: round(c.points, 1) }));
}

export function maccabiLegacyScore(career: Career): number {
  const total = maccabiLegacyComponents(career).reduce((sum, c) => sum + c.points, 0);
  return Math.round(clamp(total, 0, 100));
}

/* ------------------------------------------------------------------ */
/* Global career score - the honest other half                         */
/* ------------------------------------------------------------------ */

/**
 * How impressive the whole football career was, with no green in the lens (Phase 35's other
 * axis). Peak level, trophies wherever they were won, senior longevity anywhere, and how far
 * from home the career reached. Deliberately simple: it exists so the retirement screen can
 * show a 90/34 career honestly, not to replace the story-driven ending system.
 */
export function globalCareerScore(career: Career): number {
  const senior = seniorSeasons(career);
  const totalApps = senior.reduce((sum, s) => sum + s.stats.appearances, 0);
  const foreignApps = senior
    .filter((s) => isForeignSeason(s))
    .reduce((sum, s) => sum + s.stats.appearances, 0);
  const trophyPoints = career.trophies.reduce((sum, t) => sum + t.weight, 0);

  const peak = clamp((career.peakAbility - 55) / 40, 0, 1) * 38;
  const silver = curve(trophyPoints, 10, 0.75) * 26;
  const longevity = curve(totalApps, 500) * 20;
  const horizon = curve(foreignApps, 180, 0.8) * 10;
  const name = clamp((career.reputation - 40) / 55, 0, 1) * 6;

  return Math.round(clamp(peak + silver + longevity + horizon + name, 0, 100));
}

/* ------------------------------------------------------------------ */
/* Rank ladder                                                         */
/* ------------------------------------------------------------------ */

/**
 * The Maccabi rank ladder (Phase 15). Four tiers, using the language the game already speaks.
 *
 * Score decides size; the HARD GATES decide legitimacy. "הסמל" is unreachable without a real
 * Maccabi career in the record books - a 90-point global superstar with 15 appearances in green
 * fails the gate however the arithmetic falls (Phase 14, acceptance criterion 12).
 */
export type MaccabiLegacyRank = 'player' | 'fan_favourite' | 'green_legend' | 'symbol';

export const LEGACY_RANK_LABELS: Record<MaccabiLegacyRank, string> = {
  player: 'שחקן מכבי',
  fan_favourite: 'יקיר הקהל',
  green_legend: 'אגדה ירוקה',
  symbol: 'הסמל',
};

/** Green/gold only - the v0.5.1 brand rule, enforced by the badge test. */
export const LEGACY_RANK_ICONS: Record<MaccabiLegacyRank, string> = {
  player: '🟢',
  fan_favourite: '💚',
  green_legend: '⭐',
  symbol: '👑',
};

export function maccabiLegacyRank(career: Career): MaccabiLegacyRank {
  const score = maccabiLegacyScore(career);
  const f = maccabiLegacyFacts(career);

  /*
   * Measured before tightening: the first gate made 12% of balanced careers and 24% of loyal
   * ones "הסמל", with the symbol OUTNUMBERING the legend tier - a long stay alone was enough.
   * The symbol is the full package or nothing: a club life, the armband, and silverware, all
   * three. Rarity here is the product working, not a bug.
   */
  const symbolGate =
    f.appearances >= 340 &&
    f.seasons >= 11 &&
    f.captainSeasons >= 3 &&
    f.championships >= 3;
  if (score >= 88 && symbolGate) return 'symbol';

  const legendGate = f.appearances >= 200 && (f.championships >= 2 || f.captainSeasons >= 3);
  if (score >= 65 && legendGate) return 'green_legend';

  const favouriteGate = f.appearances >= 70;
  if (score >= 34 && favouriteGate) return 'fan_favourite';

  return 'player';
}

/* ------------------------------------------------------------------ */
/* Career archetypes                                                   */
/* ------------------------------------------------------------------ */

/**
 * The kind of Maccabi story this career was (Phase 16). Rank says how big; this says what
 * shape. Deterministic priority order, every predicate a fact of the record (Phase 17) - no
 * randomness, no vibes.
 */
export type MaccabiArchetypeId =
  | 'symbol'
  | 'green_legend'
  | 'prodigal_son'
  | 'european_star'
  | 'leader'
  | 'fan_favourite'
  | 'late_bloomer'
  | 'maccabi_player'
  | 'passer_by'
  | 'outsider';

export interface MaccabiArchetype {
  id: MaccabiArchetypeId;
  label: string;
  line: string;
}

const ARCHETYPE_META: Record<MaccabiArchetypeId, Omit<MaccabiArchetype, 'id'>> = {
  symbol: { label: 'הסמל', line: 'מועדון אחד נשם אותך, ואתה נשמת אותו.' },
  green_legend: { label: 'אגדה ירוקה', line: 'המספרים שלך כתובים בספרים של המועדון.' },
  prodigal_son: { label: 'הבן האובד', line: 'עזבת, כבשת עולם אחר, וחזרת לסגור מעגל בירוק.' },
  european_star: { label: 'הכוכב האירופי', line: 'הקריירה הגדולה נבנתה רחוק, אבל התחילה כאן.' },
  leader: { label: 'המנהיג', line: 'הסרט על הזרוע היה הסיפור האמיתי שלך.' },
  fan_favourite: { label: 'יקיר הקהל', line: 'היציע אהב אותך יותר משהסטטיסטיקה תדע לספר.' },
  late_bloomer: { label: 'פורח מאוחר', line: 'הגעת מאוחר - ונשארת עמוק בלב.' },
  maccabi_player: { label: 'שחקן מכבי', line: 'לבשת את החולצה, ונתת לה מה שהיה לך.' },
  passer_by: { label: 'אורח לרגע', line: 'נגעת בירוק לרגע, והדרך לקחה אותך הלאה.' },
  outsider: { label: 'קריירה בחוץ', line: 'הסיפור שלך נכתב במקום אחר.' },
};

export interface MaccabiArchetypeResult {
  primary: MaccabiArchetype;
  secondary: MaccabiArchetype[];
}

export function maccabiArchetypes(career: Career): MaccabiArchetypeResult {
  const f = maccabiLegacyFacts(career);
  const rank = maccabiLegacyRank(career);
  const relationship = maccabiRelationship(career);

  const foreignApps = seniorSeasons(career)
    .filter((s) => isForeignSeason(s))
    .reduce((sum, s) => sum + s.stats.appearances, 0);
  const awaySeasons = seniorSeasons(career).filter((s) => !isMaccabiSeason(s)).length;

  /*
   * "הבן האובד" needs the full journey (Phase 17): a real Maccabi spell, a real departure, real
   * seasons elsewhere, a real return, and real football after it. One rejected foreign offer,
   * or a homecoming spent on the bench, does not qualify.
   */
  const prodigal =
    career.maccabi.everLeft &&
    f.returned &&
    awaySeasons >= 3 &&
    f.seasonsAfterReturn >= 2 &&
    f.appearances >= 100;

  const european =
    foreignApps >= 120 &&
    career.peakAbility >= 78 &&
    (f.academyGraduate || f.appearances >= 20);

  const matches: MaccabiArchetypeId[] = [];
  if (rank === 'symbol') matches.push('symbol');
  if (prodigal) matches.push('prodigal_son');
  if (rank === 'green_legend' || (f.appearances >= 200 && f.championships >= 2)) {
    matches.push('green_legend');
  }
  if (f.captainSeasons >= 3) matches.push('leader');
  if (european) matches.push('european_star');
  if (
    (relationship === 'beloved' || relationship === 'son_of_the_club') &&
    f.appearances >= 70
  ) {
    matches.push('fan_favourite');
  }
  if (f.debutAge !== null && f.debutAge >= 24 && f.appearances >= 120) matches.push('late_bloomer');
  if (f.appearances >= 30) matches.push('maccabi_player');
  if (f.appearances > 0) matches.push('passer_by');
  matches.push('outsider');

  const ordered = [...new Set(matches)];
  const primaryId = ordered[0] ?? 'outsider';
  const secondary = ordered
    .slice(1)
    .filter((id) => id !== 'maccabi_player' && id !== 'passer_by' && id !== 'outsider')
    .slice(0, 2);

  return {
    primary: { id: primaryId, ...ARCHETYPE_META[primaryId] },
    secondary: secondary.map((id) => ({ id, ...ARCHETYPE_META[id] })),
  };
}

/* ------------------------------------------------------------------ */
/* Historical standing                                                 */
/* ------------------------------------------------------------------ */

export interface HistoricalStanding {
  category: RecordCategoryId;
  playerValue: number;
  /** 1-based position among (pantheon + player), 1 = the best there has ever been. */
  rank: number;
  /** The man directly above, or null when the player holds the record. */
  above: { player: MaccabiHistoricalPlayer; value: number } | null;
  /** How far to the next name up (0 when record holder). */
  gap: number;
  tiedRecord: boolean;
  brokeRecord: boolean;
}

function playerValueFor(career: Career, category: RecordCategoryId): number {
  const f = maccabiLegacyFacts(career);
  if (category === 'appearances') return f.appearances;
  if (category === 'goals') return f.goals;
  return f.championships;
}

/**
 * Where the career stands against the history books (Phases 21-22, 42).
 *
 * The historical dataset is never mutated - the player's value is compared against it, and the
 * "effective record" for display is simply max(history, player). Ties and breaks are distinct:
 * matching Harazi's 495 equals the record; the 496th appearance breaks it.
 */
export function historicalStanding(career: Career, category: RecordCategoryId): HistoricalStanding {
  const value = playerValueFor(career, category);
  const ladder = historicalLadder(category);
  const record = historicalRecord(category);

  const ahead = ladder.filter((row) => row.value > value);
  const rank = ahead.length + 1;
  const above = ahead.length > 0 ? ahead[ahead.length - 1]! : null;

  return {
    category,
    playerValue: value,
    rank,
    above,
    gap: above ? above.value - value : 0,
    tiedRecord: record !== null && value === record.value && value > 0,
    brokeRecord: record !== null && value > record.value,
  };
}

/** The pantheon members most relevant to THIS career, for the comparison section (Phase 32). */
export function contextualComparisons(career: Career): MaccabiHistoricalPlayer[] {
  const group =
    career.position === 'GK'
      ? 'GK'
      : career.position === 'CB' || career.position === 'FB'
        ? 'DF'
        : career.position === 'ST' || career.position === 'WG'
          ? 'FW'
          : 'MF';

  const standing = historicalStanding(career, 'appearances');
  const ladder = historicalLadder('appearances');

  /*
   * A same-position legend is guaranteed first (Phase 32: a keeper compares against keepers
   * before anyone else), then whoever is statistically nearby, then the rest of the pantheon.
   */
  const samePosition = MACCABI_PANTHEON.filter((p) => p.positionGroup === group).sort(
    (a, b) =>
      Math.abs((a.leagueAppearances ?? 0) - standing.playerValue) -
      Math.abs((b.leagueAppearances ?? 0) - standing.playerValue),
  );
  const nearby = ladder
    .filter((row) => Math.abs(row.value - standing.playerValue) <= 120)
    .map((row) => row.player);

  const picks: MaccabiHistoricalPlayer[] = [];
  for (const p of [...samePosition.slice(0, 1), ...nearby, ...samePosition, ...MACCABI_PANTHEON]) {
    if (!picks.some((x) => x.id === p.id)) picks.push(p);
    if (picks.length >= 3) break;
  }
  return picks;
}

/* ------------------------------------------------------------------ */
/* Live milestones (Phases 24-28, 45, 55)                              */
/* ------------------------------------------------------------------ */

/**
 * The moments the club's history books notice, defined once and announced exactly once.
 *
 * `career.legacyMilestones` is the announced ledger - the ONLY persisted legacy state. A
 * milestone is due when its predicate holds and its id is not yet in the ledger, which is what
 * lets a loaded veteran career be marked as already-past-100 without three retroactive
 * celebrations (Phase 45), and what makes "exactly once" structural (Phase 26).
 *
 * Reconciliation with the existing milestone system (Phase 1 audit): `milestones.ts` already
 * owns the first Maccabi debut and the first championship, so those are NOT duplicated here -
 * one underlying achievement, one celebration (Phase 13).
 */
export interface LegacyMilestoneDef {
  id: string;
  icon: string;
  major: boolean;
  /** Timeline text at the moment it happens. */
  text: string;
  /** Career memory to record alongside, for later event callbacks. */
  memory?: MemoryKind;
  due: (career: Career) => boolean;
}

const appsAtLeast = (n: number) => (career: Career) => maccabiLegacyFacts(career).appearances >= n;

export const LEGACY_MILESTONES: readonly LegacyMilestoneDef[] = [
  { id: 'maccabi_apps_50', icon: '🟢', major: false, text: '50 הופעות ליגה במדי מכבי חיפה', due: appsAtLeast(50) },
  {
    id: 'maccabi_apps_100',
    icon: '💚',
    major: true,
    text: '100 הופעות ליגה בירוק - מועדון המאה',
    memory: 'maccabi_century',
    due: appsAtLeast(100),
  },
  { id: 'maccabi_apps_200', icon: '💚', major: true, text: '200 הופעות ליגה במכבי חיפה', due: appsAtLeast(200) },
  { id: 'maccabi_apps_300', icon: '⭐', major: true, text: '300 הופעות ליגה במכבי חיפה', due: appsAtLeast(300) },
  { id: 'maccabi_apps_400', icon: '⭐', major: true, text: '400 הופעות ליגה - בין הגדולים בהיסטוריה', due: appsAtLeast(400) },
  {
    id: 'maccabi_top10_apps',
    icon: '📗',
    major: true,
    text: 'נכנסת לעשירייה הפתוחה של כל הזמנים בהופעות במכבי',
    memory: 'maccabi_top10_appearances',
    due: (c) => {
      const s = historicalStanding(c, 'appearances');
      return s.rank <= 10 && s.playerValue > 0;
    },
  },
  {
    id: 'maccabi_top3_apps',
    icon: '📗',
    major: true,
    text: 'שלישיית ההופעות הגדולה בתולדות מכבי - ואתה בתוכה',
    due: (c) => {
      const s = historicalStanding(c, 'appearances');
      return s.rank <= 3 && s.playerValue > 0;
    },
  },
  {
    id: 'maccabi_apps_tie_record',
    icon: '👑',
    major: true,
    text: 'השווית את שיא ההופעות של אלון חרזי',
    /*
     * >= rather than the display-level `tiedRecord` (which is ===), because a milestone
     * predicate must be MONOTONIC: a player who tied at 495 and then played a 496th game has
     * still, forever, once tied the record. The 5,000-career integrity smoke caught the ===
     * version flagging 0.2% of careers - everyone who tied and then kept playing.
     */
    due: (c) => {
      const s = historicalStanding(c, 'appearances');
      return s.playerValue > 0 && (s.tiedRecord || s.brokeRecord);
    },
  },
  {
    id: 'maccabi_apps_record',
    icon: '👑',
    major: true,
    text: 'שיא ההופעות של מכבי חיפה שייך לך',
    memory: 'maccabi_appearance_record',
    due: (c) => historicalStanding(c, 'appearances').brokeRecord,
  },
  {
    id: 'maccabi_top10_goals',
    icon: '🥅',
    major: true,
    text: 'נכנסת לעשירייה הפתוחה של מלכי השערים של מכבי',
    due: (c) => {
      const s = historicalStanding(c, 'goals');
      return s.rank <= 10 && s.playerValue > 0;
    },
  },
  {
    id: 'maccabi_goals_record',
    icon: '👑',
    major: true,
    text: 'עברת את 90 השערים של זאהי ארמלי - מלך השערים החדש',
    due: (c) => historicalStanding(c, 'goals').brokeRecord,
  },
  {
    id: 'maccabi_first_captaincy',
    icon: '🎖️',
    major: true,
    text: 'העונה הראשונה שלך כקפטן מכבי חיפה',
    memory: 'first_maccabi_captaincy',
    due: (c) => maccabiLegacyFacts(c).captainSeasons >= 1,
  },
];

/** Milestones whose moment has arrived and which have never been announced. */
export function dueLegacyMilestones(career: Career): LegacyMilestoneDef[] {
  const announced = new Set(career.legacyMilestones ?? []);
  return LEGACY_MILESTONES.filter((m) => !announced.has(m.id) && m.due(career));
}

/**
 * Mark everything currently due as already seen, announcing nothing (Phase 45).
 *
 * The migration path for careers that predate the ledger: a veteran with 235 appearances is a
 * man who lived those milestones, not one who owes the game three popups.
 */
export function markLegacyMilestonesSeen(career: Career): Career {
  const due = LEGACY_MILESTONES.filter((m) => m.due(career)).map((m) => m.id);
  return { ...career, legacyMilestones: [...new Set([...(career.legacyMilestones ?? []), ...due])] };
}

/**
 * The next number worth chasing (Phase 25) - for the record-proximity line in the legacy
 * screen. Appearance thresholds and the historical ladder only; null when the mountain is
 * climbed or the career never touched green.
 */
export function nextLegacyTarget(career: Career): { label: string; gap: number } | null {
  const f = maccabiLegacyFacts(career);
  if (f.appearances === 0) return null;

  const standing = historicalStanding(career, 'appearances');
  if (standing.above) {
    const next = standing.above;
    return {
      label: `${next.player.name} — ${next.value} הופעות`,
      gap: next.value - f.appearances,
    };
  }
  const thresholds = [50, 100, 200, 300, 400, 500];
  const next = thresholds.find((t) => t > f.appearances);
  return next ? { label: `${next} הופעות במכבי`, gap: next - f.appearances } : null;
}

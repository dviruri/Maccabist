/**
 * One authoritative source for every fact (v0.4.8).
 *
 * Playtesting found four bugs that looked unrelated and were the same bug: two systems each
 * holding an opinion about one fact, and no rule about which one wins.
 *
 *   a Maccabi senior with live on-field match events and 0 appearances
 *     -> `match_moment` events gated on `roleValue` (standing) instead of participation.
 *        0 of 21 gated on appearances at all.
 *
 *   a league title at a club that finished 5th
 *     -> `rollTrophies` drew the championship from `club.titleChance`, a fixed per-club
 *        probability with no connection to the authoritative final table.
 *
 *   foreign appearances for a career that never left Israel
 *     -> the retirement screen decided "abroad" by comparing the Hebrew league *name* against two
 *        strings. Every academy season failed the comparison, and so did every Liga Leumit season,
 *        because the filter said 'ליגה לאומית' and the league is called 'הליגה הלאומית'.
 *
 *   Maccabism moving because of another club
 *     -> `applyHalfProgression` changed it every half-season from nothing but which club the
 *        player was at.
 *
 * This module is where the answers live now. The rules it encodes:
 *
 *   COMPETITION   the settled league projection owns position, champion, promoted, relegated.
 *                 Nothing rolls a league title separately, ever.
 *   PARTICIPATION the season participation ledger owns appearances and starts, and gates every
 *                 on-field event.
 *   HISTORY       a settled `SeasonRecord` is immutable and owns what happened that season.
 *   SUMMARY       every career total is *derived* from season records. There are no independent
 *                 career counters for football history.
 *   IDENTITY      only an explicitly Maccabi-relevant outcome may move Maccabism.
 *
 * Everything here is a pure read over a `Career`. Nothing in this file mutates.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { leagueShape } from '../data/leagueShape';
import { outcomeForPosition } from './leagueEngine';
import type {
  Career,
  ClubSeasonResult,
  MaccabiRelevance,
  SeasonRecord,
  Trophy,
} from '../types';

/* ------------------------------------------------------------------ */
/* Competition truth                                                   */
/* ------------------------------------------------------------------ */

/**
 * Did this club season end as champions?
 *
 * The *only* place that question is answered. Reads the settled outcome, which v0.4.6 derives
 * from the final table position rather than drawing separately — so a fifth-placed club cannot be
 * champions, structurally, rather than by a check somewhere downstream.
 */
export function isLeagueChampion(result: ClubSeasonResult): boolean {
  return result.outcome === 'champion';
}

export function isPromoted(result: ClubSeasonResult): boolean {
  return result.outcome === 'promoted';
}

export function isRelegated(result: ClubSeasonResult): boolean {
  return result.outcome === 'relegated';
}

/**
 * The same question asked of a season the player has already played.
 *
 * Prefers the recorded finishing position over the stored outcome label. They agree — v0.4.6
 * derives one from the other — and preferring the position means a save whose label was written
 * by older code still gets the right answer.
 */
export function seasonWasChampionship(
  record: SeasonRecord,
  result: ClubSeasonResult | null,
): boolean {
  if (result && result.season === record.season) {
    if (result.finalPosition !== undefined) {
      const shape = leagueShape(result.leagueId);
      if (shape) return outcomeForPosition(result.leagueId, result.finalPosition, shape) === 'champion';
    }
    return isLeagueChampion(result);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Participation truth                                                 */
/* ------------------------------------------------------------------ */

/**
 * Appearances the player has actually been credited with this season, so far.
 *
 * Read by the on-field event gate. During the early slot nothing has been played yet, so this is
 * zero and `expectedToPlay` answers instead; from the mid slot onward it is the real figure.
 */
export function appearancesThisSeason(career: Career): number {
  const ledger = career.seasonParticipation;
  if (!ledger || ledger.season !== career.currentSeason) return 0;
  return ledger.appearances;
}

export function startsThisSeason(career: Career): number {
  const ledger = career.seasonParticipation;
  if (!ledger || ledger.season !== career.currentSeason) return 0;
  return ledger.starts;
}

/* ------------------------------------------------------------------ */
/* Season record truth                                                 */
/* ------------------------------------------------------------------ */

/** Senior seasons only. Age-group football is not a professional career. */
export function seniorSeasons(career: Career): SeasonRecord[] {
  return career.seasonHistory.filter((s) => s.academyStage === 'senior');
}

/**
 * Was this season played for a club outside Israel?
 *
 * From the club's `country`, which is data. The bug this replaces compared the league's Hebrew
 * *display name* against two hard-coded strings — so every academy season counted as Europe, and
 * so did every Liga Leumit season, because the filter's spelling did not match the league's.
 */
export function isForeignSeason(record: SeasonRecord): boolean {
  const club = safeClub(record.clubId);
  return club !== null && club.country !== 'ישראל';
}

export function isMaccabiSeason(record: SeasonRecord): boolean {
  return record.clubId === MACCABI_ID;
}

/** A club id that may not exist, for saves that referenced a club since removed. */
function safeClub(clubId: string): ReturnType<typeof getClub> | null {
  try {
    return getClub(clubId);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Career summary truth                                                */
/* ------------------------------------------------------------------ */

/**
 * Every professional appearance, split by where it happened.
 *
 * The three categories are exhaustive and disjoint by construction — a senior season is at
 * Maccabi, at another Israeli club, or abroad, and cannot be two of those — so:
 *
 *     total === maccabi + otherIsraeli + foreign
 *
 * is an identity rather than a hope. `validateCareerIntegrity` asserts it anyway, because an
 * identity that is never checked is a comment.
 *
 * Youth appearances are counted separately and never folded in. A retirement screen that silently
 * added a boy's נערים ב׳ games to his professional total would be making the same category error
 * the foreign-appearance bug made.
 */
export interface AppearanceBreakdown {
  /** Senior appearances, all clubs. */
  total: number;
  maccabi: number;
  otherIsraeli: number;
  foreign: number;
  /** Age-group appearances, kept apart. */
  youth: number;
  /** Senior seasons in which he actually played at least once. */
  seniorSeasonsPlayed: number;
  foreignSeasonsPlayed: number;
  maccabiSeasonsPlayed: number;
}

export function appearanceBreakdown(career: Career): AppearanceBreakdown {
  const out: AppearanceBreakdown = {
    total: 0,
    maccabi: 0,
    otherIsraeli: 0,
    foreign: 0,
    youth: 0,
    seniorSeasonsPlayed: 0,
    foreignSeasonsPlayed: 0,
    maccabiSeasonsPlayed: 0,
  };

  for (const record of career.seasonHistory) {
    const apps = record.stats.appearances;
    if (record.academyStage !== 'senior') {
      out.youth += apps;
      continue;
    }

    out.total += apps;
    if (apps > 0) out.seniorSeasonsPlayed += 1;

    if (isMaccabiSeason(record)) {
      out.maccabi += apps;
      if (apps > 0) out.maccabiSeasonsPlayed += 1;
    } else if (isForeignSeason(record)) {
      out.foreign += apps;
      if (apps > 0) out.foreignSeasonsPlayed += 1;
    } else {
      out.otherIsraeli += apps;
    }
  }

  return out;
}

/** True only when a foreign club actually gave him minutes. An offer is not a career. */
export function hasForeignAppearance(career: Career): boolean {
  return appearanceBreakdown(career).foreign > 0;
}

/** Senior appearances for Maccabi Haifa. Academy years are not senior appearances. */
export function maccabiSeniorAppearances(career: Career): number {
  return appearanceBreakdown(career).maccabi;
}

/* ------------------------------------------------------------------ */
/* Trophy truth                                                        */
/* ------------------------------------------------------------------ */

/**
 * The trophies a career actually won, by kind.
 *
 * A league title and a cup are different things and the summary must not merge them. v0.4 stored
 * both in one array distinguished only by an id string, which is how "אליפות" ended up printed
 * for a cup.
 */
export function leagueTitles(career: Career): Trophy[] {
  return career.trophies.filter((t) => LEAGUE_TROPHY_IDS.includes(t.id));
}

export function cupWins(career: Career): Trophy[] {
  return career.trophies.filter((t) => CUP_TROPHY_IDS.includes(t.id));
}

/** Ids that mean "won the league", in any of the modelled competitions. */
export const LEAGUE_TROPHY_IDS: readonly string[] = [
  'championship',
  'foreign_championship',
  'youth_championship',
];

export const CUP_TROPHY_IDS: readonly string[] = ['cup', 'foreign_cup', 'youth_cup'];

/* ------------------------------------------------------------------ */
/* Maccabism truth (v0.4.8, Phase 7.3)                                 */
/* ------------------------------------------------------------------ */

/**
 * The central guard on Maccabism.
 *
 * Maccabism is what the player feels about ONE club. It was moving because of a national-team
 * call-up, a cup final at another club, a dressing-room speech, a contract negotiation, and every
 * half-season simply for being somewhere - 27 of the events that changed it carried no Maccabi
 * scope whatsoever, and `applyHalfProgression` changed it passively on top.
 *
 * So no delta reaches the career unless the thing that caused it says **what about Maccabi
 * happened**. `'none'` and `undefined` both mean "not about Maccabi", and both return zero.
 *
 * Deliberately a guard rather than a convention. Phase 7.3 is explicit that event authors
 * remembering the rule is not a mechanism, and this is the one door every path goes through -
 * events, transfer offers, and anything added later.
 */
export function guardedMaccabismDelta(
  requested: number | undefined,
  relevance: MaccabiRelevance | undefined,
  /** Current value, for the headroom taper. Omitted skips the taper entirely. */
  current?: number,
): number {
  if (!requested) return 0;
  if (relevance === undefined || relevance === 'none') return 0;
  if (requested < 0 || current === undefined) return requested;

  /*
   * Positive deltas taper as the number approaches the ceiling (v0.4.8).
   *
   * Removing the passive drift was correct and it had a consequence I did not anticipate: the
   * event deltas are net positive, and with nothing pulling back they ratcheted. Measured
   * immediately after the removal - median Maccabism 100, mean 94.7, p75 and p90 both 100. A stat
   * pinned at its ceiling carries no information, and it inflated the Legend Score with it.
   *
   * This is deliberately NOT the old decay coming back. Nothing here moves the number on its own;
   * an event still has to happen, and it still has to be about Maccabi. What changed is that the
   * hundredth point of devotion is harder to earn than the fiftieth, which is both a better model
   * and what keeps the top of the scale meaning something.
   */
  const headroom = Math.max(0, (MACCABISM_CEILING - current) / MACCABISM_CEILING);
  return requested * headroom ** MACCABISM_TAPER;
}

const MACCABISM_CEILING = 100;
/** Higher taper = harder to reach the top. Tuned against the measured distribution. */
const MACCABISM_TAPER = 0.55;

/**
 * Why a Maccabism change was allowed, for the debug trace (Phase 24).
 *
 * A delta with no reason is a validator error, so this never returns an empty string for a delta
 * that was actually applied.
 */
export const MACCABI_RELEVANCE_REASONS: Record<MaccabiRelevance, string> = {
  none: 'לא קשור למכבי',
  identity: 'זהות המועדון - החולצה, הסמל, הסרט',
  fans: 'הקהל',
  people: 'אנשים מהמועדון',
  leaving: 'עזיבת מכבי',
  return: 'חזרה למכבי',
  opponent: 'משחק מול מכבי',
};

/* ------------------------------------------------------------------ */
/* Career trophy summary (v0.6.1, C2)                                  */
/* ------------------------------------------------------------------ */

export interface TrophyGroup {
  /** Trophy id, e.g. 'championship' | 'cup'. */
  id: string;
  /** The competition's own name - 'גביע המדינה', never a generic word. */
  name: string;
  count: number;
  /** Clubs it was won with, in the order first won. */
  clubs: string[];
  /** True when every one of them was won at Maccabi. */
  allAtMaccabi: boolean;
}

/**
 * Every trophy the career actually won, grouped by competition (v0.6.1).
 *
 * Written because the retirement screen showed only `career.trophies.length` - a number. A
 * player who won the State Cup with Hapoel Kfar Saba saw "תארים בקריירה: 1" and never saw the
 * words גביע המדינה anywhere in his career summary, which is the reported bug: the trophy
 * existed in the data, in the season record and on the timeline, and then vanished at the one
 * screen that is supposed to sum a career up.
 *
 * Derived from the trophy list, so it cannot disagree with it. Club attribution is preserved:
 * a cup won away from Maccabi is still a cup this player won, and is still not a Maccabi trophy.
 */
export function trophySummary(career: Career): TrophyGroup[] {
  const groups = new Map<string, TrophyGroup>();
  for (const trophy of career.trophies) {
    const existing = groups.get(trophy.id);
    if (existing) {
      existing.count += 1;
      if (!existing.clubs.includes(trophy.clubName)) existing.clubs.push(trophy.clubName);
      if (trophy.clubId !== MACCABI_ID) existing.allAtMaccabi = false;
      continue;
    }
    groups.set(trophy.id, {
      id: trophy.id,
      name: trophy.name,
      count: 1,
      clubs: [trophy.clubName],
      allAtMaccabi: trophy.clubId === MACCABI_ID,
    });
  }
  // Heaviest competitions first, so a league title leads a Toto Cup.
  const weight = (id: string): number =>
    career.trophies.find((t) => t.id === id)?.weight ?? 0;
  return [...groups.values()].sort((a, b) => weight(b.id) - weight(a.id) || b.count - a.count);
}

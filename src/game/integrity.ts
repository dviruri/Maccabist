/**
 * Does this career contradict itself? (v0.4.8)
 *
 * v0.4.8 exists because four systems were each holding an opinion about a fact and nobody was
 * checking that they agreed. `truth.ts` decides who owns what; this decides whether anyone is
 * lying, and it is the thing that turns "should be impossible" into "is checked over 50,000
 * careers".
 *
 * Every violation is structured — a code, a season, a human sentence — so the debug panel can
 * list them and the simulation can count them by category.
 *
 * Deliberately read-only. A validator that quietly repaired what it found would hide the bug it
 * was written to expose, and the repairs belong in settlement and in save migration where they can
 * be reasoned about.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { AGENT_ARCHETYPES, COACH_SPECIALTIES, MANAGER_ARCHETYPES, specialtiesFor } from '../data/people';
import { leagueShape } from '../data/leagueShape';
import { outcomeForPosition } from './leagueEngine';
import {
  appearanceBreakdown,
  CUP_TROPHY_IDS,
  isForeignSeason,
  isMaccabiSeason,
  LEAGUE_TROPHY_IDS,
  seniorSeasons,
} from './truth';
import type { Career, SeasonRecord } from '../types';

export type IntegrityCode =
  /** starts exceeded appearances in a season record. */
  | 'starts_exceed_appearances'
  /** more appearances than the club could plausibly have played matches. */
  | 'appearances_exceed_fixtures'
  /** the three career categories do not sum to the total. */
  | 'appearance_breakdown_mismatch'
  /** foreign appearances credited without a foreign club season. */
  | 'foreign_without_foreign_club'
  /** Maccabi senior appearances credited without a Maccabi senior season. */
  | 'maccabi_without_maccabi_season'
  /** a league title in a season the table says was not won. */
  | 'league_title_without_first_place'
  /** the club finished first and no league title was recorded. */
  | 'first_place_without_league_title'
  /** a promotion memory with no promotion in the world record. */
  | 'promotion_contradiction'
  /** a relegation memory with no relegation in the world record. */
  | 'relegation_contradiction'
  /** a season with an on-field event and no appearances. */
  | 'on_field_without_appearance'
  /** a cup trophy stored with a league trophy id, or vice versa. */
  | 'trophy_kind_confusion'
  /** a stored career counter disagrees with the trophy list it is derived from. */
  | 'counter_disagrees_with_trophies'
  /* ---------- v0.5: people ---------- */
  /** an active (non-retired) career has people state but no current manager. */
  | 'missing_current_manager'
  /** the current manager belongs to a different club than the player. */
  | 'manager_club_mismatch'
  /** a manager history entry is still open - history must be closed relationships. */
  | 'open_manager_history'
  /** two people share one id. */
  | 'duplicate_person_id'
  /** a person carries an archetype the game does not define. */
  | 'unknown_person_archetype'
  /** the personal coach's specialty does not fit the player's position. */
  | 'coach_position_mismatch'
  /** a memory references a personId that no known person carries. */
  | 'memory_unknown_person';

export interface IntegrityViolation {
  code: IntegrityCode;
  /** The season it belongs to, where the violation is season-scoped. */
  season?: number;
  detail: string;
}

/** How many matches a club could plausibly have played, with headroom for cups. */
function plausibleFixtures(record: SeasonRecord): number {
  try {
    return getClub(record.clubId).seasonGames + 12;
  } catch {
    return 60;
  }
}

/**
 * Every contradiction in a career.
 *
 * Empty means every system agrees. Callers in development may throw; the running game must not,
 * which is why nothing here mutates and nothing here raises.
 */
export function validateCareerIntegrity(career: Career): IntegrityViolation[] {
  const out: IntegrityViolation[] = [];
  const push = (code: IntegrityCode, detail: string, season?: number): void => {
    out.push(season === undefined ? { code, detail } : { code, season, detail });
  };

  /* ---------------- participation ---------------- */

  for (const record of career.seasonHistory) {
    if (record.stats.starts > record.stats.appearances) {
      push(
        'starts_exceed_appearances',
        `${record.stats.starts} starts from ${record.stats.appearances} appearances`,
        record.season,
      );
    }
    const ceiling = plausibleFixtures(record);
    if (record.stats.appearances > ceiling) {
      push(
        'appearances_exceed_fixtures',
        `${record.stats.appearances} appearances against a plausible ceiling of ${ceiling}`,
        record.season,
      );
    }
  }

  /* ---------------- career aggregation ---------------- */

  const breakdown = appearanceBreakdown(career);
  const sum = breakdown.maccabi + breakdown.otherIsraeli + breakdown.foreign;
  if (sum !== breakdown.total) {
    push(
      'appearance_breakdown_mismatch',
      `maccabi ${breakdown.maccabi} + other ${breakdown.otherIsraeli} + foreign ${breakdown.foreign} = ${sum}, total ${breakdown.total}`,
    );
  }

  /*
   * The bug the retirement screen shipped: foreign appearances for a career that never left
   * Israel, because "abroad" was decided by comparing a Hebrew league name against two strings.
   */
  if (breakdown.foreign > 0) {
    const hasForeign = seniorSeasons(career).some(
      (s) => isForeignSeason(s) && s.stats.appearances > 0,
    );
    if (!hasForeign) {
      push(
        'foreign_without_foreign_club',
        `${breakdown.foreign} foreign appearances with no foreign senior season`,
      );
    }
  }

  if (breakdown.maccabi > 0) {
    const hasMaccabi = seniorSeasons(career).some(
      (s) => isMaccabiSeason(s) && s.stats.appearances > 0,
    );
    if (!hasMaccabi) {
      push(
        'maccabi_without_maccabi_season',
        `${breakdown.maccabi} Maccabi appearances with no Maccabi senior season`,
      );
    }
  }

  /* ---------------- trophies against the table ---------------- */

  for (const record of career.seasonHistory) {
    if (record.academyStage !== 'senior') continue;

    const result = career.world.clubSeasons.find(
      (s) => s.season === record.season && s.clubId === record.clubId,
    );
    if (!result) continue;

    const shape = leagueShape(result.leagueId);
    const wasChampion =
      shape && result.finalPosition !== undefined
        ? outcomeForPosition(result.leagueId, result.finalPosition, shape) === 'champion'
        : result.outcome === 'champion';

    const titleThisSeason = career.trophies.some(
      (t) => t.season === record.season && t.clubId === record.clubId && LEAGUE_TROPHY_IDS.includes(t.id),
    );

    if (titleThisSeason && !wasChampion) {
      /*
       * The Maccabi Herzliya bug: a championship celebration at a club that finished fifth. This
       * is the assertion that makes it impossible rather than unlikely.
       */
      push(
        'league_title_without_first_place',
        `league title recorded but the club finished ${result.finalPosition ?? '?'} (${result.outcome})`,
        record.season,
      );
    }
    /*
     * The other direction, and softer.
     *
     * A player who barely featured does not get a medal in this game's model, so this must mirror
     * `rollTrophies`'s own floor exactly - BOTH conditions, not just the appearance count. The
     * first version checked only `appearances >= 5` and flagged 2.5% of careers, every one of them
     * a squad player with six or seven games in a forty-two match season: below the minutes share,
     * correctly given no medal, and wrongly reported as a contradiction. A validator that encodes
     * a different rule from the engine is just a second opinion, which is the thing this version
     * is removing.
     */
    const fixtures = (() => {
      try {
        return getClub(record.clubId).seasonGames;
      } catch {
        return 0;
      }
    })();
    const minutesShare = fixtures > 0 ? record.stats.appearances / fixtures : 0;
    if (!titleThisSeason && wasChampion && record.stats.appearances >= 5 && minutesShare >= 0.15) {
      push(
        'first_place_without_league_title',
        `club finished first with ${record.stats.appearances} appearances and no league title recorded`,
        record.season,
      );
    }
  }

  /* ---------------- trophy identity ---------------- */

  for (const trophy of career.trophies) {
    const isLeague = LEAGUE_TROPHY_IDS.includes(trophy.id);
    const isCup = CUP_TROPHY_IDS.includes(trophy.id);
    if (isLeague && isCup) {
      push('trophy_kind_confusion', `trophy ${trophy.id} counts as both a league and a cup`);
    }
  }

  /* ---------------- stored counters against derived truth ---------------- */

  /*
   * `maccabi.championships` and `maccabi.cups` are counters incremented from trophies, which is
   * derived-and-stored rather than derived-on-read (Phase 42). They cannot disagree with the
   * trophy list in a career played under v0.4.8 - the increment only happens when a trophy is
   * added - but a save written by older code can, and the retirement poster reads the counters.
   * So the identity is checked rather than assumed.
   */
  const maccabiLeagueTitles = career.trophies.filter(
    (t) => t.clubId === MACCABI_ID && t.id === 'championship',
  ).length;
  if (career.maccabi.championships !== maccabiLeagueTitles) {
    push(
      'counter_disagrees_with_trophies',
      `maccabi.championships is ${career.maccabi.championships}, trophy list holds ${maccabiLeagueTitles}`,
    );
  }

  const maccabiCups = career.trophies.filter(
    (t) => t.clubId === MACCABI_ID && t.id === 'cup',
  ).length;
  if (career.maccabi.cups !== maccabiCups) {
    push(
      'counter_disagrees_with_trophies',
      `maccabi.cups is ${career.maccabi.cups}, trophy list holds ${maccabiCups}`,
    );
  }

  /* ---------------- promotion and relegation ---------------- */

  const worldOutcomes = new Set(career.world.clubSeasons.map((s) => s.outcome));
  if (career.memories.some((m) => m.kind === 'won_promotion') && !worldOutcomes.has('promoted')) {
    push('promotion_contradiction', 'promotion remembered with no promotion in the world record');
  }
  if (
    career.memories.some((m) => m.kind === 'suffered_relegation') &&
    !worldOutcomes.has('relegated')
  ) {
    push('relegation_contradiction', 'relegation remembered with no relegation in the world record');
  }

  /* ---------------- on-field events ---------------- */

  /*
   * A season in which an on-field event fired must contain an appearance. Settlement reconciles
   * this, so a violation here means the reconciliation itself failed.
   */
  const ledger = career.seasonParticipation;
  if (ledger?.onFieldEventFired === true) {
    const record = career.seasonHistory.find((s) => s.season === ledger.season);
    if (record && record.stats.appearances < 1) {
      push(
        'on_field_without_appearance',
        'an on-field event fired in a season recorded with no appearances',
        ledger.season,
      );
    }
  }

  /* ---------------- people (v0.5, Phase 51) ---------------- */
  validatePeople(career, push);

  return out;
}

/**
 * The people invariants (v0.5).
 *
 * The central one is trust ownership: `career.coachTrust` IS the current manager relationship,
 * so the structural check is that the current manager actually manages the current club - a
 * mismatch would mean the number belongs to a man who is not there, which is v0.5's version of
 * two systems holding one fact.
 */
function validatePeople(
  career: Career,
  push: (code: IntegrityCode, detail: string, season?: number) => void,
): void {
  const people = career.people;
  if (!people) return; // a pre-migration career object; hydrateCareer builds this.

  if (!career.retired && !people.manager) {
    push('missing_current_manager', 'an active career with people state has no current manager');
  }
  if (people.manager && people.manager.clubId !== career.currentClubId) {
    push(
      'manager_club_mismatch',
      `coachTrust is owned by the manager of ${people.manager.clubId} while the player is at ${career.currentClubId}`,
    );
  }
  for (const tenure of people.managerHistory) {
    if (tenure.toSeason === undefined) {
      push('open_manager_history', `historical tenure at ${tenure.clubId} was never closed`);
    }
  }

  /* every person, everywhere, exactly once per id */
  const everyone = [
    ...(people.manager ? [people.manager.person] : []),
    ...people.managerHistory.map((t) => t.person),
    ...(people.agent ? [people.agent.person] : []),
    ...people.agentHistory.map((b) => b.person),
    ...(people.personalCoach ? [people.personalCoach.person] : []),
    ...people.personalCoachHistory.map((b) => b.person),
    ...Object.values(people.clubManagers),
  ];
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const person of everyone) {
    // The same person may legitimately appear twice (current manager + clubManagers map);
    // what may not happen is two DIFFERENT people sharing an id.
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    ids.add(person.id);
  }
  const byId = new Map<string, string>();
  for (const person of everyone) {
    const existing = byId.get(person.id);
    if (existing !== undefined && existing !== person.name) {
      push('duplicate_person_id', `id ${person.id} names both "${existing}" and "${person.name}"`);
    }
    byId.set(person.id, person.name);
  }

  for (const person of everyone) {
    const known =
      person.type === 'club_manager'
        ? person.archetypeId in MANAGER_ARCHETYPES
        : person.type === 'agent'
          ? person.archetypeId in AGENT_ARCHETYPES
          : person.archetypeId in COACH_SPECIALTIES;
    if (!known) {
      push('unknown_person_archetype', `${person.type} ${person.id} carries archetype "${person.archetypeId}"`);
    }
  }

  const coach = people.personalCoach;
  if (coach) {
    const fits = specialtiesFor(career.position).some((sp) => sp.id === coach.specialty);
    if (!fits) {
      push(
        'coach_position_mismatch',
        `a ${coach.specialty} specialist is coaching a ${career.position}`,
      );
    }
  }

  for (const memory of career.memories) {
    if (memory.personId && !ids.has(memory.personId)) {
      push('memory_unknown_person', `memory ${memory.kind} references unknown person ${memory.personId}`);
    }
  }
}

/** True when nothing in the career contradicts anything else. */
export function isCareerConsistent(career: Career): boolean {
  return validateCareerIntegrity(career).length === 0;
}

/** Grouped counts, for the debug panel. */
export function integritySummary(career: Career): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of validateCareerIntegrity(career)) out[v.code] = (out[v.code] ?? 0) + 1;
  return out;
}

/** Maccabi is the club this whole model is about; exported for callers that need the id. */
export const INTEGRITY_MACCABI_ID = MACCABI_ID;

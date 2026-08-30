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

import { seasonFixtures } from './leagueTruth';
import { MACCABI_ID } from '../data/clubs';
import { ACHIEVEMENT_DEFS } from '../data/achievements';
import { hasDerby } from '../data/rivalries';
import { AGENT_ARCHETYPES, COACH_SPECIALTIES, MANAGER_ARCHETYPES, specialtiesFor } from '../data/people';
import { leagueShape } from '../data/leagueShape';
import { stageOrder } from '../data/academy';
import {
  LEGACY_MILESTONES,
  maccabiLegacyFacts,
  maccabiLegacyRank,
  maccabiLegacyScore,
} from './maccabiLegacy';
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
  | 'memory_unknown_person'
  /* ---------- v0.5.1 ---------- */
  /** a bond in a history list was never closed - history is closed relationships. */
  | 'open_bond_history'
  /** representation exists at a stage that cannot have it. */
  | 'agent_before_eligible_stage'
  /** the current manager's tenure opens after the current season. */
  | 'manager_tenure_from_future'
  /** a club-manager record claims to have been seen in a season yet to happen. */
  | 'club_manager_seen_in_future'
  /* ---------- v0.6: Maccabi Legacy ---------- */
  /** a legacy milestone id appears twice in the announced ledger. */
  | 'duplicate_legacy_milestone'
  /** a milestone was announced whose threshold the career never actually crossed. */
  | 'milestone_before_threshold'
  /** the legacy score left its bounds or stopped being a number. */
  | 'legacy_score_out_of_bounds'
  /** the symbol rank without the football that defines it. */
  | 'symbol_without_contribution'
  /** the derived Maccabi facts disagree with the v0.4.8 counters they must equal. */
  | 'legacy_facts_counter_mismatch'
  /* ---------- v0.6.2: derby and cup ---------- */
  /** a derby honour on the record of a career whose clubs never had a modelled local rival. */
  | 'derby_claim_without_rival'
  /** a cup trophy for a season whose authoritative cup state did not produce one. */
  | 'cup_trophy_without_cup_win'
  /** the cup state says the club won and the competition recorded is a different one. */
  | 'cup_trophy_kind_mismatch'
  /** cup state carried for a season or a club it does not belong to. */
  | 'cup_state_out_of_scope';

export interface IntegrityViolation {
  code: IntegrityCode;
  /** The season it belongs to, where the violation is season-scoped. */
  season?: number;
  detail: string;
}

/**
 * How many matches a club could plausibly have played that season, with headroom for cups.
 *
 * v0.6.5.2: from the league the season was played in. Using the club's current schedule made
 * the validator's ceiling move with promotion - a legitimate 34-game top-flight season could be
 * flagged as impossible once the club was relegated to a shorter division.
 */
function plausibleFixtures(record: SeasonRecord): number {
  try {
    return seasonFixtures(record) + 12;
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
        return seasonFixtures(record);
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

  /* ---------------- Maccabi Legacy (v0.6, Phase 47) ---------------- */
  validateLegacy(career, push);

  /* ---------------- derby and cup (v0.6.2) ---------------- */
  validateDerbyAndCup(career, push);

  return out;
}

/**
 * Derby and cup coherence (v0.6.2).
 *
 * Both checks exist because a career shipped that held a derby honour without a derby and a cup
 * final without a cup. Neither was reachable through a *rule* - they were reachable because
 * nothing joined the honour to the fact it was named after.
 */
function validateDerbyAndCup(
  career: Career,
  push: (code: IntegrityCode, detail: string, season?: number) => void,
): void {
  /*
   * A derby honour requires a club that has one.
   *
   * Checked against every club the career has actually played senior football for, not just the
   * current one - a derby memory from four clubs ago is legitimate, and the current club having no
   * rival says nothing about it. Only a career that never once played for a club with a modelled
   * local rival can be certain the honour is false, and that is the case the reported bug was.
   */
  const derbyHonours = [
    ...career.achievements
      .filter((a) => derbyAchievementIds.has(a.id))
      .map((a) => `achievement ${a.id}`),
    ...career.memories.filter((m) => m.kind.includes('derby')).map((m) => `memory ${m.kind}`),
  ];
  if (derbyHonours.length > 0) {
    const clubs = new Set(career.seasonHistory.map((r) => r.clubId));
    clubs.add(career.currentClubId);
    const everHadRival = [...clubs].some((id) => hasDerby(id));
    if (!everHadRival) {
      push(
        'derby_claim_without_rival',
        `${derbyHonours.join(', ')} on a career whose clubs have no modelled local rival`,
      );
    }
  }

  /*
   * The cup state is season- and club-scoped. Carrying one that belongs to another season or
   * another club is how a stale fact starts answering questions it has no business answering, so
   * it is a violation in its own right rather than something `currentCup` quietly filters out.
   */
  const cup = career.world.cup;
  if (cup && !career.retired) {
    if (cup.season !== career.currentSeason) {
      push(
        'cup_state_out_of_scope',
        `cup state is for ${cup.season}, career is in ${career.currentSeason}`,
      );
    } else if (cup.clubId !== career.currentClubId) {
      push(
        'cup_state_out_of_scope',
        `cup state is for ${cup.clubId}, player is at ${career.currentClubId}`,
      );
    }
  }

  /*
   * A cup trophy for the CURRENT season must match the current cup state. Earlier seasons cannot
   * be checked - only one cup state is carried, by design - but the current season is where a
   * disagreement would actually be visible to the player, and it is the season an event could
   * still be contradicting.
   */
  const cupThisSeason = career.trophies.filter(
    (t) => t.season === career.currentSeason && CUP_TROPHY_IDS.includes(t.id),
  );
  if (cupThisSeason.length > 0 && cup && cup.season === career.currentSeason) {
    if (cup.run !== 'winners') {
      push(
        'cup_trophy_without_cup_win',
        `a ${cupThisSeason[0]!.id} recorded in a season the cup state ended at ${cup.run}`,
        career.currentSeason,
      );
    } else if (!cupThisSeason.some((t) => t.id === cup.trophyId)) {
      push(
        'cup_trophy_kind_mismatch',
        `cup state won a ${cup.trophyId}, trophy list holds ${cupThisSeason.map((t) => t.id).join(', ')}`,
        career.currentSeason,
      );
    }
  }
}

/** Achievement ids that claim a derby, taken from the typed catalogue rather than from names. */
const derbyAchievementIds = new Set(
  ACHIEVEMENT_DEFS.filter((a) => a.category === 'derby').map((a) => a.id),
);

/**
 * The legacy invariants (v0.6).
 *
 * The legacy module re-derives everything from season records, so the deepest check here is
 * agreement: the derivation must equal the v0.4.8 counters that are themselves validated
 * against the trophy list. Two independent derivations agreeing is how "one truth" is proven
 * rather than assumed.
 */
function validateLegacy(
  career: Career,
  push: (code: IntegrityCode, detail: string, season?: number) => void,
): void {
  const announced = career.legacyMilestones ?? [];
  if (new Set(announced).size !== announced.length) {
    push('duplicate_legacy_milestone', `announced ledger holds duplicates: ${announced.join(',')}`);
  }
  for (const id of announced) {
    const def = LEGACY_MILESTONES.find((m) => m.id === id);
    if (def && !def.due(career)) {
      push('milestone_before_threshold', `${id} announced but its threshold is not met`);
    }
  }

  const score = maccabiLegacyScore(career);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    push('legacy_score_out_of_bounds', `legacy score is ${score}`);
  }

  const facts = maccabiLegacyFacts(career);
  if (maccabiLegacyRank(career) === 'symbol') {
    if (facts.appearances < 340 || facts.captainSeasons < 3 || facts.championships < 3) {
      push(
        'symbol_without_contribution',
        `symbol rank with ${facts.appearances} apps, ${facts.captainSeasons} captain seasons, ${facts.championships} titles`,
      );
    }
  }

  /*
   * The agreement check: legacy derives championships/cups from the trophy list directly; the
   * v0.4.8 counters are recomputed from the same list at settlement. If these ever diverge, a
   * derivation drifted - which is the entire class of bug this game's last three versions
   * removed.
   */
  if (facts.championships !== career.maccabi.championships) {
    push(
      'legacy_facts_counter_mismatch',
      `legacy derives ${facts.championships} championships, counter holds ${career.maccabi.championships}`,
    );
  }
  if (facts.cups !== career.maccabi.cups) {
    push(
      'legacy_facts_counter_mismatch',
      `legacy derives ${facts.cups} cups, counter holds ${career.maccabi.cups}`,
    );
  }
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
    ...Object.values(people.clubManagers).map((r) => r.person),
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

  /* ---------------- v0.5.1 ---------------- */

  /*
   * Every history list holds ENDED relationships. An open bond sitting in history means a
   * closing path forgot to stamp it, which is how a person quietly exists twice.
   */
  for (const bond of people.agentHistory) {
    if (bond.endedSeason === undefined) {
      push('open_bond_history', `agent ${bond.person.id} sits in history without an end season`);
    }
  }
  for (const bond of people.personalCoachHistory) {
    if (bond.endedSeason === undefined) {
      push('open_bond_history', `coach ${bond.person.id} sits in history without an end season`);
    }
  }

  /*
   * Representation is stage-gated (v0.5 Phase 6), so an agent on a child is an eligibility
   * violation rather than merely odd. Checked against the stage the bond STARTED at where that
   * is knowable - a senior player who signed at נערים א׳ is correct, not a violation.
   */
  if (people.agent && stageOrder(career.academyStage) < stageOrder('youth_a')) {
    push(
      'agent_before_eligible_stage',
      `an agent exists at ${career.academyStage}, below the נערים א׳ eligibility floor`,
    );
  }

  // Time only runs forwards.
  if (people.manager && people.manager.fromSeason > career.currentSeason) {
    push(
      'manager_tenure_from_future',
      `the current tenure opens in ${people.manager.fromSeason}, after ${career.currentSeason}`,
    );
  }
  for (const [clubId, record] of Object.entries(people.clubManagers)) {
    if (record.lastSeenSeason > career.currentSeason) {
      push(
        'club_manager_seen_in_future',
        `${clubId}'s manager was last seen in ${record.lastSeenSeason}, after ${career.currentSeason}`,
      );
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

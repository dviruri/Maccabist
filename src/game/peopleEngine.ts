/**
 * The people around the career (v0.5).
 *
 * Three kinds of person - the club manager, the agent, the personal coach - built on one rule
 * carried over from v0.4.8: people may MODIFY probabilities and relationships, and may never
 * create facts. An agent shifts which eligible doors are likely to open; he cannot build a door.
 * A manager shapes minutes and trust; he cannot invent an appearance. A personal coach bends
 * development toward what is already there; he NEVER touches hidden Potential.
 *
 * DETERMINISM: person generation draws from a rng derived by hashing (career seed, person
 * sequence, context) rather than from the flowing career rng. Two reasons. First, the same save
 * must produce the same people after any load, and a derived stream cannot be perturbed by
 * unrelated draws. Second, people are created inside `moveToClub`, which has no rng parameter -
 * and threading one through every caller would touch half the engine for no gameplay gain.
 * `hydrateCareer` set the precedent in v0.4.6: seeded from stable state, never advancing it.
 *
 * TRUST SCOPING (Phase 15): `career.coachTrust` IS the relationship with the current manager.
 * There is no second copy on the tenure object; the number is snapshotted into `finalTrust` only
 * when the relationship ends. The v0.4 engine already scoped the *number* correctly - trust is
 * recomputed on every move and drifts to baseline on every coach change - so v0.5 attaches the
 * missing thing, which is the person.
 */

import { getClub } from '../data/clubs';
import {
  AGENT_ARCHETYPES,
  type AgentArchetype,
  type ManagerArchetype,
  COACH_SPECIALTIES,
  DEFAULT_NAME_COUNTRY,
  MANAGER_ARCHETYPES,
  namePoolFor,
  specialtiesFor,
} from '../data/people';
import { stageOrder } from '../data/academy';
import { clamp, createRng, type Rng } from './random';
import { RECOVERY } from './balance';
import { levelContext } from './rules';
import type {
  AgentArchetypeId,
  ClubManagerRecord,
  ExpectedRole,
  AgentBond,
  Career,
  Club,
  CoachSpecialtyId,
  ManagerArchetypeId,
  ManagerTenure,
  PeopleState,
  PersonIdentity,
  PersonType,
  PersonalCoachBond,
} from '../types';

/* ------------------------------------------------------------------ */
/* Derived randomness                                                  */
/* ------------------------------------------------------------------ */

/** Small stable string hash, for mixing club ids into a seed. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A private rng for one person-generation moment. Never the career's own stream. */
function personRng(career: Career, salt: string): Rng {
  const seq = career.people?.personSeq ?? 0;
  return createRng((career.seed ^ hashString(salt)) + seq * 7919 + career.currentSeason);
}

/**
 * A derived rng for callers that need seeded randomness but have no rng in hand (v0.5.1).
 *
 * `moveToClub` is the reason this is exported: it is pure over (career, clubId) with no rng
 * parameter, and threading one through every call site would touch half the engine. Derived
 * from stable state, so the same save always produces the same answer, and it never advances
 * `rngState` - nothing downstream shifts because a manager's opinion was computed.
 */
export function rngFor(career: Career, salt: string): Rng {
  return personRng(career, salt);
}

/* ------------------------------------------------------------------ */
/* Person generation (Phase 1)                                         */
/* ------------------------------------------------------------------ */

function generatePerson(
  career: Career,
  type: PersonType,
  archetypeId: string,
  country: string,
  salt: string,
): PersonIdentity {
  const rng = personRng(career, salt);
  const pool = namePoolFor(country);
  const first = rng.pick(pool.first);
  const last = rng.pick(pool.last);
  const seq = (career.people?.personSeq ?? 0) + 1;
  return {
    id: `p${seq}_${type}`,
    type,
    name: `${first} ${last}`,
    shortName: last,
    archetypeId,
    createdSeason: career.currentSeason,
    country,
  };
}

/** Bump the sequence alongside every generated person, so ids never collide. */
function withNewPerson(people: PeopleState): PeopleState {
  return { ...people, personSeq: people.personSeq + 1 };
}

/* ------------------------------------------------------------------ */
/* Manager archetype assignment (Phases 13, 33)                        */
/* ------------------------------------------------------------------ */

/**
 * Who would be managing this club, if the player walked in right now? (v0.5.2)
 *
 * ONE resolution, used by the transfer preview AND by the arrival that follows it. v0.5.1 had
 * two: `offerHints` read the club's REMEMBERED manager, while `installManager` separately asked
 * whether that man had survived the player's absence and generated a successor when he had not.
 * So an offer to a former club could promise "מאמן: מאמין בצעירים" and deliver a conservative
 * stranger - the game lying to the player at the exact moment he is deciding.
 *
 * Pure. Mutates nothing, records nothing, and never touches the career's rng stream: every draw
 * comes from a hash of (seed, club, season), so asking the question cannot change the answer and
 * cannot change anything else either. That is what makes it safe to call from a preview.
 */
export interface ManagerResolution {
  person: PersonIdentity;
  /**
   * `current`    - he already manages the player's own club right now
   * `remembered` - the player knew him here, and he survived the absence
   * `successor`  - the player knew someone here, and that man has gone
   * `new`        - the player has never been here
   */
  source: 'current' | 'remembered' | 'successor' | 'new';
  previousManagerId?: string;
  turnoverOccurred: boolean;
  /** For the debug trace: how long the club was out of sight. */
  elapsedSeasons: number;
  /** The continuity probability that was tested, 0-1. 1 when nothing was in doubt. */
  continuityChance: number;
}

export function resolveClubManager(
  career: Career,
  clubId: string,
  season: number,
): ManagerResolution {
  // The man in front of him right now needs no resolving.
  const current = career.people?.manager;
  if (current && current.clubId === clubId) {
    return {
      person: current.person,
      source: 'current',
      turnoverOccurred: false,
      elapsedSeasons: 0,
      continuityChance: 1,
    };
  }

  const known = career.people?.clubManagers[clubId];
  if (!known) {
    return {
      person: generateClubManager(career, clubId, stableArchetypeFor(career, clubId), 'first'),
      source: 'new',
      turnoverOccurred: false,
      elapsedSeasons: 0,
      continuityChance: 1,
    };
  }

  const elapsed = Math.max(0, season - known.lastSeenSeason);
  const continuityChance = elapsed <= 0 ? 1 : MANAGER_SEASON_SURVIVAL ** elapsed;
  if (elapsed <= 0 || continuityRng(career, known, season).chance(continuityChance)) {
    return {
      person: known.person,
      source: 'remembered',
      previousManagerId: known.person.id,
      turnoverOccurred: false,
      elapsedSeasons: elapsed,
      continuityChance,
    };
  }

  /*
   * He has gone. The successor's archetype must NOT come from `stableArchetypeFor` - that is a
   * function of (seed, club) alone, so the "new" man would be the same KIND of manager and the
   * turnover would be invisible to the player.
   */
  return {
    person: generateClubManager(career, clubId, successorArchetypeFor(career, clubId, season), `s${season}`),
    source: 'successor',
    previousManagerId: known.person.id,
    turnoverOccurred: true,
    elapsedSeasons: elapsed,
    continuityChance,
  };
}

/**
 * A club manager's identity, derived from (seed, club, slot) and NOTHING ELSE (v0.5.2).
 *
 * Deliberately independent of `personSeq`, unlike agents and personal coaches. Those are created
 * by an act of the player's, so a running sequence is the natural id; a club's manager exists
 * whether or not the player ever meets him. More practically: `personSeq` changes when the
 * player signs an agent, and if it fed this, previewing an offer and then signing an agent
 * before accepting would silently change who is waiting at the other end. Same club, same
 * season, same seed - same man, whatever else the career has done in between.
 */
function generateClubManager(
  career: Career,
  clubId: string,
  archetypeId: ManagerArchetypeId,
  slot: string,
): PersonIdentity {
  const country = safeClub(clubId)?.country ?? DEFAULT_NAME_COUNTRY;
  const rng = createRng(career.seed ^ hashString(`clubmgr:${clubId}:${slot}`));
  const pool = namePoolFor(country);
  const first = rng.pick(pool.first);
  const last = rng.pick(pool.last);
  return {
    id: `mgr_${clubId}_${slot}`,
    type: 'club_manager',
    name: `${first} ${last}`,
    shortName: last,
    archetypeId,
    createdSeason: career.currentSeason,
    country,
  };
}

/** The continuity draw, isolated so preview and commit provably use the same one. */
function continuityRng(career: Career, known: ClubManagerRecord, season: number): Rng {
  return createRng(
    (career.seed ^ hashString(`turnover:${known.person.id}:${known.lastSeenSeason}`)) + season,
  );
}

/**
 * The kind of manager a club hires when the player has never been there.
 *
 * A stable function of (seed, club), weighted by club quality - big clubs skew star-driven and
 * conservative, small clubs youth-minded. Stable is the point: it is what the transfer hint can
 * honestly promise about a club nobody has visited.
 */
function stableArchetypeFor(career: Career, clubId: string): ManagerArchetypeId {
  const club = safeClub(clubId);
  const big = (club?.quality ?? 50) >= 72;
  const weighted: ManagerArchetypeId[] = big
    ? ['star_driven', 'conservative', 'disciplinarian', 'rotation', 'youth_believer', 'short_fuse']
    : ['youth_believer', 'rotation', 'disciplinarian', 'conservative', 'short_fuse', 'star_driven'];
  // First entries are twice as likely as the last two - a tilt, not a rule.
  const bag = [...weighted.slice(0, 3), ...weighted.slice(0, 3), ...weighted];
  const idx = hashString(`${career.seed}:${clubId}:mgr`) % bag.length;
  return bag[idx] ?? 'disciplinarian';
}

/** ...and the kind it hires to replace someone. Season-mixed, so a successor is genuinely new. */
function successorArchetypeFor(
  career: Career,
  clubId: string,
  season: number,
): ManagerArchetypeId {
  const all = Object.keys(MANAGER_ARCHETYPES) as ManagerArchetypeId[];
  const idx = hashString(`${career.seed}:${clubId}:${season}:succ`) % all.length;
  return all[idx] ?? 'disciplinarian';
}

/**
 * The archetype of whoever would be at this club - the one number the transfer hint and the
 * agent's advice both read, so the two can never disagree with each other or with arrival.
 */
export function clubManagerArchetype(career: Career, clubId: string): ManagerArchetypeId {
  return resolveClubManager(career, clubId, career.currentSeason).person
    .archetypeId as ManagerArchetypeId;
}

function safeClub(clubId: string): Club | null {
  try {
    return getClub(clubId);
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ */
/* Tenure helpers (v0.5.1)                                             */
/* ------------------------------------------------------------------ */

function openTenure(person: PersonIdentity, clubId: string, season: number): ManagerTenure {
  return { person, clubId, fromSeason: season };
}

function seenNow(
  person: PersonIdentity,
  installedSeason: number,
  season: number,
): ClubManagerRecord {
  return { person, installedSeason, lastSeenSeason: season };
}

/**
 * Is the manager the player remembers still at that club? (v0.5.1, Priority 2)
 *
 * Clubs the player has left keep managing themselves. v0.5 stored the last-known manager and
 * handed him back unconditionally, so a player who left at 20 and returned at 33 was greeted by
 * the same man thirteen years later - which nobody who has watched football would believe.
 *
 * A survival curve rather than a simulation: each season away is an independent chance the club
 * moved on. 0.74 gives roughly three-quarters continuity after one season, half after two, and
 * under 5% after a decade - close to real managerial tenure, and it answers the brief's two
 * anchors exactly. Deterministic: hashed from (seed, club, season), never the career stream, so
 * the same save always finds the same man on the touchline.
 */
const MANAGER_SEASON_SURVIVAL = 0.74;

export function managerStillThere(
  career: Career,
  record: ClubManagerRecord,
  season: number,
): boolean {
  const elapsed = season - record.lastSeenSeason;
  if (elapsed <= 0) return true; // same season - a loan return, not an absence
  const rng = createRng(
    (career.seed ^ hashString(`turnover:${record.person.id}:${record.lastSeenSeason}`)) + season,
  );
  return rng.chance(MANAGER_SEASON_SURVIVAL ** elapsed);
}

/* ------------------------------------------------------------------ */
/* Manager lifecycle (Phases 12, 15-17, 45)                            */
/* ------------------------------------------------------------------ */

/**
 * Install whoever the resolver says is at the player's current club (v0.5.2).
 *
 * Commit only. Every decision - is the man he remembers still here, who replaced him, what kind
 * of manager the club hires - lives in `resolveClubManager`, which the transfer preview called
 * first. This function's whole job is to write down the answer the player was already shown.
 *
 * Does NOT set trust: callers do, through `initialManagerTrust`, because arrival and a
 * mid-career replacement carry different carryover.
 */
export function installManager(career: Career): Career {
  const people = career.people ?? emptyPeopleState();
  const clubId = career.currentClubId;
  const season = career.currentSeason;

  const resolution = resolveClubManager(career, clubId, season);
  const known = people.clubManagers[clubId];
  const person = resolution.person;

  return {
    ...career,
    people: {
      ...people,
      manager: openTenure(person, clubId, season),
      clubManagers: {
        ...people.clubManagers,
        [clubId]: seenNow(
          person,
          // A manager who was already here keeps the date he actually started.
          known && !resolution.turnoverOccurred ? known.installedSeason : season,
          season,
        ),
      },
    },
  };
}


/**
 * Close the current manager relationship, snapshotting where trust stood (Phase 15).
 *
 * `managerStays` distinguishes "the player left" (the manager remains the club's last-known
 * manager, findable on a return) from "the manager left" (the club needs a new one).
 */
export function endManagerTenure(career: Career, managerStays: boolean): Career {
  const people = career.people;
  if (!people?.manager) return career;

  const closed: ManagerTenure = {
    ...people.manager,
    toSeason: career.currentSeason,
    finalTrust: Math.round(career.coachTrust),
  };

  const clubManagers = { ...people.clubManagers };
  if (!managerStays) delete clubManagers[closed.clubId];

  return {
    ...career,
    people: {
      ...people,
      manager: null,
      managerHistory: [...people.managerHistory, closed],
      clubManagers,
    },
  };
}

/**
 * The trust level a coach would land on for this player if he had no history with him:
 * driven by how good he actually is for the level, plus a little credit for years served.
 *
 * This is what stops the trust spiral. Previously a bad spell cut minutes, which cut
 * development, which cut trust again, with no floor - a single bad run could quietly end a
 * career. Now a genuinely good player pulls back towards where he belongs.
 */
export function coachTrustBaseline(career: Career): number {
  const level = levelContext(career);
  const edge = career.ability - level.quality;
  const seasons = Math.min(career.maccabi.seasons, RECOVERY.baselineSeasonsCap);
  /*
   * v0.5, Phase 16: the current manager's archetype tilts where trust settles - a youth believer
   * anchors a teenager higher, a star-driven manager reads reputation into everything. A tilt on
   * the equilibrium the existing terms already compute, never a replacement for them.
   */
  return clamp(
    RECOVERY.baselineAnchor +
      edge * RECOVERY.baselineAbilityWeight +
      seasons * RECOVERY.baselineSeasonsWeight +
      managerBaselineDelta(career),
  );
}

/**
 * Open a brand-new manager relationship (v0.5.1).
 *
 * THE ORDER IS THE POINT. This is called only after the successor is installed, so
 * `coachTrustBaseline` reads HIS archetype rather than his predecessor's - which is the bug this
 * function exists to make impossible. v0.5 drifted trust toward "baseline" while the outgoing
 * manager was still the current one, so a conservative successor inherited a youth believer's
 * generosity, and the drifted number was then filed as the OLD manager's final trust.
 *
 * What a manager who has never worked with this player can actually see on day one: how good he
 * is for this level, what the dressing room says his standing is, the name that arrived with
 * him, whether he is playing well - and his own temperament. Plus a little uncertainty, because
 * two managers looking at the same player do not land on the same number.
 *
 * Never returns exactly 50, never returns the old value, and never consults the old archetype.
 */
export function initialManagerTrust(
  career: Career,
  rng: Rng,
  options: { goodwill?: number; carryover?: number } = {},
): number {
  const t = RECOVERY.trustInit;
  const baseline = coachTrustBaseline(career);
  const role = (career.roleValue - 50) * t.roleWeight;
  /*
   * One-sided on purpose (v0.5.1). A name that travels ahead of a player HELPS him; being
   * unknown must not hurt, because `coachTrustBaseline` already prices in "we do not know what
   * this boy is yet" through the ability-for-level term. Symmetric, this double-counted
   * anonymity: every academy player sits well under reputation 45, so every one of them took a
   * penalty at every manager change - measured as Maccabi senior rate 64.6% -> 59.9% and ten
   * fewer Maccabi appearances a career, because academy promotion reads Coach Trust.
   */
  const reputation = Math.max(0, career.reputation - 45) * t.reputationWeight;
  const form = (career.hidden.form - 55) * t.formWeight;
  const carried = (career.coachTrust - 50) * (options.carryover ?? t.carryover);
  const noise = rng.gaussian(0, t.uncertainty);
  return clamp(baseline + role + reputation + form + carried + (options.goodwill ?? 0) + noise);
}

/**
 * The club replaces its manager (Phases 17, v0.5.1 Priority 1).
 *
 * The required flow, in order, because every step depends on the one before:
 *
 *   1. capture the outgoing trust BEFORE anything recalculates
 *   2. close the old relationship with exactly that value
 *   3. install the successor (a different archetype - boards hire the opposite of what failed)
 *   4. only NOW derive the new opinion, with the new man in the chair
 *
 * `maybeChangeCoach` deliberately no longer touches trust at all: it decides whether the club
 * changes manager, and this owns everything that follows from the answer.
 */
export function replaceManager(career: Career, rng: Rng): Career {
  const outgoingArchetype = career.people?.manager?.person.archetypeId;

  // (1) + (2): endManagerTenure snapshots career.coachTrust, which nothing has disturbed.
  let next = endManagerTenure(career, false);

  const all = Object.keys(MANAGER_ARCHETYPES) as ManagerArchetypeId[];
  const candidates = all.filter((a) => a !== outgoingArchetype);
  const archetype = rng.pick(candidates) ?? 'disciplinarian';

  const people = next.people ?? emptyPeopleState();
  const person = generatePerson(
    next,
    'club_manager',
    archetype,
    safeClub(next.currentClubId)?.country ?? DEFAULT_NAME_COUNTRY,
    `mgr-new:${next.currentClubId}:${next.currentSeason}`,
  );
  // (3)
  next = {
    ...next,
    people: {
      ...withNewPerson(people),
      manager: openTenure(person, next.currentClubId, next.currentSeason),
      clubManagers: {
        ...people.clubManagers,
        [next.currentClubId]: seenNow(person, next.currentSeason, next.currentSeason),
      },
    },
  };
  // (4) - the successor's own read, computed with the successor installed.
  return { ...next, coachTrust: initialManagerTrust(next, rng) };
}

/** The current manager's archetype, defaulting to the least opinionated profile. */
export function managerArchetypeOf(career: Career): ManagerArchetype {
  const id = (career.people?.manager?.person.archetypeId ?? 'disciplinarian') as ManagerArchetypeId;
  return MANAGER_ARCHETYPES[id] ?? MANAGER_ARCHETYPES.disciplinarian;
}

/* ------------------------------------------------------------------ */
/* Manager influence (Phases 16, 18)                                   */
/* ------------------------------------------------------------------ */

/**
 * True while the manager would still call him a young player - IN PROFESSIONAL FOOTBALL.
 *
 * Inside the academy the youth modifiers are deliberately inert: every boy in ילדים ב׳ is a
 * youth, so "prefers youth" would collapse into a flat per-seed bonus handed out by the archetype
 * hash - a whole childhood of extra minutes decided by luck, discriminating between nobody.
 * Archetype starts meaning something when there are grown men to be picked ahead of.
 */
function isYouthToManager(career: Career): boolean {
  return career.academyStage === 'senior' && career.age < 21;
}

/**
 * The archetype's contribution to a fresh relationship's starting point (Phase 16).
 *
 * Added to `coachTrustBaseline`'s existing terms - ability for the level, service - so a star
 * arrives relatively trusted and an unknown arrives near neutral, with the archetype tilting
 * rather than deciding.
 */
export function managerBaselineDelta(career: Career): number {
  // Academy coaches are coaching children; the professional archetypes stay out of it.
  if (career.academyStage !== 'senior') return 0;
  const archetype = managerArchetypeOf(career);
  const youth = isYouthToManager(career) ? archetype.youthTrustDelta : 0;
  const reputation = (career.reputation - 50) * archetype.reputationBias;
  return youth + reputation;
}

/**
 * Scale a trust movement by the manager's temperament (Phase 18). A short fuse amplifies both
 * directions; a conservative dampens the climb. Applied to the movement, never to the level.
 */
export function scaleTrustMove(career: Career, move: number): number {
  if (career.academyStage !== 'senior') return move;
  const archetype = managerArchetypeOf(career);
  return move * (move >= 0 ? archetype.trustGainFactor : archetype.trustLossFactor);
}

/**
 * Would this manager sanction a loan? (v0.5.1, Priority 3)
 *
 * `loanWillingness` has existed on the archetypes since v0.5 and did nothing, which is exactly
 * the "why does my manager attribute exist if it changes nothing?" the brief names. It is a
 * multiplier on the loan CHANCE, applied after the existing eligibility gate has already said
 * yes - eligibility stays authoritative and a manager can never conjure a loan for a player the
 * rules do not allow to have one.
 *
 * The archetype is also read in context rather than flatly: a rotation manager who is actually
 * planning to use this player is more reluctant to let him go than the same manager would be
 * about a player buried at the bottom of his squad. That is the Scenario E distinction - the
 * manager wants him, so the loan is less likely, without ever becoming impossible.
 */
export function managerLoanFactor(career: Career): number {
  if (career.academyStage !== 'senior') return 1;
  const archetype = managerArchetypeOf(career);
  let factor = archetype.loanWillingness;
  // Someone he has plans for is someone he would rather keep.
  if (career.roleValue >= 45) factor *= 0.8;
  return factor;
}

/**
 * The manager's effect on minutes (Phase 18). Combines with everything the minutes model
 * already weighs - it must never dictate selection, so the range is deliberately narrow.
 */
export function managerMinutesFactor(career: Career): number {
  // See `isYouthToManager`: inside the academy the archetype has nobody to prefer anyone over.
  if (career.academyStage !== 'senior') return 1;
  const archetype = managerArchetypeOf(career);
  let factor = 1;
  if (isYouthToManager(career)) factor *= archetype.youthMinutesFactor;
  // A rotation manager spreads minutes toward the fringe; a settled starter loses a little.
  if (archetype.rotationFactor > 1) {
    factor *= career.roleValue < 45 ? 1 + (archetype.rotationFactor - 1) : 0.97;
  }
  return factor;
}

/* ------------------------------------------------------------------ */
/* Agent lifecycle (Phases 3-7, 11)                                    */
/* ------------------------------------------------------------------ */

/**
 * When agents become possible (Phase 6): interest from נערים א׳, driven by stage - never by a
 * numeric age check, per the cohort model's standing rule.
 */
export function agentEligible(career: Career): boolean {
  return stageOrder(career.academyStage) >= stageOrder('youth_a');
}

/** Whether this archetype would take the player on - reputation opens doors (Phase 3). */
export function archetypeAvailable(career: Career, id: AgentArchetypeId): boolean {
  return agentEligible(career) && career.reputation >= AGENT_ARCHETYPES[id].reputationThreshold;
}

/** Sign with a new agent. Ends the old bond honestly if one exists (Phase 11). */
export function signAgent(career: Career, archetypeId: AgentArchetypeId): Career {
  const people = career.people ?? emptyPeopleState();
  const person = generatePerson(
    career,
    'agent',
    archetypeId,
    DEFAULT_NAME_COUNTRY,
    `agent:${archetypeId}`,
  );
  const bond: AgentBond = {
    person,
    // A new representation starts warm - he chose you too - but not devoted.
    relationship: 62,
    sinceSeason: career.currentSeason,
    advicesFollowed: 0,
    advicesRejected: 0,
  };
  const ended = people.agent
    ? [...people.agentHistory, { ...people.agent, endedSeason: career.currentSeason }]
    : people.agentHistory;
  return {
    ...career,
    people: { ...withNewPerson(people), agent: bond, agentHistory: ended },
  };
}

/** Part ways with the current agent without a successor. */
export function dropAgent(career: Career): Career {
  const people = career.people;
  if (!people?.agent) return career;
  return {
    ...career,
    people: {
      ...people,
      agent: null,
      agentHistory: [...people.agentHistory, { ...people.agent, endedSeason: career.currentSeason }],
    },
  };
}

/** Move the agent relationship, clamped. Zero-delta calls are free. */
export function adjustAgentRelationship(career: Career, delta: number): Career {
  const people = career.people;
  if (!people?.agent || !delta) return career;
  const relationship = Math.max(0, Math.min(100, people.agent.relationship + delta));
  return { ...career, people: { ...people, agent: { ...people.agent, relationship } } };
}

/** Record that advice was followed or ignored, for later honest callbacks (Phase 39). */
export function recordAdvice(career: Career, followed: boolean): Career {
  const people = career.people;
  if (!people?.agent) return career;
  const agent = followed
    ? { ...people.agent, advicesFollowed: people.agent.advicesFollowed + 1 }
    : { ...people.agent, advicesRejected: people.agent.advicesRejected + 1 };
  return { ...career, people: { ...people, agent } };
}

export function agentArchetypeOf(career: Career): AgentArchetype | null {
  const id = career.people?.agent?.person.archetypeId as AgentArchetypeId | undefined;
  return id ? AGENT_ARCHETYPES[id] ?? null : null;
}

/* ------------------------------------------------------------------ */
/* Agent influence on the market (Phase 8)                             */
/* ------------------------------------------------------------------ */

/*
 * The one rule: these functions return WEIGHT FACTORS applied inside the existing pipeline,
 * after eligibility has already been decided. An agent factor of 0 never occurs - a poorly
 * connected market is less likely, not closed - and no factor creates a candidate that the
 * world's own rules did not.
 */

/** Multiplier on a candidate club's interest weight, from the agent's actual markets. */
export function agentMarketFactor(career: Career, club: Club): number {
  const archetype = agentArchetypeOf(career);
  if (!archetype) return 1;
  return archetype.markets.includes(club.country) ? archetype.marketBoost : archetype.elseFactor;
}

/** Multiplier on the chance an offer arrives at all. No agent means the market as it was. */
export function agentOfferFactor(career: Career): number {
  return agentArchetypeOf(career)?.offerFrequency ?? 1;
}

/** Multiplier on the loan-offer chance - the networker's speciality (Phase 35). */
export function agentLoanFactor(career: Career): number {
  return agentArchetypeOf(career)?.loanFactor ?? 1;
}

/**
 * Expected-role negotiation (Phase 8.2). One step, occasionally, and only when football makes it
 * plausible: the player's ability must sit near the destination's level, because no agent talks a
 * backup into a star's shirt. Returns the (possibly) improved role.
 */
export function negotiateExpectedRole(
  career: Career,
  club: Club,
  offered: ExpectedRole,
  rng: Rng,
): ExpectedRole {
  const archetype = agentArchetypeOf(career);
  if (!archetype) return offered;
  // Only the middle of the ladder is negotiable. A project is a plan, not a role, and key/star
  // status is earned on the pitch - no meeting talks a backup into a star's shirt.
  if (offered !== 'backup' && offered !== 'rotation') return offered;
  const plausible = career.ability >= club.quality - 4;
  if (!plausible) return offered;
  if (!rng.chance(archetype.negotiation)) return offered;
  return offered === 'backup' ? 'rotation' : 'starter';
}

/* ------------------------------------------------------------------ */
/* Personal coach (Phases 21-26)                                       */
/* ------------------------------------------------------------------ */

/** Begin working with a specialist. Position fit is validated here, fail-closed (Phase 24). */
export function startPersonalCoach(career: Career, specialty: CoachSpecialtyId): Career {
  const fits = specialtiesFor(career.position).some((s) => s.id === specialty);
  if (!fits) return career;

  const people = career.people ?? emptyPeopleState();
  const person = generatePerson(
    career,
    'personal_coach',
    specialty,
    DEFAULT_NAME_COUNTRY,
    `coach:${specialty}`,
  );
  const bond: PersonalCoachBond = {
    person,
    specialty,
    sinceSeason: career.currentSeason,
    seasonsTogether: 0,
  };
  const ended = people.personalCoach
    ? [
        ...people.personalCoachHistory,
        { ...people.personalCoach, endedSeason: career.currentSeason },
      ]
    : people.personalCoachHistory;
  return {
    ...career,
    people: { ...withNewPerson(people), personalCoach: bond, personalCoachHistory: ended },
  };
}

export function endPersonalCoach(career: Career): Career {
  const people = career.people;
  if (!people?.personalCoach) return career;
  return {
    ...career,
    people: {
      ...people,
      personalCoach: null,
      personalCoachHistory: [
        ...people.personalCoachHistory,
        { ...people.personalCoach, endedSeason: career.currentSeason },
      ],
    },
  };
}

/**
 * The specialist's development contribution for half a season (Phase 23).
 *
 * Diminishing on ability (Phase 23.1): a developing player gets the full edge, a made one gets
 * scraps - the specialist helps a player approach what is already in him, and NOTHING here reads
 * or writes hidden Potential. The number is a small addition to the existing growth model,
 * bounded well below one season's ordinary development.
 */
export function personalCoachDevBonus(career: Career): number {
  const bond = career.people?.personalCoach;
  if (!bond) return 0;
  const spec = COACH_SPECIALTIES[bond.specialty];
  if (spec.positions.length > 0 && !spec.positions.includes(career.position)) return 0;

  // Only the skill-facing specialties develop ability; mental and fitness work elsewhere.
  if (bond.specialty === 'mental' || bond.specialty === 'fitness') return 0;

  const headroom = Math.max(0, (84 - career.ability) / 44);
  return 0.3 * headroom;
}

/** Confidence/form recovery help - the mental coach's actual job (Phase 23). */
export function personalCoachRecoveryBonus(career: Career): number {
  const bond = career.people?.personalCoach;
  if (!bond) return 0;
  return bond.specialty === 'mental' ? 2.2 : 0;
}

/** The fitness coach lowers injury pressure a little. Never to zero - football is football. */
export function personalCoachInjuryRelief(career: Career): number {
  const bond = career.people?.personalCoach;
  if (!bond) return 0;
  return bond.specialty === 'fitness' ? 2.5 : 0;
}

/* ------------------------------------------------------------------ */
/* Season upkeep                                                       */
/* ------------------------------------------------------------------ */

/** Once-a-season people bookkeeping: coach tenure counters, a slow loyalty tick. */
export function advancePeopleSeason(career: Career): Career {
  const people = career.people;
  if (!people) return career;

  let next = career;
  if (people.personalCoach) {
    next = {
      ...next,
      people: {
        ...people,
        personalCoach: {
          ...people.personalCoach,
          seasonsTogether: people.personalCoach.seasonsTogether + 1,
        },
      },
    };
  }
  // Years together warm a representation slightly. Events move it; time only settles it.
  if (next.people?.agent && next.people.agent.relationship < 70) {
    next = adjustAgentRelationship(next, 1);
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* State construction and migration (Phases 48-49)                     */
/* ------------------------------------------------------------------ */

export function emptyPeopleState(): PeopleState {
  return {
    manager: null,
    managerHistory: [],
    agent: null,
    agentHistory: [],
    personalCoach: null,
    personalCoachHistory: [],
    clubManagers: {},
    personSeq: 0,
  };
}

/**
 * Build people state for a career that has none (Phase 49: every v0.4.8 save must load).
 *
 * The one migration that matters: the current Coach Trust already IS a relationship with
 * somebody - the player just never knew his name. So the manager is instantiated and the
 * existing trust number becomes his, unchanged. No agent and no personal coach are invented,
 * because the save does not know of any (Phase 49: "set no personal coach unless safely known").
 * Deterministic: person generation hashes from the seed, and nothing rolls.
 */
export function migratePeople(career: Career): Career {
  if (career.people) return migrateClubManagerRecords(career);
  const withState = { ...career, people: emptyPeopleState() };
  return installManager(withState);
}

/* ------------------------------------------------------------------ */
/* Who is this event about? (Phase 30)                                 */
/* ------------------------------------------------------------------ */

/**
 * The person at the centre of a people event, resolved from career state by event-id family.
 *
 * This is how a recurring character stays recognisable: the event TEXT says "הסוכן שלך", and the
 * header names him - from the one place his name lives. Returns null when the event is about
 * someone the player does not have yet (the first-representation approaches), because a header
 * naming a person who does not exist would be the UI inventing a fact.
 */
export function eventPerson(
  career: Career,
  eventId: string,
): { person: PersonIdentity; role: 'manager' | 'agent' | 'personal_coach' } | null {
  if (!eventId.startsWith('ppl_')) return null;
  const people = career.people;
  if (!people) return null;

  if (eventId.startsWith('ppl_mgr_')) {
    return people.manager ? { person: people.manager.person, role: 'manager' } : null;
  }
  if (eventId.startsWith('ppl_pc_') || eventId.startsWith('ppl_cross_pc')) {
    return people.personalCoach
      ? { person: people.personalCoach.person, role: 'personal_coach' }
      : null;
  }
  return people.agent ? { person: people.agent.person, role: 'agent' } : null;
}

/**
 * v0.5 stored `clubManagers` as bare `PersonIdentity`; v0.5.1 needs the dates that make
 * off-screen continuity decidable. A v0.5 save is upgraded in place on load.
 *
 * `createdSeason` is the honest stand-in for both dates: it is when that person came into
 * existence, which for a club manager is when the player met him. Erring toward "recently seen"
 * is the conservative choice - it makes the first post-migration return slightly more likely to
 * find the same man, rather than retiring managers the save never said had left.
 */
function migrateClubManagerRecords(career: Career): Career {
  const people = career.people;
  if (!people) return career;

  const entries = Object.entries(people.clubManagers);
  const stale = entries.filter(([, v]) => (v as { person?: unknown }).person === undefined);
  if (stale.length === 0) return career;

  const clubManagers: Record<string, ClubManagerRecord> = {};
  for (const [clubId, value] of entries) {
    const asRecord = value as unknown as ClubManagerRecord;
    if (asRecord.person !== undefined) {
      clubManagers[clubId] = asRecord;
      continue;
    }
    const person = value as unknown as PersonIdentity;
    clubManagers[clubId] = {
      person,
      installedSeason: person.createdSeason,
      lastSeenSeason: person.createdSeason,
    };
  }
  return { ...career, people: { ...people, clubManagers } };
}

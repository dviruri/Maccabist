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
import { createRng, type Rng } from './random';
import type {
  AgentArchetypeId,
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
 * Which archetype manages a given club, for this career.
 *
 * Pure and seed-stable, so the transfer screen's "מאמן: מאמין בצעירים" hint and the manager the
 * player actually meets on arrival are the SAME fact read twice (Phase 33). A stored manager in
 * `clubManagers` overrides this - that is what turnover writes.
 *
 * Weighted by club quality: big clubs skew star-driven and conservative, small clubs skew
 * youth-minded - a real pattern, and it makes destination choice matter.
 */
export function clubManagerArchetype(career: Career, clubId: string): ManagerArchetypeId {
  const stored = career.people?.clubManagers[clubId];
  if (stored) return stored.archetypeId as ManagerArchetypeId;

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

function safeClub(clubId: string): Club | null {
  try {
    return getClub(clubId);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Manager lifecycle (Phases 12, 15-17, 45)                            */
/* ------------------------------------------------------------------ */

/**
 * Install the manager of the player's current club as the current relationship.
 *
 * Reuses the club's remembered manager when the player has met him before (a return can find the
 * same man on the touchline), otherwise generates one. Does NOT set trust - callers do, because
 * arrival trust and coach-change trust follow different existing rules that already work.
 */
export function installManager(career: Career): Career {
  const people = career.people ?? emptyPeopleState();
  const clubId = career.currentClubId;

  const known = people.clubManagers[clubId];
  const person =
    known ??
    generatePerson(
      career,
      'club_manager',
      clubManagerArchetype(career, clubId),
      safeClub(clubId)?.country ?? DEFAULT_NAME_COUNTRY,
      `mgr:${clubId}`,
    );

  const tenure: ManagerTenure = {
    person,
    clubId,
    fromSeason: career.currentSeason,
  };

  const nextPeople: PeopleState = {
    ...(known ? people : withNewPerson(people)),
    manager: tenure,
    clubManagers: { ...people.clubManagers, [clubId]: person },
  };
  return { ...career, people: nextPeople };
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
 * The club replaces its manager (Phase 17). A successor is generated with a fresh archetype -
 * biased away from the outgoing one, because boards hire the opposite of what just failed.
 */
export function replaceManager(career: Career, rng: Rng): Career {
  const outgoingArchetype = career.people?.manager?.person.archetypeId;
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
  const tenure: ManagerTenure = {
    person,
    clubId: next.currentClubId,
    fromSeason: next.currentSeason,
  };
  next = {
    ...next,
    people: {
      ...withNewPerson(people),
      manager: tenure,
      clubManagers: { ...people.clubManagers, [next.currentClubId]: person },
    },
  };
  return next;
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
  if (career.people) return career;
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

/**
 * Career memory, story arcs, traits and the senior career phase.
 *
 * All pure lookups over the Career object. This is what lets an event say "only if he
 * struggled when he was pushed up an age group, and at least three seasons ago" without any
 * gameplay code knowing which event wrote that memory.
 *
 * Everything here is O(small): a career accumulates a few dozen memories and at most a
 * handful of arcs, so a linear scan is cheaper than maintaining a derived index across the
 * clone-on-write career object.
 */

import type {
  ActiveArc,
  ArcId,
  ArcRequirement,
  Career,
  CareerMemory,
  MemoryKind,
  SeniorPhase,
  TraitId,
} from '../types';
import { SENIOR_PHASES } from './balance';

/* ------------------------------------------------------------------ */
/* Memory                                                             */
/* ------------------------------------------------------------------ */

export function hasMemory(career: Career, kind: MemoryKind): boolean {
  for (const memory of career.memories) if (memory.kind === kind) return true;
  return false;
}

/** The most recent occurrence of a memory, or null. */
export function lastMemory(career: Career, kind: MemoryKind): CareerMemory | null {
  let latest: CareerMemory | null = null;
  for (const memory of career.memories) {
    if (memory.kind !== kind) continue;
    if (latest === null || memory.season > latest.season) latest = memory;
  }
  return latest;
}

/** Seasons since a memory was recorded, or null if it never happened. */
export function seasonsSinceMemory(career: Career, kind: MemoryKind): number | null {
  const memory = lastMemory(career, kind);
  return memory === null ? null : career.currentSeason - memory.season;
}

export function countMemories(career: Career, kind: MemoryKind): number {
  let count = 0;
  for (const memory of career.memories) if (memory.kind === kind) count += 1;
  return count;
}

/** Appends a memory. Returns the array so callers can assign it onto a cloned career. */
export function recordMemory(career: Career, kind: MemoryKind, detail?: string): CareerMemory[] {
  const memory: CareerMemory = {
    kind,
    season: career.currentSeason,
    age: career.age,
    stage: career.academyStage,
    ...(detail === undefined ? {} : { detail }),
  };
  return [...career.memories, memory];
}

/* ------------------------------------------------------------------ */
/* Story arcs                                                         */
/* ------------------------------------------------------------------ */

export function activeArc(career: Career, id: ArcId): ActiveArc | null {
  for (const arc of career.arcs) if (arc.id === id) return arc;
  return null;
}

export function hasCompletedArc(career: Career, id: ArcId): boolean {
  return career.completedArcs.includes(id);
}

/** Whether the player's arc state satisfies what an event asked for. */
export function matchesArc(career: Career, requirement: ArcRequirement): boolean {
  const arc = activeArc(career, requirement.id);
  if (!arc) return false;
  if (requirement.minStage !== undefined && arc.stage < requirement.minStage) return false;
  if (requirement.maxStage !== undefined && arc.stage > requirement.maxStage) return false;
  if (requirement.branches && !requirement.branches.includes(arc.branch)) return false;
  if (
    requirement.minSeasonsSinceStart !== undefined &&
    career.currentSeason - arc.startedSeason < requirement.minSeasonsSinceStart
  ) {
    return false;
  }
  return true;
}

/**
 * Opens an arc, or re-brands it if it is somehow already open. Returns a new array; the
 * caller assigns it onto a cloned career.
 */
export function startArc(career: Career, id: ArcId, branch: string): ActiveArc[] {
  const existing = activeArc(career, id);
  if (existing) {
    return career.arcs.map((arc) => (arc.id === id ? { ...arc, branch } : arc));
  }
  return [...career.arcs, { id, stage: 1, startedSeason: career.currentSeason, branch }];
}

export function advanceArc(career: Career, id: ArcId, branch?: string): ActiveArc[] {
  return career.arcs.map((arc) =>
    arc.id === id
      ? { ...arc, stage: arc.stage + 1, ...(branch === undefined ? {} : { branch }) }
      : arc,
  );
}

/* ------------------------------------------------------------------ */
/* Traits                                                            */
/* ------------------------------------------------------------------ */

export function hasTrait(career: Career, id: TraitId): boolean {
  for (const trait of career.traits) if (trait.id === id) return true;
  return false;
}

export function revealedTraits(career: Career): TraitId[] {
  return career.traits.filter((t) => t.revealed).map((t) => t.id);
}

/* ------------------------------------------------------------------ */
/* Senior career phase                                                */
/* ------------------------------------------------------------------ */

/**
 * Derived, never stored, so it always reflects the player's actual situation. A 30 year old
 * who has just broken through is still a breakthrough story; a 24 year old with 200 games is
 * not.
 */
export function seniorPhase(career: Career): SeniorPhase {
  const apps = career.stats.appearances;
  const p = SENIOR_PHASES;

  if (career.age >= p.veteranAge || (career.age >= p.veteranAge - 2 && career.roleValue < p.veteranRole)) {
    return 'veteran';
  }
  if (apps < p.breakthroughAppearances && career.age <= p.breakthroughMaxAge) return 'breakthrough';
  if (career.age >= p.primeMinAge && career.roleValue >= p.primeRole) return 'prime';
  return 'established';
}

/**
 * Shared condition matching for events and for individual outcomes.
 * Pure predicate code - no randomness, no state changes.
 */

import { stageBand } from '../data/academy';
import type { Career, ClubScope, EventConditions, SeasonSlot } from '../types';
import {
  allowsExceptionalSeniorContact,
  allowsSeniorContact,
  isSenior,
} from './eligibility';
import {
  canFaceMaccabi,
  crowdResponse,
  maccabiRelationship,
  playedForMaccabi,
} from './maccabiEngine';
import {
  activeArc,
  hasCompletedArc,
  hasMemory,
  hasTrait,
  matchesArc,
  seasonsSinceMemory,
  seniorPhase,
} from './memory';
import { isAtMaccabi, isAtMaccabiSenior, isOnLoan, isPlayingAbroad } from './rules';
import {
  clubStrengthVsLeague,
  lastAmbientMaccabiSeason,
  leagueOf,
  maccabiInCrisis,
  maccabiWonTitleWithoutHim,
} from './worldEngine';

export interface ConditionContext {
  /** Appearances the condition should read: this season so far, or last season. */
  appearances: number;
}

export function conditionContext(career: Career, slot: SeasonSlot): ConditionContext {
  if (slot === 'early') {
    return { appearances: career.lastSeasonRecord?.stats.appearances ?? 0 };
  }
  /*
   * Mid and late slots normally read this season's first half. But the whole season is *planned*
   * at preseason, when `firstHalfStats` is still null - so read as written, every mid/late event
   * with a `minLastAppearances` floor was evaluated against zero appearances and could never be
   * planned at all. Falling back to last season is the honest answer at planning time: the
   * question these conditions ask is "is this player playing regularly?", and in August last
   * season is the only evidence there is.
   */
  const firstHalf = career.firstHalfStats?.appearances;
  if (firstHalf !== undefined) return { appearances: firstHalf };
  return { appearances: career.lastSeasonRecord?.stats.appearances ?? 0 };
}

function between(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Whether the player's club situation matches an event's declared scope (v0.3.1).
 *
 * Playtesting found Maccabi-specific events firing at other clubs - the green stand singing
 * your name while you play for Hapoel Afula. Declaring the scope explicitly is what stops it,
 * and the event-audit test enforces that anything naming Maccabi declares one.
 */
export function matchesClubScope(career: Career, scope: ClubScope): boolean {
  switch (scope) {
    case 'maccabi':
      return isAtMaccabi(career);
    case 'nonMaccabi':
      return !isAtMaccabi(career);
    case 'abroad':
      return isPlayingAbroad(career);
    case 'formerMaccabi':
      // Has a Maccabi past, but is somewhere else now.
      return (
        !isAtMaccabi(career) &&
        (career.maccabi.everLeft ||
          career.maccabi.academyGraduate ||
          career.maccabi.appearances > 0 ||
          career.flags.includes('released_by_maccabi'))
      );
    case 'currentClub':
    case 'any':
      return true;
    default:
      return true;
  }
}

export function matchesConditions(
  career: Career,
  c: EventConditions | undefined,
  ctx: ConditionContext,
): boolean {
  if (!c) return true;

  if (!between(career.age, c.minAge, c.maxAge)) return false;
  if (c.stages && !c.stages.includes(career.academyStage)) return false;
  if (c.bands && !c.bands.includes(stageBand(career.academyStage))) return false;
  if (c.positions && !c.positions.includes(career.position)) return false;
  if (c.notPositions && c.notPositions.includes(career.position)) return false;

  if (!between(career.ability, c.minAbility, c.maxAbility)) return false;
  if (c.minPotential !== undefined && career.hidden.potential < c.minPotential) return false;
  if (!between(career.maccabism, c.minMaccabism, c.maxMaccabism)) return false;
  if (!between(career.reputation, c.minReputation, c.maxReputation)) return false;
  if (!between(career.coachTrust, c.minCoachTrust, c.maxCoachTrust)) return false;
  if (!between(career.hidden.form, c.minForm, c.maxForm)) return false;
  if (!between(career.hidden.confidence, c.minConfidence, c.maxConfidence)) return false;
  if (!between(career.roleValue, c.minRoleValue, c.maxRoleValue)) return false;
  if (c.roles && !c.roles.includes(career.role)) return false;
  if (c.olderGroup && !c.olderGroup.includes(career.olderGroup)) return false;

  if (c.atMaccabi !== undefined && isAtMaccabi(career) !== c.atMaccabi) return false;
  if (c.atMaccabiSenior !== undefined && isAtMaccabiSenior(career) !== c.atMaccabiSenior) return false;
  if (c.abroad !== undefined && isPlayingAbroad(career) !== c.abroad) return false;
  if (c.onLoan !== undefined && isOnLoan(career) !== c.onLoan) return false;
  if (c.clubScope && !matchesClubScope(career, c.clubScope)) return false;
  if (c.isCaptain !== undefined && career.captain !== c.isCaptain) return false;
  if (c.hasLeftMaccabi !== undefined && career.maccabi.everLeft !== c.hasLeftMaccabi) return false;

  /* ---------- v0.4: standing with Maccabi ---------- */
  // Derived, never stored, so these stay correct for saves made before the system existed.
  if (c.maccabiRelationship && !c.maccabiRelationship.includes(maccabiRelationship(career))) {
    return false;
  }
  if (c.crowdResponse && !c.crowdResponse.includes(crowdResponse(career))) return false;
  if (c.playedForMaccabi !== undefined && playedForMaccabi(career) !== c.playedForMaccabi) {
    return false;
  }
  if (c.canFaceMaccabi !== undefined && canFaceMaccabi(career) !== c.canFaceMaccabi) return false;

  /* ---------- v0.4.1: the ambient Maccabi world ---------- */
  if (c.maccabiSeasonOutcome) {
    // The ambient list only: these conditions are about what the club did without him.
    const last = lastAmbientMaccabiSeason(career);
    if (!last || !c.maccabiSeasonOutcome.includes(last.outcome)) return false;
  }
  if (
    c.maccabiWonWithoutHim !== undefined &&
    maccabiWonTitleWithoutHim(career) !== c.maccabiWonWithoutHim
  ) {
    return false;
  }
  if (c.maccabiInCrisis !== undefined && maccabiInCrisis(career) !== c.maccabiInCrisis) {
    return false;
  }

  /* ---------- v0.4: the club's own season ---------- */
  if (c.clubLeagueTier && !c.clubLeagueTier.includes(leagueOf(career.world, career.currentClubId).tier)) {
    return false;
  }
  if (c.minClubStrength !== undefined || c.maxClubStrength !== undefined) {
    const strength = clubStrengthVsLeague(career.world, career.currentClubId);
    if (!between(strength, c.minClubStrength, c.maxClubStrength)) return false;
  }

  if (!between(ctx.appearances, c.minLastAppearances, c.maxLastAppearances)) return false;

  if (c.requiresFlags && !c.requiresFlags.every((f) => career.flags.includes(f))) return false;
  if (c.forbidsFlags && c.forbidsFlags.some((f) => career.flags.includes(f))) return false;

  /* ---------- v0.3: what the career remembers ---------- */
  if (c.requiresMemory) {
    for (const kind of c.requiresMemory) {
      const ago = seasonsSinceMemory(career, kind);
      if (ago === null) return false;
      // A callback needs distance to land, and staleness to stop being interesting.
      if (c.memoryMinSeasonsAgo !== undefined && ago < c.memoryMinSeasonsAgo) return false;
      if (c.memoryMaxSeasonsAgo !== undefined && ago > c.memoryMaxSeasonsAgo) return false;
    }
  }
  if (c.forbidsMemory && c.forbidsMemory.some((kind) => hasMemory(career, kind))) return false;

  if (c.requiresArc && !matchesArc(career, c.requiresArc)) return false;
  if (c.forbidsActiveArc && activeArc(career, c.forbidsActiveArc) !== null) return false;
  if (c.requiresCompletedArc && !hasCompletedArc(career, c.requiresCompletedArc)) return false;

  if (c.requiresTrait && !c.requiresTrait.every((t) => hasTrait(career, t))) return false;
  if (c.minLeadership !== undefined && career.hidden.leadership < c.minLeadership) return false;

  /*
   * Professional-football gate (v0.4).
   *
   * Implied by seniorPhases, because a senior *phase* is derived from appearances and age and
   * is therefore defined for a nine year old too - which is how "your first senior training"
   * and "your first professional contract" were reaching children in טרום ב׳.
   */
  const needsProfessionalFootball =
    c.requiresProfessionalFootball === true || c.seniorPhases !== undefined;
  if (needsProfessionalFootball) {
    const eligible =
      isSenior(career) ||
      allowsSeniorContact(career) ||
      (c.allowsExceptionalYouth === true && allowsExceptionalSeniorContact(career));
    if (!eligible) return false;
  }

  if (c.seniorPhases && !c.seniorPhases.includes(seniorPhase(career))) return false;

  return true;
}

/**
 * Shared condition matching for events and for individual outcomes.
 * Pure predicate code - no randomness, no state changes.
 */

import { stageBand } from '../data/academy';
import type {
  AgentArchetypeId,
  Career,
  ClubScope,
  EventConditions,
  ManagerArchetypeId,
  SeasonPhase,
  SeasonSlot,
} from '../types';
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
import { leagueContextAt } from './leagueEngine';
import { hasRivalryOfType, matchContext } from './matchEngine';
import { isAtMaccabi, isAtMaccabiSenior, isOnLoan, isPlayingAbroad } from './rules';
import { canBeOnField, canHaveStarted } from './participation';
import { agentEligible } from './peopleEngine';
import { reachedCupFinal, wonCupThisSeason } from './cupEngine';
import { isDerbyEligible } from './worldPredicates';
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
  /**
   * Which phase of the season this event is being judged for (v0.4.6).
   *
   * The slot, not "now". `planSeason` picks the whole season at preseason, so a late-slot event
   * must be checked against the table as it will be in April rather than as it is in August.
   */
  phase: SeasonPhase;
}

export function conditionContext(career: Career, slot: SeasonSlot): ConditionContext {
  if (slot === 'early') {
    return { appearances: career.lastSeasonRecord?.stats.appearances ?? 0, phase: slot };
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
  if (firstHalf !== undefined) return { appearances: firstHalf, phase: slot };
  return { appearances: career.lastSeasonRecord?.stats.appearances ?? 0, phase: slot };
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

  /* ---------- v0.5: people ---------- */
  if (!matchesPeople(career, c)) return false;

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

  /*
   * ---------- v0.4.8: did he actually play? ----------
   *
   * An event that puts the player on the pitch requires him to be on it. This used to be gated on
   * `minRoleValue` - standing in the squad, not playing - so a backup could receive "minute 88,
   * the ball reaches you" in a season he finished with zero appearances.
   */
  if (c.requiresAppearance === true && !canBeOnField(career)) return false;
  if (c.requiresStart === true && !canHaveStarted(career)) return false;

  /* ---------- v0.4.6: the live table, and the fixture ---------- */
  if (!matchesWorldState(career, c, ctx.phase)) return false;
  if (!matchesMatchContext(career, c, ctx.phase)) return false;

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

/* ------------------------------------------------------------------ */
/* v0.4.6: the live world                                              */
/* ------------------------------------------------------------------ */

/**
 * Does the club's actual league situation match what the event needs?
 *
 * Everything here **fails closed**. A career with no table - youth football, or a league with no
 * modelled shape - matches none of these rather than all of them. That default is the whole
 * point: an event about a title race asking a question the world cannot answer must not be
 * allowed through on the grounds that nothing said no.
 */
/* ------------------------------------------------------------------ */
/* People (v0.5)                                                       */
/* ------------------------------------------------------------------ */

/**
 * Person-relationship gates.
 *
 * Everything fails closed, the standing rule since v0.4.6: a career with no people state (which
 * cannot happen after migration, but a gate that assumes is a gate that lies) matches none of the
 * person conditions rather than all of them. So an agent-conflict event can never reach a player
 * with no agent, and a goalkeeper-coach breakthrough can never reach a striker - by construction,
 * not by authors remembering.
 */
function matchesPeople(career: Career, c: EventConditions): boolean {
  const people = career.people;
  const agent = people?.agent ?? null;
  const coach = people?.personalCoach ?? null;

  if (c.requiresAgent === true && !agent) return false;
  if (c.forbidsAgent === true && agent) return false;
  if (c.agentEligibleStage === true && !agentEligible(career)) return false;
  if (c.agentArchetypes) {
    if (!agent) return false;
    if (!c.agentArchetypes.includes(agent.person.archetypeId as AgentArchetypeId)) return false;
  }
  if (c.minAgentRelationship !== undefined || c.maxAgentRelationship !== undefined) {
    if (!agent) return false;
    if (!between(agent.relationship, c.minAgentRelationship, c.maxAgentRelationship)) return false;
  }

  if (c.managerArchetypes) {
    const archetype = people?.manager?.person.archetypeId;
    if (!archetype) return false;
    if (!c.managerArchetypes.includes(archetype as ManagerArchetypeId)) return false;
  }
  if (c.managerGaveDebut !== undefined) {
    if ((people?.manager?.gaveDebut === true) !== c.managerGaveDebut) return false;
  }

  if (c.requiresPersonalCoach === true && !coach) return false;
  if (c.forbidsPersonalCoach === true && coach) return false;
  if (c.personalCoachSpecialties) {
    if (!coach) return false;
    if (!c.personalCoachSpecialties.includes(coach.specialty)) return false;
  }
  if (c.minCoachSeasonsTogether !== undefined) {
    if (!coach || coach.seasonsTogether < c.minCoachSeasonsTogether) return false;
  }
  if (c.newManagerThisSeason !== undefined) {
    if (career.newCoachThisSeason !== c.newManagerThisSeason) return false;
  }

  return true;
}

function matchesWorldState(career: Career, c: EventConditions, phase: SeasonPhase): boolean {
  const wants =
    c.titleRace !== undefined ||
    c.europeRace !== undefined ||
    c.relegationBattle !== undefined ||
    c.promotionRace !== undefined ||
    c.midTable !== undefined ||
    c.championClinched !== undefined ||
    c.relegationConfirmed !== undefined ||
    c.clubOverperforming !== undefined ||
    c.clubUnderperforming !== undefined ||
    c.minLeaguePosition !== undefined ||
    c.maxLeaguePosition !== undefined ||
    c.requiresLeagueTable === true;
  if (!wants) return true;

  const league = leagueContextAt(career, phase);
  if (!league) return false;

  const flag = (want: boolean | undefined, actual: boolean): boolean =>
    want === undefined || want === actual;

  if (!flag(c.titleRace, league.titleRace)) return false;
  if (!flag(c.europeRace, league.europeRace)) return false;
  if (!flag(c.relegationBattle, league.relegationBattle)) return false;
  if (!flag(c.promotionRace, league.promotionRace)) return false;
  if (!flag(c.midTable, league.midTable)) return false;
  if (!flag(c.championClinched, league.championClinched)) return false;
  if (!flag(c.relegationConfirmed, league.relegationConfirmed)) return false;
  if (!flag(c.clubOverperforming, league.overperforming)) return false;
  if (!flag(c.clubUnderperforming, league.underperforming)) return false;

  // Position 1 is the top of the table, so "max" is the better finish.
  if (c.maxLeaguePosition !== undefined && league.position > c.maxLeaguePosition) return false;
  if (c.minLeaguePosition !== undefined && league.position < c.minLeaguePosition) return false;

  return true;
}

/**
 * Does the fixture support what the event says about it?
 *
 * `requiresDerby` is the important one. It is checked against a modelled rivalry between the
 * player's club and a club in the same division - not against how big the match feels - which is
 * what makes it impossible for a club with no local rival to receive a derby event.
 */
function matchesMatchContext(career: Career, c: EventConditions, phase: SeasonPhase): boolean {
  /*
   * The cup (v0.6.2). Checked before the fixture block because a cup final is not a league fixture:
   * it has no table row, no home leg and no position gap, so `matchContext` has nothing useful to
   * say about it. What it does have is an authoritative run in `world.cup`, and that is the whole
   * gate. Fails closed - a save with no cup state supports no cup-final event.
   */
  if (c.cupFinal !== undefined) {
    if (!reachedCupFinal(career)) return false;
    if (c.cupFinal === 'won' && !wonCupThisSeason(career)) return false;
    if (c.cupFinal === 'lost' && wonCupThisSeason(career)) return false;
  }

  const wants =
    c.requiresDerby !== undefined ||
    c.rivalryTypes !== undefined ||
    c.matchImportance !== undefined ||
    c.titleDecider !== undefined ||
    c.relegationSixPointer !== undefined ||
    c.promotionDecider !== undefined ||
    c.vsMaccabi !== undefined ||
    c.vsFormerClub !== undefined;
  if (!wants) return true;

  if (c.requiresDerby === true && !isDerbyEligible(career)) return false;
  if (c.rivalryTypes && !hasRivalryOfType(career, c.rivalryTypes)) return false;

  const needsFixture =
    c.matchImportance !== undefined ||
    c.titleDecider !== undefined ||
    c.relegationSixPointer !== undefined ||
    c.promotionDecider !== undefined ||
    c.vsMaccabi !== undefined ||
    c.vsFormerClub !== undefined;
  if (!needsFixture) return true;

  const match = matchContext(career, phase, {
    derby: c.requiresDerby === true,
    maccabi: c.vsMaccabi === true,
    formerClub: c.vsFormerClub === true,
  });
  if (!match) return false;

  if (c.matchImportance && !c.matchImportance.includes(match.importance)) return false;
  if (c.titleDecider !== undefined && match.titleDecider !== c.titleDecider) return false;
  if (c.relegationSixPointer !== undefined && match.relegationSixPointer !== c.relegationSixPointer) {
    return false;
  }
  if (c.promotionDecider !== undefined && match.promotionDecider !== c.promotionDecider) return false;
  if (c.vsMaccabi !== undefined && match.vsMaccabi !== c.vsMaccabi) return false;
  if (c.vsFormerClub !== undefined && match.vsFormerClub !== c.vsFormerClub) return false;

  return true;
}

/**
 * Developer-time validation of event definitions (v0.4.1).
 *
 * Events are data, and data drifts. Every coherence bug found across v0.3.1, v0.4 and v0.4.1 was
 * a *class* of mistake rather than a one-off: a Maccabi-specific event without a Maccabi scope, a
 * senior gate that leaked into childhood, a strength window no club in the game satisfies, an
 * outcome list that cannot produce a result. Each was found by hand, one at a time, after
 * shipping.
 *
 * This module turns those classes into checks that run in the test suite, so the next one is
 * caught by `npm test` instead of by a playtester. It deliberately reports *all* problems rather
 * than throwing on the first, because fixing content is much easier with the whole list.
 *
 * Not a linter for style. Every rule here corresponds to a bug that actually shipped.
 */

import { stageBand } from '../data/academy';
import { ALL_CLUBS } from '../data/clubs';
import { EVENT_POOL } from '../data/events';
import type { AcademyStage, GameEvent, Position } from '../types';
import { NO_PROFESSIONAL_CONTACT_STAGES } from './eligibility';
import { clubStrengthVsLeague, emptyWorld, leagueOf } from './worldEngine';

export interface ValidationIssue {
  eventId: string;
  rule: string;
  detail: string;
}

/** Words that only make sense if the event is about Maccabi. */
const MACCABI_WORDS = ['מכבי חיפה', 'סמי עופר', 'הירוקים'];

/** Scopes that establish the event has a defined relationship to Maccabi. */
const MACCABI_AWARE_SCOPES = ['maccabi', 'formerMaccabi', 'nonMaccabi', 'abroad'];

const ALL_POSITIONS: readonly Position[] = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST'];

/* ------------------------------------------------------------------ */
/* Rules                                                              */
/* ------------------------------------------------------------------ */

function checkDuplicateIds(events: readonly GameEvent[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  for (const event of events) seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({
      eventId: id,
      rule: 'duplicate-id',
      detail: `${count} events share this id, so EVENTS_BY_ID silently keeps only one`,
    }));
}

function checkChoicesAndOutcomes(event: GameEvent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (event.choices.length < 2) {
    issues.push({
      eventId: event.id,
      rule: 'single-choice',
      detail: 'an event with one choice is not a decision',
    });
  }

  for (const choice of event.choices) {
    if (choice.outcomes.length === 0) {
      issues.push({
        eventId: event.id,
        rule: 'no-outcomes',
        detail: `choice "${choice.id}" has no outcomes`,
      });
      continue;
    }

    const total = choice.outcomes.reduce((sum, o) => sum + o.baseWeight, 0);
    if (total <= 0) {
      issues.push({
        eventId: event.id,
        rule: 'zero-weight',
        detail: `choice "${choice.id}" has total base weight ${total}, so no outcome can be drawn`,
      });
    }
    for (const outcome of choice.outcomes) {
      if (outcome.baseWeight < 0) {
        issues.push({
          eventId: event.id,
          rule: 'negative-weight',
          detail: `outcome "${outcome.id}" has a negative base weight`,
        });
      }
    }

    const ids = choice.outcomes.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      issues.push({
        eventId: event.id,
        rule: 'duplicate-outcome-id',
        detail: `choice "${choice.id}" repeats an outcome id, so the resolver cannot tell them apart`,
      });
    }
  }

  const choiceIds = event.choices.map((c) => c.id);
  if (new Set(choiceIds).size !== choiceIds.length) {
    issues.push({ eventId: event.id, rule: 'duplicate-choice-id', detail: 'repeated choice id' });
  }

  return issues;
}

function checkMaccabiScope(event: GameEvent): ValidationIssue[] {
  const text = [
    event.title,
    event.description,
    event.kicker ?? '',
    ...event.choices.flatMap((c) => [c.label, c.hint ?? '', ...c.outcomes.map((o) => o.text)]),
  ].join(' ');

  const named = MACCABI_WORDS.find((word) => text.includes(word));
  if (!named) return [];

  const scope = event.conditions?.clubScope;
  const c = event.conditions;
  const declared =
    (scope !== undefined && MACCABI_AWARE_SCOPES.includes(scope)) ||
    c?.atMaccabi !== undefined ||
    c?.atMaccabiSenior !== undefined ||
    c?.playedForMaccabi !== undefined ||
    c?.canFaceMaccabi !== undefined ||
    c?.maccabiRelationship !== undefined ||
    // The older way of saying "has Maccabi history, is elsewhere now".
    c?.hasLeftMaccabi === true ||
    c?.requiresMemory?.some((m) => m.includes('maccabi')) === true;

  return declared
    ? []
    : [
        {
          eventId: event.id,
          rule: 'maccabi-without-scope',
          detail: `names "${named}" without declaring any relationship to Maccabi, so it can fire at Hapoel Afula`,
        },
      ];
}

function checkProfessionalGate(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c) return [];

  const professional = c.requiresProfessionalFootball === true || c.seniorPhases !== undefined;
  if (!professional) return [];

  // A professional event explicitly listing a childhood stage contradicts its own gate.
  const forbidden = (c.stages ?? []).filter((s) => NO_PROFESSIONAL_CONTACT_STAGES.includes(s));
  if (forbidden.length > 0) {
    return [
      {
        eventId: event.id,
        rule: 'professional-in-childhood',
        detail: `gated as professional football but lists ${forbidden.join(', ')}`,
      },
    ];
  }

  if (c.bands?.includes('children')) {
    return [
      {
        eventId: event.id,
        rule: 'professional-in-childhood',
        detail: 'gated as professional football but allows the children band',
      },
    ];
  }

  return [];
}

function checkStageConditions(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c?.stages) return [];

  const issues: ValidationIssue[] = [];
  // A stage list that contradicts the band list can never match anything.
  if (c.bands) {
    const reachable = c.stages.filter((s) => c.bands?.includes(stageBand(s as AcademyStage)));
    if (reachable.length === 0) {
      issues.push({
        eventId: event.id,
        rule: 'impossible-stage-band',
        detail: `stages [${c.stages.join(', ')}] and bands [${c.bands.join(', ')}] cannot both hold`,
      });
    }
  }
  return issues;
}

function checkAgeWindow(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c) return [];
  if (c.minAge !== undefined && c.maxAge !== undefined && c.minAge > c.maxAge) {
    return [
      {
        eventId: event.id,
        rule: 'impossible-age-window',
        detail: `minAge ${c.minAge} is above maxAge ${c.maxAge}`,
      },
    ];
  }
  return [];
}

function checkPositionExclusions(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c) return [];

  // Both lists must be honoured: `positions: ['GK'], notPositions: ['GK']` matches nobody.
  const base = c.positions ?? ALL_POSITIONS;
  const allowed = base.filter((p) => !(c.notPositions ?? []).includes(p));
  if (allowed.length === 0) {
    return [
      {
        eventId: event.id,
        rule: 'no-position-can-match',
        detail: 'positions and notPositions together exclude every position',
      },
    ];
  }
  return [];
}

/**
 * A club-strength window no club in the game satisfies is dead content.
 *
 * Three v0.4 world events shipped firing 0% of the time for exactly this reason, and nothing
 * would have told us.
 */
function checkClubStrengthWindow(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c || (c.minClubStrength === undefined && c.maxClubStrength === undefined)) return [];

  const world = emptyWorld();
  const matches = ALL_CLUBS.filter((club) => {
    if (club.isSenior !== true) return false;
    const league = leagueOf(world, club.id);
    if (c.clubLeagueTier && !c.clubLeagueTier.includes(league.tier)) return false;
    const strength = clubStrengthVsLeague(world, club.id);
    if (c.minClubStrength !== undefined && strength < c.minClubStrength) return false;
    if (c.maxClubStrength !== undefined && strength > c.maxClubStrength) return false;
    return true;
  });

  return matches.length > 0
    ? []
    : [
        {
          eventId: event.id,
          rule: 'unreachable-club-strength',
          detail: `no club in the game satisfies strength [${c.minClubStrength ?? '-inf'}, ${c.maxClubStrength ?? 'inf'}]${
            c.clubLeagueTier ? ` in tier ${c.clubLeagueTier.join('/')}` : ''
          }`,
        },
      ];
}

/** A memory both required and forbidden can never match. */
function checkMemoryContradiction(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c?.requiresMemory || !c.forbidsMemory) return [];
  const both = c.requiresMemory.filter((m) => c.forbidsMemory?.includes(m));
  return both.length > 0
    ? [
        {
          eventId: event.id,
          rule: 'contradictory-memory',
          detail: `memory ${both.join(', ')} is both required and forbidden`,
        },
      ]
    : [];
}

/** A former-Maccabi event that also demands he is currently there. */
function checkClubScopeContradiction(event: GameEvent): ValidationIssue[] {
  const c = event.conditions;
  if (!c) return [];
  const issues: ValidationIssue[] = [];

  if (c.clubScope === 'formerMaccabi' && (c.atMaccabi === true || c.atMaccabiSenior === true)) {
    issues.push({
      eventId: event.id,
      rule: 'contradictory-club-scope',
      detail: 'scoped to a former Maccabi player but also requires being at Maccabi',
    });
  }
  if (c.clubScope === 'maccabi' && (c.atMaccabi === false || c.canFaceMaccabi === true)) {
    issues.push({
      eventId: event.id,
      rule: 'contradictory-club-scope',
      detail: 'scoped to Maccabi but also requires being elsewhere',
    });
  }
  if (c.clubScope === 'abroad' && c.abroad === false) {
    issues.push({
      eventId: event.id,
      rule: 'contradictory-club-scope',
      detail: 'scoped abroad but requires not being abroad',
    });
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

const PER_EVENT_RULES = [
  checkChoicesAndOutcomes,
  checkMaccabiScope,
  checkProfessionalGate,
  checkStageConditions,
  checkAgeWindow,
  checkPositionExclusions,
  checkClubStrengthWindow,
  checkMemoryContradiction,
  checkClubScopeContradiction,
];

/** Every problem in the pool, so content can be fixed in one pass rather than one per run. */
export function validateEvents(events: readonly GameEvent[] = EVENT_POOL): ValidationIssue[] {
  const issues: ValidationIssue[] = [...checkDuplicateIds(events)];
  for (const event of events) {
    for (const rule of PER_EVENT_RULES) issues.push(...rule(event));
  }
  return issues;
}

/** Formatted for a test failure message, grouped so the output is readable. */
export function formatIssues(issues: readonly ValidationIssue[]): string {
  if (issues.length === 0) return 'no issues';
  const byRule = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const list = byRule.get(issue.rule) ?? [];
    list.push(issue);
    byRule.set(issue.rule, list);
  }
  return [...byRule.entries()]
    .map(
      ([rule, list]) =>
        `\n${rule} (${list.length}):\n` +
        list.map((i) => `  - ${i.eventId}: ${i.detail}`).join('\n'),
    )
    .join('');
}

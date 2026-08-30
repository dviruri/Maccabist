import { MACCABI_ID, getClub } from '../data/clubs';
import {
  ACCESS_RULES,
  EUROPEAN_FIELD,
  FIELD_BY_ID,
  LEAGUE_PHASE,
  LP_DROP_TARGETS,
  OUT,
  QUALIFYING_GRAPH,
  QUALIFYING_ORDER,
  TITLEHOLDER_ENTRY,
  UEFA_COMPETITIONS,
} from '../data/uefa';
import { LEAGUE_MEMBERSHIP } from '../data/worldClubs';
import { buildTable } from './leagueEngine';
import { createRng, clamp, type Rng } from './random';
import type {
  Career,
  EuropeanEntry,
  EuropeanJourney,
  EuropeanSeasonState,
  EuropeanStep,
  EuropeanTie,
  EuropeState,
  UefaCompetitionId,
} from '../types';

/**
 * The UEFA season engine (v0.8).
 *
 * ## Europe is the conclusion of domestic football
 *
 * Entries are resolved at settlement from the season's actual domestic results - the real
 * settled table where the world has one, a deterministic seeded ranking where it does not - and
 * next summer the whole European season is simulated as one connected system: qualifying walks
 * the graph in `data/uefa.ts`, losers drop down it, three 36-club league phases are drawn and
 * played, knockouts follow the standings, and a final produces a champion. A trophy can only
 * come out of that pipeline. There is no other source.
 *
 * ## Determinism and rng isolation (v0.7 discipline)
 *
 * Everything here draws from `uefaRng(seed, season, salt)` - derived from the career seed,
 * never the live career stream. Same career seed, same European history; and adding Europe
 * consumed zero draws from any existing career decision.
 *
 * ## What is simulated for whom
 *
 * Every entrant obeys the same progression graph, the same draws, the same standings. What
 * differs is RECORDING: full journey steps are kept for the clubs the career watches (the
 * player's club and Maccabi); background clubs keep only what the world needs from them -
 * results, coefficient points, and the trophy if they win it.
 *
 * ## Documented simplifications
 *
 * Seeding is by coefficient (best of several draws would be noise here - ties pair strongest
 * against weakest, as seeded draws do). The league-phase draw uses the circle method: eight
 * (six) perfect-matching rounds, so every club gets exactly eight (six) DIFFERENT opponents
 * with alternating home/away - the constraint the real draw exists to satisfy. League-phase
 * places left over after direct entries, qualifying and drop-downs go to the next-best-placed
 * clubs of the strongest associations by coefficient, which is the access list's extra-places
 * behaviour without its administrative machinery. Tiebreak: points, goal difference, goals
 * for, coefficient. No away-goals rule; level aggregates go to extra time, then penalties.
 */

/* ------------------------------------------------------------------ */
/* RNG                                                                 */
/* ------------------------------------------------------------------ */

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The isolated European stream: career seed + season + purpose, never the live career rng. */
export function uefaRng(career: Career, season: number, salt: string): Rng {
  return createRng((career.seed ^ Math.imul(season, 2654435761) ^ hashString(`uefa:${salt}`)) >>> 0);
}

/* ------------------------------------------------------------------ */
/* Participants                                                        */
/* ------------------------------------------------------------------ */

export interface Participant {
  id: string;
  name: string;
  association: string;
  quality: number;
  coefficient: number;
}

function coefficientOf(europe: EuropeState | undefined, clubId: string, fallback: number): number {
  return europe?.coefficients.clubs[clubId] ?? fallback;
}

/** A participant from either the modeled world or the European field. */
function participant(career: Career, clubId: string, name?: string): Participant {
  const field = FIELD_BY_ID.get(clubId);
  if (field) {
    return {
      id: field.id,
      name: field.name,
      association: field.country,
      quality: field.quality,
      coefficient: coefficientOf(career.world.europe, field.id, field.coefficient),
    };
  }
  try {
    const club = getClub(clubId);
    // A first-time qualifier starts from a modest reputation derived from its own quality.
    const seedCoefficient = Math.max(4, (club.quality - 55) * 1.1);
    return {
      id: club.id,
      name: club.name,
      association: club.country,
      quality: club.quality,
      coefficient: coefficientOf(career.world.europe, club.id, seedCoefficient),
    };
  } catch {
    return { id: clubId, name: name ?? clubId, association: '', quality: 60, coefficient: 5 };
  }
}

/* ------------------------------------------------------------------ */
/* Domestic results per association                                    */
/* ------------------------------------------------------------------ */

export interface DomesticResult {
  association: string;
  leagueId: string;
  /** Final positions, 1-based, club ids in order. */
  positions: string[];
  cupWinnerId: string;
}

/**
 * The final table of one modeled league for the season being settled.
 *
 * Where the world holds a REAL settled table - the player's league, or Maccabi's league via its
 * parallel projection - that table is the answer, with the player's actual influence in it.
 * Everywhere else the table is a deterministic seeded ranking: quality plus bounded jitter,
 * reproducible from (career seed, season, league) alone. One source per association-season;
 * the two never mix inside one league.
 */
export function associationFinalTable(career: Career, leagueId: string, season: number): string[] {
  const { projection, maccabiProjection } = career.world;
  const usable =
    projection && projection.season === season && projection.leagueId === leagueId
      ? projection
      : maccabiProjection && maccabiProjection.season === season && maccabiProjection.leagueId === leagueId
        ? maccabiProjection
        : null;
  if (usable) {
    const pinned =
      usable === projection &&
      maccabiProjection &&
      maccabiProjection.season === season &&
      maccabiProjection.leagueId === leagueId
        ? maccabiProjection
        : null;
    return buildTable(career.world, usable, 'end', pinned).rows.map((row) => row.clubId);
  }

  const members = career.world.clubLeagues
    ? rosterOf(career, leagueId)
    : (LEAGUE_MEMBERSHIP[leagueId] ?? []).slice();
  const rng = uefaRng(career, season, `table:${leagueId}`);
  return members
    .map((clubId) => {
      let quality = 60;
      try {
        quality = getClub(clubId).quality;
      } catch {
        /* unknown member - mid ranking */
      }
      return { clubId, score: quality + rng.range(-6, 6) };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.clubId);
}

/** Current members of a league, respecting promotion/relegation movement. */
function rosterOf(career: Career, leagueId: string): string[] {
  const base = (LEAGUE_MEMBERSHIP[leagueId] ?? []).filter(
    (id) => career.world.clubLeagues[id] === undefined || career.world.clubLeagues[id] === leagueId,
  );
  for (const [clubId, movedTo] of Object.entries(career.world.clubLeagues)) {
    if (movedTo === leagueId && !base.includes(clubId)) base.push(clubId);
  }
  return base;
}

/**
 * The season's domestic cup winner for an association.
 *
 * The player's own cup run is authoritative where it reaches the final: a win names the
 * player's club, a lost final names the opponent who beat him - the same fact the player was
 * shown. Anywhere the run ended earlier (or in another country), the winner is a seeded
 * quality-weighted pick from the top of that association's table - the "just enough" cup
 * extension the brief asks for: a real, deterministic season result feeding qualification,
 * without building a whole knockout gameplay system nobody sees.
 */
export function cupWinnerOf(
  career: Career,
  association: string,
  season: number,
  positions: readonly string[],
): string {
  const cup = career.world.cup;
  if (cup && cup.season === season && cup.trophyId !== 'youth_cup') {
    let playerAssociation = '';
    try {
      playerAssociation = getClub(cup.clubId).country;
    } catch {
      /* academy ids resolve below to the seeded pick */
    }
    if (playerAssociation === association) {
      if (cup.run === 'winners') return cup.clubId;
      if (cup.run === 'runner_up' && cup.finalOpponentId) return cup.finalOpponentId;
    }
  }
  const rng = uefaRng(career, season, `cup:${association}`);
  const contenders = positions.slice(0, Math.min(8, positions.length));
  const picked = rng.weighted(contenders, (clubId) => {
    try {
      const quality = getClub(clubId).quality;
      return Math.max(1, (quality - 50) * (quality - 50));
    } catch {
      return 1;
    }
  });
  return picked ?? contenders[0] ?? '';
}

/* ------------------------------------------------------------------ */
/* Entry resolution: domestic results → one route per club             */
/* ------------------------------------------------------------------ */

export interface ResolvedEntries {
  entries: EuropeanEntry[];
  /**
   * The access-list depth pool: next-best-placed clubs of strong associations, in coefficient
   * order, used only to complete league phases to exactly 36. Persisted alongside the entries
   * because it derives from the same settled tables, which are gone by next preseason.
   */
  standby: EuropeanEntry[];
}

const REASON_PRIORITY: Record<EuropeanEntry['reason'], number> = {
  titleholder: 0,
  champion: 1,
  cup_winner: 2,
  league_position: 3,
};

const COMPETITION_PRIORITY: Record<UefaCompetitionId, number> = {
  uefa_champions_league: 0,
  uefa_europa_league: 1,
  uefa_conference_league: 2,
};

/**
 * Resolves next season's European entries from this season's domestic football.
 *
 * The deterministic slot algorithm the brief specifies:
 *   1. titleholder entries from this season's European winners,
 *   2. each association's champion, cup winner and league positions per its ACCESS_RULES,
 *   3. duplicates collapse to the best entry (titleholder > champion > cup > position;
 *      higher competition, then deeper entry, breaks remaining ties),
 *   4. every vacated cup/position slot is redistributed to the next league position not
 *      already holding a European place.
 *
 * One club, one route. An association without configured rules sends nobody - by design there
 * is no generic fallback.
 */
export function resolveNextEntries(career: Career, settledSeason: number): ResolvedEntries {
  /* Gather this season's domestic evidence per association, then delegate to the pure resolver. */
  const results: DomesticResult[] = [];
  for (const [association, rules] of Object.entries(ACCESS_RULES)) {
    const positions = associationFinalTable(career, rules.leagueId, settledSeason);
    if (positions.length === 0) continue;
    results.push({
      association,
      leagueId: rules.leagueId,
      positions,
      cupWinnerId: cupWinnerOf(career, association, settledSeason, positions),
    });
  }
  const winners = career.world.europe?.current?.winners;
  const titleholders =
    winners && career.world.europe?.current?.season === settledSeason ? winners : null;
  return resolveEntriesFromResults(results, titleholders, (clubId) => participant(career, clubId));
}

/**
 * The pure slot-resolution algorithm, over explicit domestic results.
 *
 * Separated from world-reading so the Israel test matrix can drive it with EXACT tables -
 * "champion Maccabi Haifa, cup winner Hapoel Beer Sheva, second Maccabi Tel Aviv" - and assert
 * the routes deterministically, which is the whole point of a rules engine.
 */
export function resolveEntriesFromResults(
  results: readonly DomesticResult[],
  titleholders: EuropeanSeasonState['winners'] | null,
  participantOf: (clubId: string) => Participant,
): ResolvedEntries {
  const proposals: EuropeanEntry[] = [];

  /* 1. Titleholders from the European season just played. */
  if (titleholders) {
    for (const competition of Object.keys(titleholders) as UefaCompetitionId[]) {
      const winner = titleholders[competition];
      if (!winner || FIELD_BY_ID.has(winner.clubId)) continue; // field clubs are scenery
      const route = TITLEHOLDER_ENTRY[competition];
      proposals.push({
        clubId: winner.clubId,
        clubName: winner.name,
        association: participantOf(winner.clubId).association,
        competition: route.competition,
        entry: route.entry,
        reason: 'titleholder',
      });
    }
  }

  /* 2. Domestic slots per association. */
  const standby: EuropeanEntry[] = [];
  for (const result of results) {
    const rules = ACCESS_RULES[result.association];
    if (!rules) continue;
    const { association, positions, cupWinnerId } = result;

    const claimed = new Set<string>();
    const slotEntries: EuropeanEntry[] = [];
    let nextFreePosition = 0;

    const nameOf = (clubId: string): string => {
      try {
        return getClub(clubId).name;
      } catch {
        return clubId;
      }
    };

    const takeNextFreePosition = (): string | null => {
      while (nextFreePosition < positions.length) {
        const clubId = positions[nextFreePosition]!;
        nextFreePosition += 1;
        if (!claimed.has(clubId)) return clubId;
      }
      return null;
    };

    for (const slot of rules.slots) {
      let clubId: string | null;
      let reason: EuropeanEntry['reason'];
      let position: number | undefined;
      if (slot.source === 'champion') {
        clubId = positions[0] ?? null;
        reason = 'champion';
        position = 1;
      } else if (slot.source === 'cup_winner') {
        clubId = cupWinnerId || null;
        reason = 'cup_winner';
      } else {
        clubId = positions[slot.source.position - 1] ?? null;
        reason = 'league_position';
        position = slot.source.position;
      }

      /*
       * Redistribution: the slot's natural holder already has a (better) European place, so
       * this slot passes down the table to the first club without one. The slot KEEPS its
       * competition and entry round - it is the place that moves, not the route.
       */
      if (clubId && claimed.has(clubId)) {
        clubId = takeNextFreePosition();
        reason = 'league_position';
        position = clubId ? positions.indexOf(clubId) + 1 : undefined;
      }
      if (!clubId) continue;
      claimed.add(clubId);
      slotEntries.push({
        clubId,
        clubName: nameOf(clubId),
        association,
        competition: slot.competition,
        entry: slot.entry,
        reason,
        position,
      });
    }
    proposals.push(...slotEntries);

    /* The depth pool: the next placed clubs, for league-phase completion only. */
    for (const clubId of positions) {
      if (claimed.has(clubId)) continue;
      if (standby.filter((s) => s.association === association).length >= 4) break;
      standby.push({
        clubId,
        clubName: nameOf(clubId),
        association,
        competition: 'uefa_conference_league',
        entry: LEAGUE_PHASE,
        reason: 'league_position',
        position: positions.indexOf(clubId) + 1,
      });
    }
  }

  /* 3-4. One route per club: keep the best proposal; domestic duplicates were already
     redistributed inside their association, so what remains is titleholder overlap. */
  const byClub = new Map<string, EuropeanEntry>();
  for (const entry of proposals) {
    const existing = byClub.get(entry.clubId);
    if (!existing) {
      byClub.set(entry.clubId, entry);
      continue;
    }
    const better =
      REASON_PRIORITY[entry.reason] !== REASON_PRIORITY[existing.reason]
        ? REASON_PRIORITY[entry.reason] < REASON_PRIORITY[existing.reason]
        : COMPETITION_PRIORITY[entry.competition] !== COMPETITION_PRIORITY[existing.competition]
          ? COMPETITION_PRIORITY[entry.competition] < COMPETITION_PRIORITY[existing.competition]
          : entry.entry === LEAGUE_PHASE && existing.entry !== LEAGUE_PHASE;
    if (better) byClub.set(entry.clubId, entry);
  }

  // Standby holds only clubs with no route at all.
  const cleanStandby = standby
    .filter((s) => !byClub.has(s.clubId))
    .sort((a, b) => participantOf(b.clubId).coefficient - participantOf(a.clubId).coefficient);

  return { entries: [...byClub.values()], standby: cleanStandby };
}

/* ------------------------------------------------------------------ */
/* Match and tie simulation                                            */
/* ------------------------------------------------------------------ */

/** European strength: world quality plus earned reputation. Same world, one extra earned axis. */
function strengthOf(p: Participant): number {
  return p.quality + clamp(p.coefficient / 12, 0, 8);
}

/** A single leg's goals for one side: bounded Poisson-ish draw around a strength-driven mean. */
function legGoals(rng: Rng, mean: number): number {
  const m = clamp(mean, 0.25, 3.4);
  let p = Math.exp(-m);
  let cumulative = p;
  const u = rng.next();
  for (let k = 0; k < 6; k += 1) {
    if (u < cumulative) return k;
    p = (p * m) / (k + 1);
    cumulative += p;
  }
  return 6;
}

function playLeg(rng: Rng, home: Participant, away: Participant): { home: number; away: number } {
  const edge = (strengthOf(home) - strengthOf(away)) / 14;
  return {
    home: legGoals(rng, 1.45 + 0.55 * edge + 0.22),
    away: legGoals(rng, 1.45 - 0.55 * edge),
  };
}

/** A two-legged tie (or single-leg final). No away goals; extra time, then penalties. */
function playTie(
  rng: Rng,
  a: Participant,
  b: Participant,
  stage: string,
  competition: UefaCompetitionId,
  singleLeg = false,
): { winner: Participant; loser: Participant; tieFor: (club: Participant) => EuropeanTie } {
  const legs: { aFor: number; bFor: number; aHome: boolean }[] = [];
  const first = playLeg(rng, a, b);
  legs.push({ aFor: first.home, bFor: first.away, aHome: true });
  if (!singleLeg) {
    const second = playLeg(rng, b, a);
    legs.push({ aFor: second.away, bFor: second.home, aHome: false });
  }
  let aggA = legs.reduce((sum, leg) => sum + leg.aFor, 0);
  let aggB = legs.reduce((sum, leg) => sum + leg.bFor, 0);
  let decidedBy: EuropeanTie['decidedBy'];
  if (aggA === aggB) {
    // Extra time: one low-scoring stretch; then penalties, mildly strength-weighted.
    const extraA = legGoals(rng, 0.45 + (strengthOf(a) - strengthOf(b)) / 60);
    const extraB = legGoals(rng, 0.45 - (strengthOf(a) - strengthOf(b)) / 60);
    aggA += extraA;
    aggB += extraB;
    decidedBy = 'extra_time';
    if (aggA === aggB) {
      decidedBy = 'penalties';
      const pA = clamp(0.5 + (strengthOf(a) - strengthOf(b)) / 200, 0.35, 0.65);
      if (rng.chance(pA)) aggA += 1;
      else aggB += 1;
    }
  }
  const aWon = aggA > aggB;
  const tieFor = (club: Participant): EuropeanTie => {
    const mine = club.id === a.id;
    return {
      stage,
      competition,
      opponentId: mine ? b.id : a.id,
      opponentName: mine ? b.name : a.name,
      legs: legs.map((leg) => ({
        for: mine ? leg.aFor : leg.bFor,
        against: mine ? leg.bFor : leg.aFor,
        home: mine ? leg.aHome : !leg.aHome,
      })),
      aggFor: mine ? aggA : aggB,
      aggAgainst: mine ? aggB : aggA,
      won: mine ? aWon : !aWon,
      decidedBy,
    };
  };
  return { winner: aWon ? a : b, loser: aWon ? b : a, tieFor };
}

/* ------------------------------------------------------------------ */
/* The European season                                                 */
/* ------------------------------------------------------------------ */

interface Campaign {
  participant: Participant;
  entry: EuropeanEntry;
  /** Full narrative steps, kept only for watched clubs. */
  steps: EuropeanStep[] | null;
  competition: UefaCompetitionId;
  furthest: string;
  matches: number;
  coefficientPoints: number;
  wonCompetition: UefaCompetitionId | null;
  reachedFinal: boolean;
  reachedSemiFinal: boolean;
  reachedLeaguePhase: boolean;
  eliminated: boolean;
}

interface StandingRow {
  campaign: Campaign;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

const STAGE_DEPTH: Record<string, number> = {
  ko_playoff: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
  champion: 6,
};

function deeper(current: string, candidate: string): string {
  const a = STAGE_DEPTH[current] ?? 0;
  const b = STAGE_DEPTH[candidate] ?? 0;
  return b > a ? candidate : current;
}

/**
 * Simulates a whole European season: qualifying, three league phases, knockouts, finals.
 *
 * Pure and deterministic from (career seed, season, entries, standby): call it twice, get the
 * same Europe. `watched` names the clubs whose full journey is recorded.
 */
export interface SimulatedEurope {
  state: EuropeanSeasonState;
  /** Coefficient points earned this season, per club - consumed by `rollCoefficients`. */
  points: Map<string, { points: number; association: string }>;
  /** Structural facts the invariants and the Monte Carlo audit assert against. */
  audit: {
    leaguePhaseSizes: Record<UefaCompetitionId, number>;
    /** Every winner's campaign passed through its competition's league phase. */
    winnersFromLeaguePhase: boolean;
  };
}

export function simulateEuropeanSeason(
  career: Career,
  season: number,
  entries: readonly EuropeanEntry[],
  standby: readonly EuropeanEntry[],
  watched: readonly string[],
): SimulatedEurope {
  const rng = uefaRng(career, season, 'season');
  const campaigns = new Map<string, Campaign>();
  const isWatched = new Set(watched);

  const openCampaign = (entry: EuropeanEntry): Campaign => {
    const p = participant(career, entry.clubId, entry.clubName);
    const campaign: Campaign = {
      participant: p,
      entry,
      steps: isWatched.has(entry.clubId)
        ? [{ kind: 'entered', competition: entry.competition, entry: entry.entry, reason: entry.reason }]
        : null,
      competition: entry.competition,
      furthest: entry.entry,
      matches: 0,
      coefficientPoints: 0,
      wonCompetition: null,
      reachedFinal: false,
      reachedSemiFinal: false,
      reachedLeaguePhase: false,
      eliminated: false,
    };
    campaigns.set(entry.clubId, campaign);
    return campaign;
  };

  /* Field clubs join at their configured nodes; modeled entries come from the resolver. */
  for (const entry of entries) openCampaign(entry);
  for (const field of EUROPEAN_FIELD) {
    if (campaigns.has(field.id)) continue;
    openCampaign({
      clubId: field.id,
      clubName: field.name,
      association: field.country,
      competition: field.competition,
      entry: field.entry,
      reason: 'league_position',
    });
  }

  /* ---- Qualifying: walk the graph, round by round ---- */
  const atNode = new Map<string, Campaign[]>();
  const leaguePhase: Record<UefaCompetitionId, Campaign[]> = {
    uefa_champions_league: [],
    uefa_europa_league: [],
    uefa_conference_league: [],
  };
  for (const campaign of campaigns.values()) {
    if (campaign.entry.entry === LEAGUE_PHASE) {
      leaguePhase[campaign.competition].push(campaign);
      campaign.reachedLeaguePhase = true;
      campaign.furthest = LEAGUE_PHASE;
    } else {
      atNode.set(campaign.entry.entry, [...(atNode.get(campaign.entry.entry) ?? []), campaign]);
    }
  }

  const routeLoser = (campaign: Campaign, node: (typeof QUALIFYING_GRAPH)[string]): void => {
    const dest = node.loseTo;
    if (dest === OUT) {
      campaign.eliminated = true;
      return;
    }
    const dropTarget = LP_DROP_TARGETS[dest];
    if (dropTarget) {
      campaign.steps?.push({ kind: 'dropped', from: campaign.competition, to: dropTarget, toEntry: LEAGUE_PHASE });
      campaign.competition = dropTarget;
      campaign.reachedLeaguePhase = true;
      campaign.furthest = LEAGUE_PHASE;
      leaguePhase[dropTarget].push(campaign);
      return;
    }
    const destNode = QUALIFYING_GRAPH[dest]!;
    if (destNode.competition !== campaign.competition) {
      campaign.steps?.push({
        kind: 'dropped',
        from: campaign.competition,
        to: destNode.competition,
        toEntry: dest,
      });
      campaign.competition = destNode.competition;
    }
    atNode.set(dest, [...(atNode.get(dest) ?? []), campaign]);
  };

  for (const nodeId of QUALIFYING_ORDER) {
    const node = QUALIFYING_GRAPH[nodeId]!;
    const entrants = (atNode.get(nodeId) ?? []).sort(
      (a, b) => b.participant.coefficient - a.participant.coefficient,
    );
    atNode.delete(nodeId);
    if (entrants.length === 0) continue;

    // Odd field: the best-ranked club receives a bye - the seeded draw's kindness, documented.
    if (entrants.length % 2 === 1) {
      const bye = entrants.shift()!;
      if (node.winTo === LEAGUE_PHASE) {
        bye.reachedLeaguePhase = true;
        bye.furthest = LEAGUE_PHASE;
        leaguePhase[node.competition].push(bye);
      } else {
        atNode.set(node.winTo, [...(atNode.get(node.winTo) ?? []), bye]);
      }
    }

    // Seeded pairing: strongest against weakest, as qualifying draws are built to produce.
    const half = entrants.length / 2;
    for (let i = 0; i < half; i += 1) {
      const seeded = entrants[i]!;
      const unseeded = entrants[entrants.length - 1 - i]!;
      const tie = playTie(rng, seeded.participant, unseeded.participant, nodeId, node.competition);
      for (const side of [seeded, unseeded]) {
        side.matches += 2;
        side.steps?.push({ kind: 'tie', tie: tie.tieFor(side.participant) });
      }
      const winner = tie.winner.id === seeded.participant.id ? seeded : unseeded;
      const loser = winner === seeded ? unseeded : seeded;
      winner.coefficientPoints += 0.5;
      if (node.winTo === LEAGUE_PHASE) {
        winner.reachedLeaguePhase = true;
        winner.furthest = LEAGUE_PHASE;
        leaguePhase[node.competition].push(winner);
      } else {
        winner.furthest = node.winTo;
        atNode.set(node.winTo, [...(atNode.get(node.winTo) ?? []), winner]);
      }
      routeLoser(loser, node);
    }
  }

  /* ---- Complete each league phase to exactly 36 ---- */
  const fillPool: Campaign[] = [];
  for (const entry of standby) {
    if (campaigns.has(entry.clubId)) continue;
    fillPool.push(openCampaign({ ...entry, entry: LEAGUE_PHASE }));
  }
  fillPool.sort((a, b) => b.participant.coefficient - a.participant.coefficient);
  for (const competition of Object.keys(leaguePhase) as UefaCompetitionId[]) {
    const table = leaguePhase[competition];
    while (table.length < 36 && fillPool.length > 0) {
      const filler = fillPool.shift()!;
      filler.competition = competition;
      filler.reachedLeaguePhase = true;
      filler.furthest = LEAGUE_PHASE;
      table.push(filler);
    }
    // A short table (exhausted pool) still plays; the format guard tests assert 36 in practice.
  }

  /* ---- League phases ---- */
  const winners: EuropeanSeasonState['winners'] = {} as EuropeanSeasonState['winners'];

  for (const competition of Object.keys(leaguePhase) as UefaCompetitionId[]) {
    const field = leaguePhase[competition];
    const rounds = UEFA_COMPETITIONS[competition].leaguePhaseMatches;
    const standings: StandingRow[] = field.map((campaign) => ({
      campaign,
      points: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }));

    /*
     * The draw: circle method over the field ordered by coefficient. Each round is a perfect
     * matching, so N rounds give every club exactly N distinct opponents; alternating the
     * bracket side per round balances home and away. This is the real draw's guarantee -
     * distinct opponents, balanced venues, strength-mixed pairings - without its television
     * ceremony.
     */
    const order = [...standings].sort(
      (a, b) => b.campaign.participant.coefficient - a.campaign.participant.coefficient,
    );
    const n = order.length;
    if (n >= 2) {
      const fixed = order[0]!;
      const rotating = order.slice(1);
      for (let round = 0; round < Math.min(rounds, n - 1); round += 1) {
        const ring = [fixed, ...rotating];
        for (let i = 0; i < Math.floor(n / 2); i += 1) {
          const rowA = ring[i]!;
          const rowB = ring[n - 1 - i]!;
          const homeFirst = (round + i) % 2 === 0;
          const home = homeFirst ? rowA : rowB;
          const away = homeFirst ? rowB : rowA;
          const score = playLeg(rng, home.campaign.participant, away.campaign.participant);
          home.goalsFor += score.home;
          home.goalsAgainst += score.away;
          away.goalsFor += score.away;
          away.goalsAgainst += score.home;
          home.campaign.matches += 1;
          away.campaign.matches += 1;
          if (score.home > score.away) {
            home.points += 3;
            home.won += 1;
            away.lost += 1;
            home.campaign.coefficientPoints += 2;
          } else if (score.home < score.away) {
            away.points += 3;
            away.won += 1;
            home.lost += 1;
            away.campaign.coefficientPoints += 2;
          } else {
            home.points += 1;
            away.points += 1;
            home.drawn += 1;
            away.drawn += 1;
            home.campaign.coefficientPoints += 1;
            away.campaign.coefficientPoints += 1;
          }
        }
        rotating.unshift(rotating.pop()!);
      }
    }

    standings.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        b.campaign.participant.coefficient - a.campaign.participant.coefficient,
    );
    standings.forEach((row, index) => {
      const position = index + 1;
      row.campaign.steps?.push({
        kind: 'league_phase',
        competition,
        position,
        points: row.points,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
      });
      if (position > 24) row.campaign.eliminated = true;
      row.campaign.coefficientPoints += position <= 8 ? 2 : position <= 24 ? 1 : 0;
    });

    /* ---- Knockouts: standings decide who plays where ---- */
    const direct = standings.slice(0, 8).map((row) => row.campaign);
    const playoffField = standings.slice(8, 24).map((row) => row.campaign);

    const playRound = (pairs: [Campaign, Campaign][], stage: string, single = false): Campaign[] => {
      const survivors: Campaign[] = [];
      for (const [a, b] of pairs) {
        const tie = playTie(rng, a.participant, b.participant, stage, competition, single);
        for (const side of [a, b]) {
          side.matches += single ? 1 : 2;
          side.steps?.push({ kind: 'tie', tie: tie.tieFor(side.participant) });
        }
        const winner = tie.winner.id === a.participant.id ? a : b;
        const loser = winner === a ? b : a;
        winner.furthest = deeper(winner.furthest, stage);
        winner.coefficientPoints += 1;
        loser.furthest = deeper(loser.furthest, stage);
        loser.eliminated = true;
        survivors.push(winner);
      }
      return survivors;
    };

    /*
     * Knockout play-off: 9th meets 24th, 10th meets 23rd - the standings ARE the bracket. The
     * pairing is written against however many clubs the phase actually holds, so a short table
     * (an exhausted fill pool in an artificial test world) degrades to byes instead of crashing;
     * the format tests assert the real world always brings exactly 16 here.
     */
    const playoffPairs: [Campaign, Campaign][] = [];
    const byes: Campaign[] = [];
    for (let i = 0; i < Math.floor(playoffField.length / 2); i += 1) {
      playoffPairs.push([playoffField[i]!, playoffField[playoffField.length - 1 - i]!]);
    }
    if (playoffField.length % 2 === 1) byes.push(playoffField[Math.floor(playoffField.length / 2)]!);
    const playoffWinners = [...playRound(playoffPairs, 'ko_playoff'), ...byes];

    const r16Pairs: [Campaign, Campaign][] = [];
    const r16Field = [...direct, ...playoffWinners];
    for (let i = 0; i < Math.floor(r16Field.length / 2); i += 1) {
      r16Pairs.push([r16Field[i]!, r16Field[r16Field.length - 1 - i]!]);
    }
    const quarterFinalists = playRound(r16Pairs, 'r16');
    const qfPairs: [Campaign, Campaign][] = [];
    for (let i = 0; i < Math.floor(quarterFinalists.length / 2); i += 1) {
      qfPairs.push([quarterFinalists[i]!, quarterFinalists[quarterFinalists.length - 1 - i]!]);
    }
    const semiFinalists = playRound(qfPairs, 'qf');
    for (const campaign of semiFinalists) campaign.reachedSemiFinal = true;
    const sfPairs: [Campaign, Campaign][] = [];
    for (let i = 0; i < Math.floor(semiFinalists.length / 2); i += 1) {
      sfPairs.push([semiFinalists[i]!, semiFinalists[semiFinalists.length - 1 - i]!]);
    }
    const finalPair = playRound(sfPairs, 'sf');
    for (const campaign of finalPair) campaign.reachedFinal = true;
    const [champion] = playRound([[finalPair[0]!, finalPair[1]!]], 'final', true);
    champion!.furthest = 'champion';
    champion!.wonCompetition = competition;
    champion!.eliminated = false;
    champion!.coefficientPoints += 5;
    champion!.steps?.push({ kind: 'champion', competition });
    winners[competition] = { clubId: champion!.participant.id, name: champion!.participant.name };
  }

  /* ---- Package the season ---- */
  const journeyOf = (clubId: string): EuropeanJourney | null => {
    const campaign = campaigns.get(clubId);
    if (!campaign || !campaign.steps) return null;
    return {
      season,
      clubId,
      steps: campaign.steps,
      finalCompetition: campaign.competition,
      furthest: campaign.furthest,
      matches: campaign.matches,
      wonCompetition: campaign.wonCompetition,
      reachedFinal: campaign.reachedFinal,
      reachedSemiFinal: campaign.reachedSemiFinal,
      reachedLeaguePhase: campaign.reachedLeaguePhase,
    };
  };

  const points = new Map<string, { points: number; association: string }>();
  for (const campaign of campaigns.values()) {
    if (campaign.coefficientPoints > 0) {
      points.set(campaign.participant.id, {
        points: campaign.coefficientPoints,
        association: campaign.participant.association,
      });
    }
  }

  const winnersFromLeaguePhase = (Object.keys(winners) as UefaCompetitionId[]).every((competition) => {
    const campaign = campaigns.get(winners[competition]!.clubId);
    return !!campaign && campaign.reachedLeaguePhase && campaign.wonCompetition === competition;
  });

  return {
    state: {
      season,
      entries: [...entries],
      winners,
      playerJourney: journeyOf(career.currentClubId),
      maccabiJourney: career.currentClubId === MACCABI_ID ? null : journeyOf(MACCABI_ID),
    },
    points,
    audit: {
      leaguePhaseSizes: {
        uefa_champions_league: leaguePhase.uefa_champions_league.length,
        uefa_europa_league: leaguePhase.uefa_europa_league.length,
        uefa_conference_league: leaguePhase.uefa_conference_league.length,
      },
      winnersFromLeaguePhase,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Coefficients                                                        */
/* ------------------------------------------------------------------ */

const DECAY = 0.8;

/**
 * Rolls the coefficient window forward one season.
 *
 * Exponential decay at 0.8 approximates the real five-season window (a result is worth ~33% of
 * its original weight five seasons on) with one number per club instead of five buckets.
 * Associations move by their clubs' average points, so a league whose entrants keep winning in
 * Europe climbs - and with it, in time, its access band. This is the world-evolution lever.
 */
export function rollCoefficients(
  europe: EuropeState,
  season: EuropeanSeasonState,
  pointsByClub: ReadonlyMap<string, { points: number; association: string }>,
): EuropeState {
  const clubs: Record<string, number> = {};
  for (const [clubId, value] of Object.entries(europe.coefficients.clubs)) {
    const kept = value * DECAY;
    if (kept > 0.5) clubs[clubId] = kept;
  }
  const associationTotals = new Map<string, { sum: number; count: number }>();
  for (const [clubId, result] of pointsByClub) {
    clubs[clubId] = (clubs[clubId] ?? 0) + result.points;
    const bucket = associationTotals.get(result.association) ?? { sum: 0, count: 0 };
    bucket.sum += result.points;
    bucket.count += 1;
    associationTotals.set(result.association, bucket);
  }
  const associations: Record<string, number> = {};
  for (const [name, value] of Object.entries(europe.coefficients.associations)) {
    associations[name] = value * DECAY;
  }
  for (const [name, bucket] of associationTotals) {
    associations[name] = (associations[name] ?? 0) + bucket.sum / Math.max(1, bucket.count);
  }
  return {
    ...europe,
    coefficients: { clubs, associations },
    history: [...europe.history, { season: season.season, winners: season.winners }].slice(-30),
  };
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

/** The empty Europe shell for new careers and pre-v0.8 saves. */
export function emptyEuropeState(): EuropeState {
  return { current: null, nextEntries: undefined, coefficients: { associations: {}, clubs: {} }, history: [] };
}

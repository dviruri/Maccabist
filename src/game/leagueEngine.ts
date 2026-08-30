/**
 * The live league table (v0.4.6).
 *
 * v0.4 gave a club season a *category* — champion, mid_table, relegated — drawn at season end.
 * That was enough to colour a season summary and nothing else, and it produced the bug this
 * version exists to fix: `planSeason` picks every event for the year at **preseason**, so a
 * late-slot "title decider" was chosen months before anyone knew the club would finish eleventh.
 * No amount of per-event patching can fix an ordering problem.
 *
 * So the shape of the season is now decided up front:
 *
 *   preseason   project the club's finish, and a path through the season that reaches it
 *   any phase   derive a full table from that path, deterministically
 *   events      gate on `leagueContext`, which reads the path
 *   season end  the recorded outcome *is* the projected outcome
 *
 * The table is never stored. It is a pure function of the projection plus a seed, which means a
 * save holds a dozen numbers rather than a table per phase, and a reloaded season reproduces the
 * same table to the point.
 *
 * The invariant that matters: **the table can never contradict the season outcome**, because the
 * outcome is derived from the table's final position rather than drawn alongside it.
 */

import { CLUBS, getClub, MACCABI_ID } from '../data/clubs';
import { getLeague } from '../data/leagues';
import { hasTable, leagueShape, type LeagueShape } from '../data/leagueShape';

import type {
  Career,
  ClubSeasonOutcome,
  LeagueContext,
  LeagueTable,
  SeasonPhase,
  SeasonProjection,
  SeasonRecord,
  TableRow,
  WorldState,
} from '../types';
import { WORLD } from './balance';
import { clamp, createRng, type Rng } from './random';
import { clubStrengthVsLeague, leagueMembership, leagueOf, playerImpact } from './worldEngine';

/* ------------------------------------------------------------------ */
/* Position <-> outcome                                                */
/* ------------------------------------------------------------------ */

/**
 * What a finishing position means.
 *
 * This is the single bridge between the table and the rest of the game. Every claim about a
 * season — "we were in a title race", "we went down" — resolves through here, so a position and
 * an outcome can never disagree.
 */
export function outcomeForPosition(
  leagueId: string,
  position: number,
  shape: LeagueShape,
): ClubSeasonOutcome {
  const league = getLeague(leagueId);
  const { size, relegationPlaces, promotionPlaces, europePlaces } = shape;

  if (league.tier >= 2) {
    if (promotionPlaces > 0 && position <= promotionPlaces) return 'promoted';
    if (position <= promotionPlaces + 2) return 'promotion_challenge';
    if (position <= Math.ceil(size / 2)) return 'second_upper_half';
    if (position <= size - relegationPlaces - 2) return 'second_mid_table';
    if (position <= size - relegationPlaces) return 'second_lower_half';
    return 'struggled';
  }

  if (position === 1) return 'champion';
  if (position <= 3) return 'title_challenge';
  if (europePlaces > 0 && position <= europePlaces + 2) return 'european_places';
  if (position <= Math.ceil(size / 2)) return 'upper_table';
  if (position <= size - relegationPlaces - 3) return 'mid_table';
  if (position <= size - relegationPlaces - 1) return 'lower_table';
  if (position <= size - relegationPlaces) return 'relegation_battle';
  return 'relegated';
}

/**
 * The band of positions that produce a given outcome.
 *
 * Used to keep the season's path honest: a club whose season is a relegation battle may bounce
 * around inside the bottom of the table, but it may not appear third in March.
 */
export function positionsForOutcome(
  leagueId: string,
  outcome: ClubSeasonOutcome,
  shape: LeagueShape,
): number[] {
  const all: number[] = [];
  for (let p = 1; p <= shape.size; p += 1) {
    if (outcomeForPosition(leagueId, p, shape) === outcome) all.push(p);
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* Projecting a season                                                 */
/* ------------------------------------------------------------------ */

/**
 * How the club is expected to do, before a ball is kicked.
 *
 * Strength against the division sets the centre, the player nudges it, and variance does the
 * rest — the same model v0.4 used, moved to the start of the season so events can see it.
 *
 * The player's contribution is read from the season he has just *finished*, because that is the
 * only evidence that exists in August. That is a real modelling choice rather than a shortcut: a
 * squad's league position is not decided in June by one player's form, and a preseason projection
 * is exactly the kind of thing that leans on last year. His actual season still moves the final
 * position — see `settleProjection` — just not across the narrative boundary the events were
 * planned against.
 */
export function projectSeason(
  world: WorldState,
  clubId: string,
  season: number,
  lastRecord: SeasonRecord | null,
  impactCareer: Career | null,
  rng: Rng,
): SeasonProjection | null {
  const league = leagueOf(world, clubId);
  const shape = leagueShape(league.id);
  if (!shape || !hasTable(league.id)) return null;

  const strength = clubStrengthVsLeague(world, clubId);
  const impact = impactCareer ? playerImpact(impactCareer, lastRecord) : 0;

  /*
   * Strength maps onto the table directly: the middle of the division, shifted by how far above
   * or below the level this squad is. `strengthToPositions` is expressed in outcome rungs, so it
   * is scaled to the table's size to mean the same thing in a 12-club and a 20-club league.
   */
  const perRung = shape.size / 8;
  const centre =
    (shape.size + 1) / 2 -
    (strength * WORLD.strengthToPositions + impact * WORLD.impactToPositions) * perRung;

  const finalPosition = Math.round(
    clamp(centre + rng.normal(0, shape.size * WORLD.tableVariance), 1, shape.size),
  );
  const finalOutcome = outcomeForPosition(league.id, finalPosition, shape);

  return {
    season,
    clubId,
    leagueId: league.id,
    leagueSize: shape.size,
    finalPosition,
    finalOutcome,
    path: buildPath(league.id, finalPosition, shape, rng),
    tableSeed: Math.floor(rng.next() * 0x7fffffff),
  };
}

/**
 * The route to that finish.
 *
 * Early season wanders — a club can be fourth after five matches and tenth by Christmas, and
 * that is one of the things that makes a season feel like a season. The wandering then narrows,
 * and by the late phase the club must already be inside the band its final outcome describes.
 *
 * That last constraint is the whole point. It is what makes "you cannot get a title-decider event
 * in a season you finish eleventh" true by construction rather than by a check somewhere.
 */
function buildPath(
  leagueId: string,
  finalPosition: number,
  shape: LeagueShape,
  rng: Rng,
): Record<SeasonPhase, number> {
  const band = positionsForOutcome(leagueId, outcomeForPosition(leagueId, finalPosition, shape), shape);
  const bandLow = Math.min(...band);
  const bandHigh = Math.max(...band);

  const wander = (spread: number, low: number, high: number): number =>
    Math.round(clamp(finalPosition + rng.normal(0, spread), low, high));

  return {
    // August: anything plausible. A fifth of the table either way.
    early: wander(shape.size * 0.18, 1, shape.size),
    // January: converging, but not yet committed.
    mid: wander(shape.size * 0.1, 1, shape.size),
    /*
     * April: inside the band. A club in a relegation battle in April finishes in the relegation
     * places or just above them - it does not finish third, and it is not shown third.
     */
    late: wander(1.2, bandLow, bandHigh),
    end: finalPosition,
  };
}

/**
 * Applies the player's actual season to the projection.
 *
 * He gets to move the club, but only inside the band his season was planned against. Letting the
 * final position cross into another outcome would put back exactly the contradiction this system
 * removes: a late-season title race that ends in mid-table.
 */
export function settleProjection(
  projection: SeasonProjection,
  career: Career,
  record: SeasonRecord | null,
): SeasonProjection {
  const shape = leagueShape(projection.leagueId);
  if (!shape) return projection;

  const impact = playerImpact(career, record);
  if (impact === 0) return projection;

  const band = positionsForOutcome(projection.leagueId, projection.finalOutcome, shape);
  const low = Math.min(...band);
  const high = Math.max(...band);

  // Up the table is a lower number, so a positive impact subtracts.
  const moved = Math.round(clamp(projection.finalPosition - impact * 2, low, high));
  if (moved === projection.finalPosition) return projection;

  return { ...projection, finalPosition: moved, path: { ...projection.path, end: moved } };
}

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every club in a division this season.
 *
 * v0.6.5.1: reads `leagueMembership` in worldEngine - one answer to "who is in this league",
 * shared with the balancer and the size invariant, so the table cannot disagree with the world
 * about who exists. It then ASSERTS the count.
 *
 * The old version returned whatever it found and `buildTable` sliced to `shape.size`. That is
 * how a promoted club vanished: the world said seventeen, the table drew sixteen, and nothing
 * anywhere said the two disagreed. Truncation is exactly the kind of quiet repair v0.4.8 exists
 * to forbid, so this throws instead.
 */
function membership(
  world: WorldState,
  leagueId: string,
): Array<{ clubId: string; name: string; quality: number }> {
  const shape = leagueShape(leagueId);
  const ids = leagueMembership(world, leagueId);

  if (shape && ids.length !== shape.size) {
    throw new Error(
      `league membership corrupt: ${leagueId} holds ${ids.length} clubs, expected ${shape.size}`,
    );
  }

  const rows = ids.map((clubId) => {
    const club = CLUBS[clubId]!;
    return { clubId, name: club.shortName ?? club.name, quality: club.quality };
  });
  rows.sort((a, b) => b.quality - a.quality);
  return rows;
}

/**
 * The table at a given phase.
 *
 * Everyone except the player's club is ordered by quality with a seeded wobble, so the table is
 * plausible and identical every time it is drawn for the same season. The player's club is then
 * *inserted* at the position its projection says it occupies — the projection is the truth, and
 * the rest of the division arranges itself around it.
 */
export function buildTable(
  world: WorldState,
  projection: SeasonProjection,
  phase: SeasonPhase,
  /**
   * Another club whose position is also decided elsewhere (v0.4.6).
   *
   * Maccabi is projected in parallel so it has a season wherever the player is. When the player
   * happens to be in Maccabi's division, that parallel projection and this table were two
   * separate answers to the same question - the panel said Maccabi were top while the table above
   * it showed them third. Pinning both projections into one table makes them the same answer.
   */
  alsoPin?: SeasonProjection | null,
): LeagueTable {
  const shape = leagueShape(projection.leagueId);
  if (!shape) return { leagueId: projection.leagueId, season: projection.season, phase, rows: [] };

  const clubs = membership(world, projection.leagueId);
  const rng = createRng((projection.tableSeed ^ phaseSalt(phase)) >>> 0);

  const pins = new Map<number, string>();
  const place = (clubId: string, position: number): void => {
    let slot = clamp(position, 1, shape.size);
    // Two projections can want the same place; the second takes the nearest free one.
    for (let step = 0; step <= shape.size; step += 1) {
      const down = slot + step;
      const up = slot - step;
      if (down <= shape.size && !pins.has(down)) { slot = down; break; }
      if (up >= 1 && !pins.has(up)) { slot = up; break; }
    }
    if (!pins.has(slot)) pins.set(slot, clubId);
  };

  place(projection.clubId, projection.path[phase] ?? projection.finalPosition);
  if (
    alsoPin &&
    alsoPin.clubId !== projection.clubId &&
    alsoPin.leagueId === projection.leagueId &&
    clubs.some((c) => c.clubId === alsoPin.clubId)
  ) {
    place(alsoPin.clubId, alsoPin.path[phase] ?? alsoPin.finalPosition);
  }

  const pinned = new Set(pins.values());
  const others = clubs
    .filter((c) => !pinned.has(c.clubId))
    .map((c) => ({ ...c, sortKey: c.quality + rng.normal(0, 6) }))
    .sort((a, b) => b.sortKey - a.sortKey);

  const ordered: Array<{ clubId: string; name: string }> = [];
  for (let position = 1; position <= shape.size; position += 1) {
    const pinnedId = pins.get(position);
    if (pinnedId) {
      const club = clubs.find((c) => c.clubId === pinnedId);
      ordered.push(club ?? { clubId: pinnedId, name: getClub(pinnedId).name });
    } else {
      const next = others.shift();
      if (next) ordered.push(next);
    }
  }

  const played = matchesPlayed(phase, shape.size);
  const points = pointsColumn(shape.size, played, rng);
  const rows: TableRow[] = ordered.map((club, index) => ({
    clubId: club.clubId,
    name: club.name,
    position: index + 1,
    played,
    points: points[index] ?? 0,
    goalDifference: goalDifferenceFor(index + 1, shape.size, played),
  }));

  return { leagueId: projection.leagueId, season: projection.season, phase, rows };
}

/** A different arrangement each phase, but the same one every time that phase is drawn. */
function phaseSalt(phase: SeasonPhase): number {
  return { early: 0x1111, mid: 0x2222, late: 0x3333, end: 0x4444 }[phase];
}

/** How far through the season each phase is. A double round-robin, so 2*(size-1) matches. */
export function matchesPlayed(phase: SeasonPhase, size: number): number {
  const total = (size - 1) * 2;
  const share = { early: 0.2, mid: 0.5, late: 0.85, end: 1 }[phase];
  return Math.max(1, Math.round(total * share));
}

/**
 * The points column, top to bottom.
 *
 * Generated as a descending sequence rather than one value per position independently. The first
 * version drew each row from a curve plus noise, which let 12th finish a point above 11th - a
 * table that contradicts its own ordering, which is precisely the class of incoherence this
 * version exists to remove.
 *
 * The curve itself is plausible rather than simulated: the leader takes roughly two points a
 * game, the bottom club roughly one, and it is slightly convex so the gap between 1st and 2nd is
 * smaller than between 13th and 14th. Equal points are allowed, because real tables have them.
 */
function pointsColumn(size: number, played: number, rng: Rng): number[] {
  const topRate = 2.15;
  const bottomRate = 0.85;
  const curve = (position: number): number => {
    const t = (position - 1) / Math.max(1, size - 1);
    return (topRate - (topRate - bottomRate) * t ** 1.15) * played;
  };

  const out: number[] = [Math.max(0, Math.round(curve(1) + rng.normal(0, played * 0.05)))];
  for (let position = 2; position <= size; position += 1) {
    const gap = Math.max(0, Math.round(curve(position - 1) - curve(position) + rng.normal(0, 1.4)));
    out.push(Math.max(0, (out[position - 2] ?? 0) - gap));
  }
  return out;
}

function goalDifferenceFor(position: number, size: number, played: number): number {
  const t = (position - 1) / Math.max(1, size - 1);
  return Math.round((1 - t * 2) * played * 0.75);
}

/* ------------------------------------------------------------------ */
/* What the club is fighting for                                       */
/* ------------------------------------------------------------------ */

/**
 * The authoritative answer to "what is this season about, right now".
 *
 * Every event that claims a title race, a relegation battle, a promotion push or a European
 * chase must gate on this. Nothing else is allowed to decide.
 */
export function leagueContextFrom(
  world: WorldState,
  projection: SeasonProjection,
  phase: SeasonPhase,
  /*
   * The same pin `buildTable` takes, and for the same reason. Without it the context computed
   * its gaps from an *unpinned* table while the UI drew a pinned one, so the panel could say
   * "four points off Europe" above a table where the gap was three. One table, one answer.
   */
  alsoPin?: SeasonProjection | null,
): LeagueContext {
  const shape = leagueShape(projection.leagueId);
  const table = buildTable(world, projection, phase, alsoPin);
  const size = shape?.size ?? projection.leagueSize;
  const position = clamp(projection.path[phase] ?? projection.finalPosition, 1, size);
  const row = table.rows[position - 1];
  const points = row?.points ?? 0;
  const played = row?.played ?? matchesPlayed(phase, size);

  const pointsAt = (p: number): number | null => table.rows[p - 1]?.points ?? null;
  const europePlaces = shape?.europePlaces ?? 0;
  const relegationPlaces = shape?.relegationPlaces ?? 0;
  const promotionPlaces = shape?.promotionPlaces ?? 0;

  const leaderPoints = pointsAt(1) ?? points;
  const remaining = (size - 1) * 2 - played;
  const maxSwing = remaining * 3;

  const europeCut = europePlaces > 0 ? pointsAt(europePlaces) : null;
  const safetyCut = relegationPlaces > 0 ? pointsAt(size - relegationPlaces) : null;
  const promotionCut = promotionPlaces > 0 ? pointsAt(promotionPlaces) : null;

  /*
   * A "race" needs two things: being close enough on points, and there being enough season left
   * for it to matter. Both, deliberately - a club six points off top in August is in a title race
   * and the same club six points off in May is not.
   */
  const inRange = (gap: number | null, window: number): boolean =>
    gap !== null && Math.abs(gap) <= window && remaining > 0;

  const titleWindow = phase === 'late' ? 8 : 14;
  const raceWindow = phase === 'late' ? 6 : 12;

  const titleRace = position <= 4 && inRange(leaderPoints - points, titleWindow);
  const europeRace =
    europeCut !== null &&
    !titleRace &&
    position <= europePlaces + 4 &&
    inRange(europeCut - points, raceWindow);
  const relegationBattle =
    safetyCut !== null && position >= size - relegationPlaces - 2 && inRange(points - safetyCut, raceWindow);
  const promotionRace =
    promotionCut !== null && position <= promotionPlaces + 3 && inRange(promotionCut - points, raceWindow);

  const strength = clubStrengthVsLeague(world, projection.clubId);
  const expected = (size + 1) / 2 - strength * (size / 4);

  return {
    leagueId: projection.leagueId,
    phase,
    position,
    leagueSize: size,
    points,
    played,
    pointsFromTop: Math.max(0, leaderPoints - points),
    pointsFromEurope: europeCut === null ? null : europeCut - points,
    pointsFromSafety: safetyCut === null ? null : points - safetyCut,
    pointsFromPromotion: promotionCut === null ? null : promotionCut - points,
    titleRace,
    europeRace,
    midTable: !titleRace && !europeRace && !relegationBattle && !promotionRace,
    relegationBattle,
    promotionRace,
    // Mathematically settled, which is the only honest meaning of "clinched".
    championClinched: position === 1 && leaderPoints - (pointsAt(2) ?? 0) > maxSwing,
    promotionClinched:
      promotionCut !== null &&
      position <= promotionPlaces &&
      points - (pointsAt(promotionPlaces + 1) ?? 0) > maxSwing,
    relegationConfirmed:
      safetyCut !== null && position > size - relegationPlaces && safetyCut - points > maxSwing,
    overperforming: position <= expected - size * 0.15,
    underperforming: position >= expected + size * 0.15,
  };
}

/* ------------------------------------------------------------------ */
/* Reading it off a career                                             */
/* ------------------------------------------------------------------ */

/** The phase the career is currently in, for table purposes. */
export function currentPhase(career: Career): SeasonPhase {
  if (career.seasonPoint === 'season_end') return 'end';
  return career.seasonSlot;
}

/** The player's club's projection for this season, if the league has a table at all. */
export function currentProjection(career: Career): SeasonProjection | null {
  const projection = career.world.projection;
  if (!projection) return null;
  if (projection.season !== career.currentSeason) return null;
  if (projection.clubId !== career.currentClubId) return null;
  return projection;
}

/**
 * What the player's club is fighting for at a given phase, or null in youth football.
 *
 * The phase is a parameter because event planning needs it to be. `planSeason` chooses the whole
 * season at preseason, so a late-slot event has to be judged against the table as it will be in
 * April - not as it is in August. Reading `currentPhase` here instead gated every late-slot
 * title event on the early-season table, and since a title race is not usually decided in August
 * the result was that `sen_title_run_in` and `sen_title_penalty` became unreachable: fired 0
 * times in 1,500 careers. A condition that makes an event impossible is not a fix.
 */
export function leagueContextAt(career: Career, phase: SeasonPhase): LeagueContext | null {
  const projection = currentProjection(career);
  if (!projection) return null;
  return leagueContextFrom(career.world, projection, phase, career.world.maccabiProjection);
}

/** What the player's club is fighting for right now, or null in youth football. */
export function currentLeagueContext(career: Career): LeagueContext | null {
  return leagueContextAt(career, currentPhase(career));
}

/** The player's club's table right now, or null in youth football. */
export function currentTable(career: Career): LeagueTable | null {
  const projection = currentProjection(career);
  if (!projection) return null;
  return buildTable(career.world, projection, currentPhase(career), career.world.maccabiProjection);
}

/** Maccabi's own projection, which exists whether or not the player is there. */
export function maccabiProjection(career: Career): SeasonProjection | null {
  if (career.currentClubId === MACCABI_ID) return currentProjection(career);
  const projection = career.world.maccabiProjection;
  return projection && projection.season === career.currentSeason ? projection : null;
}

/**
 * Where Maccabi stands right now, for the side panel and the ambient events.
 *
 * When Maccabi share the player's division the answer is read off *his* table rather than from
 * their own projection, because the pinning above may have had to nudge them a place to avoid a
 * collision. Reading the projection instead would put the footnote and the table it sits under
 * one row apart, which is the same contradiction in miniature.
 */
export function maccabiLeagueContext(career: Career): LeagueContext | null {
  const projection = maccabiProjection(career);
  if (!projection) return null;

  const own = currentProjection(career);
  if (own && own.leagueId === projection.leagueId && own.clubId !== MACCABI_ID) {
    const table = currentTable(career);
    const row = table?.rows.find((r) => r.clubId === MACCABI_ID);
    if (row) {
      return {
        ...leagueContextFrom(career.world, projection, currentPhase(career), own),
        position: row.position,
        points: row.points,
        played: row.played,
      };
    }
  }

  return leagueContextFrom(career.world, projection, currentPhase(career));
}

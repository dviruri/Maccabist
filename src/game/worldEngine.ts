/**
 * The football world outside the player (v0.4).
 *
 * A season-level simulation, not a match engine. Every season the player's club gets a
 * *category* of finish, drawn from its strength against its league, with the player nudging
 * the odds in proportion to how important he actually was. That is enough to give a career
 * real context - a relegation to fight out of, a promotion to be part of, a European place
 * that changes what offers arrive - without running fixtures for leagues nobody sees.
 *
 * Cheap by design: a handful of RNG calls per season, so 100,000 careers stay practical.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { defaultLeagueFor, getLeague, type League } from '../data/leagues';
import type { Career, ClubSeasonOutcome, ClubSeasonResult, SeasonRecord, WorldState } from '../types';
import { ALEF_DISTRICT_BY_CLUB } from '../data/worldClubs';
import { projectCup } from './cupEngine';
import { projectSeason, settleProjection } from './leagueEngine';
import { WORLD } from './balance';
import { clamp, type Rng } from './random';

/* ------------------------------------------------------------------ */
/* League lookup                                                       */
/* ------------------------------------------------------------------ */

export function emptyWorld(): WorldState {
  return { clubLeagues: {}, clubSeasons: [] };
}

/** Which league a club is in right now, after any promotions or relegations this career. */
export function leagueOf(world: WorldState, clubId: string): League {
  const moved = world.clubLeagues[clubId];
  if (moved) return getLeague(moved);
  const club = getClub(clubId);
  return getLeague(defaultLeagueFor(club.tier, club.country, club.id));
}

export function playerLeague(career: Career): League {
  return leagueOf(career.world, career.currentClubId);
}

/* ------------------------------------------------------------------ */
/* How good is this club, for this league?                             */
/* ------------------------------------------------------------------ */

/**
 * A club's standing relative to the division it is in, roughly -1..+1.
 *
 * This is what makes promotion and relegation matter: the same club is a title contender in
 * the second division and a relegation candidate in the first.
 */
export function clubStrengthVsLeague(world: WorldState, clubId: string): number {
  const club = getClub(clubId);
  const league = leagueOf(world, clubId);
  return clamp((club.quality - league.quality) / WORLD.strengthSpread, -1, 1);
}

/**
 * How much the player moved his club's season, 0-1.
 *
 * A backup barely registers; a star who played almost every game and performed clearly does.
 * Deliberately reads role, minutes and performance together, so a big name who sat out the
 * season does not get credit for the title.
 */
export function playerImpact(career: Career, record: SeasonRecord | null): number {
  if (!record) return 0;
  const league = leagueOf(career.world, record.clubId);
  const games = Math.max(1, getClub(record.clubId).seasonGames);

  const share = clamp(record.stats.appearances / games, 0, 1);
  if (share < WORLD.impactMinShare) return 0;

  // How far above the level he actually is.
  const edge = clamp((record.ability - league.quality) / WORLD.impactEdgeSpread, -0.5, 1);
  const performance = clamp((record.stats.rating - 58) / 30, -0.5, 1);
  const standing = clamp((record.coachTrust - 45) / 60, -0.3, 0.6);

  const raw = share * (edge * 0.55 + performance * 0.3 + standing * 0.15);
  /*
   * Impact can now be negative (v0.4.1), but only a little.
   *
   * A key player having a genuinely bad season should nudge his club's outcome down - otherwise
   * the player's performance is a one-way ratchet and the world only ever rewards him. The floor
   * is deliberately a fraction of the ceiling: a footballer can help win a league, but no single
   * player relegates a club on his own, and the game should not imply he did.
   *
   * A backup barely registers either way, because `share` scales the whole term.
   */
  return clamp(raw * WORLD.impactScale, -WORLD.impactMinimum, WORLD.impactMax);
}

/* ------------------------------------------------------------------ */
/* The season result                                                   */
/* ------------------------------------------------------------------ */

const TOP_OUTCOMES: readonly ClubSeasonOutcome[] = [
  'relegated',
  'relegation_battle',
  'lower_table',
  'mid_table',
  'upper_table',
  'european_places',
  'title_challenge',
  'champion',
];

/*
 * Six rungs, not four (v0.4.5.1).
 *
 * With four, 'promoted' was one outcome in four - a 25% base rate before any strength adjustment -
 * and measurement put **51% of all second-division seasons** in promotion. Real football is nearer
 * 15%: three clubs of roughly twenty go up. The second division was a revolving door by
 * construction, and no amount of variance tuning could fix a ladder that short.
 *
 * Deliberately still shorter than the top flight's eight, because a second division has less
 * distance between "nearly went up" and "nearly went down" in a career's terms.
 */
const SECOND_OUTCOMES: readonly ClubSeasonOutcome[] = [
  'struggled',
  'second_lower_half',
  'second_mid_table',
  'second_upper_half',
  'promotion_challenge',
  'promoted',
];

const OUTCOME_LABELS: Record<ClubSeasonOutcome, string> = {
  champion: 'אלופה',
  title_challenge: 'מאבק על האליפות',
  european_places: 'מאבק על מקומות אירופה',
  upper_table: 'חלק עליון בטבלה',
  mid_table: 'אמצע הטבלה',
  lower_table: 'חלק תחתון בטבלה',
  relegation_battle: 'מאבק הישרדות',
  relegated: 'ירידה ליגה',
  promoted: 'עלייה ליגה',
  promotion_challenge: 'מאבק על עלייה',
  second_upper_half: 'חצי טבלה עליון',
  second_mid_table: 'אמצע הטבלה',
  second_lower_half: 'חצי טבלה תחתון',
  struggled: 'עונה קשה',
};

export function outcomeLabel(outcome: ClubSeasonOutcome): string {
  return OUTCOME_LABELS[outcome];
}

/** Outcomes that are good enough to be worth remembering. */
export function isGoodSeason(outcome: ClubSeasonOutcome): boolean {
  return ['champion', 'title_challenge', 'european_places', 'promoted', 'promotion_challenge'].includes(
    outcome,
  );
}

export function isBadSeason(outcome: ClubSeasonOutcome): boolean {
  return ['relegated', 'relegation_battle', 'struggled'].includes(outcome);
}

/**
 * Draws a season result for the player's club.
 *
 * A normal distribution over the ladder of outcomes: the club's strength for its division sets
 * the centre, the player's impact nudges it up, and season variance does the rest. Cheap, and
 * it produces the right shape - strong clubs usually finish high but occasionally implode.
 */
export function simulateClubSeason(
  career: Career,
  record: SeasonRecord | null,
  rng: Rng,
): ClubSeasonResult {
  const clubId = career.currentClubId;
  const league = leagueOf(career.world, clubId);
  const ladder = league.tier >= 2 ? SECOND_OUTCOMES : TOP_OUTCOMES;

  const strength = clubStrengthVsLeague(career.world, clubId);
  const impact = playerImpact(career, record);

  // Centre of the distribution, in ladder positions.
  const centre =
    (ladder.length - 1) / 2 +
    strength * WORLD.strengthToPositions +
    impact * WORLD.impactToPositions;

  // A real normal, so a dominant club can still have the season nobody saw coming.
  const noisy = centre + rng.normal(0, WORLD.seasonVariance);
  const index = Math.round(clamp(noisy, 0, ladder.length - 1));
  const outcome = ladder[index] as ClubSeasonOutcome;

  return {
    season: career.currentSeason,
    clubId,
    leagueId: league.id,
    outcome,
    label: OUTCOME_LABELS[outcome],
    playerImpact: Math.round(impact * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Promotion and relegation                                            */
/* ------------------------------------------------------------------ */

/**
 * Moves a club between divisions after its season. Returns the world state; unchanged unless
 * the club actually went up or down.
 */
export function applyPromotionRelegation(world: WorldState, result: ClubSeasonResult): WorldState {
  const league = getLeague(result.leagueId);

  if (result.outcome === 'relegated' && league.relegatesTo) {
    return {
      ...world,
      clubLeagues: {
        ...world.clubLeagues,
        [result.clubId]: resolveRelegationLeague(result.clubId, league.relegatesTo),
      },
    };
  }
  if (result.outcome === 'promoted' && league.promotesTo) {
    return {
      ...world,
      clubLeagues: { ...world.clubLeagues, [result.clubId]: league.promotesTo },
    };
  }
  return world;
}

/**
 * Where a relegated club actually lands (v0.6.5).
 *
 * Liga Alef is regional, so Leumit's trapdoor cannot be one league id - a Haifa-area club goes
 * north and a Rehovot club goes south. `relegatesTo: 'il_alef'` is a district-resolved sentinel,
 * and this is the only place it is resolved: by the club's geography in ALEF_DISTRICT_BY_CLUB,
 * defaulting north for a club the map has never heard of (which the world validator prevents
 * from being a real case). Deterministic, no yearly-rebalancing model - WORLD_DATA.md records
 * the limitation.
 */
function resolveRelegationLeague(clubId: string, relegatesTo: string): string {
  if (relegatesTo !== 'il_alef') return relegatesTo;
  const district = ALEF_DISTRICT_BY_CLUB[clubId] ?? 'north';
  return district === 'south' ? 'il_alef_south' : 'il_alef_north';
}

/** Records a club season and applies any division change it caused. */
export function recordClubSeason(career: Career, result: ClubSeasonResult): WorldState {
  const withSeason: WorldState = {
    ...career.world,
    clubSeasons: [...career.world.clubSeasons, result].slice(-WORLD.keepClubSeasons),
  };
  return applyPromotionRelegation(withSeason, result);
}

/** The most recent club season, if there is one. */
export function lastClubSeason(career: Career): ClubSeasonResult | null {
  return career.world.clubSeasons[career.world.clubSeasons.length - 1] ?? null;
}

/**
 * The club season for a particular year. The season summary must look up by season rather than
 * take the last entry: a player whose club season was not simulated that year (an academy season,
 * for instance) would otherwise be shown last year's table finish as if it were this year's.
 */
export function clubSeasonFor(career: Career, season: number): ClubSeasonResult | null {
  return career.world.clubSeasons.find((s) => s.season === season) ?? null;
}

/* ------------------------------------------------------------------ */
/* The ambient Maccabi world (v0.4.1)                                  */
/* ------------------------------------------------------------------ */

/**
 * Maccabi has a season whether the player is there or not.
 *
 * v0.4 only simulated the player's own club, which meant that the moment he left, Maccabi
 * effectively stopped existing until he came back. That quietly undercuts the whole point of the
 * game: the club is supposed to be a fixed star he navigates by, not a location he is standing in.
 *
 * Deliberately the same model as any other club season, minus the player's impact - he is not
 * there. Cheap: one gaussian per season. No other club in the world is simulated, because no
 * other club is load-bearing for the story.
 */
export function simulateMaccabiSeason(career: Career, rng: Rng): ClubSeasonResult {
  const league = leagueOf(career.world, MACCABI_ID);
  const ladder = league.tier >= 2 ? SECOND_OUTCOMES : TOP_OUTCOMES;
  const strength = clubStrengthVsLeague(career.world, MACCABI_ID);

  const centre = (ladder.length - 1) / 2 + strength * WORLD.strengthToPositions;
  const index = Math.round(clamp(centre + rng.normal(0, WORLD.seasonVariance), 0, ladder.length - 1));
  const outcome = ladder[index] as ClubSeasonOutcome;

  return {
    season: career.currentSeason,
    clubId: MACCABI_ID,
    leagueId: league.id,
    outcome,
    label: OUTCOME_LABELS[outcome],
    // Zero by definition: he was somewhere else.
    playerImpact: 0,
  };
}

/**
 * Advances Maccabi's own season and files it, for a player who is elsewhere.
 *
 * Kept in `maccabiSeasons` rather than `clubSeasons` so the season summary still shows the
 * player's own club and nothing gets confused about whose campaign it was.
 */
export function recordMaccabiSeason(career: Career, rng: Rng): WorldState {
  if (career.currentClubId === MACCABI_ID) return career.world;

  const result = simulateMaccabiSeason(career, rng);
  const withSeason: WorldState = {
    ...career.world,
    maccabiSeasons: [...(career.world.maccabiSeasons ?? []), result].slice(-WORLD.keepClubSeasons),
  };
  return applyPromotionRelegation(withSeason, result);
}

/**
 * Maccabi's most recent season *that the player was not part of*.
 *
 * This is what the ambient events mean by "what did Maccabi just do" - the whole point is that it
 * happened without him. Reading his own Maccabi seasons here would have "they won it without you"
 * firing for a player who lifted the trophy himself.
 */
export function lastAmbientMaccabiSeason(career: Career): ClubSeasonResult | null {
  const ambient = career.world.maccabiSeasons ?? [];
  return ambient[ambient.length - 1] ?? null;
}

/** Maccabi's most recent season, wherever the player was. */
export function lastMaccabiSeason(career: Career): ClubSeasonResult | null {
  const own = career.world.clubSeasons.filter((s) => s.clubId === MACCABI_ID);
  const ambient = career.world.maccabiSeasons ?? [];
  const all = [...own, ...ambient].sort((a, b) => a.season - b.season);
  return all[all.length - 1] ?? null;
}

/** Every Maccabi season on record, whether the player was there or not. */
export function maccabiSeasons(career: Career): ClubSeasonResult[] {
  const own = career.world.clubSeasons.filter((s) => s.clubId === MACCABI_ID);
  return [...own, ...(career.world.maccabiSeasons ?? [])].sort((a, b) => a.season - b.season);
}

/** Did Maccabi win the league in a season the player was not there? */
export function maccabiWonTitleWithoutHim(career: Career): boolean {
  return (career.world.maccabiSeasons ?? []).some((s) => s.outcome === 'champion');
}

/** Seasons since Maccabi last had a good one, or null if they never have on record. */
export function seasonsSinceMaccabiSuccess(career: Career): number | null {
  const good = maccabiSeasons(career).filter((s) => isGoodSeason(s.outcome));
  const latest = good[good.length - 1];
  return latest ? career.currentSeason - latest.season : null;
}

/** True when Maccabi is having a genuinely bad time of it. */
export function maccabiInCrisis(career: Career): boolean {
  const last = lastMaccabiSeason(career);
  if (!last) return false;
  return isBadSeason(last.outcome) || leagueOf(career.world, MACCABI_ID).tier >= 2;
}

/* ------------------------------------------------------------------ */
/* The season, opened and settled (v0.4.6)                             */
/* ------------------------------------------------------------------ */

/**
 * Projects the player's club season, and Maccabi's, at preseason.
 *
 * Both are drawn here so that everything downstream - event eligibility, the table UI, the
 * Maccabi side panel - reads one committed answer rather than deriving its own. Youth football
 * gets no projection: an age group is not a league campaign, and `leagueShape` has no table for
 * it, so `projectSeason` returns null and every world-state condition simply fails to match.
 */
export function openWorldSeason(career: Career, rng: Rng): WorldState {
  const projection = projectSeason(
    career.world,
    career.currentClubId,
    career.currentSeason,
    career.lastSeasonRecord,
    career,
    rng,
  );

  /*
   * Maccabi's own season, whether the player is there or not. When he *is* there the two are the
   * same campaign, so the parallel projection is dropped rather than drawn twice - two draws
   * would let the side panel disagree with the main table about the club he plays for.
   */
  const maccabi =
    career.currentClubId === MACCABI_ID
      ? null
      : projectSeason(career.world, MACCABI_ID, career.currentSeason, null, null, rng);

  /*
   * The cup is projected here too (v0.6.2), and deliberately for every club - academy included.
   * `projectSeason` returns null where there is no modelled table, but a cup is a knockout: an age
   * group plays for a youth cup even though it has no league table to read.
   */
  const cup = projectCup(career, rng);

  return { ...career.world, projection, maccabiProjection: maccabi, cup };
}

/**
 * Lets the player's actual season move his club, then freezes the result.
 *
 * The move is bounded to the outcome band the projection committed to at preseason - see
 * `settleProjection`. He can be the reason they finished second rather than fourth; he cannot be
 * the reason a title race turned into mid-table after the events for it were already planned.
 */
export function settleWorldProjection(career: Career, rng: Rng): WorldState {
  const projection = career.world.projection;
  if (!projection || projection.season !== career.currentSeason) {
    /*
     * No projection: a save from before v0.4.6, or a club whose league has no table. Draw one now
     * so the season still records a result, rather than skipping the club season entirely.
     */
    const fresh = projectSeason(
      career.world,
      career.currentClubId,
      career.currentSeason,
      career.lastSeasonRecord,
      career,
      rng,
    );
    return { ...career.world, projection: fresh };
  }

  return {
    ...career.world,
    projection: settleProjection(projection, career, career.lastSeasonRecord),
  };
}

/**
 * The club season result, read off the settled projection.
 *
 * Falls back to the old draw only for a club in a league with no modelled table, which in
 * practice means nothing - every senior league has a shape - but keeps the function total.
 */
export function clubResultFromProjection(career: Career, rng: Rng): ClubSeasonResult {
  const projection = career.world.projection;
  if (!projection || projection.season !== career.currentSeason) {
    return simulateClubSeason(career, career.lastSeasonRecord, rng);
  }

  return {
    season: projection.season,
    clubId: projection.clubId,
    leagueId: projection.leagueId,
    outcome: projection.finalOutcome,
    label: OUTCOME_LABELS[projection.finalOutcome],
    playerImpact: Math.round(playerImpact(career, career.lastSeasonRecord) * 100) / 100,
    // v0.4.6: where the table actually finished, so the summary can say "4th" and not just "upper table".
    finalPosition: projection.finalPosition,
  };
}

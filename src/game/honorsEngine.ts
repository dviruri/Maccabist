import { getLeague } from '../data/leagues';
import { leagueScheduleBreakdown } from './leagueSchedule';
import { leagueLineFor } from './segmentEngine';
import { clamp, createRng, type Rng } from './random';
import type { Career, CompetitionLine, IndividualHonor, Position, SeasonRecord } from '../types';

/**
 * Individual league honors, decided against a simulated field (v0.7, Checkpoint B).
 *
 * ## League-relative, not threshold-based
 *
 * A player does not win מלך השערים by crossing a fixed number; he beats whoever else was
 * scoring in that league that year. The field is simulated - a handful of contender totals
 * drawn from the league's size and quality - so 23 goals wins some seasons and finishes
 * runner-up in others, which is what makes the crown worth something.
 *
 * ## Determinism without touching the career's rng
 *
 * The field is seeded from `career.seed ^ season ^ league`, never from the live rng stream.
 * Two consequences, both deliberate: the same career seed always produces the same award
 * results, and adding awards changed no existing career by a single event - a v0.6.x seed
 * replays byte-identically apart from the new fields.
 *
 * ## League stats only
 *
 * Every award reads the season's LEAGUE competition line, from engine-quality segments. Cup
 * goals do not make a top scorer; a `legacy_estimate` segment (pre-v0.7 save) has no known
 * league line at all and is skipped rather than approximated - old careers get reduced honors
 * reconstruction, documented, instead of invented ones.
 *
 * ## Stored, not recomputed
 *
 * A won award is pushed onto `career.honors` at settlement and never re-derived. Formula
 * changes in later versions must not quietly strip a career of an award it was shown winning.
 */

/* ------------------------------------------------------------------ */
/* The award field                                                     */
/* ------------------------------------------------------------------ */

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function awardRng(career: Career, season: number, leagueId: string, salt: string): Rng {
  return createRng((career.seed ^ Math.imul(season, 2654435761) ^ hashString(leagueId + salt)) >>> 0);
}

/** How many league fixtures a full season in this league holds. Quality-independent. */
function leagueGamesOf(leagueId: string): number {
  return leagueScheduleBreakdown(leagueId, 60, true).league;
}

function leagueQualityOf(leagueId: string): number {
  try {
    return getLeague(leagueId).quality;
  } catch {
    return 60;
  }
}

/**
 * The season's best rival total for a counting stat (goals, assists).
 *
 * Three contenders drawn against the league's full schedule; the best of them is the number to
 * beat. `rate` is per-league-game output for a crown contender - the scoring environment - and
 * scales gently with league quality: elite leagues have elite finishers, but the effect is
 * deliberately mild so lower leagues still produce real races.
 */
function bestRivalTotal(rng: Rng, leagueId: string, rateMin: number, rateMax: number): number {
  const games = leagueGamesOf(leagueId);
  const qualityFactor = 1 + (leagueQualityOf(leagueId) - 70) / 250;
  let best = 0;
  for (let i = 0; i < 3; i += 1) {
    best = Math.max(best, Math.round(games * rng.range(rateMin, rateMax) * qualityFactor));
  }
  return Math.max(1, best);
}

/**
 * The best of several uniform draws - the field's TOP performer, not a typical one.
 *
 * Taking the max bends the distribution hard toward the top of the band, which is the
 * calibration lever that matters: the first version drew ONE uniform rival and 85-93% of
 * careers won שחקן העונה at least once, which is award inflation - winning has to be the
 * exception that makes a season memorable, not the default ending of a decent year.
 */
function bestOf(rng: Rng, draws: number, min: number, max: number): number {
  let best = min;
  for (let i = 0; i < draws; i += 1) best = Math.max(best, rng.range(min, max));
  return best;
}

/**
 * The best rival's performance score for the quality-style awards.
 *
 * Anchored to the rating a top player in this league would produce: the engine's own rating
 * formula gives `46 + (ability - 50) * 0.42` before form and output, and a league's stars play
 * a little above its quality. The uniform band on top is the season - some years the league
 * has a runaway star, some years the door is open.
 */
function bestRivalScore(
  rng: Rng,
  leagueId: string,
  band: [number, number],
  options: { anchorAbove?: number; draws?: number } = {},
): number {
  const quality = leagueQualityOf(leagueId);
  const anchorAbove = options.anchorAbove ?? 14;
  // The league's best player plays well above its average quality; the engine's own rating
  // formula (46 + (ability - 50) * 0.42) translates that into the score to beat.
  return 46 + (quality + anchorAbove - 50) * 0.42 + bestOf(rng, options.draws ?? 3, band[0], band[1]);
}

/* ------------------------------------------------------------------ */
/* The player's season, scored                                         */
/* ------------------------------------------------------------------ */

/** How this club's season ended, as a score bonus. Read from the world's own record. */
function teamSeasonBonus(career: Career, season: number, clubId: string): number {
  const entry = career.world.clubSeasons.find((c) => c.season === season && c.clubId === clubId);
  switch (entry?.outcome) {
    case 'champion':
      return 6;
    case 'title_challenge':
    case 'promoted':
      return 4;
    case 'european_places':
    case 'promotion_challenge':
      return 3;
    case 'upper_table':
    case 'second_upper_half':
      return 1.5;
    case 'lower_table':
      return -1.5;
    case 'relegation_battle':
      return -3;
    case 'relegated':
      return -5;
    default:
      return 0;
  }
}

/**
 * Per-league-game attacking output a player of this position is EXPECTED to produce.
 *
 * This is what makes שחקן העונה position-aware instead of striker-only: a centre-back is not
 * punished for scoring like a centre-back. The bonus is the player's output relative to his own
 * position's expectation, clamped so one freak stat cannot buy the award by itself.
 */
const EXPECTED_OUTPUT: Record<Position, number> = {
  GK: 0.02,
  CB: 0.12,
  FB: 0.2,
  CM: 0.38,
  WG: 0.55,
  ST: 0.72,
};

function contributionBonus(position: Position, line: CompetitionLine): number {
  const apps = Math.max(1, line.appearances);
  if (position === 'GK') {
    // A keeper's output is the clean sheet, held to the same relative standard.
    const csRate = line.cleanSheets / apps;
    return clamp((csRate - 0.3) * 18, -3, 4);
  }
  const output = (line.goals + line.assists) / apps;
  const expected = EXPECTED_OUTPUT[position];
  return clamp(((output - expected) / Math.max(0.08, expected)) * 3, -3, 4);
}

/** The season score every quality award compares against the field. */
function performanceScore(career: Career, record: SeasonRecord, line: CompetitionLine): number {
  const minutesShare = line.teamGames > 0 ? line.appearances / line.teamGames : 0;
  return (
    record.stats.rating +
    minutesShare * 6 +
    teamSeasonBonus(career, record.season, record.clubId) +
    (record.captain ? 2 : 0) +
    contributionBonus(career.position, line)
  );
}

/* ------------------------------------------------------------------ */
/* Evaluation at settlement                                            */
/* ------------------------------------------------------------------ */

/** Age eligibility for השחקן הצעיר: 21 or younger in the award season. A senior-award rule - academy stages are irrelevant to it. */
export const YOUNG_PLAYER_MAX_AGE = 21;

/** Minimum share of the league schedule actually played before any quality award is possible. */
const MIN_SHARE = 0.5;
const YOUNG_MIN_SHARE = 0.35;

/**
 * Decides this season's league honors. Pure: returns the honors won, touching nothing.
 *
 * Runs per league the player appeared in this season - a mid-season move across leagues means
 * each league judges only the football played in it (a half-season of goals rarely beats a
 * full-season rival, and that is correct). Awards need engine-quality segments; legacy records
 * are skipped.
 */
export function evaluateSeasonHonors(career: Career, record: SeasonRecord): IndividualHonor[] {
  if (record.academyStage !== 'senior') return [];
  const honors: IndividualHonor[] = [];

  const leagueIds = [
    ...new Set(
      (record.segments ?? [])
        .filter((s) => s.breakdown === 'engine' && s.academyStage === 'senior' && s.leagueId)
        .map((s) => s.leagueId!),
    ),
  ];

  for (const leagueId of leagueIds) {
    const line = leagueLineFor(record.segments, leagueId);
    if (!line || line.appearances === 0) continue;
    const leagueName = (() => {
      try {
        return getLeague(leagueId).name;
      } catch {
        return record.league;
      }
    })();
    const clubId =
      (record.segments ?? []).find((s) => s.leagueId === leagueId)?.clubId ?? record.clubId;
    const base = {
      season: record.season,
      leagueId,
      league: leagueName,
      clubId,
      position: career.position,
      age: record.age,
    };
    const fullLeagueGames = leagueGamesOf(leagueId);
    const share = fullLeagueGames > 0 ? line.appearances / fullLeagueGames : 0;

    /* ---- the counting crowns ---- */

    const scorerRng = awardRng(career, record.season, leagueId, 'scorer');
    const scorerToBeat = bestRivalTotal(scorerRng, leagueId, 0.6, 1.0);
    if (line.goals > 0 && line.goals >= scorerToBeat) {
      honors.push({ ...base, type: 'top_scorer', statValue: line.goals });
    }

    const assistRng = awardRng(career, record.season, leagueId, 'assists');
    const assistsToBeat = bestRivalTotal(assistRng, leagueId, 0.36, 0.6);
    if (line.assists > 0 && line.assists >= assistsToBeat) {
      honors.push({ ...base, type: 'assists_leader', statValue: line.assists });
    }

    /* ---- the quality awards ---- */

    const score = performanceScore(career, record, line);

    if (share >= MIN_SHARE) {
      const posRng = awardRng(career, record.season, leagueId, 'player');
      if (score > bestRivalScore(posRng, leagueId, [11, 21], { anchorAbove: 20 })) {
        honors.push({ ...base, type: 'player_of_season', statValue: Math.round(record.stats.rating) });
      }
    }

    if (career.position === 'GK' && share >= MIN_SHARE) {
      // A keeper competes against the league's other keepers, a narrower and kinder field.
      const gkRng = awardRng(career, record.season, leagueId, 'goalkeeper');
      const gkScore =
        record.stats.rating +
        (line.appearances > 0 ? (line.cleanSheets / line.appearances) * 14 : 0) +
        teamSeasonBonus(career, record.season, record.clubId);
      if (gkScore > bestRivalScore(gkRng, leagueId, [8, 16], { anchorAbove: 16 })) {
        honors.push({ ...base, type: 'goalkeeper_of_season', statValue: line.cleanSheets });
      }
    }

    if (record.age <= YOUNG_PLAYER_MAX_AGE && share >= YOUNG_MIN_SHARE) {
      // The young field is genuinely weaker: the band sits lower than the open award's.
      const youngRng = awardRng(career, record.season, leagueId, 'young');
      if (score > bestRivalScore(youngRng, leagueId, [7, 15], { anchorAbove: 12, draws: 2 })) {
        honors.push({ ...base, type: 'young_player_of_season', statValue: Math.round(record.stats.rating) });
      }
    }
  }

  return honors;
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

export const HONOR_LABELS: Record<IndividualHonor['type'], string> = {
  top_scorer: 'מלך השערים',
  assists_leader: 'מלך הבישולים',
  player_of_season: 'שחקן העונה',
  goalkeeper_of_season: 'שוער העונה',
  young_player_of_season: 'השחקן הצעיר של העונה',
};

/** The stat caption an honor is shown with, e.g. "26 שערים". */
export function honorStatLabel(honor: IndividualHonor): string | null {
  if (honor.statValue === undefined) return null;
  switch (honor.type) {
    case 'top_scorer':
      return `${honor.statValue} שערים`;
    case 'assists_leader':
      return `${honor.statValue} בישולים`;
    case 'goalkeeper_of_season':
      return `${honor.statValue} שערים נקיים`;
    default:
      return null;
  }
}

import { getClub } from '../data/clubs';
import { leagueScheduleBreakdown } from './leagueSchedule';
import type {
  CompetitionLine,
  SeasonSegment,
  SeasonStats,
  TeamRole,
} from '../types';

/**
 * Season segments and competition lines (v0.7, Checkpoint A).
 *
 * ## What a segment is
 *
 * The engine simulates a season as two halves, and a mid-season move happens BETWEEN them - an
 * academy event can transfer the player after the first half is played. So the finest grain the
 * game truthfully knows is "one or two halves at one club", and that is exactly what a segment
 * is. Most seasons: one segment. A mid-season move: two, each keeping the stats and fixture
 * count of the football actually played there. No match-by-match database is invented.
 *
 * ## Why the competition split is deterministic and rng-free
 *
 * Individual matches are not simulated, so "which of his 20 goals were cup goals" is not a fact
 * the engine ever generated - but the fixture BASIS is: a 43-game Ligat Ha'Al season is 33
 * league, 2 cup, 8 continental, and the stats were produced against that whole. The split
 * apportions each stat across that composition by largest-remainder, with fixed tie-breaking,
 * so the same season always splits the same way, no rng stream is consumed (a v0.6.x save
 * replays byte-identically), and the lines ALWAYS sum back to the segment exactly.
 *
 * Once written at settlement the lines are stored history - the same rule as
 * `SeasonRecord.teamGames`. A future version that models real competitions must not touch them.
 */

/* ------------------------------------------------------------------ */
/* Apportioning                                                        */
/* ------------------------------------------------------------------ */

/**
 * Splits an integer total across weighted buckets so the parts sum back exactly.
 *
 * Largest-remainder method with caps: floor shares first, then hand out the remainder to the
 * largest fractional parts, never exceeding a bucket's cap. Ties break by bucket order, which
 * is fixed (league, cup, continental) - determinism by construction rather than by seed.
 */
export function apportion(total: number, weights: readonly number[], caps?: readonly number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  if (total <= 0 || weightSum <= 0 || n === 0) return out;

  const cap = (i: number): number => caps?.[i] ?? Number.MAX_SAFE_INTEGER;
  const exact = weights.map((w) => (total * w) / weightSum);
  let assigned = 0;
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.min(Math.floor(exact[i]!), cap(i));
    assigned += out[i]!;
  }
  // Remainder to the largest fractional parts, then - if caps bit - to any capacity left.
  const order = [...Array(n).keys()].sort(
    (a, b) => exact[b]! - Math.floor(exact[b]!) - (exact[a]! - Math.floor(exact[a]!)) || a - b,
  );
  let remaining = total - assigned;
  for (const i of order) {
    if (remaining <= 0) break;
    if (out[i]! < cap(i)) {
      out[i] = out[i]! + 1;
      remaining -= 1;
    }
  }
  // Caps may still leave a residue (total larger than all caps combined); pour what fits.
  for (let i = 0; i < n && remaining > 0; i += 1) {
    const room = cap(i) - out[i]!;
    const take = Math.min(room, remaining);
    out[i] = out[i]! + take;
    remaining -= take;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Competition lines                                                   */
/* ------------------------------------------------------------------ */

/** The empty per-competition stat line. */
function line(competition: CompetitionLine['competition'], teamGames: number): CompetitionLine {
  return { competition, teamGames, appearances: 0, starts: 0, goals: 0, assists: 0, cleanSheets: 0, goalsConceded: 0 };
}

/**
 * Splits one segment's stats across its fixture composition.
 *
 * Appearances are apportioned first, capped by each competition's own fixture count - a player
 * cannot appear in more cup matches than his team played. Every other stat then follows the
 * appearances, capped where football requires it (starts and clean sheets cannot exceed the
 * appearances of their line).
 */
export function competitionLines(
  segment: {
    leagueId?: string | null;
    academyStage: SeasonSegment['academyStage'];
    clubId: string;
    teamGames: number;
    stats: SeasonStats;
  },
  /**
   * The club's ACTUAL European match count this season (v0.8). When present it replaces the
   * legacy quality-based allowance in the composition, so the europe stat bucket is sized by
   * the journey that was really played. Absent for pre-v0.8 records and academy seasons.
   */
  continentalGames?: number,
): CompetitionLine[] {
  const { stats } = segment;

  // Academy football is one competition; no split exists to invent.
  if (segment.academyStage !== 'senior' || !segment.leagueId) {
    const only = line(segment.academyStage !== 'senior' ? 'youth' : 'league', segment.teamGames);
    only.appearances = stats.appearances;
    only.starts = stats.starts;
    only.goals = stats.goals;
    only.assists = stats.assists;
    only.cleanSheets = stats.cleanSheets;
    only.goalsConceded = stats.goalsConceded;
    return [only];
  }

  let quality = 60;
  let israeli = true;
  try {
    const club = getClub(segment.clubId);
    quality = club.quality;
    israeli = club.country === 'ישראל';
  } catch {
    /* unknown club: the defaults produce a plain league/cup composition */
  }
  const season = leagueScheduleBreakdown(segment.leagueId, quality, israeli);
  const continental = continentalGames ?? season.continental;

  /*
   * The segment may be half a season, so its composition is the season's composition scaled to
   * the segment's own fixture count - apportioned to integers that sum back exactly. A
   * mid-season mover's European matches split across his spells by the same proportional rule
   * as everything else (documented simplification: the engine does not know which half a
   * specific European tie fell in).
   */
  const games = apportion(segment.teamGames, [season.league, season.cup, continental]);
  const lines = [line('league', games[0]!), line('cup', games[1]!), line('continental_generic', games[2]!)];

  const apps = apportion(
    stats.appearances,
    lines.map((l) => l.teamGames),
    lines.map((l) => l.teamGames),
  );
  lines.forEach((l, i) => {
    l.appearances = apps[i]!;
  });

  /*
   * Stats follow appearances - except when there are none. The engine can credit a goal with
   * zero appearances (an event-described moment on a season the model gave no minutes), and
   * apportioning by an all-zero weight vector silently dropped it, breaking reconciliation.
   * With no appearances to follow, the fixture composition is the only weight left.
   */
  const anyApps = lines.some((l) => l.appearances > 0);
  const byApps = lines.map((l) => (anyApps ? l.appearances : l.teamGames));
  const appCaps = lines.map((l) => l.appearances);
  const starts = apportion(stats.starts, byApps, appCaps);
  const cleans = apportion(stats.cleanSheets, byApps, appCaps);
  const goals = apportion(stats.goals, byApps);
  const assists = apportion(stats.assists, byApps);
  const conceded = apportion(stats.goalsConceded, byApps);
  lines.forEach((l, i) => {
    l.starts = starts[i]!;
    l.cleanSheets = cleans[i]!;
    l.goals = goals[i]!;
    l.assists = assists[i]!;
    l.goalsConceded = conceded[i]!;
  });

  // Drop empty competitions the club does not actually play (no continental for most).
  return lines.filter((l) => l.teamGames > 0);
}

/* ------------------------------------------------------------------ */
/* Segment construction at settlement                                  */
/* ------------------------------------------------------------------ */

export interface SegmentHalf {
  clubId: string;
  clubName: string;
  league: string;
  leagueId: string | null;
  academyStage: SeasonSegment['academyStage'];
  onLoan: boolean;
  role: TeamRole;
  teamGames: number;
  stats: SeasonStats;
}

const ADDITIVE: readonly (keyof SeasonStats)[] = [
  'appearances',
  'starts',
  'goals',
  'assists',
  'cleanSheets',
  'goalsConceded',
  'injuredGames',
];

function addStats(a: SeasonStats, b: SeasonStats): SeasonStats {
  const out = { ...a };
  for (const key of ADDITIVE) out[key] = a[key] + b[key];
  // Rating is an average, not a sum: minutes-weighted by appearances, like mergeStats.
  const total = a.appearances + b.appearances;
  out.rating = total > 0 ? (a.rating * a.appearances + b.rating * b.appearances) / total : a.rating || b.rating;
  return out;
}

/**
 * Builds the season's segments from the two halves the engine actually simulated.
 *
 * `finalStats` is the record's settled total, which may differ from the raw sum of halves - the
 * v0.4.8 reconciliation can credit an appearance an on-field event described. Any such
 * difference is applied to the LAST segment, where the season closed: the engine does not know
 * which half an adjustment belongs to, and the closing club is where the settled season is
 * anchored. The invariant that matters - segments sum exactly to the record - holds either way,
 * and the integrity validator asserts it.
 */
export function buildSeasonSegments(
  first: SegmentHalf | null,
  second: SegmentHalf,
  finalStats: SeasonStats,
  /** The season's real European match count, when Europe was simulated (v0.8). */
  continentalGames?: number,
): SeasonSegment[] {
  const sameSpell =
    !first ||
    (first.clubId === second.clubId && first.academyStage === second.academyStage && first.onLoan === second.onLoan);

  const halves: SegmentHalf[] = sameSpell
    ? [
        {
          ...second,
          teamGames: (first?.teamGames ?? 0) + second.teamGames,
          stats: finalStats,
        },
      ]
    : [first!, second];

  if (!sameSpell) {
    // Reconciliation difference lands on the closing segment.
    const summed = addStats(first!.stats, second.stats);
    const last = halves[halves.length - 1]!;
    const adjusted = { ...last.stats };
    for (const key of ADDITIVE) {
      adjusted[key] = Math.max(0, adjusted[key] + (finalStats[key] - summed[key]));
    }
    adjusted.rating = finalStats.rating;
    halves[halves.length - 1] = { ...last, stats: adjusted };
  }

  return halves.map((half) => ({
    clubId: half.clubId,
    clubName: half.clubName,
    league: half.league,
    leagueId: half.leagueId ?? undefined,
    academyStage: half.academyStage,
    onLoan: half.onLoan,
    teamGames: half.teamGames,
    stats: half.stats,
    role: half.role,
    breakdown: 'engine',
    competitions: competitionLines(
      {
        leagueId: half.leagueId,
        academyStage: half.academyStage,
        clubId: half.clubId,
        teamGames: half.teamGames,
        stats: half.stats,
      },
      continentalGames,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Legacy segments for pre-v0.7 records                                */
/* ------------------------------------------------------------------ */

/**
 * A single conservative segment for a record written before segments existed.
 *
 * The true league/cup split of an old season was never known, so the segment carries one
 * `combined` line and is marked `legacy_estimate` - it is everything, unseparated, and it is
 * excluded from retroactive league honors rather than dressed up as precise. What IS known is
 * kept: club, league, fixture count, whole-season stats.
 */
export function legacySegment(record: {
  clubId: string;
  clubName: string;
  league: string;
  leagueId?: string;
  academyStage: SeasonSegment['academyStage'];
  onLoan: boolean;
  teamGames?: number;
  stats: SeasonStats;
  role: TeamRole;
}): SeasonSegment {
  const combined = line('combined', record.teamGames ?? 0);
  combined.appearances = record.stats.appearances;
  combined.starts = record.stats.starts;
  combined.goals = record.stats.goals;
  combined.assists = record.stats.assists;
  combined.cleanSheets = record.stats.cleanSheets;
  combined.goalsConceded = record.stats.goalsConceded;
  return {
    clubId: record.clubId,
    clubName: record.clubName,
    league: record.league,
    leagueId: record.leagueId,
    academyStage: record.academyStage,
    onLoan: record.onLoan,
    teamGames: record.teamGames ?? 0,
    stats: record.stats,
    role: record.role,
    breakdown: 'legacy_estimate',
    competitions: [combined],
  };
}

/** League-only stats for a season, summed across engine segments in the given league. */
export function leagueLineFor(
  segments: readonly SeasonSegment[] | undefined,
  leagueId: string,
): CompetitionLine | null {
  if (!segments) return null;
  let found: CompetitionLine | null = null;
  for (const segment of segments) {
    if (segment.leagueId !== leagueId || segment.breakdown !== 'engine') continue;
    for (const comp of segment.competitions) {
      if (comp.competition !== 'league') continue;
      if (!found) {
        found = { ...comp };
      } else {
        found.teamGames += comp.teamGames;
        found.appearances += comp.appearances;
        found.starts += comp.starts;
        found.goals += comp.goals;
        found.assists += comp.assists;
        found.cleanSheets += comp.cleanSheets;
        found.goalsConceded += comp.goalsConceded;
      }
    }
  }
  return found;
}

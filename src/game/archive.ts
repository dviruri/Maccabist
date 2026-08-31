import { getClub } from '../data/clubs';
import { globalCareerScore, maccabiLegacyRank, maccabiLegacyScore } from './maccabiLegacy';
import type { ArchivedCareer, ArchivedClubSpell, ArchivedSeason, Career, SeasonRecord } from '../types';

/**
 * The archive snapshot (v0.7, Checkpoint C).
 *
 * A career used to disappear the moment it ended - the retirement screen was the last anyone
 * saw of it, and pressing "קריירה חדשה" erased thirty seasons. This builds the permanent copy:
 * everything the meta screens render, frozen at retirement, independent of the live Career
 * object and of any future engine change.
 *
 * Pure function: it reads the career and returns the snapshot. Persistence (and idempotence -
 * `archiveId` is the career's own id, so saving twice is an upsert) lives in the storage layer.
 */

/** The season rows, stripped of in-flight half data a finished season no longer needs. */
function archivedSeason(record: SeasonRecord): ArchivedSeason {
  return {
    season: record.season,
    age: record.age,
    academyStage: record.academyStage,
    clubId: record.clubId,
    clubName: record.clubName,
    teamName: record.teamName,
    league: record.league,
    leagueId: record.leagueId,
    teamGames: record.teamGames,
    /*
     * Kept only when the season actually split (v0.7 stress test: 100 archives measured 3.0 MB,
     * and most of it was single-segment seasons duplicating their own record). A one-club
     * season's card renders entirely from the row itself; the segments carry information only
     * when the player moved mid-season, so only those are archived. The LIVE career keeps every
     * segment - this is an archive-payload decision, not a truth decision.
     */
    segments: record.segments && record.segments.length > 1 ? record.segments : undefined,
    /*
     * v0.8: the journey, with per-leg detail dropped. The archive renders stages, opponents and
     * aggregates; individual leg scores are live-season detail, and keeping them measured the
     * 100-career archive at 26.5 KB per career against 18 without. Same rule as segments: an
     * archive-payload decision, not a truth decision - the live record keeps every leg.
     */
    europe: record.europe
      ? {
          ...record.europe,
          steps: record.europe.steps.map((step) =>
            step.kind === 'tie' ? { ...step, tie: { ...step.tie, legs: [] } } : step,
          ),
        }
      : undefined,
    onLoan: record.onLoan,
    stats: record.stats,
    ability: record.ability,
    role: record.role,
    captain: record.captain,
    trophies: record.trophies,
  };
}

function countryOf(clubId: string): string {
  try {
    return getClub(clubId).country;
  } catch {
    return 'ישראל';
  }
}

/**
 * The club journey, in career order, one entry per club.
 *
 * A return does not create a second entry - it increments `spells`, which is exactly what the
 * Club Album shows. Only senior seasons count as the journey; the academy is a chapter of the
 * Maccabi story, not a career stop.
 */
function clubJourney(career: Career): ArchivedClubSpell[] {
  const order: string[] = [];
  const byClub = new Map<string, ArchivedClubSpell>();
  let previousClubId: string | null = null;

  for (const record of career.seasonHistory) {
    if (record.academyStage !== 'senior') continue;
    let entry = byClub.get(record.clubId);
    if (!entry) {
      entry = {
        clubId: record.clubId,
        clubName: record.clubName,
        country: countryOf(record.clubId),
        spells: 0,
        seasons: 0,
        appearances: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        wonTrophy: false,
        wasCaptain: false,
      };
      byClub.set(record.clubId, entry);
      order.push(record.clubId);
    }
    if (previousClubId !== record.clubId) entry.spells += 1;
    previousClubId = record.clubId;
    entry.seasons += 1;
    entry.appearances += record.stats.appearances;
    entry.goals += record.stats.goals;
    entry.assists += record.stats.assists;
    entry.cleanSheets += record.stats.cleanSheets;
    if (record.trophies.length > 0) entry.wonTrophy = true;
    if (record.captain) entry.wasCaptain = true;
  }
  return order.map((id) => byClub.get(id)!);
}

/**
 * The strongest moments, chosen once at archive time.
 *
 * Major milestones only, newest-last so the story reads forward, capped at eight - the
 * retirement principle applies here too: select, do not dump.
 */
function highlights(career: Career): ArchivedCareer['highlights'] {
  const major = career.milestones.filter((m) => m.major);
  if (major.length <= 8) return major;
  // Keep the first two (the origin of the story) and the last six (the peak and the farewell).
  return [...major.slice(0, 2), ...major.slice(-6)];
}

export function buildArchivedCareer(career: Career): ArchivedCareer {
  const seniorSeasons = career.seasonHistory.filter((r) => r.academyStage === 'senior');
  const countries = new Set(seniorSeasons.map((r) => countryOf(r.clubId)));

  return {
    archiveId: career.id,
    archivedAt: Date.now(),
    playerName: career.playerName,
    position: career.position,
    startSeason: career.startSeason,
    endSeason: career.currentSeason,
    retirementAge: career.age,
    peakAbility: Math.round(career.peakAbility),
    globalCareer: globalCareerScore(career),
    maccabiLegacy: maccabiLegacyScore(career),
    legacyRank: maccabiLegacyRank(career),
    endingId: career.legend?.ending.id ?? 'fallback',
    endingTitle: career.legend?.ending.title ?? '',
    finalClubId: career.currentClubId,
    totals: {
      appearances: career.stats.appearances,
      goals: career.stats.goals,
      assists: career.stats.assists,
      cleanSheets: career.stats.cleanSheets,
      seasons: career.seasonHistory.length,
      countries: Math.max(1, countries.size),
    },
    maccabi: {
      appearances: career.maccabi.appearances,
      seasons: career.maccabi.seasons,
      championships: career.maccabi.championships,
      cups: career.maccabi.cups,
      captainSeasons: career.maccabi.captainSeasons,
    },
    clubs: clubJourney(career),
    seasons: career.seasonHistory.map(archivedSeason),
    trophies: career.trophies,
    honors: career.honors ?? [],
    achievements: career.achievements,
    highlights: highlights(career),
    promotions: career.memories
      .filter((m) => m.kind === 'won_promotion')
      .map((m) => ({ season: m.season, detail: m.detail })),
  };
}

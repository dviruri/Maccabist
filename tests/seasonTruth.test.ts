/**
 * Historical season truth (v0.6.5.3, Scenarios A-J).
 *
 * v0.6.5.2 stopped history being scored against the club's CURRENT division. It left the fixture
 * count itself still being *reconstructed* at read time, from the league's size, the club's
 * quality and the schedule rules as they exist now. That is a query, and a query answers with
 * today's data: reshape a division or restate a club's quality and a season that finished years
 * ago quietly returns a different number than it did last version.
 *
 * Worse, every academy season fell through to `getClub('maccabi_academy').seasonGames` - one
 * generic number - so a טרום ב׳ season of 16 games and a נוער season of 32 were scored against
 * the same denominator.
 *
 * A season that happened is a fact. If he played 16 team games in טרום ב׳, that season must
 * always say 16.
 */

import { describe, expect, it } from 'vitest';

import { ACADEMY_STAGES, stageConfig } from '../src/data/academy';
import { MACCABI_ACADEMY_ID, MACCABI_ID, getClub } from '../src/data/clubs';
import { createCareer, hydrateCareer } from '../src/game/careerEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { historicalLeagueId, leagueSeasonGames, seasonFixtures } from '../src/game/leagueTruth';
import { createRng } from '../src/game/random';
import { levelContext } from '../src/game/rules';
import { playFirstHalf, playSecondHalf } from '../src/game/seasonEngine';
import { emptyWorld, playerImpact } from '../src/game/worldEngine';
import type { AcademyStage, Career, SeasonRecord, WorldState } from '../src/types';

/** Plays one full season and returns the record it wrote. */
function closeSeason(career: Career, seed = 11): SeasonRecord {
  const first = playFirstHalf(career, createRng(seed));
  return playSecondHalf(first, createRng(seed + 1)).record;
}

function academyCareer(stage: AcademyStage, seed = 7): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'CM', seed }),
    academyStage: stage,
    currentClubId: MACCABI_ACADEMY_ID,
  };
}

function seniorCareer(overrides: Partial<Career> = {}, seed = 7): Career {
  return {
    ...createCareer({ playerName: 'ת', position: 'ST', seed }),
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 70,
    roleValue: 65,
    currentSeason: 2044,
    ...overrides,
  };
}

function record(overrides: Partial<SeasonRecord> = {}): SeasonRecord {
  return {
    season: 2044,
    age: 24,
    academyStage: 'senior',
    clubId: MACCABI_ID,
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    onLoan: false,
    ability: 70,
    role: 'starter',
    stats: {
      appearances: 20,
      goals: 5,
      assists: 3,
      rating: 6.9,
      minutes: 1600,
      cleanSheets: 0,
      yellowCards: 2,
      redCards: 0,
    },
    ...overrides,
  } as SeasonRecord;
}

function worldWith(clubId: string, leagueId: string): WorldState {
  return { ...emptyWorld(), clubLeagues: { [clubId]: leagueId } };
}

/* ------------------------------------------------------------------ */
/* A, B, C: academy fixture truth                                      */
/* ------------------------------------------------------------------ */

describe('A/B/C: every academy stage stores its own fixture count', () => {
  it('stores 16 for a טרום ב׳ season', () => {
    const written = closeSeason(academyCareer('pre_b'));
    expect(stageConfig('pre_b').seasonGames).toBe(16);
    expect(written.teamGames).toBe(16);
  });

  it('stores 32 for a נוער season', () => {
    const written = closeSeason(academyCareer('u19'));
    expect(stageConfig('u19').seasonGames).toBe(32);
    expect(written.teamGames).toBe(32);
  });

  it('stores the configured count for every stage, with no generic academy fallback', () => {
    for (const stage of Object.keys(ACADEMY_STAGES) as AcademyStage[]) {
      if (stage === 'senior') continue;
      const written = closeSeason(academyCareer(stage));
      expect(written.teamGames, stage).toBe(stageConfig(stage).seasonGames);
      // And the resolver agrees with what was written.
      expect(seasonFixtures(written), stage).toBe(stageConfig(stage).seasonGames);
    }
  });

  it('gives distinct counts across the ladder, which the old generic number could not', () => {
    const counts = (Object.keys(ACADEMY_STAGES) as AcademyStage[])
      .filter((s) => s !== 'senior')
      .map((s) => stageConfig(s).seasonGames);
    // 16, 18, 20 ... 32 - nine stages, nine different schedules.
    expect(new Set(counts).size).toBe(counts.length);
    // The generic fallback these used to resolve through.
    expect(getClub(MACCABI_ACADEMY_ID).seasonGames).not.toBe(stageConfig('pre_b').seasonGames);
  });

  it('resolves an OLD academy record with no teamGames through its stage, not the club', () => {
    const old = record({ academyStage: 'pre_b', clubId: MACCABI_ACADEMY_ID, league: 'ליגת טרום ב׳' });
    expect(old.teamGames).toBeUndefined();
    expect(seasonFixtures(old)).toBe(16);
    expect(seasonFixtures(old)).not.toBe(getClub(MACCABI_ACADEMY_ID).seasonGames);
  });
});

/* ------------------------------------------------------------------ */
/* D, E, F: promotion and relegation cannot rewrite history            */
/* ------------------------------------------------------------------ */

describe('D/E/F: a stored season survives every later movement', () => {
  it('keeps an Alef season intact after promotion to Leumit', () => {
    const alef = record({
      clubId: 'hapoel_hadera',
      league: 'ליגה א׳ דרום',
      leagueId: 'il_alef_south',
      teamGames: leagueSeasonGames('il_alef_south', getClub('hapoel_hadera').quality, true),
    });
    const before = seasonFixtures(alef);
    const promoted = worldWith('hapoel_hadera', 'il_leumit');
    expect(seasonFixtures(alef, promoted)).toBe(before);
    expect(historicalLeagueId(alef, promoted)).toBe('il_alef_south');
  });

  it('keeps a Leumit season intact after relegation to Alef', () => {
    const leumit = record({
      clubId: 'hapoel_hadera',
      league: 'הליגה הלאומית',
      leagueId: 'il_leumit',
      teamGames: leagueSeasonGames('il_leumit', getClub('hapoel_hadera').quality, true),
    });
    const before = seasonFixtures(leumit);
    expect(seasonFixtures(leumit, worldWith('hapoel_hadera', 'il_alef_south'))).toBe(before);
    expect(historicalLeagueId(leumit, worldWith('hapoel_hadera', 'il_alef_south'))).toBe('il_leumit');
  });

  it('gives two different immutable values for two seasons in two divisions', () => {
    const quality = getClub('hapoel_hadera').quality;
    const seasonN = record({
      season: 2044,
      clubId: 'hapoel_hadera',
      leagueId: 'il_alef_south',
      teamGames: leagueSeasonGames('il_alef_south', quality, true),
    });
    const seasonN1 = record({
      season: 2045,
      clubId: 'hapoel_hadera',
      leagueId: 'il_leumit',
      teamGames: leagueSeasonGames('il_leumit', quality, true),
    });
    expect(seasonFixtures(seasonN)).not.toBe(seasonFixtures(seasonN1));
  });

  it('holds through repeated promotion and relegation', () => {
    const quality = getClub('hapoel_hadera').quality;
    const past = record({
      clubId: 'hapoel_hadera',
      leagueId: 'il_alef_south',
      teamGames: leagueSeasonGames('il_alef_south', quality, true),
    });
    const original = { leagueId: past.leagueId, teamGames: past.teamGames };
    for (const leagueId of ['il_leumit', 'il_premier', 'il_alef_north', 'il_premier', 'il_leumit']) {
      const world = worldWith('hapoel_hadera', leagueId);
      expect(seasonFixtures(past, world)).toBe(original.teamGames);
      expect(historicalLeagueId(past, world)).toBe(original.leagueId);
    }
  });

  it('gives the same playerImpact however the world has moved since', () => {
    const past = record({
      clubId: 'hapoel_hadera',
      leagueId: 'il_alef_south',
      teamGames: leagueSeasonGames('il_alef_south', getClub('hapoel_hadera').quality, true),
    });
    const settled = seniorCareer({ world: emptyWorld(), lastSeasonRecord: past });
    const promoted = seniorCareer({
      world: worldWith('hapoel_hadera', 'il_premier'),
      lastSeasonRecord: past,
    });
    expect(playerImpact(promoted, past)).toBe(playerImpact(settled, past));
  });
});

/* ------------------------------------------------------------------ */
/* G, H, I: old saves                                                  */
/* ------------------------------------------------------------------ */

describe('G/H/I: old saves resolve from the strongest historical evidence', () => {
  it('G: uses the world clubSeasons entry when the record has no leagueId', () => {
    const old = record({ clubId: 'hapoel_hadera', league: 'ליגת העל' });
    const world: WorldState = {
      ...emptyWorld(),
      clubSeasons: [
        {
          season: 2044,
          clubId: 'hapoel_hadera',
          leagueId: 'il_alef_south',
          outcome: 'mid_table',
          label: 'אמצע הטבלה',
          playerImpact: 0,
        },
      ],
    };
    expect(historicalLeagueId(old, world)).toBe('il_alef_south');
  });

  it('H: historical world truth beats a stale display league', () => {
    /*
     * The exact pre-v0.6.5.2 defect: the record's NAME was taken from `levelContext`, which read
     * the club's stale static field, so a Liga Alef season is stamped "ליגת העל". The world's own
     * clubSeasons entry is an id written by the world engine at the time, and it wins.
     */
    const stale = record({ clubId: 'hapoel_hadera', league: 'ליגת העל' });
    const world: WorldState = {
      ...emptyWorld(),
      clubSeasons: [
        {
          season: 2044,
          clubId: 'hapoel_hadera',
          leagueId: 'il_alef_south',
          outcome: 'mid_table',
          label: 'אמצע הטבלה',
          playerImpact: 0,
        },
      ],
    };
    expect(historicalLeagueId(stale, world)).toBe('il_alef_south');
    expect(historicalLeagueId(stale, world)).not.toBe('il_premier');
    expect(seasonFixtures(stale, world)).toBe(
      leagueSeasonGames('il_alef_south', getClub('hapoel_hadera').quality, true),
    );
  });

  it('H2: falls back to the display name only when the world holds no evidence', () => {
    const old = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום' });
    expect(historicalLeagueId(old, emptyWorld())).toBe('il_alef_south');
  });

  it('H3: an ambiguous clubSeasons match counts as no evidence, not a coin flip', () => {
    const old = record({ clubId: 'hapoel_hadera', league: 'ליגה א׳ דרום' });
    const entry = {
      season: 2044,
      clubId: 'hapoel_hadera',
      outcome: 'mid_table' as const,
      label: 'אמצע הטבלה',
      playerImpact: 0,
    };
    const world: WorldState = {
      ...emptyWorld(),
      clubSeasons: [
        { ...entry, leagueId: 'il_premier' },
        { ...entry, leagueId: 'il_leumit' },
      ],
    };
    // Two contradicting entries: fall through to the recorded name rather than pick one.
    expect(historicalLeagueId(old, world)).toBe('il_alef_south');
  });

  it('I: a record with no teamGames, no leagueId and no world evidence still loads', () => {
    const bare = record({ league: 'ליגה שלא קיימת' });
    expect(historicalLeagueId(bare, emptyWorld())).toBeNull();
    expect(seasonFixtures(bare, emptyWorld())).toBeGreaterThan(0);
  });

  it('I2: a record whose club no longer exists still loads', () => {
    const gone = record({ clubId: 'club_that_was_deleted', league: 'ליגה שלא קיימת' });
    expect(seasonFixtures(gone)).toBeGreaterThan(0);
  });

  it('never infers a historical league from where the club plays today', () => {
    const bare = record({ clubId: 'hapoel_hadera', league: 'ליגה שלא קיימת' });
    // Hadera is in Liga Alef right now. With no historical evidence the answer is null, not that.
    expect(historicalLeagueId(bare, emptyWorld())).toBeNull();
    expect(historicalLeagueId(bare, worldWith('hapoel_hadera', 'il_premier'))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* J: a future schedule change cannot move a stored season             */
/* ------------------------------------------------------------------ */

describe('J: stored teamGames outranks every derivation', () => {
  it('returns the stored number even when it disagrees with what the league would now give', () => {
    /*
     * Stands in for a future version reshaping the division. The record says this Ligat Ha'Al
     * season held 16 matches; today's rules would compute 43. The stored fact wins, which is
     * what makes an old career safe across a schedule change.
     */
    const past = record({ leagueId: 'il_premier', teamGames: 16 });
    expect(leagueSeasonGames('il_premier', getClub(MACCABI_ID).quality, true)).not.toBe(16);
    expect(seasonFixtures(past)).toBe(16);
    expect(seasonFixtures(past, worldWith(MACCABI_ID, 'il_alef_south'))).toBe(16);
  });

  it('outranks the academy stage schedule too', () => {
    const past = record({ academyStage: 'pre_b', clubId: MACCABI_ACADEMY_ID, teamGames: 21 });
    expect(stageConfig('pre_b').seasonGames).toBe(16);
    expect(seasonFixtures(past)).toBe(21);
  });

  it('ignores a stored value that is not a usable count', () => {
    // Defensive: a corrupt or zero value falls through to derivation rather than dividing by it.
    expect(seasonFixtures(record({ leagueId: 'il_premier', teamGames: 0 }))).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Write path and migration                                            */
/* ------------------------------------------------------------------ */

describe('the write path stores truth, and hydration backfills old saves', () => {
  it('writes teamGames on every newly completed season', () => {
    const written = closeSeason(seniorCareer());
    expect(written.teamGames).toBeGreaterThan(0);
    expect(Number.isInteger(written.teamGames)).toBe(true);
  });

  it('stores the same denominator the season was actually simulated over', () => {
    /*
     * The requirement that keeps this honest: `teamGames` is the sum of the halves played, not a
     * second formula. If it drifted from the basis used to generate appearances, the stored
     * fact would contradict the stats stored beside it.
     */
    for (let seed = 1; seed <= 25; seed += 1) {
      const written = closeSeason(seniorCareer({}, seed), seed);
      expect(written.stats.appearances, `seed ${seed}`).toBeLessThanOrEqual(written.teamGames ?? 0);
    }
  });

  it('sums the halves when a mid-season move changes the level between them', () => {
    /*
     * Not hypothetical. The academy event `youth_guaranteed_spot` carries
     * `transferTo: 'maccabi_netanya'`, which is the SENIOR club - and `moveToClub` sets
     * `academyStage = 'senior'` for a senior target. So a boy can play the first half of a season
     * on a 30-game נערים א׳ schedule and the second half on a senior one.
     *
     * Re-deriving the count from the closing state gives the senior schedule for the whole year,
     * which is not the football he played. The sum of the halves is.
     */
    const youth = { ...academyCareer('youth_a'), age: 17 };
    const firstHalf = playFirstHalf(youth, createRng(41));
    expect(firstHalf.firstHalfGames).toBe(Math.round(stageConfig('youth_a').seasonGames / 2));

    const movedMidSeason = { ...firstHalf, academyStage: 'senior' as const, currentClubId: 'maccabi_netanya' };
    const written = playSecondHalf(movedMidSeason, createRng(42)).record;

    const seniorLevel = levelContext(movedMidSeason).seasonGames;
    const expected =
      Math.round(stageConfig('youth_a').seasonGames / 2) +
      (seniorLevel - Math.round(seniorLevel / 2));
    expect(written.teamGames).toBe(expected);
    // And it is neither half's schedule taken for the whole year.
    expect(written.teamGames).not.toBe(seniorLevel);
    expect(written.teamGames).not.toBe(stageConfig('youth_a').seasonGames);
    expect(written.stats.appearances).toBeLessThanOrEqual(written.teamGames ?? 0);
  });

  it('backfills an old save once, from its own history rather than the current world', () => {
    const career = seniorCareer({
      seasonHistory: [record({ clubId: 'hapoel_hadera', league: 'ליגת העל' })],
      world: {
        ...emptyWorld(),
        clubSeasons: [
          {
            season: 2044,
            clubId: 'hapoel_hadera',
            leagueId: 'il_alef_south',
            outcome: 'mid_table',
            label: 'אמצע הטבלה',
            playerImpact: 0,
          },
        ],
      },
    });
    expect(career.seasonHistory[0]?.teamGames).toBeUndefined();

    const hydrated = hydrateCareer(career);
    const migrated = hydrated.seasonHistory[0];
    // The stale display text said ליגת העל; the world said Liga Alef, and the world won.
    expect(migrated?.leagueId).toBe('il_alef_south');
    expect(migrated?.teamGames).toBe(
      leagueSeasonGames('il_alef_south', getClub('hapoel_hadera').quality, true),
    );
  });

  it('leaves a record that already carries both fields untouched', () => {
    const original = record({ leagueId: 'il_premier', teamGames: 41 });
    const hydrated = hydrateCareer(seniorCareer({ seasonHistory: [original] }));
    expect(hydrated.seasonHistory[0]?.teamGames).toBe(41);
    expect(hydrated.seasonHistory[0]?.leagueId).toBe('il_premier');
  });

  it('backfills an old academy record through its stage', () => {
    const career = {
      ...academyCareer('pre_b'),
      seasonHistory: [
        record({ academyStage: 'pre_b', clubId: MACCABI_ACADEMY_ID, league: 'ליגת טרום ב׳' }),
      ],
    };
    expect(hydrateCareer(career).seasonHistory[0]?.teamGames).toBe(16);
  });

  it('hydrates a save with no history at all without touching it', () => {
    const career = seniorCareer({ seasonHistory: [] });
    expect(hydrateCareer(career).seasonHistory).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Integrity                                                           */
/* ------------------------------------------------------------------ */

describe('the integrity validator checks stored history', () => {
  it('reports nothing for a well-formed record', () => {
    const career = seniorCareer({ seasonHistory: [record({ leagueId: 'il_premier', teamGames: 43 })] });
    const codes = validateCareerIntegrity(career).map((v) => v.code);
    expect(codes).not.toContain('invalid_team_games');
    expect(codes).not.toContain('appearances_exceed_team_games');
  });

  it('catches more appearances than the team played matches', () => {
    const career = seniorCareer({
      seasonHistory: [
        record({ leagueId: 'il_premier', teamGames: 10, stats: { ...record().stats, appearances: 20 } }),
      ],
    });
    expect(validateCareerIntegrity(career).map((v) => v.code)).toContain(
      'appearances_exceed_team_games',
    );
  });

  it('catches a teamGames that is not a positive integer', () => {
    const career = seniorCareer({ seasonHistory: [record({ teamGames: -4 })] });
    expect(validateCareerIntegrity(career).map((v) => v.code)).toContain('invalid_team_games');
  });

  it('does not flag a pre-v0.6.5.3 record that simply has no teamGames', () => {
    const career = seniorCareer({ seasonHistory: [record()] });
    const codes = validateCareerIntegrity(career).map((v) => v.code);
    expect(codes).not.toContain('invalid_team_games');
    expect(codes).not.toContain('appearances_exceed_team_games');
  });
});

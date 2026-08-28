/**
 * v0.4.5.1 Phase 9: legacy is not the top of the squad ladder.
 *
 * `icon` used to be the highest rung of `ROLE_TIERS`, which meant a player became his club's
 * symbol for being better than his teammates. Measured before the split: 91% of careers reached
 * it, 55.3% of all senior seasons were played at it, it arrived after 3.8 seasons and 94
 * appearances, and only 12.6% of those "icons" had ever captained the side.
 *
 * The rule these tests exist to protect: **ability alone can never make a player an icon.**
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { LEGACY, ROLE_TIERS, WORLD } from '../src/game/balance';
import { createCareer } from '../src/game/careerEngine';
import {
  hasLegacy,
  LEGACY_ICONS,
  LEGACY_LABELS,
  legacyFromTenure,
  legacyStatus,
  tenureAt,
  type ClubTenure,
} from '../src/game/legacyEngine';
import { roleFromValue } from '../src/game/rules';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, LegacyStatus, Position, SeasonRecord } from '../src/types';

const base = (over: Partial<Career> = {}): Career => ({
  ...createCareer({ playerName: 'ל', position: 'CM', seed: 9 }),
  academyStage: 'senior',
  currentClubId: MACCABI_ID,
  ...over,
});

const season = (over: Partial<SeasonRecord> = {}): SeasonRecord => ({
  season: 2045,
  age: 24,
  academyStage: 'senior',
  clubId: MACCABI_ID,
  clubName: 'מכבי חיפה',
  teamName: 'מכבי חיפה',
  league: 'ליגת העל',
  onLoan: false,
  stats: {
    appearances: 34,
    starts: 30,
    goals: 5,
    assists: 4,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 70,
    injuredGames: 0,
  },
  firstHalf: null,
  ability: 78,
  role: 'star',
  coachTrust: 70,
  trophies: [],
  captain: false,
  olderGroup: 'none',
  ...over,
});

const tenure = (over: Partial<ClubTenure> = {}): ClubTenure => ({
  clubId: MACCABI_ID,
  seasons: 0,
  appearances: 0,
  captainSeasons: 0,
  trophies: 0,
  ...over,
});

describe('the squad ladder stops at star', () => {
  it('never produces icon from a role value', () => {
    for (let value = 0; value <= 100; value += 1) {
      expect(roleFromValue(value)).not.toBe('icon');
    }
  });

  it('has no icon tier left in the ladder', () => {
    expect(ROLE_TIERS.map((t) => t.role)).not.toContain('icon');
    expect(ROLE_TIERS[0]?.role).toBe('star');
  });
});

describe('ability alone never makes an icon', () => {
  it('gives a brilliant newcomer no legacy at all', () => {
    // Maximum ability, maximum standing, first season. He is a star, not a symbol.
    const newcomer = base({
      ability: 100,
      roleValue: 100,
      coachTrust: 100,
      reputation: 100,
      seasonHistory: [season()],
    });
    expect(legacyStatus(newcomer)).toBe('none');
  });

  it('is unmoved by ability across its whole range, holding history fixed', () => {
    const history = Array.from({ length: 6 }, (_, i) => season({ season: 2040 + i }));
    const statuses = new Set<LegacyStatus>();
    for (const ability of [20, 40, 60, 80, 100]) {
      statuses.add(legacyStatus(base({ ability, roleValue: ability, seasonHistory: history })));
    }
    // One and the same answer whatever he is worth as a footballer.
    expect(statuses.size).toBe(1);
  });
});

describe('legacy is built from tenure', () => {
  it('needs time before anything at all', () => {
    expect(legacyFromTenure(tenure({ seasons: 1, appearances: 40 }), base())).toBe('none');
    expect(
      legacyFromTenure(
        tenure({ seasons: LEGACY.favouriteSeasons, appearances: LEGACY.favouriteAppearances }),
        base(),
      ),
    ).toBe('fan_favourite');
  });

  it('needs something to show for it before icon', () => {
    const served = tenure({ seasons: LEGACY.iconSeasons, appearances: LEGACY.iconAppearances });
    // Long service alone is affection, not symbolism.
    expect(legacyFromTenure(served, base())).toBe('fan_favourite');
    expect(legacyFromTenure({ ...served, trophies: LEGACY.iconTrophies }, base())).toBe('icon');
    expect(legacyFromTenure({ ...served, captainSeasons: LEGACY.iconCaptainSeasons }, base())).toBe(
      'icon',
    );
  });

  it('reserves legend for a career at one club', () => {
    const lifetime = tenure({
      seasons: LEGACY.legendSeasons,
      appearances: LEGACY.legendAppearances,
      trophies: LEGACY.legendTrophies,
    });
    expect(legacyFromTenure(lifetime, base())).toBe('legend');
    // One season short is not the same story.
    expect(legacyFromTenure({ ...lifetime, seasons: LEGACY.legendSeasons - 1 }, base())).toBe(
      'icon',
    );
  });

  it('does not count a loan spell as tenure', () => {
    const career = base({
      seasonHistory: Array.from({ length: 10 }, (_, i) =>
        season({ season: 2040 + i, clubId: 'hapoel_afula', onLoan: true }),
      ),
    });
    expect(tenureAt(career, 'hapoel_afula').seasons).toBe(0);
  });

  it('gives a player on loan no legacy at his host club', () => {
    const guest = base({
      currentClubId: 'hapoel_afula',
      parentClubId: MACCABI_ID,
      seasonHistory: Array.from({ length: 10 }, (_, i) =>
        season({ season: 2040 + i, clubId: 'hapoel_afula' }),
      ),
    });
    expect(legacyStatus(guest)).toBe('none');
  });

  it('gives an academy player no legacy', () => {
    expect(legacyStatus(base({ academyStage: 'youth_a' }))).toBe('none');
  });
});

describe('every status is presentable', () => {
  it('has a label and an icon, and shows nothing for none', () => {
    for (const status of ['fan_favourite', 'icon', 'legend'] as LegacyStatus[]) {
      expect(LEGACY_LABELS[status]).toBeTruthy();
      expect(LEGACY_ICONS[status]).toBeTruthy();
      expect(hasLegacy(status)).toBe(true);
    }
    expect(hasLegacy('none')).toBe(false);
    expect(LEGACY_LABELS.none).toBe('');
  });
});

describe('across simulated careers', () => {
  it('makes the badge rare enough to mean something', () => {
    let seasons = 0;
    let iconSeasons = 0;
    let everIcon = 0;
    let careers = 0;

    for (const position of ['GK', 'CM', 'ST'] as Position[]) {
      for (let seed = 1; seed <= 220; seed += 1) {
        const career = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
        careers += 1;
        const senior = career.seasonHistory.filter((s) => s.academyStage === 'senior');
        let reached = false;

        // Replayed season by season, so this is the badge as the player actually experiences it.
        for (let i = 0; i < senior.length; i += 1) {
          const club = senior[i]!.clubId;
          const upto = senior.slice(0, i + 1).filter((s) => s.clubId === club && !s.onLoan);
          const status = legacyFromTenure(
            {
              clubId: club,
              seasons: upto.length,
              appearances: upto.reduce((n, s) => n + s.stats.appearances, 0),
              captainSeasons: upto.filter((s) => s.captain).length,
              trophies: career.trophies.filter(
                (t) => t.clubId === club && t.season <= senior[i]!.season,
              ).length,
            },
            career,
          );
          seasons += 1;
          if (status === 'icon' || status === 'legend') {
            iconSeasons += 1;
            reached = true;
          }
        }
        if (reached) everIcon += 1;
      }
    }

    // Was 55.3% of seasons and 91% of careers when icon sat atop the squad ladder.
    expect(iconSeasons / seasons).toBeLessThan(0.2);
    expect(everIcon / careers).toBeLessThan(0.45);
    // ...but it has to be reachable, or the badge is decoration.
    expect(everIcon / careers).toBeGreaterThan(0.08);
  });
});

describe('carried a small club (v0.4.5.1 recalibration)', () => {
  /*
   * playerImpact scales with appearance share, and v0.4.5 cut that share from ~83% to ~74% to fix
   * appearance inflation - without moving this threshold, which had been calibrated against the
   * inflated numbers. Impact at small clubs peaks at 0.450 with a p99 of 0.380, so a bar of 0.39
   * was cleared by 6 qualifying seasons out of 1,696 and the memory collapsed to 0.33% of careers.
   */
  it('sits inside the reachable range of player impact', () => {
    // A threshold above what the model can produce is dead content, however sensible it reads.
    expect(WORLD.breakoutImpact).toBeLessThan(WORLD.impactMax);
    expect(WORLD.breakoutImpact).toBeGreaterThan(0);
  });

  it('fires often enough to exist and rarely enough to matter', () => {
    let hit = 0;
    let careers = 0;
    for (const position of ['GK', 'CM', 'ST'] as Position[]) {
      for (let seed = 1; seed <= 260; seed += 1) {
        const career = simulateCareer({ playerName: 'ל', position, seed, policy: balancedPolicy });
        careers += 1;
        if (career.memories.some((m) => m.kind === 'breakout_at_small_club')) hit += 1;
      }
    }
    const rate = hit / careers;
    // Was 0.33% after the v0.4.5 appearance fix; the brief asks for a small but meaningful share.
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.06);
  });
});

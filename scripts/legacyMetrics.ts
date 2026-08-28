/**
 * Legacy and squad-role metrics (v0.4.5.1, Phase 28).
 *
 *   npx vite-node scripts/legacyMetrics.ts -- --careers=8000
 *
 * v0.4.5.1 Phase 9 split two things the game had been conflating. `TeamRole` is where you stand
 * in the squad this season and is derived from ability; legacy is what a club's supporters think
 * you are, and is derived from tenure - seasons, appearances, captaincy, trophies - with no
 * ability term at all. Before the split, `icon` was simply the top rung of the squad ladder, so
 * 91% of careers reached it and 55% of senior seasons were played at it. A word that describes
 * nine careers in ten describes nothing.
 *
 * This script measures the things that split was supposed to fix, so the claim in the report is
 * a number rather than an assertion. Developer tooling; never imported by the app.
 */

import { legacyFromTenure, tenureAt } from '../src/game/legacyEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { POSITION_LIST } from '../src/game/balance';
import type { Career, LegacyStatus, Position, TeamRole } from '../src/types';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

const careers = arg('careers', 6000);

const ROLES: TeamRole[] = ['squad', 'rotation', 'starter', 'key', 'star', 'icon'];
const LEGACIES: LegacyStatus[] = ['none', 'fan_favourite', 'icon', 'legend'];

/** Every club the player actually played a senior season for, in order. */
function clubsPlayedFor(career: Career): string[] {
  const seen: string[] = [];
  for (const season of career.seasonHistory) {
    if (season.academyStage !== 'senior') continue;
    if (!seen.includes(season.clubId)) seen.push(season.clubId);
  }
  return seen;
}

const roleSeasons: Record<string, number> = {};
const everReachedRole: Record<string, number> = {};
const bestLegacy: Record<string, number> = {};
const legacyTenures: Record<string, number> = {};

let seniorSeasons = 0;
let tenures = 0;
let withAnyLegacy = 0;

for (let seed = 1; seed <= careers; seed += 1) {
  // POSITION_LIST holds configs, not ids - rotating positions keeps the sample honest.
  const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
  const career = simulateCareer({ playerName: 'מ', position, seed, policy: balancedPolicy });

  const reached = new Set<TeamRole>();
  for (const season of career.seasonHistory) {
    if (season.academyStage !== 'senior') continue;
    seniorSeasons += 1;
    roleSeasons[season.role] = (roleSeasons[season.role] ?? 0) + 1;
    reached.add(season.role);
  }
  for (const role of reached) everReachedRole[role] = (everReachedRole[role] ?? 0) + 1;

  /*
   * Legacy is per club, not per career - the whole point is that it is a relationship with a set
   * of supporters. A journeyman with eight clubs and no legacy anywhere is a real career and
   * should show up as one.
   */
  let best: LegacyStatus = 'none';
  for (const clubId of clubsPlayedFor(career)) {
    const status = legacyFromTenure(tenureAt(career, clubId), career);
    tenures += 1;
    legacyTenures[status] = (legacyTenures[status] ?? 0) + 1;
    if (LEGACIES.indexOf(status) > LEGACIES.indexOf(best)) best = status;
  }
  bestLegacy[best] = (bestLegacy[best] ?? 0) + 1;
  if (best !== 'none') withAnyLegacy += 1;
}

const pct = (n: number, total: number): string =>
  `${((100 * n) / Math.max(1, total)).toFixed(1)}%`.padStart(7);

console.log(`\nv0.4.5.1 legacy & role metrics — ${careers.toLocaleString()} careers, balanced policy`);
console.log(`senior seasons: ${seniorSeasons.toLocaleString()}   club tenures: ${tenures.toLocaleString()}\n`);

console.log('SQUAD ROLE (per senior season, and share of careers that ever reached it)');
for (const role of ROLES) {
  console.log(
    `  ${role.padEnd(10)} seasons ${pct(roleSeasons[role] ?? 0, seniorSeasons)}   ` +
      `careers ever ${pct(everReachedRole[role] ?? 0, careers)}`,
  );
}

console.log('\nLEGACY (per club tenure, and the best a career ever reached anywhere)');
for (const status of LEGACIES) {
  console.log(
    `  ${status.padEnd(14)} tenures ${pct(legacyTenures[status] ?? 0, tenures)}   ` +
      `careers best ${pct(bestLegacy[status] ?? 0, careers)}`,
  );
}

console.log(`\ncareers that meant something somewhere: ${pct(withAnyLegacy, careers)}`);
/*
 * The check that matters. `icon` was the top of the squad ladder and is now a legacy status;
 * if it is still reached by most careers, the split did not achieve anything.
 */
console.log(
  `careers that ever reached legacy icon or legend: ` +
    pct((bestLegacy.icon ?? 0) + (bestLegacy.legend ?? 0), careers),
);

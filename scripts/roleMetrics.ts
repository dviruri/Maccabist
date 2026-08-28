/**
 * Squad-role distribution (v0.4.6, Phase 16 / 38).
 *
 *   npx vite-node scripts/roleMetrics.ts -- --careers=2000
 *
 * v0.4.5.1 removed `icon` from the squad ladder and the inflation simply moved down a rung:
 * `star` became 64.1% of senior seasons and 95.4% of careers. The cause was never the
 * thresholds — it was that `roleValue` saturates, sitting at its ceiling of 100 from roughly the
 * 60th percentile of senior seasons upward, so no threshold placement could make the ladder
 * discriminate.
 *
 * This reports the distribution, the saturation, and the breakdown by club level that the brief
 * asks for — being the best player at a weak club and being the best player at Maccabi are not
 * the same achievement, and a role model that cannot tell them apart is the actual defect.
 */

import { getClub } from '../src/data/clubs';
import { POSITION_LIST } from '../src/game/balance';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Position, SeasonRecord, TeamRole } from '../src/types';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const careers = arg('careers', 1500);

const ROLES: TeamRole[] = ['squad', 'rotation', 'starter', 'key', 'star'];

/** Weak / mid / strong, by the club's own quality. */
function clubBand(clubId: string): 'weak' | 'mid' | 'strong' {
  const q = getClub(clubId).quality;
  if (q < 50) return 'weak';
  return q < 70 ? 'mid' : 'strong';
}

const seasonsByRole: Record<string, number> = {};
const byBand: Record<string, Record<string, number>> = {
  weak: {},
  mid: {},
  strong: {},
};
const bandTotals: Record<string, number> = { weak: 0, mid: 0, strong: 0 };
const everStar = new Set<number>();
const starRuns: number[] = [];
let downgrades = 0;
let upgrades = 0;
let transitions = 0;
let seniorSeasons = 0;

const rank = (role: TeamRole): number => ROLES.indexOf(role);

for (let seed = 1; seed <= careers; seed += 1) {
  const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
  const career = simulateCareer({ playerName: 'ר', position, seed, policy: balancedPolicy });

  const senior: SeasonRecord[] = career.seasonHistory.filter((s) => s.academyStage === 'senior');
  let run = 0;

  for (let i = 0; i < senior.length; i += 1) {
    const record = senior[i];
    if (!record) continue;
    seniorSeasons += 1;
    seasonsByRole[record.role] = (seasonsByRole[record.role] ?? 0) + 1;

    const band = clubBand(record.clubId);
    byBand[band]![record.role] = (byBand[band]![record.role] ?? 0) + 1;
    bandTotals[band] = (bandTotals[band] ?? 0) + 1;

    if (record.role === 'star') {
      everStar.add(seed);
      run += 1;
    } else if (run > 0) {
      starRuns.push(run);
      run = 0;
    }

    const previous = senior[i - 1];
    if (previous) {
      transitions += 1;
      if (rank(record.role) < rank(previous.role)) downgrades += 1;
      if (rank(record.role) > rank(previous.role)) upgrades += 1;
    }
  }
  if (run > 0) starRuns.push(run);
}

const pct = (n: number, total: number): string => `${((100 * n) / Math.max(1, total)).toFixed(1)}%`;

console.log(`\nv0.4.6 ROLE METRICS — ${careers.toLocaleString()} careers, ${seniorSeasons.toLocaleString()} senior seasons\n`);

console.log('PER SENIOR SEASON');
for (const role of ROLES) {
  console.log(`  ${role.padEnd(10)} ${pct(seasonsByRole[role] ?? 0, seniorSeasons).padStart(7)}`);
}

console.log('\nBY CLUB LEVEL (a star at a weak club is not a star at Maccabi)');
console.log(`  ${'band'.padEnd(8)} ${ROLES.map((r) => r.padStart(9)).join('')}`);
for (const band of ['strong', 'mid', 'weak'] as const) {
  const total = bandTotals[band] ?? 0;
  const cells = ROLES.map((r) => pct(byBand[band]![r] ?? 0, total).padStart(9)).join('');
  console.log(`  ${band.padEnd(8)}${cells}   n=${total.toLocaleString()}`);
}

const meanRun = starRuns.length > 0 ? starRuns.reduce((s, r) => s + r, 0) / starRuns.length : 0;
console.log(`\ncareers ever reaching star        ${pct(everStar.size, careers)}`);
console.log(`mean unbroken seasons as star    ${meanRun.toFixed(2)}`);
console.log(`role downgrades per transition    ${pct(downgrades, transitions)}`);
console.log(`role upgrades per transition      ${pct(upgrades, transitions)}`);
console.log(`transitions with no change        ${pct(transitions - upgrades - downgrades, transitions)}\n`);

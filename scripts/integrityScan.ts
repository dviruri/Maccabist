/**
 * Reconciliation scan (v0.4.8, Phase 37).
 *
 *   npx vite-node scripts/integrityScan.ts -- --careers=4000
 *
 * Runs `validateCareerIntegrity` over a population of simulated careers and reports every
 * violation by category. The critical categories must be zero; the whole point of the version is
 * that these are structurally impossible rather than merely rare.
 */

import { POSITION_LIST } from '../src/game/balance';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { validateCareerIntegrity } from '../src/game/integrity';
import type { Position } from '../src/types';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const careers = arg('careers', 3000);

const counts = new Map<string, number>();
const examples = new Map<string, string>();
let clean = 0;

for (let seed = 1; seed <= careers; seed += 1) {
  const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
  const career = simulateCareer({ playerName: 'ת', position, seed, policy: balancedPolicy });
  const violations = validateCareerIntegrity(career);
  if (violations.length === 0) {
    clean += 1;
    continue;
  }
  for (const v of violations) {
    counts.set(v.code, (counts.get(v.code) ?? 0) + 1);
    if (!examples.has(v.code)) examples.set(v.code, `seed ${seed}: ${v.detail}`);
  }
}

const pct = (n: number): string => `${((100 * n) / careers).toFixed(2)}%`;

console.log(`\nv0.4.8 INTEGRITY SCAN — ${careers.toLocaleString()} careers, balanced policy\n`);
console.log(`clean careers   ${clean.toLocaleString()} / ${careers.toLocaleString()}   ${pct(clean)}`);

if (counts.size === 0) {
  console.log('\nNo violations in any category.\n');
} else {
  console.log('\nVIOLATIONS');
  for (const [code, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code.padEnd(34)} ${String(n).padStart(6)}   ${pct(n)}`);
    console.log(`      e.g. ${examples.get(code)}`);
  }
  console.log('');
}

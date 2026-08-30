/**
 * Archive stress test (v0.7).
 *
 *   npm run archive:stress
 *
 * Simulates full careers, archives every one, and reports what 100 archived careers actually
 * cost: serialized size against the localStorage budget, snapshot build time, and load/parse
 * time. The question being answered is the acceptance criterion "100 archived careers remain
 * manageable" - measured, not assumed.
 */

import { buildArchivedCareer } from '../src/game/archive';
import { simulateCareer, balancedPolicy } from '../src/game/simulate';
import type { ArchivedCareer } from '../src/types';

const TARGET = 100;

const archives: ArchivedCareer[] = [];
let buildMs = 0;

for (let seed = 1; seed <= TARGET; seed += 1) {
  const career = simulateCareer({ playerName: `שחקן ${seed}`, position: 'CM', seed, policy: balancedPolicy });
  const t0 = performance.now();
  archives.push(buildArchivedCareer(career));
  buildMs += performance.now() - t0;
}

const json = JSON.stringify({ version: 1, data: archives });
const bytes = Buffer.byteLength(json, 'utf8');

const t1 = performance.now();
const parsed = JSON.parse(json) as { data: ArchivedCareer[] };
const parseMs = performance.now() - t1;

const perCareer = bytes / TARGET;
const seasons = archives.reduce((a, c) => a + c.seasons.length, 0);

console.log(`\nARCHIVE STRESS - ${TARGET} careers, ${seasons} seasons`);
console.log('-'.repeat(48));
console.log(`  total serialized        ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  per career              ${(perCareer / 1024).toFixed(1)} KB`);
console.log(`  vs 5 MB localStorage    ${((bytes / (5 * 1024 * 1024)) * 100).toFixed(1)}%`);
console.log(`  snapshot build (avg)    ${(buildMs / TARGET).toFixed(2)} ms`);
console.log(`  parse all               ${parseMs.toFixed(1)} ms`);
console.log(`  parsed entries          ${parsed.data.length}`);

if (bytes > 4 * 1024 * 1024) {
  console.error('FAIL: archive would not fit comfortably in localStorage');
  process.exit(1);
}

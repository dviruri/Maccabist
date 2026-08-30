/**
 * Historical season truth audit (v0.6.5.3).
 *
 *   npm run truth:audit -- --careers=6000
 *
 * The standard simulation reports gameplay distributions. This reports the four things
 * v0.6.5.3 claims are zero, measured over full careers rather than fixtures:
 *
 *   critical integrity violations
 *   historical fixture resolution failures
 *   academy fixture mismatches
 *   save migration failures (hydration changing settled history)
 *
 * The migration check is the interesting one: it hydrates each finished career a second time and
 * asserts nothing moves. A backfill that is not idempotent would mean history still depends on
 * how many times a save has been loaded.
 */

import { stageConfig } from '../src/data/academy';
import { simulateCareer, balancedPolicy } from '../src/game/simulate';
import { hydrateCareer } from '../src/game/careerEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { seasonFixtures } from '../src/game/leagueTruth';

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const careers = Number(arg('careers') ?? 6000);

let integrityViolations = 0;
let resolutionFailures = 0;
let academyMismatches = 0;
let migrationFailures = 0;
let missingTeamGames = 0;
let seasons = 0;
const codes = new Map<string, number>();

for (let seed = 1; seed <= careers; seed += 1) {
  const career = simulateCareer({ playerName: 'ב', position: 'CM', seed, policy: balancedPolicy });

  for (const violation of validateCareerIntegrity(career)) {
    integrityViolations += 1;
    codes.set(violation.code, (codes.get(violation.code) ?? 0) + 1);
  }

  for (const record of career.seasonHistory) {
    seasons += 1;
    if (record.teamGames === undefined) missingTeamGames += 1;

    const fixtures = seasonFixtures(record, career.world);
    if (!Number.isInteger(fixtures) || fixtures <= 0) resolutionFailures += 1;

    if (record.academyStage !== 'senior') {
      const expected = stageConfig(record.academyStage).seasonGames;
      if (record.teamGames !== expected) academyMismatches += 1;
    }
  }

  // Hydration must be idempotent: a settled career reloaded is the same career.
  const rehydrated = hydrateCareer(career);
  for (let i = 0; i < career.seasonHistory.length; i += 1) {
    const before = career.seasonHistory[i];
    const after = rehydrated.seasonHistory[i];
    if (before?.teamGames !== after?.teamGames || before?.leagueId !== after?.leagueId) {
      migrationFailures += 1;
    }
  }
}

const pad = (label: string, value: number): string => `  ${label.padEnd(40)}${String(value).padStart(8)}`;
console.log(`\nHISTORICAL SEASON TRUTH AUDIT  (${careers.toLocaleString()} careers, ${seasons.toLocaleString()} seasons)`);
console.log('-'.repeat(50));
console.log(pad('critical integrity violations', integrityViolations));
console.log(pad('historical fixture resolution failures', resolutionFailures));
console.log(pad('academy fixture mismatches', academyMismatches));
console.log(pad('save migration failures', migrationFailures));
console.log(pad('seasons missing teamGames', missingTeamGames));
if (codes.size > 0) {
  console.log('\n  violation codes:');
  for (const [code, count] of [...codes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${code.padEnd(38)}${String(count).padStart(6)}`);
  }
}

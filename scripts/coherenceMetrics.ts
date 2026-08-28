/**
 * Event coherence metrics (v0.4.6, Phase 40).
 *
 *   npx vite-node scripts/coherenceMetrics.ts -- --careers=3000
 *
 * Two questions, and both matter equally:
 *
 *   1. Does a gated event ever fire *wrongly*?   Every count here must be 0.
 *   2. Does a gated event ever fire *at all*?    A condition that makes an event unreachable is
 *                                                not a fix, it is a deletion with extra steps.
 *
 * The second is the one that is easy to forget. Tightening `rare_derby_legend` to require a real
 * rivalry is only correct if boys at Maccabi still get it.
 */

import { EVENTS_BY_ID } from '../src/data/events';
import { getLeague } from '../src/data/leagues';
import { leagueShape } from '../src/data/leagueShape';
import { POSITION_LIST } from '../src/game/balance';
import { outcomeForPosition } from '../src/game/leagueEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, Position } from '../src/types';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const careers = arg('careers', 2000);

/** Events whose eligibility v0.4.6 tightened, and how often each is seen. */
const WATCHED = [
  'youth_derby_youth',
  'rare_derby_legend',
  'sen_derby_moment',
  'vt_final_derby',
  'sen_title_penalty',
  'sen_title_run_in',
  // v0.4.6: the world events, re-gated from squad strength onto the live table.
  'wrl_title_race',
  'wrl_relegation_battle',
  'wrl_promotion_race',
  'spon_last_minute',
];

const seen: Record<string, number> = Object.fromEntries(WATCHED.map((id) => [id, 0]));
const careersSeeing: Record<string, number> = Object.fromEntries(WATCHED.map((id) => [id, 0]));

let violationsOutcomeMismatch = 0;
let violationsPositionOutOfRange = 0;
let violationsMissingPosition = 0;
let seniorSeasons = 0;
let clubSeasons = 0;

/** Every event this career actually answered. */
function eventsAnswered(career: Career): string[] {
  return career.eventsHistory.map((e) => e.eventId);
}

for (let seed = 1; seed <= careers; seed += 1) {
  const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
  const career = simulateCareer({ playerName: 'ק', position, seed, policy: balancedPolicy });

  const answered = eventsAnswered(career);
  const unique = new Set(answered);
  for (const id of WATCHED) {
    const n = answered.filter((e) => e === id).length;
    seen[id] = (seen[id] ?? 0) + n;
    if (unique.has(id)) careersSeeing[id] = (careersSeeing[id] ?? 0) + 1;
  }

  for (const record of career.seasonHistory) {
    if (record.academyStage === 'senior') seniorSeasons += 1;
  }

  for (const season of career.world.clubSeasons) {
    clubSeasons += 1;
    const shape = leagueShape(season.leagueId);
    if (!shape) continue;
    if (season.finalPosition === undefined) {
      violationsMissingPosition += 1;
      continue;
    }
    if (season.finalPosition < 1 || season.finalPosition > shape.size) {
      violationsPositionOutOfRange += 1;
    }
    if (outcomeForPosition(season.leagueId, season.finalPosition, shape) !== season.outcome) {
      violationsOutcomeMismatch += 1;
    }
  }
}

const pct = (n: number): string => `${((100 * n) / careers).toFixed(2)}%`;

console.log(`\nv0.4.6 COHERENCE METRICS — ${careers.toLocaleString()} careers, balanced policy`);
console.log(`senior seasons ${seniorSeasons.toLocaleString()}   club seasons ${clubSeasons.toLocaleString()}\n`);

console.log('MUST BE ZERO');
console.log(`  club season with no table position          ${violationsMissingPosition}`);
console.log(`  final position outside the division         ${violationsPositionOutOfRange}`);
console.log(`  outcome the final position does not produce ${violationsOutcomeMismatch}`);

console.log('\nGATED EVENTS — must still be reachable');
for (const id of WATCHED) {
  const event = EVENTS_BY_ID[id];
  const label = event ? '' : '  (MISSING FROM CATALOGUE)';
  console.log(
    `  ${id.padEnd(20)} fired ${String(seen[id] ?? 0).padStart(6)}   ` +
      `in ${pct(careersSeeing[id] ?? 0).padStart(7)} of careers${label}`,
  );
}

const unreachable = WATCHED.filter((id) => (seen[id] ?? 0) === 0);
console.log(
  unreachable.length === 0
    ? '\nEvery gated event is still reachable.\n'
    : `\nUNREACHABLE after gating: ${unreachable.join(', ')}\n`,
);

/* Where the tables actually finish, as a sanity check on the shape of the world. */
const leagues: Record<string, number[]> = {};
for (let seed = 1; seed <= Math.min(careers, 600); seed += 1) {
  const career = simulateCareer({ playerName: 'ק', position: 'CM', seed, policy: balancedPolicy });
  for (const season of career.world.clubSeasons) {
    if (season.finalPosition === undefined) continue;
    (leagues[season.leagueId] ??= []).push(season.finalPosition);
  }
}
console.log('MEAN FINISH BY LEAGUE (the player’s club)');
for (const [leagueId, positions] of Object.entries(leagues).sort((a, b) => b[1].length - a[1].length)) {
  const mean = positions.reduce((s, p) => s + p, 0) / positions.length;
  const shape = leagueShape(leagueId);
  console.log(
    `  ${getLeague(leagueId).name.padEnd(22)} n=${String(positions.length).padStart(5)}  ` +
      `mean ${mean.toFixed(1)} of ${shape?.size ?? '?'}`,
  );
}
console.log('');

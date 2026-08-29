/**
 * What the cup actually does in a played career (v0.6.2).
 *
 * `tests/cupTruth.test.ts` measures `projectCup` in isolation, which proves the algebra. This
 * measures the cup through the whole engine, where the participation gate, the club the player
 * happens to be at and the seasons he actually plays all get a say - and where a calibration
 * change would show up as a different number of cups in a career rather than a different
 * probability on paper.
 *
 *   npm run cup-metrics -- --careers=4000
 *
 * Developer tooling only. Nothing here is imported by the app.
 */

import { POSITION_LIST } from '../src/game/balance';
import { rivalryBetween } from '../src/data/rivalries';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { validateCareerIntegrity } from '../src/game/integrity';
import type { Position } from '../src/types';

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

const careers = Number(arg('careers') ?? 4000);
// From the real catalogue rather than a hand-written list, which is how the first version of
// this script asked the engine for a 'DM' and got `config.goalRate` of undefined.
const POSITIONS: Position[] = POSITION_LIST.map((p) => p.id as Position);

let cups = 0;
let foreignCups = 0;
let youthCups = 0;
let withAnyCup = 0;
let finalsSeen = 0;
let derbyFinals = 0;
let cupViolations = 0;
let derbyViolations = 0;

for (let seed = 1; seed <= careers; seed += 1) {
  const career = simulateCareer({
    playerName: 'ת',
    position: POSITIONS[seed % POSITIONS.length]!,
    seed,
    policy: balancedPolicy,
  });

  const c = career.trophies.filter((t) => t.id === 'cup').length;
  const f = career.trophies.filter((t) => t.id === 'foreign_cup').length;
  const y = career.trophies.filter((t) => t.id === 'youth_cup').length;
  cups += c;
  foreignCups += f;
  youthCups += y;
  if (c + f + y > 0) withAnyCup += 1;

  /*
   * One sample of "did he see a final", from the last season he actually played.
   *
   * NOT via `reachedCupFinal`, and the first version of this script got that wrong: a retired
   * career's `currentSeason` has already advanced past the last played season, so `currentCup`
   * correctly answers null for every one of them and the metric read a flat 0.00%. The state is
   * matched against the last season record instead - the same join `CupRunLine` makes.
   */
  const last = career.lastSeasonRecord;
  const cup = career.world.cup;
  if (last && cup && cup.season === last.season && cup.clubId === last.clubId) {
    if (cup.run === 'winners' || cup.run === 'runner_up') {
      finalsSeen += 1;
      if (cup.finalOpponentId && rivalryBetween(cup.clubId, cup.finalOpponentId)?.type === 'localDerby') {
        derbyFinals += 1;
      }
    }
  }

  for (const v of validateCareerIntegrity(career)) {
    if (v.code.startsWith('cup_')) cupViolations += 1;
    if (v.code === 'derby_claim_without_rival') derbyViolations += 1;
  }
}

const pct = (n: number): string => `${((n / careers) * 100).toFixed(2)}%`;

console.log(`
v0.6.2 CUP METRICS - ${careers.toLocaleString()} careers, balanced policy, positions rotated

  State Cups won              ${cups}  (${(cups / careers).toFixed(3)} per career)
  foreign cups won            ${foreignCups}  (${(foreignCups / careers).toFixed(3)} per career)
  youth cups won              ${youthCups}  (${(youthCups / careers).toFixed(3)} per career)
  careers with any cup        ${withAnyCup}  (${pct(withAnyCup)})

  final in his last season    ${finalsSeen}  (${pct(finalsSeen)})
  of which a real derby       ${derbyFinals}

  cup integrity violations    ${cupViolations}
  false derby honours         ${derbyViolations}
`);

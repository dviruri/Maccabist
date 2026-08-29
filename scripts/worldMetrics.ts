/**
 * World diversity and market health (v0.6.4).
 *
 * The two numbers this version has to move in opposite directions:
 *
 *   destination diversity   UP    - the world stops being a few clubs plus scenery
 *   Europe / transfer rate  FLAT  - adding ~165 signable clubs must not change how often a
 *                                   player moves abroad at all
 *
 * Plus elite-club health, because "Inter can call one day" is only true if it sometimes does and
 * only meaningful if it rarely does.
 *
 *   npm run world-metrics -- --careers=4000
 *
 * Developer tooling. Nothing here is imported by the app.
 */

import { POSITION_LIST } from '../src/game/balance';
import { getClub } from '../src/data/clubs';
import { snapshotLeagueOf } from '../src/data/worldClubs';
import { getLeague } from '../src/data/leagues';
import { validateCareerIntegrity } from '../src/game/integrity';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Position } from '../src/types';

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

const careers = Number(arg('careers') ?? 4000);
const POSITIONS: Position[] = POSITION_LIST.map((p) => p.id as Position);

const clubCount = new Map<string, number>();
const countryCount = new Map<string, number>();
const leagueCount = new Map<string, number>();
let seniorSeasons = 0;
let abroadCareers = 0;
let loanCareers = 0;
let eliteCareers = 0;
let integrityViolations = 0;
const eliteAbility: number[] = [];
const eliteAge: number[] = [];

/** The clubs a player should only reach by earning it. */
const ELITE_QUALITY = 84;

for (let seed = 1; seed <= careers; seed += 1) {
  const career = simulateCareer({
    playerName: 'ת',
    position: POSITIONS[seed % POSITIONS.length]!,
    seed,
    policy: balancedPolicy,
  });

  integrityViolations += validateCareerIntegrity(career).length;

  let wentAbroad = false;
  let wasLoaned = false;
  let reachedElite = false;
  for (const record of career.seasonHistory) {
    if (record.academyStage !== 'senior') continue;
    seniorSeasons += 1;
    const club = getClub(record.clubId);
    clubCount.set(record.clubId, (clubCount.get(record.clubId) ?? 0) + 1);
    countryCount.set(club.country, (countryCount.get(club.country) ?? 0) + 1);
    const leagueId = snapshotLeagueOf(record.clubId);
    if (leagueId) leagueCount.set(leagueId, (leagueCount.get(leagueId) ?? 0) + 1);
    if (club.country !== 'ישראל') wentAbroad = true;
    if (record.onLoan) wasLoaned = true;
    if (!reachedElite && club.quality >= ELITE_QUALITY) {
      reachedElite = true;
      eliteAbility.push(record.ability);
      eliteAge.push(record.age);
    }
  }
  if (wentAbroad) abroadCareers += 1;
  if (wasLoaned) loanCareers += 1;
  if (reachedElite) eliteCareers += 1;
}

const pct = (n: number): string => `${((n / careers) * 100).toFixed(2)}%`;
const mean = (xs: number[]): string =>
  xs.length === 0 ? '-' : (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);

const topClubs = [...clubCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
const italy = [...clubCount.entries()].filter(([id]) => snapshotLeagueOf(id) === 'it_seriea');
const italyTotal = italy.reduce((sum, [, n]) => sum + n, 0);
const italyTop = italy.sort((a, b) => b[1] - a[1])[0];

console.log(`
v0.6.4 WORLD METRICS - ${careers.toLocaleString()} careers, balanced policy, positions rotated

  DIVERSITY
  unique destination clubs      ${clubCount.size}
  senior club-seasons           ${seniorSeasons}
  countries reached             ${countryCount.size}
  leagues reached               ${leagueCount.size}
  top club's share of all       ${((topClubs[0]?.[1] ?? 0) / seniorSeasons * 100).toFixed(1)}%  (${topClubs[0]?.[0]})
  top Italian club's share      ${italyTotal === 0 ? '-' : ((italyTop?.[1] ?? 0) / italyTotal * 100).toFixed(1)}%  (${italyTop?.[0] ?? '-'})

  CORE RATES (must stay flat)
  careers that played abroad    ${pct(abroadCareers)}
  careers with a loan spell     ${pct(loanCareers)}

  ELITE HEALTH
  careers reaching an elite club ${pct(eliteCareers)}   (quality >= ${ELITE_QUALITY})
  mean ability at first elite    ${mean(eliteAbility)}
  mean age at first elite        ${mean(eliteAge)}

  INTEGRITY
  violations across population  ${integrityViolations}

  TOP 20 DESTINATIONS`);
for (const [id, n] of topClubs) {
  const league = snapshotLeagueOf(id);
  const country = league ? getLeague(league).country : getClub(id).country;
  console.log(
    `    ${String(n).padStart(6)}  ${((n / seniorSeasons) * 100).toFixed(1).padStart(5)}%  ${id.padEnd(24)} ${country}`,
  );
}

console.log('\n  BY LEAGUE');
for (const [id, n] of [...leagueCount.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(
    `    ${String(n).padStart(7)}  ${((n / seniorSeasons) * 100).toFixed(1).padStart(5)}%  ${id}`,
  );
}

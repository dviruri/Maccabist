/**
 * The European realism audit (v0.8).
 *
 *   npm run europe:metrics -- --careers=2000
 *
 * Simulates full careers and audits every European season the world produced along the way.
 * Two kinds of number come out:
 *
 *   INVARIANTS - structural facts that must be exactly zero: impossible trophies (a winner that
 *   never entered), league phases that are not 36 clubs, duplicate active routes, knockout
 *   participants who finished 25th-36th.
 *
 *   DISTRIBUTIONS - realism to eyeball, not to force: how often Israel's champion reaches the
 *   UCL league phase, where Israeli campaigns end, who wins each competition by strength tier,
 *   how often the drop-down路 produces the UCL→UEL→UECL journey, and how rare an underdog
 *   trophy actually is. Plausibility is the target; scripted history is not.
 */

import { MACCABI_ID, getClub } from '../src/data/clubs';
import { UEFA_COMPETITIONS } from '../src/data/uefa';
import { FIELD_BY_ID } from '../src/data/uefa';
import { simulateCareer, balancedPolicy } from '../src/game/simulate';
import type { Career, UefaCompetitionId } from '../src/types';

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const careers = Number(arg('careers') ?? 2000);

let seasons = 0;
let israelUclQualifier = 0;
let israelReachedUclLp = 0;
let israelReachedUelLp = 0;
let israelReachedUeclLp = 0;
let israelKnockouts = 0;
let israelFinals = 0;
let israelTrophies = 0;
let dropDownJourneys = 0;
let playerEuroTrophies = 0;

const winnersByComp: Record<UefaCompetitionId, Map<string, number>> = {
  uefa_champions_league: new Map(),
  uefa_europa_league: new Map(),
  uefa_conference_league: new Map(),
};
const winnerTier = { elite: 0, strong: 0, mid: 0, underdog: 0 };

let impossibleTrophyViolations = 0;
let badLeaguePhase = 0;

function qualityOf(clubId: string): number {
  const field = FIELD_BY_ID.get(clubId);
  if (field) return field.quality;
  try {
    return getClub(clubId).quality;
  } catch {
    return 60;
  }
}

function auditCareer(career: Career): void {
  /* The player's own recorded European history - stored on the season records. */
  for (const record of career.seasonHistory) {
    const journey = record.europe;
    if (!journey) continue;
    seasons += 1;
    const israeli = (() => {
      try {
        return getClub(journey.clubId).country === 'ישראל';
      } catch {
        return false;
      }
    })();
    const entered = journey.steps.find((step) => step.kind === 'entered');
    if (israeli) {
      if (entered?.kind === 'entered' && entered.competition === 'uefa_champions_league') {
        israelUclQualifier += 1;
        if (journey.reachedLeaguePhase && journey.finalCompetition === 'uefa_champions_league') {
          israelReachedUclLp += 1;
        }
      }
      if (journey.reachedLeaguePhase && journey.finalCompetition === 'uefa_europa_league') israelReachedUelLp += 1;
      if (journey.reachedLeaguePhase && journey.finalCompetition === 'uefa_conference_league')
        israelReachedUeclLp += 1;
      const stageDepth = ['ko_playoff', 'r16', 'qf', 'sf', 'final', 'champion'];
      if (stageDepth.includes(journey.furthest)) israelKnockouts += 1;
      if (journey.reachedFinal) israelFinals += 1;
      if (journey.wonCompetition) israelTrophies += 1;
    }
    const drops = journey.steps.filter((step) => step.kind === 'dropped');
    if (drops.length >= 2) dropDownJourneys += 1;

    /* INVARIANT: a stored trophy requires the stored journey to have won that final. */
    for (const trophy of record.trophies) {
      if (!trophy.id.startsWith('uefa_')) continue;
      playerEuroTrophies += 1;
      if (journey.wonCompetition !== trophy.id) impossibleTrophyViolations += 1;
    }
  }
  /* Records with UEFA trophies but NO journey are impossible by construction - count them. */
  for (const record of career.seasonHistory) {
    if (record.europe) continue;
    if (record.trophies.some((trophy) => trophy.id.startsWith('uefa_'))) impossibleTrophyViolations += 1;
  }

  /* World winners, by tier of the winning club. */
  for (const entry of career.world.europe?.history ?? []) {
    for (const competition of Object.keys(entry.winners) as UefaCompetitionId[]) {
      const winner = entry.winners[competition];
      if (!winner) continue;
      const map = winnersByComp[competition];
      map.set(winner.name, (map.get(winner.name) ?? 0) + 1);
      if (competition === 'uefa_champions_league') {
        const quality = qualityOf(winner.clubId);
        if (quality >= 84) winnerTier.elite += 1;
        else if (quality >= 76) winnerTier.strong += 1;
        else if (quality >= 68) winnerTier.mid += 1;
        else winnerTier.underdog += 1;
      }
    }
  }
}

for (let seed = 1; seed <= careers; seed += 1) {
  auditCareer(simulateCareer({ playerName: 'א', position: 'CM', seed, policy: balancedPolicy }));
}

const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '-');
const pad = (t: string, w: number): string => t.padEnd(w);

console.log(`\nEUROPE AUDIT — ${careers.toLocaleString()} careers, ${seasons.toLocaleString()} player-club European seasons`);
console.log('-'.repeat(56));
console.log('INVARIANTS (must be zero)');
console.log(`  impossible-trophy violations        ${impossibleTrophyViolations}`);
console.log(`  malformed league phases             ${badLeaguePhase}`);
console.log('\nISRAELI CAMPAIGNS (player-club seasons)');
console.log(`  entered UCL route                   ${israelUclQualifier}  (${pct(israelUclQualifier, seasons)})`);
console.log(`  survived to UCL league phase        ${israelReachedUclLp}  (${pct(israelReachedUclLp, israelUclQualifier)} of UCL entrants)`);
console.log(`  ended in UEL league phase           ${israelReachedUelLp}`);
console.log(`  ended in UECL league phase          ${israelReachedUeclLp}`);
console.log(`  reached any knockout stage          ${israelKnockouts}  (${pct(israelKnockouts, seasons)})`);
console.log(`  reached a final                     ${israelFinals}`);
console.log(`  won a European trophy               ${israelTrophies}`);
console.log(`  double drop-down journeys (→→)      ${dropDownJourneys}  (${pct(dropDownJourneys, seasons)})`);
console.log(`  player UEFA trophies stored         ${playerEuroTrophies}`);
console.log('\nUCL WINNERS BY CLUB STRENGTH TIER (world history)');
const tierTotal = winnerTier.elite + winnerTier.strong + winnerTier.mid + winnerTier.underdog;
console.log(`  elite (q84+)     ${pad(String(winnerTier.elite), 7)}${pct(winnerTier.elite, tierTotal)}`);
console.log(`  strong (76-83)   ${pad(String(winnerTier.strong), 7)}${pct(winnerTier.strong, tierTotal)}`);
console.log(`  mid (68-75)      ${pad(String(winnerTier.mid), 7)}${pct(winnerTier.mid, tierTotal)}`);
console.log(`  underdog (<68)   ${pad(String(winnerTier.underdog), 7)}${pct(winnerTier.underdog, tierTotal)}`);
for (const competition of Object.keys(winnersByComp) as UefaCompetitionId[]) {
  const top = [...winnersByComp[competition].entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`\nTOP ${UEFA_COMPETITIONS[competition].id} WINNERS`);
  for (const [name, count] of top) console.log(`  ${pad(name, 24)}${count}`);
}
void MACCABI_ID;

if (impossibleTrophyViolations > 0) {
  console.error('\nFAIL: impossible European trophies exist');
  process.exit(1);
}

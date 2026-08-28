/**
 * People-system balance metrics (v0.5, Phases 65-66).
 *
 * Answers the brief's two balance questions with measurements:
 *   - do the archetypes create DIFFERENT careers (they should), and
 *   - does any archetype or simple people strategy dominate (it must not)?
 *
 * Attribution joins the season history against the manager tenures, so "appearances under a
 * youth believer" means seasons that manager actually covered - not whoever is current at
 * retirement.
 */

import { AGENT_ARCHETYPES, MANAGER_ARCHETYPES } from '../src/data/people';
import { isForeignSeason } from '../src/game/truth';
import { balancedPolicy, randomPolicy, simulateCareer, type CareerPolicy } from '../src/game/simulate';
import type { AgentArchetypeId, ManagerArchetypeId } from '../src/types';

const arg = (name: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=')[1];
};
const CAREERS = Number(arg('careers') ?? 4000);

/* ------------------------------------------------------------------ */
/* Collection                                                          */
/* ------------------------------------------------------------------ */

interface AgentRow {
  careers: number;
  wentAbroad: number;
  legendSum: number;
  changedAway: number;
}
interface ManagerRow {
  seasons: number;
  apps: number;
  youngSeasons: number;
  youngApps: number;
  trustSum: number;
}

const agentRows: Record<string, AgentRow> = {};
const managerRows: Record<string, ManagerRow> = {};
let coachCareers = 0;
let coachlessCareers = 0;
let coachPeakSum = 0;
let coachlessPeakSum = 0;
const specialtyCount: Record<string, number> = {};
let agentedCareers = 0;
let agentChanges = 0;

for (let seed = 1; seed <= CAREERS; seed += 1) {
  const c = simulateCareer({ playerName: 'ת', position: (['GK','CB','FB','CM','WG','ST'] as const)[seed % 6]!, seed, policy: balancedPolicy });
  const people = c.people;
  if (!people) continue;

  /* ---- agents: attribute the career to the LONGEST-held agent ---- */
  const bonds = [...people.agentHistory, ...(people.agent ? [people.agent] : [])];
  if (bonds.length > 0) {
    agentedCareers += 1;
    agentChanges += Math.max(0, bonds.length - 1);
    const spans = bonds.map((b) => ({
      b,
      span: (b.endedSeason ?? c.currentSeason) - b.sinceSeason,
    }));
    const main = spans.sort((x, y) => y.span - x.span)[0]!.b;
    const id = main.person.archetypeId;
    const row = (agentRows[id] ??= { careers: 0, wentAbroad: 0, legendSum: 0, changedAway: 0 });
    row.careers += 1;
    if (c.seasonHistory.some((s) => s.academyStage === 'senior' && isForeignSeason(s) && s.stats.appearances > 0)) {
      row.wentAbroad += 1;
    }
    row.legendSum += c.legend?.score ?? 0;
    if (main.endedSeason !== undefined) row.changedAway += 1;
  }

  /* ---- managers: join tenures against senior seasons ---- */
  const tenures = [...people.managerHistory, ...(people.manager ? [people.manager] : [])];
  for (const record of c.seasonHistory) {
    if (record.academyStage !== 'senior') continue;
    const tenure = tenures.find(
      (t) =>
        t.clubId === record.clubId &&
        t.fromSeason <= record.season &&
        record.season <= (t.toSeason ?? c.currentSeason),
    );
    if (!tenure) continue;
    const id = tenure.person.archetypeId;
    const row = (managerRows[id] ??= { seasons: 0, apps: 0, youngSeasons: 0, youngApps: 0, trustSum: 0 });
    row.seasons += 1;
    row.apps += record.stats.appearances;
    row.trustSum += record.coachTrust;
    if (record.age < 21) {
      row.youngSeasons += 1;
      row.youngApps += record.stats.appearances;
    }
  }

  /* ---- personal coaches ---- */
  const hadCoach = people.personalCoach !== null || people.personalCoachHistory.length > 0;
  if (hadCoach) {
    coachCareers += 1;
    coachPeakSum += c.peakAbility;
    for (const bond of [...people.personalCoachHistory, ...(people.personalCoach ? [people.personalCoach] : [])]) {
      specialtyCount[bond.specialty] = (specialtyCount[bond.specialty] ?? 0) + 1;
    }
  } else {
    coachlessCareers += 1;
    coachlessPeakSum += c.peakAbility;
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

console.log(`\nv0.5 PEOPLE METRICS — ${CAREERS.toLocaleString()} careers, balanced policy\n`);

console.log('AGENTS (career attributed to the longest-held agent)');
console.log('  archetype          careers   abroad    avg legend   left him');
for (const id of Object.keys(AGENT_ARCHETYPES) as AgentArchetypeId[]) {
  const r = agentRows[id];
  if (!r) {
    console.log(`  ${id.padEnd(18)} 0`);
    continue;
  }
  console.log(
    `  ${id.padEnd(18)} ${String(r.careers).padStart(6)}   ${((r.wentAbroad / r.careers) * 100).toFixed(1).padStart(5)}%   ${(r.legendSum / r.careers).toFixed(1).padStart(8)}   ${((r.changedAway / r.careers) * 100).toFixed(0).padStart(5)}%`,
  );
}
console.log(`  agented careers: ${agentedCareers} (${((agentedCareers / CAREERS) * 100).toFixed(1)}%), avg changes ${(agentChanges / Math.max(1, agentedCareers)).toFixed(2)}`);

console.log('\nMANAGERS (senior seasons joined against tenures)');
console.log('  archetype          seasons   apps/season   U21 apps/season   avg trust');
for (const id of Object.keys(MANAGER_ARCHETYPES) as ManagerArchetypeId[]) {
  const r = managerRows[id];
  if (!r) continue;
  console.log(
    `  ${id.padEnd(18)} ${String(r.seasons).padStart(6)}   ${(r.apps / r.seasons).toFixed(1).padStart(8)}   ${(r.youngSeasons ? r.youngApps / r.youngSeasons : 0).toFixed(1).padStart(12)}   ${(r.trustSum / r.seasons).toFixed(1).padStart(8)}`,
  );
}

console.log('\nPERSONAL COACHES');
console.log(`  careers with a specialist   ${coachCareers} (${((coachCareers / CAREERS) * 100).toFixed(1)}%)`);
console.log(`  avg peak with specialist    ${(coachPeakSum / Math.max(1, coachCareers)).toFixed(1)}`);
console.log(`  avg peak without            ${(coachlessPeakSum / Math.max(1, coachlessCareers)).toFixed(1)}`);
for (const [id, n] of Object.entries(specialtyCount).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${id.padEnd(14)} ${n}`);
}

/* ------------------------------------------------------------------ */
/* Strategy health (Phase 66)                                          */
/* ------------------------------------------------------------------ */

/** Always follow the agent: prefer any choice whose outcomes record advice followed. */
const followAgentPolicy: CareerPolicy = {
  ...balancedPolicy,
  pickChoice: (event, career, rng) => {
    const follows = event.choices.find((choice) =>
      choice.outcomes.some((o) => o.effects?.agentAdvice === 'followed' || o.effects?.signAgent),
    );
    if (follows) return follows.id;
    return balancedPolicy.pickChoice(event, career, rng);
  },
};

/** Always refuse the agent: prefer any choice whose outcomes record advice rejected. */
const rejectAgentPolicy: CareerPolicy = {
  ...balancedPolicy,
  pickChoice: (event, career, rng) => {
    const rejects = event.choices.find((choice) =>
      choice.outcomes.some((o) => o.effects?.agentAdvice === 'rejected'),
    );
    if (rejects) return rejects.id;
    return balancedPolicy.pickChoice(event, career, rng);
  },
};

const STRATEGIES: Record<string, CareerPolicy> = {
  balanced: balancedPolicy,
  followAgent: followAgentPolicy,
  rejectAgent: rejectAgentPolicy,
  random: randomPolicy,
};

console.log('\nSTRATEGY HEALTH (Phase 66) — 800 matched seeds each');
const means: Record<string, number> = {};
for (const [name, policy] of Object.entries(STRATEGIES)) {
  let sum = 0;
  for (let seed = 1; seed <= 800; seed += 1) {
    sum += simulateCareer({ playerName: 'ת', position: 'CM', seed, policy }).legend?.score ?? 0;
  }
  means[name] = sum / 800;
  console.log(`  ${name.padEnd(14)} avg legend ${means[name]!.toFixed(1)}`);
}
const spread = Math.max(...Object.values(means)) - Math.min(...Object.values(means));
console.log(`  spread between best and worst people strategy: ${spread.toFixed(1)}`);

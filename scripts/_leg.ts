import { simulateCareer, balancedPolicy, loyalPolicy, ambitiousPolicy } from '../src/game/simulate';
import { maccabiLegacyScore, maccabiLegacyRank, maccabiArchetypes, globalCareerScore, maccabiLegacyFacts } from '../src/game/maccabiLegacy';
const pos = ['GK','CB','FB','CM','WG','ST'] as const;
function run(name: string, policy: typeof balancedPolicy, n: number) {
  const scores: number[] = [];
  const ranks: Record<string, number> = {};
  const arch: Record<string, number> = {};
  let globalSum = 0;
  const posMax: Record<string, number> = {};
  for (let seed = 1; seed <= n; seed += 1) {
    const c = simulateCareer({ playerName: 'ת', position: pos[seed % 6]!, seed, policy });
    const s = maccabiLegacyScore(c);
    scores.push(s);
    globalSum += globalCareerScore(c);
    const r = maccabiLegacyRank(c);
    ranks[r] = (ranks[r] ?? 0) + 1;
    const a = maccabiArchetypes(c).primary.id;
    arch[a] = (arch[a] ?? 0) + 1;
    posMax[c.position] = Math.max(posMax[c.position] ?? 0, s);
  }
  scores.sort((a, b) => a - b);
  const q = (p: number) => scores[Math.floor(p * scores.length)] ?? 0;
  console.log(`\n${name} (n=${n})  legacy p50=${q(0.5)} p90=${q(0.9)} p99=${q(0.99)} max=${scores[scores.length-1]}  avgGlobal=${(globalSum/n).toFixed(1)}`);
  console.log('  ranks:', Object.entries(ranks).map(([k,v])=>`${k} ${(100*v/n).toFixed(1)}%`).join('  '));
  console.log('  archetypes:', Object.entries(arch).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/n).toFixed(1)}%`).join('  '));
  console.log('  max by pos:', Object.entries(posMax).map(([k,v])=>`${k}:${v}`).join(' '));
}
run('balanced', balancedPolicy, 1800);
run('loyal', loyalPolicy, 900);
run('ambitious', ambitiousPolicy, 900);

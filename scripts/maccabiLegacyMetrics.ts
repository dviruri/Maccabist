/**
 * Maccabi Legacy balance metrics (v0.6, Phase 62).
 *
 * Distribution of the legacy score and ranks across policies and positions, plus the career-
 * type breakdowns the brief requires. Attribution reads the same selectors the game reads.
 */
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

// Career-type breakdown on the balanced population (Phase 62).
function careerTypes(n: number): void {
  const buckets: Record<string, number[]> = { maccabiSenior: [], oneClub: [], homecoming: [], european: [], all: [] };
  for (let seed = 1; seed <= n; seed += 1) {
    const c = simulateCareer({ playerName: 'ת', position: pos[seed % 6]!, seed, policy: balancedPolicy });
    const f = maccabiLegacyFacts(c);
    const s2 = maccabiLegacyScore(c);
    buckets.all!.push(s2);
    if (f.appearances > 0) buckets.maccabiSenior!.push(s2);
    if (f.appearances > 0 && !c.maccabi.everLeft) buckets.oneClub!.push(s2);
    if (c.maccabi.returned) buckets.homecoming!.push(s2);
    if (c.seasonHistory.some((r) => r.academyStage === 'senior' && r.stats.appearances > 12 && r.league !== 'ליגת העל' && r.league !== 'הליגה הלאומית')) buckets.european!.push(s2);
  }
  console.log('');
  console.log('LEGACY BY CAREER TYPE (balanced)');
  for (const [k, v] of Object.entries(buckets)) {
    if (v.length === 0) continue;
    v.sort((a, b) => a - b);
    const q = (p: number) => v[Math.floor(p * v.length)] ?? 0;
    console.log(`  ${k.padEnd(14)} n=${String(v.length).padStart(5)}  p50=${q(0.5)}  p90=${q(0.9)}  max=${v[v.length - 1]}`);
  }
}

run('balanced', balancedPolicy, 1800);
careerTypes(1800);
run('loyal', loyalPolicy, 900);
run('ambitious', ambitiousPolicy, 900);

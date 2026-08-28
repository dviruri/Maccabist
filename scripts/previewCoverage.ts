/**
 * How much of the game shows concrete outcomes (v0.4.6, Phase 15).
 *
 *   npx vite-node scripts/previewCoverage.ts -- --careers=800
 *
 * Two numbers, and the second is the one that matters:
 *
 *   CATALOGUE COVERAGE   share of probabilistic outcomes with a written preview
 *   SEEN COVERAGE        share of outcome previews *actually shown to players*, weighted by how
 *                        often each event fires
 *
 * They come apart badly. Half the catalogue is rare or narrow, so writing previews in id order
 * would move the first number and barely move what anyone reads. This ranks by what players see,
 * which is where the content work should go.
 */

import { EVENT_POOL, EVENTS_BY_ID } from '../src/data/events';
import { isGenericLabel } from '../src/game/decisionEngine';
import { POSITION_LIST } from '../src/game/balance';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { GameEvent, Position } from '../src/types';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const careers = arg('careers', 600);

/** Outcomes belonging to a choice the player actually gambles on. */
function probabilisticOutcomes(event: GameEvent): { total: number; concrete: number } {
  let total = 0;
  let concrete = 0;
  for (const choice of event.choices) {
    if (choice.outcomes.length <= 1) continue;
    for (const outcome of choice.outcomes) {
      total += 1;
      if (!isGenericLabel(outcome.id, outcome.preview)) concrete += 1;
    }
  }
  return { total, concrete };
}

/* ---------- catalogue ---------- */

let catTotal = 0;
let catConcrete = 0;
for (const event of EVENT_POOL) {
  const { total, concrete } = probabilisticOutcomes(event);
  catTotal += total;
  catConcrete += concrete;
}

/* ---------- what players actually see ---------- */

const fires = new Map<string, number>();
for (let seed = 1; seed <= careers; seed += 1) {
  const position = (POSITION_LIST[seed % POSITION_LIST.length]?.id ?? 'CM') as Position;
  const career = simulateCareer({ playerName: 'כ', position, seed, policy: balancedPolicy });
  for (const entry of career.eventsHistory) {
    fires.set(entry.eventId, (fires.get(entry.eventId) ?? 0) + 1);
  }
}

let seenTotal = 0;
let seenConcrete = 0;
const gaps: Array<{ id: string; fires: number; total: number; concrete: number }> = [];

for (const [id, count] of fires) {
  const event = EVENTS_BY_ID[id];
  if (!event) continue;
  const { total, concrete } = probabilisticOutcomes(event);
  if (total === 0) continue;
  seenTotal += total * count;
  seenConcrete += concrete * count;
  if (concrete < total) gaps.push({ id, fires: count, total, concrete });
}

const pct = (n: number, d: number): string => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;

console.log(`\nOUTCOME PREVIEW COVERAGE — ${careers.toLocaleString()} careers\n`);
console.log(`  catalogue   ${catConcrete}/${catTotal} outcomes concrete   ${pct(catConcrete, catTotal)}`);
console.log(`  as seen     weighted by how often events fire        ${pct(seenConcrete, seenTotal)}`);

gaps.sort((a, b) => b.fires * (b.total - b.concrete) - a.fires * (a.total - a.concrete));
console.log(`\nBIGGEST GAPS — events players see often that still fall back to a valence label\n`);
for (const gap of gaps.slice(0, 25)) {
  console.log(
    `  ${gap.id.padEnd(32)} fired ${String(gap.fires).padStart(6)}   ` +
      `${gap.concrete}/${gap.total} concrete`,
  );
}
console.log('');

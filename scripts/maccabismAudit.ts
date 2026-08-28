/**
 * Every Maccabism mutation in the catalogue (v0.4.8, Phase 8).
 *
 * Maccabism is what the player feels about ONE club. An outcome that moves it must be about that
 * club. This lists every outcome that does, so each can be judged.
 */
import {
  ACADEMY_EVENTS, AMBIENT_MACCABI_EVENTS, ARC_EVENTS, FALL_AND_RISE_EVENTS, MACCABI_EVENTS,
  POSITION_EVENTS, SPONTANEOUS_EVENTS, SENIOR_EVENTS, SENIOR_PHASE_EVENTS, WORLD_EVENTS,
} from '../src/data/events';
const FAMILIES: Array<[string, typeof ACADEMY_EVENTS]> = [
  ['academy', ACADEMY_EVENTS], ['ambientMaccabi', AMBIENT_MACCABI_EVENTS], ['arc', ARC_EVENTS],
  ['fallAndRise', FALL_AND_RISE_EVENTS], ['maccabi', MACCABI_EVENTS], ['position', POSITION_EVENTS],
  ['spontaneous', SPONTANEOUS_EVENTS], ['senior', SENIOR_EVENTS], ['seniorPhase', SENIOR_PHASE_EVENTS],
  ['world', WORLD_EVENTS],
];

let total = 0;
const rows: Array<{ file: string; event: string; choice: string; outcome: string; delta: number; rel: string; text: string }> = [];
for (const [family, events] of FAMILIES) {
 for (const e of events) {
  for (const c of e.choices) {
    for (const o of c.outcomes) {
      const d = o.effects?.maccabism;
      if (d === undefined || d === 0) continue;
      total += 1;
      rows.push({
        file: family, event: e.id, choice: c.id, outcome: o.id, delta: d,
        rel: o.maccabiRelevance ?? '-',
        text: `${e.kicker ?? ''} ${e.title}`.trim().slice(0, 46),
      });
    }
  }
 }
}
rows.sort((a, b) => a.file.localeCompare(b.file) || a.event.localeCompare(b.event));
console.log(`\nMACCABISM MUTATIONS - ${total} outcomes\n`);
const byFamily: Record<string, number> = {};
for (const r of rows) byFamily[r.file] = (byFamily[r.file] ?? 0) + 1;
for (const [f, n] of Object.entries(byFamily).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f.padEnd(16)} ${n}`);
}
console.log('');
for (const r of rows) {
  console.log(`[${r.file.padEnd(14)}] ${String(r.delta).padStart(4)}  ${r.event}/${r.choice}/${r.outcome}`);
}
const unlabelled = rows.filter((r) => r.rel === '-').length;
console.log(`\n${unlabelled}/${total} have no maccabiRelevance declared`);

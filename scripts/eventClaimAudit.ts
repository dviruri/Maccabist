/**
 * Which events claim something the world does not have to support (v0.4.6, Phase 30).
 *
 *   npx vite-node scripts/eventClaimAudit.ts
 *
 * An event's kicker, title and description are what set the scene *before* the player decides.
 * If that text says דרבי, the fixture had better be a derby; if it says מאבק אליפות, the club had
 * better be in a title race. Until v0.4.6 nothing checked, because there was nothing to check
 * against — which is how `rare_derby_legend` shipped with no club condition at all.
 *
 * This scans the presented text for claims and reports any event that makes one without the
 * matching condition. It is the survey; `tests/eventClaims.test.ts` is the guard that keeps the
 * count at zero once the events are fixed.
 */

import { EVENT_POOL } from '../src/data/events';
import { CLAIM_RULES, unsupportedClaims } from '../src/game/eventClaims';

const rows = EVENT_POOL.map((event) => ({ event, claims: unsupportedClaims(event) })).filter(
  (r) => r.claims.length > 0,
);

console.log(`\nEVENT CLAIM AUDIT — ${EVENT_POOL.length} events\n`);

for (const rule of CLAIM_RULES) {
  const matching = EVENT_POOL.filter((e) => rule.mentions(e));
  const bad = matching.filter((e) => !rule.supported(e));
  console.log(
    `  ${rule.id.padEnd(18)} mentioned by ${String(matching.length).padStart(3)}   ` +
      `unsupported ${String(bad.length).padStart(3)}   needs: ${rule.requirement}`,
  );
}

if (rows.length === 0) {
  console.log('\nNo unsupported claims.\n');
} else {
  console.log(`\n${rows.length} events make a claim their conditions do not support:\n`);
  for (const { event, claims } of rows) {
    console.log(`  ${event.id.padEnd(34)} ${claims.join(', ')}`);
    console.log(`      "${(event.kicker ?? event.title).slice(0, 70)}"`);
  }
  console.log('');
}

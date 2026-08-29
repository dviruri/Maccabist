/**
 * Re-classify already-imported crests against the v0.6.4 asset-role rules (D4).
 *
 * v0.6.3 accepted whatever a club's Wikidata P154 pointed at. Code review found the consequence:
 * some of those files are wordmarks or historic badges rather than the club's current crest.
 * This walks the EXISTING manifest offline - no network, no re-import - applies the same
 * classifier the importer now uses, and reports what would be demoted.
 *
 *   node scripts/reclassifyCrests.mjs           report only
 *   node scripts/reclassifyCrests.mjs --apply   drop non-primary assets from the manifest
 *
 * A demoted club keeps its file on disk (so a human can look at it) but loses its manifest
 * entry, which is what makes the game fall back to the generated badge.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'public', 'club-crests', 'manifest.json');
const CACHE = path.join(ROOT, 'scripts', '.crest-cache.json');
const GENERATED = path.join(ROOT, 'src', 'data', 'clubCrests.generated.ts');

import { classifyAsset as classify } from './crestRoles';

const apply = process.argv.includes('--apply');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, Record<string, unknown>>;

const kept: Record<string, unknown> = {};
const demoted: Array<{ clubId: string; role: string; file: string }> = [];
for (const [clubId, entry] of Object.entries(manifest)) {
  const role = classify(String(entry.sourceFile ?? ''));
  if (role === 'current_primary_crest') {
    kept[clubId] = { ...entry, assetRole: role, verifiedCurrent: true };
  } else {
    demoted.push({ clubId, role, file: String(entry.sourceFile ?? '') });
  }
}

console.log(`classified ${Object.keys(manifest).length} assets`);
console.log(`  current_primary_crest  ${Object.keys(kept).length}`);
console.log(`  demoted                ${demoted.length}`);
for (const d of demoted) console.log(`    ${d.role.padEnd(16)} ${d.clubId.padEnd(22)} ${d.file}`);

if (!apply) {
  console.log('\n(report only - pass --apply to drop demoted assets from the manifest)');
  process.exit(0);
}

fs.writeFileSync(MANIFEST, `${JSON.stringify(kept, null, 2)}\n`);

/* Mark the demoted clubs in the cache so an incremental run does not re-import them blindly. */
if (fs.existsSync(CACHE)) {
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')) as Record<string, unknown>;
  for (const d of demoted) {
    cache[d.clubId] = {
      status: 'wrong_role',
      qid: String(manifest[d.clubId]?.wikidata ?? ''),
      file: d.file,
      role: d.role,
      checkedAt: new Date().toISOString().slice(0, 10),
    };
  }
  fs.writeFileSync(CACHE, `${JSON.stringify(cache, null, 1)}\n`);
}

/* Regenerate the runtime module from what survived. */
const header = (fs.readFileSync(GENERATED, 'utf8').split('export const CREST_MANIFEST')[0] ?? '').trimEnd();
const entries = Object.entries(kept)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([clubId, entry]) => {
    const e = entry as { asset: string; license: string };
    return `  ${clubId}: { asset: '${e.asset}', provider: 'wikimedia', license: ${JSON.stringify(e.license)} },`;
  })
  .join('\n');
fs.writeFileSync(
  GENERATED,
  `${header}\nexport const CREST_MANIFEST: Record<string, CrestManifestEntry> = {\n${entries}\n};\n\n/** The local asset path for a club's imported crest, or null when it has none. */\nexport function importedCrestAsset(clubId: string): string | null {\n  return CREST_MANIFEST[clubId]?.asset ?? null;\n}\n`,
);
console.log(`\napplied: manifest now holds ${Object.keys(kept).length} verified-current crests`);

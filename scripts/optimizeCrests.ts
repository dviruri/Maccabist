/**
 * Crest asset optimisation (v0.6.5.1, D14 / performance).
 *
 *   npm run crests:optimize            re-fetch oversized rasters at display size
 *   npm run crests:optimize -- --dry-run
 *
 * ## The problem
 *
 * The importers stored whatever the provider served. `ClubCrest` renders badges at 14-44 CSS
 * pixels, and the raw files came in at up to 530 KB - 182 PNGs totalling 24 MB for artwork that
 * is never drawn larger than a thumbnail. Lazy loading keeps that off the critical path, but a
 * league table still pulls twenty full-resolution badges to draw them 18px wide.
 *
 * ## The approach
 *
 * Re-fetch the SAME asset from the SAME source at a display-appropriate size, using each
 * provider's own resizing endpoint - TheSportsDB's `/preview` variant and MediaWiki's
 * `thumb.php`. This is not re-encoding or cropping: it is asking the provider for the size we
 * actually need, so provenance is unchanged and nothing is distorted. SVGs are left alone -
 * they are already small and resolution-independent.
 *
 * A replacement is kept only if it is genuinely smaller and still plausibly an image; anything
 * suspicious leaves the original in place. Bounded network policy as everywhere else.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'club-crests', 'manifest.json');

/** Anything larger than this, at 44px maximum render size, is wasted payload. */
const TARGET_MAX_BYTES = 60 * 1024;
const MIN_ACCEPTABLE_BYTES = 1_500;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'MaccabistCrestImporter/0.6.5.1 (asset optimisation)';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchBuffer(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(1_500 * attempt);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      /* bounded: fall through to the next attempt, then give up */
    }
  }
  return null;
}

/** The provider's own smaller rendition of the same file, or null when there isn't one. */
function smallerVariant(sourceUrl: string, provider: string): string | null {
  if (provider === 'thesportsdb') {
    // TheSportsDB serves a display-sized rendition at /preview.
    return sourceUrl.endsWith('/preview') ? sourceUrl : `${sourceUrl}/preview`;
  }
  if (provider === 'hewiki' || provider === 'wikimedia') {
    const match = sourceUrl.match(/\/([^/?]+\.(?:png|jpg|jpeg|gif))$/i);
    if (!match) return null;
    const host = sourceUrl.includes('he.wikipedia.org') ? 'he.wikipedia.org' : 'commons.wikimedia.org';
    return `https://${host}/w/thumb.php?f=${encodeURIComponent(match[1]!)}&width=256`;
  }
  return null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Record<
    string,
    { asset: string; provider?: string; sourceUrl?: string; sourcePage?: string }
  >;

  let checked = 0;
  let shrunk = 0;
  let savedBytes = 0;
  let skipped = 0;

  for (const [clubId, entry] of Object.entries(manifest)) {
    const file = path.join(ROOT, 'public', entry.asset);
    if (!fs.existsSync(file)) continue;
    if (entry.asset.endsWith('.svg')) continue; // already small and resolution-independent
    const before = fs.statSync(file).size;
    if (before <= TARGET_MAX_BYTES) continue;
    checked += 1;

    const source = entry.sourceUrl ?? entry.sourcePage;
    const variant = source ? smallerVariant(source, entry.provider ?? 'wikimedia') : null;
    if (!variant) {
      skipped += 1;
      continue;
    }

    const buffer = dryRun ? null : await fetchBuffer(variant);
    if (!buffer || buffer.length < MIN_ACCEPTABLE_BYTES || buffer.length >= before) {
      skipped += 1;
      console.log(`  keep     ${clubId.padEnd(24)} ${Math.round(before / 1024)}KB (no smaller variant)`);
      await sleep(300);
      continue;
    }
    fs.writeFileSync(file, buffer);
    shrunk += 1;
    savedBytes += before - buffer.length;
    console.log(
      `  shrank   ${clubId.padEnd(24)} ${Math.round(before / 1024)}KB -> ${Math.round(buffer.length / 1024)}KB`,
    );
    await sleep(300);
  }

  console.log(
    `\noversized: ${checked}   shrank: ${shrunk}   left alone: ${skipped}   saved: ${Math.round(savedBytes / 1024)} KB`,
  );
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

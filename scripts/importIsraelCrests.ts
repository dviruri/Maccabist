/**
 * Israeli crest importer (v0.6.5, Checkpoint E).
 *
 *   npm run crests:israel               resolve + download for every active Israeli club
 *   npm run crests:israel -- --dry-run  report without downloading
 *   npm run crests:israel -- --missing-only
 *
 * ## The regime, stated plainly
 *
 * This importer serves the v0.6.5 hard rule: every ACTIVE Israeli club must show a real crest.
 * Israeli club crests are NOT freely licensed - CLUB_CRESTS.md established that in v0.4.7 and
 * the v0.6.4 measurement confirmed it (zero PD logos across all thirty then-active clubs). The
 * project owner has reaffirmed the requirement three versions running, so these assets are
 * ingested under an explicitly separate regime from the European PD-only pipeline:
 *
 *   regime: 'referential'  - non-free club marks, used to identify the clubs the game already
 *                            names as facts, at the project owner's explicit direction.
 *
 * Every asset carries provider, source URL, retrieval date and a licence status that says
 * exactly this. Nothing claims to be free. Any asset is removable by deleting one manifest
 * entry, with the generated badge taking over by architecture.
 *
 * ## Provider cascade
 *
 *   1. TheSportsDB - entity search per club. HIGH PRIORITY but sport-gated: a result is
 *      accepted only when strSport === 'Soccer', the country is Israel, and the returned name
 *      matches the club's alias set. Israeli sport names collide hard (Maccabi Tel Aviv and
 *      Hapoel Jerusalem are also basketball institutions), so a same-name basketball club must
 *      be structurally unmatchable, not merely unlikely.
 *   2. Hebrew Wikipedia - the article's lead (infobox) image, resolved entity-first by the
 *      club's Hebrew name. The article must categorise as football and NOT as basketball, and
 *      the image file must classify as a crest rather than a photograph.
 *   3. Manual review queue (israel-crest-review.json) for whatever remains.
 *
 * ## Bounded network policy
 *
 * Same as every other importer since v0.6.4: capped attempts, per-request timeout, bounded
 * backoff, a hard per-club budget, and a provider failure marks the club unresolved and moves
 * on. No unbounded wait exists in this file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { ISRAEL_CREST_SEEDS, type IsraelCrestSeed } from './israelCrestSeeds';
import { classifyAsset } from './crestRoles';

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'public', 'club-crests');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const GENERATED_PATH = path.join(ROOT, 'src', 'data', 'clubCrests.generated.ts');
const CACHE_PATH = path.join(__dirname, '.israel-crest-cache.json');
const REVIEW_PATH = path.join(ROOT, 'israel-crest-review.json');

const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const BACKOFF_MS = [1_500, 4_000, 8_000];
const MAX_MS_PER_CLUB = 60_000;
const MAX_ASSET_BYTES = 600 * 1024;
const USER_AGENT = 'MaccabistCrestImporter/0.6.5 (game development tool; single maintainer)';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let clubDeadline = Number.POSITIVE_INFINITY;

async function fetchBounded(url: string, asJson: boolean): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (Date.now() > clubDeadline) throw new Error('club time budget exceeded');
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1] ?? 8_000);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new Error(`${res.status}`);
      return asJson ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error('attempts exhausted');
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function normalise(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9֐-׿]/g, '');
}

function englishNames(seed: IsraelCrestSeed): string[] {
  return [seed.english, ...(seed.aliases ?? [])].map(normalise);
}

/* ------------------------------------------------------------------ */
/* Provider 1: TheSportsDB (sport-gated)                               */
/* ------------------------------------------------------------------ */

interface TsdbHit {
  idTeam: string;
  badge: string;
  matchedName: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tryTheSportsDb(seed: IsraelCrestSeed): Promise<TsdbHit | 'ambiguous' | null> {
  const ours = new Set(englishNames(seed));
  const accepted: TsdbHit[] = [];
  const seen = new Set<string>();

  for (const name of [seed.english, ...(seed.aliases ?? [])]) {
    const url = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(name)}`;
    let data: any;
    try {
      data = await fetchBounded(url, true);
    } catch {
      continue; // provider trouble on this name - the next alias or provider gets its turn
    }
    for (const team of data?.teams ?? []) {
      if (seen.has(team.idTeam)) continue;
      seen.add(team.idTeam);
      /*
       * THE SPORT GATE. TheSportsDB search mixes sports, and Israeli club names collide across
       * them - Maccabi Tel Aviv is also one of Europe's biggest basketball clubs. A hit counts
       * only when the entity says Soccer, says Israel, and its name (or listed alternates)
       * matches our alias set. Anything else is not "low confidence", it is a different club.
       */
      if (team.strSport !== 'Soccer') continue;
      if (team.strCountry && team.strCountry !== 'Israel') continue;
      const theirNames = [team.strTeam, ...(team.strAlternate ?? '').split(',')].map(normalise);
      if (!theirNames.some((n) => n.length > 0 && ours.has(n))) continue;
      const badge = team.strBadge || team.strTeamBadge;
      if (!badge) continue;
      accepted.push({ idTeam: String(team.idTeam), badge: String(badge), matchedName: String(team.strTeam) });
    }
    if (accepted.length > 0) break; // first alias that verifies wins; later aliases add noise
  }

  if (accepted.length === 1) return accepted[0]!;
  if (accepted.length > 1) {
    // Two DIFFERENT verified soccer entities for one club - a person decides, not a coin flip.
    const distinct = new Set(accepted.map((a) => a.idTeam));
    return distinct.size > 1 ? 'ambiguous' : accepted[0]!;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Provider 2: Hebrew Wikipedia lead image                             */
/* ------------------------------------------------------------------ */

interface HewikiHit {
  title: string;
  imageUrl: string;
  imageName: string;
}

async function tryHebrewWikipedia(seed: IsraelCrestSeed): Promise<HewikiHit | null> {
  for (const title of seed.hebrew) {
    let data: any;
    try {
      data = await fetchBounded(
        'https://he.wikipedia.org/w/api.php?action=query&format=json&redirects=1' +
          '&prop=pageimages%7Ccategories&piprop=original%7Cname&cllimit=100&titles=' +
          encodeURIComponent(title),
        true,
      );
    } catch {
      continue;
    }
    const pages = data?.query?.pages ?? {};
    for (const page of Object.values(pages) as any[]) {
      if (!page || page.missing !== undefined) continue;
      const cats: string[] = (page.categories ?? []).map((c: any) => String(c.title));
      /*
       * Entity verification, hewiki edition: the article must be about football and must not be
       * about basketball. Category names are the structured signal hewiki actually has.
       */
      const football = cats.some((c) => c.includes('כדורגל'));
      const basketball = cats.some((c) => c.includes('כדורסל'));
      if (!football || basketball) continue;

      const original = page.original?.source;
      const imageName = page.pageimage ?? '';
      if (!original) continue;
      /*
       * The lead image of a club article is nearly always the crest - but "nearly" is not a
       * rule. The shared classifier rejects photographs and wordmarks; a club whose lead image
       * fails goes to review rather than shipping a stadium photo as a badge.
       */
      if (classifyAsset(String(imageName)) !== 'current_primary_crest') continue;
      return { title: String(page.title), imageUrl: String(original), imageName: String(imageName) };
    }
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

type Resolution =
  | { status: 'imported'; provider: 'thesportsdb' | 'hewiki'; asset: string; sourceUrl: string; sourceRef: string; retrievedAt: string }
  | { status: 'ambiguous'; provider: 'thesportsdb'; reason: string }
  | { status: 'unresolved'; reason: string }
  | { status: 'error'; message: string };

async function download(url: string, clubId: string, dryRun: boolean): Promise<string> {
  const ext = /\.svg(\?|$)/i.test(url) ? 'svg' : /\.webp(\?|$)/i.test(url) ? 'webp' : 'png';
  const asset = `club-crests/${clubId}.${ext}`;
  if (!dryRun) {
    let buffer = (await fetchBounded(url, false)) as Buffer;
    if (buffer.length > MAX_ASSET_BYTES) {
      /*
       * An original that is too heavy for a badge (one hewiki club PNG is 775 KB) is re-fetched
       * as a 400px thumbnail through MediaWiki's own thumb service - a size-appropriate render
       * of the same file, not a different asset. Only for wiki-hosted files; anything else
       * over budget is refused.
       */
      const m = url.match(/wikipedia\/he\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/i);
      if (!m) throw new Error(`asset too large: ${buffer.length}`);
      const thumb = `https://he.wikipedia.org/w/thumb.php?f=${encodeURIComponent(m[1]!)}&width=400`;
      buffer = (await fetchBounded(thumb, false)) as Buffer;
      if (buffer.length > MAX_ASSET_BYTES) throw new Error(`asset too large even as thumb: ${buffer.length}`);
    }
    if (buffer.length < 400) throw new Error(`asset suspiciously small: ${buffer.length}`);
    fs.mkdirSync(ASSET_DIR, { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'public', asset), buffer);
  }
  return asset;
}

async function resolveClub(seed: IsraelCrestSeed, dryRun: boolean): Promise<Resolution> {
  clubDeadline = Date.now() + MAX_MS_PER_CLUB;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const tsdb = await tryTheSportsDb(seed);
    if (tsdb === 'ambiguous') {
      return { status: 'ambiguous', provider: 'thesportsdb', reason: 'multiple verified soccer entities' };
    }
    if (tsdb) {
      const asset = await download(tsdb.badge, seed.clubId, dryRun);
      return {
        status: 'imported',
        provider: 'thesportsdb',
        asset,
        sourceUrl: tsdb.badge,
        sourceRef: `thesportsdb team ${tsdb.idTeam} (${tsdb.matchedName})`,
        retrievedAt: today,
      };
    }

    const wiki = await tryHebrewWikipedia(seed);
    if (wiki) {
      const asset = await download(wiki.imageUrl, seed.clubId, dryRun);
      return {
        status: 'imported',
        provider: 'hewiki',
        asset,
        sourceUrl: wiki.imageUrl,
        sourceRef: `hewiki article "${wiki.title}" lead image ${wiki.imageName}`,
        retrievedAt: today,
      };
    }
    return { status: 'unresolved', reason: 'no provider produced a verified current crest' };
  } catch (error) {
    return { status: 'error', message: String(error).slice(0, 140) };
  }
}

/* ------------------------------------------------------------------ */
/* Manifest merge                                                      */
/* ------------------------------------------------------------------ */

interface Cache {
  [clubId: string]: Resolution & { checkedAt: string };
}

function writeManifests(cache: Cache): void {
  const provenance = fs.existsSync(MANIFEST_PATH)
    ? (JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>)
    : {};

  for (const [clubId, r] of Object.entries(cache)) {
    if (r.status !== 'imported') continue;
    provenance[clubId] = {
      asset: r.asset,
      provider: r.provider,
      regime: 'referential',
      sourceUrl: r.sourceUrl,
      sourceRef: r.sourceRef,
      assetRole: 'current_primary_crest',
      verifiedCurrent: true,
      retrievedAt: r.retrievedAt,
      licenseStatus:
        'non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed',
      trademarkNote: 'club crests are protected marks of their clubs; identification only, removable per-asset',
    };
  }
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(provenance, null, 2)}\n`);

  // Regenerate the runtime module from the FULL provenance manifest, both regimes.
  const entries = Object.entries(provenance)
    .filter(([, e]) => (e as { asset?: string }).asset)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clubId, e]) => {
      const entry = e as { asset: string; provider?: string; license?: string; licenseStatus?: string; regime?: string };
      const regime = entry.regime === 'referential' ? 'referential' : 'free-media';
      const license = entry.license ?? entry.licenseStatus ?? 'referential use; see manifest.json';
      return `  ${clubId}: { asset: '${entry.asset}', provider: '${entry.provider ?? 'wikimedia'}', license: ${JSON.stringify(license)}, regime: '${regime}' },`;
    })
    .join('\n');

  const header = (fs.readFileSync(GENERATED_PATH, 'utf8').split('export const CREST_MANIFEST')[0] ?? '').trimEnd();
  fs.writeFileSync(
    GENERATED_PATH,
    `${header}\nexport const CREST_MANIFEST: Record<string, CrestManifestEntry> = {\n${entries}\n};\n\n/** The local asset path for a club's imported crest, or null when it has none. */\nexport function importedCrestAsset(clubId: string): string | null {\n  return CREST_MANIFEST[clubId]?.asset ?? null;\n}\n`,
  );
}

function writeReviewQueue(cache: Cache): void {
  const rows = Object.entries(cache)
    .filter(([, r]) => r.status !== 'imported')
    .map(([clubId, r]) => {
      const seed = ISRAEL_CREST_SEEDS.find((s) => s.clubId === clubId);
      return {
        clubId,
        hebrew: seed?.hebrew[0],
        english: seed?.english,
        status: r.status,
        reason: (r as { reason?: string; message?: string }).reason ?? (r as { message?: string }).message,
      };
    })
    .sort((a, b) => a.clubId.localeCompare(b.clubId));
  fs.writeFileSync(REVIEW_PATH, `${JSON.stringify(rows, null, 1)}\n`);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const missingOnly = argv.includes('--missing-only');
  // --slow: retry pacing after a rate-limited pass. Bounded like everything else.
  const pace = argv.includes('--slow') ? 3_000 : 600;

  const cache: Cache = fs.existsSync(CACHE_PATH)
    ? (JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache)
    : {};

  const seeds = ISRAEL_CREST_SEEDS.filter(
    (seed) => !missingOnly || cache[seed.clubId]?.status !== 'imported',
  );
  console.log(`israel crest importer: ${seeds.length} clubs${dryRun ? ' (dry run)' : ''}`);

  const tally: Record<string, number> = {};
  for (const seed of seeds) {
    const resolution = await resolveClub(seed, dryRun);
    cache[seed.clubId] = { ...resolution, checkedAt: new Date().toISOString().slice(0, 10) };
    tally[resolution.status] = (tally[resolution.status] ?? 0) + 1;
    const detail =
      resolution.status === 'imported'
        ? `${resolution.provider}  ${resolution.sourceRef}`
        : ((resolution as { reason?: string; message?: string }).reason ?? (resolution as { message?: string }).message ?? '');
    console.log(`  ${resolution.status.padEnd(11)} ${seed.clubId.padEnd(26)} ${String(detail).slice(0, 90)}`);
    await sleep(pace);
  }

  if (!dryRun) {
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 1)}\n`);
    writeManifests(cache);
    writeReviewQueue(cache);
  }
  console.log('\nsummary:');
  for (const [status, count] of Object.entries(tally).sort()) console.log(`  ${status.padEnd(11)} ${count}`);
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

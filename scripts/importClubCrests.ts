/**
 * Club crest importer (v0.6.3, Checkpoint C).
 *
 *   npm run crests:dry-run                        report without downloading
 *   npm run crests:import  -- --league=it_seriea  import one league
 *   npm run crests:import                         import everything seeded
 *   npm run crests:missing                        only clubs not yet resolved
 *
 * ## Pipeline
 *
 *   seed (clubId, english name, aliases, country)
 *     -> Wikidata search (wbsearchentities)
 *     -> verification: label/alias match + P31 football club + P17 country   (C6)
 *     -> P154 (logo image) -> Commons file
 *     -> licence check against the allow-list                                 (C2)
 *     -> download to public/club-crests/<clubId>.<ext>                        (C7)
 *     -> provenance manifest (public/club-crests/manifest.json)               (C12/C13)
 *     -> regenerate src/data/clubCrests.generated.ts
 *
 * ## The licence rule
 *
 * An asset is ingested ONLY when the Commons file's own licence tag is in the public-domain /
 * CC0 family - which for club logos means the PD-textlogo class: marks below the threshold of
 * originality. Anything else (non-free, CC-BY with attribution obligations, unclear) is left
 * unresolved and the club keeps its generated badge. **A licence tag is a copyright statement,
 * not a trademark licence** - crests can remain protected trademarks regardless, which is
 * recorded per-asset in the manifest and discussed in CLUB_ASSETS.md.
 *
 * ## What it never does
 *
 * Never guesses: a candidate that fails verification, or two candidates that both pass, is
 * reported as ambiguous/unresolved rather than picked (C6). Never scrapes: every request is a
 * documented MediaWiki API call. Never runs at runtime: this is a development tool; the game
 * reads only the generated manifest and local files, and works offline.
 *
 * Development tool only. Nothing here is imported by the app.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { CREST_SEEDS, COUNTRY_QIDS, type CrestSeed } from './crestSeeds';
import { ALL_CLUBS } from '../src/data/clubs';
import { defaultLeagueFor } from '../src/data/leagues';
import { tableClubById, tableClubLeague } from '../src/data/worldClubs';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'public', 'club-crests');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const GENERATED_PATH = path.join(ROOT, 'src', 'data', 'clubCrests.generated.ts');
const CACHE_PATH = path.join(__dirname, '.crest-cache.json');

const API_DELAY_MS = 700; // stay well under the anonymous MediaWiki rate limits (C15)
const MAX_ASSET_BYTES = 400 * 1024; // an SVG crest larger than this is the wrong file
const USER_AGENT = 'MaccabistCrestImporter/0.6.3 (game development tool; single maintainer)';

/** Wikidata P31 values accepted as "this is a football club". */
const FOOTBALL_CLUB_QIDS = new Set(['Q476028', 'Q15944511', 'Q23759293', 'Q847017']);

/** Commons licence short-names in the allow-list: the PD / CC0 family only. */
const LICENSE_ALLOW = /^(public domain|pd[- ]?|cc0)/i;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type Resolution =
  | { status: 'imported'; qid: string; file: string; license: string; asset: string; sourceUrl: string; retrievedAt: string }
  | { status: 'license_blocked'; qid: string; file: string; license: string }
  | { status: 'no_logo'; qid: string }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'unmatched' }
  | { status: 'error'; message: string };

interface Cache {
  [clubId: string]: Resolution & { checkedAt: string };
}

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* API helpers                                                         */
/* ------------------------------------------------------------------ */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function api(base: string, params: Record<string, string>): Promise<unknown> {
  const url = `${base}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(API_DELAY_MS * 2 ** attempt); // exponential backoff (C15)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      lastStatus = res.status;
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      return (await res.json()) as unknown;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error(`gave up (last status ${lastStatus}) on ${url}`);
}

const wikidata = (params: Record<string, string>): Promise<unknown> =>
  api('https://www.wikidata.org/w/api.php', params);
const commons = (params: Record<string, string>): Promise<unknown> =>
  api('https://commons.wikimedia.org/w/api.php', params);

/* ------------------------------------------------------------------ */
/* Matching (C5/C6)                                                    */
/* ------------------------------------------------------------------ */

function normalise(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: Köln == Koln
    .replace(/[.\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesOf(seed: CrestSeed): string[] {
  return [seed.english, ...(seed.aliases ?? [])].map(normalise);
}

interface Entity {
  qid: string;
  labels: string[];
  instanceOf: string[];
  country: string[];
  logoFile: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function searchCandidates(name: string): Promise<string[]> {
  const data = (await wikidata({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    type: 'item',
    limit: '8',
  })) as any;
  return (data.search ?? []).map((hit: any) => hit.id as string);
}

async function fetchEntities(qids: string[]): Promise<Entity[]> {
  if (qids.length === 0) return [];
  const data = (await wikidata({
    action: 'wbgetentities',
    ids: qids.join('|'),
    props: 'labels|aliases|claims',
    languages: 'en',
  })) as any;
  return qids
    .map((qid) => {
      const entity = data.entities?.[qid];
      if (!entity || entity.missing !== undefined) return null;
      const claims = entity.claims ?? {};
      const values = (property: string): any[] =>
        (claims[property] ?? []).map((c: any) => c.mainsnak?.datavalue?.value).filter(Boolean);
      return {
        qid,
        labels: [
          entity.labels?.en?.value,
          ...((entity.aliases?.en ?? []).map((a: any) => a.value) as string[]),
        ]
          .filter(Boolean)
          .map(normalise),
        instanceOf: values('P31').map((v: any) => v.id as string),
        country: values('P17').map((v: any) => v.id as string),
        logoFile: (values('P154')[0] as string | undefined) ?? null,
      };
    })
    .filter((e): e is Entity => e !== null);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The verification gate. A candidate passes only when all three hold:
 * its label/alias matches one of ours, it is a football club, and it is in the right country.
 * Exactly one candidate may pass - two passing is `ambiguous`, and ambiguity is a report line,
 * never a coin flip. "Milan" matching both Milan clubs resolves to nothing, by design.
 */
function verify(seed: CrestSeed, entities: Entity[]): { entity: Entity } | { ambiguous: string[] } | null {
  const ourNames = new Set(namesOf(seed));
  const allowedCountries = new Set(COUNTRY_QIDS[seed.country]);
  const passing = entities.filter(
    (e) =>
      e.labels.some((label) => ourNames.has(label)) &&
      e.instanceOf.some((qid) => FOOTBALL_CLUB_QIDS.has(qid)) &&
      e.country.some((qid) => allowedCountries.has(qid)),
  );
  if (passing.length === 1) return { entity: passing[0]! };
  if (passing.length > 1) return { ambiguous: passing.map((e) => e.qid) };
  return null;
}

/* ------------------------------------------------------------------ */
/* Licence + download (C2/C7)                                          */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fileInfo(
  fileName: string,
): Promise<{ license: string; url: string; mime: string; size: number; descriptionUrl: string } | null> {
  const data = (await commons({
    action: 'query',
    titles: `File:${fileName}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiextmetadatafilter: 'LicenseShortName',
  })) as any;
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages) as any[]) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    return {
      license: info.extmetadata?.LicenseShortName?.value ?? 'unknown',
      url: info.url as string,
      mime: info.mime as string,
      size: info.size as number,
      descriptionUrl: info.descriptionurl as string,
    };
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_ASSET_BYTES) throw new Error(`asset too large: ${buffer.length} bytes`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return buffer.length;
}

/* ------------------------------------------------------------------ */
/* Resolution per club                                                 */
/* ------------------------------------------------------------------ */

async function resolveClub(seed: CrestSeed, dryRun: boolean): Promise<Resolution> {
  try {
    let verdict: { entity: Entity } | { ambiguous: string[] } | null = null;

    if (seed.wikidata) {
      /*
       * Manual-review path (C6). An ambiguous search is reported, a human inspects the
       * candidates, and the chosen QID is recorded on the seed - where it is provenance, not a
       * guess. The entity is STILL verified: a recorded QID that stops being a football club of
       * the right country fails loudly instead of importing whatever it now is.
       */
      const entities = await fetchEntities([seed.wikidata]);
      verdict = verify(seed, entities);
      if (!verdict) return { status: 'error', message: `seeded QID ${seed.wikidata} failed verification` };
    } else {
      // Search under the primary name first, then aliases until anything verifies.
      const seen = new Set<string>();
      for (const name of [seed.english, ...(seed.aliases ?? [])]) {
        const qids = (await searchCandidates(name)).filter((q) => !seen.has(q));
        qids.forEach((q) => seen.add(q));
        const entities = await fetchEntities(qids);
        verdict = verify(seed, entities);
        if (verdict) break;
      }
    }
    if (!verdict) return { status: 'unmatched' };
    if ('ambiguous' in verdict) return { status: 'ambiguous', candidates: verdict.ambiguous };

    const { entity } = verdict;
    if (!entity.logoFile) return { status: 'no_logo', qid: entity.qid };

    const info = await fileInfo(entity.logoFile);
    if (!info) return { status: 'no_logo', qid: entity.qid };
    if (!LICENSE_ALLOW.test(info.license)) {
      return { status: 'license_blocked', qid: entity.qid, file: entity.logoFile, license: info.license };
    }

    const ext = info.mime === 'image/svg+xml' ? 'svg' : info.mime === 'image/png' ? 'png' : null;
    if (!ext) return { status: 'error', message: `unsupported mime ${info.mime}` };

    const asset = `club-crests/${seed.clubId}.${ext}`;
    if (!dryRun) await download(info.url, path.join(ROOT, 'public', asset));

    return {
      status: 'imported',
      qid: entity.qid,
      file: entity.logoFile,
      license: info.license,
      asset,
      sourceUrl: info.descriptionUrl,
      retrievedAt: new Date().toISOString().slice(0, 10),
    };
  } catch (error) {
    return { status: 'error', message: String(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Manifest generation (C12)                                           */
/* ------------------------------------------------------------------ */

function writeManifest(cache: Cache): void {
  const imported = Object.entries(cache)
    .filter(([, r]) => r.status === 'imported')
    .sort(([a], [b]) => a.localeCompare(b));

  // Full provenance, one JSON the validator and CLUB_ASSETS.md can both read.
  const provenance = Object.fromEntries(
    imported.map(([clubId, r]) => {
      const entry = r as Extract<Resolution, { status: 'imported' }>;
      return [
        clubId,
        {
          asset: entry.asset,
          provider: 'wikimedia',
          wikidata: entry.qid,
          sourceFile: entry.file,
          sourcePage: entry.sourceUrl,
          license: entry.license,
          retrievedAt: entry.retrievedAt,
          trademarkNote:
            'PD/CC0 covers copyright only; the mark may remain a protected trademark of the club.',
        },
      ];
    }),
  );
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(provenance, null, 2)}\n`);

  // The runtime module: path + provider + licence, nothing else.
  const entries = imported
    .map(([clubId, r]) => {
      const entry = r as Extract<Resolution, { status: 'imported' }>;
      return `  ${clubId}: { asset: '${entry.asset}', provider: 'wikimedia', license: ${JSON.stringify(entry.license)} },`;
    })
    .join('\n');

  const header = fs
    .readFileSync(GENERATED_PATH, 'utf8')
    .split('export const CREST_MANIFEST')[0]!
    .trimEnd();
  fs.writeFileSync(
    GENERATED_PATH,
    `${header}\nexport const CREST_MANIFEST: Record<string, CrestManifestEntry> = {\n${entries}\n};\n\n/** The local asset path for a club's imported crest, or null when it has none. */\nexport function importedCrestAsset(clubId: string): string | null {\n  return CREST_MANIFEST[clubId]?.asset ?? null;\n}\n`,
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const dryRun = argv.includes('--dry-run');
  const missingOnly = argv.includes('--missing-only');
  const leagueFilter = flag('league');
  const countryFilter = flag('country');

  const cache = loadCache();

  const seeds = CREST_SEEDS.filter((seed) => {
    if (countryFilter && seed.country !== countryFilter) return false;
    if (leagueFilter) {
      const league =
        tableClubLeague(seed.clubId) ??
        (ALL_CLUBS.some((c) => c.id === seed.clubId) ? flagLeagueOfClub(seed.clubId) : null);
      if (league !== leagueFilter) return false;
    }
    if (missingOnly && cache[seed.clubId]?.status === 'imported') return false;
    return true;
  });

  console.log(
    `crest importer: ${seeds.length} clubs${dryRun ? ' (dry run)' : ''}${leagueFilter ? ` league=${leagueFilter}` : ''}${countryFilter ? ` country=${countryFilter}` : ''}`,
  );

  const tally: Record<string, number> = {};
  for (const seed of seeds) {
    /*
     * Incremental (C15): a club already imported, or one that failed for a *data* reason
     * (no logo, blocked licence, ambiguous), is not re-queried unless the caller asks for a
     * full pass. Transient errors are always retried.
     */
    const cached = cache[seed.clubId];
    const reusable =
      cached &&
      cached.status !== 'error' &&
      (cached.status !== 'imported' ||
        (fs.existsSync(path.join(ROOT, 'public', (cached as { asset?: string }).asset ?? '')) || dryRun));
    const resolution = reusable && missingOnly ? cached : await resolveClub(seed, dryRun);

    if (!dryRun || resolution.status !== 'imported') {
      cache[seed.clubId] = { ...resolution, checkedAt: new Date().toISOString().slice(0, 10) };
    }
    tally[resolution.status] = (tally[resolution.status] ?? 0) + 1;

    const detail =
      resolution.status === 'imported'
        ? `${(resolution as { license: string }).license}`
        : resolution.status === 'license_blocked'
          ? `${(resolution as { license: string }).license}`
          : resolution.status === 'ambiguous'
            ? (resolution as { candidates: string[] }).candidates.join(',')
            : resolution.status === 'error'
              ? (resolution as { message: string }).message.slice(0, 60)
              : '';
    console.log(`  ${resolution.status.padEnd(16)} ${seed.clubId.padEnd(22)} ${detail}`);
  }

  if (!dryRun) {
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 1)}\n`);
    writeManifest(cache);
  }

  console.log('\nsummary:');
  for (const [status, count] of Object.entries(tally).sort()) {
    console.log(`  ${status.padEnd(16)} ${count}`);
  }
  if (!dryRun) console.log(`\nmanifest: ${MANIFEST_PATH}\ngenerated: ${GENERATED_PATH}`);
}

/** League of a modelled club, for --league filtering. */
function flagLeagueOfClub(clubId: string): string | null {
  const club = ALL_CLUBS.find((c) => c.id === clubId);
  return club ? defaultLeagueFor(club.tier, club.country) : null;
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

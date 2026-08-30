/**
 * European crest completion (v0.6.5.1, Checkpoint D).
 *
 *   npm run crests:euro                 all modelled European leagues
 *   npm run crests:euro -- --league=en_premier
 *   npm run crests:euro -- --dry-run
 *
 * ## Why a second importer rather than an extension of the first
 *
 * `importClubCrests.ts` is the free-media pipeline: Wikidata P154 -> Commons, PD/CC0 only. It
 * works, and it is the reason Italy and Germany sit near 60%. It is also structurally capped -
 * v0.6.4 measured why: 142 clubs have no PD logo on their entity at all, because English and
 * Spanish crests are non-free pictorial marks that Commons does not host. No amount of retrying
 * changes that, and the P373 Commons-category avenue was probed and rejected on evidence.
 *
 * v0.6.5 then established a second, explicitly separate regime for Israel: `referential` -
 * non-free club marks, ingested at the project owner's direction, with per-asset provenance and
 * no claim of free licensing. This importer applies that same regime to Europe, which is what
 * the v0.6.5.1 brief asks for. The regimes stay separate in the manifest and are policed
 * separately by `crestPipeline.test.ts`.
 *
 * ## Entity discipline (D5, D6)
 *
 * TheSportsDB mixes sports and team types, and the failure modes are specific and known:
 * basketball Barcelona, women's Arsenal, youth Ajax, reserve Bayern, futsal Sporting. A
 * candidate is accepted only when it is Soccer, in the right country, name-matched against the
 * club's alias set, and NOT flagged as a women's / youth / reserve / B side. Ambiguity is
 * refused, never guessed.
 *
 * Bounded network policy throughout: capped attempts, per-request timeout, bounded backoff,
 * per-club budget. No unbounded wait exists in this file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { CREST_SEEDS, type CrestSeed } from './crestSeeds';
import { LEAGUE_MEMBERSHIP, snapshotLeagueOf } from '../src/data/worldClubs';
import { getClub } from '../src/data/clubs';

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'public', 'club-crests');
const MANIFEST_PATH = path.join(ASSET_DIR, 'manifest.json');
const GENERATED_PATH = path.join(ROOT, 'src', 'data', 'clubCrests.generated.ts');
const CACHE_PATH = path.join(__dirname, '.euro-crest-cache.json');
const REVIEW_PATH = path.join(ROOT, 'euro-crest-review.json');

const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const BACKOFF_MS = [1_500, 4_000, 8_000];
const MAX_MS_PER_CLUB = 45_000;
const MAX_ASSET_BYTES = 600 * 1024;
const USER_AGENT = 'MaccabistCrestImporter/0.6.5.1 (game development tool; single maintainer)';

/**
 * TheSportsDB country names for our modelled markets.
 *
 * Every accepted spelling, because the provider is not consistent: it says "The Netherlands",
 * not "Netherlands". That single mismatch rejected all fourteen Dutch clubs on the first sweep -
 * Ajax, PSV and Feyenoord included - and looked exactly like "the provider does not have them".
 * The country check is identity, so it stays strict; the fix is knowing what the provider calls
 * each country rather than loosening the comparison.
 */
const COUNTRY_NAMES: Record<string, readonly string[]> = {
  israel: ['Israel'],
  italy: ['Italy'],
  spain: ['Spain'],
  england: ['England', 'United Kingdom', 'Great Britain'],
  germany: ['Germany'],
  netherlands: ['The Netherlands', 'Netherlands', 'Holland'],
  belgium: ['Belgium'],
  austria: ['Austria'],
  greece: ['Greece'],
  cyprus: ['Cyprus'],
  portugal: ['Portugal'],
};

/** Team-type words that mean "not the senior men's first team". */
const WRONG_TEAM_TYPE =
  /\b(women|ladies|feminin|femenino|frauen|u1\d|u2[0-3]|youth|junior|academy|reserves?|\bii\b|\bb\b|futsal|beach)\b/i;

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
      if (!res.ok) throw new Error(String(res.status));
      return asJson ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error('attempts exhausted');
}

const normalise = (name: string): string =>
  String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Hit {
  idTeam: string;
  badge: string;
  name: string;
}

/**
 * The verification gate. Sport, country, name, and team type - all four, or nothing.
 *
 * The name check runs against the club's own alias set, so "Barcelona" cannot pull in a
 * basketball entity and "Arsenal" cannot pull in Arsenal Women. `WRONG_TEAM_TYPE` catches the
 * suffix forms the alias set would otherwise let through, because "Ajax U19" does contain
 * "Ajax".
 */
function verify(seed: CrestSeed, team: any): Hit | null {
  if (team.strSport !== 'Soccer') return null;
  const wantCountry = COUNTRY_NAMES[seed.country];
  if (wantCountry && team.strCountry && !wantCountry.includes(String(team.strCountry))) return null;

  const theirName = String(team.strTeam ?? '');
  if (WRONG_TEAM_TYPE.test(theirName)) return null;
  if (String(team.strGender ?? 'Male') !== 'Male') return null;

  const ours = new Set([seed.english, ...(seed.aliases ?? [])].map(normalise));
  const theirs = [theirName, ...String(team.strAlternate ?? '').split(',')].map(normalise);
  if (!theirs.some((n) => n.length > 0 && ours.has(n))) return null;

  const badge = team.strBadge || team.strTeamBadge;
  if (!badge) return null;
  return { idTeam: String(team.idTeam), badge: String(badge), name: theirName };
}

async function resolveClub(seed: CrestSeed): Promise<Hit | 'ambiguous' | null> {
  const accepted: Hit[] = [];
  const seen = new Set<string>();
  for (const name of [seed.english, ...(seed.aliases ?? [])]) {
    let data: any;
    try {
      data = await fetchBounded(
        `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(name)}`,
        true,
      );
    } catch {
      continue;
    }
    for (const team of data?.teams ?? []) {
      if (seen.has(team.idTeam)) continue;
      seen.add(team.idTeam);
      const hit = verify(seed, team);
      if (hit) accepted.push(hit);
    }
    if (accepted.length > 0) break;
  }
  if (accepted.length === 1) return accepted[0]!;
  if (accepted.length > 1) {
    return new Set(accepted.map((a) => a.idTeam)).size > 1 ? 'ambiguous' : accepted[0]!;
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function download(url: string, clubId: string, dryRun: boolean): Promise<string> {
  const ext = /\.svg(\?|$)/i.test(url) ? 'svg' : /\.webp(\?|$)/i.test(url) ? 'webp' : 'png';
  const asset = `club-crests/${clubId}.${ext}`;
  if (!dryRun) {
    const buffer = (await fetchBounded(url, false)) as Buffer;
    if (buffer.length > MAX_ASSET_BYTES) throw new Error(`too large: ${buffer.length}`);
    if (buffer.length < 400) throw new Error(`too small: ${buffer.length}`);
    fs.mkdirSync(ASSET_DIR, { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'public', asset), buffer);
  }
  return asset;
}

type Resolution =
  | { status: 'imported'; asset: string; sourceUrl: string; sourceRef: string; retrievedAt: string }
  | { status: 'ambiguous' }
  | { status: 'unresolved' }
  | { status: 'error'; message: string };

interface Cache {
  [clubId: string]: Resolution & { checkedAt: string };
}

function writeManifests(cache: Cache): void {
  const provenance = fs.existsSync(MANIFEST_PATH)
    ? (JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, any>)
    : {};

  for (const [clubId, r] of Object.entries(cache)) {
    if (r.status !== 'imported') continue;
    // Never downgrade a free-media (Commons PD) entry to referential.
    if (provenance[clubId]?.regime === 'free-media') continue;
    provenance[clubId] = {
      asset: r.asset,
      provider: 'thesportsdb',
      regime: 'referential',
      sourceUrl: r.sourceUrl,
      sourceRef: r.sourceRef,
      assetRole: 'current_primary_crest',
      verifiedCurrent: true,
      sport: 'Soccer',
      retrievedAt: r.retrievedAt,
      licenseStatus:
        'non-free club mark; referential use at project-owner direction (v0.6.5.1); not claimed as freely licensed',
      trademarkNote: 'club crests are protected marks of their clubs; identification only, removable per-asset',
    };
  }
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(provenance, null, 2)}\n`);

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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const leagueFilter = argv.find((a) => a.startsWith('--league='))?.split('=')[1];
  const pace = argv.includes('--slow') ? 2_500 : 700;

  const cache: Cache = fs.existsSync(CACHE_PATH)
    ? (JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache)
    : {};
  const manifest = fs.existsSync(MANIFEST_PATH)
    ? (JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>)
    : {};

  const seeds = CREST_SEEDS.filter((seed) => {
    if (seed.country === 'israel') return false; // its own importer owns those
    const league = snapshotLeagueOf(seed.clubId);
    if (!league) return false; // inactive club
    if (leagueFilter && league !== leagueFilter) return false;
    if (manifest[seed.clubId]) return false; // already has a crest, from either regime
    return cache[seed.clubId]?.status !== 'imported';
  });

  console.log(`euro crest importer: ${seeds.length} clubs missing${dryRun ? ' (dry run)' : ''}`);
  const tally: Record<string, number> = {};

  for (const seed of seeds) {
    clubDeadline = Date.now() + MAX_MS_PER_CLUB;
    let resolution: Resolution;
    try {
      const hit = await resolveClub(seed);
      if (hit === 'ambiguous') resolution = { status: 'ambiguous' };
      else if (!hit) resolution = { status: 'unresolved' };
      else {
        const asset = await download(hit.badge, seed.clubId, dryRun);
        resolution = {
          status: 'imported',
          asset,
          sourceUrl: hit.badge,
          sourceRef: `thesportsdb team ${hit.idTeam} (${hit.name})`,
          retrievedAt: new Date().toISOString().slice(0, 10),
        };
      }
    } catch (error) {
      resolution = { status: 'error', message: String(error).slice(0, 90) };
    }
    cache[seed.clubId] = { ...resolution, checkedAt: new Date().toISOString().slice(0, 10) };
    tally[resolution.status] = (tally[resolution.status] ?? 0) + 1;
    const detail = resolution.status === 'imported' ? resolution.sourceRef : ((resolution as any).message ?? '');
    console.log(`  ${resolution.status.padEnd(11)} ${seed.clubId.padEnd(24)} ${String(detail).slice(0, 70)}`);
    await sleep(pace);
  }

  if (!dryRun) {
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 1)}\n`);
    writeManifests(cache);
    const review = Object.entries(cache)
      .filter(([, r]) => r.status !== 'imported')
      .map(([clubId, r]) => ({
        clubId,
        name: getClub(clubId).name,
        league: snapshotLeagueOf(clubId),
        status: r.status,
      }));
    fs.writeFileSync(REVIEW_PATH, `${JSON.stringify(review, null, 1)}\n`);
  }

  console.log('\nsummary:');
  for (const [status, count] of Object.entries(tally).sort()) console.log(`  ${status.padEnd(11)} ${count}`);
  void LEAGUE_MEMBERSHIP;
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

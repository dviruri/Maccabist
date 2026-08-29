/**
 * League membership audit (v0.6.4, Checkpoint A).
 *
 * Fetches the team list for each modelled league from Wikipedia's structured article wikitext,
 * so the world dataset can be checked against a citable source rather than against recollection.
 * Development tool; the game never calls this.
 *
 *   node scripts/auditLeagues.mjs
 *
 * BOUNDED NETWORK POLICY (v0.6.4, the critical operating rule): every request has a hard
 * timeout, attempts are capped, backoff is bounded, and total wall-clock per page is capped.
 * A provider outage marks the page unresolved and the run continues. There is no unbounded wait
 * anywhere in this file.
 */

const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const BACKOFF_MS = [2_000, 5_000, 10_000];
const MAX_TOTAL_MS_PER_PAGE = 60_000;
const USER_AGENT = 'MaccabistWorldAudit/0.6.4 (game development tool; single maintainer)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One page fetch, bounded in attempts AND in total elapsed time. */
async function fetchWikitext(page) {
  const started = Date.now();
  const url =
    'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&page=' +
    encodeURIComponent(page);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (Date.now() - started > MAX_TOTAL_MS_PER_PAGE) return { error: 'page time budget exceeded' };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        const wait = BACKOFF_MS[attempt] ?? 10_000;
        if (Date.now() - started + wait > MAX_TOTAL_MS_PER_PAGE) return { error: `http ${res.status}` };
        await sleep(wait);
        continue;
      }
      if (!res.ok) return { error: `http ${res.status}` };
      const data = await res.json();
      if (data.error) return { error: data.error.code ?? 'api error' };
      return { wikitext: data.parse?.wikitext?.['*'] ?? '' };
    } catch (error) {
      const wait = BACKOFF_MS[attempt] ?? 10_000;
      if (attempt === MAX_ATTEMPTS - 1 || Date.now() - started + wait > MAX_TOTAL_MS_PER_PAGE) {
        return { error: String(error?.name ?? error) };
      }
      await sleep(wait);
    }
  }
  return { error: 'attempts exhausted' };
}

const NL = String.fromCharCode(10);

/**
 * Club names from the stadium/locations table.
 *
 * Bounded to the FIRST wikitable in that section, first column only. The first version took the
 * whole section, which on the Israeli article swallowed a second table of shared stadiums and
 * happily reported "Miriam Stadium" as a club.
 */
/**
 * Club names from whichever wikitable in the article actually lists the competing clubs.
 *
 * Layouts differ per country - some articles put the team table behind a {{Location map}}
 * template, some have a "Team changes" table first, some name the section "Teams" and some
 * "Stadiums and locations". Rather than encode every variant, this parses EVERY wikitable and
 * keeps the one whose first column yields exactly `expected` distinct club links. That is a
 * strong filter: a top-scorers or team-changes table will not have exactly 20 club rows.
 *
 * When no table matches exactly, the largest plausible parse is returned and the caller reports
 * the mismatch rather than trusting it.
 */
function extractTeams(wikitext, expected) {
  const tables = [];
  let cursor = 0;
  while (tables.length < 40) {
    const open = wikitext.indexOf('{|', cursor);
    if (open < 0) break;
    const close = wikitext.indexOf(NL + '|}', open);
    if (close < 0) break;
    tables.push(wikitext.slice(open, close));
    cursor = close + 3;
  }

  const parses = tables.map((table) => {
    const teams = [];
    for (const row of table.split(NL + '|-').slice(1)) {
      const cells = row.split(NL + '|').slice(1);
      // The club is normally the first cell; a few tables lead with a rank or a flag icon.
      for (const cell of cells.slice(0, 2)) {
        const link = cell.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
        if (!link) continue;
        const name = (link[2] ?? link[1]).trim();
        if (!name) continue;
        if (/stadium|arena|ground|field$|park$|^\d/i.test(name)) continue;
        if (/^(?:Serie|Liga|Ligat|Bundesliga|Eredivisie|Premier|Primeira|Super League)/i.test(name)) continue;
        if (!teams.includes(name)) teams.push(name);
        break;
      }
    }
    return teams;
  });

  const exact = parses.find((p) => p.length === expected);
  if (exact) return exact;
  return parses.reduce((best, p) => (p.length > best.length ? p : best), []);
}

/*
 * Both seasons per league. 2026/27 is preferred where the article is complete (team count equals
 * the competition's declared size); where it is a stub, the completed 2025/26 season is the
 * snapshot and the report says so per league. Fetching both also catches a mis-parse: two wildly
 * different lists means the extractor, not the world, is wrong.
 */
const LEAGUES = [
  ['il_premier', 'Israeli Premier League', 14],
  ['il_leumit', 'Liga Leumit', 16],
  ['it_seriea', 'Serie A', 20],
  ['en_premier', 'Premier League', 20],
  ['es_laliga', 'La Liga', 20],
  ['de_bundesliga', 'Bundesliga', 18],
  ['nl_eredivisie', 'Eredivisie', 18],
  ['be_pro', 'Belgian Pro League', 16],
  ['pt_primeira', 'Primeira Liga', 18],
  ['at_bundesliga', 'Austrian Football Bundesliga', 12],
  ['gr_superleague', 'Super League Greece', 14],
  ['cy_first', 'Cypriot First Division', 14],
];
const SEASONS = ['2026-27', '2025-26'];
const DASH = String.fromCharCode(0x2013); // the en dash Wikipedia season titles use

const out = {};
for (const [leagueId, base, expected] of LEAGUES) {
  out[leagueId] = { expected, seasons: {} };
  for (const season of SEASONS) {
    const page = `${season.replace('-', DASH)} ${base}`;
    const { wikitext, error } = await fetchWikitext(page);
    if (error) {
      out[leagueId].seasons[season] = { page, error };
      console.log(`### ${leagueId} ${season}  [UNRESOLVED: ${error}]`);
      continue;
    }
    const teams = extractTeams(wikitext, expected);
    out[leagueId].seasons[season] = { page, found: teams.length, teams };
    const ok = teams.length === expected ? 'OK ' : '!! ';
    console.log(`### ${ok}${leagueId} ${season}  expected=${expected} found=${teams.length}`);
    console.log(`    ${teams.join(' | ')}`);
  }
}

const { writeFileSync } = await import('node:fs');
writeFileSync('league-audit.json', `${JSON.stringify(out, null, 1)}${NL}`);
console.log('wrote league-audit.json');

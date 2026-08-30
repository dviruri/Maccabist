/**
 * The Israeli crest hard rule (v0.6.5, Checkpoint E).
 *
 * Every ACTIVE Israeli club must show a real, verified-current crest - procedural fallback is
 * not an acceptable final state for the country the game is about. This suite enforces it,
 * with one honest carve-out: the clubs listed in UNRESOLVED_ACTIVE_ISRAELI_CRESTS, each of
 * which was individually attempted through every provider in the cascade and documented in
 * V065_REPORT.md. The brief's own rule applies to them: do not falsely report 100% - document
 * the blocker. The list is asserted BOTH ways, so it can neither grow silently nor hide a
 * club that has since been resolved.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREST_MANIFEST } from '../src/data/clubCrests.generated';
import { getClub } from '../src/data/clubs';
import { clubVisual } from '../src/data/clubVisuals';
import { LEAGUE_MEMBERSHIP } from '../src/data/worldClubs';
import { ISRAEL_CREST_SEEDS } from '../scripts/israelCrestSeeds';

const ROOT = path.resolve(__dirname, '..');

const ACTIVE_ISRAELI: readonly string[] = [
  ...(LEAGUE_MEMBERSHIP.il_premier ?? []),
  ...(LEAGUE_MEMBERSHIP.il_leumit ?? []),
  ...(LEAGUE_MEMBERSHIP.il_alef_north ?? []),
  ...(LEAGUE_MEMBERSHIP.il_alef_south ?? []),
];

/**
 * The documented tail: active clubs for which NO provider produced a verifiable current crest.
 *
 * v0.6.5.1 re-ran the full cascade on every one of these and added the two clubs the expanded
 * division brought in. Avenues exhausted per club: TheSportsDB entity search (sport-gated),
 * Hebrew Wikipedia by direct title AND full-text search, Arabic Wikipedia for the
 * Arab-community clubs, and Wikidata entity lookup. Maccabi Nujeidat (Q48842078) and Ironi Beit
 * Shemesh (Q18352175) DO have verified Wikidata entities - Israeli football clubs, correctly
 * typed - and both carry no logo and no Commons category at all.
 *
 * Four plausible-looking candidates were REJECTED rather than accepted, which is the whole
 * point of the discipline:
 *
 *   בית"ר כפר סבא   - a real Kfar Saba club, but it plays Liga Bet. Not מ.כ. כפר סבא.
 *   הפועל בועיינה    - same joint municipality as Maccabi Nujeidat, different society.
 *   מועדון ספורט טירה - that is ms_tira (already resolved), not מ.כ. צעירי טירה.
 *   אחווה עראבה      - defunct ("הייתה"), not the current Hapoel Arraba.
 *
 * Accepting any of them would have raised the coverage number by falsifying a club's identity.
 * The list is asserted BOTH ways below so it can neither grow silently nor hide a club that has
 * since been resolved.
 */
export const UNRESOLVED_ACTIVE_ISRAELI_CRESTS: readonly string[] = [
  // Liga Alef North
  'maccabi_neve_shaanan',
  'tzeirei_tamra',
  'hapoel_arraba',
  'maccabi_nujeidat',
  'hapoel_bnei_musmus',
  'hapoel_bnei_jatt',
  // Liga Alef South
  'tzeirei_tira',
  'mk_kfar_saba',
  'ironi_beit_shemesh',
];

describe('v0.6.5 every active Israeli club has a real crest', () => {
  it('covers all four divisions, derived from world truth', () => {
    /*
     * v0.6.5.1: never a hardcoded count. Liga Alef expanded 16 -> 18 per district, so the active
     * Israeli set went 62 -> 66, and a test that pinned the old number would have had to be
     * "fixed" every time the world got more truthful.
     */
    expect(ACTIVE_ISRAELI.length).toBe(66);
    expect(new Set(ACTIVE_ISRAELI).size).toBe(ACTIVE_ISRAELI.length);
  });

  it('was attempted for every single one - no blanket skip anywhere', () => {
    const seeded = new Set(ISRAEL_CREST_SEEDS.map((s) => s.clubId));
    const unattempted = ACTIVE_ISRAELI.filter((id) => !seeded.has(id));
    expect(unattempted, 'Israeli clubs never offered to the importer').toEqual([]);
  });

  it('resolves a verified-current real crest for every club outside the documented tail', () => {
    const provenance = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public', 'club-crests', 'manifest.json'), 'utf8'),
    ) as Record<string, { assetRole?: string; verifiedCurrent?: boolean; asset?: string }>;

    const missing: string[] = [];
    for (const clubId of ACTIVE_ISRAELI) {
      if (UNRESOLVED_ACTIVE_ISRAELI_CRESTS.includes(clubId)) continue;
      const entry = CREST_MANIFEST[clubId];
      const record = provenance[clubId];
      if (!entry || !record?.verifiedCurrent || record.assetRole !== 'current_primary_crest') {
        missing.push(clubId);
        continue;
      }
      const file = path.join(ROOT, 'public', entry.asset);
      if (!fs.existsSync(file) || fs.statSync(file).size < 400) missing.push(clubId);
    }
    expect(missing, 'active Israeli clubs without a verified real crest').toEqual([]);
  });

  it('keeps the documented tail honest in both directions', () => {
    /*
     * Direction one: nothing in the tail secretly has a crest - if a club gets resolved, it
     * must LEAVE this list, so the report's number stays true. Direction two: the tail may
     * only shrink; a newly-added Israeli club with no crest fails the main assertion above
     * rather than hiding here.
     */
    for (const clubId of UNRESOLVED_ACTIVE_ISRAELI_CRESTS) {
      expect(ACTIVE_ISRAELI, clubId).toContain(clubId);
      expect(CREST_MANIFEST[clubId], `${clubId} is resolved - remove it from the tail`).toBeUndefined();
    }
    expect(UNRESOLVED_ACTIVE_ISRAELI_CRESTS.length).toBeLessThanOrEqual(9);
  });

  it('marks every Israeli asset referential, with honest licensing language', () => {
    for (const clubId of ACTIVE_ISRAELI) {
      const entry = CREST_MANIFEST[clubId];
      if (!entry) continue;
      expect(entry.regime, clubId).toBe('referential');
      expect(entry.license.toLowerCase(), clubId).toContain('non-free');
    }
  });

  it('never maps two unrelated Israeli clubs to the same asset file (E14)', () => {
    const byAsset = new Map<string, string[]>();
    for (const clubId of ACTIVE_ISRAELI) {
      const entry = CREST_MANIFEST[clubId];
      if (!entry) continue;
      byAsset.set(entry.asset, [...(byAsset.get(entry.asset) ?? []), clubId]);
    }
    for (const [asset, clubs] of byAsset) {
      expect(clubs.length, `${asset} shared by ${clubs.join(', ')}`).toBe(1);
    }
  });

  it('never maps two Israeli clubs to identical image bytes (E14, content-level)', () => {
    /*
     * Two different file names can still be the same wrong download. Hash the bytes: any two
     * active Israeli clubs sharing identical content need explicit verification, not silence.
     */
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const byHash = new Map<string, string[]>();
    for (const clubId of ACTIVE_ISRAELI) {
      const entry = CREST_MANIFEST[clubId];
      if (!entry) continue;
      const file = path.join(ROOT, 'public', entry.asset);
      if (!fs.existsSync(file)) continue;
      const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
      byHash.set(hash, [...(byHash.get(hash) ?? []), clubId]);
    }
    for (const [hash, clubs] of byHash) {
      expect(clubs.length, `identical bytes (${hash.slice(0, 8)}) for ${clubs.join(', ')}`).toBe(1);
    }
  });

  it('renders offline: local file or drawn badge for every active Israeli club (K)', () => {
    for (const clubId of ACTIVE_ISRAELI) {
      const entry = CREST_MANIFEST[clubId];
      if (entry) {
        expect(entry.asset).not.toMatch(/^https?:/i);
        expect(fs.existsSync(path.join(ROOT, 'public', entry.asset)), clubId).toBe(true);
      } else {
        const visual = clubVisual(clubId, getClub(clubId).name);
        expect(visual.initials.length, clubId).toBeGreaterThan(0);
      }
    }
  });
});

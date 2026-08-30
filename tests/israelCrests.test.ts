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
 * The documented tail (v0.6.5): active clubs for which NO provider in the cascade produced a
 * verifiable current crest. Each was attempted individually - TheSportsDB entity search
 * (sport-gated), Hebrew Wikipedia direct titles AND full-text search, Arabic Wikipedia for the
 * Arab-community clubs - and none has a crest in any of them. These are semi-professional clubs
 * whose only visual identity lives on unscrapable social pages, and inventing or guessing a
 * badge would be worse than the drawn fallback. The exact avenues tried are recorded per club
 * in israel-crest-review.json and summarised in V065_REPORT.md.
 */
export const UNRESOLVED_ACTIVE_ISRAELI_CRESTS: readonly string[] = [
  'maccabi_neve_shaanan',
  'tzeirei_tamra',
  'hapoel_arraba',
  'maccabi_nujeidat',
  'hapoel_bnei_musmus',
  'tzeirei_tira',
  'beitar_yavne',
  'mk_kfar_saba',
];

describe('v0.6.5 every active Israeli club has a real crest', () => {
  it('covers all four divisions - 62 active clubs', () => {
    expect(ACTIVE_ISRAELI.length).toBe(62);
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
    expect(UNRESOLVED_ACTIVE_ISRAELI_CRESTS.length).toBeLessThanOrEqual(8);
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

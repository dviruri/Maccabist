/**
 * Crest pipeline validation (v0.6.3, Checkpoint C).
 *
 * The contract: every club resolves to exactly one valid display path - a verified local asset
 * or the generated badge - and the production runtime never depends on a remote URL. A club may
 * lack a real crest (most do, and CLUB_ASSETS.md says why); it may never lack a crest.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREST_MANIFEST } from '../src/data/clubCrests.generated';
import { ALL_CLUBS } from '../src/data/clubs';
import { clubVisual } from '../src/data/clubVisuals';


const ROOT = path.resolve(__dirname, '..');
const KNOWN_IDS = new Set(ALL_CLUBS.map((c) => c.id));

describe('v0.6.3 the crest manifest is locally real', () => {
  it('points every entry at an existing repo-local file', () => {
    for (const [clubId, entry] of Object.entries(CREST_MANIFEST)) {
      expect(entry.asset, clubId).toMatch(/^club-crests\/[a-z0-9_]+\.(svg|png|webp|gif)$/);
      expect(entry.asset, clubId).not.toMatch(/^https?:/i);
      const file = path.join(ROOT, 'public', entry.asset);
      expect(fs.existsSync(file), `${clubId}: missing ${entry.asset}`).toBe(true);
      expect(fs.statSync(file).size, clubId).toBeGreaterThan(0);
    }
  });

  it('maps only clubs the world actually contains', () => {
    for (const clubId of Object.keys(CREST_MANIFEST)) {
      expect(KNOWN_IDS.has(clubId), `manifest maps unknown club ${clubId}`).toBe(true);
    }
  });

  it('maps no asset file to two clubs', () => {
    const assets = Object.values(CREST_MANIFEST).map((e) => e.asset);
    expect(new Set(assets).size).toBe(assets.length);
  });

  it('holds each regime to its own rules (v0.6.5)', () => {
    /*
     * Two regimes, deliberately separate and separately policed:
     *
     *  - free-media (the European pipeline): Commons files, PD/CC0 allow-list, wikimedia only.
     *  - referential (the Israeli pipeline): non-free club marks ingested at the project
     *    owner's explicit direction. The rule here is HONESTY, not licence family - the entry
     *    must say plainly that it is not claimed as free, and must come from one of the
     *    entity-verified providers.
     *
     * A referential entry claiming a PD licence, or a free-media entry from TheSportsDB, is
     * exactly the kind of quiet drift this test exists to refuse.
     */
    for (const [clubId, entry] of Object.entries(CREST_MANIFEST)) {
      if (entry.regime === 'free-media') {
        expect(entry.license, clubId).toMatch(/^(public domain|pd|cc0)/i);
        expect(entry.provider, clubId).toBe('wikimedia');
      } else {
        expect(entry.regime, clubId).toBe('referential');
        expect(['thesportsdb', 'hewiki'], clubId).toContain(entry.provider);
        expect(entry.license.toLowerCase(), clubId).not.toMatch(/^(public domain|pd|cc0)/);
      }
    }
  });

  it('has full provenance in the sibling manifest.json for every shipped asset', () => {
    const provenancePath = path.join(ROOT, 'public', 'club-crests', 'manifest.json');
    const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8')) as Record<
      string,
      { sourcePage?: string; license?: string; retrievedAt?: string; trademarkNote?: string }
    >;
    for (const [clubId, entry] of Object.entries(CREST_MANIFEST)) {
      const record = provenance[clubId] as (typeof provenance)[string] & { sourceUrl?: string };
      expect(record, `${clubId} has no provenance record`).toBeDefined();
      if (entry.regime === 'free-media') {
        expect(record!.sourcePage, clubId).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      } else {
        expect(record!.sourceUrl, clubId).toMatch(/^https:\/\//);
      }
      expect(record!.retrievedAt, clubId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record!.trademarkNote, clubId).toBeTruthy();
    }
  });
});

describe('v0.6.3 every club has exactly one valid display path', () => {
  it('resolves each club to a local asset or a drawable badge - never neither', () => {
    // v0.6.4: one club model, so ALL_CLUBS is the whole world.
    for (const { id, name } of ALL_CLUBS.map((c) => ({ id: c.id, name: c.name }))) {
      const visual = clubVisual(id, name);
      if (visual.asset) {
        // Real path: the file must exist. ClubCrest still falls back on load error at runtime.
        expect(fs.existsSync(path.join(ROOT, 'public', visual.asset)), id).toBe(true);
      } else {
        // Generated path: colours and initials are all the badge needs.
        expect(visual.primary, id).toMatch(/^#/);
        expect(visual.initials.length, id).toBeGreaterThan(0);
      }
    }
  });

  it('survives a missing asset file by construction (Scenario G)', () => {
    /*
     * The runtime component tracks image load failure in state and re-renders the generated
     * badge (ClubCrest, Phase 17). Statically: the badge inputs exist for every manifest club
     * too, so removing any asset file leaves a working crest, not a hole.
     */
    for (const clubId of Object.keys(CREST_MANIFEST)) {
      const visual = clubVisual(clubId);
      expect(visual.primary, clubId).toMatch(/^#/);
      expect(visual.initials.length, clubId).toBeGreaterThan(0);
    }
  });
});

describe('v0.6.3 the runtime is offline (Scenario I)', () => {
  it('bans remote crest URLs in components and data', () => {
    /*
     * The importer talks to the network; the game must not. Any http(s) image source in the
     * runtime source tree is a hotlink waiting to break, and `getClubCrest` already fails
     * closed on one reaching it through data.
     */
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|css)$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (/src=["']https?:\/\//.test(source) || /url\(["']?https?:\/\//.test(source)) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders, 'remote image URLs in runtime source').toEqual([]);
  });
});

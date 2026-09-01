/**
 * The player asset matrix (v0.9.6, Phase 0).
 *
 * `tests/playerAsset.test.ts` proves the RESOLVER and the pack agree: every path the resolver can
 * build exists, and every file the pack ships is reachable. Both of those hold perfectly well for
 * a pack that is half the size it should be, or one whose three age buckets are the same picture
 * copied three times - which is exactly what shipped in v0.9.4.x and was recorded as a known
 * limitation for two releases.
 *
 * So this asserts the SHAPE and the CONTENT of the pack itself:
 *
 *   - the exact directory structure, so a rename is caught rather than absorbed
 *   - the exact counts, 36 + 24 = 60, so a dropped colour is loud
 *   - that the three age buckets are genuinely different artwork
 *
 * That last one is the one with history. Until `e250aa2` the pack was 60 files and 20 unique
 * images: `child`, `youth` and `adult` were byte-identical copies of the adult render, so a
 * twelve-year-old was drawn as a grown man. Nothing in the suite could see it, because every
 * resolver test passes just as happily against duplicates. This is the guard that would have.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const PACK = path.join(ROOT, 'public/assets/maccabist/players');

const AGES = ['child', 'youth', 'adult'] as const;
const OUTFIELD_POSES = ['hero', 'celebration'] as const;
const GK_POSES = ['ready', 'celebration'] as const;
const OUTFIELD_COLOURS = ['green', 'yellow', 'red', 'blue', 'white', 'black'] as const;
const GK_COLOURS = ['blue', 'pink', 'purple', 'black'] as const;

function hashOf(file: string): string {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

describe('the pack has exactly the shape the game expects', () => {
  it('ships every outfield age, pose and colour', () => {
    const missing: string[] = [];
    for (const age of AGES) {
      for (const pose of OUTFIELD_POSES) {
        for (const colour of OUTFIELD_COLOURS) {
          const file = path.join(PACK, 'outfield', age, pose, `${colour}.png`);
          if (!fs.existsSync(file)) missing.push(path.relative(PACK, file));
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('ships every goalkeeper age, pose and colour', () => {
    const missing: string[] = [];
    for (const age of AGES) {
      for (const pose of GK_POSES) {
        for (const colour of GK_COLOURS) {
          const file = path.join(PACK, 'goalkeeper', age, pose, `${colour}.png`);
          if (!fs.existsSync(file)) missing.push(path.relative(PACK, file));
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('ships 36 outfield, 24 goalkeeper, 60 total and nothing else', () => {
    /*
     * Counted rather than merely existence-checked, so an EXTRA file is caught too - a stray
     * export, a leftover `green@2x.png`, a colour the resolver can never ask for.
     */
    const all = walk(PACK).filter((file) => file.endsWith('.png'));
    const outfield = all.filter((file) => file.includes(`${path.sep}outfield${path.sep}`));
    const goalkeeper = all.filter((file) => file.includes(`${path.sep}goalkeeper${path.sep}`));
    expect(outfield).toHaveLength(36);
    expect(goalkeeper).toHaveLength(24);
    expect(all).toHaveLength(60);
  });

  it('contains no file the matrix does not name', () => {
    const legal = new Set<string>();
    for (const age of AGES) {
      for (const pose of OUTFIELD_POSES) {
        for (const colour of OUTFIELD_COLOURS) legal.add(`outfield/${age}/${pose}/${colour}.png`);
      }
      for (const pose of GK_POSES) {
        for (const colour of GK_COLOURS) legal.add(`goalkeeper/${age}/${pose}/${colour}.png`);
      }
    }
    const actual = walk(PACK).map((file) => path.relative(PACK, file).split(path.sep).join('/'));
    expect(actual.filter((file) => !legal.has(file))).toEqual([]);
  });
});

describe('the three age buckets are genuinely different artwork', () => {
  /*
   * The regression this file exists for. Until `e250aa2` these were byte-identical copies, so a
   * child rendered as an adult - and every other asset test passed throughout.
   */
  it('draws a different picture for child, youth and adult', () => {
    const collisions: string[] = [];
    for (const [role, poses, colours] of [
      ['outfield', OUTFIELD_POSES, OUTFIELD_COLOURS],
      ['goalkeeper', GK_POSES, GK_COLOURS],
    ] as const) {
      for (const pose of poses) {
        for (const colour of colours) {
          const hashes = AGES.map((age) => hashOf(path.join(PACK, role, age, pose, `${colour}.png`)));
          if (new Set(hashes).size !== AGES.length) {
            collisions.push(`${role}/${pose}/${colour}`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('has 60 distinct images, so no two cells of the matrix share a render', () => {
    const hashes = walk(PACK)
      .filter((file) => file.endsWith('.png'))
      .map(hashOf);
    expect(new Set(hashes).size).toBe(60);
  });

  it('ships no empty or truncated file', () => {
    /* A 0-byte PNG resolves, loads, and renders nothing - the failure that looks like a layout bug. */
    for (const file of walk(PACK).filter((f) => f.endsWith('.png'))) {
      const stat = fs.statSync(file);
      expect(stat.size, `${path.relative(PACK, file)} is ${stat.size} bytes`).toBeGreaterThan(1024);
      /* And it really is a PNG, not a renamed WebP or an HTML error page saved by a download. */
      const header = fs.readFileSync(file).subarray(1, 4).toString();
      expect(header, `${path.relative(PACK, file)} is not a PNG`).toBe('PNG');
    }
  });
});

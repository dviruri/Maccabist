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

/**
 * PNG structure, read straight out of the bytes (v0.9.6, Phase 6).
 *
 * No image library is available in this toolchain, and none is needed: the two things worth
 * checking live in the first two chunks. IHDR is always first and carries the dimensions and the
 * colour type; IEND is always last, so its presence is what distinguishes a complete file from a
 * download that stopped halfway - which is exactly the corruption a size check cannot see.
 */
interface PngInfo {
  width: number;
  height: number;
  colourType: number;
  hasAlpha: boolean;
  complete: boolean;
}

function readPng(file: string): PngInfo {
  const buffer = fs.readFileSync(file);
  /* IHDR is fixed: 8-byte signature, 4-byte length, 4-byte type, then the fields. */
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colourType = buffer.readUInt8(25);
  /* 4 = greyscale+alpha, 6 = truecolour+alpha. 3 is a palette, which may carry a tRNS chunk. */
  const hasAlpha =
    colourType === 4 || colourType === 6 || buffer.includes(Buffer.from('tRNS', 'ascii'));
  /* A complete PNG ends with the IEND chunk; a truncated download does not. */
  const complete = buffer.subarray(-8).includes(Buffer.from('IEND', 'ascii'));
  return { width, height, colourType, hasAlpha, complete };
}

describe('every asset is a complete, transparent, correctly sized PNG', () => {
  const files = walk(PACK).filter((file) => file.endsWith('.png'));

  it('has non-zero dimensions and is not truncated', () => {
    const bad: string[] = [];
    for (const file of files) {
      const png = readPng(file);
      const name = path.relative(PACK, file).split(path.sep).join('/');
      if (png.width <= 0 || png.height <= 0) bad.push(`${name}: ${png.width}x${png.height}`);
      if (!png.complete) bad.push(`${name}: no IEND chunk - truncated`);
    }
    expect(bad).toEqual([]);
  });

  it('carries an alpha channel, so nobody is drawn on a baked background', () => {
    /*
     * The player is composited over a stadium. An asset that lost its transparency would render
     * as a filled rectangle over the scene - visible instantly, and exactly the kind of thing an
     * export step silently changes.
     */
    const opaque = files
      .filter((file) => !readPng(file).hasAlpha)
      .map((file) => path.relative(PACK, file).split(path.sep).join('/'));
    expect(opaque).toEqual([]);
  });

  it('has exactly one known canvas-size outlier, and no new ones', () => {
    /*
     * Measured in v0.9.6, Phase 6, and recorded rather than "fixed" - regenerating artwork is out
     * of scope for a QA release.
     *
     * 54 of the 60 files are 1024x1536. The six `outfield/youth/hero/*` files are 1086x1448,
     * left over from the pack that preceded `e250aa2` and not replaced when the new age art
     * landed. Every caller sizes by CSS width with `height: auto`, so at equal width those six
     * render about 11% shorter than the rest.
     *
     * Inspected at 390x844 with a seventeen-year-old (the `gf-play-home-teen` scene exists
     * because none did, which is why this went unnoticed): the hero frame crops through
     * `transform: scale(1.75)` and a mask with `overflow: hidden`, so the difference is absorbed
     * and nothing looks wrong. It is a file inconsistency, not a visible defect.
     *
     * Pinned exactly, so a SEVENTH odd file or a different outlier fails here.
     */
    const sizes = new Map<string, string[]>();
    for (const file of files) {
      const png = readPng(file);
      const key = `${png.width}x${png.height}`;
      sizes.set(key, [...(sizes.get(key) ?? []), path.relative(PACK, file).split(path.sep).join('/')]);
    }

    expect([...sizes.keys()].sort()).toEqual(['1024x1536', '1086x1448']);
    expect(sizes.get('1024x1536')).toHaveLength(54);
    expect(sizes.get('1086x1448')!.sort()).toEqual(
      OUTFIELD_COLOURS.map((colour) => `outfield/youth/hero/${colour}.png`).sort(),
    );
  });
});

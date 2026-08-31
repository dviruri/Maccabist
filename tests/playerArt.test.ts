/**
 * The player-art resolver (v0.9): the pack's rules, enforced.
 *
 * Age decides the body, position decides the kind, context decides the pose - and the two
 * hard rules the brief singles out: a child never renders as an adult, and a goalkeeper never
 * falls back to outfield art.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCareerPlayerArt } from '../src/ui/playerArt';

const ROOT = path.resolve(__dirname, '..');

describe('age bands', () => {
  it('maps 14 and under to youth, 15-18 to teen, 19+ to adult - by actual age', () => {
    expect(getCareerPlayerArt({ age: 9, position: 'ST' })).toContain('/youth/');
    expect(getCareerPlayerArt({ age: 14, position: 'CM' })).toContain('/youth/');
    expect(getCareerPlayerArt({ age: 15, position: 'CM' })).toContain('/teen/');
    expect(getCareerPlayerArt({ age: 18, position: 'WG' })).toContain('/teen/');
    expect(getCareerPlayerArt({ age: 19, position: 'ST' })).toContain('/adult/');
    expect(getCareerPlayerArt({ age: 35, position: 'CB' })).toContain('/adult/');
  });

  it('a 17-year-old in senior football is still seventeen', () => {
    // The resolver takes age, not team level - there is no way to pass a level, by design.
    expect(getCareerPlayerArt({ age: 17, position: 'ST' })).toContain('/teen/');
  });
});

describe('position kinds', () => {
  it('keepers get goalkeeper art at every age', () => {
    for (const age of [10, 16, 25]) {
      expect(getCareerPlayerArt({ age, position: 'GK' })).toContain('goalkeeper');
    }
  });

  it('a goalkeeper NEVER falls back to outfield art, whatever the context', () => {
    for (const age of [10, 16, 25]) {
      for (const context of ['hero', 'celebration', 'save', 'ready'] as const) {
        const art = getCareerPlayerArt({ age, position: 'GK', context });
        expect(art, `age ${age} context ${context}`).toContain('goalkeeper');
        expect(art).not.toContain('outfield');
      }
    }
  });

  it('outfield positions share outfield art', () => {
    for (const position of ['CB', 'FB', 'CM', 'WG', 'ST'] as const) {
      expect(getCareerPlayerArt({ age: 24, position })).toContain('outfield');
    }
  });
});

describe('context fallbacks', () => {
  it('an unavailable context falls back to the correct age+position hero', () => {
    // teen has no 'save'; must resolve to the teen GK file, not adult, not outfield.
    const art = getCareerPlayerArt({ age: 16, position: 'GK', context: 'save' });
    expect(art).toContain('/teen/');
    expect(art).toContain('goalkeeper');
  });

  it('resolves only to files that exist in the pack', () => {
    for (const age of [10, 16, 25]) {
      for (const position of ['GK', 'ST'] as const) {
        for (const context of ['hero', 'celebration', 'save', 'ready'] as const) {
          const art = getCareerPlayerArt({ age, position, context });
          const local = art.replace(/^\//, '').replace(/^.*?assets\//, 'public/assets/');
          expect(fs.existsSync(path.join(ROOT, local)), art).toBe(true);
        }
      }
    }
  });
});

describe('the v0.9 palette rules hold (v0.9.1 regression)', () => {
  it('the game-feel stylesheet uses no red for prestige', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    // The one allowed warm colour is the destructive-action text, which is not prestige UI.
    const allowed = new Set(['#e58f8f']);
    for (const match of css.matchAll(/#([0-9a-fA-F]{6})/g)) {
      if (allowed.has(match[0]!.toLowerCase())) continue;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16)) as [number, number, number];
      expect(r > g * 1.4 && r > b * 1.4, `red-dominant colour ${match[0]} in gamefeel.css`).toBe(false);
    }
  });

  it('resolves character art only from the neutral pack folders', () => {
    // The pack's character palette is black/pink/purple/blue by construction; the guarantee the
    // code can make is that it never reaches outside those folders for a player render.
    for (const age of [10, 16, 25]) {
      for (const position of ['GK', 'ST'] as const) {
        const art = getCareerPlayerArt({ age, position });
        expect(art).toContain('/assets/gamefeel/players/');
        expect(art).toMatch(/\/(youth|teen|adult)\//);
      }
    }
  });
});

describe('no concept sample content leaks into production code', () => {
  it('keeps the reference-image sample strings out of src/', () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      );
    const sources = walk(path.join(ROOT, 'src')).filter((f) => /\.(ts|tsx|css)$/.test(f));
    // Sample content visible in the concept images that must never be shipped as data.
    const banned = ['אייאקס רוצה אותך', '6,420 / 9,000', 'דירוג כללי'];
    for (const file of sources) {
      const text = fs.readFileSync(file, 'utf8');
      for (const phrase of banned) {
        expect(text.includes(phrase), `${file} contains "${phrase}"`).toBe(false);
      }
    }
  });
});

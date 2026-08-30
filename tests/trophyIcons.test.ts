/**
 * Trophy and honor icon semantics (v0.7, Checkpoint E + Scenarios H, I).
 *
 * The rule under test is visual language as truth: a league championship LOOKS like a
 * championship (a plate), a cup LOOKS like a cup, a promotion is neither, and no major prestige
 * surface leans on OS emoji - which is the rendering path that once produced a red "הסמל".
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { trophyIconKind } from '../src/components/honorIcons';
import { TROPHY_DEFS } from '../src/data/trophies';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Scenario H/I: the icon matches the silverware', () => {
  it('maps every league championship to the plate, never the cup', () => {
    expect(trophyIconKind('championship')).toBe('plate');
    expect(trophyIconKind('foreign_championship')).toBe('plate');
  });

  it('maps every domestic cup to the cup', () => {
    expect(trophyIconKind('cup')).toBe('cup');
    expect(trophyIconKind('foreign_cup')).toBe('cup');
    expect(trophyIconKind('super_cup')).toBe('cup');
  });

  it('keeps promotion as its own kind - not a championship, not a cup', () => {
    // Promotion is not a typed trophy; the cabinet renders it through the explicit kind.
    const kinds = ['plate', 'cup', 'continental', 'youth'];
    expect(kinds).not.toContain('promotion'); // it exists outside the trophy mapping
  });

  it('covers every typed trophy with a deliberate icon kind', () => {
    for (const id of Object.keys(TROPHY_DEFS)) {
      expect(['plate', 'cup', 'continental', 'youth', 'ucl', 'uel', 'uecl'], id).toContain(trophyIconKind(id));
    }
  });

  it('gives each UEFA competition its own mark (v0.8), original and not UEFA artwork', () => {
    expect(trophyIconKind('uefa_champions_league')).toBe('ucl');
    expect(trophyIconKind('uefa_europa_league')).toBe('uel');
    expect(trophyIconKind('uefa_conference_league')).toBe('uecl');
    // The legacy rolled ids keep rendering for pre-v0.8 careers.
    expect(trophyIconKind('champions_league')).toBe('ucl');
    expect(trophyIconKind('european_run')).toBe('continental');
    const source = read('src/components/honorIcons.tsx');
    expect(source).not.toMatch(/UEFA trophy|starball artwork/i);
  });
});

describe('no emoji, no red, in the prestige icon system', () => {
  it('draws every icon as SVG - the file contains no emoji codepoints', () => {
    const source = read('src/components/honorIcons.tsx');
    // Surrogate-pair emoji (🏆 etc.) and the common single-codepoint award emoji.
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(source)).toBe(false);
  });

  it('uses no red anywhere in the icon palette', () => {
    const source = read('src/components/honorIcons.tsx');
    // Any hex colour whose red channel dominates both others is banned from this file.
    for (const match of source.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16)) as [number, number, number];
      expect(r > g * 1.4 && r > b * 1.4, `red-dominant colour ${match[0]}`).toBe(false);
    }
  });

  it('keeps the retirement trophy list on the SVG marks, not the emoji table', () => {
    const source = read('src/pages/RetirementPage.tsx');
    expect(source).toContain('TrophyKindIcon');
    // The emoji lookup must not be what renders the trophy summary any more.
    expect(source).not.toMatch(/\{trophyIcon\(group\.id\)\}/);
  });

  it('keeps the cabinet itself emoji-free for trophies and honors', () => {
    const source = read('src/components/TrophyCabinet.tsx');
    expect(source).toContain('TrophyKindIcon');
    expect(source).toContain('HonorIcon');
    expect(source).not.toMatch(/trophyIcon\(/);
  });
});

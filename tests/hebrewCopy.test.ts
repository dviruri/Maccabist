/**
 * Hebrew copy guards (v0.9.6.2).
 *
 * Deliberately NOT a grammar engine. These are a small curated set of mistakes that were actually
 * found in the shipped game during the v0.9.6.2 copy audit, written so that each one cannot come
 * back silently. A guard that flags unusual-but-valid Hebrew would be worse than no guard: it
 * would train the next person to add exceptions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ID, getClub } from '../src/data/clubs';
import { UEFA_COMPETITIONS, inCompetition } from '../src/data/uefa';
import { countLabel, contractedPrefix, hebrewPrefix } from '../src/game/hebrew';
import { withHebrewPrefix } from '../src/game/identity';

const ROOT = path.resolve(__dirname, '..');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/[.](ts|tsx)$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  return out;
}

const FILES = sourceFiles();

/**
 * Tokens with no legitimate player-facing use, each one found in the shipped game.
 *
 * Kept short on purpose. `חריצה` is not a football word at all - the event meant a late
 * challenge and said something closer to "notching".
 */
const FORBIDDEN: { token: string; why: string }[] = [
  { token: 'חריצה', why: 'not a football word; a late challenge is "כניסה מאוחרת"' },
  { token: 'בהקונפרנס', why: 'ב contracts the definite article: בקונפרנס ליג' },
  { token: 'בהליגה האירופית', why: 'ב contracts the definite article: בליגה האירופית' },
  { token: 'להגמר', why: 'ל contracts the definite article: לגמר' },
  { token: 'בהגמר', why: 'ב contracts the definite article: בגמר' },
];

describe('tokens that are never right', () => {
  it('do not appear anywhere in the source', () => {
    const hits: string[] = [];
    for (const file of FILES) {
      /*
       * Comments are stripped first. They are not player-facing, and notes explaining these very
       * rules necessarily quote the wrong forms - this test flagged its own helper's
       * documentation on the first run.
       */
      fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
        .replace(/\/\/.*$/gm, '')
        .split('\n')
        .forEach((line, i) => {
          for (const { token, why } of FORBIDDEN) {
            if (line.includes(token)) {
              hits.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${i + 1} "${token}" - ${why}`);
            }
          }
        });
    }
    expect(hits).toEqual([]);
  });

  it('would actually catch one', () => {
    /* Non-vacuity: the scan must be looking at real Hebrew-bearing files. */
    const hebrew = FILES.filter((file) => /[֐-׿]/.test(fs.readFileSync(file, 'utf8')));
    expect(hebrew.length).toBeGreaterThan(80);
  });
});

describe('a count agrees with its noun', () => {
  it('never says "1 שערים"', () => {
    expect(countLabel(1, 'שער אחד', 'שערים')).toBe('שער אחד');
    expect(countLabel(0, 'שער אחד', 'שערים')).toBe('0 שערים');
    expect(countLabel(4, 'שער אחד', 'שערים')).toBe('4 שערים');
  });

  it('carries an adjective into the singular, so it agrees too', () => {
    /*
     * Fixing the noun exposed the adjective: `${countLabel(n,'הופעה אחת','הופעות')} רשמיות` reads
     * "הופעה אחת רשמיות" at one - right in number, wrong in agreement. The adjective belongs
     * inside both forms.
     */
    expect(countLabel(1, 'הופעה אחת רשמית', 'הופעות רשמיות')).toBe('הופעה אחת רשמית');
    expect(countLabel(9, 'הופעה אחת רשמית', 'הופעות רשמיות')).toBe('9 הופעות רשמיות');
  });

  it('hyphenates a prefix before a numeral and not before a word', () => {
    /* "ו-3 אליפויות" but "ואליפות אחת" - the case countLabel exists for is the one that loses it. */
    expect(hebrewPrefix('ו', '3 אליפויות')).toBe('ו-3 אליפויות');
    expect(hebrewPrefix('ו', 'אליפות אחת')).toBe('ואליפות אחת');
    expect(hebrewPrefix('ל', 'עונה אחת')).toBe('לעונה אחת');
  });
});

describe('an inseparable prefix knows what follows it', () => {
  it('contracts the definite article on a common noun', () => {
    expect(contractedPrefix('ל', 'הגמר')).toBe('לגמר');
    expect(contractedPrefix('ל', 'חצי הגמר')).toBe('לחצי הגמר');
    expect(inCompetition('הקונפרנס ליג')).toBe('בקונפרנס ליג');
    expect(inCompetition('הליגה האירופית')).toBe('בליגה האירופית');
    expect(inCompetition('ליגת האלופות')).toBe('בליגת האלופות');
  });

  it('keeps the ה of a club name, which is part of the name', () => {
    /*
     * The v0.9.6.2 fix. `withHebrewPrefix` applied the article rule to club names, so the
     * matchday timeline wrote a line for every goal reading "שער לפועל באר שבע", and
     * transliterations lost their first letter outright.
     */
    expect(withHebrewPrefix('ל', 'הפועל באר שבע')).toBe('להפועל באר שבע');
    expect(withHebrewPrefix('ב', 'הפועל תל אביב')).toBe('בהפועל תל אביב');
    expect(withHebrewPrefix('ל', 'המבורג')).toBe('להמבורג');
    expect(withHebrewPrefix('ל', 'הופנהיים')).toBe('להופנהיים');
    expect(withHebrewPrefix('ל', 'מכבי חיפה')).toBe('למכבי חיפה');
  });

  it('mangles no club in the database', () => {
    /*
     * Swept over every club rather than the handful above: 37 names begin with ה, and the ones
     * that broke worst were transliterations where the ה is simply the first letter.
     */
    const ids = [MACCABI_ID];
    const names = new Set<string>();
    for (const file of ['src/data/clubs.ts', 'src/data/worldClubs.ts', 'src/data/youthClubs.ts']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const match of source.matchAll(/name:\s*'([^']+)'/g)) {
        if (/[֐-׿]/.test(match[1]!)) names.add(match[1]!);
      }
    }
    expect(names.size).toBeGreaterThan(200);
    const startingWithHeh = [...names].filter((name) => name.startsWith('ה'));
    expect(startingWithHeh.length, 'no club begins with ה - the sweep proves nothing').toBeGreaterThan(20);
    for (const name of names) {
      for (const prefix of ['ל', 'ב', 'מ']) {
        expect(withHebrewPrefix(prefix, name)).toBe(`${prefix}${name}`);
      }
    }
    expect(getClub(ids[0]!).name).toBe('מכבי חיפה');
  });
});

describe('every competition name survives a preposition', () => {
  it('reads correctly for all three', () => {
    for (const competition of Object.values(UEFA_COMPETITIONS)) {
      const withBet = inCompetition(competition.name);
      expect(withBet.startsWith('ב')).toBe(true);
      /* The one thing that must never happen: a stranded article right after the prefix. */
      expect(withBet.startsWith('בה')).toBe(false);
    }
  });
});

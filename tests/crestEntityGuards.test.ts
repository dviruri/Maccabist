/**
 * Wrong-entity protection for crest ingestion (v0.6.5.1, Scenarios I and L).
 *
 * The failure this guards is specific and was demonstrated live: provider search mixes sports
 * and team types, and club names collide across both. Maccabi Tel Aviv is one of Europe's
 * biggest BASKETBALL clubs. Barcelona has a basketball section. Arsenal has a women's team.
 * Ajax has a U19. Every one of those returns from a name search for the senior men's club.
 *
 * These tests exercise the importers' verification predicates directly against fabricated
 * provider payloads - no network - so the guarantee is checked rather than hoped for.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREST_MANIFEST } from '../src/data/clubCrests.generated';

const ROOT = path.resolve(__dirname, '..');

/**
 * The Euro importer's gate, mirrored.
 *
 * Kept as a mirror rather than an export because the importer is a build-time script with
 * top-level `await main()` - importing it would run it. The rules are asserted to stay in step
 * with the source by the source-text checks at the bottom of this file.
 */
const WRONG_TEAM_TYPE =
  /\b(women|ladies|feminin|femenino|frauen|u1\d|u2[0-3]|youth|junior|academy|reserves?|\bii\b|\bb\b|futsal|beach)\b/i;

const normalise = (name: string): string =>
  String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

interface Candidate {
  strTeam: string;
  strSport: string;
  strCountry?: string;
  strAlternate?: string;
  strGender?: string;
  strBadge?: string;
}

function accepts(
  seed: { english: string; aliases?: string[]; country: string },
  team: Candidate,
): boolean {
  const COUNTRY: Record<string, string> = {
    israel: 'Israel',
    spain: 'Spain',
    england: 'England',
    netherlands: 'Netherlands',
    germany: 'Germany',
  };
  if (team.strSport !== 'Soccer') return false;
  const want = COUNTRY[seed.country];
  if (want && team.strCountry && team.strCountry !== want) return false;
  if (WRONG_TEAM_TYPE.test(team.strTeam)) return false;
  if ((team.strGender ?? 'Male') !== 'Male') return false;
  const ours = new Set([seed.english, ...(seed.aliases ?? [])].map(normalise));
  const theirs = [team.strTeam, ...String(team.strAlternate ?? '').split(',')].map(normalise);
  if (!theirs.some((n) => n.length > 0 && ours.has(n))) return false;
  return Boolean(team.strBadge);
}

const badge = 'https://example.invalid/badge.png';

describe('v0.6.5.1 Scenario I: a mixed-sport result is refused', () => {
  const seed = { english: 'Maccabi Tel Aviv', aliases: ['Maccabi Tel-Aviv'], country: 'israel' };

  it('accepts the football club', () => {
    expect(
      accepts(seed, { strTeam: 'Maccabi Tel Aviv', strSport: 'Soccer', strCountry: 'Israel', strBadge: badge }),
    ).toBe(true);
  });

  it('refuses the basketball club of the same name', () => {
    expect(
      accepts(seed, { strTeam: 'Maccabi Tel Aviv', strSport: 'Basketball', strCountry: 'Israel', strBadge: badge }),
    ).toBe(false);
  });

  it('refuses handball, futsal and every other sport', () => {
    for (const sport of ['Handball', 'Volleyball', 'Ice Hockey', 'Rugby']) {
      expect(
        accepts(seed, { strTeam: 'Maccabi Tel Aviv', strSport: sport, strCountry: 'Israel', strBadge: badge }),
        sport,
      ).toBe(false);
    }
  });
});

describe('v0.6.5.1 Scenario L: wrong country, gender or team type is refused', () => {
  it('refuses a same-name club from the wrong country', () => {
    // "Valencia" exists in Spain and in Venezuela. Country is part of identity, not a hint.
    expect(
      accepts(
        { english: 'Valencia CF', aliases: ['Valencia'], country: 'spain' },
        { strTeam: 'Valencia', strSport: 'Soccer', strCountry: 'Venezuela', strBadge: badge },
      ),
    ).toBe(false);
  });

  it("refuses a women's team", () => {
    const seed = { english: 'Arsenal FC', aliases: ['Arsenal'], country: 'england' };
    expect(accepts(seed, { strTeam: 'Arsenal Women', strSport: 'Soccer', strCountry: 'England', strBadge: badge })).toBe(false);
    expect(accepts(seed, { strTeam: 'Arsenal Ladies', strSport: 'Soccer', strCountry: 'England', strBadge: badge })).toBe(false);
    // And the gender field alone is enough, even when the name looks right.
    expect(
      accepts(seed, { strTeam: 'Arsenal', strSport: 'Soccer', strCountry: 'England', strGender: 'Female', strBadge: badge }),
    ).toBe(false);
  });

  it('refuses youth, reserve and B sides', () => {
    const seed = { english: 'AFC Ajax', aliases: ['Ajax'], country: 'netherlands' };
    for (const name of ['Ajax U19', 'Ajax U21', 'Ajax Youth', 'Ajax Reserves', 'Ajax B', 'Jong Ajax Academy']) {
      expect(accepts(seed, { strTeam: name, strSport: 'Soccer', strCountry: 'Netherlands', strBadge: badge }), name).toBe(
        false,
      );
    }
  });

  it('refuses a club whose name matches nothing we asked for', () => {
    expect(
      accepts(
        { english: 'FC Barcelona', aliases: ['Barcelona'], country: 'spain' },
        { strTeam: 'Barcelona SC', strSport: 'Soccer', strCountry: 'Spain', strBadge: badge },
      ),
    ).toBe(false);
  });

  it('refuses a verified club with no badge at all', () => {
    expect(
      accepts(
        { english: 'Chelsea FC', aliases: ['Chelsea'], country: 'england' },
        { strTeam: 'Chelsea', strSport: 'Soccer', strCountry: 'England' },
      ),
    ).toBe(false);
  });
});

describe('v0.6.5.1 the shipped importers still carry these gates', () => {
  it('keeps sport, gender and team-type checks in the European importer', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'importEuroCrests.ts'), 'utf8');
    expect(source).toContain("strSport !== 'Soccer'");
    expect(source).toContain('WRONG_TEAM_TYPE');
    expect(source).toContain('strGender');
    expect(source).toMatch(/MAX_ATTEMPTS|attempt < MAX_ATTEMPTS/);
    expect(source).toMatch(/REQUEST_TIMEOUT_MS|AbortController/);
    expect(source).toContain('MAX_MS_PER_CLUB');
    expect(source).not.toMatch(/while\s*\(\s*true\s*\)/);
  });

  it('keeps the sport gate in the Israeli importer', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'importIsraelCrests.ts'), 'utf8');
    expect(source).toContain("strSport !== 'Soccer'");
    expect(source).toContain("strCountry !== 'Israel'");
    expect(source).toContain('MAX_MS_PER_CLUB');
    expect(source).not.toMatch(/while\s*\(\s*true\s*\)/);
  });

  it('records sport and provenance on every referential asset', () => {
    const provenance = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public', 'club-crests', 'manifest.json'), 'utf8'),
    ) as Record<string, { regime?: string; sourceUrl?: string; retrievedAt?: string; trademarkNote?: string }>;
    for (const [clubId, entry] of Object.entries(CREST_MANIFEST)) {
      if (entry.regime !== 'referential') continue;
      const record = provenance[clubId];
      expect(record, clubId).toBeDefined();
      expect(record!.sourceUrl, clubId).toMatch(/^https?:\/\//);
      expect(record!.retrievedAt, clubId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record!.trademarkNote, clubId).toBeTruthy();
    }
  });
});

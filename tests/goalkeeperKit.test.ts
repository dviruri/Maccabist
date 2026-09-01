/**
 * A goalkeeper keeps one shirt at a club (v0.9.5.1).
 *
 * ## The bug
 *
 * v0.9.4 hashed `(seed, clubId, season, 'gk-kit')`. The season was in the identity, so a keeper
 * who spent a decade at one club wore a different colour every year - purple in 2032, blue in
 * 2033. That is not a kit, it is a costume change, and it was visible on every screen that showed
 * him: home, matchday, decisions, moments.
 *
 * Season is gone from the hash. `(seed, clubId)` is the whole identity.
 *
 * ## The rule that replaced the old one
 *
 * v0.9.4 also ranked all four colours by luminance and hue distance and shortlisted the top two,
 * which meant arithmetic decided the palette and only two of the four colours could ever appear at
 * a given club. There is now exactly one restriction:
 *
 *   **a keeper may not wear his club's own basic outfield colour.**
 *
 * Blue club, never blue. Black club, never black. Green, yellow, red and white clubs share no
 * colour with the keeper palette, so all four are legal there.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { clubOutfieldColour } from '../src/ui/colourFamily';
import { GOALKEEPER_COLOURS, resolveGoalkeeperKit, resolvePlayerKit } from '../src/ui/kit';
import { resolveCharacterAsset, resolveOutfieldColourFamily } from '../src/lib/assetSelector';
import type { PlayerArtContext } from '../src/lib/assetSelector';

/** One club per outfield family, so every branch of the exclusion is exercised. */
const CLUBS = {
  green: MACCABI_ID,
  yellow: 'maccabi_tel_aviv',
  red: 'hapoel_haifa',
  blue: 'ironi_kiryat_shmona',
  white: 'tottenham',
  black: 'sturm_graz',
} as const;

const SEASONS = [2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041, 2044];

describe('the shirt does not change while he stays', () => {
  it('is the same colour across a dozen seasons at one club', () => {
    /* The bug, inverted. This is the assertion v0.9.4 would have failed. */
    for (const clubId of Object.values(CLUBS)) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const colours = new Set(
          SEASONS.map((season) => resolveGoalkeeperKit({ seed, clubId, season }).goalkeeperColour),
        );
        expect(colours.size, `seed ${seed} at ${clubId} wore ${[...colours].join('/')}`).toBe(1);
      }
    }
  });

  it('ignores the season argument entirely, including when it is absent', () => {
    /*
     * `season` survives in the signature for call-site compatibility. It must be inert - passing
     * it, passing a different one, and omitting it all have to agree.
     */
    for (let seed = 1; seed <= 30; seed += 1) {
      const withSeason = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2031 });
      const otherSeason = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2099 });
      const noSeason = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID });
      expect(otherSeason).toEqual(withSeason);
      expect(noSeason).toEqual(withSeason);
    }
  });

  it('is the same on every pose the screens can ask for', () => {
    /*
     * Career Home asks for `hero`, matchday for `save`, a moment for `celebration`, a keeper's
     * home for `ready`. The pose changes the drawing; it must not change the shirt.
     */
    const contexts: PlayerArtContext[] = ['hero', 'ready', 'save', 'celebration'];
    for (const clubId of Object.values(CLUBS)) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const colours = new Set(
          contexts.map(
            (context) =>
              resolveCharacterAsset({ age: 24, position: 'GK', clubId, seed, season: 2044, context })
                .colour,
          ),
        );
        expect(colours.size, `${clubId} seed ${seed}`).toBe(1);
      }
    }
  });

  it('is the same across every screen\'s resolver inputs, seasons and ages included', () => {
    /*
     * The screens differ in the season and the age they happen to pass - a decision screen shows
     * the current season, a career moment an older one, a retirement scene a retirement age. None
     * of that may reach the colour.
     */
    for (let seed = 1; seed <= 25; seed += 1) {
      const colours = new Set(
        [
          { age: 19, season: 2031 },
          { age: 24, season: 2036 },
          { age: 31, season: 2043 },
          { age: 35, season: 2047 },
        ].map(
          (input) =>
            resolveCharacterAsset({ ...input, position: 'GK', clubId: MACCABI_ID, seed }).colour,
        ),
      );
      expect(colours.size, `seed ${seed}`).toBe(1);
    }
  });
});

describe('the one colour restriction', () => {
  it('never issues the club\'s own basic outfield colour', () => {
    for (const clubId of Object.values(CLUBS)) {
      const outfield = clubOutfieldColour(clubId);
      for (let seed = 0; seed < 300; seed += 1) {
        const gk = resolveGoalkeeperKit({ seed, clubId }).goalkeeperColour!;
        expect(gk, `${clubId} (${outfield}) issued ${gk}`).not.toBe(outfield);
      }
    }
  });

  it('always resolves to one of exactly four legal colours', () => {
    for (const clubId of Object.values(CLUBS)) {
      for (let seed = 0; seed < 200; seed += 1) {
        expect(GOALKEEPER_COLOURS).toContain(resolveGoalkeeperKit({ seed, clubId }).goalkeeperColour);
      }
    }
  });

  it('restricts nothing at a club whose colour is not in the keeper palette', () => {
    /*
     * The brief's explicit list: green, yellow, red and white clubs may produce ANY of the four.
     * If a future change quietly narrowed this again, these sets would shrink below four.
     */
    for (const clubId of [CLUBS.green, CLUBS.yellow, CLUBS.red, CLUBS.white]) {
      const seen = new Set(
        Array.from({ length: 400 }, (_, seed) => resolveGoalkeeperKit({ seed, clubId }).goalkeeperColour),
      );
      expect(seen.size, `${clubId} only reached ${[...seen].join('/')}`).toBe(4);
    }
  });

  it('leaves exactly three at a blue club and three at a black one', () => {
    for (const [clubId, banned] of [
      [CLUBS.blue, 'blue'],
      [CLUBS.black, 'black'],
    ] as const) {
      const seen = new Set(
        Array.from({ length: 400 }, (_, seed) => resolveGoalkeeperKit({ seed, clubId }).goalkeeperColour),
      );
      expect(seen.has(banned)).toBe(false);
      expect(seen.size).toBe(3);
    }
  });

  it('asks the same question the outfield art asks', () => {
    /*
     * The exclusion and the drawn shirt must consult ONE source. If these ever disagreed, a blue
     * club could be issued a blue keeper while its outfield art was also blue - the exact clash
     * the rule exists to prevent.
     */
    for (const clubId of Object.values(CLUBS)) {
      expect(clubOutfieldColour(clubId)).toBe(resolveOutfieldColourFamily(clubId));
    }
  });
});

describe('moving club, and coming back', () => {
  it('may produce a different colour at a different club', () => {
    /* Identity is per club, so a transfer is allowed to change the shirt. */
    let changed = 0;
    for (let seed = 0; seed < 60; seed += 1) {
      const here = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID }).goalkeeperColour;
      const there = resolveGoalkeeperKit({ seed, clubId: 'ajax' }).goalkeeperColour;
      if (here !== there) changed += 1;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('restores the original colour on returning to the original club', () => {
    /*
     * The reason this needs no persisted field and no save-schema change: the resolver is a pure
     * function of (seed, club), so coming home recomputes the shirt he left in.
     */
    for (let seed = 0; seed < 80; seed += 1) {
      const before = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2033 });
      resolveGoalkeeperKit({ seed, clubId: 'ajax', season: 2038 });
      const after = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2045 });
      expect(after).toEqual(before);
    }
  });
});

describe('purity', () => {
  it('consumes no randomness at all', () => {
    /*
     * Checked as source rather than by observation: a keeper colour that drew from a stream would
     * shift every downstream roll in the career and break the same-seed regression.
     */
    const source = require('node:fs')
      .readFileSync(require('node:path').resolve(__dirname, '../src/ui/kit.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const banned of ['Math.random', 'createRng', 'rng.', 'Rng']) {
      expect(source.includes(banned), `ui/kit.ts references ${banned}`).toBe(false);
    }
  });

  it('returns an identical object on repeated calls', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const a = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID });
      const b = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID });
      expect(b).toEqual(a);
    }
  });

  it('is what the position resolver returns, and only for a keeper', () => {
    const gk = resolvePlayerKit({ position: 'GK', clubId: MACCABI_ID, seed: 5, season: 2044 });
    const later = resolvePlayerKit({ position: 'GK', clubId: MACCABI_ID, seed: 5, season: 2051 });
    expect(later).toEqual(gk);
    expect(gk.kind).toBe('goalkeeper');
  });
});

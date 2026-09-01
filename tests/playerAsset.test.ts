/**
 * The pre-rendered character pack (v0.9.4.x).
 *
 * ## What changed, and why these are not weakened tests
 *
 * Up to v0.9.4 the in-game character was one neutral drawing per pose plus a live CSS recolour:
 * a garment mask cut out the shirt, three blend layers painted the club's colour onto it, and
 * `tests/clubKit.test.ts` asserted that PlayerRender contained exactly those layers.
 *
 * The art pack now ships finished shirts - six outfield colours, four goalkeeper ones, per age
 * and pose - so there is nothing to recolour and those assertions describe a system that is gone.
 * They are not deleted, they are INVERTED: PlayerRender must now contain none of it, which is
 * asserted below. The canvas share poster still composites and `clubKit.test.ts` still guards it.
 *
 * The product rules underneath are unchanged and are all re-asserted here against the new pack:
 * age is the player's actual age, the outfield shirt is the club's identity resolved through
 * `clubVisual` rather than a name table, a youth side inherits its parent, and a goalkeeper wears
 * one of exactly four colours chosen stably from (seed, club, season).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ACADEMY_ID, MACCABI_ID } from '../src/data/clubs';
import { CLUB_VISUALS, clubVisual } from '../src/data/clubVisuals';
import {
  resolveAgeGroup,
  resolveCharacterAsset,
  resolveOutfieldColourFamily,
  type OutfieldAssetColour,
} from '../src/lib/assetSelector';
import { GOALKEEPER_COLOURS } from '../src/ui/kit';
import type { Position } from '../src/types';

const ROOT = path.resolve(__dirname, '..');

/** One club per colour family the world actually contains. */
const REPRESENTATIVE = {
  green: MACCABI_ID,
  yellow: 'maccabi_tel_aviv',
  red: 'hapoel_haifa',
  blue: 'ironi_kiryat_shmona',
  white: 'tottenham',
  black: 'sturm_graz',
} as const;

const OUTFIELD: Position[] = ['ST', 'CM', 'CB', 'FB', 'WG'];
const CONTEXTS = ['hero', 'celebration', 'save', 'ready'] as const;

/** Where a resolved URL lives on disk, whatever BASE_URL happened to be. */
function onDisk(src: string): string {
  return path.join(ROOT, 'public', src.slice(src.indexOf('/assets/')));
}

describe('the age bucket is the player\'s own age', () => {
  it('maps the game\'s existing boundaries onto the pack\'s directory names', () => {
    /*
     * The boundaries are unchanged - only the labels are. The old pack called `<= 14` "youth";
     * this one calls it "child" and uses "youth" for 15-18, which is exactly the kind of rename
     * that silently shifts a band if nobody pins it. So the band edges are pinned.
     */
    expect(resolveAgeGroup(12)).toBe('child');
    expect(resolveAgeGroup(14)).toBe('child');
    expect(resolveAgeGroup(15)).toBe('youth');
    expect(resolveAgeGroup(17)).toBe('youth');
    expect(resolveAgeGroup(18)).toBe('youth');
    expect(resolveAgeGroup(19)).toBe('adult');
    expect(resolveAgeGroup(34)).toBe('adult');
  });

  it('picks the path from the age, for both roles', () => {
    for (const [age, bucket] of [[12, 'child'], [17, 'youth'], [19, 'adult']] as const) {
      for (const position of ['ST', 'GK'] as Position[]) {
        const art = resolveCharacterAsset({
          age,
          position,
          clubId: MACCABI_ID,
          seed: 42,
          season: 2044,
        });
        expect(art.age, `age ${age}`).toBe(bucket);
        expect(art.src, `age ${age}`).toContain(`/${bucket}/`);
      }
    }
  });

  it('uses his age and never his squad - a 17-year-old in senior football is still seventeen', () => {
    /*
     * The rule the old resolver had and this one must keep. Nothing about the club, the division
     * or the senior/academy split reaches the age bucket: the only input is the number.
     */
    const senior = resolveCharacterAsset({
      age: 17,
      position: 'ST',
      clubId: MACCABI_ID,
      seed: 1,
      season: 2044,
    });
    const academy = resolveCharacterAsset({
      age: 17,
      position: 'ST',
      clubId: MACCABI_ACADEMY_ID,
      seed: 1,
      season: 2044,
    });
    expect(senior.age).toBe('youth');
    expect(academy.age).toBe('youth');

    /* And a 19-year-old is an adult wherever he is playing. */
    expect(
      resolveCharacterAsset({ age: 19, position: 'ST', clubId: MACCABI_ACADEMY_ID, seed: 1, season: 2044 }).age,
    ).toBe('adult');
  });
});

describe('the outfield shirt is the club, resolved from its colour', () => {
  it('puts every representative club in its own family', () => {
    for (const [family, clubId] of Object.entries(REPRESENTATIVE)) {
      expect(resolveOutfieldColourFamily(clubId), `${clubId} (${clubVisual(clubId).primary})`).toBe(
        family,
      );
    }
  });

  it('resolves a colour the pack does not ship to the nearest family it does', () => {
    /*
     * The world has more colours than the pack has families, and the mapping has to be defensible
     * rather than merely deterministic. These are the awkward ones:
     *
     *   violet  Hapoel Hadera's #7b2d8e. Plain RGB distance calls this RED, which is not what
     *           anyone sees - it is the case the perceptual weighting in `distance` exists for.
     *   orange  Nof HaGalil's #e07b28, which reads as amber on a shirt.
     *   maroon  a dark red that must not fall through the black gate.
     */
    expect(resolveOutfieldColourFamily('hapoel_hadera')).toBe('blue');
    expect(resolveOutfieldColourFamily('hapoel_nof_hagalil')).toBe('yellow');
    expect(resolveOutfieldColourFamily('paok')).toBe('black');
  });

  it('sends near-white and near-black to white and black before any hue is considered', () => {
    /* The two luminance gates. A faint hue in a near-black club must not drag it to a colour. */
    expect(resolveOutfieldColourFamily('sturm_graz')).toBe('black'); /* #000000 */
    expect(resolveOutfieldColourFamily('paok')).toBe('black'); /* #1b1b1b */
    expect(resolveOutfieldColourFamily('tottenham')).toBe('white'); /* #ffffff */
  });

  it('gives every club in the world a family, and only ever one of the six', () => {
    /*
     * The property that replaces a club-name table: nothing has to be listed for this to hold, so
     * a club the world generates tomorrow gets a shirt without anyone touching this file.
     */
    const families: OutfieldAssetColour[] = ['green', 'yellow', 'red', 'blue', 'white', 'black'];
    for (const clubId of Object.keys(CLUB_VISUALS)) {
      expect(families, clubId).toContain(resolveOutfieldColourFamily(clubId));
    }
  });

  it('never asks the club which league it is in, or what it is called', () => {
    /* Two clubs with the same primary colour get the same shirt, whatever their names are. */
    expect(resolveOutfieldColourFamily('hapoel_tel_aviv')).toBe(
      resolveOutfieldColourFamily('hapoel_beer_sheva'),
    );
  });

  it('is the same for every outfield position', () => {
    const seen = new Set(
      OUTFIELD.map(
        (position) =>
          resolveCharacterAsset({ age: 24, position, clubId: MACCABI_ID, seed: 7, season: 2044 }).src,
      ),
    );
    expect(seen.size).toBe(1);
  });
});

describe('a youth side wears its parent club', () => {
  it('inherits the family, with no academy club listed anywhere', () => {
    /*
     * The same rule as the crest, and for the same reason: `clubVisual` resolves `crestOwnerId`
     * before it looks anything up, so the shirt inherits for free. A separate youth colour table
     * would be a second truth to keep in step.
     */
    for (const youth of [MACCABI_ACADEMY_ID, 'maccabi_youth']) {
      expect(resolveOutfieldColourFamily(youth), youth).toBe(resolveOutfieldColourFamily(MACCABI_ID));
    }
    /* Comments are not code - the file's prose names clubs as examples, and should. */
    const selector = fs
      .readFileSync(path.join(ROOT, 'src/lib/assetSelector.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const name of ['maccabi_academy', 'maccabi_youth', 'Maccabi', 'Hapoel', 'clubColorMap']) {
      expect(selector.includes(name), `assetSelector keys off the club name ${name}`).toBe(false);
    }
  });
});

describe('the goalkeeper wears his own kit', () => {
  it('resolves only blue, pink, purple or black - and never the club colour', () => {
    for (const clubId of Object.values(REPRESENTATIVE)) {
      for (let seed = 0; seed < 40; seed += 1) {
        for (const season of [2044, 2045]) {
          const art = resolveCharacterAsset({ age: 24, position: 'GK', clubId, seed, season });
          expect(GOALKEEPER_COLOURS, `${clubId} seed ${seed}`).toContain(art.colour);
          expect(art.role).toBe('goalkeeper');
        }
      }
    }
  });

  it('is stable for the same seed, club and season', () => {
    /*
     * A keeper who is purple on the home screen, blue at kickoff and pink in his career journey
     * has no identity at all. Every screen recomputes this, so it has to be a function.
     */
    for (let seed = 0; seed < 25; seed += 1) {
      const a = resolveCharacterAsset({ age: 24, position: 'GK', clubId: MACCABI_ID, seed, season: 2044 });
      const b = resolveCharacterAsset({ age: 24, position: 'GK', clubId: MACCABI_ID, seed, season: 2044 });
      expect(a.src).toBe(b.src);
    }
  });

  it('does not take the outfield family, even at a club whose colour it could have shared', () => {
    /* A keeper at a blue club must still be chosen by the keeper rule, not by the club's. */
    const art = resolveCharacterAsset({
      age: 24,
      position: 'GK',
      clubId: REPRESENTATIVE.blue,
      seed: 3,
      season: 2044,
    });
    expect(art.src).toContain('/goalkeeper/');
    expect(GOALKEEPER_COLOURS).toContain(art.colour);
  });
});

describe('the pose always names a file the pack has', () => {
  it('folds the four contexts onto the two poses each role ships', () => {
    /*
     * The new pack is deliberately smaller than the old one. `save` and `ready` have to land
     * somewhere, and they land on the pose that reads closest rather than on a path that does not
     * exist: an outfield player has no save, and a keeper has no hero.
     */
    const outfield = (context: (typeof CONTEXTS)[number]): string =>
      resolveCharacterAsset({ age: 24, position: 'ST', clubId: MACCABI_ID, seed: 1, season: 2044, context })
        .pose;
    expect(outfield('hero')).toBe('hero');
    expect(outfield('ready')).toBe('hero');
    expect(outfield('save')).toBe('hero');
    expect(outfield('celebration')).toBe('celebration');

    const keeper = (context: (typeof CONTEXTS)[number]): string =>
      resolveCharacterAsset({ age: 24, position: 'GK', clubId: MACCABI_ID, seed: 1, season: 2044, context })
        .pose;
    expect(keeper('hero')).toBe('ready');
    expect(keeper('ready')).toBe('ready');
    expect(keeper('save')).toBe('celebration');
    expect(keeper('celebration')).toBe('celebration');
  });
});

describe('every path the resolver can return exists on disk', () => {
  it('walks the whole matrix of age, position, context and club', () => {
    /*
     * The assertion that makes the string unions worth having. If a directory is ever renamed or
     * a colour dropped from the pack, this fails with the exact missing file rather than the game
     * rendering an empty frame.
     */
    const missing: string[] = [];
    for (const age of [12, 17, 24]) {
      for (const position of ['GK', ...OUTFIELD] as Position[]) {
        for (const context of CONTEXTS) {
          for (const clubId of Object.values(REPRESENTATIVE)) {
            for (const seed of [0, 1, 2, 3]) {
              const art = resolveCharacterAsset({ age, position, clubId, seed, season: 2044, context });
              if (!fs.existsSync(onDisk(art.src))) missing.push(art.src);
            }
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('covers every file the pack ships, so nothing is unreachable', () => {
    /*
     * The other direction. The forward walk proves the resolver never invents a path; this proves
     * the pack has no orphan - a colour or pose that was drawn and paid for and can never appear.
     */
    const reachable = new Set<string>();
    for (const age of [12, 17, 24]) {
      for (const context of CONTEXTS) {
        for (const clubId of Object.values(REPRESENTATIVE)) {
          reachable.add(
            resolveCharacterAsset({ age, position: 'ST', clubId, seed: 0, season: 2044, context }).src,
          );
        }
        /*
         * The keeper sweep has to vary the CLUB as well as the seed, and finding that out is what
         * this test is for. `resolveGoalkeeperKit` shortlists the two colours that contrast best
         * with the club's own, then hashes between those two - so at a green club no seed will
         * ever produce blue or purple. Sweeping seeds at one club left twelve files unreachable
         * and looked exactly like an orphaned asset.
         */
        for (const clubId of Object.values(REPRESENTATIVE)) {
          for (let seed = 0; seed < 40; seed += 1) {
            reachable.add(
              resolveCharacterAsset({ age, position: 'GK', clubId, seed, season: 2044, context }).src,
            );
          }
        }
      }
    }
    const shipped = walkFiles(path.join(ROOT, 'public/assets/maccabist/players'));
    const reachedOnDisk = new Set([...reachable].map(onDisk).map((p) => path.resolve(p)));
    expect(shipped.filter((file) => !reachedOnDisk.has(path.resolve(file)))).toEqual([]);
  });
});

describe('PlayerRender is a pre-rendered image, and the only one', () => {
  const component = fs.readFileSync(path.join(ROOT, 'src/components/PlayerRender.tsx'), 'utf8');

  it('no longer composites a shirt at all', () => {
    /*
     * The inverted half of the old `clubKit.test.ts` assertion. Every one of these was REQUIRED
     * to be present before v0.9.4.x; the pack ships finished kits, so each must now be absent.
     */
    for (const gone of [
      'pr-kit-colour',
      'pr-kit-shade',
      'pr-kit-accent',
      'pr-probe',
      'garmentMask',
      'KitLayers',
      'linear-gradient',
      'GARMENT_LAYERS',
      'resolvePlayerKit',
    ]) {
      expect(component.includes(gone), `PlayerRender still references ${gone}`).toBe(false);
    }
  });

  it('applies no filter to the character, and draws exactly one image', () => {
    const stripped = component.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const banned of ['hue-rotate', 'saturate(', 'sepia', 'filter:']) {
      expect(stripped.includes(banned), `PlayerRender uses ${banned}`).toBe(false);
    }
    expect(stripped.match(/<img/g) ?? []).toHaveLength(1);
  });

  it('keeps the exact public API the screens already pass', () => {
    /*
     * The point of the whole change: the internals swapped and not one screen moved. If a prop is
     * renamed or dropped here, a caller breaks silently at the type level long before anyone looks
     * at a screenshot - so the contract is pinned.
     */
    const props = component.slice(component.indexOf('export function PlayerRender({'));
    const signature = props.slice(0, props.indexOf('}: {'));
    for (const prop of ['age', 'position', 'clubId', 'seed', 'season', 'context', 'className', 'eager']) {
      expect(signature, `PlayerRender no longer accepts ${prop}`).toContain(prop);
    }
    /* And the two with defaults still have them, so existing callers that omit them are unchanged. */
    expect(signature).toContain("context = 'hero'");
    expect(signature).toContain('eager = true');
  });

  it('builds its path from BASE_URL, so GitHub Pages does not 404', () => {
    /*
     * The game deploys under `/Maccabist/`, where an absolute `/assets/...` resolves against the
     * domain root. Vite guarantees BASE_URL ends in a slash, so the concatenation must not add a
     * second one.
     */
    const selector = fs.readFileSync(path.join(ROOT, 'src/lib/assetSelector.ts'), 'utf8');
    expect(selector).toContain('import.meta.env.BASE_URL');
    expect(selector).not.toMatch(/ASSET_BASE\s*=\s*'\/assets/);
    const art = resolveCharacterAsset({ age: 24, position: 'ST', clubId: MACCABI_ID, seed: 1, season: 2044 });
    expect(art.src).not.toContain('//assets');
    expect(art.src).toContain('/assets/maccabist/players/');
  });

  it('is still the only component that resolves character art', () => {
    const offenders = [
      ...walkFiles(path.join(ROOT, 'src/components')),
      ...walkFiles(path.join(ROOT, 'src/pages')),
    ]
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('PlayerRender.tsx'))
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        return text.includes('resolveCharacterAsset') || text.includes('assets/maccabist');
      });
    expect(offenders).toEqual([]);
  });
});

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walkFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

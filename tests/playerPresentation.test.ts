/**
 * The player on screen tells the truth (v0.9.6, Phase 5).
 *
 * Three separate faults, all of which a player would have seen and none of which any test could:
 *
 *   5A  He celebrated defeats. Full time used `done && played ? (isKeeper ? 'save' : 'celebration')`
 *       with no reference to the score, so a 0-3 loss ended with the player punching the air. It
 *       was worse for keepers than it looked: `assetSelector` maps a goalkeeper's `'save'` onto the
 *       CELEBRATION artwork, so the losing keeper celebrated too, by a different route.
 *
 *   5B  One failed image was permanent. `artFailed` was a bare `useState(false)` that nothing ever
 *       reset, so a single dropped request left the frame empty for the life of the component -
 *       through a transfer, a birthday, a new keeper kit, a change of pose.
 *
 *   5C  The v0.9.5.1 goalkeeper rule, re-asserted here across the axes this phase touches: age
 *       band and pose, on top of the seasons `goalkeeperKit.test.ts` already covers.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { clubOutfieldColour } from '../src/ui/colourFamily';
import { GOALKEEPER_COLOURS } from '../src/ui/kit';
import { resolveCharacterAsset, type PlayerArtContext } from '../src/lib/assetSelector';
import type { Position } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** One club per outfield family, so every branch of the keeper exclusion is exercised. */
const CLUBS = {
  green: MACCABI_ID,
  yellow: 'maccabi_tel_aviv',
  red: 'hapoel_haifa',
  blue: 'ironi_kiryat_shmona',
  white: 'tottenham',
  black: 'sturm_graz',
} as const;

const AGES = [12, 17, 24] as const;

describe('5A - nobody celebrates a defeat', () => {
  const matchday = stripComments(read('src/components/Matchday.tsx'));

  it('reads the result before choosing the pose', () => {
    expect(matchday).toContain('const won = matchday.scoreFor > matchday.scoreAgainst;');
    expect(matchday).toContain("done && matchday.played && won ? 'celebration' : 'hero'");
  });

  it('no longer branches on position for the full-time pose', () => {
    /*
     * The old expression picked `'save'` for a keeper, which resolves to the celebration artwork.
     * One expression now covers both roles: a keeper's `'hero'` resolves to the ready pose.
     */
    expect(matchday.includes("isKeeper ? 'save' : 'celebration'")).toBe(false);
    expect(matchday.includes("'save'")).toBe(false);
  });

  it('maps every result and role to the right artwork', () => {
    /*
     * The contract stated as the six cases the brief lists, resolved through the real selector so
     * this checks the DRAWING rather than the string.
     */
    const poseFor = (position: Position, context: PlayerArtContext): string =>
      resolveCharacterAsset({ age: 24, position, clubId: MACCABI_ID, seed: 1, season: 2044, context })
        .pose;

    /* WIN - both roles celebrate. */
    expect(poseFor('ST', 'celebration')).toBe('celebration');
    expect(poseFor('GK', 'celebration')).toBe('celebration');
    /* DRAW and LOSS - the outfielder stands, the keeper is ready. Neither celebrates. */
    expect(poseFor('ST', 'hero')).toBe('hero');
    expect(poseFor('GK', 'hero')).toBe('ready');
  });
});

describe('5B - a failed image is retried when the asset changes', () => {
  const render = stripComments(read('src/components/PlayerRender.tsx'));

  it('remembers WHICH source failed, not merely that one did', () => {
    expect(render).toContain('const [failedSrc, setFailedSrc] = useState<string | null>(null);');
    expect(render).toContain('const artFailed = failedSrc === art.src;');
    expect(render).toContain('onError={() => setFailedSrc(art.src)}');
    /* The old permanent flag must be gone. */
    expect(render.includes('setArtFailed(true)')).toBe(false);
  });

  it('remounts the image when the source changes', () => {
    expect(render).toContain('key={art.src}');
  });

  it('recovers for every reason the resolved asset can change', () => {
    /*
     * The failure is keyed to a src, so recovery is exactly "does a different src come out". Each
     * of these is a real in-game transition that used to leave the frame permanently empty.
     */
    const base = { age: 24, position: 'ST' as Position, clubId: MACCABI_ID, seed: 1, season: 2044 };
    const src = (over: Partial<typeof base> & { context?: PlayerArtContext }): string =>
      resolveCharacterAsset({ ...base, ...over }).src;

    const start = src({});
    expect(src({ age: 12 })).not.toBe(start); /* birthday into a new age band */
    expect(src({ clubId: 'hapoel_haifa' })).not.toBe(start); /* transfer */
    expect(src({ context: 'celebration' })).not.toBe(start); /* full time */
    expect(src({ position: 'GK' })).not.toBe(start); /* role */
  });

  it('does not set state during render', () => {
    /*
     * The obvious alternative fix - "if the src changed, reset the flag" in the body - is a
     * render-phase setState and a React warning at best. The keyed approach needs no effect at
     * all, so neither should appear.
     */
    expect(render.includes('useEffect')).toBe(false);
  });
});

describe('5C - the goalkeeper keeps his shirt', () => {
  it('is the same colour across ages and poses at one club', () => {
    /*
     * v0.9.5.1 proved this across seasons. This phase adds the two axes it changes: the age band
     * (the pack now has genuinely different child/youth/adult art) and the pose.
     */
    const poses: PlayerArtContext[] = ['hero', 'ready', 'save', 'celebration'];
    for (const clubId of Object.values(CLUBS)) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const colours = new Set<string>();
        for (const age of AGES) {
          for (const season of [2031, 2038, 2044]) {
            for (const context of poses) {
              colours.add(
                resolveCharacterAsset({ age, position: 'GK', clubId, seed, season, context }).colour,
              );
            }
          }
        }
        expect(colours.size, `${clubId} seed ${seed} wore ${[...colours].join('/')}`).toBe(1);
      }
    }
  });

  it('never wears the club\'s own outfield colour, at any age', () => {
    for (const clubId of Object.values(CLUBS)) {
      const outfield = clubOutfieldColour(clubId);
      for (const age of AGES) {
        for (let seed = 0; seed < 120; seed += 1) {
          const colour = resolveCharacterAsset({
            age,
            position: 'GK',
            clubId,
            seed,
            season: 2044,
          }).colour;
          expect(GOALKEEPER_COLOURS).toContain(colour);
          expect(colour, `${clubId} (${outfield}) at age ${age}`).not.toBe(outfield);
        }
      }
    }
  });

  it('takes the season nowhere near the colour', () => {
    /* The v0.9.5.1 rule is (seed, club). Asserted at the selector, which is what screens call. */
    for (let seed = 0; seed < 40; seed += 1) {
      const colours = new Set(
        [2031, 2035, 2040, 2049].map(
          (season) =>
            resolveCharacterAsset({ age: 24, position: 'GK', clubId: MACCABI_ID, seed, season }).colour,
        ),
      );
      expect(colours.size).toBe(1);
    }
  });
});

describe('5D - outfield colour comes from the club, never from its name', () => {
  it('resolves every representative club to its own family', () => {
    for (const [family, clubId] of Object.entries(CLUBS)) {
      const colour = resolveCharacterAsset({
        age: 24,
        position: 'ST',
        clubId,
        seed: 1,
        season: 2044,
      }).colour;
      expect(colour, clubId).toBe(family);
    }
  });

  it('keys off no club name anywhere in the selector', () => {
    const selector = stripComments(read('src/lib/assetSelector.ts'));
    for (const name of ['Maccabi', 'Hapoel', 'maccabi_haifa', 'clubColorMap']) {
      expect(selector.includes(name), `assetSelector hardcodes ${name}`).toBe(false);
    }
  });
});

/**
 * Club kits (v0.9.4, Phase 2 and Phase 3).
 *
 * ## The invariant that changed, and why this is not a weakened test
 *
 * Up to v0.9.3 the rule was: no red player kit, no yellow player kit, ever. It existed so prestige
 * UI and character art would not compete, and it had a cost playtesting kept finding - a player at
 * Maccabi Haifa did not look like a Maccabi Haifa player.
 *
 * v0.9.4 replaces it with a rule split by what the shirt MEANS:
 *
 *   OUTFIELD    club colours are expected, including the reds and yellows the old rule forbade.
 *   GOALKEEPER  blue, pink, purple or black - and nothing else, ever.
 *
 * So the old invariant is not relaxed here; it is superseded by two narrower ones, and both are
 * asserted below. The goalkeeper's is strictly the tighter of the two.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MACCABI_ACADEMY_ID, MACCABI_ID } from '../src/data/clubs';
import { clubVisual } from '../src/data/clubVisuals';
import {
  GARMENT_LAYERS,
  GARMENT_SHADE_FILTER,
  GOALKEEPER_COLOURS,
  GOALKEEPER_KITS,
  luminanceOf,
  resolveClubKitPalette,
  resolveGoalkeeperKit,
  resolvePlayerKit,
  sampleGarment,
} from '../src/ui/kit';
import { resolvePlayerArt } from '../src/ui/playerArt';
import type { Position } from '../src/types';

const ROOT = path.resolve(__dirname, '..');

/** One club per colour family the world actually contains. */
const REPRESENTATIVE = {
  green: MACCABI_ID,
  yellowBlue: 'maccabi_tel_aviv',
  red: 'hapoel_haifa',
  blue: 'ironi_kiryat_shmona',
  purple: 'hapoel_hadera',
  dark: 'paok',
  white: 'tottenham',
} as const;

describe('the outfield kit is the club', () => {
  it('takes its colours from clubVisual, for every representative club', () => {
    for (const [family, clubId] of Object.entries(REPRESENTATIVE)) {
      const visual = clubVisual(clubId);
      const kit = resolveClubKitPalette(clubId);
      expect(kit.primary, family).toBe(visual.primary);
      expect(kit.secondary, family).toBe(visual.secondary);
      expect(kit.kind).toBe('outfield');
    }
  });

  it('allows the reds and yellows the old invariant forbade', () => {
    /*
     * The product change, asserted as a fact rather than described in a comment. If these ever
     * stopped being red and yellow, the club identity would have stopped being real.
     */
    const red = resolveClubKitPalette(REPRESENTATIVE.red).primary;
    const { r, g, b } = hex(red);
    expect(r > g * 1.8 && r > b * 1.8, `${red} is not red-dominant`).toBe(true);

    const yellow = resolveClubKitPalette(REPRESENTATIVE.yellowBlue).primary;
    const y = hex(yellow);
    expect(y.r > 200 && y.g > 170 && y.b < 120, `${yellow} is not yellow`).toBe(true);
  });

  /*
   * The test that replaced "never asks a bright colour to push as hard as a dark one".
   *
   * That one asserted the SHAPE of a tuning curve: strength scaled down as the club colour got
   * brighter. It passed for the whole of v0.9.4 while the thing it was guarding was broken, because
   * the curve was the bug - reducing a screen layer's opacity over near-black fabric multiplies the
   * colour down instead of moderating it, and Maccabi Tel Aviv's #f4d03f shipped as rgb(179,158,73).
   * Olive. The old assertion had no opinion about that, because it never looked at the result.
   *
   * So this asserts the RESULT instead, through `sampleGarment` - the composite the renderer
   * actually performs. It is a stricter test than the one it replaces, not a weaker one: it would
   * have failed on the code it replaces, and it constrains any future retuning to keep the club's
   * hue rather than to keep a particular curve.
   */
  it('puts the club\'s own hue on the shirt, at strength, for every colour family', () => {
    for (const [family, clubId] of Object.entries(REPRESENTATIVE)) {
      const kit = resolveClubKitPalette(clubId);
      const want = hex(kit.primary);
      const got = sampleGarment(kit);
      /* A grey has no hue to keep; the dark and white families are checked below instead. */
      if (Math.max(want.r, want.g, want.b) - Math.min(want.r, want.g, want.b) < 30) continue;

      const wantHue = hueDegrees(want.r, want.g, want.b);
      const gotHue = hueDegrees(got.r, got.g, got.b);
      const drift = Math.abs(((gotHue - wantHue + 540) % 360) - 180);
      expect(drift, `${family}: hue ${wantHue.toFixed(0)} rendered as ${gotHue.toFixed(0)}`)
        .toBeLessThanOrEqual(22);

      /*
       * And it must still be a COLOUR when it lands. Olive is not a hue failure - #f4d03f and
       * rgb(179,158,73) are 8 degrees apart - it is a saturation-and-value failure, which is
       * exactly why a hue check alone would have let v0.9.4 through.
       */
      const chroma = (Math.max(got.r, got.g, got.b) - Math.min(got.r, got.g, got.b)) / 255;
      const wantChroma = (Math.max(want.r, want.g, want.b) - Math.min(want.r, want.g, want.b)) / 255;
      expect(chroma, `${family}: rgb(${got.r},${got.g},${got.b}) has lost its saturation`)
        .toBeGreaterThan(wantChroma * 0.5);
    }
  });

  it('keeps the folds, which is what "flat" actually meant', () => {
    /*
     * The property that separates this from v0.9.4, stated as the numbers rather than as a colour.
     *
     * "Olive" was the symptom; FLAT was the disease. Screening a colour over the artwork compresses
     * the fabric into nothing in any channel where the colour is near 1 - for Maccabi Tel Aviv's
     * yellow the red channel spanned 173..185 across the shirt's real fold range, twelve levels,
     * which is a painted shape rather than cloth. Multiplying the remapped artwork back spans the
     * same range over 126..212.
     *
     * The two samples are the artwork's measured p25 and p75 through the garment mask, so this is
     * the range of an actual fold on an actual shirt, not two arbitrary inputs.
     */
    for (const [family, clubId] of Object.entries(REPRESENTATIVE)) {
      const kit = resolveClubKitPalette(clubId);
      if (luminanceOf(kit.primary) < 0.17) continue; /* a black shirt has nothing to shade. */
      const shadow = sampleGarment(kit, 0.075);
      const light = sampleGarment(kit, 0.216);
      const range = Math.max(light.r - shadow.r, light.g - shadow.g, light.b - shadow.b);
      expect(range, `${family}: only ${range} levels between fold and highlight`).toBeGreaterThan(50);
    }

    /* And every family carries one set of layer numbers - the per-club tuning WAS the bug. */
    expect(GARMENT_LAYERS.colour).toBeGreaterThan(0.9);
    expect(GARMENT_LAYERS.accent).toBeLessThan(0.5);
  });

  it('lifts a near-black shirt with the club\'s OWN secondary, and nothing else', () => {
    const dark = resolveClubKitPalette(REPRESENTATIVE.dark);
    expect(dark.needsLift).toBe(true);
    expect(dark.secondary).toBe(clubVisual(REPRESENTATIVE.dark).secondary);
    /* A club whose colour is perfectly visible needs no lift at all. */
    expect(resolveClubKitPalette(REPRESENTATIVE.green).needsLift).toBe(false);
    expect(resolveClubKitPalette(REPRESENTATIVE.yellowBlue).needsLift).toBe(false);

    /*
     * v0.9.4.x: the lift is the gradient's lit end, not a fourth layer washed over the top. A flat
     * pass of the secondary at a fixed opacity is a grey film - it makes a black shirt visible by
     * making it not black. Pulling the LIT END towards the secondary gives the same visibility as
     * a designed kit: dark body, lighter shoulders, and the shading still runs through it.
     */
    const lit = hex(dark.primaryLight);
    const base = hex(dark.primary);
    const secondary = hex(dark.secondary);
    /* It reads at all: the lit end is genuinely lighter than the body of the shirt. */
    expect(luminanceOf(dark.primaryLight)).toBeGreaterThan(luminanceOf(dark.primary));
    /*
     * And it is the club's own secondary that lifts it - asserted as the mix, because the obvious
     * "closer to the secondary than to white" phrasing is vacuous for the many clubs whose
     * secondary IS white, which is exactly the case this representative club turned out to be.
     */
    const towards = (from: number, to: number): number => Math.round(from * 0.62 + to * 0.38);
    expect([lit.r, lit.g, lit.b]).toEqual([
      towards(base.r, secondary.r),
      towards(base.g, secondary.g),
      towards(base.b, secondary.b),
    ]);
  });
});

describe('a youth side wears its parent club', () => {
  it('inherits the kit exactly, with no youth club listed anywhere', () => {
    /*
     * The same rule as the crest, and for the same reason: `clubVisual` resolves `crestOwnerId`
     * before it looks anything up, so the kit inherits for free. A separate youth colour table
     * would be a second truth to keep in step.
     */
    const pairs: [string, string][] = [
      [MACCABI_ACADEMY_ID, MACCABI_ID],
      ['maccabi_youth', MACCABI_ID],
      ['youth_hapoel_haifa', 'hapoel_haifa'],
      ['youth_maccabi_netanya', 'maccabi_netanya'],
      ['youth_hapoel_afula', 'hapoel_afula'],
    ];
    for (const [youth, parent] of pairs) {
      expect(resolveClubKitPalette(youth).primary, youth).toBe(resolveClubKitPalette(parent).primary);
      expect(resolveClubKitPalette(youth).secondary, youth).toBe(
        resolveClubKitPalette(parent).secondary,
      );
    }
    const kit = fs.readFileSync(path.join(ROOT, 'src/ui/kit.ts'), 'utf8');
    for (const youth of ['maccabi_youth', 'youth_hapoel_haifa', 'youth_hapoel_afula']) {
      expect(kit.includes(youth), `kit.ts names ${youth}`).toBe(false);
    }
  });

  it('leaves a standalone academy with its own identity', () => {
    /*
     * The two regional academies have no senior parent in this world, so inheriting would be a
     * lie - the same line v0.9.1 drew for their crests.
     */
    for (const standalone of ['youth_krayot', 'youth_tzafon']) {
      expect(resolveClubKitPalette(standalone).primary).toBe(clubVisual(standalone).primary);
    }
  });
});

describe('the goalkeeper wears his own kit', () => {
  it('is blue, pink, purple or black BY COLOUR, not merely by name', () => {
    /*
     * The invariant with teeth. Naming a key 'blue' proves nothing; this checks the hue each of
     * the four actually has, so the goalkeeper palette cannot drift into the reds and yellows that
     * v0.9.4 opened up for outfield shirts.
     */
    const bands: Record<string, [number, number]> = {
      blue: [200, 250],
      purple: [255, 285],
      pink: [300, 345],
    };
    for (const name of GOALKEEPER_COLOURS) {
      const { r, g, b } = hex(GOALKEEPER_KITS[name].primary);
      if (name === 'black') {
        /* Achromatic and dark: the one colour with no hue to check. */
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20);
        expect(luminanceOf(GOALKEEPER_KITS[name].primary)).toBeLessThan(0.17);
        continue;
      }
      const [low, high] = bands[name]!;
      const hue = hueDegrees(r, g, b);
      expect(hue, `${name} is ${Math.round(hue)}deg`).toBeGreaterThanOrEqual(low);
      expect(hue, `${name} is ${Math.round(hue)}deg`).toBeLessThanOrEqual(high);
    }
  });

  it('is always one of exactly four colours', () => {
    const allowed = new Set(GOALKEEPER_COLOURS.map((c) => GOALKEEPER_KITS[c].primary));
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const clubId of Object.values(REPRESENTATIVE)) {
        for (const season of [2031, 2040, 2049]) {
          const kit = resolveGoalkeeperKit({ seed, clubId, season });
          expect(allowed.has(kit.primary), `${kit.primary} is not an allowed GK colour`).toBe(true);
          expect(kit.kind).toBe('goalkeeper');
          expect(GOALKEEPER_COLOURS).toContain(kit.goalkeeperColour!);
        }
      }
    }
  });

  it('is stable for a season, and every screen therefore agrees', () => {
    /*
     * The requirement that shaped the resolver. A keeper who is purple on the home screen, blue at
     * kickoff and pink in his career journey has no identity at all, so nothing is rolled: the
     * choice is a hash, and every screen recomputes the same answer.
     */
    for (let seed = 1; seed <= 30; seed += 1) {
      const a = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2044 });
      const b = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2044 });
      expect(b).toEqual(a);
    }
  });

  it('contrasts with the club it plays for', () => {
    /*
     * Not kit-clash regulation - presentation identity. A green club never produces a keeper whose
     * shirt reads as the same colour, because the two best-contrasting candidates are found first
     * and the hash only picks between those.
     */
    for (let seed = 1; seed <= 40; seed += 1) {
      const green = resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season: 2044 });
      expect(green.goalkeeperColour).not.toBe('blue');
      const blue = resolveGoalkeeperKit({ seed, clubId: REPRESENTATIVE.blue, season: 2044 });
      expect(blue.goalkeeperColour).not.toBe('blue');
    }
  });

  it('still varies across careers and seasons', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const season of [2031, 2038, 2044, 2051]) {
        seen.add(resolveGoalkeeperKit({ seed, clubId: MACCABI_ID, season }).goalkeeperColour!);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is what the position resolver returns for a keeper, and only for a keeper', () => {
    const gk = resolvePlayerKit({ position: 'GK', clubId: MACCABI_ID, seed: 5, season: 2044 });
    expect(gk.kind).toBe('goalkeeper');
    for (const position of ['ST', 'CM', 'CB', 'FB', 'WG'] as Position[]) {
      const out = resolvePlayerKit({ position, clubId: MACCABI_ID, seed: 5, season: 2044 });
      expect(out.kind).toBe('outfield');
      expect(out.primary).toBe(clubVisual(MACCABI_ID).primary);
    }
  });
});

describe('the recolour touches the kit and nothing else', () => {
  it('has a garment mask on disk for every pose the resolver can return', () => {
    for (const age of [10, 16, 25]) {
      for (const position of ['GK', 'ST'] as Position[]) {
        for (const context of ['hero', 'celebration', 'save', 'ready'] as const) {
          const art = resolvePlayerArt({ age, position, context });
          const local = art.garmentMask.replace(/^\//, '').replace(/^.*?assets\//, 'public/assets/');
          expect(fs.existsSync(path.join(ROOT, local)), art.garmentMask).toBe(true);
          /* Derived from the art path, so a mask cannot be named for a pose that does not exist. */
          expect(art.garmentMask).toBe(`${art.src.replace(/\.webp$/, '')}-kit.png`);
        }
      }
    }
  });

  it('applies no filter to the character, anywhere', () => {
    /*
     * The brief's absolute rule. A hue-rotate or a saturate on the image would recolour skin, hair,
     * eyes, hands, the football and the background along with the shirt. Confinement is the mask's
     * job; there is no filter on the art at all.
     */
    const component = stripComments(
      fs.readFileSync(path.join(ROOT, 'src/components/PlayerRender.tsx'), 'utf8'),
    );
    for (const banned of ['hue-rotate', 'saturate(', 'sepia', 'filter:']) {
      expect(component.includes(banned), `PlayerRender uses ${banned}`).toBe(false);
    }
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    const artRule = css.slice(css.indexOf('\n.pr-art {'));
    expect(artRule.slice(0, artRule.indexOf('}'))).not.toContain('filter');
  });

  it('confines the colour with a mask, and rebuilds the fabric with layered blends', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    const kitRule = css.slice(css.indexOf('\n.pr-kit {'));
    const body = kitRule.slice(0, kitRule.indexOf('}'));
    expect(body).toContain('mask-image: var(--pr-mask)');
    /*
     * The three passes. COLOUR lands the club's hue normally, SHADE multiplies the artwork's own
     * folds back over it, ACCENT screens the neon trim on top - which is what separates a designed
     * kit from a tinted rectangle. And the colour layer is a lit GRADIENT, never a flat fill.
     */
    expect(css).toContain('.pr-kit-colour { mix-blend-mode: normal; }');
    expect(css).toContain('mix-blend-mode: multiply');
    expect(css).toContain('.pr-kit-accent { mix-blend-mode: screen; }');
    const render = fs.readFileSync(path.join(ROOT, 'src/components/PlayerRender.tsx'), 'utf8');
    expect(render).toContain('linear-gradient(180deg');
    for (const layer of ['pr-kit-colour', 'pr-kit-shade', 'pr-kit-accent']) {
      expect(render, `PlayerRender is missing the ${layer} pass`).toContain(layer);
    }
  });

  it('keeps the CSS shade remap and the canvas one from drifting apart', () => {
    /*
     * The stylesheet and the share poster each spell the same levels remap in their own
     * vocabulary, and a shirt that looks subtly unlike itself on the poster is precisely the bug
     * two hand-kept copies produce. The exported constant is the single source; both must use it.
     */
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    const shadeRule = css.slice(css.indexOf('\n.pr-kit-shade {'));
    expect(shadeRule.slice(0, shadeRule.indexOf('}'))).toContain(`filter: ${GARMENT_SHADE_FILTER};`);
    expect(fs.readFileSync(path.join(ROOT, 'src/services/posterRenderer.ts'), 'utf8')).toContain(
      'GARMENT_SHADE_FILTER',
    );
  });

  it('isolates the blend group, so the kit can never darken the stadium behind him', () => {
    /*
     * `mix-blend-mode` reaches for the nearest stacking context's backdrop. Without an isolation
     * boundary on `.pr` the multiply pass finds the scene behind the player wherever the mask
     * feathers over a transparent edge of the artwork, and quietly darkens it.
     */
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    const wrapper = css.slice(css.indexOf('\n.pr {'));
    expect(wrapper.slice(0, wrapper.indexOf('}'))).toContain('isolation: isolate');
  });
});

describe('v0.9.4 Phase 5: one component, and the right club on every screen', () => {
  const read = (file: string): string =>
    stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));

  it('routes every character presentation through PlayerRender', () => {
    /*
     * Club recolouring applied separately in five places is five chances for the same player to be
     * wearing two different shirts. Only PlayerRender resolves character art for the DOM; the
     * poster is the one exception and it is a canvas, where CSS compositing does not exist.
     */
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      );
    const offenders = [
      ...walk(path.join(ROOT, 'src/components')),
      ...walk(path.join(ROOT, 'src/pages')),
    ]
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('PlayerRender.tsx'))
      .filter((file) => {
        const text = stripComments(fs.readFileSync(file, 'utf8'));
        return text.includes('getCareerPlayerArt') || text.includes('resolvePlayerArt');
      });
    expect(offenders).toEqual([]);
  });

  it('shows the CURRENT club on a transfer offer, never the destination', () => {
    /*
     * He has not signed anything. Putting him in the destination's shirt while he is still deciding
     * would tell him the decision was already made - and the arrival ceremony, which fires after he
     * accepts, is where the new shirt is supposed to land.
     */
    const decision = read('src/components/DecisionScreen.tsx');
    const render = decision.slice(decision.indexOf('<PlayerRender'));
    const props = render.slice(0, render.indexOf('/>'));
    expect(props).toContain('clubId={career.currentClubId}');
    expect(props).not.toContain('offer.clubId');
  });

  it('switches to the NEW club only once the move has happened', () => {
    // The arrival moment fires at the first preseason AFTER the move, so currentClubId is already
    // the new club by then - the reveal is a consequence of the transfer, not a preview of it.
    const moments = read('src/components/CareerMoments.tsx');
    const arrival = moments.slice(moments.indexOf('export function deriveArrivalMoment'));
    expect(arrival.slice(0, arrival.indexOf('\n}'))).toContain('kitClubId: career.currentClubId');
  });

  it('never changes the matchday shirt for the venue or the reading direction', () => {
    const matchday = read('src/components/Matchday.tsx');
    const render = matchday.slice(matchday.indexOf('<PlayerRender'));
    const props = render.slice(0, render.indexOf('/>'));
    expect(props).toContain('clubId={career.currentClubId}');
    expect(props).not.toContain('fixture.home');
    expect(props).not.toContain('homeClubId');
  });

  it('composites the same kit onto the share poster, where CSS cannot reach', () => {
    const poster = read('src/services/posterRenderer.ts');
    expect(poster).toContain('resolvePlayerKit');
    expect(poster).toContain('garmentMask');
    /* Build the layer, cut it to the garment, then blend - the canvas spelling of the CSS. */
    expect(poster).toContain("'destination-in'");
    /* The same three passes as the DOM: colour normally, shade multiplied, accent screened. */
    expect(poster).toContain("'source-over'");
    expect(poster).toContain("'multiply'");
    expect(poster).toContain("'screen'");
    expect(poster).toContain('GARMENT_LAYERS');
  });

  it('archives the seed, so a retired goalkeeper keeps his colour', () => {
    const archive = read('src/game/archive.ts');
    expect(archive).toContain('seed: career.seed');
  });
});

function hueDegrees(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Comments are not code. This assertion flagged its own explanation on the first run. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function hex(value: string): { r: number; g: number; b: number } {
  const clean = value.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

describe('one set of layer numbers, so a new club needs no tuning at all', () => {
  it('gives every club in the world the same passes, and a shirt that reads as its colour', () => {
    /*
     * What replaced the strength-curve property test.
     *
     * That one checked that a brighter club colour got a lower `strength` than a darker one, and
     * it held for the whole of v0.9.4 while the shirts it was guarding came out muddy - because
     * the curve itself was the fault. The honest version of "a new club needs no tuning" is that
     * there is nothing left to tune: the passes are constant, and what has to hold is that the
     * RESULT still reads as the club's colour whatever that colour is.
     */
    const clubs = Object.values(REPRESENTATIVE);
    for (const clubId of clubs) {
      const kit = resolveClubKitPalette(clubId);
      const got = sampleGarment(kit);
      const want = hex(kit.primary);
      /*
       * Every channel moves the same way the club's colour does: the shirt's dominant channel is
       * the club colour's dominant channel. A dimming bug breaks this for exactly the colours it
       * is worst on, which is how olive would be caught.
       */
      const rank = (c: { r: number; g: number; b: number }): string =>
        (['r', 'g', 'b'] as const)
          .slice()
          .sort((a, b) => c[b] - c[a])
          .join('');
      if (Math.max(want.r, want.g, want.b) - Math.min(want.r, want.g, want.b) < 30) continue;
      expect(rank(got), `${clubId}: rgb(${got.r},${got.g},${got.b}) from ${kit.primary}`).toBe(
        rank(want),
      );
    }
  });

  it('never lets the accent pass wash out the colour underneath it', () => {
    /* The neon trim is decoration on the kit, never the kit itself. */
    expect(GARMENT_LAYERS.accent).toBeLessThan(GARMENT_LAYERS.colour / 2);
    expect(GARMENT_SHADE_FILTER).toMatch(/^brightness\([\d.]+\) contrast\([\d.]+\) brightness\([\d.]+\)$/);
  });
});

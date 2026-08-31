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
  GOALKEEPER_COLOURS,
  GOALKEEPER_KITS,
  luminanceOf,
  resolveClubKitPalette,
  resolveGoalkeeperKit,
  resolvePlayerKit,
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

  it('never asks a bright colour to push as hard as a dark one', () => {
    const dark = resolveClubKitPalette(REPRESENTATIVE.dark);
    const white = resolveClubKitPalette(REPRESENTATIVE.white);
    const green = resolveClubKitPalette(REPRESENTATIVE.green);
    expect(dark.strength).toBeGreaterThan(green.strength);
    expect(green.strength).toBeGreaterThan(white.strength);
    for (const kit of [dark, white, green]) {
      expect(kit.strength).toBeGreaterThanOrEqual(0.62);
      expect(kit.strength).toBeLessThanOrEqual(0.95);
    }
  });

  it('lifts a near-black shirt with the club\'s OWN secondary, and nothing else', () => {
    const dark = resolveClubKitPalette(REPRESENTATIVE.dark);
    expect(dark.needsLift).toBe(true);
    expect(dark.secondary).toBe(clubVisual(REPRESENTATIVE.dark).secondary);
    /* A club whose colour is perfectly visible needs no lift at all. */
    expect(resolveClubKitPalette(REPRESENTATIVE.green).needsLift).toBe(false);
    expect(resolveClubKitPalette(REPRESENTATIVE.yellowBlue).needsLift).toBe(false);
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

  it('confines the colour with a mask, and keeps the fabric with a blend', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/gamefeel.css'), 'utf8');
    const kitRule = css.slice(css.indexOf('\n.pr-kit {'));
    const body = kitRule.slice(0, kitRule.indexOf('}'));
    expect(body).toContain('mask-image: var(--pr-mask)');
    /* `screen` over black fabric yields the colour and keeps every fold and highlight. */
    expect(body).toContain('mix-blend-mode: screen');
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
    /* Mask first, club colour into it, then screened on - the canvas spelling of the CSS. */
    expect(poster).toContain("'source-in'");
    expect(poster).toContain("'screen'");
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

describe('luminance drives the strength, so a new club needs no tuning', () => {
  it('never gives a brighter colour more strength than a darker one', () => {
    /*
     * The property, not a hand-written order. The first version of this listed the representative
     * clubs in the sequence I assumed and failed: Kiryat Shmona's blue (0.283) is very slightly
     * darker than Hapoel's red (0.292), which no amount of asserting was going to change. Sorting
     * by the measured value and checking strength moves the other way tests the resolver instead
     * of my guess.
     */
    const clubs = Object.values(REPRESENTATIVE);
    const rows = clubs
      .map((clubId) => ({
        clubId,
        lum: luminanceOf(clubVisual(clubId).primary),
        strength: resolveClubKitPalette(clubId).strength,
      }))
      .sort((a, b) => a.lum - b.lum);
    for (let i = 1; i < rows.length; i += 1) {
      expect(
        rows[i]!.strength,
        `${rows[i]!.clubId} (lum ${rows[i]!.lum.toFixed(3)}) vs ${rows[i - 1]!.clubId}`,
      ).toBeLessThanOrEqual(rows[i - 1]!.strength);
    }
    /* And the spread is real: the darkest club pushes meaningfully harder than the brightest. */
    expect(rows[0]!.strength - rows[rows.length - 1]!.strength).toBeGreaterThan(0.2);
  });
});

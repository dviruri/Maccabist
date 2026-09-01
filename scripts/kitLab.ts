/*
 * Look at the kit (v0.9.4.x).
 *
 * The recolour is a compositing effect: nothing about it can be verified by reading the source,
 * and v0.9.4 shipped a shirt that read as cheap paint precisely because it was only ever reasoned
 * about. Maccabi Tel Aviv's yellow arrived olive and no test noticed, because no test can see.
 *
 * So this renders the REAL stack - the palettes come from `src/ui/kit.ts` and the CSS is copied
 * from the `.pr-*` block of `src/styles/gamefeel.css` - across every colour family the world
 * contains, and screenshots it. The point is that the numbers in the picture are the numbers the
 * game uses; a lab with its own copy of the maths would have agreed with the bug.
 *
 * Usage:
 *   npm run kit:lab                     both poses, .shots/kit-lab.png
 *   npm run kit:lab -- --zoom           torso crop, for judging fabric and folds
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CLUB_VISUALS } from '../src/data/clubVisuals';
import {
  GARMENT_LAYERS,
  GARMENT_SHADE_FILTER,
  GOALKEEPER_KITS,
  luminanceOf,
  sampleGarment,
  type KitPalette,
} from '../src/ui/kit';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = resolve(import.meta.dirname, '..');
const ART = pathToFileURL(resolve(ROOT, 'public/assets/gamefeel/players')).href;
const zoom = process.argv.includes('--zoom');

/*
 * The palettes are resolved through the real resolvers where a club exists, and built directly
 * from `GOALKEEPER_KITS` for the four keeper colours - which is what `resolveGoalkeeperKit`
 * returns once its hash has chosen. Importing the resolver rather than restating its output is
 * the whole point of the file.
 */
const mixHex = (from: string, to: string, amount: number): string => {
  const px = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').slice(i - 1, i + 1), 16));
  const [ar, ag, ab] = px(from);
  const [br, bg, bb] = px(to);
  const ch = (x: number, y: number) => Math.round(x * (1 - amount) + y * amount).toString(16).padStart(2, '0');
  return `#${ch(ar!, br!)}${ch(ag!, bg!)}${ch(ab!, bb!)}`;
};

type Case = { label: string; pose: string; kit: KitPalette };

/** Rebuilt exactly as `layersFor` does, from primary+secondary - see src/ui/kit.ts. */
function paletteOf(primary: string, secondary: string, kind: KitPalette['kind']): KitPalette {
  const dark = luminanceOf(primary) < 0.17;
  return {
    primary,
    secondary,
    primaryLight: dark ? mixHex(primary, secondary, 0.38) : mixHex(primary, '#ffffff', 0.22),
    primaryDark: dark ? mixHex(primary, '#000000', 0.3) : mixHex(primary, '#000000', 0.42),
    needsLift: dark,
    kind,
  };
}

const OUTFIELD = 'adult/outfield-hero';
const GK = 'adult/goalkeeper-hero';
const club = (id: string, label: string): Case => {
  const v = CLUB_VISUALS[id]!;
  return { label: `${label} ${v.primary}`, pose: OUTFIELD, kit: paletteOf(v.primary, v.secondary, 'outfield') };
};

const CASES: Case[] = [
  club('maccabi_haifa', 'מכבי חיפה'),
  club('maccabi_tel_aviv', 'מכבי ת״א'),
  club('hapoel_tel_aviv', 'הפועל ת״א'),
  club('ironi_kiryat_shmona', 'קרית שמונה'),
  club('hapoel_hadera', 'הפועל חדרה'),
  club('hapoel_nof_hagalil', 'נוף הגליל'),
  club('sturm_graz', 'שטורם גראץ'),
  club('maccabi_youth', 'מכבי נוער (ירושה)'),
  ...(Object.entries(GOALKEEPER_KITS) as [string, { primary: string; secondary: string }][]).map(
    ([name, k]): Case => ({
      label: `GK ${name} ${k.primary}`,
      pose: GK,
      kit: paletteOf(k.primary, k.secondary, 'goalkeeper'),
    }),
  ),
];

const cell = (c: Case): string => {
  const src = `${ART}/${c.pose}.webp`;
  const mask = `${ART}/${c.pose}-kit.png`;
  const s = sampleGarment(c.kit);
  return `<div class="cell">
    <div class="cap"><span>${c.label}</span><span class="sw" style="background:${c.kit.primary}"></span></div>
    <div class="num">midtone rgb(${s.r},${s.g},${s.b}) ${c.kit.needsLift ? '· lift' : ''}</div>
    <div class="win"><div class="pr">
      <img class="pr-art" src="${src}" alt="">
      <div class="pr-kit pr-kit-colour" style="--pr-mask:url(${mask});background:linear-gradient(180deg, ${c.kit.primaryLight} 0%, ${c.kit.primary} 45%, ${c.kit.primaryDark} 100%);opacity:${GARMENT_LAYERS.colour}"></div>
      <div class="pr-kit pr-kit-shade" style="--pr-mask:url(${mask});background-image:url(${src});opacity:${GARMENT_LAYERS.shade}"></div>
      <div class="pr-kit pr-kit-accent" style="--pr-mask:url(${mask});background-image:url(${src});opacity:${GARMENT_LAYERS.accent}"></div>
    </div></div>
  </div>`;
};

const html = `<!doctype html><meta charset=utf-8><title>kit lab</title><style>
 body{margin:0;background:#0e120f;font:13px/1.4 system-ui,sans-serif;color:#f2f6f3;direction:rtl}
 .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px}
 .cell{background:linear-gradient(180deg,#151b17,#0e120f);border:1px solid #2a332c;border-radius:12px;padding:10px}
 .cap{display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px}
 .sw{width:14px;height:14px;border-radius:4px}
 .num{color:#9fb0a5;font-size:11px;margin-bottom:6px;direction:ltr;text-align:right}
 ${zoom
   ? '.win{position:relative;width:100%;padding-bottom:73%;overflow:hidden;border-radius:8px}.pr{position:absolute;left:-47%;top:-28%;width:189%;line-height:0}'
   : '.win{position:relative}.pr{position:relative;line-height:0}'}
 .pr-art{display:block;width:100%;height:auto}
 /* copied verbatim from the .pr-kit block of src/styles/gamefeel.css */
 .pr-kit{position:absolute;inset:0;-webkit-mask-image:var(--pr-mask);mask-image:var(--pr-mask);
   -webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;pointer-events:none}
 .pr-kit-colour{mix-blend-mode:normal}
 .pr-kit-shade,.pr-kit-accent{background-size:100% 100%;background-repeat:no-repeat}
 .pr-kit-shade{filter:${GARMENT_SHADE_FILTER};mix-blend-mode:multiply}
 .pr-kit-accent{mix-blend-mode:screen}
</style><body><div class="grid">${CASES.map(cell).join('')}</div>`;

mkdirSync(`${ROOT}/.shots`, { recursive: true });
const page = `${ROOT}/.shots/kit-lab.html`;
const out = resolve(ROOT, `.shots/kit-lab${zoom ? '-zoom' : ''}.png`);
writeFileSync(page, html, 'utf8');
spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files',
  `--window-size=${zoom ? '1700,1500' : '1600,1620'}`,
  '--virtual-time-budget=9000',
  `--screenshot=${out}`,
  pathToFileURL(page).href,
]).on('close', (code) => console.log(`${out} (exit ${code})`));

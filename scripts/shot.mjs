/*
 * Screenshot a gallery scene at an exact phone size (v0.9.3).
 *
 * The v0.9.2 pass proved that automated overflow numbers are not enough: a hero can pass every
 * width check and still be a screenful of shins. This exists so a visual claim in the report can
 * be checked by looking, at the same viewport the audit measures.
 *
 * ## Calibration is NOT the audit's, and getting that wrong wasted a pass
 *
 * With `--dump-dom` the CSS viewport is 95px shorter than `--window-size`, so the audit asks for
 * target + 95. With `--screenshot` it is NOT: the capture is the window height exactly. Adding
 * the same 95px here produced screenshots at a 939px viewport while claiming to show 844, which
 * silently disabled every `max-height` rule in the stylesheet - the 320x568 shot showed the full
 * hero, the caption and the feed because none of the short-viewport rules had matched.
 *
 * So this passes the height through untouched, and the PNG's own height is the check: it must
 * equal the requested one.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [, , base, scene, size, bare = '1', out = '.shots'] = process.argv;
const [w, h] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const file = `${out}/${scene}-${w}x${h}.png`;
const p = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${Math.max(w, 520)},${h}`,
  '--virtual-time-budget=6000',
  `--screenshot=${file}`,
  `${base}?gallery=1&only=${scene}&w=${w}&bare=${bare}`,
]);
p.on('close', (code) => console.log(`${file} (exit ${code})`));

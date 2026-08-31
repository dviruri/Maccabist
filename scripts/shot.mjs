/*
 * Screenshot a gallery scene at an exact phone size (v0.9.3).
 *
 * The v0.9.2 pass proved that automated overflow numbers are not enough: a hero can pass every
 * width check and still be a screenful of shins. This exists so a visual claim in the report can
 * be checked by looking, at the same viewport the audit measures.
 *
 * Calibration is the audit's: --window-size is 95px taller than the CSS viewport it produces,
 * and refuses to go below ~520px wide, so the harness pins the document width via ?w=.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CHROME_H_DELTA = 95;
const [, , base, scene, size, bare = '1', out = '.shots'] = process.argv;
const [w, h] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const file = `${out}/${scene}-${w}x${h}.png`;
const p = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${Math.max(w, 520)},${h + CHROME_H_DELTA}`,
  '--virtual-time-budget=6000',
  `--screenshot=${file}`,
  `${base}?gallery=1&only=${scene}&w=${w}&bare=${bare}`,
]);
p.on('close', (code) => console.log(`${file} (exit ${code})`));

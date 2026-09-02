/*
 * Touch-target audit (v0.9.6, Phase 9).
 *
 * The one-screen audit answers "does it fit" and "is it inside the viewport". Neither answers
 * "can it be pressed with a thumb" - a control can be visible, unclipped and still a 20px target.
 * On a game played entirely one-handed that is a real beta blocker, and it does not show up in a
 * screenshot.
 *
 * The probe lives in src/dev/Gallery.tsx behind `?touch=1`, next to the overflow and contrast
 * probes and for the same reason: only the page can measure a rendered rect.
 *
 *   node scripts/touchAudit.mjs [baseUrl] [width]
 */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const base = process.argv[2] ?? 'http://localhost:5199/';
const width = process.argv[3] ?? '390';

/*
 * The states a thumb actually has to operate. Sheets are included because their close control is
 * the one a player reaches for most and the easiest to make too small.
 */
const SCENES = [
  'gf-play-home', 'gf-play-home-euro', 'gf-play-decision', 'decision-mandatory',
  'gameplay', 'event-three', 'youth-fork', 'retirement-decision',
  'gf-matchday', 'gf-matchday-live', 'gf-matchday-half', 'gf-matchday-ft',
  'gf-moment', 'gf-moment-debut', 'sheet-table', 'sheet-club', 'hub-europe',
];

function audit(scene) {
  return new Promise((done) => {
    const p = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--window-size=520,900`, '--virtual-time-budget=7000',
      '--dump-dom', `${base}?gallery=1&touch=1&only=${scene}&w=${width}&bare=1`,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => {
      const m = out.match(/<script id="touch-result" type="application\/json">([\s\S]*?)<\/script>/);
      done(m ? JSON.parse(m[1]) : null);
    });
  });
}

console.log(`touch-target audit - ${base} at ${width}px, minimum 44x44`);
let total = 0;
for (const scene of SCENES) {
  const fails = await audit(scene);
  if (!fails) { console.log(`${scene.padEnd(22)} NO RESULT`); continue; }
  total += fails.length;
  console.log(`${scene.padEnd(22)} ${fails.length === 0 ? 'ok' : `${fails.length}`}`);
  for (const f of fails) console.log(`   ${f.w}x${f.h}  ${f.sel}  "${f.text}"`);
}
console.log(`\n${total} undersized touch target${total === 1 ? '' : 's'}`);
process.exit(total > 0 ? 1 : 0);

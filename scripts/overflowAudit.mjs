/*
 * Overflow audit. Loads each gallery scene in headless Chrome and asks the page itself whether
 * anything is wider than the viewport, rather than inferring it from a screenshot - which is how
 * v0.4.5 produced a false positive (headless viewport != --window-size, and an RTL document
 * anchors right, so a narrow shot looks clipped when nothing is wrong).
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SCENES = process.argv[2].split(',');
const WIDTHS = process.argv[3].split(',').map(Number);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const probe = `(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Only report elements that actually stick out past the viewport edge.
    const over = Math.max(0, Math.round(r.right - vw), Math.round(-r.left));
    if (over > 1) bad.push((el.className && String(el.className).slice(0,40) || el.tagName) + ' +' + over);
  }
  const doc = Math.round(document.documentElement.scrollWidth - vw);
  return JSON.stringify({ vw, doc, bad: [...new Set(bad)].slice(0, 6) });
})()`;
writeFileSync('/tmp/probe.js', probe);

const run = (scene, w) => new Promise((res) => {
  const p = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',
    `--window-size=${w},900`, '--virtual-time-budget=4000', '--dump-dom',
    `http://localhost:4181/Maccabist/?gallery=1&only=${scene}&w=${w}&probe=1`]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.on('close', () => res(out));
});

for (const w of WIDTHS) {
  for (const s of SCENES) {
    const dom = await run(s, w);
    const m = dom.match(/data-probe="([^"]*)"/);
    console.log(`${String(w).padEnd(4)} ${s.padEnd(24)} ${m ? m[1] : 'no probe'}`);
  }
}

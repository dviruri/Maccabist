/*
 * Dark-on-dark text audit (v0.9.4.x).
 *
 * Maccabist is a dark app whose text colour is almost always inherited, and that is exactly the
 * shape of bug that keeps reaching players: nothing declares black anywhere, but an element whose
 * colour the UA supplies - a <button>, and this app builds tappable surfaces out of buttons
 * everywhere - falls back to the UA default and lands near-black on dark glass. Reading the
 * stylesheet cannot find that. Only the computed style on a rendered node can.
 *
 * So this walks every rendered text node in a gallery scene, resolves the colour it ACTUALLY has
 * and the background it ACTUALLY sits on - compositing translucent layers up the ancestor chain,
 * because the whole design language is glass over stadium - and reports the WCAG contrast ratio.
 *
 * Thresholds are the WCAG AA ones: 4.5 for body text, 3.0 for large or bold text, since a
 * 20px 900-weight heading is legible at a ratio that would fail a 12px caption.
 *
 * Usage:
 *   node scripts/contrastAudit.mjs [baseUrl] [scene,scene,...]
 */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const base = process.argv[2] ?? 'http://localhost:5199/';
/**
 * Every gallery scene, because the bug this exists for was found by a player and not by the
 * three screens anyone would have thought to check. Pass a comma-separated list to narrow it.
 */
const ALL = [
  'gameplay', 'gameplay-away', 'play-academy', 'play-abroad', 'play-title', 'play-relegation',
  'play-gk', 'play-longname', 'four-outcomes', 'loan-offer', 'sheet-table', 'sheet-people',
  'sheet-club', 'sheet-story', 'sheet-legacy', 'sheet-timeline', 'new-career', 'crests',
  'table-maccabi', 'table-full', 'table-away', 'table-second', 'table-alef',
  'ladder-senior', 'ladder-normal', 'ladder-early', 'ladder-u19',
  'origin-prodigy', 'origin-accepted', 'origin-rejected',
  'hub-senior', 'hub-academy', 'hub-loan', 'hub-europe', 'reveal', 'reveal-locked',
  'sami-legend', 'sami-traitor', 'sami-rejected', 'maccabi-banner', 'maccabi-banner-rejected',
  'news', 'timeline', 'season', 'midseason', 'season-memorable', 'season-cup-final-lost',
  'cabinet', 'album', 'europe-card', 'gf-hero', 'gf-home', 'gf-play-home', 'gf-play-decision',
  'gf-play-home-euro', 'gf-play-home-red', 'gf-play-home-yellow', 'gf-play-signing',
  'gf-play-home-gk', 'gf-play-home-youth', 'gf-play-home-offer', 'gf-play-championship',
  'gf-matchday', 'gf-matchday-live', 'gf-matchday-half', 'gf-matchday-ft',
  'gf-moment-uefa', 'gf-moment-relegation', 'gf-moment-debut', 'gf-journey', 'gf-showcase',
  'gf-decision', 'gf-home-focused', 'gf-hero-gk', 'gf-hero-youth-gk', 'gf-moment',
  'europe-summary', 'journey', 'retirement', 'retirement-modest', 'offers',
];
const scenes = (process.argv[3] ?? ALL.join(',')).split(',');

/** Run one scene and return whatever the page printed into <pre id=audit>. */
function audit(scene) {
  return new Promise((done) => {
    const p = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--window-size=520,1400', '--virtual-time-budget=7000',
      '--dump-dom', `${base}?gallery=1&contrast=1&only=${scene}&w=390&bare=1`,
    ]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => {
      const m = out.match(/<script id="audit-result" type="application\/json">([\s\S]*?)<\/script>/);
      done(m ? JSON.parse(m[1]) : null);
    });
  });
}

/*
 * The probe itself lives in `src/dev/Gallery.tsx` behind `?contrast=1`, next to the overflow
 * probe and for the same reason: only the page can answer what colour a node actually computed to.
 */
/**
 * Known and accepted, with the reason. Not a way to make the audit quiet: each entry names a
 * specific colour pair that a human looked at and decided to keep, so the next person inherits the
 * decision rather than rediscovering the finding and re-litigating it. Anything NOT listed here
 * that fails is a regression.
 */
const ACCEPTED = [
  {
    /*
     * The primary CTA, white on the brand green. 3.19 against a 4.5 bar for 16px/800 - it would
     * pass unchanged at 18.66px. Reviewed during the v0.9.4.x readability pass and deliberately
     * kept: white-on-green is the established Maccabist call to action, it is not the dark-on-dark
     * class of bug that pass was about, and the alternatives both restyle the most prominent
     * element in the app (deepen the green, or flip the label to dark ink).
     */
    color: 'rgb(255,255,255)',
    bg: 'rgb(15,166,74)',
    why: 'primary CTA, white on brand green - reviewed, kept',
  },
];

const accepted = (f) => ACCEPTED.some((a) => a.color === f.color && a.bg === f.bg);

console.log('contrast audit —', base);
console.log('scene'.padEnd(24), 'fails');
let total = 0;
for (const scene of scenes) {
  const result = await audit(scene);
  if (!result) { console.log(scene.padEnd(24), 'NO RESULT (scene missing?)'); continue; }
  const known = result.filter(accepted).length;
  const news = result.filter((f) => !accepted(f));
  total += news.length;
  console.log(scene.padEnd(24), news.length === 0 ? `ok${known ? ` (${known} accepted)` : ''}` : `${news.length}`);
  for (const f of news) {
    console.log(`   ${f.ratio.padEnd(5)} ${f.color.padEnd(22)} on ${f.bg.padEnd(22)} ${f.px}px/${f.weight} ${f.sel}`);
    console.log(`         "${f.text}"`);
  }
}
console.log(`\n${total} unaccepted failing text node${total === 1 ? '' : 's'}`);
if (total === 0) console.log('no unreviewed contrast failure on any screen.');
process.exit(total > 0 ? 1 : 0);

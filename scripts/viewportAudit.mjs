/*
 * One-screen viewport audit (v0.9.3, Phase 8).
 *
 * The overflow audit (scripts/overflowAudit.mjs) answers "is anything wider than the phone".
 * This answers the question v0.9.3 is actually about: does a PRIMARY GAME SCREEN need document
 * scrolling, and is everything that matters on it actually inside the viewport.
 *
 * Two numbers and a checklist per scene:
 *
 *   sh   what the document wants to be, in pixels
 *   vh   what the phone gives it
 *   need each required selector, reported OK / CUT / NONE by the page itself
 *
 * The `need` list is the part that stops this from being gameable. A screen can always be made
 * to "fit" by cropping its primary button away; the page reports that as CUT, so the cheat is
 * louder than the pass.
 *
 * ## Headless calibration, learned the hard way
 *
 * Chrome's --window-size is NOT the CSS viewport. Measured in this environment, the viewport
 * height is consistently `window-height - 95` and the width refuses to go below ~500px however
 * narrow the window is asked to be. So:
 *
 *   - height  is requested as target + CHROME_H_DELTA, and asserted from the page's own
 *     window.innerHeight rather than assumed;
 *   - width   is pinned by the gallery harness (?w=), which sizes html/body and the two
 *     fixed-position surfaces (the sheet and the bottom nav) to the requested width.
 *
 * Both facts were established by measurement, not by reading documentation: asking for
 * 390x600 / 390x700 / 390x939 returned innerHeight 505 / 605 / 844.
 *
 * Usage:
 *   node scripts/viewportAudit.mjs <baseUrl> <width>[,<width>...] [x<height>]
 */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/** Measured, not assumed: the headless window is this much taller than its CSS viewport. */
const CHROME_H_DELTA = 95;
/** Requesting less than this lays out at the floor regardless; the harness pins width anyway. */
const CHROME_MIN_W = 520;

const baseUrl = process.argv[2] ?? 'http://localhost:5199/';

/**
 * The scenes v0.9.3 claims fit one screen, with what must be visible on each.
 *
 * `bare` says whether the scene brings its own shell (a full page) or needs the one the game
 * puts around a component.
 */
const SCENES = [
  /*
   * The event decision. These scenes carry no player hero on purpose since Phase 4 - a decision
   * owns the viewport - so what must be visible is the question and every choice, plus the nav
   * a player uses to check the table before answering.
   */
  { id: 'gameplay', bare: '1', need: ['.gf-bottomnav', '.event-card', '.card-title', '.btn-choice'] },
  { id: 'gameplay-away', bare: '1', need: ['.gf-bottomnav', '.event-card', '.btn-choice'] },
  { id: 'play-academy', bare: '1', need: ['.gf-bottomnav', '.event-card', '.btn-choice'] },
  { id: 'play-gk', bare: '1', need: ['.gf-bottomnav', '.event-card', '.btn-choice'] },
  { id: 'gf-play-home', bare: '1', need: ['.gf-hero-name', '.gf-next', '.gf-bottomnav', '.btn-primary'] },
  { id: 'gf-play-home-euro', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.gf-context-euro'] },
  { id: 'gf-play-home-offer', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.gf-context-urgent'] },
  { id: 'gf-play-home-gk', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.pr-art'] },
  { id: 'gf-play-home-red', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.pr-art'] },
  { id: 'gf-play-home-yellow', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.pr-art'] },
  { id: 'gf-play-signing', bare: '1', need: ['.gf-moment-title', '.gf-btn-primary', '.pr-art'] },
  { id: 'gf-play-home-youth', bare: '1', need: ['.gf-hero-name', '.gf-bottomnav', '.pr-art'] },
  { id: 'gf-play-championship', bare: '1', need: ['.gf-moment-title', '.gf-btn-primary'] },
  { id: 'gf-home', bare: 'shell', need: ['.gf-hero-name', '.gf-next'] },
  { id: 'gf-matchday', bare: '1', need: ['.gf-board-num', '.gf-md-controls', '.gf-btn-primary'] },
  { id: 'gf-matchday-live', bare: '1', need: ['.gf-board-num', '.gf-md-now', '.gf-btn-primary'] },
  { id: 'gf-matchday-half', bare: '1', need: ['.gf-board-num', '.gf-md-now', '.gf-btn-primary'] },
  { id: 'gf-matchday-ft', bare: '1', need: ['.gf-board-num', '.gf-md-ft', '.gf-btn-primary'] },
  /*
   * `gf-decision` is deliberately NOT audited for height: it is the component on its own, with
   * no topbar and no nav around it, so its document height is the harness's rather than the
   * game's. `gf-play-decision` below is the real screen and is measured instead. The component
   * scene stays in the gallery for screenshots.
   */
  /*
   * v0.9.5: the decision is choice cards, so the audit asks for choice cards. `.dc-choice-quiet`
   * is the STAY card - the second one - which is what actually catches the bottom card being
   * clipped by the nav. Asking only for `.dc-choice` would pass on a screen showing one card.
   */
  { id: 'gf-play-decision', bare: '1', need: ['.dc-title', '.dc-choice', '.dc-choice-quiet', '.gf-dec-pager', '.gf-bottomnav'] },
  { id: 'gf-moment', bare: 'shell', need: ['.gf-moment-title', '.gf-btn-primary'] },
  { id: 'gf-moment-uefa', bare: '1', need: ['.gf-moment-title', '.gf-btn-primary', '.gf-moment-player'] },
  { id: 'gf-moment-relegation', bare: '1', need: ['.gf-moment-title', '.gf-btn-primary', '.gf-moment-player'] },
  { id: 'gf-moment-debut', bare: '1', need: ['.gf-moment-title', '.gf-btn-primary', '.gf-moment-player'] },
];

/** Safe area / rounding slack. A phone's own inset is legitimately a few pixels. */
const TOLERANCE = 24;

function run(scene, width, height) {
  const need = scene.need.join(';');
  const url =
    `${baseUrl}?gallery=1&only=${scene.id}&w=${width}&bare=${scene.bare}&probe=1` +
    `&need=${encodeURIComponent(need)}`;
  return new Promise((resolve) => {
    const p = spawn(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${Math.max(width, CHROME_MIN_W)},${height + CHROME_H_DELTA}`,
      '--virtual-time-budget=5000',
      '--dump-dom',
      url,
    ]);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.on('close', () => {
      const m = out.match(/data-probe="([^"]*)"/);
      resolve(m ? m[1] : null);
    });
  });
}

/*
 * Explicit WxH pairs (v0.9.4). Keying the height off the width could not express 360x640 and
 * 360x800 at once, and the brief asks for both - a short Android and a tall one are different
 * tests of the same layout.
 */
const VIEWPORTS = (process.argv[3] ?? '390x844')
  .split(',')
  .map((spec) => (spec.includes('x') ? spec : `${spec}x844`))
  .map((spec) => spec.split('x').map(Number));

let failures = 0;
for (const [width, height] of VIEWPORTS) {
  console.log(`\n=== ${width}x${height} ===`);
  for (const scene of SCENES) {
    const probe = await run(scene, width, height);
    if (!probe) {
      console.log(`  ${scene.id.padEnd(22)} NO PROBE`);
      failures += 1;
      continue;
    }
    const vh = Number(/vh=(\d+)/.exec(probe)?.[1] ?? 0);
    const sh = Number(/sh=(\d+)/.exec(probe)?.[1] ?? 0);
    const over = sh - vh;
    const cut = probe.match(/[^ ]+=(?:CUT\([^)]*\)|NONE|HIDDEN)/g) ?? [];
    const scroll = over > TOLERANCE;
    const bad = scroll || cut.length > 0;
    if (bad) failures += 1;
    console.log(
      `  ${bad ? 'FAIL' : 'ok  '} ${scene.id.padEnd(22)} vh=${vh} sh=${sh} over=${over}` +
        (cut.length ? `  ${cut.join(' ')}` : ''),
    );
    if (vh !== height) console.log(`       (viewport calibration off: asked ${height}, got ${vh})`);
  }
}
console.log(`\n${failures === 0 ? 'ALL CLEAR' : `${failures} scene/width combinations need work`}`);

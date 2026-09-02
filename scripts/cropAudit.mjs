/*
 * Player-crop stability audit (v0.9.6.1).
 *
 * Answers the one question a screenshot cannot: does the player's framing CHANGE between the
 * moment the screen appears and the moment it settles.
 *
 * The playtest report was "the player is almost full-body for an instant, then jumps to his
 * intended crop". The viewport, contrast and touch audits all passed the affected screens,
 * because every one of them measures a single settled frame. This one drives `?crop=1`, which
 * samples the art's bounding rect every frame across the whole entrance, and fails if the
 * width, height or left edge moved by more than a rounding pixel.
 *
 * Usage:
 *   node scripts/cropAudit.mjs <baseUrl> [<width>x<height>,...]
 */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CHROME_H_DELTA = 95;
const CHROME_MIN_W = 520;

const baseUrl = process.argv[2] ?? 'http://localhost:5199/';

/* Every scene that draws a player, across all four art surfaces and both kit states. */
const SCENES = [
  'gf-play-home',
  'gf-play-home-euro',
  'gf-play-home-gk',
  'gf-play-home-teen',
  'gf-play-home-youth',
  'gf-play-home-red',
  'gf-play-signing',
  'gf-matchday',
  'gf-matchday-live',
  'gf-matchday-ft',
  'gf-moment-uefa',
  'gf-moment-relegation',
  'gf-moment-debut',
  'gf-play-championship',
  /* v0.9.6.2: the decision screens and the composed trophy moment, which the brief names. */
  'gf-play-decision',
  'decision-mandatory',
  'decision-no-agent',
  'youth-fork',
  'retirement-decision',
  'gf-moment',
  'gf-hero-gk',
  'gf-hero-youth-gk',
];

/*
 * 390x844 is where the jump was reported and is the most common phone; 320x568 is the narrowest
 * layout the game supports and 430x932 the widest, and the crop is expressed in percentages, so
 * all three resolve to different geometry.
 */
const VIEWPORTS = (process.argv[3] ?? '390x844,320x568,430x932')
  .split(',')
  .map((spec) => spec.split('x').map(Number));

function run(scene, width, height) {
  const url = `${baseUrl}?gallery=1&only=${scene}&w=${width}&bare=1&crop=1`;
  return new Promise((resolve) => {
    const p = spawn(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${Math.max(width, CHROME_MIN_W)},${height + CHROME_H_DELTA}`,
      '--virtual-time-budget=24000',
      '--dump-dom',
      url,
    ]);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.on('close', () => {
      const m = out.match(/<script id="crop-result"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) return resolve(null);
      try {
        resolve(JSON.parse(m[1]));
      } catch {
        resolve(null);
      }
    });
  });
}

let failures = 0;
let measured = 0;
for (const [width, height] of VIEWPORTS) {
  console.log(`\n=== ${width}x${height} ===`);
  for (const scene of SCENES) {
    const rows = await run(scene, width, height);
    if (rows === null) {
      console.log(`  ${scene.padEnd(24)} NO PROBE`);
      failures += 1;
      continue;
    }
    if (rows.length === 0) {
      console.log(`  ${scene.padEnd(24)} no player art`);
      continue;
    }
    const jumped = rows.filter((r) => r.jumped);
    /*
     * Reported, not silently passed. See the note on `unwatched` below.
     */
    /*
     * An element with no animation attached cannot be proved stable BY this probe - the seek has
     * nothing to seek. Reported rather than counted as a pass.
     */
    const unwatched = rows.filter((r) => r.animations === 0);
    measured += rows.length;
    if (jumped.length) failures += 1;
    /* Everything measured, so a non-jumping element is visible as evidence rather than absent. */
    if (process.env.CROP_VERBOSE) {
      for (const r of rows) {
        console.log(
          `       ${r.jumped ? 'JUMP' : '    '} ${r.sel} anim=${r.animations}(${r.animationNames}) dur=${r.durationMs} ` +
            `w:${r.minW}->${r.maxW} tf=[${r.transforms}]`,
        );
      }
    }
    const detail = jumped
      .map((r) => `${r.sel} w:${r.minW}->${r.maxW} h:${r.minH}->${r.maxH} x:${r.minX}->${r.maxX}`)
      .join('  ');
    console.log(
      `  ${jumped.length ? 'FAIL' : 'ok  '} ${scene.padEnd(24)}` +
        ` art=${rows.length} anim=${rows.reduce((n, r) => n + r.animations, 0)}` +
        (detail ? `  ${detail}` : '') +
        (unwatched.length ? `  (no animation: ${unwatched.map((r) => r.sel).join(',')})` : ''),
    );
  }
}
console.log(`\n${measured} art elements measured`);
console.log(failures === 0 ? 'NO CROP JUMP' : `${failures} scene/viewport combinations jump`);
process.exit(failures === 0 ? 0 : 1);

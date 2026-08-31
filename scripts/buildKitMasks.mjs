/*
 * Garment mask builder (v0.9.4, Phase 2).
 *
 * v0.9.4 puts the player in his club's colours. Doing that without recolouring his face means
 * knowing, per pixel, which parts of each character image are KIT - and the art pack ships no such
 * information. This builds it, once, from the artwork that already exists. No image is regenerated
 * and no external service is called.
 *
 * ## Why a browser
 *
 * There is no image library in this project's toolchain - no PIL, no numpy, no sharp - but there
 * IS a headless Chrome, which decodes WebP and gives pixel access through a canvas. So the whole
 * thing runs inside a file:// page (with --allow-file-access-from-files, or the canvas is tainted
 * and getImageData throws), and the finished mask comes back as a chunked PNG data URL in the DOM.
 *
 * ## Why the first attempt failed, and what replaced it
 *
 * The first version classified purely by colour: skin is a warm ramp (r > g > b at moderate
 * saturation), so everything opaque and not-warm was kit. That is wrong, and the preview said so
 * immediately - the player had green hair and green knees.
 *
 * The reason is the art's own lighting. Every figure carries neon pink and blue rim light, and it
 * falls on SKIN as much as on fabric: a magenta-lit knee reads (77,28,56) and a magenta-lit shirt
 * reads (136,50,205). No colour rule can separate them, because they are the same light.
 *
 * So geometry decides WHERE the kit is and colour only decides what to protect inside it:
 *
 *   include   a torso polygon plus one capsule per sleeve. Capsules follow limbs the way polygons
 *             do not - a bent arm is a segment with a radius, not an eight-point outline.
 *   exclude   the things inside that region which are not kit: a football, a bare forearm, a fist,
 *             a goalkeeper's glove.
 *   skin      still subtracted inside the region, as a safety net for the neck and a hand on a hip.
 *             It can only ever remove pixels, so a wide net is free.
 *
 * Then an asymmetric open - erode 3, dilate 2 - deletes structures thinner than the kernel (rim
 * lights, eyes, teeth) and gives the torso back its edge, and a final intersection with the
 * character's own alpha means dilation can never escape the silhouette.
 *
 * ## Coordinates
 *
 * Percentages of the image box, read off a 5% grid overlay rendered from the artwork itself
 * (scripts/kitMaskGrid.html). Capsule and ellipse radii are percentages of WIDTH; the y radius is
 * scaled by the image's aspect so a circle stays a circle.
 *
 * Usage:
 *   node scripts/buildKitMasks.mjs [--only=adult/outfield-hero] [--debug]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = resolve(import.meta.dirname, '..');
const ART = `${ROOT}/public/assets/gamefeel/players`.replace(/\\/g, '/');

/** The mask is a mask: half resolution is plenty, and the downscale feathers the edge for free. */
const MASK_W = 512;
const MASK_H = 768;

const poly = (points) => ({ kind: 'poly', points });
const cap = (x0, y0, x1, y1, r) => ({ kind: 'capsule', x0, y0, x1, y1, r });
const ell = (cx, cy, rx, ry) => ({ kind: 'ellipse', cx, cy, rx, ry });
/** A true circle, in width-percent, with the y radius corrected for the image's aspect. */
const circ = (cx, cy, r) => ell(cx, cy, r, (r * MASK_W) / MASK_H);

const POSES = [
  {
    id: 'adult/outfield-hero',
    include: [
      poly([
        [37, 15.5], [42, 15], [47, 21], [52, 15], [57, 15], [63, 16.5], [70, 19.5], [73.5, 26],
        [73, 31.5], [67.5, 33], [68, 38.5], [66.5, 46.5], [36, 46], [33.5, 38], [33, 32.5],
        [28.5, 31.5], [28, 24], [30.5, 17.5],
      ]),
    ],
    // The ball he holds, and the forearm that comes off the sleeve onto his hip.
    exclude: [circ(29, 39.5, 9), cap(69, 33, 56, 41, 5)],
  },
  {
    id: 'adult/outfield-celebration',
    include: [
      poly([
        [40, 13.5], [50, 17], [56, 24], [63, 20], [71, 23], [77, 29], [75, 37], [70, 41.5],
        [69, 51], [37, 50], [31, 42], [27, 31],
      ]),
      cap(33, 19, 24, 22, 6),
      cap(74, 27, 78, 40, 6),
    ],
    // Both fists, and the bare forearm of the raised arm.
    exclude: [circ(22, 8, 6), cap(24, 20, 26, 14, 5), circ(77, 48, 5)],
  },
  {
    id: 'adult/goalkeeper-hero',
    include: [
      poly([[40, 15], [49, 13.5], [58, 15], [69, 16], [68, 45.5], [33, 45], [32, 16]]),
      cap(33, 18, 17, 42, 7),
      cap(68, 18, 84, 42, 7),
    ],
    // The gloves start where the cuffs end.
    exclude: [circ(13, 51, 9), circ(88, 51, 9)],
  },
  {
    id: 'adult/goalkeeper-save',
    include: [
      poly([[50, 27], [58, 28], [64, 32], [66, 40], [63, 47], [52, 50], [45, 46], [44, 36], [46, 30]]),
      cap(62, 31, 75, 19, 6),
      cap(46, 34, 21, 44, 6.5),
    ],
    exclude: [circ(91, 8, 10), circ(80, 14, 6), circ(12, 47, 7)],
  },
  {
    id: 'teen/outfield-hero',
    include: [
      poly([
        [36, 13], [42, 13.5], [48, 19], [54, 13.5], [61, 13], [68, 16], [70.5, 22], [70, 28.5],
        [64, 29.5], [65, 36], [65.5, 46.5], [36.5, 46], [36, 36], [37, 29.5], [31.5, 28.5],
        [31, 21], [33, 15],
      ]),
    ],
    // Tightened after inspection: the first radii ate the shirt's right-hand panel and a strip
    // of chest beside the ball.
    exclude: [ell(29.5, 42, 7.5, 6), cap(67.5, 31, 58, 42, 3.8)],
  },
  {
    id: 'teen/outfield-celebration',
    include: [
      poly([[45, 14], [58, 19], [66, 14], [71, 17], [70, 30], [69, 47], [40, 48], [38, 30], [42, 17]]),
      cap(42, 20, 31, 32, 6),
      cap(71, 19, 86, 27, 6),
      cap(86, 27, 81, 18, 5.5),
    ],
    exclude: [circ(28, 36, 4.5), circ(82, 11, 4.5)],
  },
  {
    id: 'teen/goalkeeper-ready',
    include: [
      poly([[40, 16], [50, 22], [58, 16], [67, 17], [66, 47], [37, 47], [36, 17]]),
      cap(37, 20, 24, 40, 6),
      cap(66, 20, 79, 40, 6),
    ],
    exclude: [circ(19, 46, 7), circ(84, 46, 7)],
  },
  {
    id: 'youth/outfield-hero',
    include: [
      poly([
        [36, 14], [43, 14], [49, 21], [56, 14], [61, 14], [68, 17], [68.5, 23], [68, 29.5],
        [64, 31], [65, 38], [65.5, 47], [36.5, 46.5], [36, 38], [37, 30], [32, 29], [31.5, 22],
        [33, 16],
      ]),
    ],
    exclude: [ell(29.5, 41, 7.5, 6), cap(67.5, 31, 58, 42, 3.8)],
  },
  {
    id: 'youth/outfield-celebration',
    include: [
      poly([
        [28, 17], [35, 15], [41, 20], [47, 15], [53, 17], [62, 20], [64, 29], [59, 31], [61, 40],
        [62, 49], [33, 48], [31, 40], [35, 30], [27, 29], [26, 21],
      ]),
    ],
    exclude: [circ(22, 21, 4.5), circ(70, 32, 4.5)],
  },
  {
    id: 'youth/goalkeeper-ready',
    include: [
      poly([[42, 15], [52, 19], [60, 15], [67, 17], [66, 47], [39, 47], [38, 17]]),
      cap(39, 21, 26, 40, 6.5),
      cap(66, 21, 80, 40, 6.5),
    ],
    exclude: [circ(20, 46, 7), circ(86, 46, 7)],
  },
];

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const debug = process.argv.includes('--debug');

const PAGE = (src, include, exclude) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>
const INCLUDE = ${JSON.stringify(include)};
const EXCLUDE = ${JSON.stringify(exclude)};
const MASK_W = ${MASK_W}, MASK_H = ${MASK_H};

function isSkin(r, g, b) {
  /* A warm monotonic ramp of moderate saturation: face, neck, arms, and dark hair. */
  if (!(r > g && g > b)) return false;
  const ramp = r - b;
  if (ramp < 18 || ramp > 150) return false;
  return r === 0 ? false : (r - b) / r < 0.62;
}

/** Rasterise a shape into a Uint8 mask. Percent coordinates; the caller supplies the canvas size. */
function stamp(mask, w, h, shape, value) {
  const px = (v) => (v * w) / 100;
  const py = (v) => (v * h) / 100;
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    mask[y * w + x] = value;
  };
  if (shape.kind === 'poly') {
    const pts = shape.points.map(([x, y]) => [px(x), py(y)]);
    let minY = h, maxY = 0;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y += 1) {
      const xs = [];
      for (let i = 0; i < pts.length; i += 1) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.floor(xs[i]); x <= Math.ceil(xs[i + 1]); x += 1) set(x, y);
      }
    }
    return;
  }
  if (shape.kind === 'ellipse') {
    const cx = px(shape.cx), cy = py(shape.cy), rx = px(shape.rx), ry = py(shape.ry);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y);
      }
    }
    return;
  }
  /* Capsule: every pixel within r of the segment. r is a width percentage. */
  const ax = px(shape.x0), ay = py(shape.y0), bx = px(shape.x1), by = py(shape.y1);
  const r = px(shape.r);
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const x0 = Math.floor(Math.min(ax, bx) - r), x1 = Math.ceil(Math.max(ax, bx) + r);
  const y0 = Math.floor(Math.min(ay, by) - r), y1 = Math.ceil(Math.max(ay, by) + r);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      let t = ((x - ax) * vx + (y - ay) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + t * vx), dy = y - (ay + t * vy);
      if (dx * dx + dy * dy <= r * r) set(x, y);
    }
  }
}

/** Separable box morphology, so a radius costs two passes rather than r squared. */
function morph(mask, w, h, radius, mode) {
  const pick = mode === 'erode' ? Math.min : Math.max;
  const pass = (src, horizontal) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let v = mode === 'erode' ? 255 : 0;
        for (let d = -radius; d <= radius; d += 1) {
          const xx = horizontal ? x + d : x;
          const yy = horizontal ? y : y + d;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) { if (mode === 'erode') v = 0; continue; }
          v = pick(v, src[yy * w + xx]);
        }
        out[y * w + x] = v;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

const img = new Image();
img.onerror = () => { document.documentElement.dataset.err = 'load failed'; };
img.onload = () => {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;

  /* 1. geometry decides where the kit is */
  const region = new Uint8Array(w * h);
  for (const shape of INCLUDE) stamp(region, w, h, shape, 255);
  for (const shape of EXCLUDE) stamp(region, w, h, shape, 0);

  /* 2. inside it, opaque and not skin */
  const alpha = new Uint8Array(w * h);
  let kit = new Uint8Array(w * h);
  let inRegion = 0, skinCount = 0, kitCount = 0;
  for (let i = 0, p = 0; i < w * h; i += 1, p += 4) {
    alpha[i] = px[p + 3];
    if (!region[i]) continue;
    inRegion += 1;
    if (px[p + 3] < 200) continue;
    if (isSkin(px[p], px[p + 1], px[p + 2])) { skinCount += 1; continue; }
    kit[i] = 255;
    kitCount += 1;
  }

  /* 3. open: delete rim lights and eyes, then give the torso its edge back */
  kit = morph(kit, w, h, 3, 'erode');
  kit = morph(kit, w, h, 2, 'dilate');
  for (let i = 0; i < w * h; i += 1) if (alpha[i] < 200 || !region[i]) kit[i] = 0;

  const mc = document.createElement('canvas');
  mc.width = w; mc.height = h;
  const mg = mc.getContext('2d');
  const out = mg.createImageData(w, h);
  for (let i = 0, p = 0; i < w * h; i += 1, p += 4) {
    out.data[p] = 255; out.data[p + 1] = 255; out.data[p + 2] = 255;
    out.data[p + 3] = kit[i];
  }
  mg.putImageData(out, 0, 0);

  const sc = document.createElement('canvas');
  sc.width = MASK_W; sc.height = MASK_H;
  const sg = sc.getContext('2d');
  sg.imageSmoothingEnabled = true;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(mc, 0, 0, MASK_W, MASK_H);

  document.documentElement.dataset.stats =
    'size=' + w + 'x' + h + ' region=' + inRegion + ' skin=' + skinCount + ' kit=' + kitCount;
  const url = sc.toDataURL('image/png');
  const CHUNK = 40000;
  const n = Math.ceil(url.length / CHUNK);
  document.documentElement.dataset.chunks = String(n);
  for (let i = 0; i < n; i += 1) {
    const d = document.createElement('div');
    d.setAttribute('data-c' + i, url.slice(i * CHUNK, (i + 1) * CHUNK));
    document.body.appendChild(d);
  }
};
img.src = ${JSON.stringify(src)};
</script>`;

function run(html) {
  const page = `${(process.env.TEMP ?? '/tmp').replace(/\\/g, '/')}/kitmask.html`;
  writeFileSync(page, html, 'utf8');
  return new Promise((res) => {
    const p = spawn(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--allow-file-access-from-files',
      '--virtual-time-budget=30000',
      '--dump-dom',
      `file:///${page}`,
    ]);
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.on('close', () => res(out));
  });
}

let failures = 0;
for (const pose of POSES) {
  if (only && pose.id !== only) continue;
  const dom = await run(PAGE(`file:///${ART}/${pose.id}.webp`, pose.include, pose.exclude));
  const err = /data-err="([^"]*)"/.exec(dom)?.[1];
  const chunks = Number(/data-chunks="(\d+)"/.exec(dom)?.[1] ?? 0);
  if (err || !chunks) {
    console.log(`${pose.id.padEnd(30)} ${err ? `ERROR ${err}` : 'NO OUTPUT'}`);
    failures += 1;
    continue;
  }
  let url = '';
  let missing = false;
  for (let i = 0; i < chunks; i += 1) {
    const m = new RegExp(`data-c${i}="([^"]*)"`).exec(dom);
    if (!m) {
      console.log(`${pose.id.padEnd(30)} MISSING CHUNK ${i}/${chunks}`);
      missing = true;
      break;
    }
    url += m[1];
  }
  if (missing) {
    failures += 1;
    continue;
  }
  const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  mkdirSync(`${ART}/${pose.id.split('/')[0]}`, { recursive: true });
  writeFileSync(`${ART}/${pose.id}-kit.png`, bytes);
  const stats = /data-stats="([^"]*)"/.exec(dom)?.[1] ?? '';
  console.log(
    `${pose.id.padEnd(30)} ${(bytes.length / 1024).toFixed(1).padStart(7)} kB   ${debug ? stats : ''}`,
  );
}
console.log(failures === 0 ? 'all masks written' : `${failures} failed`);

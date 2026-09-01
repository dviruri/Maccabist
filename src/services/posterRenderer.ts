import { getClubCrest, clubVisual } from '../data/clubVisuals';
import { HONOR_LABELS } from '../game/honorsEngine';
import { trophyIconKind } from '../components/honorIcons';
import { resolvePlayerArt } from '../ui/playerArt';
import {
  GARMENT_LAYERS,
  GARMENT_SHADE_FILTER,
  resolvePlayerKit,
  type KitPalette,
} from '../ui/kit';
import type { ArchivedCareer, IndividualHonorType } from '../types';

/**
 * The shareable career poster (v0.7, restyled v0.9.1).
 *
 * v0.9.1 brings it into the game-feel language without touching its data: the player's own
 * character art (age+position resolved, the retirement age and position), a stadium wash behind
 * the identity, the two axes as glowing plates, and European silverware leading the trophy row.
 * Same archive in, same 9:16 / 1:1 out, no new facts.
 *
 * Drawn on a canvas, in the app, from the archived snapshot - no server, no html2canvas, no
 * dependency. Two formats: 9:16 for a story, 1:1 for a square post. The design is Maccabist's
 * own: the green/black identity, gold for silverware, the club route told in crests.
 *
 * Position-aware (H3): a keeper's poster leads with clean sheets, a defender's does not
 * apologise for his goal count. Trophy semantics hold here too (H2/E1): the league-title count
 * is drawn next to a PLATE mark, the cup count next to a CUP - the same language as the
 * cabinet, in miniature.
 *
 * Crests draw from the real asset when it loads and fall back to the same generated
 * shield-and-initials the app uses, so the poster can never contain a broken image.
 */

export type PosterFormat = 'story' | 'square';

const SIZES: Record<PosterFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

const INK = {
  bg0: '#070907',
  bg1: '#0e1a10',
  green: '#0fa64a',
  greenBright: '#29d96a',
  white: '#f2f6f3',
  soft: '#9fb0a5',
  gold: '#ffc94a',
  goldDeep: '#c99a1e',
  line: '#232c26',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The crest, or the generated shield when the asset is missing - never a hole. */
async function drawCrest(
  ctx: CanvasRenderingContext2D,
  clubId: string,
  clubName: string,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  const asset = getClubCrest(clubId);
  if (asset) {
    const img = await loadImage(asset);
    if (img) {
      const ratio = Math.min(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
      return;
    }
  }
  const visual = clubVisual(clubId, clubName);
  ctx.save();
  ctx.beginPath();
  const r = size / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size, y + size * 0.28);
  ctx.lineTo(x + size * 0.86, y + size * 0.82);
  ctx.lineTo(x + r, y + size);
  ctx.lineTo(x + size * 0.14, y + size * 0.82);
  ctx.lineTo(x, y + size * 0.28);
  ctx.closePath();
  ctx.fillStyle = visual.primary;
  ctx.fill();
  ctx.strokeStyle = visual.secondary;
  ctx.lineWidth = size * 0.06;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${size * 0.34}px "Heebo", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(visual.initials, x + r, y + size * 0.54);
  ctx.restore();
}

/** The plate/cup marks, in miniature. Same semantics as the SVG system. */
function drawTrophyMark(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number): void {
  ctx.save();
  if (kind === 'plate') {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = INK.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.26, 0, Math.PI * 2);
    ctx.strokeStyle = INK.goldDeep;
    ctx.lineWidth = s * 0.06;
    ctx.stroke();
  } else if (kind === 'cup') {
    ctx.fillStyle = INK.gold;
    ctx.fillRect(x + s * 0.28, y + s * 0.12, s * 0.44, s * 0.4);
    ctx.fillRect(x + s * 0.44, y + s * 0.52, s * 0.12, s * 0.18);
    ctx.fillRect(x + s * 0.3, y + s * 0.7, s * 0.4, s * 0.12);
  } else if (kind === 'ucl') {
    // The European star, in gold, ringed.
    ctx.strokeStyle = INK.gold;
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = INK.gold;
    ctx.beginPath();
    const cxs = x + s / 2;
    const cys = y + s / 2;
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? s * 0.3 : s * 0.13;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cxs + r * Math.cos(a);
      const py = cys + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // promotion: the upward badge, in green.
    ctx.fillStyle = INK.greenBright;
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y + s * 0.1);
    ctx.lineTo(x + s * 0.85, y + s * 0.5);
    ctx.lineTo(x + s * 0.62, y + s * 0.5);
    ctx.lineTo(x + s * 0.62, y + s * 0.85);
    ctx.lineTo(x + s * 0.38, y + s * 0.85);
    ctx.lineTo(x + s * 0.38, y + s * 0.5);
    ctx.lineTo(x + s * 0.15, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The stat lines this position leads with (H3). */
function statLines(archive: ArchivedCareer): [string, string][] {
  const t = archive.totals;
  const lines: [string, string][] = [[String(t.appearances), 'הופעות']];
  if (archive.position === 'GK') {
    lines.push([String(t.cleanSheets), 'שערים נקיים']);
  } else if (archive.position === 'CB' || archive.position === 'FB') {
    lines.push([String(t.seasons), 'עונות'], [String(t.goals + t.assists), 'שערים ובישולים']);
  } else {
    lines.push([String(t.goals), 'שערים'], [String(t.assists), 'בישולים']);
  }
  return lines.slice(0, 3);
}

const POSITION_TEXT: Record<string, string> = {
  GK: 'שוער',
  CB: 'בלם',
  FB: 'מגן',
  CM: 'קשר',
  WG: 'כנף',
  ST: 'חלוץ',
};

export async function renderCareerPoster(
  archive: ArchivedCareer,
  format: PosterFormat,
): Promise<HTMLCanvasElement> {
  const { w, h } = SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const story = format === 'story';
  const cx = w / 2;
  const rtlFont = (weight: number, px: number): string => `${weight} ${px}px "Heebo", "Segoe UI", sans-serif`;

  /* v0.9.1: a stadium wash under the gradient, so the poster starts in a place. */
  const backdrop = await loadImage(`${import.meta.env.BASE_URL}assets/gamefeel/backgrounds/stadium-trophy-ceremony.webp`);

  /* background: black to deep green wash, with a subtle pitch line */
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(6, 9, 7, 0.5)');
  grad.addColorStop(0.45, 'rgba(14, 26, 16, 0.72)');
  grad.addColorStop(0.78, 'rgba(6, 9, 7, 0.55)');
  grad.addColorStop(1, 'rgba(6, 9, 7, 0.75)');
  ctx.fillStyle = INK.bg0;
  ctx.fillRect(0, 0, w, h);
  if (backdrop) {
    // cover-fit, dimmed - it is atmosphere, never the subject
    const scale = Math.max(w / backdrop.width, (h * 0.62) / backdrop.height);
    const bw = backdrop.width * scale;
    const bh = backdrop.height * scale;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.drawImage(backdrop, (w - bw) / 2, 0, bw, bh);
    ctx.restore();
  }
  /*
   * The player, and his kit (v0.9.4).
   *
   * The poster is a canvas, not the DOM, so `PlayerRender`'s CSS compositing is unavailable - but
   * the rule it enforces is not optional here either. The same garment mask and the same club
   * palette are applied with `globalCompositeOperation`, so the shared poster shows the shirt the
   * game shows. A missing mask degrades to the artwork's own kit rather than to a coloured block.
   */
  const artInput = { age: archive.retirementAge, position: archive.position, context: 'hero' as const };
  const resolved = resolvePlayerArt(artInput);
  const art = await loadImage(resolved.src);
  const kitMask = await loadImage(resolved.garmentMask);
  const kit = resolvePlayerKit({
    position: archive.position,
    clubId: archive.finalClubId,
    /*
     * `seed` is optional on the archive: anything written before v0.9.4 has none. An outfield kit
     * does not depend on it at all, and a pre-v0.9.4 goalkeeper simply gets a stable colour of his
     * own rather than the one his live career used - which is the honest degradation, since the
     * number to reproduce it was never stored.
     */
    seed: archive.seed ?? 0,
    season: archive.endSeason,
  });

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(41, 217, 106, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, story ? h * 0.42 : h * 0.4, w * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.direction = 'rtl';

  /* wordmark */
  let y = story ? 130 : 90;
  ctx.fillStyle = INK.green;
  ctx.font = rtlFont(800, story ? 44 : 38);
  ctx.fillText('מכביסט', cx, y);
  ctx.fillStyle = INK.soft;
  ctx.font = rtlFont(400, story ? 26 : 22);
  y += story ? 42 : 34;
  ctx.fillText('מהילדים לאגדה', cx, y);

  /* name + identity */
  y += story ? 130 : 90;
  ctx.fillStyle = INK.white;
  ctx.font = rtlFont(800, story ? 84 : 66);
  ctx.fillText(archive.playerName, cx, y);
  y += story ? 56 : 46;
  ctx.fillStyle = INK.soft;
  ctx.font = rtlFont(400, story ? 32 : 27);
  const years = `${archive.startSeason}–${archive.endSeason}`;
  ctx.fillText(`${POSITION_TEXT[archive.position] ?? archive.position} · ${years}`, cx, y);

  /* the two axes - and only two */
  y += story ? 120 : 84;
  const axisGap = w * 0.24;
  ctx.font = rtlFont(800, story ? 92 : 72);
  ctx.save();
  ctx.shadowColor = 'rgba(41, 217, 106, 0.55)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = INK.greenBright;
  ctx.fillText(String(archive.globalCareer), cx + axisGap, y);
  ctx.shadowColor = 'rgba(255, 201, 74, 0.5)';
  ctx.fillStyle = INK.gold;
  ctx.fillText(String(archive.maccabiLegacy), cx - axisGap, y);
  ctx.restore();
  y += story ? 46 : 40;
  ctx.font = rtlFont(400, story ? 28 : 24);
  ctx.fillStyle = INK.soft;
  ctx.fillText('קריירה עולמית', cx + axisGap, y);
  ctx.fillText('מורשת מכבי', cx - axisGap, y);

  /* club route, in crests */
  const route = archive.clubs.slice(0, 6);
  const crest = story ? 108 : 84;
  const gap = Math.min(story ? 40 : 28, (w - 120 - route.length * crest) / Math.max(1, route.length - 1));
  const routeWidth = route.length * crest + (route.length - 1) * gap;
  y += story ? 110 : 70;
  let x = cx + routeWidth / 2 - crest; // rtl: first club on the right
  for (let i = 0; i < route.length; i += 1) {
    await drawCrest(ctx, route[i]!.clubId, route[i]!.clubName, x, y, crest);
    if (i < route.length - 1) {
      ctx.fillStyle = INK.soft;
      ctx.font = rtlFont(400, crest * 0.34);
      ctx.fillText('←', x - gap / 2 - 2, y + crest * 0.62);
    }
    x -= crest + gap;
  }
  y += crest + (story ? 100 : 66);

  /* silverware counts, with the correct marks */
  const plateCount = archive.trophies.filter((t) => trophyIconKind(t.id) === 'plate').length;
  const cupCount = archive.trophies.filter((t) => trophyIconKind(t.id) === 'cup').length;
  // v0.8: European trophies lead the poster's silverware row - they are the rarest thing on it.
  const uefaCount = archive.trophies.filter((t) => ['ucl', 'uel', 'uecl'].includes(trophyIconKind(t.id))).length;
  const marks: { kind: string; count: number; label: string }[] = [
    { kind: 'ucl', count: uefaCount, label: 'תארים אירופיים' },
    { kind: 'plate', count: plateCount, label: 'אליפויות' },
    { kind: 'cup', count: cupCount, label: 'גביעים' },
    { kind: 'promotion', count: archive.promotions.length, label: 'עליות' },
  ].filter((m) => m.count > 0);
  if (marks.length > 0) {
    const markSize = story ? 64 : 52;
    const cell = w / (marks.length + 1);
    marks.forEach((mark, i) => {
      const mx = w - cell * (i + 1);
      drawTrophyMark(ctx, mark.kind, mx - markSize / 2, y - markSize * 0.7, markSize);
      ctx.fillStyle = INK.white;
      ctx.font = rtlFont(800, story ? 44 : 36);
      ctx.fillText(String(mark.count), mx, y + markSize * 0.62);
      ctx.fillStyle = INK.soft;
      ctx.font = rtlFont(400, story ? 24 : 21);
      ctx.fillText(mark.label, mx, y + markSize * 0.62 + (story ? 34 : 28));
    });
    y += markSize + (story ? 130 : 96);
  }

  /* individual honors, compact */
  const honorCounts = new Map<IndividualHonorType, number>();
  for (const honor of archive.honors) honorCounts.set(honor.type, (honorCounts.get(honor.type) ?? 0) + 1);
  const honorLines = [...honorCounts.entries()].slice(0, 3);
  if (honorLines.length > 0 && (story || marks.length === 0)) {
    ctx.font = rtlFont(600, story ? 30 : 25);
    for (const [type, count] of honorLines) {
      ctx.fillStyle = INK.gold;
      ctx.fillText(`${count > 1 ? `×${count} ` : ''}${HONOR_LABELS[type]}`, cx, y);
      y += story ? 44 : 36;
    }
    y += story ? 40 : 20;
  }

  /* position-aware totals */
  const lines = statLines(archive);
  const cell = w / (lines.length + 1);
  ctx.font = rtlFont(800, story ? 52 : 42);
  lines.forEach((line, i) => {
    const mx = w - cell * (i + 1);
    ctx.fillStyle = INK.white;
    ctx.font = rtlFont(800, story ? 52 : 42);
    ctx.fillText(line[0], mx, y);
    ctx.fillStyle = INK.soft;
    ctx.font = rtlFont(400, story ? 24 : 21);
    ctx.fillText(line[1], mx, y + (story ? 36 : 30));
  });
  y += story ? 120 : 86;

  /* the legacy title closes the written half */
  if (archive.endingTitle) {
    ctx.fillStyle = INK.greenBright;
    ctx.font = rtlFont(800, story ? 44 : 34);
    ctx.fillText(archive.endingTitle, cx, Math.min(y, h - (story ? 90 : 60)));
    y += story ? 40 : 30;
  }

  /*
   * v0.9.1: the player closes the poster, standing in the space the content leaves.
   *
   * Two earlier placements were wrong and the screenshots showed it: inline beside the name he
   * landed on the מורשת מכבי plate, and as a bottom-left depth layer he sat across the stat
   * row. Here he owns the lower band alone - which also fills the dead half the v0.7 layout
   * always had - and a soft floor gradient sits him in the scene instead of pasting him on it.
   */
  if (art) {
    const room = h - y - (story ? 40 : 24);
    if (room > 120) {
      const artH = Math.min(room, h * (story ? 0.42 : 0.34));
      const artW = (art.width / art.height) * artH;
      const ax = cx - artW / 2;
      const ay = h - artH - (story ? 24 : 16);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 46;
      ctx.drawImage(art, ax, ay, artW, artH);
      ctx.restore();
      if (kitMask) drawKit(ctx, art, kitMask, kit, ax, ay, artW, artH);
      // a floor of light under his feet, so he is standing somewhere
      const floor = ctx.createRadialGradient(cx, h - (story ? 30 : 20), 6, cx, h - (story ? 30 : 20), artW * 0.7);
      floor.addColorStop(0, 'rgba(41, 217, 106, 0.22)');
      floor.addColorStop(1, 'rgba(41, 217, 106, 0)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, h - artH * 0.4, w, artH * 0.4);
    }
  }

  return canvas;
}

/** Renders and hands the poster to the user as a PNG download. */
export async function downloadCareerPoster(archive: ArchivedCareer, format: PosterFormat): Promise<void> {
  const canvas = await renderCareerPoster(archive, format);
  const link = document.createElement('a');
  link.download = `maccabist_${archive.playerName}_${format}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * The club kit, composited onto a canvas (v0.9.4).
 *
 * The same three passes as `components/PlayerRender.tsx`, in canvas vocabulary: COLOUR normally,
 * SHADE multiplied through `GARMENT_SHADE_FILTER`, ACCENT screened. Each one is built on its own
 * offscreen canvas and cut to the garment with `destination-in` before it reaches the poster, so
 * the mask keeps the colour off his face here exactly as it does in the game.
 *
 * The opacities and the filter are imported rather than repeated - the poster looking subtly
 * unlike the game because one of two copies was retuned is a bug waiting to happen.
 */
function drawKit(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement,
  mask: HTMLImageElement,
  kit: KitPalette,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const lw = Math.max(1, Math.round(w));
  const lh = Math.max(1, Math.round(h));
  /** A masked layer: draw the fill, keep only the garment, then blend it onto the poster. */
  const paint = (fill: (lc: CanvasRenderingContext2D) => void, blend: GlobalCompositeOperation, alpha: number): void => {
    const layer = document.createElement('canvas');
    layer.width = lw;
    layer.height = lh;
    const lc = layer.getContext('2d');
    if (!lc) return;
    fill(lc);
    /* The mask is a cutter, never a filtered image: whatever `fill` set has to be off by now. */
    lc.filter = 'none';
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(mask, 0, 0, lw, lh);
    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, x, y, w, h);
    ctx.restore();
  };
  /* COLOUR: the club's hue, as the lit gradient the DOM renders - light above, shadow below. */
  paint(
    (lc) => {
      const grad = lc.createLinearGradient(0, 0, 0, lh);
      grad.addColorStop(0, kit.primaryLight);
      grad.addColorStop(0.45, kit.primary);
      grad.addColorStop(1, kit.primaryDark);
      lc.fillStyle = grad;
      lc.fillRect(0, 0, lw, lh);
    },
    'source-over',
    GARMENT_LAYERS.colour,
  );
  /* SHADE: the artwork's folds through the same levels remap the stylesheet applies. */
  paint(
    (lc) => {
      lc.filter = GARMENT_SHADE_FILTER;
      lc.drawImage(art, 0, 0, lw, lh);
    },
    'multiply',
    GARMENT_LAYERS.shade,
  );
  /* ACCENT: the neon trim, back on top. */
  paint((lc) => lc.drawImage(art, 0, 0, lw, lh), 'screen', GARMENT_LAYERS.accent);
}

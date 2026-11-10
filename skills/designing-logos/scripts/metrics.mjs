#!/usr/bin/env node
// Report numbers about a mark; it never judges. Compare directions with them, or check a change.
//
//   node metrics.mjs <mark.svg>... [--constants constants.json] [--json]
//   node metrics.mjs compare <a.png> <b.png> [--json]
//
// ink          mean darkness of the 256 px render on paper, as a share of the canvas
// accent       share of the canvas in colors other than ink and paper
// complexity   gzip bytes of the SVG source and PNG bytes of the 256 render (compressed size tracks
//              perceived visual complexity), plus element and vertex counts
// asymmetry    left-right and top-bottom difference of the darkness map, as a share of the ink
// balance      offset of the ink's center of mass from the canvas center, as a share of the size
// small        for the 16 and 32 px renders (or their own drawings from constants.ladder):
//              layout = similarity to the 512 render shrunk to that size, both slightly blurred;
//              crisp = share of pixels that are one palette color, not a blend. A scaled master keeps the
//              layout but turns thin details into gray (low crisp); a redraw should keep both high.
// compare      per-pixel difference of two PNGs over white: mean and max (0-255) and the share of
//              pixels that differ by more than 32
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvg } from './lib/svg.mjs';
import { hexToOklab, rgbToOklab, deltaE } from './lib/color.mjs';
import { loadSharp, svgToPng, rgba, darkness, mean } from './lib/raster.mjs';
import { rolesFor } from './render.mjs';

const pct = (v) => +(100 * v).toFixed(1);

export async function measureSvg(svgPath, C = null, constantsDir = '.') {
  const text = readFileSync(svgPath, 'utf8');
  const svg = parseSvg(text);
  const r = rolesFor(text, C);
  const S = 256;
  const png256 = await svgToPng(text, S, S, r.paper);
  const img = await rgba(png256);
  const D = darkness(img, r.paper, r.ink);
  const ink = mean(D);
  // accent share: pixels nearer an accent color than to ink or paper
  const labs = { ink: hexToOklab(r.ink), paper: hexToOklab(r.paper), others: r.others.map(hexToOklab) };
  let accentPx = 0;
  if (labs.others.length) for (let i = 0; i < S * S; i++) {
    const p = rgbToOklab([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]);
    const dA = Math.min(...labs.others.map((o) => deltaE(p, o)));
    if (dA < deltaE(p, labs.ink) && dA < deltaE(p, labs.paper) && dA < 0.08) accentPx++;
  }
  // symmetry and balance
  let lr = 0, tb = 0, mx = 0, my = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = D[y * S + x];
    lr += Math.abs(d - D[y * S + (S - 1 - x)]);
    tb += Math.abs(d - D[(S - 1 - y) * S + x]);
    mx += d * (x + 0.5); my += d * (y + 0.5);
  }
  const total = ink * S * S || 1;
  // small sizes against the shrunk master
  const ladder = Object.fromEntries(Object.entries(C?.ladder || {}).filter(([k]) => k !== 'why').map(([px, f]) => [Number(px), readFileSync(join(constantsDir, f), 'utf8')]));
  const big = await svgToPng(text, 512, 512, r.paper);
  const small = {};
  // 3x3 binomial blur: compares layout, so a crisp redraw is not punished for lacking gray antialiasing
  const soften = (m, n) => { const o = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, w = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; const k = (2 - Math.abs(i)) * (2 - Math.abs(j)); s += m[yy * n + xx] * k; w += k; } o[y * n + x] = s / w; } return o; };
  for (const px of [16, 32]) {
    const own = await rgba(await svgToPng(ladder[px] || text, px, px, r.paper));
    const ref = await rgba(big, { width: px, height: px });
    const a = darkness(own, r.paper, r.ink), b = darkness(ref, r.paper, r.ink);
    const sa = soften(a, px), sb = soften(b, px);
    let diff = 0; for (let k = 0; k < sa.length; k++) diff += Math.abs(sa[k] - sb[k]);
    // crisp: the pixel is one of the palette colors, not a blend of two
    const pal = [labs.ink, labs.paper, ...labs.others];
    let crispPx = 0;
    for (let k = 0; k < px * px; k++) { const p = rgbToOklab([own.data[k * 4], own.data[k * 4 + 1], own.data[k * 4 + 2]]); if (Math.min(...pal.map((q) => deltaE(p, q))) < 0.04) crispPx++; }
    const crisp = crispPx / (px * px);
    small[px] = { layout: pct(1 - diff / a.length), crisp: pct(crisp), source: ladder[px] ? 'own drawing' : 'scaled master' };
  }
  return {
    file: svgPath,
    ink: pct(ink),
    accent: pct(accentPx / (S * S)),
    complexity: { svgGzipBytes: gzipSync(Buffer.from(text)).length, png256Bytes: png256.length, elements: svg.elements.filter((e) => e.role === 'drawn').length, vertices: svg.elements.reduce((s, e) => s + (e.points?.length || 0), 0) },
    asymmetry: { leftRight: pct(lr / 2 / total), topBottom: pct(tb / 2 / total) },
    balance: { dx: pct(mx / total / S - 0.5), dy: pct(my / total / S - 0.5) },
    small,
  };
}

export async function comparePng(a, b) {
  const A = await rgba(a, { background: '#ffffff' });
  const sharp = await loadSharp();
  const meta = await sharp(b).metadata();
  const B = await rgba(b, { background: '#ffffff', ...(meta.width !== A.width || meta.height !== A.height ? { width: A.width, height: A.height } : {}) });
  let sum = 0, max = 0, big = 0;
  for (let i = 0; i < A.width * A.height; i++) {
    const d = Math.max(Math.abs(A.data[i * 4] - B.data[i * 4]), Math.abs(A.data[i * 4 + 1] - B.data[i * 4 + 1]), Math.abs(A.data[i * 4 + 2] - B.data[i * 4 + 2]));
    sum += d; if (d > max) max = d; if (d > 32) big++;
  }
  const n = A.width * A.height, meanDiff = +(sum / n).toFixed(2), share = pct(big / n);
  return { a, b, size: `${A.width}x${A.height}`, resized: meta.width !== A.width, meanDiff, maxDiff: max, differingPixels: share, verdict: meanDiff < 2 && share < 1 ? 'same' : meanDiff < 8 && share < 5 ? 'close (antialiasing)' : 'different' };
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const i = args.indexOf('--constants');
  const cpath = i >= 0 ? args[i + 1] : null;
  const files = args.filter((a, k) => !a.startsWith('--') && args[k - 1] !== '--constants');
  try {
    if (files[0] === 'compare') {
      if (files.length < 3) throw new Error('usage: node metrics.mjs compare <a.png> <b.png>');
      const res = await comparePng(files[1], files[2]);
      console.log(json ? JSON.stringify(res, null, 2) : `${res.verdict}: mean ${res.meanDiff}, max ${res.maxDiff}, ${res.differingPixels}% of pixels differ by more than 32 (${res.size}${res.resized ? ', second image resized' : ''})`);
    } else {
      if (!files.length) throw new Error('usage: node metrics.mjs <mark.svg>... [--constants constants.json] [--json] | compare <a.png> <b.png>');
      const C = cpath ? JSON.parse(readFileSync(cpath, 'utf8')) : null;
      const out = [];
      for (const f of files) out.push(await measureSvg(f, C, cpath ? dirname(resolve(cpath)) : '.'));
      if (json) console.log(JSON.stringify(out, null, 2));
      else for (const m of out) console.log(`${m.file}
  ink ${m.ink}% of the canvas, accent ${m.accent}%
  complexity: SVG ${m.complexity.svgGzipBytes} B gzip, PNG 256 ${m.complexity.png256Bytes} B, ${m.complexity.elements} drawn elements, ${m.complexity.vertices} vertices
  asymmetry: left-right ${m.asymmetry.leftRight}%, top-bottom ${m.asymmetry.topBottom}% of the ink
  balance: center of mass off center by ${m.balance.dx}% across, ${m.balance.dy}% down
  small sizes (${m.small[16].source}): 16 px layout ${m.small[16].layout}%, crisp ${m.small[16].crisp}%; 32 px layout ${m.small[32].layout}%, crisp ${m.small[32].crisp}%`);
    }
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

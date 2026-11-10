#!/usr/bin/env node
// Measure features on a photo instead of guessing coordinates.
//
//   node measure.mjs grid <photo> --out <overlay.png> [--crop x0,y0,x1,y1] [--step <px>] [--width 1200]
//       Draws a labeled coordinate grid in photo pixels. Read the overlay, note each feature point,
//       then crop into a detail with --crop for points that need more precision.
//   node measure.mjs points <features.json> [--out <annotated.png>]
//       Computes the measures listed in features.json from its points and writes them back under
//       "measured". With --out, draws the points on the photo so you can see they sit on the features.
//   node measure.mjs cells <image> --frame x0,y0,x1,y1 --grid <n> [--k 6] [--out <map.txt>]
//       Maps a framed area onto an n x n cell grid; each cell takes its majority color cluster.
//       Use it to read a reference drawing or abstraction cell by cell.
//
// features.json (only the parts this script reads):
//   "source": "source/photo.jpg",                       relative to features.json
//   "points": { "eyeL": [1520, 980], "eyeR": [2210, 1010], "chin": [1880, 2250] },
//   "measures": [
//     { "name": "eye tilt", "angle": ["eyeL", "eyeR"] },                     degrees above horizontal
//     { "name": "eye span / face height", "ratio": [["eyeL", "eyeR"], ["eyeL", "chin"]] },
//     { "name": "nose off the eye axis", "offset": { "point": "nose", "from": ["eyeL", "eyeR"] } },
//     { "name": "ear length", "distance": ["earTip", "earBase"] } ]
// An offset is the point's position relative to the midpoint of the pair, in units of the pair's
// length: "along" runs from the first point toward the second, "across" is perpendicular (positive
// below the line in image coordinates).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './lib/raster.mjs';
import { oklabToHex } from './lib/color.mjs';
import { orientedSize, parseBox, oklabPixels, kmeans } from './lib/photo.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE = new Set(['--out', '--crop', '--step', '--width', '--frame', '--grid', '--k']);
const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.has(args[i - 1]));
const r2 = (v) => +v.toFixed(2);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const niceStep = (span, lines = 14) => { const raw = span / lines, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw); };

async function grid(photo, out) {
  const sharp = await loadSharp();
  const size = await orientedSize(photo);
  const box = opt('--crop') ? parseBox(opt('--crop'), size) : { left: 0, top: 0, width: size.width, height: size.height };
  const W = Number(opt('--width', 1200)), k = W / box.width, H = Math.round(box.height * k);
  const step = Number(opt('--step', 0)) || niceStep(box.width);
  const base = await sharp(photo).rotate().extract(box).resize(W, H).jpeg({ quality: 85 }).toBuffer();
  const lines = [], labels = [];
  for (let v = Math.ceil(box.left / step) * step; v <= box.left + box.width; v += step) {
    const x = r2((v - box.left) * k);
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
    labels.push(`<text x="${x + 3}" y="14">${v}</text>`, `<text x="${x + 3}" y="${H - 5}">${v}</text>`);
  }
  for (let v = Math.ceil(box.top / step) * step; v <= box.top + box.height; v += step) {
    const y = r2((v - box.top) * k);
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
    labels.push(`<text x="3" y="${y - 3}">${v}</text>`, `<text x="${W - 3}" y="${y - 3}" text-anchor="end">${v}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font:12px "Segoe UI",Arial,sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-opacity:.7}</style>
<g stroke="#000" stroke-opacity=".45" stroke-width="2">${lines.join('')}</g><g stroke="#fff" stroke-opacity=".85" stroke-width=".8">${lines.join('')}</g>${labels.join('')}</svg>`;
  mkdirSync(dirname(resolve(out)), { recursive: true });
  await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
  console.log(`grid ${out.replace(/\\/g, '/')}: photo ${size.width}x${size.height}, showing ${box.left},${box.top} to ${box.left + box.width},${box.top + box.height}; lines every ${step} photo px; 1 overlay px = ${r2(1 / k)} photo px.`);
  console.log('Labels are photo pixels. Note each feature point as [x, y] in photo pixels; crop with --crop for finer points.');
}

function compute(j) {
  const P = j.points || {};
  const get = (n) => { if (!P[n]) throw new Error(`point "${n}" is not in points`); return P[n]; };
  const dist = ([a, b]) => Math.hypot(get(b)[0] - get(a)[0], get(b)[1] - get(a)[1]);
  const out = {};
  for (const m of j.measures || []) {
    if (!m.name) throw new Error('every measure needs a name');
    if (m.distance) out[m.name] = r2(dist(m.distance));
    else if (m.ratio) out[m.name] = r2(dist(m.ratio[0]) / dist(m.ratio[1]));
    else if (m.angle) { const [a, b] = m.angle.map(get); out[m.name] = r2((Math.atan2(a[1] - b[1], b[0] - a[0]) * 180) / Math.PI); }
    else if (m.offset) {
      const [a, b] = m.offset.from.map(get), p = get(m.offset.point);
      const ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = p[0] - mx, dy = p[1] - my;
      out[m.name] = { along: r2((dx * ux + dy * uy) / L / L), across: r2((ux * dy - uy * dx) / L / L) };
    } else throw new Error(`measure "${m.name}" needs distance, ratio, angle or offset`);
  }
  return out;
}

async function points(file, out) {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const measured = compute(j);
  j.measured = measured;
  writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  for (const [k, v] of Object.entries(measured)) console.log(`  ${k}: ${typeof v === 'object' ? `along ${v.along}, across ${v.across}` : v}`);
  console.log(`wrote measured to ${file}`);
  if (out) {
    const photo = resolve(dirname(resolve(file)), j.source || '');
    if (!j.source || !existsSync(photo)) throw new Error('features.json "source" must point at the photo to draw the points');
    const sharp = await loadSharp();
    const size = await orientedSize(photo);
    // crop to the points plus a margin, so close points stay readable (--full draws on the whole photo)
    const xs = Object.values(j.points || {}).map((p) => p[0]), ys = Object.values(j.points || {}).map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), size.width / 8);
    const box = args.includes('--full') || !xs.length ? { left: 0, top: 0, width: size.width, height: size.height } : parseBox([Math.min(...xs) - span * 0.25, Math.min(...ys) - span * 0.25, Math.max(...xs) + span * 0.25, Math.max(...ys) + span * 0.25].map((v, i) => Math.max(0, Math.min(v, i % 2 ? size.height : size.width))).join(','), size);
    const W = 1200, k = W / box.width, H = Math.round(box.height * k);
    const X = (x) => (x - box.left) * k, Y = (y) => (y - box.top) * k;
    const base = await sharp(photo).rotate().extract(box).resize(W, H).jpeg({ quality: 85 }).toBuffer();
    const marks = Object.entries(j.points || {}).map(([n, [x, y]]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="none" stroke="#000" stroke-width="3"/><circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="none" stroke="#ff2" stroke-width="1.5"/><text x="${X(x) + 8}" y="${Y(y) - 6}">${esc(n)}</text>`);
    const segs = (j.measures || []).flatMap((m) => [m.distance, m.angle, ...(m.ratio || []), m.offset?.from].filter(Boolean)).map(([a, b]) => `<line x1="${X(j.points[a][0])}" y1="${Y(j.points[a][1])}" x2="${X(j.points[b][0])}" y2="${Y(j.points[b][1])}"/>`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font:13px "Segoe UI",Arial,sans-serif;fill:#ff2;paint-order:stroke;stroke:#000;stroke-width:3px}</style><g stroke="#ff2" stroke-width="1.2" stroke-dasharray="6 4">${segs.join('')}</g>${marks.join('')}</svg>`;
    await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
    console.log(`points drawn on ${out.replace(/\\/g, '/')}`);
  }
}

async function cells(image, out) {
  const size = await orientedSize(image);
  if (!opt('--frame')) throw new Error('--frame x0,y0,x1,y1 is required (the area that maps onto the grid)');
  const box = parseBox(opt('--frame'), size), N = Number(opt('--grid', 32)), K = Number(opt('--k', 6));
  const sub = 4; // samples per cell side
  const { px, width } = await oklabPixels(image, { box, width: N * sub });
  const { centers, assign } = kmeans(px, K, { seed: 7 });
  const h = Math.round(px.length / width), rows = [];
  for (let cy = 0; cy < N; cy++) {
    let row = '';
    for (let cx = 0; cx < N; cx++) {
      const count = new Array(K).fill(0);
      for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
        const x = Math.min(width - 1, cx * sub + i), y = Math.min(h - 1, Math.floor(((cy * sub + j) * h) / (N * sub)));
        count[assign[y * width + x]]++;
      }
      row += 'abcdefghij'[count.indexOf(Math.max(...count))];
    }
    rows.push(row);
  }
  const legend = centers.map((c, i) => `${'abcdefghij'[i]} ${oklabToHex(c)} ${(100 * [...assign].filter((a) => a === i).length / assign.length).toFixed(1)}%`);
  const text = [`cells ${N}x${N} from ${box.left},${box.top} to ${box.left + box.width},${box.top + box.height}`, ...legend, '', ...rows].join('\n');
  if (out) { writeFileSync(out, text + '\n'); console.log(`wrote ${out}`); }
  console.log(text);
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  try {
    const [cmd, file] = files;
    if (cmd === 'grid') { if (!file || !opt('--out')) throw new Error('usage: node measure.mjs grid <photo> --out <overlay.png> [--crop x0,y0,x1,y1] [--step px]'); await grid(file, opt('--out')); }
    else if (cmd === 'points') { if (!file) throw new Error('usage: node measure.mjs points <features.json> [--out <annotated.png>]'); await points(file, opt('--out')); }
    else if (cmd === 'cells') { if (!file) throw new Error('usage: node measure.mjs cells <image> --frame x0,y0,x1,y1 --grid <n> [--k 6] [--out map.txt]'); await cells(file, opt('--out')); }
    else console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

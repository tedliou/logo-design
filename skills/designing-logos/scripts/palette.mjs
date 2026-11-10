#!/usr/bin/env node
// Measure a photo's colors in two steps.
//   1. Area: k-means in OKLab on the downscaled photo. Near-black pixels (silhouettes, shadow) are
//      listed apart so they do not swallow the clusters.
//   2. Regions: inside each feature region chosen at G2, a small k-means splits the region into
//      sub-colors and picks the most conspicuous one: distance to the nearest area color plus
//      chroma. This recovers colors that are small but conspicuous, which area clustering
//      averages away (a pink cloud in a blue sky comes out gray-violet).
//
//   node palette.mjs <photo> [--region name=x0,y0,x1,y1[:dominant]]... [--k 6] [--dark 0.22]
//       [--out <dir>] [--write <palette.json>] [--json]
//   node palette.mjs contrast <palette.json>
//
// Boxes are in photo pixels (as labeled by measure.mjs grid) or fractions 0-1. ":dominant" takes
// the region's largest sub-color instead of the most distinct one (for example a sky area).
// --write stores the measurements under "measured" and keeps the "roles" Claude and the user chose.
// Outputs palette.png: area bars, region swatches, and the photo with the region boxes drawn.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './lib/raster.mjs';
import { oklabToHex, chroma, hueDeg, deltaE, contrast, normalizeColor } from './lib/color.mjs';
import { orientedSize, parseBox, oklabPixels, kmeans } from './lib/photo.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const opts = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const VALUE = new Set(['--region', '--k', '--dark', '--out', '--write', '--width']);
const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.has(args[i - 1]));
const r3 = (v) => +v.toFixed(3);
const describe = (lab) => ({ hex: oklabToHex(lab), L: r3(lab[0]), C: r3(chroma(lab)), h: Math.round(hueDeg(lab)) });
const median = (pts) => [0, 1, 2].map((k) => pts.map((p) => p[k]).sort((a, b) => a - b)[pts.length >> 1]);

export async function measurePalette(photo, { regions = [], K = 6, dark = 0.22, width = 200 } = {}) {
  const size = await orientedSize(photo);
  const { px } = await oklabPixels(photo, { width });
  const darkPx = px.filter((p) => p[0] < dark), lightPx = px.filter((p) => p[0] > 0.97);
  const rest = px.filter((p) => p[0] >= dark && p[0] <= 0.97);
  const { centers, assign } = kmeans(rest, K);
  const counts = centers.map((_, c) => assign.filter((a) => a === c).length);
  const area = centers.map((c, i) => ({ ...describe(c), share: +(100 * counts[i] / px.length).toFixed(1) })).filter((c) => c.share > 0).sort((a, b) => b.share - a.share);
  const out = {
    source: photo.replace(/\\/g, '/'), size, method: `OKLab k-means, K=${K}, on a ${width} px wide copy; L < ${dark} listed as dark`,
    area,
    dark: darkPx.length ? { ...describe(median(darkPx)), share: +(100 * darkPx.length / px.length).toFixed(1) } : null,
    light: lightPx.length ? { share: +(100 * lightPx.length / px.length).toFixed(1) } : null,
    regions: [],
  };
  for (const spec of regions) {
    const m = String(spec).match(/^([^=]+)=([^:]+)(?::(dominant|distinct))?$/);
    if (!m) throw new Error(`region "${spec}" must look like name=x0,y0,x1,y1 or name=x0,y0,x1,y1:dominant`);
    const box = parseBox(m[2], size);
    const { px: rp } = await oklabPixels(photo, { box, width: 160 });
    const k = kmeans(rp, 3, { seed: 11 });
    const n = k.centers.map((_, c) => k.assign.filter((a) => a === c).length);
    const subs = k.centers.map((c, i) => ({ ...describe(c), share: +(100 * n[i] / rp.length).toFixed(1), distinct: r3(Math.min(...centers.map((g) => deltaE(c, g)))) })).filter((s) => s.share >= 5);
    // conspicuous = far from the area palette and saturated; both are OKLab distances, so they add
    for (const s of subs) s.score = r3(s.distinct + s.C);
    const ranked = m[3] === 'dominant' ? [...subs].sort((a, b) => b.share - a.share) : [...subs].sort((a, b) => b.score - a.score);
    const pick = ranked[0];
    // a near tie is a choice for G2, not for the script
    const close = m[3] === 'dominant' ? [] : ranked.slice(1).filter((s) => pick.score - s.score < 0.01).map((s) => s.hex);
    out.regions.push({ name: m[1], box: [box.left, box.top, box.left + box.width, box.top + box.height], mode: m[3] || 'distinct', pick: pick.hex, close, subColors: subs });
  }
  return out;
}

async function drawSheet(photo, res, file) {
  const sharp = await loadSharp();
  const W = 720, thumb = await sharp(photo).rotate().resize({ width: W }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const th = thumb.info.height, k = W / res.size.width;
  const barH = 56, swH = 72, gap = 10, H = th + gap + barH + 34 + (res.regions.length ? swH + 34 : 0) + gap;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const parts = [];
  // region boxes on the photo
  for (const r of res.regions) {
    const [x0, y0, x1, y1] = r.box.map((v) => v * k);
    parts.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#000" stroke-width="3" opacity=".6"/><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#fff" stroke-width="1.5"/>`);
    parts.push(`<text x="${x0 + 4}" y="${y0 + 15}" class="o">${esc(r.name)}</text><text x="${x0 + 4}" y="${y0 + 15}">${esc(r.name)}</text>`);
  }
  // area bars (dark share included at the end)
  let x = 0; const y = th + gap;
  const bars = [...res.area.map((a) => ({ ...a, label: a.hex })), ...(res.dark ? [{ ...res.dark, label: `${res.dark.hex} dark` }] : [])];
  const total = bars.reduce((s, b) => s + b.share, 0) || 1;
  for (const b of bars) {
    const w = (W * b.share) / total;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${barH}" fill="${b.hex}"/>`);
    if (w > 64) parts.push(x + 150 > W ? `<text x="${x + w - 4}" y="${y + barH + 16}" class="d" text-anchor="end">${esc(b.label)} ${b.share}%</text>` : `<text x="${x + 4}" y="${y + barH + 16}" class="d">${esc(b.label)} ${b.share}%</text>`);
    x += w;
  }
  if (res.regions.length) {
    // per region: the pick as a large swatch, every sub-color as a chip below it
    const y2 = y + barH + 34, w = Math.min(176, W / res.regions.length), chipH = 18;
    res.regions.forEach((r, i) => {
      parts.push(`<rect x="${i * w}" y="${y2}" width="${w - 8}" height="${swH - chipH - 4}" fill="${r.pick}"/>`);
      const cw = (w - 8) / r.subColors.length;
      r.subColors.forEach((s, j) => parts.push(`<rect x="${i * w + j * cw}" y="${y2 + swH - chipH}" width="${cw - 2}" height="${chipH}" fill="${s.hex}"/>`));
      parts.push(`<text x="${i * w}" y="${y2 + swH + 16}" class="d">${esc(r.name)} ${r.pick}${r.close.length ? ' (tie)' : ''}</text>`);
    });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font:13px "Segoe UI","Noto Sans TC",Arial,sans-serif;fill:#fff}.o{stroke:#000;stroke-width:3;opacity:.6}.d{fill:#3f3f46}</style>${parts.join('')}</svg>`;
  await sharp({ create: { width: W, height: H, channels: 4, background: '#f4f4f5' } })
    .composite([{ input: thumb.data, left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(file);
}

function contrastTable(paletteFile) {
  const j = JSON.parse(readFileSync(paletteFile, 'utf8'));
  const roles = Object.entries(j.roles || {}).filter(([, v]) => v?.hex).map(([k, v]) => [k, normalizeColor(v.hex)]);
  if (roles.length < 2) return 'palette.json has fewer than two roles; add roles.ink, roles.paper and the accent first.';
  const lines = ['WCAG contrast between roles (3 or more for large graphics, 4.5 for text):'];
  for (let i = 0; i < roles.length; i++) for (let k = i + 1; k < roles.length; k++) lines.push(`  ${roles[i][0]} ${roles[i][1]} / ${roles[k][0]} ${roles[k][1]}: ${contrast(roles[i][1], roles[k][1]).toFixed(2)}`);
  return lines.join('\n');
}

function findWorkbook(p) {
  let d = dirname(resolve(p));
  for (let k = 0; k < 3; k++) { if (existsSync(join(d, 'state.json'))) return d; const up = dirname(d); if (up === d) break; d = up; }
  return null;
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  try {
    if (files[0] === 'contrast') { if (!files[1]) throw new Error('usage: node palette.mjs contrast <palette.json>'); console.log(contrastTable(files[1])); process.exit(0); }
    const photo = files[0];
    if (!photo) throw new Error('usage: node palette.mjs <photo> [--region name=x0,y0,x1,y1[:dominant]]... [--out <dir>] [--write <palette.json>]');
    if (!existsSync(photo)) throw new Error(`${photo} does not exist`);
    const wb = findWorkbook(photo);
    const outDir = opt('--out') || (wb ? join(wb, 'sheets', 'palette') : null);
    if (!outDir) throw new Error('the photo is not inside a workbook, so give --out <dir> (nothing is written next to the original photo)');
    mkdirSync(outDir, { recursive: true });
    const res = await measurePalette(photo, { regions: opts('--region'), K: Number(opt('--k', 6)), dark: Number(opt('--dark', 0.22)), width: Number(opt('--width', 200)) });
    const sheet = join(outDir, `palette-${basename(photo).replace(/\.[^.]+$/, '')}.png`);
    await drawSheet(photo, res, sheet);
    const target = opt('--write');
    if (target) {
      const prev = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
      writeFileSync(target, JSON.stringify({ ...prev, measured: res, roles: prev.roles || {} }, null, 2) + '\n');
    }
    if (args.includes('--json')) console.log(JSON.stringify(res, null, 2));
    else {
      console.log(`${res.source} (${res.size.width}x${res.size.height}): ${res.method}`);
      for (const a of res.area) console.log(`  area   ${a.hex}  ${String(a.share).padStart(5)}%  L ${a.L}  C ${a.C}  h ${a.h}`);
      if (res.dark) console.log(`  dark   ${res.dark.hex}  ${String(res.dark.share).padStart(5)}%  (L < ${opt('--dark', 0.22)}, kept apart)`);
      for (const r of res.regions) console.log(`  region ${r.name}: ${r.pick}${r.close.length ? ` (near tie with ${r.close.join(', ')}: let the user pick at G2)` : ''} [${r.mode}; sub-colors ${r.subColors.map((s) => `${s.hex} ${s.share}% dE ${s.distinct} C ${s.C}`).join(', ')}]`);
      console.log(`sheet ${sheet.replace(/\\/g, '/')}${target ? `\nwrote measured to ${target}` : ''}`);
    }
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

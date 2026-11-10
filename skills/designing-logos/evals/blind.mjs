#!/usr/bin/env node
// Blind comparison of final marks from several eval runs: shuffled labels, same renderer, same sizes.
//
//   node evals/blind.mjs <run-dir>... --out <dir> [--seed <n>] [--title "<question>"]
//
// Each run folder must hold final/mark.svg; final/mark-16.svg and final/mark-32.svg are used for those
// sizes when present. Writes blind.png and blind.html for the judge and key.json (label -> run folder)
// for whoever reveals the result. Show only blind.png or blind.html until the judge has answered.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(dirname(fileURLToPath(import.meta.url))), 'scripts');
const url = (p) => 'file:///' + resolve(p).replace(/\\/g, '/');
const { loadSharp, svgToPng } = await import(url(join(SCRIPTS, 'lib', 'raster.mjs')));
const { rolesFor, variant } = await import(url(join(SCRIPTS, 'render.mjs')));
const { page, esc, dataUri, SVG_FONT } = await import(url(join(SCRIPTS, 'lib', 'page.mjs')));

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE = new Set(['--out', '--seed', '--title']);
const runs = args.filter((a, i) => !a.startsWith('--') && !VALUE.has(args[i - 1]));
if (runs.length < 2 || !opt('--out')) { console.log('usage: node evals/blind.mjs <run-dir> <run-dir>... --out <dir> [--seed <n>] [--title "..."]'); process.exit(2); }

// Seeded shuffle so a rerun with the same seed gives the same labels.
let seed = Number(opt('--seed', Date.now() % 100000));
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const order = runs.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.r);
const labels = 'ABCDEF';

const sharp = await loadSharp();
const out = opt('--out');
mkdirSync(out, { recursive: true });
const rows = [];
for (const [i, r] of order.entries()) {
  const f = join(r, 'final', 'mark.svg');
  if (!existsSync(f)) { console.log(`ERROR ${f} does not exist`); process.exit(1); }
  const svg = readFileSync(f, 'utf8');
  const small = (px) => (existsSync(join(r, 'final', `mark-${px}.svg`)) ? readFileSync(join(r, 'final', `mark-${px}.svg`), 'utf8') : svg);
  const ro = rolesFor(svg, null);
  const mag = async (px) => sharp(await svgToPng(small(px), px)).resize(128, 128, { kernel: 'nearest' }).png().toBuffer();
  rows.push({ label: labels[i], run: r, paper: ro.paper, ink: ro.ink,
    big: await svgToPng(svg, 320), p64: await svgToPng(svg, 64), p32: await svgToPng(small(32), 32), p16: await svgToPng(small(16), 16),
    m32: await mag(32), m16: await mag(16), inv: await svgToPng(variant(svg, 'inverse', ro), 128) });
}

// PNG: one row per mark
const rowH = 360, W = 40 + 340 + 3 * 150 + 120 + 40, H = 60 + rows.length * (rowH + 12);
const layers = [], texts = [`<text x="20" y="38" font-size="22" font-weight="700">${esc(opt('--title', 'Which mark would you choose?'))}</text>`];
rows.forEach((x, i) => {
  const y = 60 + i * (rowH + 12);
  texts.push(`<text x="20" y="${y + 40}" font-size="34" font-weight="700">${x.label}</text>`);
  layers.push({ input: { create: { width: 340, height: 340, channels: 4, background: x.paper } }, left: 60, top: y }, { input: x.big, left: 70, top: y + 10 });
  const cells = [[x.p64, 64, x.paper, '64'], [x.m32, 128, x.paper, '32 x4'], [x.m16, 128, x.paper, '16 x8'], [x.inv, 128, x.ink, 'inverse']];
  cells.forEach(([buf, s, bg, lab], k) => {
    const cx = 420 + (k % 2) * 160, cy = y + Math.floor(k / 2) * 175;
    layers.push({ input: { create: { width: 150, height: 150, channels: 4, background: bg } }, left: cx, top: cy }, { input: buf, left: cx + Math.round((150 - s) / 2), top: cy + Math.round((150 - s) / 2) });
    texts.push(`<text x="${cx}" y="${cy + 166}" font-size="13">${lab}</text>`);
  });
  layers.push({ input: { create: { width: 100, height: 120, channels: 4, background: x.paper } }, left: 750, top: y });
  layers.push({ input: x.p32, left: 760, top: y + 14 }, { input: x.p16, left: 800, top: y + 22 });
  texts.push(`<text x="750" y="${y + 140}" font-size="13">32 and 16 at 1:1</text>`);
});
const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font-family:${SVG_FONT};fill:#27272a}</style>${texts.join('')}</svg>`;
await sharp({ create: { width: W, height: H, channels: 3, background: '#e4e4e7' } }).composite([...layers, { input: Buffer.from(overlay), left: 0, top: 0 }]).png().toFile(join(out, 'blind.png'));

const img = (buf, w, cls = '') => `<img src="${dataUri(buf)}" width="${w}" height="${w}" alt=""${cls ? ` class="${cls}"` : ''}>`;
const body = `<h1>${esc(opt('--title', 'Which mark would you choose?'))}</h1><p class="muted">Same renderer and sizes for every mark. Labels are shuffled.</p>
${rows.map((x) => `<section><h2>${x.label}</h2><div class="row"><span class="tile" style="background:${x.paper};padding:12px">${img(x.big, 240)}</span>
<span class="tile" style="background:${x.paper};padding:10px">${img(x.p64, 64)}</span><span class="tile" style="background:${x.paper};padding:10px">${img(x.p32, 32)}</span><span class="tile" style="background:${x.paper};padding:10px">${img(x.p16, 16)}</span>
<span class="tile" style="background:${x.paper};padding:10px">${img(x.m16, 128, 'px')}</span><span class="tile" style="background:${x.ink};padding:10px">${img(x.inv, 128)}</span></div></section>`).join('\n')}`;
writeFileSync(join(out, 'blind.html'), page({ title: 'Blind comparison', body, extraCss: '.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' }));
writeFileSync(join(out, 'key.json'), JSON.stringify(Object.fromEntries(rows.map((x) => [x.label, x.run])), null, 2));
console.log(`wrote ${join(out, 'blind.png').replace(/\\/g, '/')} and blind.html; the key is in key.json (do not show it to the judge)`);

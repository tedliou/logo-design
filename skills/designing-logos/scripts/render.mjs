#!/usr/bin/env node
// Render a mark at real sizes on real backgrounds and lay the results out as one contact sheet.
//
//   node render.mjs <mark.svg>... [--constants constants.json] [--out <dir>]
//       [--sizes 16,32,64,128,256] [--rows color:paper,color:white,inverse:ink,mono:paper]
//       [--ink #hex] [--paper #hex]
//
// Variants: color (as drawn), mono (every color except ink and paper becomes ink), inverse
// (ink and paper swap), mono-inverse. Backgrounds: paper, white, ink, or any #hex.
// Ink and paper come from constants.colors, else --ink/--paper, else the darkest and lightest
// colors in the SVG. With constants.ladder, sizes that have their own drawing (for example a
// 16 px pixel sprite) use it instead of the scaled master.
//
// Writes png/<variant>-<size>.png (transparent), sheet.png and sheet.html. The sheet has one row
// per variant and background; columns are each size at 1:1 up to 128, then the 16 and 32 renders
// magnified (nearest neighbour) to 128, then a blurred 128 (the squint test: what survives is the
// silhouette).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvg, colorUsage, recolor } from './lib/svg.mjs';
import { normalizeColor, luminance } from './lib/color.mjs';
import { loadSharp, svgToPng } from './lib/raster.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const valueFlags = new Set(['--constants', '--out', '--sizes', '--rows', '--ink', '--paper']);
const svgs = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1]));

export function rolesFor(svgText, C, over = {}) {
  const used = [...colorUsage(parseSvg(svgText)).keys()].filter((c) => /^#/.test(c));
  const byLum = [...used].sort((a, b) => luminance(a) - luminance(b));
  const ink = normalizeColor(over.ink || C?.colors?.ink?.hex || byLum[0] || '#000000');
  const paper = normalizeColor(over.paper || C?.colors?.paper?.hex || byLum[byLum.length - 1] || '#ffffff');
  const others = [...new Set([...used, ...Object.entries(C?.colors || {}).filter(([k, v]) => k !== 'why' && v?.hex).map(([, v]) => normalizeColor(v.hex))])].filter((c) => c !== ink && c !== paper);
  return { ink, paper, others };
}

export function variant(svgText, name, r) {
  const mono = Object.fromEntries(r.others.map((c) => [c, r.ink]));
  const inv = { [r.ink]: r.paper, [r.paper]: r.ink };
  if (name === 'color') return svgText;
  if (name === 'mono') return recolor(svgText, mono);
  if (name === 'inverse') return recolor(svgText, inv);
  if (name === 'mono-inverse') return recolor(recolor(svgText, mono), inv);
  throw new Error(`unknown variant ${name}; use color, mono, inverse or mono-inverse`);
}

function findWorkbook(p) {
  let d = dirname(resolve(p));
  for (let k = 0; k < 4; k++) { if (existsSync(join(d, 'state.json'))) return d; const up = dirname(d); if (up === d) break; d = up; }
  return null;
}

export async function render(svgPath, { C = null, constantsDir = '.', out, sizes = [16, 32, 64, 128, 256], rows = ['color:paper', 'color:white', 'inverse:ink', 'mono:paper'], ink, paper } = {}) {
  const sharp = await loadSharp();
  const master = readFileSync(svgPath, 'utf8');
  const name = basename(svgPath).replace(/\.svg$/i, '');
  const wb = findWorkbook(svgPath);
  out = out || (wb ? join(wb, 'sheets', name) : join(dirname(svgPath), `${name}-render`));
  mkdirSync(join(out, 'png'), { recursive: true });
  const r = rolesFor(master, C, { ink, paper });
  const ladder = Object.fromEntries(Object.entries(C?.ladder || {}).filter(([k]) => k !== 'why').map(([px, f]) => [Number(px), readFileSync(join(constantsDir, f), 'utf8')]));
  const sourceFor = (px) => ladder[px] || master;
  const bgHex = (b) => ({ paper: r.paper, white: '#ffffff', ink: r.ink }[b] || normalizeColor(b));

  // 1. transparent PNGs per variant and size
  const written = [];
  const variants = [...new Set(rows.map((x) => x.split(':')[0]))];
  for (const v of variants) for (const px of sizes) {
    const f = join(out, 'png', `${v}-${px}.png`);
    writeFileSync(f, await svgToPng(variant(sourceFor(px), v, r), px));
    written.push(f);
  }

  // 2. contact sheet
  const pad = 12, gap = 4, labelW = 150, headH = 34, footH = 26, big = 128, minW = 72;
  const sheetSizes = sizes.filter((s) => s <= big);
  const cols = [...sheetSizes.map((s) => ({ kind: 'size', px: s, w: Math.max(s, minW) })), { kind: 'mag', px: 16, w: big }, { kind: 'mag', px: 32, w: big }, { kind: 'blur', px: big, w: big }];
  const rowH = big + 2 * pad;
  const W = labelW + cols.reduce((s, c) => s + c.w + 2 * pad + gap, 0) + pad, H = headH + rows.length * (rowH + gap) + footH;
  const layers = [], text = [];
  const own = sheetSizes.filter((s) => ladder[s]);
  let x = labelW;
  for (const c of cols) {
    const label = c.kind === 'size' ? `${c.px} px${ladder[c.px] ? '*' : ''}` : c.kind === 'mag' ? `${c.px} px magnified${ladder[c.px] ? '*' : ''}` : 'blur (squint)';
    text.push(`<text x="${x + pad}" y="22">${label}</text>`);
    c.x = x; x += c.w + 2 * pad + gap;
  }
  for (const [ri, row] of rows.entries()) {
    const [v, b] = row.split(':');
    const bg = bgHex(b || 'paper');
    const y = headH + ri * (rowH + gap);
    text.push(`<text x="${pad}" y="${y + rowH / 2 + 5}">${v} on ${b || 'paper'}</text>`);
    for (const c of cols) {
      layers.push({ input: { create: { width: c.w + 2 * pad, height: rowH, channels: 4, background: bg } }, left: c.x, top: y });
      let png;
      if (c.kind === 'size') png = await svgToPng(variant(sourceFor(c.px), v, r), c.px);
      else if (c.kind === 'mag') png = await sharp(await svgToPng(variant(sourceFor(c.px), v, r), c.px)).resize(big, big, { kernel: 'nearest' }).png().toBuffer();
      else png = await sharp(await svgToPng(variant(master, v, r), big, big, bg)).blur(big / 32).png().toBuffer();
      const side = c.kind === 'size' ? c.px : big;
      layers.push({ input: png, left: c.x + pad + Math.round((c.w - side) / 2), top: y + Math.round((rowH - side) / 2) });
    }
  }
  if (own.length) text.push(`<text x="${pad}" y="${H - 9}">* ${own.join(' and ')} px use their own drawing from constants.ladder, not the scaled master.</text>`);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font:13px "Segoe UI","Noto Sans TC","Noto Sans",Arial,sans-serif;fill:#3f3f46}</style>${text.join('')}</svg>`;
  layers.push({ input: Buffer.from(overlay), left: 0, top: 0 });
  const sheet = join(out, 'sheet.png');
  await sharp({ create: { width: W, height: H, channels: 4, background: '#e4e4e7' } }).composite(layers).png().toFile(sheet);

  // 3. HTML sheet for people: same grid, 1:1 images, magnified ones kept pixel-sharp
  const rel = (f) => relative(out, f).replace(/\\/g, '/');
  const cell = (v, c, bg) => c.kind === 'blur'
    ? `<td style="background:${bg}"><img src="png/${v}-${big >= Math.max(...sizes) ? big : big}.png" width="${big}" style="filter:blur(${big / 32}px)"></td>`
    : `<td style="background:${bg}"><img src="png/${v}-${c.px}.png" width="${c.kind === 'mag' ? big : c.px}" style="${c.kind === 'mag' ? 'image-rendering:pixelated' : ''}"></td>`;
  const html = `<!doctype html><meta charset="utf-8"><title>${name} contact sheet</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;background:#e4e4e7;color:#3f3f46}table{border-collapse:separate;border-spacing:8px}td{padding:12px;text-align:center;vertical-align:middle}th{font-weight:500;text-align:left}</style>
<h1 style="font-size:16px">${name}</h1><table><tr><th></th>${cols.map((c) => `<th>${c.kind === 'size' ? c.px : c.kind === 'mag' ? `${c.px} magnified` : 'blur'}</th>`).join('')}</tr>
${rows.map((row) => { const [v, b] = row.split(':'); const bg = bgHex(b || 'paper'); return `<tr><th>${v} on ${b || 'paper'}</th>${cols.map((c) => cell(v, c, bg)).join('')}</tr>`; }).join('\n')}
</table>`;
  if (!sizes.includes(big)) for (const v of variants) writeFileSync(join(out, 'png', `${v}-${big}.png`), await svgToPng(variant(master, v, r), big));
  writeFileSync(join(out, 'sheet.html'), html);
  return { out, sheet, html: join(out, 'sheet.html'), pngs: written.map(rel), roles: r, columns: cols.map((c) => (c.kind === 'size' ? String(c.px) : c.kind === 'mag' ? `${c.px} magnified` : 'blur')), rows };
}

// --- export: the delivery package -----------------------------------------------------------------------
const USES = { 16: 'browser tab', 32: 'browser tab (high density), taskbar', 48: 'browser tab, Windows site icon', 64: 'small UI', 128: 'UI, documents', 180: 'Apple touch icon', 192: 'web app manifest', 256: 'desktop icon', 512: 'web app manifest, splash', 1024: 'social avatar, app stores' };

// ICO with embedded PNGs (Vista and later read PNG entries).
export function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ px, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px >= 256 ? 0 : px, e); head.writeUInt8(px >= 256 ? 0 : px, e + 1);
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

export async function exportPackage(target, { out, sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024] } = {}) {
  const cpath = target.endsWith('.json') ? target : join(target, 'constants.json');
  if (!existsSync(cpath)) throw new Error(`${cpath} does not exist; export reads the mark and colors from constants.json`);
  const C = JSON.parse(readFileSync(cpath, 'utf8')), base = dirname(resolve(cpath));
  if (!C.mark || !existsSync(join(base, C.mark))) throw new Error('constants.json needs mark: the master SVG path, relative to constants.json');
  out = out || join(base, 'export');
  mkdirSync(join(out, 'png'), { recursive: true });
  const master = readFileSync(join(base, C.mark), 'utf8');
  const r = rolesFor(master, C);
  const ladder = Object.fromEntries(Object.entries(C.ladder || {}).filter(([k]) => k !== 'why').map(([px, f]) => [Number(px), readFileSync(join(base, f), 'utf8')]));
  const files = [];
  const write = (name, data, use) => { writeFileSync(join(out, name), data); files.push([name, use]); };
  if (resolve(join(base, C.mark)) !== resolve(join(out, 'mark.svg'))) write('mark.svg', master, 'master, color'); else files.push(['mark.svg', 'master, color']);
  write('mark-mono.svg', variant(master, 'mono', r), 'one color on light grounds');
  write('mark-inverse.svg', variant(master, 'inverse', r), 'dark grounds');
  const icoParts = [];
  for (const px of sizes) {
    const buf = await svgToPng(ladder[px] || master, px);
    write(`png/mark-${px}.png`, buf, `${USES[px] || 'general'}${ladder[px] ? '; hand-drawn sprite' : ''}`);
    if ([16, 32, 48].includes(px)) icoParts.push({ px, buf });
  }
  if (icoParts.length) write('favicon.ico', ico(icoParts), `${icoParts.map((p) => p.px).join(', ')} px in one file for older browsers`);
  const extra = [['construction.svg', 'grid, angles and curve radii over the mark', `node board.mjs construction "${cpath}" --out "${join(out, 'construction.svg')}"`],
    ['presentation.png', 'the mark printed on paper; the only place texture appears', `node texture.mjs "${join(out, 'mark.svg')}" --constants "${cpath}" --index --out "${join(out, 'presentation.png')}"`],
    ['rationale.html', 'the mark, element meanings, construction, small sizes, decisions', `node board.mjs rationale "${base}"`]];
  const missing = extra.filter(([f]) => !existsSync(join(out, f)));
  const readme = ['# Mark files', '', 'Written by render.mjs export. Each file has a use; leave out what you will not place.', '', '| File | Use |', '|---|---|',
    ...files.map(([f, u]) => `| \`${f}\` | ${u} |`), ...extra.filter(([f]) => existsSync(join(out, f))).map(([f, u]) => `| \`${f}\` | ${u} |`), ''];
  writeFileSync(join(out, 'README.md'), readme.join('\n'));
  return { out, files, missing };
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase() && args[0] === 'export') {
  try {
    const target = args[1];
    if (!target) { console.log('usage: node render.mjs export <workbook|constants.json> [--out <dir>] [--sizes 16,32,48,...]'); process.exit(2); }
    const res = await exportPackage(target, { out: opt('--out'), sizes: opt('--sizes') ? opt('--sizes').split(',').map(Number) : undefined });
    console.log(`exported ${res.files.length} files to ${res.out.replace(/\\/g, '/')} (README.md lists each with its use)`);
    for (const [f, , cmd] of res.missing) console.log(`  not yet: ${f}. Make it with: ${cmd.replace(/\\/g, '/')}`);
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
} else if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  if (!svgs.length) { console.log('usage: node render.mjs <mark.svg>... [--constants constants.json] [--out <dir>] [--sizes 16,32,64,128,256] [--rows color:paper,inverse:ink] [--ink #hex] [--paper #hex]\n       node render.mjs export <workbook|constants.json> [--out <dir>] [--sizes 16,32,48,...]'); process.exit(2); }
  const cpath = opt('--constants');
  const C = cpath ? JSON.parse(readFileSync(cpath, 'utf8')) : null;
  try {
    for (const s of svgs) {
      const res = await render(s, {
        C, constantsDir: cpath ? dirname(resolve(cpath)) : '.',
        out: svgs.length > 1 && opt('--out') ? join(opt('--out'), basename(s).replace(/\.svg$/i, '')) : opt('--out'),
        sizes: opt('--sizes') ? opt('--sizes').split(',').map(Number) : undefined,
        rows: opt('--rows') ? opt('--rows').split(',') : undefined,
        ink: opt('--ink'), paper: opt('--paper'),
      });
      console.log(`${s}: ${res.pngs.length} PNGs in ${res.out.replace(/\\/g, '/')}/png`);
      console.log(`  sheet ${res.sheet.replace(/\\/g, '/')} (rows: ${res.rows.join(', ')}; columns: ${res.columns.join(', ')})`);
      console.log(`  roles: ink ${res.roles.ink}, paper ${res.roles.paper}${res.roles.others.length ? `, other ${res.roles.others.join(' ')}` : ''}`);
    }
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

#!/usr/bin/env node
// Boards for the gates: what the user looks at before answering, and what Claude and the reviewer read.
//
//   node board.mjs grid <workbook>                         mandala.json -> sheets/mandala.html
//   node board.mjs ladder <workbook>                       photo crop and ladder/L*.svg at 128, 32, 16 px -> sheets/ladder.png/.html
//   node board.mjs forms <workbook> [--concept C1]         form grid, each sketch at 64 and 16 px -> sheets/forms-<concept>.png/.html
//   node board.mjs directions <workbook> [--name "<text>"] directions.json -> sheets/directions.png/.html
//   node board.mjs variants <workbook>                     variants.json -> sheets/variants.png/.html
//   node board.mjs cards <out-prefix> <a.svg> <b.svg> [<c.svg>] [--title "<question>"]   L3 cards A, B, C
//   node board.mjs construction <workbook|constants.json> [--out <file.svg>]   construction sheet from constants.json
//   node board.mjs rationale <workbook>                    export/rationale.html from the workbook files
//
// PNGs are for Claude and the reviewer: real pixels, short labels. HTML pages are for the user:
// one self-contained file each, so they open locally or can be published as a private page.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp, svgToPng } from './lib/raster.mjs';
import { rolesFor, variant } from './render.mjs';
import { page, esc, dataUri, SVG_FONT } from './lib/page.mjs';
import { parseSvg } from './lib/svg.mjs';
import { matches, fitCircle, ribbon } from './check.mjs';
import { checkDirections, motifOverlap as overlap } from './workbook.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE_FLAGS = new Set(['--concept', '--name', '--title', '--out']);
const positional = args.slice(1).filter((a, i, arr) => !a.startsWith('--') && !VALUE_FLAGS.has(arr[i - 1]));
const fail = (m) => { console.log(`ERROR ${m}`); process.exit(1); };
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const slash = (p) => p.replace(/\\/g, '/');

// --- shared ---------------------------------------------------------------------------------------
export const POSITIONS = [0, 1, 2, 5, 8, 7, 6, 3]; // the eight cells around the center of a 3 x 3, clockwise from top left

function workbook(dir) {
  if (!dir || !existsSync(join(dir, 'state.json'))) fail(`${dir || '(none)'} is not a workbook (no state.json)`);
  return { dir, state: readJson(join(dir, 'state.json')) };
}

// Ink, paper and other colors: constants.json when it exists, else palette.json roles, else from the SVG.
export function colorsOf(dir) {
  if (existsSync(join(dir, 'constants.json'))) return readJson(join(dir, 'constants.json'));
  if (existsSync(join(dir, 'palette.json'))) {
    const r = readJson(join(dir, 'palette.json')).roles || {};
    return { colors: Object.fromEntries(Object.entries(r).filter(([, v]) => v?.hex).map(([k, v]) => [k, { hex: v.hex }])) };
  }
  return null;
}

const isWide = (ch) => /[\u2e80-\uffff]/.test(ch);
const visualLen = (str) => [...str].reduce((n, ch) => n + (isWide(ch) ? 1 : 0.55), 0);
// Wrap to about width wide characters per line: CJK breaks between characters, Latin between words.
export function wrap(text, width) {
  const tokens = String(text).match(/[\u2e80-\uffff]|[^\s\u2e80-\uffff]+|\s+/g) || [];
  const out = []; let line = '';
  for (const t of tokens) {
    if (/^\s+$/.test(t)) { if (line) line += ' '; continue; }
    if (line && visualLen(line + t) > width) { out.push(line.trim()); line = ''; }
    line += t;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

async function compose(W, H, bg, layers, texts, file) {
  const sharp = await loadSharp();
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font-family:${SVG_FONT};fill:#3f3f46}</style>${texts.join('')}</svg>`;
  await sharp({ create: { width: W, height: H, channels: 4, background: bg } })
    .composite([...layers, { input: Buffer.from(overlay), left: 0, top: 0 }]).png().toFile(file);
  return file;
}
const rect = (w, h, color) => ({ create: { width: Math.round(w), height: Math.round(h), channels: 4, background: color } });
const txt = (x, y, s, { size = 13, weight = 400, anchor = 'start', fill } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${fill ? ` style="fill:${fill}"` : ''}>${esc(s)}</text>`;
async function magnified(svg, px, to) {
  const sharp = await loadSharp();
  return sharp(await svgToPng(svg, px)).resize(to, to, { kernel: 'nearest' }).png().toBuffer();
}
const img = (buf, w, cls = '') => `<img src="${dataUri(buf)}" width="${w}" height="${w}" alt=""${cls ? ` class="${cls}"` : ''}>`;

// --- grid: the meaning grid as nine 3 x 3 blocks ----------------------------------------------------
function cmdGrid() {
  const { dir, state } = workbook(positional[0]);
  const f = join(dir, 'mandala.json');
  if (!existsSync(f)) fail(`${slash(f)} does not exist; write the grid first (format in references/mandala.md)`);
  const m = readJson(f);
  const themes = m.themes || [];
  const cell = (cls, id, label, lens, title = '') => `<div class="cell ${cls}"${title ? ` title="${esc(title)}"` : ''}>${id ? `<span class="id">${esc(id)}</span> ` : ''}<span class="lab">${esc(label)}</span>${lens ? `<span class="lens">${esc(lens)}</span>` : ''}</div>`;
  const blocks = new Array(9);
  const center = new Array(9);
  center[4] = cell('core', '', m.core || '(core sentence)', 'core');
  themes.forEach((t, i) => { center[POSITIONS[i]] = cell('theme', t.id, t.label, t.lens); });
  blocks[4] = { order: 0, html: center };
  themes.forEach((t, i) => {
    const cells = new Array(9);
    cells[4] = cell('theme', t.id, t.label, t.lens);
    (t.motifs || []).forEach((mo, j) => {
      const cls = ['motif', mo.drawable === false ? 'nodraw' : '', mo.keep ? 'keep' : ''].filter(Boolean).join(' ');
      cells[POSITIONS[j]] = cell(cls, mo.id, mo.label, mo.lens, mo.why || '');
    });
    blocks[POSITIONS[i]] = { order: i + 1, html: cells };
  });
  const grid = blocks.map((b) => `<div class="block" style="--o:${b ? b.order : 9}">${Array.from({ length: 9 }, (_, k) => (b && b.html[k]) || '<div class="cell empty"></div>').join('')}</div>`).join('\n');
  const kept = themes.flatMap((t) => (t.motifs || []).filter((x) => x.keep).map((x) => ({ ...x, theme: t.label })));
  const concepts = m.concepts || [];
  const label = (id) => themes.flatMap((t) => t.motifs || []).find((x) => x.id === id)?.label || id;
  const body = `<h1>${esc(state.name)}: meaning grid</h1>
<p class="muted">Center: the core sentence and eight themes, one per meaning lens. Around it: each theme with eight motifs, one per motif lens. Striped cells cannot be drawn yet. Outlined cells are marked to keep${m.keepBy ? ` (${esc(m.keepBy)})` : ''}.</p>
<div class="mandala">${grid}</div>
<h2>Marked to keep (${kept.length})</h2>
<div class="scroll"><table><tr><th>Id</th><th>Theme</th><th>Lens</th><th>Motif</th><th>Why</th></tr>
${kept.map((x) => `<tr><td><code>${esc(x.id)}</code></td><td>${esc(x.theme)}</td><td>${esc(x.lens)}</td><td>${esc(x.label)}</td><td>${esc(x.why || '')}</td></tr>`).join('\n')}</table></div>
<h2>Concept sentences</h2>
${concepts.length ? `<div class="scroll"><table><tr><th>Id</th><th>Sentence</th><th>Motifs</th></tr>${concepts.map((c) => `<tr><td><code>${esc(c.id)}</code></td><td>${esc(c.text)}</td><td>${(c.motifs || []).map((id) => `<code>${esc(id)}</code> ${esc(label(id))}`).join('<br>')}</td></tr>`).join('')}</table></div>` : '<p class="muted">None yet.</p>'}`;
  const css = `.mandala{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.block{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}
.cell{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:5px 6px;min-height:76px;font-size:13px;line-height:1.35;overflow-wrap:anywhere;display:flex;flex-direction:column;gap:2px}
.cell .id{font:11px ui-monospace,Consolas,monospace;color:var(--muted)}.cell .lens{font-size:11px;color:var(--muted);margin-top:auto}
.cell.theme{background:var(--off);font-weight:600}.cell.core{background:var(--text);color:var(--bg);font-weight:700}.cell.core .lens{color:inherit;opacity:.7}
.cell.nodraw{background:repeating-linear-gradient(135deg,var(--surface) 0 6px,var(--off) 6px 12px)}
.cell.keep{outline:3px solid var(--keep);outline-offset:-3px}.cell.empty{visibility:hidden}
@media (max-width:760px){.mandala{grid-template-columns:minmax(0,1fr);gap:16px}.block{order:var(--o)}}`;
  const out = join(dir, 'sheets', 'mandala.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page({ title: `${state.name} meaning grid`, description: 'Core sentence, eight themes and sixty-four motifs.', body, extraCss: css }));
  const nodraw = themes.flatMap((t) => (t.motifs || []).filter((x) => x.drawable === false)).length;
  console.log(`wrote ${slash(out)}: ${themes.length} themes, ${themes.reduce((n, t) => n + (t.motifs || []).length, 0)} motifs, ${kept.length} marked to keep, ${nodraw} not drawable, ${concepts.length} concepts`);
}

// --- forms: one concept, eight form operations ------------------------------------------------------
async function cmdForms() {
  const { dir, state } = workbook(positional[0]);
  const m = readJson(join(dir, 'mandala.json'));
  const C = colorsOf(dir);
  const forms = (m.forms || []).filter((f) => !opt('--concept') || f.concept === opt('--concept'));
  if (!forms.length) fail('mandala.json has no forms entry for that concept; add forms: [{ concept, cells: [{ op, sketch, note }] }]');
  for (const f of forms) {
    const concept = (m.concepts || []).find((c) => c.id === f.concept);
    const S = 232, gap = 6, head = 40, W = 3 * S + 4 * gap, H = head + 3 * S + 4 * gap;
    const layers = [], texts = [txt(gap, 26, `${state.name}  form grid  ${f.concept}`, { size: 15, weight: 600 })];
    const htmlCells = new Array(9);
    for (let k = 0; k < 9; k++) {
      const x = gap + (k % 3) * (S + gap), y = head + gap + Math.floor(k / 3) * (S + gap);
      layers.push({ input: rect(S, S, k === 4 ? '#18181b' : '#ffffff'), left: x, top: y });
    }
    const cx = gap + (S + gap), cy = head + gap + (S + gap);
    texts.push(txt(cx + 12, cy + 26, f.concept, { size: 13, fill: '#a1a1aa' }));
    wrap(concept?.text || f.concept, 11).slice(0, 7).forEach((l, i) => texts.push(txt(cx + 12, cy + 56 + i * 24, l, { size: 17, weight: 600, fill: '#fafafa' })));
    htmlCells[4] = `<div class="fc center"><span class="muted">${esc(f.concept)}</span><strong>${esc(concept?.text || '')}</strong></div>`;
    for (const [i, c] of (f.cells || []).entries()) {
      const k = POSITIONS[i], x = gap + (k % 3) * (S + gap), y = head + gap + Math.floor(k / 3) * (S + gap);
      texts.push(txt(x + 10, y + 20, `${i + 1} ${c.op}`, { size: 13, weight: 600 }));
      if (!c.sketch || !existsSync(join(dir, c.sketch))) { texts.push(txt(x + 10, y + 44, 'no sketch yet', { size: 12, fill: '#b4233f' })); htmlCells[k] = `<div class="fc"><strong>${esc(c.op)}</strong><span class="muted">no sketch yet</span></div>`; continue; }
      const svg = readFileSync(join(dir, c.sketch), 'utf8');
      const r = rolesFor(svg, C);
      const p64 = await svgToPng(svg, 64), p16 = await svgToPng(svg, 16), m16 = await magnified(svg, 16, 64);
      layers.push({ input: rect(84, 84, r.paper), left: x + 10, top: y + 32 }, { input: p64, left: x + 20, top: y + 42 });
      layers.push({ input: rect(84, 84, r.paper), left: x + 104, top: y + 32 }, { input: m16, left: x + 114, top: y + 42 });
      layers.push({ input: rect(36, 36, r.paper), left: x + 190, top: y + 56 }, { input: p16, left: x + 200, top: y + 66 });
      texts.push(txt(x + 10, y + 132, '64', { size: 11, fill: '#71717a' }), txt(x + 104, y + 132, '16 x4', { size: 11, fill: '#71717a' }), txt(x + 190, y + 132, '16', { size: 11, fill: '#71717a' }));
      wrap(c.note || '', 16).slice(0, 4).forEach((l, j) => texts.push(txt(x + 10, y + 156 + j * 18, l, { size: 12 })));
      htmlCells[k] = `<div class="fc"><strong>${i + 1} ${esc(c.op)}</strong><div class="row"><span class="tile" style="background:${r.paper};padding:8px">${img(p64, 64)}</span><span class="tile" style="background:${r.paper};padding:8px">${img(m16, 64, 'px')}</span><span class="tile" style="background:${r.paper};padding:8px">${img(p16, 16)}</span></div><span>${esc(c.note || '')}</span></div>`;
    }
    const base = join(dir, 'sheets', `forms-${f.concept}`);
    mkdirSync(dirname(base), { recursive: true });
    await compose(W, H, '#e4e4e7', layers, texts, `${base}.png`);
    const css = `.forms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.fc{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:6px;font-size:13px}.fc.center{background:var(--text);color:var(--bg);justify-content:center;font-size:17px}.fc .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}@media (max-width:760px){.forms{grid-template-columns:minmax(0,1fr)}.fc.center{order:-1}}`;
    writeFileSync(`${base}.html`, page({ title: `${state.name} form grid ${f.concept}`, description: concept?.text || '', body: `<h1>${esc(state.name)}: form grid ${esc(f.concept)}</h1><p class="muted">Each cell uses one form operation. Sizes: 64 px, 16 px magnified four times, 16 px.</p><div class="forms">${htmlCells.map((c) => c || '<div></div>').join('')}</div>`, extraCss: css }));
    console.log(`wrote ${slash(base)}.png and .html (${(f.cells || []).length} cells)`);
  }
}

// --- directions: one row per direction at real sizes --------------------------------------------------

async function cmdDirections() {
  const { dir, state } = workbook(positional[0]);
  const f = join(dir, 'directions.json');
  if (!existsSync(f)) fail('directions.json does not exist; format in references/mandala.md');
  const list = (readJson(f).directions || []);
  const C = colorsOf(dir);
  const name = opt('--name', state.name);
  const sharp = await loadSharp();
  const cols = [
    { k: 'p16', label: '16', w: 72 }, { k: 'p32', label: '32', w: 72 }, { k: 'p64', label: '64', w: 80 }, { k: 'p128', label: '128', w: 136 },
    { k: 'm16', label: '16 x8', w: 136 }, { k: 'm32', label: '32 x4', w: 136 }, { k: 'inv', label: '64 on ink', w: 80, bg: 'ink' },
    { k: 'mono', label: '64 one color', w: 80, bg: 'white' }, { k: 'blur', label: 'blur', w: 136 }, { k: 'lock', label: 'with name', w: 300 },
  ];
  const pad = 8, gap = 4, labelW = 120, head = 30, rowH = 136 + 2 * pad;
  const W = labelW + cols.reduce((s, c) => s + c.w + gap, 0) + pad, H = head + list.length * (rowH + gap) + pad;
  const layers = [], texts = [];
  let x = labelW;
  for (const c of cols) { texts.push(txt(x + 4, 20, c.label, { size: 12 })); c.x = x; x += c.w + gap; }
  const rowsHtml = [];
  for (const [ri, d] of list.entries()) {
    const y = head + ri * (rowH + gap);
    const p = join(dir, d.svg || '');
    texts.push(txt(pad, y + 30, d.id, { size: 22, weight: 700 }), txt(pad, y + 50, d.kind || '', { size: 12 }));
    wrap(d.title || '', 9).slice(0, 3).forEach((l, i) => texts.push(txt(pad, y + 72 + i * 17, l, { size: 12 })));
    if (!d.svg || !existsSync(p)) { texts.push(txt(labelW + 8, y + 40, `missing ${d.svg || 'svg'}`, { size: 13, fill: '#b4233f' })); continue; }
    const svg = readFileSync(p, 'utf8');
    const r = rolesFor(svg, C);
    const bgOf = (b) => (b === 'ink' ? r.ink : b === 'white' ? '#ffffff' : r.paper);
    const cells = {};
    for (const c of cols) {
      const bg = bgOf(c.bg);
      layers.push({ input: rect(c.w, rowH, bg), left: c.x, top: y });
      let png, side;
      if (c.k.startsWith('p')) { side = Number(c.k.slice(1)); png = await svgToPng(svg, side); }
      else if (c.k === 'm16') { side = 128; png = await magnified(svg, 16, 128); }
      else if (c.k === 'm32') { side = 128; png = await magnified(svg, 32, 128); }
      else if (c.k === 'inv') { side = 64; png = await svgToPng(variant(svg, 'inverse', r), 64); }
      else if (c.k === 'mono') { side = 64; png = await svgToPng(variant(svg, 'mono', r), 64); }
      else if (c.k === 'blur') { side = 128; png = await sharp(await svgToPng(svg, 128, 128, bg)).blur(4).png().toBuffer(); }
      else { side = 64; png = await svgToPng(svg, 64); texts.push(txt(c.x + 84, y + rowH / 2 + 8, name, { size: 22, weight: 700, fill: r.ink })); }
      const left = c.k === 'lock' ? c.x + 12 : c.x + Math.round((c.w - side) / 2);
      layers.push({ input: png, left, top: y + Math.round((rowH - side) / 2) });
      cells[c.k] = { png, side, bg };
    }
    const tile = (k, cls = '') => `<span class="tile" style="background:${cells[k].bg};width:${Math.max(cells[k].side, 40) + 16}px;height:${cells[k].side + 16}px">${img(cells[k].png, cells[k].side, cls)}</span>`;
    rowsHtml.push(`<section class="dir"><h2>${esc(d.id)} <span class="muted">${esc(d.kind || '')}</span> ${esc(d.title || '')}</h2>
<div class="tiles">${tile('p16')}${tile('p32')}${tile('p64')}${tile('p128')}${tile('m16', 'px')}${tile('m32', 'px')}${tile('inv')}${tile('mono')}<span class="tile lock" style="background:${cells.lock.bg};color:${r.ink}">${img(cells.lock.png, 64)}<b>${esc(name)}</b></span></div>
<p><b>Concept</b> ${esc(d.concept || '')}${d.conceptText ? `: ${esc(d.conceptText)}` : ''}</p>
<p><b>Motifs</b> ${(d.motifs || []).map((m) => `<code>${esc(m)}</code>`).join(' ')} <b>Operations</b> ${esc((d.ops || []).join(', '))}</p>
${d.principles?.length ? `<p><b>Principles</b> ${d.principles.map(esc).join('; ')}</p>` : ''}${d.note ? `<p>${esc(d.note)}</p>` : ''}</section>`);
  }
  const base = join(dir, 'sheets', 'directions');
  mkdirSync(dirname(base), { recursive: true });
  await compose(W, H, '#e4e4e7', layers, texts, `${base}.png`);
  const css = `.tiles{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.tile{padding:8px}.tile.lock{gap:10px;padding:8px 14px;font-size:20px}.dir{border-top:1px solid var(--line);margin-top:18px}`;
  writeFileSync(`${base}.html`, page({ title: `${state.name} directions`, description: 'Each direction at real sizes on light and dark backgrounds.', body: `<h1>${esc(state.name)}: directions</h1><p class="muted">Sizes 16, 32, 64, 128 px; 16 and 32 magnified; inverse on ink; one color; with the name.</p>${rowsHtml.join('\n')}`, extraCss: css }));
  console.log(`wrote ${slash(base)}.png and .html (${list.length} directions)`);
  const errs = checkDirections(list);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) console.log(`  overlap ${list[i].id}-${list[j].id}: ${Math.round(overlap(list[i].motifs, list[j].motifs) * 100)}%`);
  for (const e of errs) console.log(`  FAIL ${e}`);
  if (!errs.length) console.log('  directions.json: PASS');
}

// --- variants: one attribute per row, the rest fixed --------------------------------------------------
async function cmdVariants() {
  const { dir, state } = workbook(positional[0]);
  const f = join(dir, 'variants.json');
  if (!existsSync(f)) fail('variants.json does not exist; format in references/mandala.md');
  const v = readJson(f);
  const C = colorsOf(dir);
  const attrs = v.attributes || [];
  const cellW = 230, pad = 8, gap = 4, labelW = 130, head = 28, rowH = 64 + 2 * pad + 36;
  const maxN = Math.max(1, ...attrs.map((a) => (a.values || []).length));
  const W = labelW + maxN * (cellW + gap) + pad, H = head + attrs.length * (rowH + gap) + pad;
  const layers = [], texts = [txt(pad, 20, `${state.name}  variants  (base ${v.base || '?'})`, { size: 13, weight: 600 })];
  const sections = [];
  for (const [ai, a] of attrs.entries()) {
    const y = head + ai * (rowH + gap);
    texts.push(txt(pad, y + 30, a.name, { size: 15, weight: 700 }));
    const cellsHtml = [];
    for (const [vi, val] of (a.values || []).entries()) {
      const x = labelW + vi * (cellW + gap);
      layers.push({ input: rect(cellW, rowH, '#ffffff'), left: x, top: y });
      texts.push(txt(x + 8, y + 16, val.id, { size: 12, weight: 600 }));
      const p = join(dir, val.svg || '');
      if (!val.svg || !existsSync(p)) { texts.push(txt(x + 8, y + 40, 'missing svg', { size: 12, fill: '#b4233f' })); continue; }
      const svg = readFileSync(p, 'utf8'), r = rolesFor(svg, C);
      const p16 = await svgToPng(svg, 16), p32 = await svgToPng(svg, 32), p64 = await svgToPng(svg, 64), i32 = await svgToPng(variant(svg, 'inverse', r), 32);
      let x2 = x + 8; const top = y + 24;
      for (const [png, s, bg] of [[p16, 16, r.paper], [p32, 32, r.paper], [p64, 64, r.paper], [i32, 32, r.ink]]) {
        layers.push({ input: rect(s + 12, 76, bg), left: x2, top }, { input: png, left: x2 + 6, top: top + Math.round((76 - s) / 2) });
        x2 += s + 16;
      }
      wrap(val.note || '', 19).slice(0, 2).forEach((l, j) => texts.push(txt(x + 8, y + 116 + j * 15, l, { size: 11 })));
      cellsHtml.push(`<div class="vc"><b>${esc(val.id)}</b><div class="tiles">${[[p16, 16, r.paper], [p32, 32, r.paper], [p64, 64, r.paper], [i32, 32, r.ink]].map(([png, s, bg]) => `<span class="tile" style="background:${bg};padding:6px">${img(png, s)}</span>`).join('')}</div><span>${esc(val.note || '')}</span></div>`);
    }
    sections.push(`<section><h2>${esc(a.name)}</h2><div class="vrow">${cellsHtml.join('')}</div>${(a.dropped || []).length ? `<p class="muted">Dropped before showing: ${(a.dropped || []).map((d) => `<code>${esc(d.id)}</code> ${esc(d.reason)}`).join('; ')}</p>` : ''}</section>`);
  }
  const base = join(dir, 'sheets', 'variants');
  mkdirSync(dirname(base), { recursive: true });
  await compose(W, H, '#e4e4e7', layers, texts, `${base}.png`);
  const css = `.vrow{display:flex;flex-wrap:wrap;gap:8px}.vc{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px;font-size:13px;max-width:100%}.tiles{display:flex;gap:4px;align-items:center;flex-wrap:wrap}`;
  writeFileSync(`${base}.html`, page({ title: `${state.name} variants`, description: 'One attribute varies per row; everything else stays fixed.', body: `<h1>${esc(state.name)}: variants</h1><p class="muted">Base: <code>${esc(v.base || '')}</code>. Each row changes one attribute. Sizes 16, 32, 64 px and 32 px on ink.</p>${sections.join('\n')}`, extraCss: css }));
  console.log(`wrote ${slash(base)}.png and .html (${attrs.length} attributes, ${attrs.reduce((n, a) => n + (a.values || []).length, 0)} variants)`);
}

// --- ladder: the photo crop and each abstraction step at 128, 32 and 16 px ---------------------------------
async function cmdLadder() {
  const { dir, state } = workbook(positional[0]);
  const sharp = await loadSharp();
  const ldir = join(dir, 'ladder');
  const steps = existsSync(ldir) ? readdirSync(ldir).filter((f) => /^L\d.*\.svg$/i.test(f)).sort() : [];
  if (!steps.length) fail('ladder/ has no L1.svg ... L5.svg yet; draw the steps first (references/abstraction.md)');
  const C = colorsOf(dir);
  const cols = [];
  // photo crop as the first column, when there is one
  const fj = existsSync(join(dir, 'features.json')) ? readJson(join(dir, 'features.json')) : null;
  const photo = fj?.source ? join(dir, fj.source) : (state.sources || [])[0] && join(dir, state.sources[0]);
  if (photo && existsSync(photo)) {
    let im = sharp(photo).rotate();
    if (fj?.crop) { const [x0, y0, x1, y1] = fj.crop; im = im.extract({ left: Math.round(x0), top: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) }); }
    const buf = await im.png().toBuffer();
    const at = async (px) => sharp(buf).resize(px, px, { fit: 'cover' }).png().toBuffer();
    cols.push({ label: 'photo', a: await at(128), b: await at(32), c: await at(16), bg: '#ffffff' });
  }
  for (const f of steps) {
    const svg = readFileSync(join(ldir, f), 'utf8'), r = rolesFor(svg, C);
    cols.push({ label: f.replace(/\.svg$/i, ''), a: await svgToPng(svg, 128), b: await svgToPng(svg, 32), c: await svgToPng(svg, 16), m: await magnified(svg, 16, 64), bg: r.paper });
  }
  const cw = 152, gap = 6, head = 34, H = head + 152 + 70 + 40, W = cols.length * (cw + gap) + gap;
  const layers = [], texts = [];
  cols.forEach((c, i) => {
    const x = gap + i * (cw + gap);
    texts.push(txt(x + 4, 22, c.label, { size: 14, weight: 600 }));
    layers.push({ input: rect(cw, H - head - gap, c.bg), left: x, top: head });
    layers.push({ input: c.a, left: x + 12, top: head + 12 });
    layers.push({ input: c.b, left: x + 12, top: head + 160 + 16 });
    layers.push({ input: c.c, left: x + 56, top: head + 160 + 24 });
    if (c.m) layers.push({ input: c.m, left: x + 80, top: head + 160 });
  });
  texts.push(txt(gap, H - 6, 'Each column: 128 px, then 32 px and 16 px at 1:1, and 16 px magnified.', { size: 11 }));
  const base = join(dir, 'sheets', 'ladder');
  mkdirSync(dirname(base), { recursive: true });
  await compose(W, H + 8, '#e4e4e7', layers, texts, `${base}.png`);
  const html = cols.map((c) => `<figure><figcaption>${esc(c.label)}</figcaption><span class="tile" style="background:${c.bg};padding:10px">${img(c.a, 128)}</span><div class="small"><span class="tile" style="background:${c.bg};padding:6px">${img(c.b, 32)}</span><span class="tile" style="background:${c.bg};padding:6px">${img(c.c, 16)}</span>${c.m ? `<span class="tile" style="background:${c.bg};padding:6px">${img(c.m, 64, 'px')}</span>` : ''}</div></figure>`).join('');
  writeFileSync(`${base}.html`, page({ title: `${state.name} abstraction ladder`, description: 'The photo and each abstraction step at 128, 32 and 16 px.', body: `<h1>${esc(state.name)}: abstraction ladder</h1><p class="muted">Each step removes one kind of information. Pick the step where the subject is still recognizable but no longer an illustration.</p><div class="ladder">${html}</div>`, extraCss: '.ladder{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}.small{display:flex;gap:6px;align-items:center;margin-top:6px}' }));
  console.log(`wrote ${slash(base)}.png and .html (${steps.length} steps${photo ? ' plus the photo crop' : ''})`);
}

// --- cards: L3 look-and-choose -------------------------------------------------------------------------
async function cmdCards() {
  const [prefix, ...files] = positional;
  if (!prefix || files.length < 2 || files.length > 4) fail('usage: cards <out-prefix> <a.svg> <b.svg> [<c.svg>] [<d.svg>] [--title "<question>"]');
  const S = 180, gap = 10, head = 40, W = files.length * (S + gap) + gap, H = head + S + 40;
  const layers = [], texts = [txt(gap, 26, opt('--title', 'Which is closer?'), { size: 15, weight: 600 })];
  const cells = [];
  for (const [i, f] of files.entries()) {
    const svg = readFileSync(f, 'utf8'), r = rolesFor(svg, null), png = await svgToPng(svg, S - 30);
    const x = gap + i * (S + gap), L = 'ABCD'[i];
    layers.push({ input: rect(S, S, r.paper), left: x, top: head }, { input: png, left: x + 15, top: head + 15 });
    texts.push(txt(x + S / 2, head + S + 26, L, { size: 18, weight: 700, anchor: 'middle' }));
    cells.push(`<figure><span class="tile" style="background:${r.paper};padding:14px">${img(png, S - 30)}</span><figcaption>${L}</figcaption></figure>`);
  }
  mkdirSync(dirname(resolve(prefix)), { recursive: true });
  await compose(W, H, '#e4e4e7', layers, texts, `${prefix}.png`);
  writeFileSync(`${prefix}.html`, page({ title: 'Cards', body: `<h1>${esc(opt('--title', 'Which is closer?'))}</h1><div class="cards">${cells.join('')}</div>`, extraCss: '.cards{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;text-align:center}figcaption{font-weight:700;font-size:18px;margin-top:4px}' }));
  console.log(`wrote ${slash(prefix)}.png and .html (${files.length} cards)`);
}

// --- construction: the mark over its grid, with angles and curve radii ---------------------------------
export function constructionSvg(C, markText) {
  const S = C.canvas.size, scale = 640 / S, pad = 70, W = S * scale + 2 * pad;
  const inner = markText.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const lines = (C.grid.lines || []).map((v) => Number(v));
  const g = [];
  const unit = C.grid.unit || 1;
  if (S / unit <= 160) for (let v = 0; v <= S; v += unit) g.push(`<line x1="${v}" y1="0" x2="${v}" y2="${S}" class="fine"/><line x1="0" y1="${v}" x2="${S}" y2="${v}" class="fine"/>`);
  for (const v of lines) g.push(`<line x1="${v}" y1="-4" x2="${v}" y2="${S + 4}" class="major"/><line x1="-4" y1="${v}" x2="${S + 4}" y2="${v}" class="major"/>`);
  const labels = lines.map((v) => `<text x="${pad + v * scale}" y="${pad - 14}" text-anchor="middle">${v}</text><text x="${pad - 14}" y="${pad + v * scale + 4}" text-anchor="end">${v}</text>`).join('');
  // curve families: the circle each member was fitted to, as check.mjs measures it
  const circles = [];
  for (const fam of C.curves || []) {
    for (const el of parseSvg(markText).elements.filter((e) => e.role === 'drawn' && e.points && matches(e, fam.match || {}))) {
      const pts = fam.kind === 'ribbon' ? ribbon(el.points)?.center : el.points;
      const c = pts && fitCircle(pts);
      if (c && c.r < 4 * S) circles.push(c);
    }
  }
  const famNotes = (C.curves || []).map((f) => `${f.name}: ${f.kind || 'curve'}${f.radius ? `, radius ${f.radius}` : ''}${f.count ? `, ${f.count} of them` : ''}`);
  const notes = [`canvas ${S} x ${S}, unit ${unit}`, `grid lines ${lines.join(', ')}`, `angles ${(C.angles.set || []).join(', ')} deg`, ...famNotes,
    ...Object.entries(C.colors || {}).filter(([k, v]) => k !== 'why' && v?.hex).map(([k, v]) => `${k} ${v.hex}${v.maxElements ? `, at most ${v.maxElements} element` : ''}`)];
  const H = W + 26 * notes.length + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.fine{stroke:#0ea5e9;stroke-width:${0.5 / scale};opacity:.18}.major{stroke:#0284c7;stroke-width:${1.4 / scale};stroke-dasharray:${4 / scale} ${3 / scale}}.circ{fill:none;stroke:#db2777;stroke-width:${1.2 / scale};stroke-dasharray:${6 / scale} ${4 / scale}}text{font-family:${SVG_FONT};font-size:13px;fill:#3f3f46}</style>
<rect width="${W}" height="${H}" fill="#ffffff"/>
<clipPath id="area"><rect x="${pad - 40}" y="${pad - 40}" width="${S * scale + 80}" height="${S * scale + 80}"/></clipPath>
<g clip-path="url(#area)"><g transform="translate(${pad} ${pad}) scale(${scale})"><rect width="${S}" height="${S}" fill="${C.colors?.paper?.hex || '#fafafa'}"/>${inner}${g.join('')}${circles.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" class="circ"/>`).join('')}</g></g>
${labels}
${notes.map((n, i) => `<text x="${pad}" y="${W + 4 + i * 26}">${esc(n)}</text>`).join('')}
</svg>`;
}

async function cmdConstruction() {
  const target = positional[0];
  if (!target) fail('usage: construction <workbook|constants.json> [--out <file.svg>]');
  const cpath = target.endsWith('.json') ? target : join(target, 'constants.json');
  if (!existsSync(cpath)) fail(`${slash(cpath)} does not exist`);
  const C = readJson(cpath), base = dirname(resolve(cpath));
  if (!C.mark || !existsSync(join(base, C.mark))) fail('constants.json needs mark: the path of the master SVG, relative to constants.json');
  const svg = constructionSvg(C, readFileSync(join(base, C.mark), 'utf8'));
  const out = opt('--out') || (existsSync(join(base, 'state.json')) ? join(base, 'export', 'construction.svg') : join(base, 'construction.svg'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg);
  const sharp = await loadSharp();
  await sharp(Buffer.from(svg)).png().toFile(out.replace(/\.svg$/, '.png'));
  console.log(`wrote ${slash(out)} and ${slash(out.replace(/\.svg$/, '.png'))}`);
}

// --- rationale: the page that explains the final mark ---------------------------------------------------
async function cmdRationale() {
  const { dir, state } = workbook(positional[0]);
  const need = ['constants.json', 'elements.json'];
  for (const n of need) if (!existsSync(join(dir, n))) fail(`${n} is missing; the rationale is built from it`);
  const C = readJson(join(dir, 'constants.json'));
  const els = (() => { const j = readJson(join(dir, 'elements.json')); return Array.isArray(j) ? j : j.elements; })();
  const mark = readFileSync(join(dir, C.mark), 'utf8');
  const r = rolesFor(mark, C);
  const big = await svgToPng(mark, 256), inv = await svgToPng(variant(mark, 'inverse', r), 128), mono = await svgToPng(variant(mark, 'mono', r), 128);
  const ladder = [];
  for (const px of [16, 32, 64]) {
    const src = C.ladder?.[px] ? readFileSync(join(dir, C.ladder[px]), 'utf8') : mark;
    ladder.push({ px, png: await svgToPng(src, px), mag: await magnified(src, px, 128) });
  }
  const cons = await (await loadSharp())(Buffer.from(constructionSvg(C, mark))).png().toBuffer();
  const brief = existsSync(join(dir, 'brief.md')) ? readFileSync(join(dir, 'brief.md'), 'utf8') : '';
  const core = state.answers?.core?.value || '';
  const decisions = existsSync(join(dir, 'decisions.md')) ? readFileSync(join(dir, 'decisions.md'), 'utf8').split('\n## ').slice(1).map((s) => s.split('\n')) : [];
  const body = `<h1>${esc(state.name)}</h1>
${core ? `<p style="font-size:18px">${esc(core)}</p>` : ''}
<div class="hero"><span class="tile" style="background:${r.paper};padding:24px">${img(big, 256)}</span>
<span class="tile" style="background:${r.ink};padding:16px">${img(inv, 128)}</span><span class="tile" style="background:#fff;padding:16px">${img(mono, 128)}</span></div>
<h2>Elements</h2>
<div class="scroll"><table><tr><th>Element</th><th>Form</th><th>Literal</th><th>Figurative</th><th>How it refers</th></tr>
${els.map((e) => `<tr><td>${esc(e.id || '')}</td><td>${esc(e.form)}</td><td>${esc(e.literal)}</td><td>${esc(e.figurative)}</td><td>${esc(e.mode)}${e.motif ? ` <code>${esc(e.motif)}</code>` : ''}</td></tr>`).join('\n')}</table></div>
<h2>Construction</h2>
<img src="${dataUri(cons)}" alt="construction sheet" style="max-width:100%;height:auto;border-radius:6px">
<h2>Small sizes</h2>
<div class="hero">${ladder.map((l) => `<figure><span class="tile" style="background:${r.paper};padding:10px">${img(l.mag, 128, 'px')}</span><figcaption>${l.px} px${C.ladder?.[l.px] ? ', redrawn' : ''} <span class="tile" style="background:${r.paper};padding:4px">${img(l.png, l.px)}</span></figcaption></figure>`).join('')}</div>
<h2>Decisions</h2>
${decisions.map((d) => `<h3>${esc(d[0])}</h3><ul>${d.slice(1).filter((l) => l.startsWith('- ')).map((l) => `<li>${esc(l.slice(2))}</li>`).join('')}</ul>`).join('\n')}
${brief ? `<h2>Brief</h2><details><summary>Show the brief</summary><pre style="white-space:pre-wrap">${esc(brief)}</pre></details>` : ''}`;
  const out = join(dir, 'export', 'rationale.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page({ title: `${state.name} mark`, description: 'The mark, what each element means, its construction and the decisions behind it.', body, extraCss: '.hero{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}figure{margin:0}figcaption{font-size:13px;margin-top:4px;display:flex;gap:8px;align-items:center}' }));
  console.log(`wrote ${slash(out)}`);
}

const COMMANDS = { grid: cmdGrid, ladder: cmdLadder, forms: cmdForms, directions: cmdDirections, variants: cmdVariants, cards: cmdCards, construction: cmdConstruction, rationale: cmdRationale };
if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  const c = COMMANDS[args[0]];
  if (!c) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(args[0] ? 1 : 0); }
  try { await c(); } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

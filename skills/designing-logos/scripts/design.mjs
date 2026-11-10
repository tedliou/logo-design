#!/usr/bin/env node
// One design document per logo project: design.html holds every round, every pick and the final,
// with its state embedded as JSON. The user looks at it and answers with a letter; nothing else is
// kept in the project until the delivery package is exported.
//
//   node design.mjs status [<design.html>]              no file: list projects under $LOGO_WORK_ROOT
//   node design.mjs init <dir> --name "<brand>" [--brief "<one sentence>"] [--lang en|zh-TW] [--photo <file>] [--picks <eval picks.json>]
//   node design.mjs round <design.html> <round.json>    add a round of eight cells (format in references/rounds.md)
//   node design.mjs pick <design.html> <ids> [--note "<user's words>"] [--prefs "a,b,c"]
//   node design.mjs settle <design.html> <id> [--round <n>]   the user says this is the one
//   node design.mjs detail <design.html> <detail.json> [--draft]   construction, sizes, export (references/detail.md)
//   node design.mjs set <design.html> name|brief "<text>"
//   node design.mjs photo <design.html>                 write the embedded photo to the work folder, print its path
//   node design.mjs attach <design.html> [--palette <palette.json>] [--features <features.json>]
//   node design.mjs preview <design.html> <round.json>  check a round and draw its board image without adding it
//   node design.mjs png <design.html> [--round <n>] [--out <file.png>]   the board as an image (reviewer, chat)
//   node design.mjs work <design.html>                  print the temporary work folder for this project
//
// Scratch files (round.json, measurement sheets, review images) go to the work folder under the
// system temp directory, never next to design.html.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { page, esc, dataUri, SVG_FONT } from './lib/page.mjs';
import { parseSvg, colorUsage } from './lib/svg.mjs';
import { loadSharp, svgToPng, rgba } from './lib/raster.mjs';
import { rolesFor, variant, exportPackage } from './render.mjs';
import { checkConstants } from './check.mjs';
import { constructionSvg } from './lib/construction.mjs';
import { presentationSvg } from './texture.mjs';

const SELF = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const ROOT = process.env.LOGO_WORK_ROOT || join(homedir(), 'logo-work');
export const POS = [0, 1, 2, 5, 8, 7, 6, 3]; // the eight cells around the center, clockwise from top left
export const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const opts = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const BOOL = new Set(['--draft', '--keep', '--json']);
const positional = () => { const out = []; for (let i = 1; i < args.length; i++) { if (args[i].startsWith('--')) { if (!BOOL.has(args[i])) i++; continue; } out.push(args[i]); } return out; };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const slash = (p) => String(p).replace(/\\/g, '/');
function fail(msg) { console.log(`ERROR ${msg}`); process.exit(1); }

// --- state in the HTML -----------------------------------------------------------------------------------
const STATE_RE = /<script type="application\/json" id="design-state">([\s\S]*?)<\/script>/;
export function readState(file) {
  if (!existsSync(file)) fail(`${slash(file)} does not exist. Start a project with: node "${SELF}" init "<dir>" --name "<brand>"`);
  const m = readFileSync(file, 'utf8').match(STATE_RE);
  if (!m) fail(`${slash(file)} has no design state; it was not written by design.mjs`);
  return JSON.parse(m[1].replace(/<\\\//g, '</'));
}
const fileOf = (p) => { if (!p) fail('give the design.html path'); return p.endsWith('.html') ? p : join(p, 'design.html'); };
export function workDir(file, s) {
  const h = createHash('sha1').update(resolve(file).toLowerCase()).digest('hex').slice(0, 8);
  const d = join(tmpdir(), 'logo-design', `${(s?.slug || 'project')}-${h}`);
  mkdirSync(d, { recursive: true });
  return d;
}
const slugOf = (name) => (String(name).normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'logo');

// --- checks on a round --------------------------------------------------------------------------------------
// Cells are sketches, not finals: no grid or angle rules yet, but they must be flat, square and readable small.
export function checkCellSvg(svg, label) {
  const errs = [], warns = [];
  if (!/^\s*<svg[\s>]/i.test(svg)) { errs.push(`${label}: not an <svg> document`); return { errs, warns }; }
  let parsed;
  try { parsed = parseSvg(svg); } catch (e) { errs.push(`${label}: SVG does not parse (${e.message})`); return { errs, warns }; }
  const vb = parsed.viewBox;
  if (!vb) errs.push(`${label}: no viewBox; use a square viewBox such as "0 0 96 96"`);
  else if (Math.abs(vb[2] - vb[3]) > 1e-6) errs.push(`${label}: viewBox ${vb.join(' ')} is not square`);
  for (const el of parsed.elements.filter((e) => e.role !== 'hidden')) {
    if (el.tag === 'text') errs.push(`${label}: live <text>; draw letters as shapes so the cell looks the same everywhere`);
    if (el.tag === 'image' || el.tag === 'foreignobject') errs.push(`${label}: embeds a raster or HTML; cells are vector shapes`);
    for (const fx of el.effects || []) if (!fx.startsWith('clip-path')) errs.push(`${label}: uses ${fx}; marks use flat fills (texture belongs to the presentation sheet)`);
    for (const c of [el.fill, el.stroke]) if (/^url\(/.test(String(c))) errs.push(`${label}: gradient or pattern fill; use flat colors`);
  }
  const colors = [...colorUsage(parsed).keys()].filter((c) => /^#/.test(c));
  if (colors.length > 4) warns.push(`${label}: ${colors.length} colors; a mark reads best with ink, paper and one or two more`);
  return { errs: [...new Set(errs)], warns };
}

async function inkAt16(svg) {
  const img = await rgba(await svgToPng(svg, 16));
  const r = rolesFor(svg, null);
  const [pr, pg, pb] = [1, 3, 5].map((i) => parseInt(r.paper.slice(i, i + 2), 16));
  let differ = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 32) continue;
    if (Math.abs(img.data[i] - pr) + Math.abs(img.data[i + 1] - pg) + Math.abs(img.data[i + 2] - pb) > 60) differ++;
  }
  return differ / (16 * 16);
}

export function checkRound(R, n) {
  const errs = [], warns = [];
  if (!Array.isArray(R.cells) || R.cells.length !== 8) errs.push(`needs 8 cells, found ${R.cells?.length ?? 0}`);
  const ids = (R.cells || []).map((c) => c.id);
  if (ids.join('') !== IDS.join('')) errs.push(`cell ids must be A to H in order, found ${ids.join(',')}`);
  for (const c of R.cells || []) {
    if (!c.tag || !String(c.tag).trim()) errs.push(`${c.id}: tag is empty; give a label of a few words`);
    else if ([...String(c.tag)].length > 12) warns.push(`${c.id}: tag "${c.tag}" is long; keep labels to about six characters or three words`);
    if (!c.why || !String(c.why).trim()) errs.push(`${c.id}: why is empty; one line on what the cell tries (shown only in the history)`);
    const r = checkCellSvg(String(c.svg || ''), c.id);
    errs.push(...r.errs); warns.push(...r.warns);
  }
  if (n === 1) {
    const axes = (R.cells || []).map((c) => (Array.isArray(c.axes) ? c.axes.join('|') : ''));
    if (axes.some((a) => !a)) errs.push('round 1 cells need axes: three words, one from each pair (round or angular, static or dynamic, figurative or letter)');
    else if (new Set(axes).size !== 8) errs.push(`round 1 axes repeat (${axes.join('; ')}); the eight cells are the eight combinations of the three pairs`);
  } else {
    const out = (R.cells || []).filter((c) => c.outlier);
    if (out.length !== 1) errs.push(`round ${n} needs exactly one cell with outlier: true (a deliberate departure), found ${out.length}`);
  }
  return { errs, warns };
}

// --- rendering ------------------------------------------------------------------------------------------------
function prefixIds(svg, p) {
  const ids = [...svg.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  let out = svg;
  for (const id of ids) out = out.split(`id="${id}"`).join(`id="${p}${id}"`).split(`url(#${id})`).join(`url(#${p}${id})`).split(`href="#${id}"`).join(`href="#${p}${id}"`);
  return out;
}
const inline = (svg, cls, p) => prefixIds(String(svg), p).replace(/<\?xml[^>]*>/, '').replace(/<svg\b/, `<svg class="${cls}" aria-hidden="true" focusable="false"`);

function centerHtml(s, R) {
  const chips = (s.prefs || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  if (R.center?.svg) return `<span class="ctitle">${esc(ui(s.lang).center_label)}</span>${inline(R.center.svg, 'cart', `c${R.n}-`)}<span class="ctag">${esc(R.center.tag || '')}</span>${chips ? `<span class="chips">${chips}</span>` : ''}`;
  return `<span class="cname">${esc(s.name)}</span>${s.brief ? `<span class="cbrief">${esc(s.brief)}</span>` : ''}${chips ? `<span class="chips">${chips}</span>` : ''}`;
}

function boardHtml(s, R, live) {
  const cells = new Array(9);
  cells[4] = `<div class="cell center">${centerHtml(s, R)}</div>`;
  R.cells.forEach((c, i) => {
    const picked = R.pick?.ids?.includes(c.id);
    const cls = ['cell', live ? 'pick' : '', c.outlier ? 'outlier' : '', picked ? 'chosen' : ''].filter(Boolean).join(' ');
    const head = `<span class="lab"><b>${c.id}</b>${c.axes ? ` ${esc(c.axes.join(' / '))}` : ''}${c.outlier ? ` <em class="wild">${esc(ui(s.lang).outlier)}</em>` : ''}</span>`;
    const body = `<span class="art">${inline(c.svg, 'big', `r${R.n}${c.id}-`)}</span><span class="small">${inline(c.svg, 's32', `r${R.n}${c.id}s-`)}${inline(c.svg, 's16', `r${R.n}${c.id}t-`)}</span><span class="tag">${esc(c.tag)}</span>`;
    cells[POS[i]] = live
      ? `<button type="button" class="${cls}" data-id="${c.id}" data-tag="${esc(c.tag)}" aria-pressed="false">${head}${body}</button>`
      : `<div class="${cls}" title="${esc(c.why || '')}">${head}${body}</div>`;
  });
  return `<div class="board" data-round="${R.n}">${cells.join('')}</div>`;
}

const CSS = `.wrap{display:flex;flex-direction:column;gap:14px}
.top h1{margin:0}.top .sub{color:var(--muted)}
.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:760px;width:100%}
.cell{background:var(--surface);border:2px solid var(--line);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:5px;min-width:0;color:var(--text);font:inherit;text-align:left}
.pick{cursor:pointer}.pick:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.pick[aria-pressed="true"],.chosen{border-color:var(--accent);box-shadow:0 0 0 3px var(--off)}
.outlier{background:var(--off)}
.center{background:var(--text);color:var(--bg);border-color:var(--text);justify-content:center;align-items:center;text-align:center}
.cname{font-weight:900;font-size:clamp(18px,4vw,30px);line-height:1.2}.cbrief,.ctag,.ctitle{font-size:clamp(11px,2.2vw,14px);opacity:.85}
.cart{width:70%;height:auto}.chips{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.chip{font-size:12px;border:1px solid currentColor;border-radius:99px;padding:0 8px;opacity:.9}
.lab{font-size:13px;color:var(--muted);line-height:1.3}.lab b{font-size:17px;color:var(--text);margin-right:4px}
.art svg{width:100%;height:auto;display:block;border-radius:6px}
.small{display:flex;gap:8px;align-items:center}.s32{width:32px;height:32px}.s16{width:16px;height:16px}
.tag{font-size:13px;line-height:1.35}.wild{font-style:normal;font-size:11px;border:1px solid var(--muted);border-radius:99px;padding:0 6px}
.reply{max-width:760px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.reply .said{flex:1 1 100%;font-size:14px}
.reply input{flex:1 1 200px;min-width:0;font:inherit;font-size:15px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.reply button{font:inherit;font-weight:700;font-size:15px;padding:8px 14px;border-radius:8px;border:0;background:var(--accent);color:#fff;cursor:pointer}
.reply button.alt{background:var(--text);color:var(--bg)}.reply button:disabled{opacity:.45;cursor:default}
.done{font-size:13px;color:var(--muted)}
details{border-top:1px solid var(--line);padding-top:8px}summary{cursor:pointer;font-weight:600}
.hist .board{max-width:520px}.hist .small,.hist .tag{display:none}.note{font-size:14px;color:var(--muted)}
.photo{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.photo img{max-width:220px;border-radius:8px}
.sw{display:flex;gap:6px;flex-wrap:wrap}.sw span{display:inline-flex;align-items:center;gap:6px;font:12px ui-monospace,Consolas,monospace}.sw i{width:22px;height:22px;border-radius:5px;display:inline-block;border:1px solid var(--line)}
.final{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.final img{border-radius:8px;max-width:100%;height:auto}
.px{image-rendering:pixelated}
@media (max-width:520px){.cell{padding:5px;gap:3px}.lab{font-size:11px}.lab b{font-size:15px}.small,.tag{display:none}}`;

const JS = `(function(){var T=JSON.parse(document.getElementById('ui-strings').textContent);
function f(s,v){return s.replace(/\\{(\\w+)\\}/g,function(m,k){return v[k]!=null?v[k]:m;});}
document.querySelectorAll('.board.live').forEach(function(b){
var n=b.dataset.round,said=document.getElementById('said'),inp=document.getElementById('note'),go=document.getElementById('send'),fin=document.getElementById('settle'),done=document.getElementById('done');
function sel(){return Array.prototype.slice.call(b.querySelectorAll('.pick[aria-pressed="true"]'));}
function text(kind){var s=sel();if(!s.length)return'';var ids=s.map(function(c){return c.dataset.id+' ('+c.dataset.tag+')';});var note=inp.value.trim();
var t=kind==='settle'?f(T.copy_settle,{n:n,id:ids[0]}):f(s.length>1?T.copy_mix:T.copy_pick,{n:n,ids:ids.join(T.and)});return t+(note?' | '+note:'');}
function upd(){var t=text('pick');said.textContent=t||T.said_empty;go.disabled=!t;fin.disabled=sel().length!==1;done.textContent='';}
b.querySelectorAll('.pick').forEach(function(c){c.addEventListener('click',function(){var on=c.getAttribute('aria-pressed')==='true';if(!on&&sel().length>=2)return;c.setAttribute('aria-pressed',String(!on));upd();});});
inp.addEventListener('input',upd);
function copy(kind){var t=text(kind);if(!t)return;var ok=function(){done.textContent=T.copied;};var no=function(){inp.value=t;inp.select();done.textContent=T.manual;};
try{navigator.clipboard.writeText(t).then(ok,no);}catch(e){no();}}
go.addEventListener('click',function(){copy('pick');});fin.addEventListener('click',function(){copy('settle');});upd();});})();`;

const STRINGS = JSON.parse(readFileSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'assets', 'strings.json'), 'utf8'));
export const ui = (lang) => ({ ...STRINGS.en, ...(STRINGS[lang] || {}) });
const fmt = (str, v) => String(str).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

export async function renderHtml(s) {
  const T = ui(s.lang);
  const rounds = s.rounds || [];
  const cur = rounds[rounds.length - 1];
  const parts = [];
  const stageLine = s.stage === 'explore'
    ? (cur ? fmt(T.stage_explore, { n: cur.n }) : T.stage_prep)
    : s.stage === 'detail' ? fmt(T.stage_detail, { n: s.settled.round, id: s.settled.id }) : T.stage_done;
  parts.push(`<header class="top"><h1>${esc(s.name)}</h1><p class="sub">${esc(stageLine)}</p></header>`);

  if (s.detail) {
    const d = s.detail, im = d.images || {};
    parts.push(`<section><h2>${esc(T.final_h)}</h2><div class="final">${im.hero ? `<img src="${im.hero}" width="240" height="240" alt="${esc(T.alt_final)}">` : ''}${im.mono ? `<img src="${im.mono}" width="120" height="120" alt="${esc(T.alt_mono)}">` : ''}${im.inverse ? `<img src="${im.inverse}" width="120" height="120" alt="${esc(T.alt_inverse)}">` : ''}</div>
${im.ladder ? `<h3>${esc(T.ladder_h)}</h3><div class="final">${im.ladder.map((l) => `<figure style="margin:0"><img class="px" src="${l.mag}" width="128" height="128" alt="${l.px} px"><figcaption class="note">${l.px} px <img src="${l.png}" width="${l.px}" height="${l.px}" alt="${l.px} px"></figcaption></figure>`).join('')}</div>` : ''}
${im.construction ? `<h3>${esc(T.construction_h)}</h3><img src="${im.construction}" alt="${esc(T.construction_h)}" style="max-width:100%;height:auto">` : ''}
${im.presentation ? `<h3>${esc(T.presentation_h)}</h3><img src="${im.presentation}" alt="${esc(T.presentation_h)}" style="max-width:min(100%,560px);height:auto;border-radius:8px">` : ''}
<p class="note">${esc(d.violations === 0 ? T.check_ok : fmt(T.check_draft, { n: d.violations }))} ${d.fileCount ? esc(fmt(T.exported, { n: d.fileCount })) : ''}</p>
${(d.elements || []).length ? `<details><summary>${esc(T.elements_summary)}</summary><div class="scroll"><table><tr><th>${esc(T.th_element)}</th><th>${esc(T.th_literal)}</th><th>${esc(T.th_figurative)}</th></tr>${d.elements.map((e) => `<tr><td>${esc(e.form)}</td><td>${esc(e.literal)}</td><td>${esc(e.figurative)}</td></tr>`).join('')}</table></div></details>` : ''}</section>`);
  }

  if (cur && s.stage === 'explore') {
    parts.push(`<section>${boardHtml(s, cur, true).replace('class="board"', 'class="board live"')}
<div class="reply"><p class="said" id="said"></p>
<label class="sr" for="note">${esc(T.note_label)}</label><input id="note" type="text" placeholder="${esc(T.note_placeholder)}">
<button type="button" id="send">${esc(T.send)}</button><button type="button" id="settle" class="alt" disabled>${esc(T.settle)}</button>
<span class="done" id="done" aria-live="polite"></span></div></section>`);
  }

  if (s.photo) {
    const sw = Object.entries(s.palette?.roles || {}).map(([k, v]) => `<span><i style="background:${esc(v.hex)}"></i>${esc(k)} ${esc(v.hex)}</span>`).join('');
    parts.push(`<details><summary>${esc(T.photo_summary)}</summary><div class="photo"><img src="${s.photo.dataUri}" alt="${esc(T.alt_photo)}">${sw ? `<div class="sw">${sw}</div>` : ''}${(s.features || []).length ? `<ul>${s.features.map((x) => `<li>${esc(x.label)}${x.differs ? `: ${esc(x.differs)}` : ''}</li>`).join('')}</ul>` : ''}</div></details>`);
  }

  const past = s.stage === 'explore' ? rounds.slice(0, -1) : rounds;
  if (past.length) {
    parts.push(`<details class="hist"><summary>${esc(fmt(T.history, { n: past.length }))}</summary>${past.slice().reverse().map((R) => `<h3>${esc(R.pick ? fmt(T.round_pick, { n: R.n, ids: R.pick.ids.join(T.and) }) : fmt(T.round_h, { n: R.n }))}</h3>${R.pick?.note ? `<p class="note">${esc(fmt(T.you_said, { note: R.pick.note }))}</p>` : ''}${boardHtml(s, R, false)}`).join('')}</details>`);
  }

  const css = `${CSS}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`;
  const state = JSON.stringify(s).replace(/<\//g, '<\\/');
  const strings = JSON.stringify(T).replace(/<\//g, '<\\/');
  return page({ title: fmt(T.title, { name: s.name }), description: fmt(T.description, { name: s.name }), lang: s.lang, body: `<div class="wrap">${parts.join('\n')}</div>\n<script type="application/json" id="ui-strings">${strings}</script>\n<script>${JS}</script>\n<script type="application/json" id="design-state">${state}</script>`, extraCss: css });
}

async function save(file, s) {
  s.updated = now();
  writeFileSync(file, await renderHtml(s));
}

// --- board image for the reviewer and for chat ---------------------------------------------------------------
// Wrap to about `width` wide characters per line: CJK breaks between characters, Latin between words.
const isWide = (ch) => /[\u2e80-\uffff]/.test(ch);
export const textWidth = (str) => [...String(str)].reduce((n, ch) => n + (isWide(ch) ? 1 : 0.55), 0);
export function wrapText(text, width) {
  const tokens = String(text).match(/[\u2e80-\uffff]|[^\s\u2e80-\uffff]+|\s+/g) || [];
  const len = (str) => [...str].reduce((n, ch) => n + (isWide(ch) ? 1 : 0.55), 0);
  const out = []; let line = '';
  for (const t of tokens) {
    if (/^\s+$/.test(t)) { if (line) line += ' '; continue; }
    if (line && len(line + t) > width) { out.push(line.trim()); line = ''; }
    line += t;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

export async function boardPng(s, R, out) {
  const sharp = await loadSharp();
  const C = 300, G = 10, W = 3 * C + 4 * G, H = W + 50;
  const T = ui(s.lang);
  const layers = [], text = [`<text x="${G}" y="34" font-size="24" font-weight="700">${esc(s.name)} / ${esc(fmt(T.round_h, { n: R.n }))}</text>`];
  for (let k = 0; k < 9; k++) {
    const x = G + (k % 3) * (C + G), y = 50 + G + Math.floor(k / 3) * (C + G);
    if (k === 4) {
      layers.push({ input: { create: { width: C, height: C, channels: 4, background: '#27272a' } }, left: x, top: y });
      if (R.center?.svg) {
        layers.push({ input: await svgToPng(R.center.svg, 200), left: x + 50, top: y + 44 });
        text.push(`<text x="${x + 14}" y="${y + 30}" font-size="18" style="fill:#fafafa">${esc(T.center_label)}</text>`);
      } else {
        const nameSize = Math.min(34, Math.floor(260 / Math.max(1, textWidth(s.name))));
        text.push(`<text x="${x + C / 2}" y="${y + 100}" font-size="${nameSize}" font-weight="700" text-anchor="middle" style="fill:#fafafa">${esc(s.name)}</text>`);
        const lines = wrapText(s.brief || '', 14);
        lines.slice(0, 4).forEach((l, i) => text.push(`<text x="${x + C / 2}" y="${y + 140 + i * 24}" font-size="17" text-anchor="middle" style="fill:#d4d4d8">${esc(i === 3 && lines.length > 4 ? `${l.slice(0, -1)}...` : l)}</text>`));
      }
      if ((s.prefs || []).length) wrapText(s.prefs.join(' / '), 17).slice(0, 2).forEach((l, i, all) => text.push(`<text x="${x + C / 2}" y="${y + C - 14 - (all.length - 1 - i) * 18}" font-size="14" text-anchor="middle" style="fill:#a1a1aa">${esc(l)}</text>`));
      continue;
    }
    const c = R.cells[POS.indexOf(k)];
    layers.push({ input: { create: { width: C, height: C, channels: 4, background: c.outlier ? '#fde7dd' : '#ffffff' } }, left: x, top: y });
    layers.push({ input: await svgToPng(c.svg, 200), left: x + 20, top: y + 44 });
    layers.push({ input: await svgToPng(c.svg, 32), left: x + 234, top: y + 150 });
    layers.push({ input: await svgToPng(c.svg, 16), left: x + 242, top: y + 200 });
    text.push(`<text x="${x + 16}" y="${y + 32}" font-size="24" font-weight="700">${c.id}</text>`);
  }
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font-family:${SVG_FONT};fill:#18181b}</style>${text.join('')}</svg>`;
  await sharp({ create: { width: W, height: H, channels: 3, background: '#e7e5e4' } }).composite([...layers, { input: Buffer.from(overlay), left: 0, top: 0 }]).png().toFile(out);
  return out;
}

// --- commands -------------------------------------------------------------------------------------------------
async function cmdInit() {
  const [dir] = positional();
  if (!dir) fail('usage: init <dir> --name "<brand>" [--brief "<one sentence>"] [--photo <file>]');
  const file = join(dir, 'design.html');
  if (existsSync(file)) fail(`${slash(file)} already exists; continue it with: node "${SELF}" status "${slash(file)}"`);
  const name = opt('--name') || basename(resolve(dir));
  const s = { version: 2, name, slug: slugOf(name), lang: opt('--lang', 'en'), brief: opt('--brief', ''), created: now(), updated: now(), stage: 'explore', prefs: [], photo: null, palette: null, features: null, rounds: [], settled: null, detail: null, eval: null, log: [{ at: now(), event: 'init' }] };
  const photo = opt('--photo');
  if (photo) {
    if (!existsSync(photo)) fail(`photo ${photo} does not exist`);
    const sharp = await loadSharp();
    const buf = await sharp(photo).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    const meta = await sharp(buf).metadata();
    s.photo = { name: basename(photo), width: meta.width, height: meta.height, dataUri: dataUri(buf, 'image/jpeg') };
  }
  const picks = opt('--picks');
  if (picks) { if (!existsSync(picks)) fail(`${picks} does not exist`); s.eval = JSON.parse(readFileSync(picks, 'utf8')); }
  mkdirSync(dir, { recursive: true });
  await save(file, s);
  console.log(`created ${slash(file)}${s.photo ? ` with the photo embedded (${s.photo.width}x${s.photo.height})` : ''}`);
  printStatus(file, s);
}

function printStatus(file, s) {
  const rounds = s.rounds || [], cur = rounds[rounds.length - 1];
  const lines = [`Design ${slash(file)}: ${s.name}${s.brief ? ` (${s.brief})` : ''}, stage ${s.stage}, ${rounds.length} round${rounds.length === 1 ? '' : 's'}`];
  if (s.prefs?.length) lines.push(`Learned from picks: ${s.prefs.join(', ')}`);
  for (const R of rounds) lines.push(`  round ${R.n}: ${R.pick ? `picked ${R.pick.ids.join('+')}${R.pick.note ? ` ("${R.pick.note}")` : ''}` : 'waiting for a pick'}`);
  if (s.stage === 'explore') {
    if (!cur) lines.push(`Next: draw round 1 (references/rounds.md)${s.photo && !s.palette ? '; there is a photo, so measure it first (references/photo.md)' : ''}.`);
    else if (!cur.pick) lines.push(`Next: show round ${cur.n} and wait for the user's pick; record it with: node "${SELF}" pick "${slash(file)}" <letters> --note "..."`);
    else lines.push(`Next: draw round ${cur.n + 1} around ${cur.pick.ids.join('+')}, or settle if the user said this is the one.`);
  } else if (s.stage === 'detail') lines.push(`Next: the detail stage (references/detail.md), then: node "${SELF}" detail "${slash(file)}" <detail.json>`);
  else lines.push('Done. Deliverables are in the export folder next to design.html.');
  if (s.eval && s.stage === 'explore') {
    const n = cur ? (cur.pick ? cur.n + 1 : cur.n) : 1;
    const rule = s.eval.rounds?.[String(n)] || s.eval.default;
    lines.push(`Eval mode: nobody will answer. Round ${n} pick: ${rule || 'pick what the reviewer ranks first'}${s.eval.settleAt ? `. Settle at round ${s.eval.settleAt}.` : ''} Do not publish pages or send files.`);
  }
  lines.push(`Work folder for scratch files: ${slash(workDir(file, s))}`);
  console.log(lines.join('\n'));
}

function cmdStatus() {
  try {
    const [p] = positional();
    if (p) { const file = fileOf(p); if (!existsSync(file)) { console.log(`No design at ${slash(file)}. Start one with: node "${SELF}" init "${slash(dirname(file))}" --name "<brand>"`); return; } printStatus(file, readState(file)); return; }
    const rows = [];
    if (existsSync(ROOT)) for (const d of readdirSync(ROOT)) { const f = join(ROOT, d, 'design.html'); if (existsSync(f)) { try { rows.push({ f, s: readState(f), t: statSync(f).mtimeMs }); } catch { /* skip unreadable */ } } }
    if (!rows.length) { console.log(`No logo projects under ${slash(ROOT)} yet. Start one with: node "${SELF}" init "${slash(ROOT)}/<name>" --name "<brand>" --brief "<one sentence>"`); return; }
    console.log(`Logo projects under ${slash(ROOT)} (most recent first):`);
    for (const { f, s } of rows.sort((a, b) => b.t - a.t).slice(0, 8)) console.log(`  ${s.name}: ${s.stage}, ${s.rounds.length} rounds  (${slash(f)})`);
  } catch (e) { console.log(`status could not run: ${e.message}`); }
}

async function cmdRound() {
  const [p, rj] = positional();
  const file = fileOf(p), s = readState(file);
  if (s.stage !== 'explore') fail(`the design is settled (stage ${s.stage}); rounds are over`);
  if (!rj || !existsSync(rj)) fail('give the round JSON file (format in references/rounds.md)');
  let R;
  try { R = JSON.parse(readFileSync(rj, 'utf8')); } catch (e) { fail(`${rj} is not valid JSON: ${e.message}`); }
  const prev = s.rounds[s.rounds.length - 1];
  if (prev && !prev.pick) fail(`round ${prev.n} has no pick yet; record the user's pick first`);
  const n = (prev?.n || 0) + 1;
  R.n = n;
  const { errs, warns } = checkRound(R, n);
  for (const c of R.cells || []) {
    if (!c.svg) continue;
    try { const ink = await inkAt16(c.svg); if (ink < 0.02) errs.push(`${c.id}: almost nothing is left at 16 px (${Math.round(ink * 100)}% of pixels); thicken or simplify it`); } catch (e) { errs.push(`${c.id}: does not render (${e.message})`); }
  }
  if (n > 1) {
    const ids = prev.pick.ids;
    if (!R.center?.svg) {
      if (ids.length === 1) R.center = { svg: prev.cells.find((c) => c.id === ids[0]).svg, tag: prev.cells.find((c) => c.id === ids[0]).tag, from: `${prev.n}${ids[0]}` };
      else errs.push(`the user mixed ${ids.join(' and ')}; draw the merged mark yourself and put it in center.svg`);
    }
    if (R.center?.svg) { const r = checkCellSvg(R.center.svg, 'center'); errs.push(...r.errs); }
  }
  for (const w of warns) console.log(`WARN ${w}`);
  if (errs.length) { console.log(errs.map((e) => `FAIL ${e}`).join('\n')); console.log(`FAIL round ${n} not added; fix ${errs.length} problem${errs.length === 1 ? '' : 's'} and run again`); process.exit(1); }
  s.rounds.push({ n, center: R.center || null, cells: R.cells.map(({ id, axes, tag, why, svg, outlier }) => ({ id, ...(axes ? { axes } : {}), tag, why, svg, ...(outlier ? { outlier: true } : {}) })), pick: null, at: now() });
  s.log.push({ at: now(), event: `round ${n}` });
  await save(file, s);
  const png = await boardPng(s, s.rounds[s.rounds.length - 1], join(workDir(file, s), `round-${n}.png`));
  if (!args.includes('--keep') && resolve(rj).startsWith(resolve(workDir(file, s)))) rmSync(rj, { force: true });
  console.log(`added round ${n} to ${slash(file)}\nboard image: ${slash(png)}`);
}

async function cmdPick() {
  const [p, idsArg] = positional();
  const file = fileOf(p), s = readState(file);
  const cur = s.rounds[s.rounds.length - 1];
  if (!cur) fail('there is no round yet');
  if (s.stage !== 'explore') fail('the design is settled; picks are over');
  const ids = [...new Set(String(idsArg || '').toUpperCase().match(/[A-H]/g) || [])];
  if (!ids.length || ids.length > 2) fail('give one letter, or two to mix them, for example: pick design.html B  or  pick design.html "B D"');
  cur.pick = { ids, note: opt('--note', ''), at: now() };
  if (opt('--prefs') != null) s.prefs = opt('--prefs').split(/[,\u3001]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
  s.log.push({ at: now(), event: `pick round ${cur.n}: ${ids.join('+')}` });
  await save(file, s);
  console.log(`round ${cur.n}: picked ${ids.join(' and ')}${cur.pick.note ? ` ("${cur.pick.note}")` : ''}. Next: round ${cur.n + 1} around it, or settle when the user says this is the one.`);
}

async function cmdSettle() {
  const [p, id] = positional();
  const file = fileOf(p), s = readState(file);
  const n = Number(opt('--round', s.rounds.length));
  const R = s.rounds.find((r) => r.n === n);
  if (!R) fail(`no round ${n}`);
  const want = String(id || '').toUpperCase();
  const cell = want === 'CENTER' ? (R.center?.svg ? { id: 'center', ...R.center } : null) : R.cells.find((c) => c.id === want);
  if (!cell) fail(`round ${n} has no cell ${id}; give A to H, or center`);
  if (!R.pick && want !== 'CENTER') R.pick = { ids: [want], note: opt('--note', ''), at: now() };
  s.settled = { round: n, id: cell.id, tag: cell.tag, svg: cell.svg };
  s.stage = 'detail';
  s.log.push({ at: now(), event: `settle ${n}${cell.id}` });
  await save(file, s);
  console.log(`settled on round ${n} ${cell.id} (${cell.tag}). Next: the detail stage (references/detail.md).`);
}

async function cmdDetail() {
  const [p, dj] = positional();
  const file = fileOf(p), s = readState(file);
  if (s.stage === 'explore') fail('settle on a direction first');
  if (!dj || !existsSync(dj)) fail('give the detail JSON file (format in references/detail.md)');
  const D = JSON.parse(readFileSync(dj, 'utf8'));
  if (!D.mark || !D.constants) fail('detail JSON needs mark (the master SVG text) and constants');
  const W = join(workDir(file, s), 'detail');
  rmSync(W, { recursive: true, force: true }); mkdirSync(W, { recursive: true });
  const C = { ...D.constants, mark: 'mark.svg' };
  writeFileSync(join(W, 'mark.svg'), D.mark);
  const ladder = {};
  for (const [px, svg] of Object.entries(D.ladder || {})) { writeFileSync(join(W, `sprite-${px}.svg`), svg); ladder[px] = `sprite-${px}.svg`; }
  if (Object.keys(ladder).length) C.ladder = { ...ladder, why: D.constants.ladder?.why || 'redrawn small sizes' };
  writeFileSync(join(W, 'constants.json'), JSON.stringify(C, null, 2));
  const results = checkConstants(join(W, 'constants.json'));
  const violations = results.reduce((k, r) => k + r.violations.length, 0);
  for (const r of results) for (const v of r.violations) console.log(`FAIL [${v.rule}] ${r.label}: ${v.msg}`);
  if (violations && !args.includes('--draft')) fail(`${violations} construction violation${violations === 1 ? '' : 's'}; fix the SVG or the constants and run again (or --draft to show it anyway)`);
  const sharp = await loadSharp();
  const r = rolesFor(D.mark, C);
  const out = join(dirname(file), 'export');
  mkdirSync(out, { recursive: true });
  const cons = constructionSvg(C, D.mark);
  writeFileSync(join(out, 'construction.svg'), cons);
  const consPng = await sharp(Buffer.from(cons)).png().toBuffer();
  writeFileSync(join(out, 'construction.png'), consPng);
  const pres = presentationSvg(D.mark, { C, index: true, size: 1200, ...(D.presentation || {}) });
  const presPng = await sharp(Buffer.from(pres)).png().toBuffer();
  writeFileSync(join(out, 'presentation.png'), presPng);
  const res = await exportPackage(join(W, 'constants.json'), { out });
  const lad = [];
  for (const px of [16, 32, 64]) { const src = D.ladder?.[px] || D.mark; const png = await svgToPng(src, px); lad.push({ px, png: dataUri(png), mag: dataUri(await sharp(png).resize(128, 128, { kernel: 'nearest' }).png().toBuffer()) }); }
  s.detail = {
    violations, elements: D.elements || [], constants: D.constants, mark: D.mark, ladder: D.ladder || {},
    fileCount: res.files.length + 3,
    images: { hero: dataUri(await svgToPng(D.mark, 240)), mono: dataUri(await svgToPng(variant(D.mark, 'mono', r), 120, 120, '#ffffff')), inverse: dataUri(await svgToPng(variant(D.mark, 'inverse', r), 120, 120, r.ink)), ladder: lad, construction: dataUri(consPng), presentation: dataUri(await sharp(presPng).resize(800).png().toBuffer()) },
  };
  s.stage = violations ? 'detail' : 'done';
  s.log.push({ at: now(), event: `detail (${violations} violations)` });
  await save(file, s);
  copyFileSync(file, join(out, 'design.html'));
  console.log(`${violations ? 'draft' : 'final'}: ${violations} violations; ${res.files.length} files plus construction and presentation in ${slash(out)}; design.html updated`);
}

async function cmdSet() {
  const [p, key, value] = positional();
  const file = fileOf(p), s = readState(file);
  if (!['name', 'brief'].includes(key)) fail('set name|brief "<text>"');
  s[key] = String(value || '');
  await save(file, s);
  console.log(`${key} set`);
}

async function cmdPhoto() {
  const [p] = positional();
  const file = fileOf(p), s = readState(file);
  if (!s.photo) fail('this design has no photo; add one with init --photo');
  const f = join(workDir(file, s), 'photo.jpg');
  writeFileSync(f, Buffer.from(s.photo.dataUri.split(',')[1], 'base64'));
  console.log(`${slash(f)} (${s.photo.width}x${s.photo.height}); measure on this copy, coordinates are in its pixels`);
}

async function cmdAttach() {
  const [p] = positional();
  const file = fileOf(p), s = readState(file);
  const pal = opt('--palette'), feat = opt('--features');
  if (!pal && !feat) fail('give --palette <palette.json> and/or --features <features.json>');
  if (pal) { const j = JSON.parse(readFileSync(pal, 'utf8')); if (!j.roles?.ink || !j.roles?.paper) fail('palette.json needs roles.ink and roles.paper (references/photo.md)'); s.palette = { roles: j.roles }; }
  if (feat) { const j = JSON.parse(readFileSync(feat, 'utf8')); s.features = (j.features || []).map((f) => ({ label: f.label, differs: f.differs, chosen: !!f.chosen })); }
  await save(file, s);
  console.log(`attached${pal ? ' palette' : ''}${feat ? ' features' : ''} to ${slash(file)}`);
}

async function cmdPreview() {
  const [p, rj] = positional();
  const file = fileOf(p), s = readState(file);
  if (!rj || !existsSync(rj)) fail('give the round JSON file');
  const R = JSON.parse(readFileSync(rj, 'utf8'));
  const prev = s.rounds[s.rounds.length - 1];
  R.n = prev ? (prev.pick ? prev.n + 1 : prev.n) : 1;
  if (R.n > 1 && !R.center?.svg && prev?.pick?.ids.length === 1) R.center = { svg: prev.cells.find((c) => c.id === prev.pick.ids[0]).svg };
  const { errs, warns } = checkRound(R, R.n);
  for (const c of R.cells || []) { if (!c.svg) continue; try { const ink = await inkAt16(c.svg); if (ink < 0.02) errs.push(`${c.id}: almost nothing is left at 16 px`); } catch (e) { errs.push(`${c.id}: does not render (${e.message})`); } }
  for (const w of warns) console.log(`WARN ${w}`);
  for (const e of errs) console.log(`FAIL ${e}`);
  const out = opt('--out') || join(workDir(file, s), `preview-${R.n}.png`);
  if ((R.cells || []).length === 8 && (R.cells || []).every((c) => c.svg)) { await boardPng(s, R, out); console.log(`board image: ${slash(out)}`); }
  console.log(errs.length ? `FAIL ${errs.length} problem${errs.length === 1 ? '' : 's'}; fix before adding the round` : 'PASS the round can be added');
  if (errs.length) process.exit(1);
}

async function cmdPng() {
  const [p] = positional();
  const file = fileOf(p), s = readState(file);
  const n = Number(opt('--round', s.rounds.length));
  const R = s.rounds.find((r) => r.n === n);
  if (!R) fail(`no round ${n}`);
  const out = opt('--out') || join(workDir(file, s), `round-${n}.png`);
  await boardPng(s, R, out);
  console.log(slash(out));
}

function cmdWork() { const [p] = positional(); const file = fileOf(p); console.log(slash(workDir(file, readState(file)))); }

const COMMANDS = { status: cmdStatus, init: cmdInit, round: cmdRound, pick: cmdPick, settle: cmdSettle, detail: cmdDetail, set: cmdSet, photo: cmdPhoto, attach: cmdAttach, png: cmdPng, preview: cmdPreview, work: cmdWork };
if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  const c = COMMANDS[args[0]];
  if (!c) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(args[0] ? 1 : 0); }
  try { await c(); } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

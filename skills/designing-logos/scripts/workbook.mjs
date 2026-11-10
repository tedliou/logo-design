#!/usr/bin/env node
// Workbook for one logo project: state, gates, answers, decisions, and JSON checks.
// Every gate reads its state from here, so a new session (or a compacted one) can continue.
//
//   node workbook.mjs init <dir> --name "<brand>" [--photo <file>]... [--scope full|ideation] [--answers <answers.json>]
//   node workbook.mjs status [<dir>] [--json]          no dir: list workbooks under $LOGO_WORK_ROOT
//   node workbook.mjs answer <dir> <field> "<value>" --source said|chose|default [--note "<user's note>"]
//   node workbook.mjs confirm <dir> <field>...         a default the user saw again at G4 and kept
//   node workbook.mjs cond <dir> photo=true|false attributes=<n> register=true|false
//   node workbook.mjs pass <dir> <gate> --decision "..." --reason "..." [--question "..."] [--options "a | b"] [--criteria "..."] [--carry "..."] [--source said|chose|default]
//   node workbook.mjs reopen <dir> <gate> --reason "..."
//   node workbook.mjs taste <dir> --like|--dislike "<what>" --reason "<why>" [--global]
//   node workbook.mjs check <dir>
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkConstants } from './check.mjs';

const SELF = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = process.env.LOGO_WORK_ROOT || join(homedir(), 'logo-work');

// --- vocabulary -------------------------------------------------------------------------------
export const MEANING_LENSES = ['subject', 'name', 'audience', 'action', 'method', 'analogy', 'time', 'tension'];
export const MOTIF_LENSES = ['part', 'shape', 'gesture', 'object', 'sign', 'trace', 'structure', 'analogy'];
export const FORM_OPS = ['silhouette', 'skeleton', 'motion', 'figure-ground', 'subtraction', 'fusion', 'substitution', 'cut'];
export const FEATURE_TYPES = ['outline', 'structure', 'gesture', 'relation'];
export const REFERENCE_MODES = ['likeness', 'cause', 'convention'];
const SOURCES = { said: 'said by the user', chose: 'chosen from options', default: 'default not vetoed' };

// Brief fields asked in P0: [key, heading in brief.md]
export const FIELDS = [
  ['purpose', 'Purpose'],
  ['core', 'Core sentence'],
  ['themes', 'Themes'],
  ['assets', 'Existing assets'],
  ['feeling', 'Feeling'],
  ['avoid', 'Must not look like'],
  ['references', 'Admired work'],
  ['localStyle', 'Local style signal'],
  ['culture', 'Cultural associations'],
  ['abstraction', 'Abstraction level'],
  ['color', 'Color'],
  ['minSize', 'Smallest size'],
  ['success', 'Success test'],
  ['register', 'Trademark or formal use'],
];
const REQUIRED = { full: FIELDS.map((f) => f[0]), ideation: ['core', 'themes'] };

// Gates in order. cond: the state.conditions key that decides whether the gate appears.
export const GATES = [
  { id: 'G1', phase: 'P0', title: 'Brief', read: ['interview.md'], files: [] },
  { id: 'G2', phase: 'P1', title: 'Features', read: ['abstraction.md', 'color.md'], files: ['features.json', 'palette.json'], cond: 'photo' },
  { id: 'G3', phase: 'P2', title: 'Motifs and concepts', read: ['mandala.md'], files: ['mandala.json'] },
  { id: 'G4', phase: 'P3', title: 'Direction', read: ['research.md', 'style-recipes.md', 'mandala.md', 'rubric.md'], files: ['references.md', 'directions.json', 'elements.json', 'sheets/review-G4.md'], scope: 'full' },
  { id: 'G5', phase: 'P4', title: 'Variants', read: ['mandala.md', 'rubric.md'], files: ['variants.json', 'sheets/review-G5.md'], cond: 'attributes', scope: 'full' },
  { id: 'TM', phase: 'P5', title: 'Similar-mark search (by the user)', read: ['research.md'], files: [], cond: 'register', scope: 'full' },
  { id: 'G6', phase: 'P5', title: 'Construction and delivery', read: ['construction.md', 'color.md'], files: ['constants.json', 'export/rationale.html'], scope: 'full' },
];

// --- small helpers ----------------------------------------------------------------------------
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flags = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const has = (name) => args.includes(name);
const BOOLEAN_FLAGS = new Set(['--json', '--global']);
const positional = () => { const out = []; for (let i = 1; i < args.length; i++) { if (args[i].startsWith('--')) { if (!BOOLEAN_FLAGS.has(args[i])) i++; continue; } out.push(args[i]); } return out; };
function fail(msg) { console.log(`ERROR ${msg}`); process.exit(1); }
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const statePath = (dir) => join(dir, 'state.json');
function load(dir) {
  if (!dir) fail('give the workbook folder, for example: node workbook.mjs status <dir>');
  if (!existsSync(statePath(dir))) fail(`${dir} has no state.json. Create it with: node "${SELF}" init "${dir}" --name "<brand>"`);
  return readJson(statePath(dir));
}
function save(dir, s) { s.updated = now(); writeFileSync(statePath(dir), JSON.stringify(s, null, 2) + '\n'); }
const fieldKey = (name) => { const f = FIELDS.find(([k, en]) => [k, en].some((v) => v.toLowerCase() === String(name).toLowerCase())); return f ? f[0] : null; };
const gateOf = (id) => GATES.find((g) => g.id === String(id).toUpperCase());
const truthy = (v) => /^(true|yes|y|1)$/i.test(String(v).trim());
const falsy = (v) => /^(false|no|n|0)$/i.test(String(v).trim());

// --- gate logic -------------------------------------------------------------------------------
// Returns 'done' | 'skip' | 'open' | 'undecided' for each gate, plus why.
export function gateStates(s) {
  return GATES.map((g) => {
    const done = s.gates?.[g.id]?.status === 'done';
    if (g.scope && g.scope !== s.scope) return { ...g, state: 'skip', why: `scope is ${s.scope}` };
    if (done) return { ...g, state: 'done', why: s.gates[g.id].at.slice(0, 10) };
    if (g.cond === 'photo') return s.conditions.photo ? { ...g, state: 'open', why: 'a photo was given' } : { ...g, state: 'skip', why: 'no photo: inventory the letterforms and domain symbols instead, without stopping' };
    if (g.cond === 'attributes') {
      const n = s.conditions.attributes;
      if (n == null) return { ...g, state: 'undecided', why: 'set attributes=<n> at G4 (how many attributes the variants compare)' };
      return n > 2 ? { ...g, state: 'open', why: `${n} attributes to compare` } : { ...g, state: 'skip', why: `${n} attributes: ask the variant questions inside G4` };
    }
    if (g.cond === 'register') {
      const r = s.conditions.register;
      if (r == null) return { ...g, state: 'undecided', why: 'ask the formal-use question in G1, then set register=true|false' };
      return r ? { ...g, state: 'open', why: 'the mark will be registered or used commercially' } : { ...g, state: 'skip', why: 'personal or informal use' };
    }
    return { ...g, state: 'open', why: '' };
  });
}
const currentGate = (s) => gateStates(s).find((g) => g.state === 'open' || g.state === 'undecided') || null;
const unconfirmedDefaults = (s) => Object.entries(s.answers || {}).filter(([, a]) => a.source === 'default' && !a.confirmed).map(([k]) => k);
const missingFields = (s) => REQUIRED[s.scope].filter((k) => !s.answers?.[k]);

// --- brief.md is generated from the answers, so the brief and state.json never disagree --------
function writeBrief(dir, s) {
  const lines = [`# Brief: ${s.name}`, '', `Scope: ${s.scope}. Generated from state.json by workbook.mjs; record answers with "workbook.mjs answer", not by editing this file.`, ''];
  for (const [k, en] of FIELDS) {
    const a = s.answers?.[k];
    const tag = !a ? '' : a.source === 'default' ? (a.confirmed ? ' (default, confirmed at G4)' : ' (default, not confirmed yet)') : ` (${a.source})`;
    lines.push(`## ${en}${tag}`, '', a ? a.value : (REQUIRED[s.scope].includes(k) ? 'TODO' : '(not asked in this scope)'), '');
    if (a?.note) lines.push(`User's note: ${a.note}`, '');
  }
  writeFileSync(join(dir, 'brief.md'), lines.join('\n'));
}

function logDecision(dir, gate, o) {
  const g = gateOf(gate);
  const rows = [['Question', o.question], ['Options', o.options], ['Criteria', o.criteria], ['Decision', o.decision], ['Reason', o.reason && `${o.reason}${o.source ? ` (${SOURCES[o.source] || o.source})` : ''}`], ['Carry over', o.carry]]
    .filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`);
  appendFileSync(join(dir, 'decisions.md'), `\n## ${gate} ${g ? g.title : ''} (${now().slice(0, 16).replace('T', ' ')} UTC)\n\n${rows.join('\n')}\n`);
}

// --- JSON checks ------------------------------------------------------------------------------
const nonEmpty = (v) => typeof v === 'string' ? v.trim().length > 0 : v != null;
const lensKey = (list, v) => (list.includes(v) ? v : null);
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

export function checkFile(dir, file) {
  const p = join(dir, file), errs = [];
  if (!existsSync(p)) return [`${file} is missing`];
  if (!file.endsWith('.json')) return readFileSync(p, 'utf8').trim() ? [] : [`${file} is empty`];
  let j;
  try { j = readJson(p); } catch (e) { return [`${file} is not valid JSON: ${e.message}`]; }
  const E = (m) => errs.push(`${file}: ${m}`);
  if (file === 'mandala.json') {
    if (!nonEmpty(j.core)) E('core is empty; write the core sentence');
    if (!Array.isArray(j.themes) || j.themes.length !== 8) E(`needs 8 themes, found ${j.themes?.length ?? 0}`);
    const seenLens = {}, seenMotif = new Map(), ids = new Set();
    (j.themes || []).forEach((t, ti) => {
      const where = t.id || `theme ${ti + 1}`;
      const lk = lensKey(MEANING_LENSES, t.lens);
      if (!lk) E(`${where}: lens "${t.lens}" is not one of ${MEANING_LENSES.join(', ')}`);
      else if (seenLens[lk]) E(`${where}: lens ${lk} is already used by ${seenLens[lk]}; merge the two themes or move one to a lens no theme uses yet`);
      else seenLens[lk] = where;
      if (!nonEmpty(t.label)) E(`${where}: label is empty`);
      if (!Array.isArray(t.motifs) || t.motifs.length !== 8) E(`${where}: needs 8 motifs, found ${t.motifs?.length ?? 0}`);
      const motifLens = {};
      (t.motifs || []).forEach((m, mi) => {
        const mw = m.id || `${where} motif ${mi + 1}`;
        if (m.id) { if (ids.has(m.id)) E(`${mw}: duplicate id`); ids.add(m.id); }
        const mk = lensKey(MOTIF_LENSES, m.lens);
        if (!mk) E(`${mw}: lens "${m.lens}" is not one of ${MOTIF_LENSES.join(', ')}`);
        else if (motifLens[mk]) E(`${mw}: lens ${mk} is already used by ${motifLens[mk]} in ${where}; rewrite one so the theme covers eight different lenses`);
        else motifLens[mk] = mw;
        if (!nonEmpty(m.label)) E(`${mw}: label is empty`);
        else {
          const key = m.label.trim().toLowerCase();
          if (seenMotif.has(key)) E(`${mw}: "${m.label}" repeats ${seenMotif.get(key)}`);
          else seenMotif.set(key, mw);
        }
        if (typeof m.drawable !== 'boolean') E(`${mw}: drawable must be true or false (rewrite traits as a gesture or analogy that can be drawn)`);
      });
    });
    (j.concepts || []).forEach((c, ci) => {
      const cw = c.id || `concept ${ci + 1}`;
      if (!nonEmpty(c.text)) E(`${cw}: text is empty`);
      for (const id of c.motifs || []) if (!ids.has(id)) E(`${cw}: motif ${id} is not in the grid`);
      if (!c.motifs || c.motifs.length < 2 || c.motifs.length > 3) E(`${cw}: a concept joins 2 or 3 motifs, found ${c.motifs?.length ?? 0}`);
    });
    (j.forms || []).forEach((f, fi) => {
      const fw = `form grid ${f.concept || fi + 1}`;
      if (!Array.isArray(f.cells) || f.cells.length !== 8) E(`${fw}: needs 8 cells, found ${f.cells?.length ?? 0}`);
      const ops = new Set();
      (f.cells || []).forEach((c) => {
        const ok = lensKey(FORM_OPS, c.op);
        if (!ok) E(`${fw}: operation "${c.op}" is not one of ${FORM_OPS.join(', ')}`);
        else if (ops.has(ok)) E(`${fw}: operation ${ok} appears twice`);
        else ops.add(ok);
        if (c.sketch && !existsSync(join(dir, c.sketch))) E(`${fw}: sketch ${c.sketch} does not exist`);
      });
    });
  } else if (file === 'features.json') {
    if (!nonEmpty(j.source)) E('source is empty; name the photo the features were measured on');
    if (!Array.isArray(j.features) || !j.features.length) E('features is empty');
    (j.features || []).forEach((f, i) => {
      const w = f.id || `feature ${i + 1}`;
      if (!lensKey(FEATURE_TYPES, f.type)) E(`${w}: type "${f.type}" is not one of ${FEATURE_TYPES.join(', ')}`);
      if (!nonEmpty(f.label)) E(`${w}: label is empty`);
      if (!nonEmpty(f.differs)) E(`${w}: differs is empty; write how this subject differs from a typical one (the caricature rule)`);
      if (!f.where && !f.points) E(`${w}: give where [x0,y0,x1,y1] or points measured on the photo`);
    });
  } else if (file === 'palette.json') {
    const r = j.roles || {};
    for (const k of ['ink', 'paper']) if (!isHex(r[k]?.hex)) E(`roles.${k}.hex must be #rrggbb`);
    for (const [k, v] of Object.entries(r)) { if (!isHex(v?.hex)) E(`roles.${k}.hex must be #rrggbb`); if (!nonEmpty(v?.why)) E(`roles.${k}.why is empty; say where the color comes from`); }
  } else if (file === 'elements.json') {
    const list = Array.isArray(j) ? j : j.elements;
    if (!Array.isArray(list) || !list.length) E('needs a list of elements');
    (list || []).forEach((e, i) => {
      const w = e.id || `element ${i + 1}`;
      for (const k of ['form', 'literal', 'figurative']) if (!nonEmpty(e[k])) E(`${w}: ${k} is empty`);
      if (!lensKey(REFERENCE_MODES, e.mode)) E(`${w}: mode "${e.mode}" is not one of ${REFERENCE_MODES.join(', ')}`);
    });
  } else if (file === 'directions.json') {
    const list = j.directions || [];
    for (const e of checkDirections(list)) E(e);
    for (const d of list) if (d.svg && !existsSync(join(dir, d.svg))) E(`${d.id}: ${d.svg} does not exist`);
  } else if (file === 'variants.json') {
    if (!nonEmpty(j.base)) E('base is empty; name the direction SVG the variants start from');
    if (!Array.isArray(j.attributes) || !j.attributes.length) E('attributes is empty');
    (j.attributes || []).forEach((a, i) => {
      const w = a.name || `attribute ${i + 1}`;
      if ((a.values || []).length < 2) E(`${w}: needs at least 2 values to compare`);
      for (const v of a.values || []) if (!v.svg || !existsSync(join(dir, v.svg))) E(`${w}: ${v.id || 'a value'} has no SVG at ${v.svg}`);
      for (const d of a.dropped || []) if (!nonEmpty(d.reason)) E(`${w}: dropped ${d.id} needs a reason`);
    });
  } else if (file === 'constants.json') {
    for (const k of ['canvas', 'grid', 'angles', 'colors']) {
      if (!j[k]) E(`${k} is missing`);
      else if (!nonEmpty(j[k].why)) E(`${k}.why is empty; every number needs its source`);
    }
    if (j.canvas && !(j.canvas.size > 0)) E('canvas.size must be a number');
    if (j.grid && !(j.grid.unit > 0)) E('grid.unit must be a number');
    if (j.angles && !Array.isArray(j.angles.set)) E('angles.set must be a list of degrees');
    for (const k of ['ink', 'paper']) if (j.colors && !isHex(j.colors[k]?.hex)) E(`colors.${k}.hex must be #rrggbb`);
    (j.curves || []).forEach((c, i) => { if (!nonEmpty(c.name) || !c.match) E(`curves[${i}] needs name and match`); if (!nonEmpty(c.why)) E(`curves[${i}].why is empty`); });
    if (j.mark && !existsSync(join(dir, j.mark))) E(`mark ${j.mark} does not exist`);
    for (const [px, f] of Object.entries(j.ladder || {})) if (px !== 'why' && !existsSync(join(dir, f))) E(`ladder ${px}: ${f} does not exist`);
  }
  return errs;
}
const JSON_FILES = ['mandala.json', 'features.json', 'palette.json', 'directions.json', 'variants.json', 'elements.json', 'constants.json'];

// Directions: at least three, of at least two kinds, sharing at most half their motifs pairwise.
export function motifOverlap(a, b) {
  const A = new Set(a || []), B = new Set(b || []);
  const shared = [...A].filter((x) => B.has(x)).length;
  return Math.min(A.size, B.size) ? shared / Math.min(A.size, B.size) : 0;
}
export function checkDirections(list) {
  const errs = [];
  if (list.length < 3) errs.push(`needs at least 3 directions, found ${list.length}`);
  const kinds = new Set(list.map((d) => d.kind).filter(Boolean));
  if (list.length >= 3 && kinds.size < 2) errs.push(`every direction is the same kind (${[...kinds].join(', ') || 'none given'}); make at least one a different kind: open, closed, letter or other`);
  for (const d of list) {
    if (!d.id) errs.push('a direction has no id');
    if (!d.svg) errs.push(`${d.id}: svg is missing`);
    if (!Array.isArray(d.motifs) || !d.motifs.length) errs.push(`${d.id}: list the motif ids it uses`);
    if (!Array.isArray(d.ops) || !d.ops.length) errs.push(`${d.id}: list the form operations it uses`);
    for (const op of d.ops || []) if (!FORM_OPS.includes(op)) errs.push(`${d.id}: operation "${op}" is not one of ${FORM_OPS.join(', ')}`);
  }
  for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
    const o = motifOverlap(list[i].motifs, list[k].motifs);
    if (o > 0.5) errs.push(`${list[i].id} and ${list[k].id} share ${Math.round(o * 100)}% of their motifs (limit 50%); swap a motif in one of them`);
  }
  return errs;
}

// --- commands ---------------------------------------------------------------------------------
function cmdInit() {
  const dir = args[1];
  if (!dir) fail('usage: init <dir> --name "<brand>" [--photo <file>]... [--scope full|ideation] [--answers <file>]');
  if (existsSync(statePath(dir))) fail(`${dir} already has a workbook; continue it with: node "${SELF}" status "${dir}"`);
  const scope = flag('--scope') || 'full';
  if (!REQUIRED[scope]) fail('--scope is full or ideation');
  for (const d of ['source', 'sheets', 'directions', 'export']) mkdirSync(join(dir, d), { recursive: true });
  const sources = [];
  for (const p of flags('--photo')) {
    if (!existsSync(p)) fail(`photo ${p} does not exist`);
    const to = join('source', basename(p));
    copyFileSync(p, join(dir, to)); // the original stays untouched; all work uses this copy
    sources.push(to.replace(/\\/g, '/'));
  }
  const answers = flag('--answers');
  if (answers) { if (!existsSync(answers)) fail(`${answers} does not exist`); copyFileSync(answers, join(dir, 'answers.json')); }
  const s = { version: 1, name: flag('--name') || basename(resolve(dir)), scope, created: now(), updated: now(), conditions: { photo: sources.length > 0, attributes: null, register: scope === 'ideation' ? false : null }, sources, answers: {}, gates: {}, history: [{ at: now(), event: 'init' }] };
  save(dir, s);
  writeBrief(dir, s);
  writeFileSync(join(dir, 'decisions.md'), `# Decisions: ${s.name}\n\nOne entry per gate: question, options, criteria, decision, reason, carry over.\n`);
  if (!existsSync(join(dir, 'taste.md'))) writeFileSync(join(dir, 'taste.md'), `# Taste: ${s.name}\n\nChoices made for this brand, with reasons. Stable preferences go to the global taste file with --global.\n\n`);
  console.log(`created ${dir} (scope ${scope}, ${sources.length} photo${sources.length === 1 ? '' : 's'})`);
  printStatus(dir, s);
}

function printStatus(dir, s) {
  const st = gateStates(s), cur = currentGate(s);
  const cond = s.conditions;
  const show = (v, unknown) => (v == null ? `unknown (${unknown})` : String(v));
  const out = [`Workbook ${dir}: ${s.name}, scope ${s.scope}, updated ${s.updated.slice(0, 16).replace('T', ' ')} UTC`,
    `Conditions: photo=${cond.photo}, attributes=${show(cond.attributes, 'set at G4')}, register=${show(cond.register, 'ask the formal-use question in G1')}`];
  for (const g of st) {
    const mark = { done: 'x', skip: '-', open: ' ', undecided: '?' }[g.state];
    out.push(`  [${mark}] ${g.id} ${g.phase} ${g.title}${g === st.find((x) => x.id === cur?.id) ? '  <- current' : ''}${g.why ? `  (${g.why})` : ''}`);
  }
  if (!cur) out.push('All gates are passed. Deliverables are in export/.');
  else {
    const refs = cur.read.map((r) => `references/${r}`), have = refs.filter((r) => existsSync(join(SKILL_DIR, r)));
    out.push([`Now: ${cur.id} ${cur.title}.`, have.length ? `Read ${have.join(' and ')} first.` : '', have.length < refs.length ? `${refs.filter((r) => !have.includes(r)).join(' and ')} not written yet: follow SKILL.md.` : ''].filter(Boolean).join(' '));
    if (cur.state === 'undecided') out.push(`  Decide the condition first: ${cur.why}.`);
    if (cur.id === 'G1' || (cur.id === 'G2' && !cond.photo)) {
      const miss = missingFields(s);
      if (miss.length) out.push(`  Brief fields without an answer (${miss.length}): ${miss.join(', ')}`);
    }
    const missingFiles = cur.files.filter((f) => !existsSync(join(dir, f)));
    if (missingFiles.length) out.push(`  Files this gate still needs: ${missingFiles.join(', ')}`);
    if ((cur.id === 'G1' || cur.id === 'G3') && !cond.photo && !existsSync(join(dir, 'mandala.json'))) out.push('  No photo: P1 runs without a gate (inventory the letterforms and domain symbols), then P2.');
    const defs = unconfirmedDefaults(s);
    if (defs.length && GATES.findIndex((g) => g.id === cur.id) >= GATES.findIndex((g) => g.id === 'G4')) out.push(`  Defaults to confirm again at G4: ${defs.join(', ')} (record with: confirm "${dir}" ${defs.join(' ')})`);
  }
  if (existsSync(join(dir, 'answers.json'))) out.push('Eval mode: answers.json is present. Take each answer from it instead of asking, and record it with the source it gives.');
  const gt = join(ROOT, 'taste.md');
  out.push(existsSync(gt) ? `Global taste file: ${gt.replace(/\\/g, '/')} (read it before asking; known preferences are not asked again).` : `Global taste file: none yet (${gt.replace(/\\/g, '/')}).`);
  if (has('--json')) console.log(JSON.stringify({ dir, name: s.name, scope: s.scope, conditions: cond, current: cur?.id ?? null, gates: st.map(({ id, state, why }) => ({ id, state, why })), missingFields: missingFields(s), unconfirmedDefaults: unconfirmedDefaults(s) }, null, 2));
  else console.log(out.join('\n'));
}

function cmdStatus() {
  // Status never fails: it is injected into SKILL.md, and a non-zero exit would abort the skill.
  try {
    const dir = positional()[0];
    if (dir) {
      if (!existsSync(statePath(dir))) { console.log(`No workbook at ${dir}. Create it with: node "${SELF}" init "${dir}" --name "<brand>"`); return; }
      printStatus(dir, readJson(statePath(dir)));
      return;
    }
    const rows = [];
    if (existsSync(ROOT)) for (const d of readdirSync(ROOT)) {
      const p = join(ROOT, d);
      if (!existsSync(statePath(p))) continue;
      try { const s = readJson(statePath(p)); rows.push({ p, s, t: statSync(statePath(p)).mtimeMs }); } catch { rows.push({ p, s: null, t: 0 }); }
    }
    const root = ROOT.replace(/\\/g, '/');
    if (!rows.length) { console.log(`No logo workbooks under ${root} yet. Start one with: node "${SELF}" init "${root}/<name>" --name "<brand>" [--photo <file>]`); return; }
    console.log(`Logo workbooks under ${root} (most recent first):`);
    for (const { p, s } of rows.sort((a, b) => b.t - a.t).slice(0, 8)) {
      if (!s) { console.log(`  ${p}: state.json is unreadable`); continue; }
      const cur = currentGate(s);
      console.log(`  ${basename(p)}: ${s.name}, ${cur ? `at ${cur.id} ${cur.title}` : 'finished'}, updated ${s.updated.slice(0, 10)}  (${p.replace(/\\/g, '/')})`);
    }
    console.log(`Details: node "${SELF}" status <dir>`);
  } catch (e) { console.log(`workbook status could not run: ${e.message}`); }
}

function cmdAnswer() {
  const [dir, field, value] = positional();
  const s = load(dir);
  const k = fieldKey(field);
  if (!k) fail(`unknown field "${field}"; fields: ${FIELDS.map((f) => f[0]).join(', ')}`);
  if (value == null || !String(value).trim()) fail('give the answer text');
  const source = flag('--source');
  if (!SOURCES[source]) fail('--source is said (the user said it), chose (picked from options) or default (a default the user did not veto)');
  s.answers[k] = { value, source, at: now(), ...(flag('--note') ? { note: flag('--note') } : {}) };
  if (k === 'register') {
    if (truthy(value)) s.conditions.register = true;
    else if (falsy(value)) s.conditions.register = false;
  }
  s.history.push({ at: now(), event: `answer ${k} (${source})` });
  save(dir, s); writeBrief(dir, s);
  const miss = missingFields(s);
  console.log(`recorded ${k} (${SOURCES[source]}). ${miss.length ? `Still without an answer: ${miss.join(', ')}` : 'Every required brief field has an answer.'}${k === 'register' && s.conditions.register == null ? ` Set the condition: node "${SELF}" cond "${dir}" register=true|false` : ''}`);
}

function cmdConfirm() {
  const [dir, ...fields] = positional();
  const s = load(dir);
  if (!fields.length) fail('name the fields the user confirmed');
  for (const f of fields) {
    const k = fieldKey(f);
    if (!k || !s.answers[k]) fail(`no answer recorded for "${f}"`);
    s.answers[k].confirmed = true;
  }
  s.history.push({ at: now(), event: `confirm ${fields.join(' ')}` });
  save(dir, s); writeBrief(dir, s);
  const left = unconfirmedDefaults(s);
  console.log(`confirmed ${fields.join(', ')}. ${left.length ? `Defaults still unconfirmed: ${left.join(', ')}` : 'No unconfirmed defaults left.'}`);
}

function cmdCond() {
  const [dir, ...pairs] = positional();
  const s = load(dir);
  if (!pairs.length) fail('give key=value pairs: photo=true|false attributes=<n> register=true|false');
  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (k === 'attributes') { if (!/^\d+$/.test(v)) fail('attributes is a whole number'); s.conditions.attributes = Number(v); }
    else if (k === 'photo' || k === 'register') { if (!truthy(v) && !falsy(v)) fail(`${k} is true or false`); s.conditions[k] = truthy(v); }
    else fail(`unknown condition ${k}; use photo, attributes or register`);
  }
  s.history.push({ at: now(), event: `cond ${pairs.join(' ')}` });
  save(dir, s);
  printStatus(dir, s);
}

function cmdPass() {
  const [dir, gate] = positional();
  const s = load(dir);
  const g = gateOf(gate);
  if (!g) fail(`unknown gate "${gate}"; gates: ${GATES.map((x) => x.id).join(', ')}`);
  const st = gateStates(s), me = st.find((x) => x.id === g.id);
  if (me.state === 'done') fail(`${g.id} is already passed; to change it, reopen it: node "${SELF}" reopen "${dir}" ${g.id} --reason "..."`);
  if (me.state === 'skip') fail(`${g.id} does not apply here (${me.why})`);
  if (me.state === 'undecided') fail(`${g.id} depends on a condition that is not set: ${me.why}`);
  const before = st.slice(0, st.indexOf(me)).filter((x) => x.state === 'open' || x.state === 'undecided');
  if (before.length) fail(`pass ${before.map((x) => x.id).join(', ')} first`);
  if (!flag('--decision') || !flag('--reason')) fail('--decision and --reason are required; the reason is the user\'s note when there is one, otherwise the chosen option\'s description');
  const problems = [];
  if (g.id === 'G1') {
    const miss = missingFields(s);
    if (miss.length) problems.push(`brief fields without an answer: ${miss.join(', ')}`);
    if (s.scope === 'full' && s.conditions.register == null) problems.push('register is not set; ask the formal-use question, then run cond register=true|false');
  }
  for (const f of g.files) problems.push(...checkFile(dir, f));
  if (g.id === 'G3') {
    try { const m = readJson(join(dir, 'mandala.json')); if (!(m.themes || []).some((t) => (t.motifs || []).some((x) => x.keep === true))) problems.push('mandala.json: no motif has keep: true'); if (!(m.concepts || []).length) problems.push('mandala.json: concepts is empty'); else if (s.scope === 'full' && !(m.concepts || []).some((c) => c.chosen)) problems.push('mandala.json: mark the concepts the user picked with chosen: true'); } catch { /* reported above */ }
  }
  if (g.id === 'G6' && existsSync(join(dir, 'constants.json'))) {
    try {
      const res = checkConstants(join(dir, 'constants.json'));
      const n = res.reduce((k, r) => k + r.violations.length, 0);
      if (n) problems.push(`check.mjs finds ${n} violation${n === 1 ? '' : 's'}; run: node check.mjs "${join(dir, 'constants.json').replace(/\\/g, '/')}"`);
    } catch (e) { problems.push(`check.mjs could not run on constants.json: ${e.message}`); }
  }
  if (g.id === 'G4') {
    const defs = unconfirmedDefaults(s);
    if (defs.length) problems.push(`defaults not confirmed again: ${defs.join(', ')}; show them to the user in this gate, then run confirm`);
    if (s.conditions.attributes == null) problems.push('attributes is not set; run cond attributes=<n> (0 when no variant round is needed)');
  }
  if (problems.length) fail(`${g.id} cannot pass yet:\n  - ${problems.join('\n  - ')}`);
  s.gates[g.id] = { status: 'done', at: now(), decision: flag('--decision'), reason: flag('--reason'), ...(flag('--source') ? { source: flag('--source') } : {}) };
  s.history.push({ at: now(), event: `pass ${g.id}` });
  save(dir, s);
  logDecision(dir, g.id, { question: flag('--question'), options: flag('--options'), criteria: flag('--criteria'), decision: flag('--decision'), reason: flag('--reason'), source: flag('--source'), carry: flag('--carry') });
  console.log(`passed ${g.id}.`);
  printStatus(dir, s);
}

function cmdReopen() {
  const [dir, gate] = positional();
  const s = load(dir);
  const g = gateOf(gate);
  if (!g) fail(`unknown gate "${gate}"`);
  if (!flag('--reason')) fail('--reason is required');
  const from = GATES.indexOf(g);
  const reopened = GATES.slice(from).filter((x) => s.gates[x.id]?.status === 'done').map((x) => x.id);
  for (const id of reopened) s.gates[id] = { ...s.gates[id], status: 'reopened', reopenedAt: now() };
  s.history.push({ at: now(), event: `reopen ${g.id}: ${flag('--reason')}` });
  save(dir, s);
  appendFileSync(join(dir, 'decisions.md'), `\n## Reopened ${g.id} (${now().slice(0, 16).replace('T', ' ')} UTC)\n\n- Reason: ${flag('--reason')}\n- Gates to pass again: ${reopened.join(', ') || g.id}. Their files stay; redo only what this change affects.\n`);
  printStatus(dir, s);
}

function cmdTaste() {
  const [dir] = positional();
  const s = load(dir);
  const like = flag('--like'), dislike = flag('--dislike');
  if (!like && !dislike) fail('give --like "<what>" or --dislike "<what>"');
  if (!flag('--reason')) fail('--reason is required: a preference without a reason cannot be applied to the next project');
  const file = has('--global') ? join(ROOT, 'taste.md') : join(dir, 'taste.md');
  if (has('--global') && !existsSync(file)) { mkdirSync(ROOT, { recursive: true }); writeFileSync(file, '# Taste (all projects)\n\nStable preferences with reasons and the project they came from.\n\n'); }
  appendFileSync(file, `- [${like ? 'like' : 'dislike'}] ${like || dislike}: ${flag('--reason')} (${s.name}, ${now().slice(0, 10)})\n`);
  console.log(`added to ${file.replace(/\\/g, '/')}`);
}

function cmdCheck() {
  const [dir] = positional();
  const s = load(dir);
  const errs = [];
  for (const f of JSON_FILES) if (existsSync(join(dir, f))) errs.push(...checkFile(dir, f));
  for (const [id, gs] of Object.entries(s.gates)) if (gs.status === 'done') for (const f of gateOf(id)?.files || []) if (!existsSync(join(dir, f))) errs.push(`${id} is passed but ${f} is missing`);
  if (errs.length) { console.log(errs.map((e) => `FAIL ${e}`).join('\n') + `\nFAIL ${errs.length} problem${errs.length === 1 ? '' : 's'}`); process.exit(1); }
  console.log(`PASS ${JSON_FILES.filter((f) => existsSync(join(dir, f))).join(', ') || 'no JSON files yet'}`);
}

const COMMANDS = { init: cmdInit, status: cmdStatus, answer: cmdAnswer, confirm: cmdConfirm, cond: cmdCond, pass: cmdPass, reopen: cmdReopen, taste: cmdTaste, check: cmdCheck };
if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  const c = COMMANDS[args[0]];
  if (!c) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(args[0] ? 1 : 0); }
  c();
}

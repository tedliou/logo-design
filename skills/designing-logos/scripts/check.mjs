#!/usr/bin/env node
// Check a mark's SVG geometry against its construction rules in constants.json.
//
//   node check.mjs <constants.json> [<mark.svg>...] [--json]
//
// With no SVG given it checks constants.mark and every file in constants.ladder.
// Rules: viewBox matches the canvas; straight-edge vertices sit on the grid unit; every straight edge
// has an angle from the set; curves exist only inside declared curve families, which share one
// radius, taper and bend; fills and strokes are flat colors from the palette; restricted colors
// (the accent) stay within their element count and region; no filters, masks, opacity, raster
// images or live text in the mark. Paths in constants.json are relative to its folder.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvg } from './lib/svg.mjs';
import { normalizeColor } from './lib/color.mjs';

const EPS = 1e-6;
const f2 = (v) => +(+v).toFixed(2);
const pt = (p) => `${f2(p[0])},${f2(p[1])}`;

function describe(el) {
  const name = [el.tag, el.id ? `#${el.id}` : '', el.classes.length ? `.${el.classes.join('.')}` : ''].join('');
  const col = el.role === 'clip' ? 'clip shape' : el.fill !== 'none' ? `fill ${el.fill}` : `stroke ${el.stroke}`;
  return `${name} [${el.index}] (${col}${el.bbox ? `, box ${pt(el.bbox)} to ${pt(el.bbox.slice(2))}` : ''})`;
}

export function matches(el, m) {
  if (m.tag && ![].concat(m.tag).includes(el.tag)) return false;
  if (m.minPoints && (el.points?.length || 0) < m.minPoints) return false;
  if (m.class && !el.classes.includes(m.class)) return false;
  if (m.id && !(el.id && new RegExp(m.id).test(el.id))) return false;
  return true;
}

// Least-squares circle through points (Kasa fit). Returns { cx, cy, r }.
export function fitCircle(P) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = P.length;
  for (const [x, y] of P) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  // Solve [sxx sxy sx; sxy syy sy; sx sy n] [D E F]' = -[sxz syz sz]'
  const A = [[sxx, sxy, sx, -sxz], [sxy, syy, sy, -syz], [sx, sy, n, -sz]];
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null; // collinear: a straight ribbon
    for (let r = 0; r < 3; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j < 4; j++) A[r][j] -= k * A[c][j]; }
  }
  const D = A[0][3] / A[0][0], E = A[1][3] / A[1][1], F = A[2][3] / A[2][2];
  const cx = -D / 2, cy = -E / 2;
  return { cx, cy, r: Math.sqrt(Math.max(0, cx * cx + cy * cy - F)) };
}

// A ribbon is a closed polygon made of one side out and the other side back (equal point counts),
// as drawn by a tapered stroke helper. Returns its centerline, root and tip widths.
export function ribbon(points) {
  const N = points.length;
  if (N < 6 || N % 2) return null;
  const half = N / 2, center = [];
  for (let i = 0; i < half; i++) { const a = points[i], b = points[N - 1 - i]; center.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
  const w0 = Math.hypot(points[0][0] - points[N - 1][0], points[0][1] - points[N - 1][1]);
  const w1 = Math.hypot(points[half - 1][0] - points[half][0], points[half - 1][1] - points[half][1]);
  return { center, w0, w1 };
}

export function checkSvg(svgText, C, { label = 'mark', ladder = false } = {}) {
  const svg = parseSvg(svgText);
  const V = [], W = [...svg.warnings];
  const add = (rule, msg) => V.push({ rule, msg });
  const unit = ladder ? 1 : C.grid.unit;
  // Angles are slopes from the horizontal, 0 to 90: 45 covers both diagonals, as a designer says it.
  const fold = (a) => { a = ((a % 180) + 180) % 180; return a > 90 ? 180 - a : a; };
  const angleSet = (C.angles?.set || [0, 90]).map(fold);
  const tol = C.angles?.tolerance ?? 0.01;
  const roles = Object.entries(C.colors || {}).filter(([k, v]) => k !== 'why' && v && v.hex).map(([k, v]) => ({ name: k, ...v, hex: normalizeColor(v.hex) }));
  const palette = new Set(roles.map((r) => r.hex));

  // canvas
  if (!ladder) {
    const s = C.canvas.size;
    if (!svg.viewBox) add('canvas', `${label} has no viewBox; use viewBox="0 0 ${s} ${s}" so the construction grid is the coordinate system`);
    else if (svg.viewBox.join(' ') !== `0 0 ${s} ${s}`) add('canvas', `${label} viewBox is "${svg.viewBox.join(' ')}"; constants.canvas.size is ${s}, so use "0 0 ${s} ${s}"`);
  }

  const geo = svg.elements.filter((e) => e.role !== 'hidden' && e.points);
  const families = ladder ? [] : (C.curves || []);
  const members = new Map(families.map((f) => [f.name, []]));
  for (const el of svg.elements.filter((e) => e.role !== 'hidden')) {
    // forbidden content and effects
    if (el.tag === 'text') add('flat', `${describe(el)} is live text; convert letters to outlines so the mark looks the same everywhere`);
    if (el.tag === 'image' || el.tag === 'foreignobject') add('flat', `${describe(el)} embeds a raster or HTML; the mark is built from vector shapes only`);
    for (const fx of el.effects) if (!fx.startsWith('clip-path')) add('flat', `${describe(el)} uses ${fx}; the mark uses flat fills only (put texture and transparency in the presentation layer)`);
  }
  for (const el of geo) {
    const fam = families.find((f) => matches(el, f.match || {}));
    if (fam) { members.get(fam.name).push(el); continue; }
    if (el.curves.length) add('curve', `${describe(el)} has a curve (${[...new Set(el.curves.map((c) => c.cmd))].join(', ')}) but no curve family in constants.json covers it; add a family with its reason, or redraw it with straight edges`);
    const off = el.points.filter(([x, y]) => Math.abs(x / unit - Math.round(x / unit)) > EPS || Math.abs(y / unit - Math.round(y / unit)) > EPS);
    if (off.length) add('grid', `${describe(el)} has ${off.length} vertex${off.length > 1 ? 'es' : ''} off the ${unit}-unit grid, first ${pt(off[0])}; move ${off.length > 1 ? 'them' : 'it'} to the nearest grid point`);
    for (const [p, q] of el.edges || []) {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      if (Math.hypot(dx, dy) < EPS) continue;
      const a = fold((Math.atan2(dy, dx) * 180) / Math.PI);
      const diff = Math.min(...angleSet.map((s) => Math.abs(a - s)));
      if (diff > tol) { add('angle', `${describe(el)} edge ${pt(p)} to ${pt(q)} runs at ${f2(a)} degrees; allowed: ${C.angles.set.join(', ')}`); break; }
    }
  }

  // colors
  const drawn = svg.elements.filter((e) => e.role === 'drawn');
  for (const el of drawn) {
    for (const [kind, c] of [['fill', el.fill], ['stroke', el.stroke]]) {
      if (kind === 'stroke' && (c === 'none' || c == null)) continue;
      if (c === 'none') continue;
      if (!palette.has(c)) add('color', `${describe(el)} ${kind} ${c} is not in the palette (${roles.map((r) => `${r.name} ${r.hex}`).join(', ')})${/^url\(/.test(String(c)) ? '; gradients and patterns are not flat colors' : ''}`);
    }
  }
  if (!ladder) for (const r of roles.filter((x) => x.maxElements != null || x.region)) {
    const users = drawn.filter((el) => el.fill === r.hex || el.stroke === r.hex);
    if (r.maxElements != null && users.length > r.maxElements) add('accent', `${r.name} ${r.hex} appears in ${users.length} elements, allowed ${r.maxElements}: ${users.map(describe).join('; ')}`);
    if (r.region) for (const el of users) {
      const [x0, y0, x1, y1] = r.region, b = el.bbox;
      if (b && (b[0] < x0 - EPS || b[1] < y0 - EPS || b[2] > x1 + EPS || b[3] > y1 + EPS)) add('accent', `${describe(el)} uses ${r.name} outside its region ${r.region.join(',')}`);
    }
  }

  // curve families
  const report = [];
  for (const f of families) {
    const list = members.get(f.name);
    if (f.count != null && list.length !== f.count) add('family', `curve family ${f.name} has ${list.length} members, constants.json says ${f.count}`);
    const radii = [];
    for (const el of list) {
      if (f.kind === 'ribbon') {
        const rb = ribbon(el.points);
        if (!rb) { add('family', `${describe(el)} matched ${f.name} but is not a ribbon (one side out, one side back, equal point counts)`); continue; }
        const c = fitCircle(rb.center);
        if (!c) { add('family', `${describe(el)} in ${f.name} is straight; the family is curved`); continue; }
        radii.push(c.r);
        const ratio = Math.max(rb.w0, rb.w1) / Math.max(1e-9, Math.min(rb.w0, rb.w1));
        if (f.radius != null && Math.abs(c.r - f.radius) > (f.radiusTolerance ?? 0.5)) add('family', `${describe(el)} bends with radius ${f2(c.r)}; ${f.name} uses ${f.radius}`);
        if (f.taper && (ratio < f.taper[0] || ratio > f.taper[1])) add('family', `${describe(el)} tapers ${f2(ratio)}:1; ${f.name} allows ${f.taper[0]} to ${f.taper[1]}`);
        if (f.bend) {
          const my = rb.center.reduce((s, p) => s + p[1], 0) / rb.center.length;
          const down = c.cy > my; // circle center below the curve: the line arches and droops
          if ((f.bend === 'down') !== down) add('family', `${describe(el)} bends ${down ? 'down' : 'up'}; ${f.name} bends ${f.bend}`);
        }
      } else if (f.kind === 'arc') {
        for (const cv of el.curves) {
          if (!cv.radii) { add('family', `${describe(el)} in ${f.name} uses ${cv.cmd}; an arc family takes A commands, circles or ellipses`); continue; }
          radii.push(...cv.radii);
          if (f.radius != null && cv.radii.some((r) => Math.abs(r - f.radius) > (f.radiusTolerance ?? 0.5))) add('family', `${describe(el)} has radius ${cv.radii.map(f2).join('/')}; ${f.name} uses ${f.radius}`);
        }
      }
    }
    if (f.radius == null && radii.length > 1 && Math.max(...radii) - Math.min(...radii) > 2 * (f.radiusTolerance ?? 0.5)) add('family', `curve family ${f.name} mixes radii ${f2(Math.min(...radii))} to ${f2(Math.max(...radii))}; a family shares one radius`);
    report.push({ family: f.name, members: list.length, radius: radii.length ? [f2(Math.min(...radii)), f2(Math.max(...radii))] : null });
  }
  return { label, elements: svg.elements.length, violations: V, warnings: W, families: report };
}

export function checkConstants(constantsPath, svgPaths = []) {
  const C = JSON.parse(readFileSync(constantsPath, 'utf8'));
  const base = dirname(resolve(constantsPath));
  const results = [];
  const targets = svgPaths.length ? svgPaths.map((p) => ({ p, ladder: false })) : [
    ...(C.mark ? [{ p: join(base, C.mark), label: C.mark, ladder: false }] : []),
    ...Object.entries(C.ladder || {}).filter(([k]) => k !== 'why').map(([px, f]) => ({ p: join(base, f), label: `${f} (${px} px)`, ladder: true })),
  ];
  if (!targets.length) throw new Error('nothing to check: give SVG files or set "mark" in constants.json');
  for (const t of targets) {
    if (!existsSync(t.p)) { results.push({ label: t.label || t.p, elements: 0, violations: [{ rule: 'file', msg: `${t.p} does not exist` }], warnings: [], families: [] }); continue; }
    results.push(checkSvg(readFileSync(t.p, 'utf8'), C, { label: t.label || t.p, ladder: t.ladder }));
  }
  return results;
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));
  const constants = files.find((f) => f.endsWith('.json'));
  if (!constants) { console.log('usage: node check.mjs <constants.json> [<mark.svg>...] [--json]'); process.exit(2); }
  let results;
  try { results = checkConstants(constants, files.filter((f) => f !== constants)); }
  catch (e) { console.log(`ERROR ${e.message}`); process.exit(2); }
  const total = results.reduce((s, r) => s + r.violations.length, 0);
  if (json) console.log(JSON.stringify({ violations: total, results }, null, 2));
  else {
    for (const r of results) {
      for (const w of r.warnings) console.log(`WARN ${r.label}: ${w}`);
      for (const v of r.violations) console.log(`FAIL ${v.rule}: ${v.msg}`);
      const fam = r.families.filter((f) => f.members).map((f) => `${f.family} x${f.members}${f.radius ? ` r ${f.radius[0] === f.radius[1] ? f.radius[0] : f.radius.join('-')}` : ''}`).join(', ');
      console.log(`${r.violations.length ? 'FAIL' : 'ok  '} ${r.label}: ${r.elements} elements, ${r.violations.length} violation${r.violations.length === 1 ? '' : 's'}${fam ? `; curve families: ${fam}` : ''}`);
    }
    console.log(`${total ? 'FAIL' : 'PASS'} ${total} violation${total === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}`);
  }
  process.exit(total ? 1 : 0);
}

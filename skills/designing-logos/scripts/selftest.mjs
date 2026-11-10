#!/usr/bin/env node
// Self-test for the scripts that need no model: run after changing any script.
//   node selftest.mjs
import { checkSvg } from './check.mjs';
import { checkRound, checkCellSvg, renderHtml, ui, IDS } from './design.mjs';
import { ico } from './render.mjs';
import { presentationSvg } from './texture.mjs';
import { parsePath } from './lib/svg.mjs';
import { contrast, hexToOklab, oklabToHex } from './lib/color.mjs';

let failed = 0;
const ok = (cond, name) => { if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); };

// A small mark on a 64 grid: ear triangle, face block, accent nose, and two tapered drooping ribbons.
function ribbonPts(x0, y0, side, thetaDeg, R, L, w0, w1) {
  const th = (thetaDeg * Math.PI) / 180, n = 24, a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const s = (L * i) / n, phi = th - s / R;
    const x = x0 + side * R * (Math.sin(th) - Math.sin(phi)), y = y0 + R * (Math.cos(th) - Math.cos(phi));
    const w = w0 + (w1 - w0) * (i / n), tx = side * Math.cos(phi), ty = -Math.sin(phi);
    a.push([x - (ty * w) / 2, y + (tx * w) / 2]); b.push([x + (ty * w) / 2, y - (tx * w) / 2]);
  }
  return a.concat(b.reverse()).map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ');
}
const INK = '#18181b', PAPER = '#fafafa', RED = '#dc3d5c';
const base = (extra = '', opts = {}) => `<svg viewBox="${opts.viewBox || '0 0 64 64'}" xmlns="http://www.w3.org/2000/svg">
<polygon points="${opts.ear || '0,0 20,20 0,20'}" fill="${INK}"/>
<rect x="0" y="24" width="64" height="40" fill="${INK}"/>
<polygon points="${opts.nose || '24,24 40,24 40,32 32,40 24,32'}" fill="${RED}"/>
<polygon points="${ribbonPts(20, 48, -1, 10, opts.r2 || 30, 18, 2, 0.25)}" fill="${PAPER}"/>
<polygon points="${ribbonPts(44, 48, 1, 10, 30, 18, 2, 0.25)}" fill="${PAPER}"/>
${extra}</svg>`;
const C = {
  canvas: { size: 64 }, grid: { unit: 1 }, angles: { set: [0, 45, 90], tolerance: 0.01 },
  curves: [{ name: 'whisker', match: { tag: 'polygon', minPoints: 20 }, kind: 'ribbon', count: 2, radius: 30, radiusTolerance: 0.5, taper: [7, 9], bend: 'down' }],
  colors: { ink: { hex: INK }, paper: { hex: PAPER }, accent: { hex: RED, maxElements: 1, region: [24, 24, 40, 40] } },
};
const rules = (svg, c = C) => checkSvg(svg, c).violations.map((v) => v.rule);
const only = (got, want) => got.length > 0 && got.every((r) => r === want);

ok(rules(base()).length === 0, 'clean mark passes');
ok(rules(base('', { ear: '0,0 20.5,20 0,20' })).includes('grid'), 'off-grid vertex is caught');
ok(only(rules(base('', { nose: '24,24 40,24 40,32 30,40 24,32' })), 'angle'), 'edge outside the angle set is caught');
ok(rules(base(`<rect x="0" y="0" width="4" height="4" fill="${RED}"/>`)).filter((r) => r === 'accent').length === 2, 'second accent element and accent outside its region are caught');
ok(only(rules(base(`<rect x="0" y="0" width="4" height="4" fill="#000000"/>`)), 'color'), 'color outside the palette is caught');
ok(rules(base(`<rect x="0" y="0" width="4" height="4" fill="url(#g)"/>`)).includes('color'), 'gradient fill is caught');
ok(only(rules(base(`<rect x="0" y="0" width="4" height="4" fill="${INK}" filter="url(#f)"/>`)), 'flat'), 'filter is caught');
ok(only(rules(base(`<rect x="0" y="0" width="4" height="4" fill="${INK}" opacity=".5"/>`)), 'flat'), 'opacity is caught');
ok(rules(base(`<text x="2" y="10" fill="${INK}">A</text>`)).includes('flat'), 'live text is caught');
ok(only(rules(base(`<path d="M0 0 Q 10 0 10 10 Z" fill="${INK}"/>`)), 'curve'), 'curve outside a family is caught');
ok(rules(base('', { r2: 22 })).includes('family'), 'family member with another radius is caught');
ok(rules(base(), { ...C, curves: [{ ...C.curves[0], bend: 'up' }] }).includes('family'), 'bend direction is checked');
ok(rules(base(), { ...C, curves: [{ ...C.curves[0], count: 3 }] }).includes('family'), 'family member count is checked');
ok(only(rules(base('', { viewBox: '0 0 128 128' })), 'canvas'), 'viewBox that does not match the canvas is caught');
ok(rules(base(`<g transform="translate(0.5 0)"><rect x="0" y="0" width="4" height="4" fill="${INK}"/></g>`)).includes('grid'), 'transforms are applied before the grid check');
ok(rules(base(`<g fill="${INK}"><rect x="0" y="0" width="4" height="4"/></g>`)).length === 0, 'inherited fill from a group is read');
ok(rules(base(`<rect x="0" y="0" width="4" height="4"/>`)).includes('color'), 'missing fill counts as SVG default black');

// path parser: relative commands, implicit lines, H/V and close
const segs = parsePath('m10 10 h5 v5 l-5 0 z');
ok(segs.filter((s) => s.kind === 'line').length === 4 && segs[segs.length - 1].to.join() === '10,10', 'path parser handles relative h, v, l and z');

// color math
ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01, 'WCAG contrast black on white is 21');
ok(oklabToHex(hexToOklab('#dc3d5c')) === '#dc3d5c', 'OKLab round trip keeps the hex');

// rounds: eight cells, round 1 covers the eight corners, later rounds carry exactly one wildcard
const cellSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#fafafa"/><circle cx="48" cy="48" r="30" fill="#18181b"/></svg>';
const corners = [];
for (const a of ['round', 'angular']) for (const b of ['static', 'dynamic']) for (const c of ['figurative', 'letter']) corners.push([a, b, c]);
const round1 = { cells: IDS.map((id, i) => ({ id, axes: corners[i], tag: `t${id}`, concept: `concept ${id}`, motifs: [`m${id}1`, `m${id}2`], why: 'w', svg: cellSvg })) };
ok(checkRound(round1, 1).errs.length === 0, 'round 1 with eight concepts spread over both sides of each pair passes');
ok(checkRound({ cells: round1.cells.map(({ concept, ...c }) => c) }, 1).errs.some((e) => /needs concept/.test(e)), 'round 1 cells without a concept fail');
ok(checkRound({ cells: round1.cells.map((c) => ({ ...c, axes: ['round', c.axes[1], c.axes[2]] })) }, 1).errs.some((e) => /both sides of each pair/.test(e)), 'round 1 with only round shapes fails');
ok(checkRound({ cells: round1.cells.slice(0, 7) }, 1).errs.some((e) => /needs 8 cells/.test(e)), 'a round with seven cells fails');
const OPS = ['silhouette', 'skeleton', 'motion', 'figure-ground', 'subtraction', 'fusion', 'substitution'];
const round2 = { cells: IDS.map((id, i) => ({ id, tag: `t${id}`, why: 'w', svg: cellSvg, ...(i === 7 ? { outlier: true, concept: 'another idea', motifs: ['a', 'b'] } : { op: OPS[i] }) })) };
ok(checkRound(round2, 2).errs.length === 0, 'round 2 with seven operations and one wildcard passes');
ok(checkRound({ cells: round2.cells.map((c) => (c.op ? { ...c, op: 'fusion' } : c)) }, 2).errs.some((e) => /operations repeat/.test(e)), 'round 2 repeating one operation fails');
const round3 = { cells: round2.cells.map(({ op, ...c }) => c) };
ok(checkRound(round3, 3).errs.length === 0, 'round 3 changes attributes without operations');
ok(checkRound({ cells: round3.cells.map(({ outlier, ...c }) => c) }, 3).errs.some((e) => /exactly one cell with outlier/.test(e)), 'a later round without a wildcard fails');
ok(checkCellSvg('<svg viewBox="0 0 96 96"><text x="10" y="50">A</text></svg>', 'A').errs.some((e) => /live <text>/.test(e)), 'a cell with live text fails');
ok(checkCellSvg('<svg viewBox="0 0 96 96"><defs><linearGradient id="g"/></defs><rect width="96" height="96" fill="url(#g)"/></svg>', 'A').errs.some((e) => /gradient/.test(e)), 'a cell with a gradient fails');
ok(checkCellSvg('<svg viewBox="0 0 96 64"><rect width="96" height="64" fill="#000"/></svg>', 'A').errs.some((e) => /not square/.test(e)), 'a cell with a wide viewBox fails');

// the design document keeps its state, in both languages, and nothing breaks out of the script tag
const state = { version: 2, name: 'Test</script>', lang: 'zh-TW', brief: 'b', stage: 'explore', prefs: ['round'], rounds: [{ n: 1, center: null, cells: round1.cells, pick: null }], log: [] };
const html = await renderHtml(state);
const back = JSON.parse(html.match(/<script type="application\/json" id="design-state">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
ok(back.name === 'Test</script>' && back.rounds[0].cells.length === 8, 'the state survives the round trip through design.html');
ok(html.includes(ui('zh-TW').send) && renderHtml.length >= 1, 'the document uses the strings of its language');
ok((html.match(/class="cell pick/g) || []).length === 8, 'the live board has eight tappable cells');

// favicon.ico header
const fake = (px) => ({ px, buf: Buffer.from([137, 80, 78, 71, px]) });
const icon = ico([fake(16), fake(32)]);
ok(icon.readUInt16LE(2) === 1 && icon.readUInt16LE(4) === 2 && icon.readUInt8(6) === 16 && icon.readUInt32LE(6 + 12) === 38, 'ico header lists two PNG entries with the right offset');

// presentation sheet keeps texture out of the mark and labels only construction data
const pres = presentationSvg(base(), { C: { canvas: { size: 64 }, grid: { lines: [0, 32, 64] }, angles: { set: [0, 45, 90] }, colors: { ink: { hex: INK }, paper: { hex: PAPER }, accent: { hex: RED } } }, index: true, size: 400 });
ok(/feTurbulence/.test(pres) && /GRID 64 \/ 0 32 64/.test(pres) && /ANGLE 0 45 90/.test(pres), 'presentation sheet has texture filters and construction-only labels');
ok(checkSvg(base(), C).violations.length === 0, 'the mark itself stays flat after making a presentation sheet');

console.log(failed ? `FAIL ${failed} test${failed === 1 ? '' : 's'}` : 'PASS all tests');
process.exit(failed ? 1 : 0);

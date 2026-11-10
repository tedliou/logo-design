#!/usr/bin/env node
// Self-test for the scripts that need no model: run after changing check.mjs, workbook.mjs or lib/.
//   node selftest.mjs
import { checkSvg } from './check.mjs';
import { gateStates, checkDirections, motifOverlap } from './workbook.mjs';
import { wrap } from './board.mjs';
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

// conditional gates
const st = (c, scope = 'full') => Object.fromEntries(gateStates({ scope, gates: {}, conditions: c }).map((g) => [g.id, g.state]));
let g = st({ photo: false, attributes: 2, register: false });
ok(g.G2 === 'skip' && g.G5 === 'skip' && g.TM === 'skip', 'no photo, two attributes, no registration: G2, G5 and TM do not appear');
g = st({ photo: true, attributes: 3, register: true });
ok(g.G2 === 'open' && g.G5 === 'open' && g.TM === 'open', 'photo, three attributes, registration: G2, G5 and TM appear');
g = st({ photo: false, attributes: null, register: false }, 'ideation');
ok(g.G4 === 'skip' && g.G6 === 'skip' && g.G3 === 'open', 'ideation scope stops after G3');

// directions: count, kinds, motif overlap
const D = (id, kind, motifs) => ({ id, kind, motifs, ops: ['fusion'], svg: `directions/${id}/mark.svg` });
ok(checkDirections([D('A', 'open', ['a', 'b']), D('B', 'closed', ['c', 'd']), D('C', 'letter', ['a', 'e'])]).length === 0, 'three directions of different kinds with 50% overlap pass');
ok(checkDirections([D('A', 'open', ['a']), D('B', 'closed', ['b'])]).some((e) => /at least 3/.test(e)), 'two directions fail');
ok(checkDirections([D('A', 'open', ['a']), D('B', 'open', ['b']), D('C', 'open', ['c'])]).some((e) => /same kind/.test(e)), 'three directions of one kind fail');
ok(checkDirections([D('A', 'open', ['a', 'b', 'c']), D('B', 'closed', ['a', 'b', 'd']), D('C', 'letter', ['e'])]).some((e) => /A and B share 67%/.test(e)), 'directions sharing more than half their motifs fail');
ok(Math.abs(motifOverlap(['a', 'b'], ['b', 'c', 'd']) - 0.5) < 1e-9, 'overlap is shared over the smaller set');

// text wrap for board labels: CJK breaks between characters, Latin between words
ok(JSON.stringify(wrap('one two three four', 4)) === JSON.stringify(['one two', 'three', 'four']), 'wrap breaks Latin text between words');
ok(wrap('\u4e00\u4e8c\u4e09\u56db\u4e94\u516d', 4).length === 2, 'wrap breaks CJK text between characters');

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

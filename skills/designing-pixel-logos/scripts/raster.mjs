// Geometry-first pixel rasterizer for logo grids of 48 cells and up. Node 18+, no dependencies.
// Usage: node raster.mjs <scene.mjs> <out.json> [--layers a,b] [--texture SEED]
// A scene module exports: size, palette, layers: [{ layer, optional, items: [...] }], textureRules (optional).
// Item kinds (all coordinates are integer cell coordinates; pixel centres sit at +0.5):
//   { fill: 'P' }                                   fill the whole canvas
//   { poly: [[x,y],...], c }                        polygon, pixel-centre sampling, no anti-aliasing
//   { ray: [x,y], dir: [a,b], c, len?, gap?, clip? } straight line with exactly equal runs: one of |a|,|b|
//                                                   must be 1 (or 0, or both equal); runs = max/min
//   { path: [x,y], segs: [[axis, sx, sy, [runs...]], ...], c, gap?, clip? }
//                                                   pixel curve: on axis 'x' each run of n cells moves x by sx,
//                                                   then steps y by sy (axis 'y' swaps the roles)
//   { text: 'ABC', at: [x,y], c, vertical? }        3x5 pixel font
// Any item may carry blend: { underColor: resultColor } to model overprint or inversion; unmapped colours get c.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [, , scenePath, out, ...rest] = process.argv;
if (!scenePath || !out) {
  console.log("usage: node raster.mjs <scene.mjs> <out.json> [--layers a,b] [--texture SEED]");
  process.exit(2);
}
const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const S = await import(pathToFileURL(resolve(scenePath)).href);
const N = S.size;
const only = flag('--layers')?.split(',');
const g = Array.from({ length: N }, () => Array(N).fill('.'));

function put(x, y, c, blend, clip) {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  if (clip && (x < clip[0] || y < clip[1] || x > clip[2] || y > clip[3])) return;
  const cur = g[y][x];
  const v = blend && cur in blend ? blend[cur] : c;
  if (v !== undefined && v !== null) g[y][x] = v;
}
function poly(v, c, blend) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const [xi, yi] = v[i], [xj, yj] = v[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) put(x, y, c, blend);
    }
}
const far = (x, y, o, gap) => Math.max(Math.abs(x - o[0]), Math.abs(y - o[1])) >= gap;
function ray({ ray: o, dir: [a, b], c, len = 999, gap = 0, clip, blend }) {
  const A = Math.abs(a), B = Math.abs(b);
  const lo = Math.min(A, B), hi = Math.max(A, B);
  if (!(lo === 0 || lo === 1 || A === B)) throw new Error(`ray dir ${a},${b} is not a clean ratio`);
  const run = lo === 0 ? Infinity : A === B ? 1 : hi;
  const sx = Math.sign(a), sy = Math.sign(b);
  const xMajor = A >= B;
  let entered = false; // a clip box may start away from the origin: skip until inside, stop once outside again
  for (let i = 0; i < len * (run === Infinity ? 1 : run); i++) {
    const m = i, n = run === Infinity ? 0 : Math.floor(i / run);
    const x = o[0] + (xMajor ? sx * m : sx * n);
    const y = o[1] + (xMajor ? sy * n : sy * m);
    const out = (clip && (x < clip[0] || y < clip[1] || x > clip[2] || y > clip[3])) || x < 0 || y < 0 || x >= N || y >= N;
    if (out) { if (entered) break; continue; }
    entered = true;
    if (far(x, y, o, gap)) put(x, y, c, blend);
  }
}
function path({ path: o, segs, c, gap = 0, clip, blend }) {
  let [x, y] = o;
  for (const [axis, sx, sy, runs] of segs)
    for (const r of runs) {
      for (let j = 0; j < r; j++) {
        if (clip && (x < clip[0] || y < clip[1] || x > clip[2] || y > clip[3])) return;
        if (far(x, y, o, gap)) put(x, y, c, blend);
        if (axis === 'x') x += sx; else y += sy;
      }
      if (axis === 'x') y += sy; else x += sx;
    }
}
const FONT = {
  I: ['###', '.#.', '.#.', '.#.', '###'], O: ['###', '#.#', '#.#', '#.#', '###'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], '-': ['...', '...', '###', '...', '...'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], A: ['.#.', '#.#', '###', '#.#', '#.#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'],
  0: ['.#.', '#.#', '#.#', '#.#', '.#.'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  ':': ['...', '.#.', '...', '.#.', '...'], ' ': ['...', '...', '...', '...', '...'],
};
function text({ text: str, at: [ox, oy], c, vertical }) {
  [...str].forEach((ch, i) => {
    const gl = FONT[ch];
    if (!gl) throw new Error(`no glyph for "${ch}"`);
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r][q] === '#') {
      if (!vertical) put(ox + i * 4 + q, oy + r, c);
      else put(ox + r, oy - (i * 4 + q), c);
    }
  });
}
for (const L of S.layers) {
  if (only ? !only.includes(L.layer) : L.optional) continue;
  for (const it of L.items) {
    if (it.fill) g.forEach((row) => row.fill(it.fill));
    else if (it.poly) poly(it.poly, it.c, it.blend);
    else if (it.ray) ray(it);
    else if (it.path) path(it);
    else if (it.text) text(it);
  }
}
const seed = flag('--texture');
if (seed) {
  let s = Number(seed) >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = S.textureRules[g[y][x]];
    if (r && rnd() < r.p) g[y][x] = r.to;
  }
}
const used = [...new Set(g.flat().filter((c) => S.palette[c]))];
const spec = { palette: S.palette, maxColors: used.length, rows: g.map((r) => r.join('')) };
if (seed) spec.allowOrphans = true;
writeFileSync(out, JSON.stringify(spec, null, 1));
console.log(`${out}: ${N}x${N}, colors ${used.join('')}`);

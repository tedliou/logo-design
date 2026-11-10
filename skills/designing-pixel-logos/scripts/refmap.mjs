// Measure a reference image from raw BGRA bytes: color clusters, construction lines, cell map.
// Usage: node refmap.mjs <img.bgra> <width> <height> [--k 6] [--frame x0,y0,x1,y1 --grid 96 --cells cx0,cy0,cx1,cy1] [--out map.txt]
import { readFileSync, writeFileSync } from 'node:fs';

const [file, wArg, hArg, ...rest] = process.argv.slice(2);
if (!file || !wArg || !hArg) {
  console.log('usage: node refmap.mjs <img.bgra> <width> <height> [--k 6] [--frame x0,y0,x1,y1 --grid 96 --cells cx0,cy0,cx1,cy1] [--out map.txt]');
  process.exit(2);
}
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const W = Number(wArg), H = Number(hArg);
const buf = readFileSync(file);
if (buf.length < W * H * 4) { console.log(`ERROR file has ${buf.length} bytes, expected ${W * H * 4} for ${W}x${H} BGRA`); process.exit(2); }
const px = (x, y) => { const o = (y * W + x) * 4; return [buf[o + 2], buf[o + 1], buf[o]]; };
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// 1. k-means on a sample, initialised at luma quantiles, then median color per cluster.
const K = Number(opt('--k') || 6);
const sample = [];
for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) sample.push(px(x, y));
const byLuma = [...sample].sort((a, b) => luma(a) - luma(b));
let cent = Array.from({ length: K }, (_, i) => byLuma[Math.floor(((i + 0.5) / K) * byLuma.length)]);
const near = (c) => { let bi = 0, bd = Infinity; cent.forEach((m, i) => { const d = (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
for (let it = 0; it < 12; it++) {
  const acc = cent.map(() => [0, 0, 0, 0]);
  for (const c of sample) { const i = near(c); acc[i][0] += c[0]; acc[i][1] += c[1]; acc[i][2] += c[2]; acc[i][3]++; }
  cent = acc.map((a, i) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cent[i]));
}
const letters = 'abcdefghij';
const groups = cent.map(() => []);
for (const c of sample) groups[near(c)].push(c);
const med = (a, j) => { const s = a.map((c) => c[j]).sort((p, q) => p - q); return s[s.length >> 1] ?? 0; };
groups.forEach((g, i) => console.log(`cluster ${letters[i]}  ${hex([0, 1, 2].map((j) => med(g, j)))}  ${(100 * g.length / sample.length).toFixed(1)}%`));

// 2. construction lines: rows and columns where many pixels are mid-grey and much darker than paper.
const paper = Math.max(...cent.map(luma));
const isLine = (c) => { const l = luma(c); return l > 60 && l < paper - 30; };
const scan = (n, m, get) => {
  const s = [];
  for (let i = 0; i < n; i++) { let k = 0; for (let j = 0; j < m; j++) if (isLine(get(i, j))) k++; s.push(k / m); }
  return s.map((v, i) => [i, v]).filter(([i, v]) => v > 0.35 && v >= (s[i - 1] ?? 0) && v >= (s[i + 1] ?? 0));
};
console.log('vertical lines   x=' + scan(W, H, (i, j) => px(i, j)).map(([i, v]) => `${i}(${v.toFixed(2)})`).join(' '));
console.log('horizontal lines y=' + scan(H, W, (i, j) => px(j, i)).map(([i, v]) => `${i}(${v.toFixed(2)})`).join(' '));

// 3. cell map: pixel frame -> cell frame on an N grid; each cell takes its majority cluster.
const frame = opt('--frame')?.split(',').map(Number);
if (frame) {
  const N = Number(opt('--grid') || 96);
  const cells = (opt('--cells') || `0,0,${N},${N}`).split(',').map(Number);
  const sx = (frame[2] - frame[0]) / (cells[2] - cells[0]), sy = (frame[3] - frame[1]) / (cells[3] - cells[1]);
  const rows = [];
  for (let cy = 0; cy < N; cy++) {
    let s = '';
    for (let cx = 0; cx < N; cx++) {
      const count = new Array(K).fill(0);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = Math.round(frame[0] + (cx - cells[0] + (i + 0.5) / 4) * sx);
        const y = Math.round(frame[1] + (cy - cells[1] + (j + 0.5) / 4) * sy);
        if (x >= 0 && y >= 0 && x < W && y < H) count[near(px(x, y))]++;
      }
      const best = count.indexOf(Math.max(...count));
      s += count[best] ? letters[best] : '.';
    }
    rows.push(s);
  }
  const out = opt('--out') || 'refmap.txt';
  writeFileSync(out, rows.map((r, i) => String(i).padStart(3) + ' ' + r).join('\n') + '\n');
  console.log(`cell map ${N}x${N}, ${sx.toFixed(2)} x ${sy.toFixed(2)} px per cell, written to ${out}`);
}

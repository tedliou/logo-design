// Pixel logo checker and exporter. Node 18+, no dependencies.
// Usage: node check.mjs <logo.json> [--svg out.svg] [--png out.png] [--scale N] [--force]
// logo.json: { "palette": { ".": null, "B": "#1d3557" }, "maxColors": 4, "rows": ["..BB..", ...] }
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const args = process.argv.slice(2);
const input = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!input) {
  console.log('usage: node check.mjs <logo.json> [--svg out.svg] [--png out.png] [--scale N]');
  process.exit(2);
}

let spec;
try {
  spec = JSON.parse(readFileSync(input, 'utf8'));
} catch (e) {
  console.log(`ERROR cannot read JSON: ${e.message}. Fix the file so it parses.`);
  process.exit(2);
}
const { palette = {}, rows = [], maxColors = 4 } = spec;
const h = rows.length;
const w = h ? rows[0].length : 0;
const problems = [];
const hex = /^#[0-9a-fA-F]{6}$/;

for (const [k, v] of Object.entries(palette)) {
  if (k.length !== 1) problems.push(`palette key "${k}" must be one character`);
  if (v !== null && !hex.test(v)) problems.push(`palette "${k}" = ${v}: use #RRGGBB or null for transparent`);
}
rows.forEach((r, y) => {
  if (r.length !== w) problems.push(`row ${y} has length ${r.length}, expected ${w}: pad or trim it`);
  [...r].forEach((c, x) => {
    if (!(c in palette)) problems.push(`(${x},${y}) char "${c}" is not in palette`);
  });
});

const used = new Set(rows.join('').split('').filter((c) => palette[c]));
if (used.size > maxColors) problems.push(`uses ${used.size} colors, limit is ${maxColors}: merge similar colors`);

// Orphan: opaque pixel whose 8 neighbours (diagonals included) all differ.
// Diagonals count so that 1-pixel 45-degree lines are not flagged.
const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= (rows[y] || '').length ? null : rows[y][x]);
const orphans = [];
for (let y = 0; y < h; y++)
  for (let x = 0; x < rows[y].length; x++) {
    const c = rows[y][x];
    if (!palette[c]) continue;
    const n = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (dx || dy) n.push(at(x + dx, y + dy));
    if (n.every((v) => v !== c)) orphans.push(`(${x},${y})`);
  }
if (orphans.length && spec.allowOrphans) console.log(`note: ${orphans.length} orphan pixels allowed (texture variant)`);
else if (orphans.length) problems.push(`orphan pixels ${orphans.length}: ${orphans.join(' ')} (remove, or merge into a neighbouring shape)`);

// Corner check for badges: the four corners should be cut the same way.
const cornerCut = (fx, fy) => {
  let n = 0;
  for (let i = 0; i < Math.min(w, h); i++) {
    const x = fx ? w - 1 - i : i;
    const y = fy ? h - 1 : 0;
    if (palette[at(x, y)]) break;
    n++;
  }
  return n;
};
const cuts = [cornerCut(0, 0), cornerCut(1, 0), cornerCut(0, 1), cornerCut(1, 1)];
const mirrorH = rows.every((r) => r === [...r].reverse().join(''));
const mirrorV = rows.every((r, y) => r === rows[h - 1 - y]);

console.log(`size ${w}x${h}, colors ${used.size}/${maxColors}, mirror left-right ${mirrorH ? 'yes' : 'no'}, mirror top-bottom ${mirrorV ? 'yes' : 'no'}`);
console.log(`corner cut on edge row (TL TR BL BR): ${cuts.join(' ')}${new Set(cuts).size > 1 ? '  <- corners differ, check if intended' : ''}`);

const force = args.includes('--force'); // write outputs anyway, for looking at a failing draft
if (problems.length) {
  problems.forEach((p) => console.log(`FAIL ${p}`));
  if (!force) process.exit(1);
}

const scale = Number(opt('--scale') || 16);
if (!Number.isInteger(scale) || scale < 1) {
  console.log('FAIL --scale must be a positive integer (pixel logos only scale by whole numbers)');
  process.exit(1);
}

const svgPath = opt('--svg');
if (svgPath) {
  let rects = '';
  rows.forEach((r, y) => {
    let x = 0;
    while (x < w) {
      const c = r[x];
      let len = 1;
      while (x + len < w && r[x + len] === c) len++;
      if (palette[c]) rects += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${palette[c]}"/>`;
      x += len;
    }
  });
  writeFileSync(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects}</svg>\n`);
  console.log(`wrote ${svgPath}`);
}

const pngPath = opt('--png');
if (pngPath) {
  const W = w * scale;
  const H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let Y = 0; Y < H; Y++) {
    raw[Y * (W * 4 + 1)] = 0;
    for (let X = 0; X < W; X++) {
      const col = palette[rows[Math.floor(Y / scale)][Math.floor(X / scale)]];
      const o = Y * (W * 4 + 1) + 1 + X * 4;
      if (col) {
        raw[o] = parseInt(col.slice(1, 3), 16);
        raw[o + 1] = parseInt(col.slice(3, 5), 16);
        raw[o + 2] = parseInt(col.slice(5, 7), 16);
        raw[o + 3] = 255;
      }
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(pngPath, png);
  console.log(`wrote ${pngPath} (${W}x${H})`);
}
console.log(problems.length ? "FAIL (outputs written because of --force)" : "PASS");
process.exitCode = problems.length ? 1 : 0;

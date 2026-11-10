#!/usr/bin/env node
// Presentation sheet: the flat mark printed on paper. Texture lives here and never in the mark.
//
//   node texture.mjs <mark.svg> [--constants constants.json] [--out <file.png>] [--size 1600]
//       [--print 0..1] [--misregister <px>] [--fiber 0..1] [--grain 0..1] [--index] [--seed <n>]
//       [--ground paper|ink] [--paper #hex] [--scale 0.5]
//
// Layers, bottom to top: paper with fibers; the ink plate (accent areas knocked out); one plate per
// other color, shifted by --misregister and multiplied over the ink; speckle and edge roughness on
// the plates (--print: 0 is clean, 1 is a worn stencil); grain over everything (--grain).
// --index adds crop marks and two labels that point at construction data (grid lines, angles,
// curve radius) from constants.json; nothing else, so the sheet carries no meaningless text.
// --paper sets the sheet's paper only (the mark's own paper areas keep their color).
// Defaults are a light print: misregister 4 px, print 0.35, fiber 0.5, grain 0.35.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSharp } from './lib/raster.mjs';
import { recolor } from './lib/svg.mjs';
import { rolesFor } from './render.mjs';
import { esc } from './lib/page.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const num = (n, d) => (opt(n) != null ? Number(opt(n)) : d);
const VALUE = new Set(['--constants', '--out', '--size', '--print', '--misregister', '--fiber', '--grain', '--seed', '--ground', '--scale', '--paper']);
const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.has(args[i - 1]));

const innerOf = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
const viewBoxOf = (svg) => {
  const m = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (m) return m[1].trim().split(/[\s,]+/).map(Number);
  const w = Number(svg.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1] || 100), h = Number(svg.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1] || w);
  return [0, 0, w, h];
};

export function presentationSvg(markText, { C = null, size = 1600, print = 0.35, misregister = 3, fiber = 0.5, grain = 0.35, index = false, seed = 7, ground = 'paper', scale = 0.5, paper = null } = {}) {
  const r = rolesFor(markText, C);
  const [vx, vy, vw, vh] = viewBoxOf(markText);
  const k = (size * scale) / Math.max(vw, vh);
  const ox = (size - vw * k) / 2 - vx * k, oy = (size - vh * k) / 2 - vy * k;
  const sheet = paper || r.paper;
  const bg = ground === 'ink' ? r.ink : sheet;
  // Plates: ink, where paper areas and other colors are unprinted (sheet color), and one per other color.
  const none = (keep) => Object.fromEntries([r.ink, r.paper, ...r.others].filter((c) => c !== keep).map((c) => [c, 'none']));
  const knock = ground === 'ink' ? { [r.ink]: sheet, [r.paper]: r.ink, ...Object.fromEntries(r.others.map((c) => [c, r.ink])) } : { [r.paper]: sheet, ...Object.fromEntries(r.others.map((c) => [c, sheet])) };
  const inkPlate = recolor(innerOf(markText), knock);
  const colorPlates = r.others.map((c, i) => ({ c, inner: recolor(innerOf(markText), none(c)), dx: misregister * (i % 2 ? -0.6 : 1), dy: misregister * (i % 2 ? 1 : -0.7) }));
  const p = Math.max(0, Math.min(1, print));
  const holeCut = (30 * (0.29 + 0.1 * p)).toFixed(2); // alpha = 30 R - cut: about 3% holes at print 0, 15% at 1
  const rough = (0.6 + 3.4 * p).toFixed(2);
  const fiberA = (0.05 * fiber).toFixed(3), grainA = (0.16 * grain).toFixed(3);
  const tf = `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(4)})`;
  const plateFilter = (id, s) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${s}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  30 0 0 0 -${holeCut}" result="keep"/>
  <feComposite in="SourceGraphic" in2="keep" operator="in" result="speck"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${s + 11}" result="t"/>
  <feDisplacementMap in="speck" in2="t" scale="${rough}" xChannelSelector="R" yChannelSelector="G"/>
</filter>`;
  const labels = [];
  if (index && C) {
    const lines = (C.grid?.lines || []).join(' ');
    const ang = (C.angles?.set || []).join(' ');
    const rad = (C.curves || []).filter((c) => c.radius).map((c) => `R${c.radius}`).join(' ');
    const m = size * 0.06, L = size * 0.025, col = ground === 'ink' ? r.paper : r.ink;
    const crop = [[m, m, 1, 1], [size - m, m, -1, 1], [m, size - m, 1, -1], [size - m, size - m, -1, -1]]
      .map(([x, y, sx, sy]) => `<path d="M${x - sx * L} ${y} H${x + sx * L * 0.4} M${x} ${y - sy * L} V${y + sy * L * 0.4}" stroke="${col}" stroke-width="${size / 900}" fill="none"/>`).join('');
    const fs = (size / 75).toFixed(1);
    labels.push(`<g font-family="ui-monospace,Consolas,'Courier New',monospace" font-size="${fs}" fill="${col}" opacity="0.8">${crop}`,
      `<text x="${m + L}" y="${m - L * 0.5}">GRID ${esc(C.canvas?.size ?? '')} / ${esc(lines)}</text>`,
      `<text x="${size - m - L}" y="${size - m + L * 0.9}" text-anchor="end">ANGLE ${esc(ang)}${rad ? ` / ${esc(rad)}` : ''}</text></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
<filter id="fiber" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.06" numOctaves="3" seed="${seed}" result="f"/>
  <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0 0.18  -3 0 0 0 ${(1.9).toFixed(2)}"/>
  <feComponentTransfer><feFuncA type="linear" slope="${fiberA}"/></feComponentTransfer>
</filter>
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${seed + 3}"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="table" tableValues="0 ${grainA}"/></feComponentTransfer>
</filter>
${plateFilter('plate0', seed + 5)}
${colorPlates.map((_, i) => plateFilter(`plate${i + 1}`, seed + 17 + i)).join('\n')}
</defs>
<rect width="${size}" height="${size}" fill="${bg}"/>
<g filter="url(#plate0)"><g transform="${tf}">${inkPlate}</g></g>
${colorPlates.map((pl, i) => `<g filter="url(#plate${i + 1})" style="mix-blend-mode:multiply"><g transform="translate(${pl.dx.toFixed(2)} ${pl.dy.toFixed(2)}) ${tf}">${pl.inner}</g></g>`).join('\n')}
<rect width="${size}" height="${size}" filter="url(#fiber)" style="mix-blend-mode:multiply"/>
<rect width="${size}" height="${size}" filter="url(#grain)" style="mix-blend-mode:multiply"/>
${labels.join('\n')}
</svg>`;
}

if (fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1] || '').toLowerCase()) {
  if (!files.length) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(2); }
  try {
    const sharp = await loadSharp();
    const cpath = opt('--constants');
    const C = cpath ? JSON.parse(readFileSync(cpath, 'utf8')) : null;
    for (const f of files) {
      const svg = presentationSvg(readFileSync(f, 'utf8'), {
        C, size: num('--size', 1600), print: num('--print', 0.35), misregister: num('--misregister', 4), fiber: num('--fiber', 0.5),
        grain: num('--grain', 0.35), index: args.includes('--index'), seed: num('--seed', 7), ground: opt('--ground', 'paper'), scale: num('--scale', 0.5), paper: opt('--paper'),
      });
      const out = opt('--out') && files.length === 1 ? opt('--out') : join(dirname(resolve(f)), `${basename(f, '.svg')}-presentation.png`);
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out.replace(/\.png$/i, '.svg'), svg);
      await sharp(Buffer.from(svg)).png().toFile(out);
      console.log(`wrote ${out.replace(/\\/g, '/')} (and the .svg next to it)`);
    }
  } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
}

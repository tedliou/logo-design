// Rasterizing and pixel helpers on top of sharp (librsvg for SVG input).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { sized } from './svg.mjs';
import { parseHex } from './color.mjs';

// sharp resolves from this file upward (the project's node_modules); a plugin install brings its own copy.
// LOGO_SHARP_FROM points at another package.json whose node_modules has sharp.
let sharpMod;
export async function loadSharp() {
  if (sharpMod) return sharpMod;
  try {
    sharpMod = (await import('sharp')).default;
  } catch {
    const from = process.env.LOGO_SHARP_FROM;
    if (!from) throw new Error('sharp is not installed. Run "npm install sharp" in the skill folder or the project, or set LOGO_SHARP_FROM to a package.json whose node_modules has sharp.');
    sharpMod = createRequire(pathToFileURL(from))('sharp');
  }
  return sharpMod;
}

// Render SVG text at size x size (square marks) or w x h. background: hex or null for transparent.
export async function svgToPng(svgText, w, h = w, background = null) {
  const sharp = await loadSharp();
  let img = sharp(Buffer.from(sized(svgText, w, h)), { density: 72 });
  if (background) img = img.flatten({ background });
  return img.png().toBuffer();
}

// Decode any image buffer or path to RGBA pixels.
export async function rgba(input, { width, height, background, kernel } = {}) {
  const sharp = await loadSharp();
  let img = sharp(input).ensureAlpha();
  if (width || height) img = img.resize(width, height, { fit: 'fill', kernel: kernel || 'lanczos3' });
  if (background) img = img.flatten({ background });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Darkness map relative to a paper color: 0 = paper, 1 = as dark as ink (clamped). Alpha counts as paper.
export function darkness({ data, width, height }, paperHex, inkHex) {
  const [pr, pg, pb] = parseHex(paperHex), [ir, ig, ib] = parseHex(inkHex);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lp = lum(pr, pg, pb), li = lum(ir, ig, ib), span = Math.max(1, Math.abs(lp - li));
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    const l = lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) * a + lp * (1 - a);
    out[i] = Math.min(1, Math.max(0, Math.abs(lp - l) / span));
  }
  return out;
}

export const mean = (arr) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

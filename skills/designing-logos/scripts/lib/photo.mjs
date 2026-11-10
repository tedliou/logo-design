// Photo helpers: EXIF-oriented size, region parsing, OKLab pixels, and seeded k-means.
// Coordinates everywhere are pixels of the upright (EXIF-rotated) original photo.
import { loadSharp } from './raster.mjs';
import { rgbToOklab } from './color.mjs';

export async function orientedSize(file) {
  const sharp = await loadSharp();
  const m = await sharp(file).metadata();
  return (m.orientation || 1) >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
}

// "x0,y0,x1,y1" in photo pixels, or fractions of the size when every value is at most 1.
export function parseBox(spec, size) {
  const v = String(spec).split(',').map(Number);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) throw new Error(`box "${spec}" needs four numbers x0,y0,x1,y1`);
  const frac = v.every((n) => n >= 0 && n <= 1);
  const [x0, y0, x1, y1] = frac ? [v[0] * size.width, v[1] * size.height, v[2] * size.width, v[3] * size.height] : v;
  const box = { left: Math.max(0, Math.round(Math.min(x0, x1))), top: Math.max(0, Math.round(Math.min(y0, y1))) };
  box.width = Math.min(size.width - box.left, Math.round(Math.abs(x1 - x0)));
  box.height = Math.min(size.height - box.top, Math.round(Math.abs(y1 - y0)));
  if (box.width < 2 || box.height < 2) throw new Error(`box "${spec}" is empty or outside the ${size.width}x${size.height} photo`);
  return box;
}

// Upright photo (or a box of it) scaled to `width`, as OKLab pixels.
export async function oklabPixels(file, { box, width = 200 } = {}) {
  const sharp = await loadSharp();
  let img = sharp(file).rotate();
  if (box) img = img.extract(box);
  const { data, info } = await img.resize({ width, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 3) px.push(rgbToOklab([data[i], data[i + 1], data[i + 2]]));
  return { px, width: info.width, height: info.height };
}

// k-means++ with a fixed seed so the same photo always gives the same palette.
export function kmeans(points, K, { seed = 7, iterations = 30 } = {}) {
  if (!points.length) return { centers: [], assign: [] };
  K = Math.min(K, points.length);
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const centers = [points[Math.floor(rnd() * points.length)]];
  const best = points.map((p) => d2(p, centers[0]));
  while (centers.length < K) {
    const sum = best.reduce((a, b) => a + b, 0);
    let t = rnd() * sum, i = 0;
    while (i < points.length - 1 && (t -= best[i]) > 0) i++;
    centers.push(points[i]);
    for (let j = 0; j < points.length; j++) best[j] = Math.min(best[j], d2(points[j], points[i]));
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let j = 0; j < points.length; j++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < K; c++) { const d = d2(points[j], centers[c]); if (d < bd) { bd = d; bi = c; } }
      if (assign[j] !== bi) { assign[j] = bi; moved++; }
    }
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < points.length; j++) { const a = acc[assign[j]]; a[0] += points[j][0]; a[1] += points[j][1]; a[2] += points[j][2]; a[3]++; }
    acc.forEach((a, c) => { if (a[3]) centers[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    if (!moved && it) break;
  }
  return { centers, assign };
}

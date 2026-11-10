// Color helpers shared by the scripts: hex parsing, sRGB <-> OKLab, WCAG contrast.
// OKLab matrices from Bjorn Ottosson, "A perceptual color space for image processing" (2020).

const NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080' };

// Returns '#rrggbb', 'none', or null when the value is not a color we can read (gradients, currentColor).
export function normalizeColor(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return 'none';
  if (NAMED[v]) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + [...m[1]].map((c) => c + c).join('');
  m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return v;
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return toHex([+m[1], +m[2], +m[3]]);
  return null;
}

export function parseHex(hex) {
  const n = normalizeColor(hex);
  if (!n || n === 'none') return null;
  return [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
}

export const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export const oklabToHex = (lab) => toHex(oklabToRgb(lab));
export const hexToOklab = (hex) => rgbToOklab(parseHex(hex));
export const chroma = ([, a, b]) => Math.hypot(a, b);
export const hueDeg = ([, a, b]) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
export const deltaE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// WCAG 2.x relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(h1, h2) {
  const [a, b] = [luminance(h1), luminance(h2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

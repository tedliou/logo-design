// Minimal SVG reader for logo marks: resolves inherited fill/stroke/transform and turns every
// shape into points, straight segments and curve segments in viewBox coordinates.
// It reads presentation attributes and style="", not <style> sheets; it reports what it skips.
import { normalizeColor } from './color.mjs';

const NON_RENDERED = new Set(['defs', 'clippath', 'mask', 'symbol', 'pattern', 'marker', 'lineargradient', 'radialgradient', 'filter', 'metadata', 'title', 'desc']);
const SHAPES = new Set(['rect', 'polygon', 'polyline', 'line', 'circle', 'ellipse', 'path']);
const INHERITED = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'opacity', 'filter', 'clip-path', 'mask'];

function attrsOf(src) {
  const out = {};
  for (const m of src.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3];
  if (out.style) for (const decl of out.style.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return out;
}

export const nums = (s) => (String(s ?? '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);

// 2D affine matrix [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function parseTransform(s) {
  let m = I;
  for (const t of String(s || '').matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const v = nums(t[2]);
    let n = I;
    if (t[1] === 'matrix') n = v.slice(0, 6);
    else if (t[1] === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (t[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (t[1] === 'rotate') {
      const r = ((v[0] || 0) * Math.PI) / 180, c = Math.cos(r), s2 = Math.sin(r);
      n = [c, s2, -s2, c, 0, 0];
      if (v.length >= 3) n = mul(mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    } else if (t[1] === 'skewX') n = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else n = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = mul(m, n);
  }
  return m;
}

// Path data -> subpaths of segments {kind:'line'|'curve', cmd, from, to, ctrl:[...], radii?}
export function parsePath(d) {
  const tokens = String(d || '').match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const segs = [];
  let i = 0, cmd = '', cur = [0, 0], start = [0, 0], lastCtrl = null, lastCmd = '';
  const num = () => Number(tokens[i++]);
  const more = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const pt = (x, y) => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    if (C === 'Z') { if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push({ kind: 'line', cmd: 'Z', from: cur, to: start }); cur = start; lastCmd = 'Z'; if (!more()) continue; }
    if (C === 'M') { cur = start = pt(num(), num()); segs.push({ kind: 'move', cmd: 'M', to: cur }); cmd = rel ? 'l' : 'L'; lastCmd = 'M'; continue; }
    if (!more()) continue; // command letter without numbers: read the next command
    if (C === 'L') { const to = pt(num(), num()); segs.push({ kind: 'line', cmd: 'L', from: cur, to }); cur = to; }
    else if (C === 'H') { const x = num(); const to = [rel ? cur[0] + x : x, cur[1]]; segs.push({ kind: 'line', cmd: 'H', from: cur, to }); cur = to; }
    else if (C === 'V') { const y = num(); const to = [cur[0], rel ? cur[1] + y : y]; segs.push({ kind: 'line', cmd: 'V', from: cur, to }); cur = to; }
    else if (C === 'C') { const c1 = pt(num(), num()), c2 = pt(num(), num()), to = pt(num(), num()); segs.push({ kind: 'curve', cmd: 'C', from: cur, to, ctrl: [c1, c2] }); lastCtrl = c2; cur = to; }
    else if (C === 'S') { const c1 = /[CS]/.test(lastCmd) && lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur; const c2 = pt(num(), num()), to = pt(num(), num()); segs.push({ kind: 'curve', cmd: 'S', from: cur, to, ctrl: [c1, c2] }); lastCtrl = c2; cur = to; }
    else if (C === 'Q') { const c1 = pt(num(), num()), to = pt(num(), num()); segs.push({ kind: 'curve', cmd: 'Q', from: cur, to, ctrl: [c1] }); lastCtrl = c1; cur = to; }
    else if (C === 'T') { const c1 = /[QT]/.test(lastCmd) && lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur; const to = pt(num(), num()); segs.push({ kind: 'curve', cmd: 'T', from: cur, to, ctrl: [c1] }); lastCtrl = c1; cur = to; }
    else if (C === 'A') { const rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), to = pt(num(), num()); segs.push({ kind: 'curve', cmd: 'A', from: cur, to, ctrl: [], radii: [Math.abs(rx), Math.abs(ry)], rot, large, sweep }); cur = to; }
    else { i++; continue; }
    lastCmd = C;
  }
  return segs;
}

function shapeGeometry(tag, a) {
  const n = (k, d = 0) => (a[k] === undefined ? d : Number(a[k]));
  if (tag === 'rect') {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height');
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    return { points: pts, closed: true, curves: n('rx') > 0 || n('ry') > 0 ? [{ kind: 'curve', cmd: 'rx', radii: [n('rx') || n('ry'), n('ry') || n('rx')] }] : [] };
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const v = nums(a.points), pts = [];
    for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
    return { points: pts, closed: tag === 'polygon', curves: [] };
  }
  if (tag === 'line') return { points: [[n('x1'), n('y1')], [n('x2'), n('y2')]], closed: false, curves: [] };
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = n('cx'), cy = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? n('r') : n('ry');
    return { points: [], closed: true, curves: [{ kind: 'curve', cmd: tag, center: [cx, cy], radii: [rx, ry], bbox: [cx - rx, cy - ry, cx + rx, cy + ry] }] };
  }
  // path: vertices are segment end points; straight segments become edges
  const segs = parsePath(a.d);
  const points = [], edges = [], curves = [];
  for (const s of segs) {
    if (s.kind === 'move') points.push(s.to);
    else if (s.kind === 'line') { points.push(s.to); edges.push([s.from, s.to]); }
    else { points.push(s.to); curves.push(s); }
  }
  return { points, edges, closed: false, curves };
}

// Parse an SVG document. Returns { viewBox, width, height, elements, warnings }.
export function parseSvg(text) {
  const warnings = [];
  const src = String(text).replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const stack = [{ tag: '#root', inh: { fill: '#000000', stroke: 'none', 'stroke-width': '1' }, m: I, hidden: false, clip: false }];
  const elements = [];
  let root = null, index = 0;
  for (const t of src.matchAll(/<(\/?)([a-zA-Z][\w:.-]*)([^>]*?)(\/?)>/g)) {
    const [, close, rawTag, rest, selfClose] = t;
    const tag = rawTag.toLowerCase();
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const a = attrsOf(rest);
    const parent = stack[stack.length - 1];
    const inh = { ...parent.inh };
    for (const k of INHERITED) if (a[k] !== undefined && !['clip-path', 'mask', 'filter', 'opacity'].includes(k)) inh[k] = a[k];
    const node = {
      tag, a, inh,
      m: mul(parent.m, parseTransform(a.transform)),
      hidden: parent.hidden || NON_RENDERED.has(tag),
      clip: parent.clip || tag === 'clippath',
      classes: [...(parent.classes || []), ...String(a.class || '').split(/\s+/).filter(Boolean)],
      effects: [...(parent.effects || [])],
    };
    for (const k of ['filter', 'mask', 'clip-path']) if (a[k] && a[k] !== 'none') node.effects.push(`${k}=${a[k]}`);
    for (const k of ['opacity', 'fill-opacity', 'stroke-opacity']) if (a[k] !== undefined && Number(a[k]) < 1) node.effects.push(`${k}=${a[k]}`);
    if (tag === 'svg' && !root) root = a;
    if (tag === 'style') warnings.push('<style> found: CSS rules are not evaluated; put fill and stroke on the elements');
    if (tag === 'use') warnings.push('<use> found: referenced shapes are not expanded');
    if (SHAPES.has(tag) || ['text', 'image', 'foreignobject', 'use'].includes(tag)) {
      const el = { index: index++, tag, attrs: a, classes: node.classes, id: a.id || null, role: node.clip ? 'clip' : node.hidden ? 'hidden' : 'drawn', effects: node.effects };
      el.fill = normalizeColor(inh.fill) ?? inh.fill;
      el.stroke = normalizeColor(inh.stroke) ?? inh.stroke;
      el.strokeWidth = Number(inh['stroke-width'] ?? 1);
      if (SHAPES.has(tag)) {
        const g = shapeGeometry(tag, a);
        el.points = g.points.map((p) => apply(node.m, p));
        el.closed = g.closed;
        el.edges = (g.edges || el.points.map((p, k) => (k + 1 < el.points.length ? [p, el.points[k + 1]] : null)).filter(Boolean).concat(g.closed && el.points.length > 2 ? [[el.points[el.points.length - 1], el.points[0]]] : []))
          .map(([p, q]) => (g.edges ? [apply(node.m, p), apply(node.m, q)] : [p, q]));
        el.curves = g.curves;
        el.linear = Math.abs(node.m[1]) < 1e-9 && Math.abs(node.m[2]) < 1e-9 ? 'axis' : 'rotated';
        const all = [...el.points, ...g.curves.flatMap((c) => (c.bbox ? [[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[3]]].map((p) => apply(node.m, p)) : [...(c.ctrl || []).map((p) => apply(node.m, p)), ...(c.to ? [apply(node.m, c.to)] : [])]))];
        el.bbox = all.length ? [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] : null;
      }
      elements.push(el);
    }
    if (!selfClose) stack.push(node);
  }
  const vb = root ? nums(root.viewbox) : [];
  return {
    viewBox: vb.length === 4 ? vb : null,
    width: root?.width ? Number.parseFloat(root.width) : null,
    height: root?.height ? Number.parseFloat(root.height) : null,
    elements,
    warnings: [...new Set(warnings)],
  };
}

// All fill and stroke colors used by drawn elements, with how many elements use each.
export function colorUsage(svg) {
  const use = new Map();
  for (const el of svg.elements.filter((e) => e.role === 'drawn')) {
    for (const c of [el.fill, el.stroke]) if (c && c !== 'none') use.set(c, (use.get(c) || 0) + 1);
  }
  return use;
}

// Set the root <svg> width and height (keeps the viewBox), used before rasterizing.
export function sized(svgText, w, h = w) {
  return svgText.replace(/<svg\b([^>]*)>/i, (all, attrs) => {
    const cleaned = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
}

// Replace colors throughout the SVG source. map: { '#18181b': '#fafafa', ... } (keys normalized).
export function recolor(svgText, map) {
  const norm = Object.fromEntries(Object.entries(map).map(([k, v]) => [normalizeColor(k), v]));
  return svgText.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (h) => norm[normalizeColor(h)] ?? h);
}

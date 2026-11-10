// Construction sheet: the mark over its grid lines, with the circles its curve families were fitted to
// (as check.mjs measures them) and the construction numbers listed underneath.
import { parseSvg } from './svg.mjs';
import { esc, SVG_FONT } from './page.mjs';
import { matches, fitCircle, ribbon } from '../check.mjs';

export function constructionSvg(C, markText) {
  const S = C.canvas.size, scale = 640 / S, pad = 70, W = S * scale + 2 * pad;
  const inner = markText.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const lines = (C.grid.lines || []).map((v) => Number(v));
  const g = [];
  const unit = C.grid.unit || 1;
  if (S / unit <= 160) for (let v = 0; v <= S; v += unit) g.push(`<line x1="${v}" y1="0" x2="${v}" y2="${S}" class="fine"/><line x1="0" y1="${v}" x2="${S}" y2="${v}" class="fine"/>`);
  for (const v of lines) g.push(`<line x1="${v}" y1="-4" x2="${v}" y2="${S + 4}" class="major"/><line x1="-4" y1="${v}" x2="${S + 4}" y2="${v}" class="major"/>`);
  const labels = lines.map((v) => `<text x="${pad + v * scale}" y="${pad - 14}" text-anchor="middle">${v}</text><text x="${pad - 14}" y="${pad + v * scale + 4}" text-anchor="end">${v}</text>`).join('');
  // curve families: the circle each member was fitted to, as check.mjs measures it
  const circles = [];
  for (const fam of C.curves || []) {
    for (const el of parseSvg(markText).elements.filter((e) => e.role === 'drawn' && e.points && matches(e, fam.match || {}))) {
      const pts = fam.kind === 'ribbon' ? ribbon(el.points)?.center : el.points;
      const c = pts && fitCircle(pts);
      if (c && c.r < 4 * S) circles.push(c);
    }
  }
  const famNotes = (C.curves || []).map((f) => `${f.name}: ${f.kind || 'curve'}${f.radius ? `, radius ${f.radius}` : ''}${f.count ? `, ${f.count} of them` : ''}`);
  const notes = [`canvas ${S} x ${S}, unit ${unit}`, `grid lines ${lines.join(', ')}`, `angles ${(C.angles.set || []).join(', ')} deg`, ...famNotes,
    ...Object.entries(C.colors || {}).filter(([k, v]) => k !== 'why' && v?.hex).map(([k, v]) => `${k} ${v.hex}${v.maxElements ? `, at most ${v.maxElements} element` : ''}`)];
  const H = W + 26 * notes.length + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.fine{stroke:#0ea5e9;stroke-width:${0.5 / scale};opacity:.18}.major{stroke:#0284c7;stroke-width:${1.4 / scale};stroke-dasharray:${4 / scale} ${3 / scale}}.circ{fill:none;stroke:#db2777;stroke-width:${1.2 / scale};stroke-dasharray:${6 / scale} ${4 / scale}}text{font-family:${SVG_FONT};font-size:13px;fill:#3f3f46}</style>
<rect width="${W}" height="${H}" fill="#ffffff"/>
<clipPath id="area"><rect x="${pad - 40}" y="${pad - 40}" width="${S * scale + 80}" height="${S * scale + 80}"/></clipPath>
<g clip-path="url(#area)"><g transform="translate(${pad} ${pad}) scale(${scale})"><rect width="${S}" height="${S}" fill="${C.colors?.paper?.hex || '#fafafa'}"/>${inner}${g.join('')}${circles.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" class="circ"/>`).join('')}</g></g>
${labels}
${notes.map((n, i) => `<text x="${pad}" y="${W + 4 + i * 26}">${esc(n)}</text>`).join('')}
</svg>`;
}

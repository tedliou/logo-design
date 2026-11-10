// Self-contained HTML pages for boards and the rationale: one file, images inlined as data URIs,
// light and dark themes, readable on a phone. The same file can be opened locally or published.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const dataUri = (buf, type = 'image/png') => `data:${type};base64,${Buffer.from(buf).toString('base64')}`;

// Fonts for text inside rendered PNGs (librsvg picks the first installed one).
export const SVG_FONT = '"Segoe UI","Microsoft JhengHei","PingFang TC","Noto Sans CJK TC","Noto Sans TC","Helvetica Neue",Arial,sans-serif';

const TOKENS_LIGHT = '--bg:#f4f4f5;--surface:#ffffff;--text:#18181b;--muted:#52525b;--line:#d4d4d8;--accent:#b4233f;--keep:#0f766e;--off:#e4e4e7';
const TOKENS_DARK = '--bg:#131316;--surface:#1c1c20;--text:#f4f4f5;--muted:#a1a1aa;--line:#3f3f46;--accent:#f0607c;--keep:#2dd4bf;--off:#27272a';

export function page({ title, description = '', body, extraCss = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<style>
:root{${TOKENS_LIGHT};color-scheme:light dark}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${TOKENS_DARK}}}
:root[data-theme="dark"]{${TOKENS_DARK}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif}
main{max-width:1240px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}h3{font-size:15px;margin:16px 0 6px}
p{margin:6px 0}.muted{color:var(--muted)}code{font:13px ui-monospace,Consolas,monospace}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
img.px{image-rendering:pixelated}
.tile{display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
${extraCss}
</style>
</head>
<body><main>
${body}
</main></body>
</html>
`;
}

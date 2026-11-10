# Lockups and exports

Read when the logo needs a wordmark beside it, or when exporting files.

## Lockup matrix

- Enumerate every combination of language and layout in one table before choosing. Merge cells that are identical (a single language has no separate "one line" layout) and say so in the cell.
- Mark each cell primary, language version, wordmark, or derivable. Export SVG for every cell and PNG only for the official ones, so the set stays small but nothing has to be redrawn later.

## Alignment from the mark

- Work in mark units: 1u = 1/128 of the mark height (or of whatever master grid the mark uses).
- Take every size and gap from the mark's own construction numbers (tile, gutter, half tile, face block), so text lines sit on the mark's rows. Example: a two-line text block of 38 + 19 + 26 = 83u fills exactly the two lower rows of a 3 × 3 mark.
- Measure English by cap height and CJK by ink height, both from the font's real outlines, not from the em box.
- In a one-line bilingual lockup, set both scripts at one font size on one baseline; matching the visible heights instead makes the Latin look too large.

## Outlined text

- Convert the wordmarks to paths so files do not depend on installed fonts. In a headless browser page, load opentype.js and a static WOFF (Fontsource packages ship per-weight WOFF files; CJK families are split into unicode-range subsets listed in the weight's CSS), call `getPath`, and print the path data and `os2.sCapHeight` into the page; read it back with `--dump-dom`.
- Keep at least six decimals in scale transforms; two decimals made a 26u line render 12% too large and run into the next element.

## Minimum sizes

- Derive them from legibility floors, not taste: for example CJK at 14 px font size or more and Latin at 12 px or more. The smallest px per u that keeps every line above its floor gives the minimum mark height; wordmarks state a minimum overall height instead. Round up to the layout grid (4 px).
- Show each official lockup at its minimum size, at 1:1, in the delivery page.

## Exports

- Mark: the hand-placed sprites at 16 and 32, vector renders from 48 up (48, 64, 96, 128, 192, 256, 512, 1024), and inverse renders for dark backgrounds.
- App icons: `favicon.ico` built from PNG entries (16, 32, 48), an SVG favicon whose colours swap under `prefers-color-scheme: dark`, and a 180 px apple-touch-icon on an opaque background.
- Render SVG to PNG with headless Edge or Chrome: `--headless=new --default-background-color=00000000 --window-size=W,H --screenshot=out.png`. Always pass a separate `--user-data-dir` and a timeout with one retry; sharing the user's open browser profile made renders hang.
- When an SVG already has width and height, replace them instead of adding a second pair, or the render keeps the old size and crops.
- Verify every PNG's size and colour type after export, and look at a contact sheet of the files on light and dark backgrounds.

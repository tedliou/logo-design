# Pixel logo techniques

Read before drawing letters, curves, or corners.

## Grid size by use

| Use | Grid | Notes |
|---|---|---|
| Favicon, status bar | 16x16 | One letter or one symbol, strokes 1 to 2 cells. |
| Icon, small avatar | 24x24, 32x32 | Simple object. Kare's Macintosh icons were 32x32, 1-bit. |
| App icon, hero symbol | 48x48, 64x64 | One shading layer allowed; must still pass a 16x16 redraw test. |
| Master with thin lines | 96x96 | 1-cell lines stay delicate next to large planes; draw with geometry ([geometry.md](geometry.md)). |
| Wordmark | cap height 5, 7, or 9 cells | 5 is the smallest readable cap height; 7 allows lowercase and rounder letters. |

## Line slopes

A run is a straight stretch of same-color pixels on one row or column.

```
1:1 (45 deg)   2:1            3:1            uneven (avoid)
X              XX             XXX            XX
 X               XX              XXX           X
  X                XX               XXX         XXX
```

- Straight lines: every run the same length.
- Curves: run lengths change monotonically, e.g. 3-2-1-1-2-3, never 3-1-2-1-3.
- Doubles are extra pixels at a bend that make a 1-cell line look 2 cells thick; remove the corner pixel so pixels touch only diagonally.

## Corner cuts

```
radius ~1        radius ~2          radius ~3
.XXXXXX.         ..XXXXXX..         ...XXXXXX...
XXXXXXXX         .XXXXXXXX.         .XXXXXXXXXX.
XXXXXXXX         XXXXXXXXXX         .XXXXXXXXXX.
                                    XXXXXXXXXXXX
```

16-cell badge: cut 1 to 2. 32: cut 2 to 3. 64: cut 4 to 6. The checker prints the cut on each corner's edge row; all four should match.

## Letterforms

- One stroke width for all letters: 1 cell (light) or 2 cells (bold). Bold reads best at 16.
- Counters (the enclosed space in O, P, A) at least 1 cell, at least 2 with bold strokes.
- Letter spacing a fixed 1 cell. If spacing looks uneven, change letter widths, never use half cells.
- Diagonals at 45 degrees only. At cap height 5, draw A, V, W, K, X in squared versions.
- Round letters (O, C, S, G): cut each outer corner by 1 cell instead of drawing a curve. This is Crouwel's New Alphabet approach.
- CJK characters: one very simple character or radical fits 16x16; a full CJK wordmark needs 12 to 16 cells of height per character.

## Color

- Map each brand color to one palette entry. No gradients.
- Shadows and highlights shift hue (shadows cooler, highlights warmer) instead of only darkening, which keeps colors clean.
- Check contrast between the mark and its fill; two brand colors of similar lightness merge at small sizes.

## Anti-aliasing (AA)

AA adds in-between colors along a jagged edge to smooth it. For logos:

- Default to none.
- If a curve needs it, keep it on inner edges, with lightness between the two colors it bridges, and reuse a palette color.
- Fewer stacked shades beat many single-pixel steps; long runs need longer AA segments.

## Outlines and clear space

- Unknown background: add a 1-cell outline or keep at least 1 cell of clear space.
- Selective outline (outline in a darker shade of the neighbouring fill instead of black) suits character symbols, not marks that need a one-color version.
- State clear space in cells, e.g. 2 cells on every side.

## Common faults

| Fault | What it is | Fix |
|---|---|---|
| Orphan | Single pixel with four differently colored neighbours | Remove or merge into a neighbouring shape |
| Doubles | Extra pixel at a bend, line looks thick | Remove the corner pixel |
| Banding | Equal parallel runs stacked side by side, the grid shows | Stagger run lengths |
| Pillow shading | Shade fading evenly inward from the outline, no light direction | Choose a light source, shade one side |
| Mixels | Pixels of different sizes in one image | Redraw on one grid |
| Tangents | Edges that just touch or line up exactly | Overlap them or separate clearly |
| Jaggies | Uneven runs on a line or curve | Apply the run rules |

## Export

- SVG: whole-number `<rect>` coordinates, `shape-rendering="crispEdges"`. Crisp at any size.
- PNG: whole-number scale, nearest-neighbour only.
- Web: `image-rendering: pixelated` on scaled PNGs.
- Versions: primary, one-color, inverted; horizontal and vertical lockups when a wordmark and symbol are combined.

---
name: designing-pixel-logos
description: Designs square, grid-based pixel-art or partly pixel logos (badges, seals, monograms, wordmarks, symbols, favicons) at trademark quality, from a brief or a reference image, as character matrices, rasterized geometry, or vector on a pixel construction grid; checks them with a script and exports crisp SVG and PNG. Use when asked to draw, design, translate into pixels, or review a pixel-style, 8-bit, retro, or bitmap logo or icon.
when_to_use: The whole mark is pixel art (8-bit, bitmap, retro), the user wants a 16 or 32 px pixel favicon, or an existing mark needs hand-drawn pixel versions for small sizes. Vector marks, photo-to-mark work and nine-grid ideation go to designing-logos.
---

# Pixel logo

A pixel logo is decided cell by cell on a fixed grid. Image models only imitate that grid (uneven pixel sizes, off-grid edges, blended colors), so the design is written as a matrix of palette characters, either typed by hand or rasterized from integer geometry, and a script checks and renders it.

A user's standard is a trademark, not a sprite. A quick cute drawing that merely depicts the subject reads as thin and meaningless. Every run must produce a concept, a construction system, and a logo system, as the steps below require.

## Rules that always hold

- Every element has a stated reason. Pick the subject's 2 or 3 most identifying features (outline, structure, gesture) and drop the rest; say what each kept element means.
- The mark has a closed, recognizable silhouette and survives one color. Test it filled in one color and at 1x.
- Build on a construction system: integer vertices, a module (for example 8 cells), and a fixed slope set: flat, vertical, 1:1, n:1, 1:n. Equal runs on every line; curves change run length monotonically (6-4-3-2-2-1). Uneven runs are jaggies.
- Design at each final size. Redraw per size and drop details in a planned order; never downscale. Scale only by whole numbers, nearest neighbour.
- 1 to 4 inks, flat fills. An overprint color where two inks cross counts as the crossing, not a new ink. Grain, misregistration and dithering belong to a print variant, never to the mark.
- Keep presentation layers (construction grid, index labels, texture) out of the mark. They live in a construction sheet.
- Pixels may be partial. When the brief allows a hybrid mark, build the mark as vector on the same construction grid and put pixels only where they carry meaning (game, digital, something being rendered), for example one edge breaking into steps. The favicon sizes are then full pixel sprites.
- Lines that stand for something organic (whiskers, hair, antennae, stems) droop under gravity: arcs sharing one radius that taper toward the tip. Straight radiating rays read as stiff. Details in [references/geometry.md](references/geometry.md), "Organic lines".
- No tangents: a line either crosses a shape decisively or keeps 2 cells away. No orphan pixels (all eight neighbours a different color) outside texture variants.
- Round corners by cutting cells; no outer anti-aliasing; stay clearly distinct from existing trademarks and game characters.

## Steps

1. Brief. Brand name, subject, form, sizes, backgrounds, colors. Ask once for what changes the design; default the rest and say so. If the user gives a reference image, measure it before drawing: palette, frame ratio, and a cell map of its shapes ([references/geometry.md](references/geometry.md), "Measure a reference"). Check: form, sizes, palette, and the reference measurements are written down.
2. Concept. Name the 2 or 3 features, what each element means, and one sentence for the whole mark. When the brand has several themes, lay them out as a mandala chart: the core in the centre of a 3x3, eight themes around it, eight visual motifs per theme; mark which motifs reach the logo. A 3x3 mark can map its tiles one to one onto the chart's centre. Check: no element without a reason.
3. Construction. Choose the master grid: 96 when thin lines must survive, 48 to 64 otherwise; 32 and below are only for the size ladder. Fix the module, the vertex rule, the slope set and any measured proportion (for example whisker ends falling at equal steps). Check: the rules fit in five lines.
4. Directions. Draw two or three that differ in kind, usually an open mark, a closed mark (seal, badge, window), and a construction sheet. Grids of 48 and up: write geometry and rasterize with `scripts/raster.mjs` (format in [references/geometry.md](references/geometry.md)). Smaller grids: type the matrix ([references/techniques.md](references/techniques.md) for lines, corners, letters). Check: each direction has its own matrix.
5. Check and look. Run `node <skill-dir>/scripts/check.mjs logo.json --png logo.png --scale N` (add `--force` to see a failing draft). Read the PNG and a side-by-side sheet of the directions; walk the review list. Critique in writing, fix, rerun. Check: last line PASS and every review item answered.
6. System. Pick the primary, then build the size ladder (master, half, 32, 16), one-color versions by palette swap, and, if asked for texture, a print variant. When the logo has a name, build lockups as a matrix of language × layout (for example English, Chinese, both orders × horizontal, vertical, one line, wordmark only); see [references/lockups.md](references/lockups.md). Check: every file passes step 5 and the 1x previews read.
7. Deliver. JSON sources, SVG and PNG at whole-number scales, the concept, the construction rules, clear space in cells, which size to use at which pixel range, and `image-rendering: pixelated` for scaled PNGs on the web.

## Matrix format

```json
{ "palette": { ".": null, "K": "#1c1c18", "W": "#f6f4ef" }, "maxColors": 2,
  "rows": ["..KKKK..", ".KWWWWK.", "KWWKKWWK", "KWWKKWWK", ".KWWWWK.", "..KKKK.."] }
```

`null` is transparent. One letter per color keeps the matrix readable. `"allowOrphans": true` marks a texture variant.

## Review list

- The silhouette reads in one color and at 1x; the subject is recognizable without the accent color.
- Figure and ground are deliberate: each region is clearly shape or space.
- Lines follow the run rules; no tangents, no banding (equal parallel runs side by side).
- The construction rules hold everywhere (vertices, slopes, measured steps).
- Each detail earns its place at this size; the next detail to drop is known.
- Works on light, dark and busy backgrounds, or the usage note says which version to use there.

## When the user wants an image model anyway

Treat its output as a reference: measure it (step 1) and redraw. Never deliver raw model output.

Classic examples and literature are in [references/sources.md](references/sources.md); read it when the user asks for references or a style rooted in a tradition.

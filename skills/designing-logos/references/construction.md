# Construction and delivery: P5 and gate G6

The chosen mark becomes a system: a grid, an angle set, curve families, colors and a size ladder, all in `constants.json`, all checked by `check.mjs`. Read this after G4 (or G5) and before drawing the final.

Contents: rules; choosing the grid; constants.json; the drawing loop; the size ladder; deliverables; gate G6.

## Rules

1. Five construction rules or fewer, each one a script can check. A system is a set of rules, not one solution (Gerstner 1964); fewer, consistent rules also read as more beautiful (processing fluency).
2. Every number has a `why` in `constants.json`, and every other distance is derived from the base numbers. The nine-grid cat: 83 = 2 x 38 + 7.
3. The angle set goes first in the spec. A family of signs reads as a family when it keeps fixed angles and one stroke width (Aicher's 1972 Munich pictograms).
4. A curve exists only inside a declared curve family with a reason: a physical cause (gravity, growth, flow) or a geometric one (one radius for all arcs). One radius per family.
5. Small sizes are redrawn, not shrunk. A 16 px version made by scaling the master is blurry and loses its features; hand-placed pixels keep them.
6. Every deliverable has a use. A file nobody will place is not made.

Check: `check.mjs <dir>/constants.json` prints 0 violations for the mark and every ladder file.

## Choosing the grid

1. Find the thinnest line and the smallest gap in the chosen direction, and the smallest size from the brief (`minSize`).
2. Pick a canvas that is a multiple of the smallest pixel size you will redraw (16 px gives 64, 96, 128, 192), large enough that the thinnest line is at least one whole unit.
3. Set major lines from the structure: module widths and gutters. Write the canvas as a sum of modules (128 = 3 x 38 + 2 x 7) and derive every other distance from it.
4. Choose the angle set from the forms: 0 and 90 always; 45 when there are diagonals; a measured angle (a 15 degree head tilt) when it is a feature, as one extra angle used everywhere.

## constants.json

```json
{
  "mark": "export/mark.svg",
  "canvas": { "size": 128, "why": "8 x 16, so the 16 px sprite maps 8 units to a pixel" },
  "grid": { "unit": 1, "lines": [0, 38, 45, 83, 90, 128], "why": "three 38-unit cells, 7-unit gutters" },
  "angles": { "set": [0, 45, 90], "tolerance": 0.01, "why": "straight edges only at 0, 45 and 90 degrees" },
  "curves": [
    { "name": "whisker", "kind": "ribbon", "match": { "tag": "polygon", "minPoints": 20 }, "count": 6,
      "radius": 63, "radiusTolerance": 0.5, "taper": [7.5, 8.5], "bend": "down",
      "why": "whiskers taper and droop under their own weight; one radius for all six" }
  ],
  "colors": {
    "why": "measured in P1, roles fixed at G2 and G6",
    "ink": { "hex": "#18181b" }, "paper": { "hex": "#fafafa" },
    "accent": { "hex": "#dc3d5c", "maxElements": 1, "region": [45, 45, 83, 83] }
  },
  "ladder": { "16": "export/sprite-16.svg", "32": "export/sprite-32.svg", "why": "hand-placed pixels below 48 px" },
  "derived": { "why": "every distance in lockups and layouts", "values": { "face": "2 x 38 + 7 = 83" } },
  "minSize": { "px": 16, "why": "browser tab icon" }
}
```

Curve family kinds: `ribbon` (a closed polygon drawn as one side out and the other back, as a tapered stroke; checked for radius, taper and bend) and `arc` (A commands, circles, ellipses; checked for radius). `match` picks the elements by tag, point count, class or id pattern.

Paths are relative to `constants.json`. The example is the nine-grid cat's own file (case-vervecode.md).

## The drawing loop

1. Write the master SVG with `viewBox="0 0 <size> <size>"`, integer vertices, flat fills from the palette, letters converted to outlines.
2. `node render.mjs <mark.svg> --constants <dir>/constants.json` and read `sheet.png`: color, one color and inverse on three grounds; 16 and 32 magnified; the blur.
3. `node check.mjs <dir>/constants.json`. Each FAIL line says what to move or declare.
4. `node metrics.mjs <mark.svg>` when two versions compete: ink, accent share, complexity, balance, small-size layout and crispness. Numbers inform; the sheet decides.
5. Repeat until the sheet reads at 16 px and check passes.

## The size ladder

| Size | Source | Why |
|---|---|---|
| 16, 32 | Hand-placed pixel sprites (designing-pixel-logos draws them from the master) | A scaled master blurs; pixels keep the features |
| 48, 64 | The master, or a simplified vector version when a detail closes up | Check the magnified render first |
| 96 and up | The master | |

Record each redrawn size in `constants.ladder`. `metrics.mjs` reports for each small size a layout score (how much it matches the master when blurred) and a crispness score (share of pixels that are single palette colors): a good redraw keeps layout above about 80 percent at crispness near 100.

## Deliverables

`node render.mjs export <dir>` writes the package into `export/`:

| File | Use |
|---|---|
| `mark.svg`, `mark-mono.svg`, `mark-inverse.svg` | Master for print and screen; one-color uses; dark backgrounds |
| `png/mark-16.png` to `png/mark-1024.png` | 16, 32, 48 browser tabs; 180 Apple touch icon; 192 and 512 web app manifest; 1024 social avatars and stores |
| `favicon.ico` | 16, 32 and 48 in one file for older browsers |
| `construction.svg`, `construction.png` | The grid, angles and curve radii over the mark (`board.mjs construction`) |
| `presentation.png` | The mark printed on paper (`texture.mjs`); the only place texture appears |
| `rationale.html` | One page: the mark, each element's meaning, construction, small sizes, decisions (`board.mjs rationale`) |
| `README.md` | Written by `export`: every file with its use |

Leave out what the brief gives no use for, and say so.

## Gate G6

Show `construction.png`, the check result, the small sizes at real size (the rationale page has them), and `presentation.png`. Ask in one round:

1. Confirm the construction rules (the list from `constants.json`, in words).
2. Confirm the colors and their roles.
3. Confirm the deliverables (multiSelect, so the user can drop files without a use).

When `register` is true, the TM gate comes first (interview.md).

`pass <dir> G6` refuses until `check.mjs` reports 0 violations and `export/rationale.html` exists. After it passes, ask where the final files belong in the user's project (a brand folder such as `docs/brand/<name>/`), and copy `export/`, `constants.json` and the master there.

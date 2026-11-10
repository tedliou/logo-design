# Color: measuring, roles and checks

Read this in P1 (measuring a photo's colors) and again in P5 (fixing the palette in `constants.json`).

## Rules

1. Measure colors on the source in OKLab, a color space where equal distances look about equally different (Ottosson 2020). Averaging in RGB turns a pink cloud in a blue sky into gray.
2. One accent, on one element. A single element that differs is the one people notice (von Restorff's isolation effect, 1933); two accents compete. `check.mjs` counts it through `maxElements`.
3. Every role has a reason in `why`: where the color was measured, or which brief answer asked for it.
4. Check each role against paper, white and ink. The same color looks different on different grounds (Albers, Interaction of Color, 1963), and the mark has to work on all three.
5. Color carries no fixed meaning in this skill. Lists like "red means passion" have weak evidence and change with context; choose by the brief, the source and the checks.

Check: `palette.mjs contrast <dir>/palette.json` prints every pair, and each role in `roles` has a hex and a why.

## Measuring a photo

1. Area palette: `node palette.mjs <dir>/source/<photo> --out <dir>/sheets --write <dir>/palette.json`. It clusters the downscaled photo into six colors by area and lists near-black pixels (silhouettes, shadow) apart so they do not swallow the clusters.
2. Region samples: add one `--region name=x0,y0,x1,y1` per feature region from `features.json`, in photo pixels. Inside each region it picks the most conspicuous sub-color (distance to the area colors plus chroma); add `:dominant` for a region whose largest color is the point, such as a sky.
3. Near ties: when two sub-colors of a region score within 0.01, the output lists them under `close`. Do not pick for the user; ask at G2.
4. Read `sheets/palette.png`: area bars, region swatches, and the photo with the boxes drawn.

## Roles

Write `roles` in `palette.json` by hand (palette.mjs keeps them when it rewrites `measured`):

```json
"roles": {
  "ink":    { "hex": "#1e2433", "why": "Near-black of the skyline silhouette (area, dark group)" },
  "paper":  { "hex": "#f3efe6", "why": "Warm white; the brief asks for print-like paper" },
  "second": { "hex": "#a67983", "why": "Pink cloud, region sample; chosen at G2 over #8d6d85" },
  "accent": { "hex": "#e9b851", "why": "Horizon gold, region sample; the only warm light in the photo" }
}
```

- ink and paper are required. Ink is usually the darkest measured color or a near-black of the same hue; paper is a warm or cool white chosen in the brief.
- At most one second color and one accent, unless the brief says otherwise.
- Without a photo, take colors from the brief and the existing assets (the site's colors, an old mark) and say so in `why`.

## Checks

- `node palette.mjs contrast <dir>/palette.json` prints WCAG contrast for every pair of roles. An accent below 3:1 on paper cannot carry meaning alone at small sizes; place it next to ink, or give the shape an ink edge. The smoke test of a sunset photo found horizon gold at 1.6:1 on paper.
- One-color version: every color except ink and paper becomes ink (`render.mjs` row `mono:paper`). The mark must still read; if the accent element disappears, its shape was carrying nothing.
- Inverse: ink and paper swap (`inverse:ink`). The accent must still be visible on ink.

## Into constants.json

At P5 the roles move to `constants.colors`, each with `hex` and `why`, and the accent gains its limits:

```json
"colors": {
  "why": "Measured on the photo in P1, roles fixed at G2 and G6",
  "ink":    { "hex": "#1e2433" },
  "paper":  { "hex": "#f3efe6" },
  "accent": { "hex": "#e9b851", "maxElements": 1, "region": [45, 45, 83, 83] }
}
```

`region` (x0, y0, x1, y1 in canvas units) keeps the accent on the element it belongs to, so a later edit cannot move it elsewhere unnoticed.

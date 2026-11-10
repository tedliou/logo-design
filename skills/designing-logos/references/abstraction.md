# From source to abstraction: P1 and gate G2

What makes a subject itself is how it differs from the typical one, so P1 measures the source before anything is drawn. It produces a feature table, a palette (color.md) and an abstraction ladder, and stops at G2 when there is a photo. Read this before P1.

Contents: rules; measuring; features.json; the abstraction ladder; gate G2; without a photo.

## Rules

1. Take features only from the source the user gave. A generic cat, cloud or tree carries no identity; the user's photo does.
2. Write for every feature how it differs from a typical one of its kind. Keep the two or three largest deviations and exaggerate them. Caricatures that exaggerate a face's deviations from the average face are recognized faster than accurate line drawings (Rhodes, Brennan and Carey 1987); applying this to animals, objects and scenes is an inference.
3. Measure, do not eyeball. Coordinates come from `measure.mjs grid` overlays; ratios and angles from `measure.mjs points`.
4. Each ladder step removes one class of information and keeps proportion and pose. Picasso's Bull (eleven states, December 1945 to January 1946) loses volume and detail step by step while the stance stays.
5. Build the abstract steps from five primitives or fewer, and keep the concave corners where parts meet; objects are recognized from a few components and their junctions (Biederman 1987).
6. A natural form keeps its physical cause. Whiskers droop under gravity, smoke rises and spreads, a cloud's edge is soft on the windward side. Find the cause first (look it up when unsure), write it in `references.md`, then draw it. The nine-grid cat's straight whiskers looked stiff until they drooped as same-radius arcs.
7. Step 1 of the ladder is a measuring underlay, never a direction. A traced photo is an illustration, not a mark.

Check: `features.json` passes `workbook.mjs check`, every feature has `differs`, and the ladder has 4 or 5 steps rendered by `board.mjs ladder`.

## Measuring

1. `node measure.mjs grid <dir>/source/<photo> --out <dir>/sheets/grid.png` and read the overlay. Labels are photo pixels.
2. For small parts (an eye, a roofline), crop: `grid ... --crop x0,y0,x1,y1 --step 20 --out <dir>/sheets/grid-eye.png`.
3. Name the points in `features.json` (`points`), list the `measures` you need (ratio, angle, offset, distance), then `node measure.mjs points <dir>/features.json --out <dir>/sheets/points.png`. Look at the overlay: every dot must sit on its feature. Move the ones that do not and run again.
4. Palette: follow color.md.

Measures worth taking for most subjects: the main axis tilt, the ratio of the two largest parts, the position of the most distinctive part relative to that axis (offset), and any length the caricature will exaggerate.

## features.json

```json
{
  "source": "source/cat.jpg",
  "crop": [120, 40, 980, 900],
  "points": { "eyeL": [402, 310], "eyeR": [655, 296], "jawL": [380, 610], "jawR": [700, 630], "nose": [520, 420] },
  "measures": [ { "name": "eye tilt", "angle": ["eyeL", "eyeR"] }, { "name": "jaw span / eye span", "ratio": [["jawL", "jawR"], ["eyeL", "eyeR"]] } ],
  "features": [
    { "id": "F1", "type": "gesture", "label": "Wide yawn", "points": ["jawL", "jawR"], "differs": "Jaw open to nearly the eye span; a typical portrait has the mouth closed", "deviation": "large", "chosen": true },
    { "id": "F2", "type": "relation", "label": "Pink tongue against white fur", "where": [430, 520, 640, 760], "differs": "The only saturated color in the photo", "deviation": "large" }
  ]
}
```

Feature types, at least one of each:

| Type | Look for |
|---|---|
| outline | The silhouette and its unusual parts: a skyline with tall thin uprights, a tilted ear |
| structure | Proportions, bands, repetition: horizontal color bands, stripes, a grid of windows |
| gesture | Pose and implied motion: a yawn, a head tilt, a cloud sweeping in an arc |
| relation | How parts play against each other: complementary colors, a dark silhouette against a bright horizon, the one saturated spot |

`deviation` is small, medium or large: how far from the typical subject. `measure.mjs points` writes `measured` back into the file; quote those numbers in `differs` when they make the point ("eye axis tilted 7 degrees").

## The abstraction ladder

Draw 4 or 5 SVGs, `ladder/L1.svg` to `ladder/L5.svg`, on one square canvas, all from the measured points. Each removes one class of information:

| Step | Removes | Keeps | Use |
|---|---|---|---|
| L1 Trace | Texture, noise, photographic light | Main masses as flat polygons in 3 or 4 tones, at measured positions | Underlay only; never a direction |
| L2 Flat | Tonal steps | Two tones (ink and paper) plus the accent region | Shows whether the silhouette alone carries the subject |
| L3 Parts | Interior detail except the chosen features | Outline plus the 2 or 3 features, exaggerated by their measured deviation | The usual starting point for directions |
| L4 Primitives | Every curve that is not structural | Five primitives or fewer, concave junctions kept | Tests the Biederman limit; close to a mark |
| L5 Sign | Everything but the features | The features alone, as a sign | The most abstract option; risks losing the subject |

For animals and plants, add one test drawing built only from circles and straight lines, as Japanese family crests (kamon) were drawn with compass and ruler, and note every radius used in the SVG as a comment. It often finds the cleanest construction.

Then run `node board.mjs ladder <dir>`: it lays the photo crop and each step side by side at 128, 32 and 16 px, so the user can see where recognition stops.

Before G2, invert each step (ink and paper swapped, `render.mjs --rows inverse:ink`) and look at the white shapes. In seal carving the empty space is designed as carefully as the ink (計白當黑); a negative shape that looks accidental is redrawn.

## Gate G2

Show `sheets/points.png`, the feature table, `sheets/palette.png` and `sheets/ladder.png`, then ask in one round:

1. "Which two or three features should the mark keep?" multiSelect over the features, each option described with its deviation.
2. "How abstract?" one of L2 to L5, each described by what it keeps.
3. When palette.mjs reported near ties (`close`), one question to pick between them.

Mark the chosen features with `"chosen": true`, record the level as the `abstraction` answer (`--source chose`), write the palette roles (color.md), then `pass <dir> G2 --decision "..." --reason "..."`.

## Without a photo

P1 still runs, without a gate. Inventory instead of measuring:

- Letterforms of the name: letters with distinctive shapes (V, W, A, O), letters that resemble the subject (a V as ears), symmetric pairs, counters (the enclosed spaces in A, O, e) that can hold a second meaning.
- The domain's existing signs: what people in the field already draw for it, so P2 can avoid the clichés and find the less used ones.

Write the findings into the name and sign cells of the meaning grid, then go to P2.

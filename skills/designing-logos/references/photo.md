# Photo: measuring before drawing

Read this when the user gives a photo. Measuring runs before round 1 and asks the user nothing. Its results feed the figurative cells and the palette, and appear in the document's "photo and measurements" section.

## Rules

1. Take features only from the user's source. A generic cat or cloud carries no identity; the photo does.
2. For every feature, write how it differs from a typical one of its kind, and exaggerate the two or three largest deviations. Exaggerating a face's deviations from the average makes it recognized faster (Rhodes, Brennan and Carey 1987); applying this to other subjects is an inference.
3. Measure, do not eyeball: coordinates come from the grid overlay, ratios and angles from `measure.mjs points`.
4. A natural form keeps its physical cause. Whiskers droop under gravity, smoke rises and spreads. Find the cause before drawing it.
5. Colors are measured in OKLab, and one accent sits on one element.

Check: `design.mjs attach` printed "attached palette features", and round 1's figurative cells use at least two measured features.

## Steps

1. `node design.mjs photo <design.html>` writes the embedded photo to the work folder and prints its path. Measure on that copy.
2. `node measure.mjs grid <photo> --out <work>/grid.png` and read the overlay; labels are photo pixels. Crop with `--crop x0,y0,x1,y1 --step 20` for small parts.
3. Write `<work>/features.json` with named points, the measures you need and the features, then `node measure.mjs points <work>/features.json --out <work>/points.png` and check that every dot sits on its feature.
4. `node palette.mjs <photo> --out <work> --write <work>/palette.json`, adding `--region name=x0,y0,x1,y1` for each feature region. Near ties (`close`) are yours to settle: pick the higher chroma unless the brief says otherwise.
5. Add `roles` to `palette.json` (ink, paper, accent, optionally a second color, each with `why`) and run `node palette.mjs contrast <work>/palette.json`. An accent under 3:1 on paper needs ink next to it.
6. `node design.mjs attach <design.html> --palette <work>/palette.json --features <work>/features.json`.

## features.json

```json
{
  "source": "photo.jpg",
  "points": { "eyeL": [100, 118], "eyeR": [318, 58], "jawTop": [256, 239], "jawBottom": [307, 465] },
  "measures": [ { "name": "eye axis tilt", "angle": ["eyeL", "eyeR"] }, { "name": "mouth height / eye distance", "ratio": [["jawTop", "jawBottom"], ["eyeL", "eyeR"]] } ],
  "features": [
    { "label": "Wide yawn", "differs": "The mouth opens as tall as the eye distance; portraits usually show it closed" }
  ]
}
```

Look for one feature of each kind: outline (silhouette, an unusual part), structure (proportions, bands, repetition), gesture (pose, implied motion) and relation (contrast between parts, the one saturated spot).

## Abstraction

The figurative cells sit at different distances from the photo. Each step away removes one kind of information and keeps proportion and pose, as in Picasso's Bull (1945 to 1946): texture, then tone, then interior detail, then everything but five primitives or fewer (keep the concave corners where parts meet, Biederman 1987). A traced photo is an illustration, not a mark; start one step away from it at least. For animals and plants, one cell built only from circles and straight lines (the way family crests are drawn) often finds the cleanest construction.

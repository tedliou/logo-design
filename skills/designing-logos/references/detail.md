# Detail: construction, small sizes and delivery

Read this after the user settles. The picked sketch becomes a system: a grid, an angle set, curve families, colors and small sizes, checked by script and exported. Ask nothing unless a choice changes the meaning; show the result in the document.

## Rules

1. Five construction rules or fewer, each one a script can check. Fewer, consistent rules read as more deliberate (Gerstner 1964; processing fluency).
2. Every number has a `why`, and every other distance derives from the base numbers.
3. Straight edges use a short angle set; curves exist only inside a declared family with a cause (gravity, growth) or a shared radius.
4. Small sizes are redrawn, not shrunk. Hand-placed 16 and 32 px sprites keep the features a scaled master blurs; designing-pixel-logos draws them.
5. One accent on one element. Check it against paper, white and ink: the one-color version must still read, and the accent must show on ink.
6. Keep the settled direction. Refining moves points onto the grid and evens out widths; it does not add new ideas. If the mark needs a new idea, go back to rounds.

Check: `design.mjs detail` printed "final: 0 violations".

## Steps

1. Choose the grid: a canvas that is a multiple of 16 (96, 128), large enough that the thinnest line is one whole unit. Write major lines from the structure (module widths, gutters).
2. Redraw the master on that grid: integer vertices, edges at the angle set, arcs at family radii, letters as paths.
3. Draw the 16 and 32 px sprites (designing-pixel-logos), each in the same palette.
4. Write `<work>/detail.json` (below) and run `node design.mjs detail <design.html> <work>/detail.json`. It runs the construction check, refuses on violations and says what to move, and on success writes the delivery package next to design.html in `export/`, with the construction sheet, the presentation sheet and the final section of the document.
5. Tell the user in three lines or fewer: the document is final, where it is, and that a change is one more round. The element meanings, construction and file list are already in the document; do not repeat them in chat.

While refining, `node render.mjs <mark.svg> --constants <constants.json>` draws a contact sheet (color, one color, inverse; paper, white, ink; magnified small sizes; blur), and `node check.mjs <constants.json>` lists violations. Write those scratch files in the work folder.

## detail.json

```json
{
  "constants": {
    "canvas": { "size": 96, "why": "6 x 16, so the 16 px sprite maps 6 units to a pixel" },
    "grid": { "unit": 1, "lines": [0, 8, 30, 48, 66, 88, 96], "why": "badge edge at 8, letter feet at 30 and 66" },
    "angles": { "set": [0, 90, 69.444], "tolerance": 0.01, "why": "both letter legs share one slope" },
    "curves": [
      { "name": "badge", "kind": "arc", "radius": 40, "match": { "tag": "circle", "id": "^badge$" }, "why": "the round seal" },
      { "name": "whisker", "kind": "ribbon", "count": 6, "radius": 63, "taper": [7.5, 8.5], "bend": "down", "match": { "tag": "polygon", "minPoints": 20 }, "why": "whiskers taper and droop" }
    ],
    "colors": { "why": "measured on the photo", "ink": { "hex": "#1f3a34" }, "paper": { "hex": "#f6f1e7" }, "accent": { "hex": "#e8552d", "maxElements": 1, "region": [30, 40, 66, 70] } }
  },
  "mark": "<svg viewBox=\"0 0 96 96\" ...>",
  "ladder": { "16": "<svg viewBox=\"0 0 16 16\" ...>", "32": "<svg viewBox=\"0 0 32 32\" ...>" },
  "elements": [ { "form": "Round seal", "literal": "A badge", "figurative": "A shop you can trust" } ],
  "presentation": { "paper": "#ece8e1", "print": 0.35 }
}
```

- Curve family kinds: `ribbon` (a closed polygon drawn as one side out and the other back; checked for radius, taper, bend) and `arc` (A commands, circles, ellipses; checked for radius). `match` picks elements by tag, point count, class or id pattern.
- `accent.region` (x0, y0, x1, y1) keeps the accent on its element.
- `elements`: one line each; an element without a figurative meaning is cut or redrawn.
- `presentation` passes options to the print-texture sheet; omit it for the defaults.

## Delivery

`export/` holds the color, one-color and inverse SVG, PNG from 16 to 1024 px with their uses, favicon.ico (16, 32, 48), the construction sheet, the presentation sheet, a README listing each file's use, and a copy of design.html as the rationale. When the user will register the mark, say plainly that your similarity search is not a legal trademark search, and name the WIPO Global Brand Database and their national office.

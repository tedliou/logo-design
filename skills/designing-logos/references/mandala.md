# Nine-grid ideation: P2, P3 and P4

Two 3 x 3 grids. The meaning grid decides what the mark says; the form grid decides how it is drawn. Each cell is bound to a fixed lens, so every cell knows which way to think, and afterwards the grid shows which ways nobody took. Read this before P2 and again before P3.

Contents: rules; meaning lenses; motif lenses; mandala.json; marking motifs and writing concepts; gate G3; form operations; sketches and directions; gate G4; variants and gate G5.

The method is nine-grid ideation (曼陀羅思考法). Its expansion rule comes from Imaizumi Hiroaki's Mandal-Art (1987): any outer cell can move to the center of a new grid. Mandala Chart is a registered trademark of Clover Keiei Kenkyusho; do not use that name for this method or its outputs. No controlled study shows the grid beats other ideation methods; its value here is that the lenses force coverage, which `workbook.mjs check` can verify.

## Rules

1. Fill every cell. 1 core, 8 themes (one per meaning lens), 64 motifs (8 per theme, one per motif lens). The point is coverage; an empty lens is the idea nobody had.
2. The user's themes go first. Put each in its lens. When several crowd into one lens (four kinds of "method"), propose merging them into one theme and give the free lenses to proposals the user can veto.
3. A motif is something you could draw: a noun, a part, a gesture. A trait ("curious", "independent") is rewritten as a gesture or analogy that can be drawn ("head tilt", "whiskers as sensors"), or kept with `drawable: false`.
4. The outer cells are motifs, not action items. Open Window 64 (the goal sheet Ohtani used) puts actions in the outer ring; this grid does not.
5. If two motifs in one theme could swap lenses without changing, rewrite one. They are the same idea twice.
6. Do not look at existing marks while filling the grid. Reference work comes in P3, after ideation, as principles (see research.md).
7. Take features from P1 (`features.json`) into the subject theme's part, shape and gesture cells. They are measured, so they beat generic motifs of the subject.

Check: `workbook.mjs check <dir>` passes for mandala.json, and `board.mjs grid <dir>` reports 8 themes and 64 motifs.

## Meaning lenses

| Lens | Covers | Example (the nine-grid cat) |
|---|---|---|
| subject | The brand itself or its stand-in: product, mascot, founder | The cat in the site avatar |
| name | The name's literal meaning, origin and letter shapes | The V of Verve; the old wordmark's V also reads as cat ears |
| audience | Who it is for and their situation | Engineers stuck at midnight, reading |
| action | What the brand does, as a verb | Debug, iterate |
| method | Tools, techniques and processes | Programming, AI, code |
| analogy | Something in another field that does the same job | Whiskers as sensors: sense first, then act |
| time | Where it comes from and where it grows | Iteration: always leave one cell for the next version |
| tension | Two opposite qualities the brand holds at once | The play of games and the precision of code |

In the cat's original grid, four of eight themes (programming, AI, code, software) sat in method, and name was not a theme at all; the V nose was found later by accident. With lenses, name is a theme in round one.

## Motif lenses

Each lens refers in one of three ways, which becomes the `mode` of an element in `elements.json`: by likeness (it looks like the thing), by cause (it is a cause, effect or tool of the thing), or by convention (people agreed it means the thing).

| Lens | Covers | Mode | "Cat" example | "Debug" example |
|---|---|---|---|---|
| part | A part standing for the whole | likeness | Ears, slit pupil, whiskers | Breakpoint dot on a line |
| shape | The whole outline or a characteristic form | likeness | Loaf posture outline | A bracket pair |
| gesture | A pose, behaviour or implied motion | likeness | Yawn, head tilt, pounce | Stepping through, one line at a time |
| object | Tools and things that go with the theme | cause | Yarn, bell | Magnifier, bug |
| sign | Agreed marks and characters | convention | Paw print | `>_` prompt, red status light |
| trace | The result or evidence an action leaves | cause | Scratches, footprints | Log lines, a fixed-bug checkmark |
| structure | Units, modules and their arrangement | likeness | Nine lives as nine cells | Stack trace as stacked bars |
| analogy | Something elsewhere that does the same job | likeness | Whiskers as antennae | Doctor's stethoscope |

## mandala.json

```json
{
  "core": "Lively, passionate development",
  "keepBy": "suggested by Claude, accepted at G3",
  "themes": [
    { "id": "T1", "lens": "subject", "label": "Cat", "source": "user",
      "motifs": [
        { "id": "T1-M1", "lens": "part", "label": "Slit pupil", "drawable": true, "keep": true, "why": "Also reads as a text cursor" },
        { "id": "T1-M2", "lens": "gesture", "label": "Head tilt", "drawable": true, "keep": false, "why": "Measured on the photo; second round" }
      ] }
  ],
  "concepts": [ { "id": "C1", "text": "A cat that talks through a terminal", "motifs": ["T1-M1", "T5-M5"] } ],
  "forms": [ { "concept": "C1", "cells": [ { "op": "fusion", "sketch": "directions/sketches/C1-fusion.svg", "note": "Nose and V share one outline" } ] } ]
}
```

Ids: themes `T1` to `T8`, motifs `T<n>-M1` to `T<n>-M8`. `source` is user or proposed. `keep` is your suggestion before G3 and the user's decision after it.

## Marking motifs and writing concepts

Mark 12 to 16 motifs with `keep: true` and a `why` each. A motif earns a mark when it:

- is drawable at 32 px without detail that disappears;
- has a figurative meaning tied to the core sentence, not only a literal one;
- is not a domain cliché on its own (gears, light bulbs, brains, globes, rockets, `</>`); a cliché earns a mark only when it fuses with another meaning;
- comes from a measured feature, when there is a photo.

Spread the marks over at least four themes, so concepts can join different ideas.

Write 3 or 4 concept sentences. Each joins 2 or 3 kept motifs from different themes into one image a person can picture: "a cat that talks through a terminal" (subject part plus method sign). One of them uses a motif from the name lens when there is one. A sentence that only restates the subject ("a cute cat") is not a concept.

Run `board.mjs grid <dir>` and show `sheets/mandala.html`.

Check: 12 to 16 motifs carry `keep: true` with a `why`; 3 or 4 concepts each list 2 or 3 motif ids from different themes.

## Gate G3

Ask two questions in one round:

1. "Accept the marked motifs?" Options: accept them; or change them (the user writes ids in the free-text answer, such as "add T5-M3, drop T2-M7").
2. "Which concepts go to drawing?" multiSelect over the concepts; one or two.

Update `keep` to match, mark the chosen concepts (`"chosen": true`), then `pass <dir> G3 --decision "..." --reason "..."`. With `--scope ideation` the project ends here: show the final grid and concepts.

## Form operations

For each chosen concept, the form grid puts the concept sentence in the center and eight thumbnails around it, one per operation.

| Operation | What it does | Source | Cat example |
|---|---|---|---|
| silhouette | The whole becomes one closed, recognizable outline | Henderson and Cote 1998 (natural, harmonious forms are recognized) | The square nine-cell outline |
| skeleton | Built from a grid, modules or repeated units | Gerstner 1964 | 3 x 38 + 2 x 7 grid |
| motion | Tilt, offset or implied movement | Cian and others 2014 | Detached pixels, drooping whiskers |
| figure-ground | A second meaning in the negative space | Gestalt figure-ground; 計白當黑 in seal carving | The empty top middle cell means "next version" |
| subtraction | Cut down to the fewest parts that still read | Picasso's Bull, 1945 to 1946 | Only ears, eyes, nose, mouth, whiskers |
| fusion | Two motifs share one outline | Phillips and McQuarrie 2004 | Cat nose and V are one shape |
| substitution | A part is replaced by another theme's sign | Phillips and McQuarrie 2004 | Pupil becomes a cursor; mouth becomes `>_` |
| cut | Cut, offset or scatter so the viewer closes the gap | Gestalt closure | The right ear breaks into pixels |

Keep substitutions to one on the main reading path. Each extra substitution is another riddle, and a mark that needs two answers stops being read (inference from Phillips and McQuarrie's complexity ordering).

## Sketches and directions

1. For each chosen concept, write eight sketch SVGs, `directions/sketches/<concept>-<op>.svg`, one operation each. Use a square viewBox (`0 0 96 96` is enough for sketches), flat fills, the palette's ink and paper and at most one accent. A sketch is rough but real: it must render.
2. Add them to `forms` in mandala.json, run `board.mjs forms <dir>`, and read the PNG. Drop sketches that fail at 16 px and say why in their note.
3. Build 3 or 4 directions from the strongest sketches. A direction combines one to three operations into one mark. Make them different kinds: `open` (a figure on open ground), `closed` (inside a fixed frame: seal, badge, square), `letter` (built from the name's letters or numbers), or `other`. Two directions may share at most half of their motifs.
4. Draw each at `directions/<id>/mark.svg` on a provisional construction grid (an integer canvas, a short angle set), and write `directions.json`:

```json
{ "directions": [
  { "id": "A", "title": "Terminal cat", "kind": "closed", "concept": "C1", "conceptText": "A cat that talks through a terminal",
    "motifs": ["T1-M1", "T5-M5", "T2-M3"], "ops": ["skeleton", "substitution", "fusion"],
    "svg": "directions/A/mark.svg", "principles": ["Card 2: pixel steps only where they stand for games"], "note": "" }
] }
```

5. Run `board.mjs directions <dir>`. It writes the contact sheet (16, 32, 64, 128 px, magnified small sizes, inverse, one color, blur, with the name) and prints motif overlap and FAIL lines. Fix every FAIL.
6. Run the reviewer (rubric.md) on `sheets/directions.png` before showing anything. Drop or fix what it rejects, and say what was dropped and why.
7. Write `elements.json` for every direction still in play: one entry per element with form, literal, figurative, mode and motif id. An element without a figurative meaning is cut or redrawn.

Check: `board.mjs directions` prints PASS; every direction has an elements entry for each element; the reviewer's report is saved as `sheets/review-G4.md`.

## Gate G4

Show the contact sheet, the element table and the reviewer's notes, then ask:

1. Which direction, or a merge of two (name them).
2. Which parts of the other directions to keep (multiSelect; "none" is an option). The cat's V nose came from a losing direction this way.
3. When the variants compare two attributes or fewer, ask them here too, one question each, instead of opening G5.

Show every brief field still marked "default, not confirmed" and run `confirm` for the ones the user keeps. Run `cond <dir> attributes=<n>` with the number of attributes the variants will compare (0 when none). Then `pass <dir> G4 ...`, with `--carry` naming what came over from other directions.

## Variants and gate G5

Vary one attribute at a time and keep the rest fixed (Gerstner's morphological box, Zwicky's morphological analysis). Attributes are things like eye, nose, mouth, style signal, stroke width, corner radius.

1. Draw each value as its own SVG, `variants/<attribute>-<n>.svg`, from the chosen direction.
2. Before showing, drop values that break the brief's constraints or fail at 16 px; record each with a reason in `dropped`.
3. Write `variants.json` and run `board.mjs variants <dir>`:

```json
{ "base": "directions/A/mark.svg",
  "attributes": [
    { "name": "eye", "values": [ { "id": "eye-1", "svg": "variants/eye-1.svg", "note": "Slit pupil as a cursor" } ],
      "dropped": [ { "id": "eye-4", "reason": "Two-pixel gap closes at 16 px" } ] }
  ] }
```

4. G5: one question per attribute (at most four per round), each asking for a winner. Then show the merged version at real sizes and ask the user to confirm it.

Check: `variants.json` lists every attribute with at least two values; the merged SVG renders and `check.mjs` has no FAIL lines other than ones the provisional constants explain.

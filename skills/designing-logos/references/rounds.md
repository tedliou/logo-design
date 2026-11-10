# Rounds: eight drawn directions around a center

Read this before drawing any round. A round is a 3 x 3 board: the center holds the current understanding, the eight cells around it are drawn marks. The user picks; the pick becomes the next center. The rounds go from meaning to form to detail, so the depth comes before the polish.

| Round | The eight cells | What the user decides |
|---|---|---|
| 1 Meaning | Eight concepts, each a sentence that fuses two or three motifs, each drawn | What the mark says |
| 2 Form | The picked concept drawn with eight form operations, one per cell | How it is built |
| 3 and later | One attribute changed per cell | The details |

## Rules

1. Draw first. The first answer to a brief is round 1. Ask only for the brand name when it is missing. Feeling, audience, color and style are answered by the picks, not by questions.
2. Every cell carries an idea. A cell is a concept made visible: two or three motifs fused into one shape, each with a literal and a figurative reading. A clean geometric shape with nothing to say is the "careless" failure; a cute drawing of the subject is the "obviously AI" failure. Both are rejected before the board is shown.
3. With a photo, the strongest measured feature appears in every figurative cell of round 1 (the yawn, the swirl), exaggerated by its measured deviation. What makes the subject itself is how it differs from the typical one.
4. Each cell commits fully, so the difference shows at 32 px. A tag of about six characters or three words; the concept sentence goes in `concept`, the reasoning in `why`. The user should not have to read to choose, but can.
5. In round 1 the center is text (name, the user's sentence), because showing a mark first makes people anchor on it. From round 2 it is the picked mark.
6. One wildcard per round from round 2 on (`outlier: true`): another concept from round 1 or a new one, drawn in the current direction. It keeps the search from narrowing too early.
7. After every pick, update the learned preferences with `pick ... --prefs "word,word,..."`: up to eight short words the picks have shown. The user's own words in a note win over your inference.
8. Take shapes from the brand and the source, never from existing marks. Similarity to a known logo is a defect.

Check: `design.mjs round` printed "added round n", and the user was told in three lines or fewer where to look and how to answer.

## Round 1: eight concepts

1. List privately what the brand could show, one or more motifs per meaning lens: subject, name (letters, sounds, literal meaning), audience, action, method, analogy, time, tension between two qualities. Add the measured photo features (photo.md). Drop domain clichés that stand alone (gear, light bulb, globe, rocket, `</>`); they may appear only fused with another meaning.
2. Write eight concept sentences. Each fuses two or three motifs from different lenses into one picture a person can imagine: "the yawning mouth is a flame, the tongue its core", "Code's C is the cat's head, its opening the yawn". Cover at least six of the eight lenses across the board, and use the name lens at least once.
3. Draw each concept with the form operation that suits it (below). Then check the spread with the three pairs people tell apart at a glance, round or angular, static or dynamic, figurative or letter (evidence.md): the eight cells must include both sides of each pair. List each cell's three sides in `axes`.
4. Preview, run the reviewer, replace what it rejects (rubric.md), then add the round.

## Round 2: eight form operations

The picked concept stays; each cell draws it with one operation:

| Operation | What it does |
|---|---|
| silhouette | The whole becomes one closed, recognizable outline |
| skeleton | Built from a grid, modules or repeated units |
| motion | Tilt, offset or implied movement |
| figure-ground | A second meaning in the negative space |
| subtraction | Cut down to the fewest parts that still read |
| fusion | Two motifs share one outline |
| substitution | A part is replaced by another theme's sign |
| cut | Cut, offset or scatter so the viewer closes the gap |

Use seven operations and the wildcard, and name the operation in `op`. When the user mixed two round-1 cells, the merged concept is the center (draw it in `center.svg`) and the operations apply to it.

## Round 3 and later: one attribute per cell

Keep the picked form and change one attribute per cell: container (none, circle, rounded square, seal), weight, detail (one part fewer or more), accent placement, terminals, a measured feature exaggerated more or less, a local style signal on the part it refers to. A note such as "rounder" or "less busy" sets the direction of every cell. Aim to settle by round 4; if the user picks the wildcard twice in a row, the concept was wrong: start a new round 1 from that wildcard's concept.

## Drawing a cell

- Square `viewBox="0 0 96 96"`, flat fills, the palette's ink and paper plus at most one accent (photo.md measures colors; without a photo take two calm colors and one accent that fit the brief).
- Shapes only: letters are drawn as paths, never `<text>`.
- Readable at 16 px: `design.mjs` refuses a cell that nearly disappears at 16 px.
- No gradients, filters, transparency or images; texture belongs to the final presentation sheet.
- Draw with care: a cell is a proposal the user may settle on. Curves follow their cause (whiskers droop, smoke rises), joints are clean, the accent sits on the element that carries the meaning.

## round.json

Write it in the work folder (`design.mjs work <design.html>`); `round` deletes it after adding the round.

```json
{
  "center": { "svg": "<svg ...>", "tag": "merged B and D" },
  "cells": [
    { "id": "A", "axes": ["round", "dynamic", "figurative"], "tag": "flame yawn",
      "concept": "The yawning mouth is a flame; the tongue is its core",
      "motifs": ["yawn (photo)", "passion"], "op": "fusion",
      "why": "The photo's widest deviation carries the core sentence", "svg": "<svg viewBox=\"0 0 96 96\" ...>" }
  ]
}
```

- `cells`: eight, ids A to H in order, clockwise from top left around the center.
- `concept` and `motifs`: required in round 1 (two or three motifs per concept) and for the wildcard.
- `axes`: round 1, three words; both sides of each pair must appear on the board.
- `op`: round 2, one operation per cell, seven different ones plus the wildcard.
- `outlier: true`: exactly one cell from round 2 on.
- `center`: only when the user mixed two cells; otherwise the picked cell becomes the center by itself.

## The loop

1. `node design.mjs preview <design.html> <round.json>`: checks the round and draws the board image.
2. Rounds 1 and 2: run the reviewer on that image (rubric.md). Replace the cells it rejects, then preview again.
3. `node design.mjs round <design.html> <round.json>`.
4. Show it. Republish the page or point to the file (SKILL.md), and tell the user how to answer: a letter, two letters to mix, an optional sentence, or "this is the one".
5. Record the answer: `node design.mjs pick <design.html> B --note "<their words>" --prefs "..."`, or `settle` when they chose the final.

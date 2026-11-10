# Rounds: eight drawn directions around a center

Read this before drawing any round. A round is a 3 x 3 board: the center holds the current understanding, the eight cells around it are drawn marks. The user picks; the pick becomes the next center. The set converges on the real need without a questionnaire.

## Rules

1. Draw first. The first answer to a brief is round 1. Ask only for the brand name when it is missing. Feeling, audience, color and style are answered by the picks, not by questions.
2. A cell is a drawn mark with a tag of about six characters or three words. Its `why` (one line) appears only in the history. The user should not have to read to choose.
3. Every cell commits fully to its direction, so the difference shows at 32 px. Eight timid variations of one idea waste the round.
4. Keep the center honest: in round 1 it is text (name, the user's sentence), because showing a mark first makes people anchor on it (design fixation). From round 2 it is the picked mark.
5. One wildcard per round from round 2 on (`outlier: true`): a deliberate departure, such as another corner of round 1 or another mark type. It keeps the search from narrowing too early.
6. After every pick, update the learned preferences with `pick ... --prefs "word,word,..."`: up to eight short words the picks have shown (round, static, letter, framed, heavy, warm). They stand in for the brief and show in the center cell. The user's own words in a note win over your inference.
7. Steps shrink. Round 2 changes structure, round 3 changes details, round 4 polishes. Aim to settle by round 4. If the user picks the wildcard twice in a row, the direction was wrong: start again from round 1 with that wildcard's corner as the new center.
8. Take shapes from the brand and the source, never from existing marks. Similarity to a known logo is a defect.

Check: `design.mjs round` printed "added round n", and the user was told in three lines or fewer where to look and how to answer.

## Round 1: the eight corners

Three pairs that people tell apart at a glance, each with experimental support (evidence.md):

| Pair | One side | Other side |
|---|---|---|
| Shape | round: circles, arcs, rounded joins | angular: straight edges, corners, polygons |
| Posture | static: symmetric, centered, level | dynamic: tilt, offset, implied motion, asymmetry |
| Content | figurative: the subject, or something the brand does | letter: the name's initial, monogram or characters |

Two sides of three pairs give eight combinations; draw one per cell, `axes` listing the three words in the user's language. No study shows these three pairs cover every difference between logos, so treat the scheme as the default, and change a pair when the brief makes one side impossible (a brand with no letters, for example): say so in the cell's `why`.

Before drawing, list privately (not on the board) what the brand could show: the subject, the name, the audience, the action, the method, an analogy, time, a tension between two qualities. Take the figurative cells' motifs from that list, from measured photo features first when there is a photo (photo.md). A domain cliché on its own (gear, light bulb, globe, rocket, `</>`) is only allowed fused with another meaning.

## Round 2 and later

The center is the pick, or your merge when the user picked two cells (draw the merged mark and put it in `center.svg`). Keep the three sides the pick decided and change one attribute per cell:

| Attribute | Values to try |
|---|---|
| Container | none, circle, rounded square, square seal, open frame |
| Mark type | symbol, letterform, symbol plus initial, emblem, mascot |
| Fusion | the letter becomes the subject, or a part of the subject becomes the letter |
| Negative space | a second reading in the white |
| Weight | light, regular, heavy |
| Detail | one part fewer, one part more |
| Accent | where the single accent color sits, or none |
| Motion cue | tilt, a detached piece, a speed line |
| Source feature | a measured feature of the photo, exaggerated |

Choose the attributes the user's note points at first. A note such as "rounder" or "less busy" sets the direction of every cell in the next round.

## Drawing a cell

- Square `viewBox="0 0 96 96"`, flat fills, the palette's ink and paper plus at most one accent (photo.md measures colors; without a photo take two calm colors and one accent that fit the brief).
- Shapes only: letters are drawn as paths, never `<text>`.
- Readable at 16 px: `design.mjs` refuses a cell that nearly disappears at 16 px.
- No gradients, filters, transparency or images; texture belongs to the final presentation sheet.

## round.json

Write it in the work folder (`design.mjs work <design.html>`); `round` deletes it after adding the round.

```json
{
  "center": { "svg": "<svg ...>", "tag": "merged B and D" },
  "cells": [
    { "id": "A", "axes": ["round", "static", "figurative"], "tag": "wheel front", "why": "subject: the wheel, symmetric", "svg": "<svg viewBox=\"0 0 96 96\" ...>" }
  ]
}
```

- `cells`: eight, ids A to H in order, clockwise from top left around the center.
- `axes`: round 1 only, three words, the eight combinations all different.
- `outlier: true`: exactly one cell from round 2 on.
- `center`: only when the user mixed two cells; otherwise the picked cell becomes the center by itself.

## The loop

1. `node design.mjs preview <design.html> <round.json>`: checks the round and draws the board image.
2. Round 1 only: run the reviewer on that image (rubric.md). Replace the cells it rejects, then preview again.
3. `node design.mjs round <design.html> <round.json>`.
4. Show it. Republish the page or point to the file (SKILL.md), and tell the user how to answer: a letter, two letters to mix, an optional sentence, or "this is the one".
5. Record the answer: `node design.mjs pick <design.html> B --note "<their words>" --prefs "..."`, or `settle` when they chose the final.

---
name: designing-logos
description: Designs a logo mark with the user by showing, not asking. From a one-line brief it draws a 3x3 board of eight visually different directions around the brief, the user picks a cell, the pick moves to the center and eight finer variations grow around it, until the user settles; then it builds the construction grid, small sizes and delivery files. Everything lives in one design document. Use when the user wants to create or redesign a logo, symbol, brand mark or mascot mark, or to turn a photo into a mark.
when_to_use: The user asks to design a logo, mark, trademark or brand symbol (for example 「設計 logo」「做標誌」「商標」「品牌圖形」), to explore logo directions on a nine-grid (「九宮格」), or to turn a photo into a mark (「把照片變成標誌」). A mark drawn entirely as pixel art, or a 16 or 32 px pixel icon, goes to designing-pixel-logos. Exporting an existing logo to other file formats, or editing a site's header CSS, does not need this skill.
argument-hint: "[brand name and one sentence, optionally a photo path]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/*)
license: MIT
---

# Designing logos

Designers decide by looking. This skill draws first and asks almost nothing: the user answers each round with a letter. The bar is a trademark, not an illustration: every element has a reason, the final construction is measurable, and the mark reads at 16 px.

## Rules that always hold

1. Draw before you ask. The first reply to a brief is round 1 (references/rounds.md). Ask only for the brand name when it is missing.
2. Every message to the user is three lines or fewer, the final one included: where to look and how to answer. The picture carries the content; reasons, rationale and file lists live in the document, which the user opens when they want them.
3. One working file per project: `design.html`, written only through `design.mjs`. Scratch files go to the work folder that `design.mjs work` prints, never next to the document.
4. Record every answer with `design.mjs pick` or `settle` before drawing the next round. A guessed answer looks like a decision but carries none of the user's intent.
5. Measure a photo before drawing (references/photo.md). What makes a subject itself is how it differs from the typical one, and only the source shows that.
6. Marks use flat fills from the palette and no text, filters or images. Texture belongs to the final presentation sheet.
7. Take principles from reference work, never shapes. Similarity to an existing mark is a defect.
8. Mark a claim in the rationale as sourced or as inference; golden-ratio construction claims are out (references/evidence.md).

## Start

1. Run `node "${CLAUDE_SKILL_DIR}/scripts/design.mjs" status`. With no file it lists the projects under `$LOGO_WORK_ROOT` (default `~/logo-work`). Continue the one the user means, or create one:
   `node "${CLAUDE_SKILL_DIR}/scripts/design.mjs" init "<root>/<name>" --name "<brand>" --brief "<their sentence>" --lang <the user's language, en or zh-TW> [--photo <file>]`
   The photo is copied into the document; the original is never written to.
2. With a photo, measure it (references/photo.md). Then draw round 1 (references/rounds.md).

Check: `status <design.html>` names the next step.

## Showing the document

Pick the first way that works in this environment, once per project:

1. An Artifact tool is available: with round 1, ask once whether to open the design document as a page. If yes, publish `design.html` and republish the same file every round, so the link stays the same.
2. Otherwise open the local `design.html` in the user's browser (`start`, `open` or `xdg-open`, subject to permission), or give its path.
3. If your environment can send files to the user, also send the board image that `design.mjs round` prints.

The page cannot send clicks back to you. The user taps cells, presses "Copy for Claude" and pastes the line into the chat, or just types a letter. Read pasted lines such as "Round 2: mix B and D | rounder" as the pick, the mix and the note.

## Flow

```
brief (+ photo) -> measure photo -> round 1: eight corners -> pick -> round 2 around the pick -> ... -> settle -> detail -> export
```

| Step | Read first | Command |
|---|---|---|
| Measure a photo | references/photo.md | `photo`, then measure.mjs and palette.mjs, then `attach` |
| Draw a round | references/rounds.md | `preview`, reviewer on round 1, then `round` |
| Record the answer | references/rounds.md | `pick <letters> --note --prefs`, or `settle <letter>` |
| Build the final | references/detail.md | `detail <detail.json>` (checks, exports, finishes the document) |

The reviewer is the `logo-critic` subagent. It sees the board image and the brief, never your reasons. Run it on round 1 before showing, and on the final contact sheet (references/rubric.md).

When `status` reports eval mode, nobody will answer: take each round's pick from the rule it prints, settle where it says, and do not publish pages or send files.

## Scripts

All run with `node "${CLAUDE_SKILL_DIR}/scripts/<name>.mjs"`; each prints its usage when run without arguments.

| Script | Use |
|---|---|
| `design.mjs` | The design document: `status`, `init`, `preview`, `round`, `pick`, `settle`, `detail`, `photo`, `attach`, `png`, `work`, `set` |
| `measure.mjs` | Photo grid overlay; feature points to ratios, angles and offsets |
| `palette.mjs` | OKLab palette from area and feature regions; `contrast` between roles |
| `render.mjs` | Contact sheet of one mark while refining; `export` for any constants.json |
| `check.mjs` | Grid, angle set, curve families, palette, accent, flat fills |
| `metrics.mjs` | Ink, complexity, balance, small-size layout and crispness |
| `texture.mjs` | Presentation sheet with print texture |
| `selftest.mjs` | Run after changing a script |

## Hand-offs

- A mark drawn entirely as pixel art, and the 16 and 32 px sprites of a vector mark: designing-pixel-logos.
- A style the user names (family crest, seal, post-digital Swiss, local pixels): references/style-recipes.md.
- references/case-vervecode.md shows one finished mark and lists the shapes that belong to it and must not reappear elsewhere.

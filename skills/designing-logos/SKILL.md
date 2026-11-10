---
name: designing-logos
description: Designs a logo mark together with the user through staged questions, nine-grid ideation (one 3x3 grid for meaning, one for form), photo feature measurement, and SVG directions on a construction grid that scripts render and check at real sizes. Every element gets a stated reason and every choice is recorded. Use when the user wants to create or redesign a logo, symbol, brand mark or mascot mark, or to turn a photo into a mark.
when_to_use: The user asks to design a logo, mark, trademark or brand symbol (for example 「設計 logo」「做標誌」「商標」「品牌圖形」), to brainstorm brand themes on a nine-grid (「九宮格發想」), or to turn a photo into a mark (「把照片變成標誌」). A mark drawn entirely as pixel art, or a 16 or 32 px pixel icon, goes to designing-pixel-logos. Exporting an existing logo to other file formats, or editing a site's header CSS, does not need this skill.
argument-hint: "[brand name, photo path, or workbook folder]"
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/*)
license: MIT
---

# Designing logos

The bar is a trademark, not an illustration: every element has a reason, the construction is measurable, and the mark is recognizable at 16 px. A cute drawing that only depicts the subject fails that bar even when it looks good large.

The user designs with you. You research, measure, draw and check; the user decides at the gates. A gate is a stop where you show the work and wait for the answer. The workbook (one folder per project) holds every answer, so a new or compacted session continues from the files, not from memory.

## Rules that always hold

1. Stop at each gate and wait for the user's answer, then record it with `workbook.mjs`. An answer you guess looks like a decision but carries none of the user's intent.
2. Measure features on the source with `measure.mjs` and `palette.mjs`. What makes a subject itself is how it differs from the typical one, and only the source shows that.
3. Give every element a literal meaning and a figurative one in `elements.json`. Cut an element that has only one.
4. Put a style signal (pixel steps, glitch, misregistration) only where it refers to something, for example pixels only on the part that stands for games. A style spread over the whole mark says nothing.
5. Draw the mark with flat fills from the palette. Texture, transparency and print effects belong to the presentation sheet (`texture.mjs`). `check.mjs` enforces this.
6. Judge at real size. Read the contact sheet (16 and 32 px, light and dark, one color, blur) before saying a direction works.
7. Take every number from `constants.json` and reach 0 violations in `check.mjs` before the user sees a final.
8. Mark each claim in `references.md` and the rationale as sourced (with the source) or as inference. Golden-ratio construction claims are out.
9. Take principles from reference work, not shapes, and look at references only after the meaning grid exists. Similarity to an existing mark is a defect.
10. Ask with AskUserQuestion: one topic per round, at most four questions, two to four options each. The reason for a choice is the user's note when there is one, otherwise the chosen option's description.

## Start

1. Run `node "${CLAUDE_SKILL_DIR}/scripts/workbook.mjs" status`. With no folder it lists the workbooks under `$LOGO_WORK_ROOT` (default `~/logo-work`). Continue the one the user means, or create one:
   `node "${CLAUDE_SKILL_DIR}/scripts/workbook.mjs" init "<root>/<name>" --name "<brand>" [--photo <file>]... [--scope full|ideation]`
   `--photo` copies the photo into `source/`; the original is never written to. Use `--scope ideation` when the user only wants the nine-grid of themes (it stops after G3).
2. Run `status <folder>` at the start of every gate. It names the current gate, the reference to read, the files and answers still missing, and which conditional gates apply. When it says eval mode, follow "Eval mode" in interview.md.

Check: `status <folder>` shows the gate you are about to work on as current.

## Stages and gates

| Stage | Read first | You do | You show | Gate: the user decides |
|---|---|---|---|---|
| P0 Interview | [interview.md](references/interview.md) | Read the user's files and the taste file; ask only what they do not answer and what changes the design | Brief draft with every field | G1: answers the last round and confirms the brief |
| P1 Measure | [abstraction.md](references/abstraction.md), [color.md](references/color.md) | Grid overlay, feature points, measures; area palette plus region samples; abstraction ladder (`board.mjs ladder`). Without a photo: inventory letterforms and domain signs, no gate | Feature table, palette sheet, ladder | G2 (photo only): 2 or 3 features, abstraction level |
| P2 Meaning grid | [mandala.md](references/mandala.md) | Core plus 8 themes on 8 meaning lenses, 8 motifs each on 8 motif lenses; mark 12 to 16 to keep; 3 or 4 concept sentences; `board.mjs grid` | The grid page | G3: accept the marked motifs or edit by id; pick 1 or 2 concepts |
| P3 Directions | [research.md](references/research.md), [style-recipes.md](references/style-recipes.md), [mandala.md](references/mandala.md), [rubric.md](references/rubric.md) | Principle cards; per concept 8 sketches, one per form operation (`board.mjs forms`); 3 or 4 directions of different kinds (`board.mjs directions`); elements table; reviewer | Contact sheet, element table, reviewer notes | G4: one direction or a merge, parts to keep; variant questions too when 2 attributes or fewer |
| P4 Variants | [mandala.md](references/mandala.md), [rubric.md](references/rubric.md) | One attribute at a time; drop failures with reasons (`board.mjs variants`); reviewer | One row per attribute at real sizes | G5 (more than 2 attributes): a winner per attribute |
| P5 Construction | [construction.md](references/construction.md), [color.md](references/color.md) | Grid, angles, curve families, colors, size ladder; the drawing loop; `render.mjs export`, `board.mjs construction`, `texture.mjs`, `board.mjs rationale` | Construction sheet, check result, real-size ladder, presentation | TM (registration only): the user searches. G6: confirms rules, colors, deliverables |

Lenses (definitions and examples in mandala.md):

- Meaning: subject, name, audience, action, method, analogy, time, tension.
- Motif: part, shape, gesture, object, sign, trace, structure, analogy.
- Form operations: silhouette, skeleton, motion, figure-ground, subtraction, fusion, substitution, cut.

Conditions live in `state.json`: `photo` (set by `init`), `register` (ask the formal-use question in the first round, then `cond <folder> register=true|false`), `attributes` (set at G4 with `cond <folder> attributes=<n>`).

At a gate:

1. Show the work (publish the HTML board as a private page when your environment can, otherwise give the file path), then ask.
2. Record each brief answer with `answer <folder> <field> "<value>" --source said|chose|default`.
3. Close the gate with `pass <folder> <gate> --decision "..." --reason "..." [--question] [--options] [--criteria] [--carry]`. `pass` refuses while files or answers are missing or invalid and says what to fix.
4. To go back, `reopen <folder> <gate> --reason "..."` and redo only what the change affects.
5. A stable preference with its reason goes to the taste file: `taste <folder> --like|--dislike "..." --reason "..." [--global]`. The next project does not ask it again.

Check: `pass` printed "passed" for the gate.

When the user cannot answer, step down one level instead of repeating the question: L1 open question, L2 two contrasting options, L3 cards to compare (`board.mjs cards`), L4 your default to veto, recorded with `--source default` and confirmed again at G4 with `confirm`. Every three or four answers, restate your understanding in at most five lines. Details and the field bank are in interview.md.

## Scripts

All run with `node "${CLAUDE_SKILL_DIR}/scripts/<name>.mjs"`; each prints its usage when run without arguments.

| Script | Use |
|---|---|
| `workbook.mjs` | `init`, `status`, `answer`, `confirm`, `cond`, `pass`, `reopen`, `taste`, `check` |
| `measure.mjs` | `grid` overlays photo-pixel coordinates; `points` turns named points into ratios, angles and offsets and draws them back; `cells` reads a reference drawing cell by cell |
| `palette.mjs` | Area palette in OKLab plus region samples; near ties go to the user at G2; `contrast` prints WCAG contrast between roles |
| `board.mjs` | `grid`, `ladder`, `forms`, `directions` (also checks kinds and motif overlap), `variants`, `cards`, `construction`, `rationale`: PNG for you and the reviewer, one self-contained HTML page for the user |
| `render.mjs` | Contact sheet of one mark (color, one color, inverse; paper, white, ink; 16 and 32 magnified; blur); `export` writes the delivery package with a README of uses |
| `check.mjs` | Grid, angle set, curve families, palette, accent count and region, flat fills; FAIL lines say what to fix |
| `metrics.mjs` | Ink, accent share, complexity, asymmetry, balance, small-size layout and crispness; `compare` two PNGs |
| `texture.mjs` | Presentation sheet: paper, fibers, plates with misregistration, grain, index labels from constants |
| `selftest.mjs` | Run after changing a script |

The drawing loop: write the SVG, render, read the sheet, check, fix, repeat until it reads at 16 px and check passes.

The reviewer is the `logo-critic` subagent. It sees the contact sheet, the brief and the rubric, never your reasons. Run it once before G4 and once before G5, save its report to `sheets/review-G4.md` or `review-G5.md`, and act on it before the user sees the sheet. The brief to give it is in rubric.md.

## Workbook files

| File | Holds | Gate |
|---|---|---|
| `state.json` | Gates, answers with their source, conditions | every |
| `brief.md` | Generated from the answers; never edited by hand | G1 |
| `taste.md` | This brand's likes and dislikes with reasons | G1, G4, G5 |
| `features.json`, `palette.json`, `ladder/` | Points, measures, features with how they differ; measured colors and roles; abstraction steps | G2 |
| `mandala.json` | Both grids with lens, drawable and keep per cell; concepts; form sketches | G3 |
| `references.md` | Principle cards, natural-form causes, each claim sourced or marked inference | G4 |
| `directions.json`, `directions/` | Each direction's kind, concept, motifs, operations, principles, SVG | G4 |
| `elements.json` | Per element: form, literal, figurative, mode (likeness, cause, convention), motif id | G4 to G6 |
| `variants.json`, `variants/` | Attributes, values, dropped values with reasons | G5 |
| `decisions.md` | Question, options, criteria, decision, reason, carry over, per gate | every |
| `constants.json` | Canvas, grid, angles, curve families, colors, ladder, derived numbers, each with `why` | G6 |
| `sheets/`, `export/` | Boards, contact sheets, reviews; the delivery package | G2 to G6 |

## Hand-offs

- A mark drawn entirely as pixel art, or the 16 and 32 px pixel sprites of a vector mark: designing-pixel-logos.
- Exporting an existing mark to other formats: no skill needed (`render.mjs export` works on any `constants.json`).
- Wordmarks, lockups and applying the mark to a site come after this skill's first version.

[case-vervecode.md](references/case-vervecode.md) shows one complete project and lists the shapes that belong to it and must not reappear elsewhere. [evidence.md](references/evidence.md) lists the research behind the rules and the popular claims this skill does not use; read it before writing a rationale.

# logo-design

[正體中文](README.md)

A Claude Code plugin for designing logo marks at trademark quality: every element has a reason, the construction can be measured, and the mark is still recognizable as a 16 px browser tab icon. When you ask a model for a logo and get a nice illustration instead, the missing part is usually the questions nobody asked: what the mark should say, and why it looks the way it does. This plugin makes Claude ask them.

Claude researches, measures, draws and checks. You decide at six gates. When you cannot answer a question, Claude offers a contrast, cards to compare, or a default to veto, instead of asking again.

## Contents

| Component | What it does |
| --- | --- |
| `designing-logos` skill | The full flow for a vector mark: questions, photo measurement and color sampling, a meaning grid and a form grid (nine-grid ideation), directions and variants, construction rules, the delivery package |
| `designing-pixel-logos` skill | Marks drawn entirely as pixel art, and hand-placed 16 and 32 px versions of a vector mark |
| `logo-critic` subagent | Reads the contact sheet with a clean context, says what it sees first, and recommends which directions to drop; it never sees the designer's reasons, so it cannot be talked into anything |

## Flow

```
Start: brand name, optionally a photo or an old mark
  P0 Interview ............ G1 confirm the brief
  P1 Measure the photo .... G2 pick 2 or 3 features and the abstraction level (photo only)
  P2 Meaning grid ......... G3 accept the suggested motifs, pick concepts
  P3 Form grid, directions  G4 pick a direction, keep parts of the others
  P4 Variants ............. G5 one winner per attribute (more than two attributes only)
  P5 Construction ......... G6 confirm rules, colors and deliverables
```

- The meaning grid decides what the mark says: a core sentence in the center, eight themes around it on eight lenses (subject, name, audience, action, method, analogy, time, tension), and eight drawable motifs per theme.
- The form grid decides how it is drawn: a concept sentence in the center and eight thumbnails, one per form operation (silhouette, skeleton, motion, figure-ground, subtraction, fusion, substitution, cut).
- Every answer, its source and its reason go into a workbook folder, so a new session continues from the files.

## Install

```bash
claude plugin marketplace add tedliou/logo-design
```

```bash
claude plugin install logo-design@logo-design
```

The scripts need Node.js 20 or later and [sharp](https://sharp.pixelplumbing.com/) for rendering and reading photos. Run `npm install` once in the plugin's folder after installing, or set `LOGO_SHARP_FROM` to the `package.json` of any project that already has sharp.

## Use

Say "design a logo for ...", "turn this photo into a mark" or "brainstorm brand themes on a nine-grid", or call it directly:

```text
/logo-design:designing-logos Ade Cycles ~/Pictures/shop.jpg
```

- Workbooks live in `~/logo-work/<name>/`; set `LOGO_WORK_ROOT` to move them. Photos are copied in; originals are never written to.
- For brand themes only, Claude uses the ideation scope and stops after G3.
- Stable preferences you state go to `~/logo-work/taste.md` and are not asked again in the next project.

The delivery package contains:

- color, one-color and inverse SVG
- PNG from 16 to 1024 px
- favicon.ico
- a construction sheet
- a presentation sheet with print texture
- one HTML page with each element's meaning and the decision log

Each file is listed with its use, and you can drop files at G6.

## Limits

- Claude does not generate raster images. The mark is SVG written by Claude. Paper fibers, misregistration and grain on the presentation sheet are SVG filters, not photographic print texture.
- The similar-mark check searches with the tools Claude can use. It is not a legal trademark search. Before registering, search the WIPO Global Brand Database and your national office yourself.
- Taste stays with you. The reviewer and the scripts only remove clear failures.
- Research claims carry a verification status in `skills/designing-logos/references/evidence.md`. Check the sources marked "to verify" before quoting them.

## Evals

`evals/` holds cases for `claude plugin eval`:

- E3 checks which skill each of three requests loads.
- E4 checks that the nine-grid-only flow stops at G3 and draws no SVG.

```bash
claude plugin eval . --ablation none --allow-tools Bash --runs 1
```

End-to-end comparisons (the skill at medium effort against no skill at max effort) need a person to judge the marks. See `skills/designing-logos/evals/README.md`.

## License

MIT

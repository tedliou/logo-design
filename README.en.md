# logo-design

[正體中文](README.md)

logo-design is a Claude Code plugin for designing logo marks. Claude first asks what the mark should say, then measures the photo, generates ideas, draws and checks, and delivers files you can use as a real mark: every element has a reason, the construction can be measured, and the mark is still recognizable as a 16 px browser tab icon.

Asking a model directly for a logo often returns a nice illustration, because nobody asked what the mark should say or why it looks the way it does. This plugin puts those questions into the flow. Claude researches, measures, draws and checks; you decide at up to six gates. When you cannot answer a question, Claude offers a contrast, cards to compare, or a default to veto, instead of asking again.

## Components

| Component | What it does |
| --- | --- |
| `designing-logos` skill | The full flow for a vector mark: questions, photo measurement and color sampling, a meaning grid and a form grid (nine-grid ideation), directions and variants, construction rules, the delivery package |
| `designing-pixel-logos` skill | Marks drawn entirely as pixel art, and pixel-by-pixel 16 and 32 px versions of a vector mark |
| `logo-critic` subagent | Reads the contact sheet (every candidate at several sizes and backgrounds on one image) with a clean context, says what it sees first, and recommends which directions to drop, using the [rubric](skills/designing-logos/references/rubric.md). It never sees the designer's reasons, so it cannot be talked into anything |

## Flow

Claude works through the stages on the left; you decide at the gates on the right.

```
Start: brand name, optionally a photo or an old mark
  P0 Interview ............ G1 confirm the brief
  P1 Measure the photo .... G2 pick 2 or 3 features and the abstraction level (photo only)
  P2 Meaning grid ......... G3 accept the suggested motifs, pick concepts
  P3 Form grid, directions  G4 pick a direction, keep parts of the others
  P4 Variants ............. G5 one winner per attribute (more than two attributes only)
  P5 Construction ......... TM similar-mark search (registration or formal use only)
                            G6 confirm rules, colors and deliverables
```

- The meaning grid decides what the mark says: a core sentence in the center, eight themes around it on eight lenses (subject, name, audience, action, method, analogy, time, tension), and eight drawable motifs per theme.
- The form grid decides how it is drawn: a concept sentence in the center and eight thumbnails, one per form operation (silhouette, skeleton, motion, figure-ground, subtraction, fusion, substitution, cut).
- Variants change one attribute at a time, such as the eye, stroke width or corner radius. With one or two attributes, those questions are asked at G4.
- Every answer, its source and its reason go into a workbook folder, so a new session continues from the files.

## Install

```bash
claude plugin marketplace add tedliou/logo-design
```

```bash
claude plugin install logo-design@logo-design
```

The scripts need Node.js 20 or later and [sharp](https://sharp.pixelplumbing.com/) for rendering and reading photos. After installing the plugin, install sharp once in its folder:

```bash
cd ~/.claude/plugins/cache/logo-design/logo-design/0.1.0 && npm install
```

Or set `LOGO_SHARP_FROM` to the `package.json` of another project that has sharp. Without sharp, the interview, the nine-grid and the workbook still work; measuring, color sampling, contact sheets and the delivery package stop and say how to install it.

## Use

Say "design a logo for ...", "turn this photo into a mark" or "brainstorm brand themes on a nine-grid", or call it directly:

```text
/logo-design:designing-logos Ade Cycles ~/Pictures/shop.jpg
```

- Workbooks live in `~/logo-work/<name>/`; set `LOGO_WORK_ROOT` to move them. Photos are copied in; Claude never writes to the originals.
- For brand themes only, Claude builds the meaning grid and stops after G3.
- Stable preferences you state go to `~/logo-work/taste.md` and are not asked again in the next project.

The delivery package contains:

- color, one-color and inverse SVG
- PNG from 16 to 1024 px
- favicon.ico
- a construction sheet: grid, angles and curve radii over the mark
- a presentation sheet: paper fibers, misregistration and grain simulated with SVG filters
- one HTML page with each element's meaning and the decision log

Each file is listed with its use, and you can drop files at G6.

## Limits

- Claude does not use an image generation model. The mark is SVG written by Claude; PNG and favicon.ico are rendered from it, and the small pixel versions are placed pixel by pixel. The presentation texture is not photographic.
- The similar-mark check is a web search for marks with the same subject and treatment. It is not a legal trademark search. Before registering, search the WIPO Global Brand Database and your national office yourself; Claude prepares search terms and suggested figurative classification codes.
- Taste stays with you. `logo-critic` and the check scripts only remove clear failures.
- The skill's rules cite design and marketing research. Each source carries a status (abstract read, secondary only, to verify) in `skills/designing-logos/references/evidence.md`. Check the ones marked "to verify" before quoting them.

## For developers: evals

There are five eval cases (E0 to E4), described in `skills/designing-logos/evals/README.md`. E0 to E2 need a person to judge the marks; run them with your own photos. `evals/` holds the two cases that need no judging, for `claude plugin eval`:

- E3 checks which skill each of three requests loads.
- E4 checks that the nine-grid-only flow stops at G3 and draws no SVG.

```bash
claude plugin eval . --ablation none --allow-tools Bash --runs 1
```

## License

MIT

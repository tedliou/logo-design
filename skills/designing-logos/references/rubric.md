# Rubric, anti-patterns and the reviewer

Read this before showing directions (G4) or variants (G5). Each criterion names who checks it: a script when it can be computed, the reviewer when it needs eyes, the user only for meaning and taste.

## Criteria

| Criterion | Question | Checked by | Basis |
|---|---|---|---|
| Recognition | Is the first thing seen the subject? Could it be read as something else? | Reviewer, then user | The cat's first round: the V cat was read as a fox |
| Typical and novel | Is it recognizable as its kind and does it have a treatment not seen before? Judge the two separately | Reviewer | Hekkert, Snelders and van Wieringen 2003 |
| Meaning density | Does every element have a literal and a figurative meaning? | `workbook.mjs check` for the fields; reviewer for whether they hold | Every element must earn its place |
| Distinctness | Is it the usual move in this category? Is there a similar existing mark? | Reviewer against the anti-patterns; similarity search in research.md | |
| Small size | Do 16 and 32 px keep the main features? Does the blur keep one main mass? | Contact sheet, reviewer | Small size is a gate in every round |
| Construction | Violations of grid, angle set and curve families | `check.mjs`, must be 0 at G6 | Gerstner 1964 |
| Restraint | How many colored elements? Are style signals only where they refer to something? | `check.mjs` accent count; reviewer | Isolation effect |
| Negative space | Is the inverted figure also a deliberate shape? Does ink coverage fit the brief? | `metrics.mjs` ink; reviewer on the inverse row | 計白當黑 |
| Grounded form | Does every natural form follow its physical cause, and is the cause written down? | `references.md` | The drooping whiskers |
| Personality fit | Do symmetry, corners and motion match the brand's feeling words? | Reviewer, against the brief | Luffarelli and others 2019; Jiang and others 2016; Cian and others 2014 |
| Honesty | Is every claim sourced or marked as inference? | `references.md` | |

Compare candidates side by side; do not score them on a scale. Scores invite averaging, and the user decides by comparing anyway (Thurstone's comparative judgement).

## Anti-patterns

Name these when you see them, in the reviewer's report and in your own drafts:

- A cute small drawing of the subject with no concept and no construction (the cat's first version, rejected as thin and meaningless).
- Category defaults: a shield-shaped cat face, an omega mouth, square eyes; for software, a gear, light bulb, brain, globe, rocket or `</>` used alone. A cliché is allowed only when it fuses with another meaning.
- Gradients, drop shadows, outlines around the whole mark, glows, fake 3D.
- One style over the whole mark: all pixels, all glitch, all hand-drawn. A style signal belongs on the part it refers to.
- Numbers, letters or construction lines that refer to nothing ("meaningless copy or gibberish"). Index labels may only point at construction data.
- A grounded curve pulled straight because straight was easier to draw.
- A claim of golden-ratio construction.
- Detail that disappears at 32 px (the cat's bug-catching seal in round one).
- Two directions that are the same idea in different clothes (motif overlap over half).

## The reviewer

The reviewer is a subagent with a clean context. It sees the pictures and the brief, not your reasons, so your arguments cannot talk it into anything. It runs once before G4 and once before G5, not after every edit.

1. Render first: `board.mjs directions <dir>` (or `variants`) so `sheets/directions.png` exists.
2. Start the `logo-critic` subagent with this brief, filled in:

```
Review these logo candidates.
Contact sheet: <dir>/sheets/directions.png
Brief: <dir>/brief.md
Rubric: <skill dir>/references/rubric.md
Candidates: <ids and kinds, one per line, with no reasons>
Earlier rejections to avoid repeating: <from taste.md, or "none">
```

   When no `logo-critic` agent is available, start a general-purpose subagent with the same brief plus: "Follow the procedure in <path of logo-critic.md>". The file is `agents/logo-critic.md` at the plugin root (two folders above this skill), or `.claude/agents/logo-critic.md` in a project. Give it only the files above; never `elements.json`, `decisions.md` or your notes.
3. Save its report to `sheets/review-G4.md` (or `review-G5.md`). `pass G4` requires the file.
4. Act on it before the user sees anything: fix or drop what it rejects, and tell the user what was dropped and why. Where you disagree with the reviewer, show both views; the user decides.

A model reviewer is a filter, not a judge of beauty. In an earlier blind test of writing, a model reviewer agreed with the author on 10 of 24 items. Taste stays with the user.

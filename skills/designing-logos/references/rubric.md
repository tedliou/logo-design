# Rubric and the reviewer

Read this before running the reviewer: on rounds 1 and 2 before the user sees them, and on the final. Scripts judge what can be computed; the reviewer judges what needs eyes; the user judges meaning and taste.

## Criteria

| Criterion | Question | Checked by |
|---|---|---|
| Recognition | Is the first thing seen the intended subject or letter? Could it be read as something else? | Reviewer |
| Idea | Does each cell say something, two or three motifs fused into one shape? A clean geometric shape with nothing to say is careless; a cute drawing of the subject is the generic AI look | Reviewer |
| Spread (round 1) | Do the eight cells look like eight different directions at 32 px, or like one idea eight times? | Reviewer |
| Typical and novel | Recognizable as its kind, and with a treatment not seen before? Judge the two separately (Hekkert and others 2003) | Reviewer |
| Small size | Does the 16 px render keep the main shape? | `design.mjs` refuses cells that vanish; reviewer for the rest |
| Distinctness | Is it the category default? Does it resemble a known mark? | Reviewer, against the anti-patterns |
| Restraint | One accent, style signals only where they refer to something | Reviewer; `check.mjs` on the final |
| Construction (final) | Grid, angle set and curve families | `check.mjs`, 0 violations |
| Meaning (final) | Every element has a literal and a figurative meaning | `elements` in detail.json |

## Anti-patterns

- A cute drawing of the subject with no idea and no construction: flat mascot faces, app-icon tiles, emoji-like expressions. This is what a model draws by default and people recognize it at once.
- A clean geometric shape with nothing to say: blocks, notches and wedges arranged until they look designed.
- Category defaults used alone: gear, light bulb, brain, globe, rocket, `</>`, a shield with a face.
- Gradients, drop shadows, glows, fake 3D, an outline around everything.
- One style over the whole mark (all pixels, all glitch); a style signal belongs on the part it refers to.
- Numbers, letters or construction lines that refer to nothing.
- A grounded curve pulled straight because straight was easier.
- Detail that disappears at 32 px.
- Two cells that are the same idea in different clothes.

## Running the reviewer

1. `node design.mjs preview <design.html> <round.json>` (round 1) or `node render.mjs <mark.svg> --constants <constants.json>` (final) to get the image.
2. Start the `logo-critic` subagent with this brief, filled in:

```
Review these logo candidates.
Board or contact sheet: <path to the PNG>
Brand: <name>, <the user's sentence>
Learned preferences: <prefs, or "none yet">
Rubric: <skill dir>/references/rubric.md
Candidates: <ids with their tags and concept sentences, no reasons>
```

   When no `logo-critic` agent is available, start a general-purpose subagent with the same brief plus: "Follow the procedure in <path of logo-critic.md>" (`agents/logo-critic.md` at the plugin root, or `.claude/agents/logo-critic.md` in a project).
3. Replace the cells it recommends dropping, preview again, then add the round. Do not show the user the review unless they ask; the board is the answer.

A model reviewer is a filter, not a judge of beauty: in an earlier blind test of writing, a model reviewer agreed with the author on 10 of 24 items.

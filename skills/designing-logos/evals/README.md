# End-to-end evals

These cases run the whole flow with `claude -p` in an isolated folder, because a logo is judged by looking at it and the gates need pre-filled answers. Trigger checks (E3) and the nine-grid-only flow (E4) also run as plugin evals from the plugin's `evals/` folder. `claude plugin eval` runs a shell only inside a sandbox (Linux and macOS today), so on Windows E4 runs here instead.

| Case | Input | Checked by script | Judged by a person |
|---|---|---|---|
| E0 | Cat photo, the author's brief from 2026-11-08 | Gates, decisions, workbook JSON, `check.mjs` 0 violations, reviewer report | Blind: skill at medium against no skill at medium and at max |
| E1 | A sunset photo, a mostly default brief | Same, plus G2 appears and the palette has region samples | No shape from the nine-grid cat's do-not-copy list appears |
| E2 | No photo, nearly every field unknown | Same, plus G2 skipped, unknown fields recorded as defaults and confirmed at G4 | Questions step down instead of repeating |
| E4 | Core and themes only | Ideation scope, G3 passed, no SVG | The grid's quality |

## Run

Free checks first:

```bash
node scripts/selftest.mjs
```

One case with the skill (the run folder goes under `E:/tmp/logo-eval`, or `--out`):

```bash
node evals/run.mjs E4 --group skill --effort medium
```

E0's three arms, at most three at once:

```bash
node evals/run.mjs E0 --group skill --effort medium
```

```bash
node evals/run.mjs E0 --group bare --effort medium
```

```bash
node evals/run.mjs E0 --group bare --effort max
```

Then build the blind sheet from the three run folders, show only `blind.png` or `blind.html` to the judge, and open `key.json` after the answer:

```bash
node evals/blind.mjs <run-1> <run-2> <run-3> --out E:/tmp/logo-eval/blind-E0
```

Each run folder keeps `prompt.txt`, `command.txt`, `transcript.jsonl`, `run.json` (cost, turns, minutes) and `checks.json`.

## Cost

Budgets per arm are in `evals.json` and passed as `--max-budget-usd`; a run that reaches its budget stops where it is. Run only the cases a change affects. The full matrix runs only when the author asks for it.

## Fixtures

`fixtures/<case>/answers.json` holds the answers the user would give (interview.md, "Eval mode"). Photos are listed in `evals.json` under `files` and copied into the run folder. E1's photo is the author's own and stays out of any public copy of this skill; replace it with your own photo of a subject without a fixed shape.

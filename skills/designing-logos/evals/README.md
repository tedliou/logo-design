# End-to-end evals

These cases run the skill with `claude -p` in an isolated folder, because a logo is judged by looking at it and nobody is there to pick. Each case's `fixtures/<case>/picks.json` gives a pick rule per round and the round to settle at; `design.mjs status` prints the rule for the current round in eval mode. Trigger checks (E3) also run as a plugin eval from the plugin's `evals/` folder; `claude plugin eval` runs a shell only inside a sandbox (Linux and macOS today), so the flow cases run here.

| Case | Input | Checked by script | Judged by a person |
|---|---|---|---|
| E0 | Cat photo and the author's brief from 2026-11-08 | One design document, eight corners in round 1, one wildcard per later round, settled by round 4, 0 construction violations, export written | Blind: against earlier runs and no-skill medium and max |
| E1 | A sunset photo, a mostly empty brief | Same, plus a measured palette | No shape from the nine-grid cat's do-not-copy list |
| E2 | No photo, "I can't say what I want" | Same, plus no question before round 1 and learned preferences | Whether the picks led somewhere sensible |
| E4 | One sentence, no eval rules | The first reply ends with round 1 in design.html and no question before it | Whether round 1 shows eight real directions |

## Run

Free checks first:

```bash
node scripts/selftest.mjs
```

One case with the skill (run folders go under `$LOGO_EVAL_ROOT`, default `<system temp>/logo-eval`, or `--out`):

```bash
node evals/run.mjs E4 --group skill --effort xhigh
```

No-skill arms for a blind comparison:

```bash
node evals/run.mjs E0 --group bare --effort max
```

Then build the blind sheet from the run folders, show only `blind.png` or `blind.html` to the judge, and open `key.json` after the answer:

```bash
node evals/blind.mjs <run-1> <run-2> <run-3> --out <eval root>/blind-E0
```

Each run folder keeps `prompt.txt`, `command.txt`, `transcript.jsonl`, `run.json` (cost, turns, minutes) and `checks.json`.

## Cost

Budgets per arm are in `evals.json` and passed as `--max-budget-usd`; a run that reaches its budget stops where it is. Run only the cases a change affects; the full matrix runs only when the author asks for it.

## Fixtures

Photos are listed in `evals.json` under `files` and copied into the run folder. E1's photo is the author's own and stays out of any public copy of this skill; use your own photo of a subject without a fixed shape.

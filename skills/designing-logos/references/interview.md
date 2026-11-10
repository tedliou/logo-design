# Interview: P0 and gate G1

Read this before the first question of a project. It covers what to read before asking, the four levels of support, the field bank, how feeling words become form rules, and eval mode.

Contents: rules; rounds; the four levels; field bank; feeling words to form rules; formal use and the TM gate; asking with AskUserQuestion; eval mode.

## Rules

1. Read before you ask: the files and links the user gave (photos, old marks, a site, an artifact page), the site's colors and fonts when there is a site, the global taste file named by `workbook.mjs status`, and `brief.md`. A field the material already answers is shown in the restatement, not asked. Asking what the user already gave you reads as not listening.
2. Ask only fields whose answer changes the design. The trademark bar (every element has a reason, measurable construction, recognizable at 16 px) is a fixed rule, never a question.
3. One topic per round, at most four questions, two to four options each. The tool adds a free-text choice; do not add your own "Other".
4. When the user cannot answer, step down one level (L1 to L4) instead of asking the same thing again. After L4 a field is not asked again in other words.
5. Record every answer as soon as it is given: `answer <dir> <field> "<value>" --source said|chose|default [--note "<user's note>"]`. said means the user wrote it; chose means they picked an option; default means they did not veto your proposal.
6. Every three or four answers, restate your understanding in at most five lines and ask: right, wrong, or partly right. A correction goes back into the fields it touches.
7. Ask "why" at most three times in a row about one answer, and stop as soon as a value word appears ("trust", "freedom", "craft"). Past a value the answers turn into repetition.
8. Stop when every required field has an answer and the last restatement was not corrected. The last round shows the brief draft, and the user's confirmation of that round is G1.

Check: `workbook.mjs status <dir>` lists no brief fields without an answer, and `register` is set.

## Rounds

A typical plan. Merge or skip rounds when the material already answers them; the aim is one to three rounds.

| Round | Topic | Fields |
|---|---|---|
| 1 | What the mark is for | purpose, register, minSize, success |
| 2 | What the brand says | core, themes, assets |
| 3 | How it should feel | feeling, avoid, references, localStyle |
| Last (G1) | Remaining fields, then the brief | culture, abstraction, color; then the brief draft to confirm |

In the last round, record the answers first, show `brief.md` (in a code block or as the board), and ask one confirmation question with options such as "Confirm the brief" and "Change a field". Pass G1 with `pass <dir> G1 --decision "brief confirmed" --reason "..."`.

## The four levels

Step down when the user says they do not know, says "anything works", gives an answer that does not fit the field (a list of features for the core sentence), or contradicts an earlier answer.

| Level | What you give | How |
|---|---|---|
| L1 Open | The direct question | One follow-up at most, of one Socratic type: clarify ("what do you mean by modern?"), assumption ("what makes you think readers expect a mascot?"), reason, other viewpoint ("how would a first-time visitor read it?"), consequence ("if it looks serious, what do you lose?") |
| L2 Contrast | Two or three directions in words | Build options from opposite pairs: playful or serious, warm or cool, handmade or mechanical, classic or current, quiet or loud. After the choice, ask why once (laddering: attribute, then consequence, then value) |
| L3 Look | Two to four cards to compare | Draw simple abstract cards that differ in one property only, run `board.mjs cards`, show the page, then ask with A, B, C. With three cards, ask which two are alike and which differs: the difference names a property the user cares about (repertory grid) |
| L4 Default | Your proposal to veto | "I will use X unless you object." Record with `--source default`. It is shown again at G4 and confirmed with `confirm <dir> <field>` |

Cards for L3 are your own drawings: geometric or organic, heavy or thin, closed or open, centered or off-balance, one accent or two colors. Never use existing logos as cards; seeing finished marks before ideation makes people copy their features, flaws included (design fixation).

## Field bank

Ask in the user's language. The L2 and L4 columns are patterns; rewrite them for the user's domain.

| Field | Why it matters | L1 open | L2 contrast | L4 default |
|---|---|---|---|---|
| purpose | Decides sizes and contexts | Where will the mark appear most, and who sees it first? | Site header or app icon? Print or screen? | A site mark that also works as a 16 px browser tab icon |
| core | The one idea every element must serve | If a stranger remembers one thing about the brand, what should it be? | Closer to "steady and reliable" or "curious and playful"? | A sentence you write from the name and content |
| themes | Seeds the meaning grid | What does the brand cover? Three to eight words. | One example per meaning lens; the user ticks what fits | Eight themes, one per lens, from the name and content |
| assets | What must survive | Is there an old mark, avatar, mascot, color or typeface people know? | Keep or replace each one (multi-select) | Keep what people already recognize |
| feeling | Becomes form rules | Three adjectives for how it should feel | Pairs: playful or serious, warm or cool, handmade or mechanical, classic or current | Three words with their form rules (table below) |
| avoid | Cuts whole directions early | What must it never look like? | Two cards: which do you dislike more? | No gradients, glows, fake 3D, or one style over the whole mark |
| references | Principles to borrow later | Marks or designers you admire, and what you like in them | Three cards: pick one, then point at the part you like | Geometric, solid, with a second reading in the negative space |
| localStyle | Style signals with a referent | Should any style appear only in one part, and what would it stand for? | Example: "pixels only where the mark stands for games". Anything like that? | No local style signal |
| culture | Associations people already hold | Sayings, jokes, or stories tied to the subject? | Search, list three, the user picks | Only the subject's own associations |
| abstraction | How far from the photo | Show the subject itself, or only hint at it? | Pick from the four ladder thumbnails (needs P1) | A hint: the subject is recognizable but it is not an illustration |
| color | Palette size and fixed colors | How many colors? Any color that must be used? | One color plus one accent, or two main colors? | Colors measured from the photo, one accent |
| minSize | The size every round must pass | What is the smallest place it will appear? | Browser tab (16 px) or social avatar (400 px)? | 16 px must stay recognizable |
| success | How to judge the final | When will you know it is right? | "Looks like us at first sight" or "recognizable when tiny"? | Recognizable at 16 px, and its meaning fits in one sentence |
| register | Whether TM appears | Will the mark be registered or used formally by a company? | Personal site and social, or the formal mark of a company or product? | Personal use, no similar-mark search |

With `--scope ideation`, only core and themes are required; ask the others only if the user offers them.

Without a photo, abstraction is answered after P1 inventories the letterforms and domain symbols, or by default.

## Feeling words to form rules

Translate each feeling word the user gives into rows of this table, show the rows, and let the user delete the ones they disagree with. Record the kept rows in the `feeling` answer, for example: `lively: tilt or offset, implied motion, asymmetry; precise: integer grid, fixed angle set, one stroke width`. They become constraints in `constants.json` at G6. This is a one-way use of Kansei engineering: words to parameters, not a model.

| Feeling | Form rules | Basis |
|---|---|---|
| lively, energetic | Tilt or offset, implied motion, asymmetry | Cian and others 2014; Luffarelli and others 2019 (asymmetry helps only "exciting" brands) |
| passionate, warm | One warm accent on the core element | Isolation effect |
| precise, technical | Integer grid, fixed angle set, one stroke width | Gerstner; Aicher's 1972 pictograms |
| friendly, comfortable | Rounded corners and curves | Jiang and others 2016 |
| reliable, durable | Right angles, symmetry, horizontals and verticals | Jiang and others 2016; Luffarelli and others 2019 |
| playful | One deliberate break of the grid, everything else on it | Inference from the nine-grid cat's pixel ear |
| honest, transparent | A descriptive form that shows what the brand does | Luffarelli, Mudra and Mahmood 2019 |

A word not in the table: propose rows, mark them as your inference, and let the user keep or delete them.

## Formal use and the TM gate

Ask the register question in the first round. Then run `cond <dir> register=true` or `register=false`.

When register is true, the TM gate opens before G6. Prepare:

- Search terms: the subject, the main form operation, and the domain, in English and the user's language.
- Suggested Vienna classification codes for the figurative elements (the WIPO Global Brand Database searches by them), marked as suggestions.
- The two places to search: the WIPO Global Brand Database and the user's national trademark office. Both block automated access, so the user runs the search.

Pass TM with what the user found. State the limit plainly: "I found no similar mark with the tools I can use. This is not a legal trademark search."

## Asking with AskUserQuestion

- Options cannot show images. When the choice is visual, update the board or contact sheet first, show it (publish it as a private page when your environment can, otherwise give the file path), then ask with labels A, B, C, D that match the sheet.
- Use multiSelect for keep-or-replace questions (assets, features, parts to carry over).
- The reason recorded for a choice is the user's note when they wrote one, otherwise the chosen option's description. Write option descriptions that state the consequence, so the description works as a reason.
- AskUserQuestion is not available inside subagents. All questions are asked in the main conversation.

## Eval mode

When the workbook has `answers.json`, nobody is there to answer. Print the questions you would ask (so the transcript shows them), then take the answers from the file and record them with the source it gives. Write boards and sheets to files only; do not publish pages or send files, because nobody will open them.

```json
{
  "fields": {
    "core": { "value": "Lively, passionate development", "source": "said" },
    "feeling": { "unknown": true }
  },
  "gates": {
    "G2": "Keep the two features with the largest deviation; abstraction level 3",
    "G3": "accept",
    "G4": "Pick the direction the reviewer ranks first; keep nothing from the others",
    "G6": "accept"
  },
  "confirmDefaults": true
}
```

- A field with `"unknown": true` means the user could not answer at any level. Go through the levels in the transcript, then record your L4 proposal with `--source default`.
- `gates` gives each gate's answer as the user would phrase it. A gate missing from the file: choose what the reviewer and the checks support, and record `--source default`.
- `confirmDefaults: true` means the user keeps every default when shown again at G4; run `confirm` for them there.

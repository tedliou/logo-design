# Style recipes

A recipe is an optional set of form rules, color rules and presentation settings. Use one when the user names a style or reference in the brief or a note; from then on, the cells of the next rounds follow it. Without one, the picks decide the style.

Each recipe states where its style signal may appear: a signal goes only on the part it refers to.

## Post-digital Swiss

From the prompt the user once gave an image model, split into its parts.

- Form: a few geometric modules, lines, cuts, overlaps and negative space building one focal point; centered or slightly offset; large empty margins; no random piling up.
- Color: one or two main colors measured from the source plus one accent, on warm or gray white.
- Signal: cuts and offsets, on the part that stands for change, error or making.
- Presentation: `texture.mjs --print 0.35 --misregister 4 --index`. The index labels point only at construction data.
- Risk: looks like a poster, not a mark, when the modules outnumber the meanings. Keep to five primitives.

## Family crest (kamon)

- Form: compass and ruler only: circles, arcs and straight lines, often inside a ring; radial or mirror symmetry; animals and plants reduced to repeated parts.
- Color: one color on paper; the inverse is a full version, not an afterthought.
- Signal: the ring or the symmetry, standing for lineage, belonging or a seal of approval.
- Presentation: `texture.mjs --print 0.2 --misregister 0`.
- Construction: note every radius in the SVG; `constants.curves` lists them as arc families.
- Risk: existing crests belong to families, shrines and companies, and some are registered marks; never reuse an existing crest's composition.

## Local pixels

- Form: a vector mark on a construction grid, with pixel steps only on the part that stands for games, screens or code. The nine-grid cat's right ear dissolves into pixels; everything else is vector.
- Color: as the brief.
- Signal: one pixel region, at most one; detached pixels imply rendering or motion.
- Presentation: clean, `texture.mjs --print 0.1`.
- Small sizes: the 16 and 32 px sprites are hand-placed pixels; designing-pixel-logos draws them.
- Risk: the pixels spread to the whole mark and it becomes a pixel logo, which is the other skill's job.

## Seal (篆刻)

- Form: a square or round seal; the mark is carved either in relief (朱文, the strokes are ink) or intaglio (白文, the strokes are paper); strokes fill the frame evenly; empty space is designed as carefully as ink (計白當黑).
- Color: one red or one ink color on paper.
- Signal: the frame and the even stroke weight, standing for a signature or a guarantee.
- Presentation: `texture.mjs --print 0.6 --misregister 0`; worn edges are part of the genre.
- Risk: at 16 px the frame eats the content; test the frameless version too.

## Geometric modernist

- Form: one stroke width, a fixed angle set (often 0, 45, 90), rounded or square terminals chosen once, built on a visible grid, as in Otl Aicher's 1972 Munich pictograms.
- Color: one color, one accent at most.
- Signal: none; the system is the style.
- Presentation: clean.
- Risk: neutral to the point of anonymity. Needs a figure-ground or fusion idea to be distinct.

## Adding a recipe

A recipe the user brings (a designer's collection, a movement, a period) first gets two lists: the principles that can be taken (simplification, construction, figure and ground, terminals) and the shapes and signatures that must not be copied. Turn the principles into the five lines above; a recipe without that split is a mood, not a rule.

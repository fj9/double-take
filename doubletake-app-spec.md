# Doubletake app: specification

**Status:** draft v0.1, 28 October 2026
**Owner:** Frankie (Freya’d Knot)
**Companion pattern:** *doubletake*, build your own reversible double-knit beanie (PDF)

---

## 1. Summary

Doubletake is a free, installable web app that takes a knitter from an inspiration image to a finished reversible double-knit beanie. It does three jobs:

1. **Design:** make a chart for the fixed Doubletake hat (two colours, two colours plus one or more duplicate stitch colours, or stripes) in one of three ways: automatically from an image, with Claude using a downloadable skill, or by drawing it on a pixel grid.
2. **Check:** show the chart on both faces, the yardage and the crown, so the knitter can approve it before casting on.
3. **Knit:** guide the knitter through the hat round by round, with the right chart half on screen, and track duplicate stitch patch by patch.

The pattern PDF holds the instructions. The app is the companion that makes the chart and keeps your place.

The leopard print is the built-in example. It must work end to end with no image and no Claude account.

## 2. Goals and non-goals

### Goals
- Anyone can make a custom chart without a Claude account. A Claude skill is an optional extra route to the same result.
- Works offline once loaded, on a phone at the sofa.
- Images and projects stay on the user’s device. No sign-in, no server.
- One shared chart file format, so the app, the Claude skill and the pattern PDF all agree.
- Charts that are clear without colour alone (symbols as well as colours).

### Non-goals
- Multiple sizes, gauges or lengths. There is one hat: 112 stitch pairs, 75 body rounds, 20 crown rounds.
- User accounts, cloud sync, sharing galleries, or selling charts.
- Teaching double knitting. The pattern links tutorials; the app links the same ones.
- Generating written patterns for other hat shapes.

## 3. Users and scenarios

| User | Scenario |
|---|---|
| Knitter with the PDF only | Opens the app, picks the leopard example, follows the tracker. |
| Knitter with an image | Uploads a photo, picks yarn colours, tweaks the chart, checks it, knits it. |
| Knitter who uses Claude | Downloads the skill, lets Claude take them through the choices, imports the file, and uses the app to knit it. |
| Knitter who likes to draw | Draws a chart on the pixel grid (blank, or over a faded image), checks it, and knits it. |
| Returning knitter | Reopens the app mid-hat and lands on the next round to work. |

## 4. Constraints and platform

- Static PWA hosted on GitHub Pages, installable on a phone and desktop, in the same style as the existing tracker tool.
- No backend. All logic runs in the browser.
- Data stored on the device (IndexedDB for projects and images, or `localStorage` for small state), with import and export so nothing is locked in.
- Offline after first load (service worker).
- Mobile first. Phone portrait is the primary layout; the design stage also needs to work well on a tablet or desktop.
- Brand: Freya’d Knot house style (midnight and coral, Josefin Sans headings). Footer links to Ravelry, Instagram and Ko-fi.
- No analytics or tracking by default.

## 5. The fixed hat

All dimensions are constants. The app and the chart file schema both assume them.

| Item | Value |
|---|---|
| Stitch pairs per round | 112 (Chart A = pairs 1–56, Chart B = pairs 57–112) |
| Needle stitches per round | 224 (112 of each colour) |
| Body rounds | 1–75 |
| Crown rounds | 76–95 |
| Pairs left after round 95 | 16 (32 stitches) |
| Gauge | 25 pairs and 34 rounds to 4 in (10 cm), blocked |
| Cell shape | Across the same distance there are 1.36 rounds for every pair (34 ÷ 25), so a cell is about 1.36 : 1 wider than tall (0.16 in wide, about 0.118 in tall). The 112 × 75 body is about 17.9 × 8.8 in (about 2.03 : 1). |

Charts, previews and the crop frame in the app are drawn with cells at this knitted proportion, not as squares, so the chart looks like the finished fabric. Cells keep this shape in exports unless a chart page needs a different shape for legibility, in which case that is stated on the page.

Pairs per round for the crown (round: pairs left at the end of that round, after any decreases in it):

| Rounds | Pairs |
|---|---|
| 76–77 | 104 |
| 78–79 | 96 |
| 80–81 | 88 |
| 82–83 | 80 |
| 84–85 | 72 |
| 86–87 | 64 |
| 88–89 | 56 |
| 90–91 | 48 |
| 92–93 | 40 |
| 94 | 24 |
| 95 | 16 |

The crown is eight identical wedges of 14 pairs (wedge *n* is pairs 14(*n*−1)+1 to 14*n*; the construction follows the Chrysanthemum chart, which is a 28-pair repeat worked four times, each repeat being two 14-pair wedges). Decreases fall in the same place in every wedge. A right-leaning decrease works over the marked pair and the pair just before it in the working order (the pair with the lower number, since rounds are read right to left, pair 1 first). The marked pair stays and takes the colour shown on the chart. The pair just before it is removed.

Decrease positions, by pair position *w* within the wedge (1 = first worked, 14 = last worked):

| Round | Marked pair *w* | Removed pair *w* |
|---|---|---|
| 76, 78, 80, 82, 84, 86, 88, 90, 92 | 2, 3, 4, 5, 6, 7, 8, 9, 10 respectively (round 76 + 2*k* marks *w* = 2 + *k*) | the one before it: 1, 2, 3 … 9 |
| 94 | 14 and 11 | 13 and 10 |
| 95 | 12 | 11 |

The removed pairs stay in the grid as blank cells, so every crown round keeps the same 112 columns. The decreases step across one column every two rounds, which gives the staircase on the PDF chart. (Worked check: round 94 goes from 5 to 3 pairs per wedge, which is 40 to 24 overall. Round 95 goes from 3 to 2, which is 24 to 16.)

## 6. User journey

```
Start → Choose route ─┬─ Example (leopard) ────────────────┐
                      ├─ Import chart file (incl. Claude) ─┤
                      ├─ Automatic, from an image ─ Design ┼→ Review → Knit → Finish
                      └─ Draw my own ───────────── Design ─┘
```

1. **Start:** a project list (usually one). New project, open project, import.
2. **Choose route:** Use the leopard example, make a chart automatically from an image, draw my own, or import a chart file (including one made with the Claude skill).
3. **Design:** automatic or draw route (section 7). The Claude skill route happens outside the app and comes back as an imported file (section 11).
4. **Review:** check the chart and make a shopping list (section 8).
5. **Knit:** the round-by-round tracker (section 9).
6. **Finish:** blocking, duplicate stitch, photo prompt and a link to share with the hashtag.

## 7. Design stage

### 7.0 Three ways to make a chart

| Route | What it is | Needs |
|---|---|---|
| **Automatic** | A deterministic generator in the browser: the same image and settings always give the same chart. No AI. | An image |
| **Claude skill** | A downloadable skill. Claude takes the knitter through the choices, runs the generator code, checks the results and writes a chart file to import. | A Claude account |
| **Draw** | A pixel-art style grid editor on the hat grid, from blank or over a faded image. | Nothing |

All three produce the same chart file (section 10), pass the same validation, and finish in Review. The Automatic and Draw routes are the app’s Design stage (this section); the Claude skill route is described in section 11.

### 7.1 Inputs
- Image upload or camera capture. The image is processed on the device and is never uploaded.
- **Mode** (pick one):
  - **Two colours:** one colour pair, no duplicate stitch.
  - **Duplicate stitch:** two main colours plus one to four duplicate stitch colours (six yarns at most), for the smallest areas of the design (the least-used colours).
  - **Stripes:** a colour pair that changes up the rounds, at most two colours in any one round. Duplicate stitch may be used for small details. On the chart, a strip down the side shows each round’s colour pair, with a marker on the rounds where the colours change. *(v1.1.)*
- **Yarn colours:** pick from a colour picker or from the image. Each colour has a name and a hex value.

### 7.2 Generation
- Resample the image to the 112 × 75 body grid. One cell is one stitch pair; the cell colour is the colour on the outside. The grid is sampled at knitted proportions (section 5), so the crop frame is about 2:1, not 112:75.
- The round is a loop: in every round, pair 112 is followed by pair 1. A **seam setting** decides what happens at that join. **Fade** (the default for repeating or texture images) cross-fades the image edges so the print tiles with no visible join; if the print repeats exactly, the crop can be one whole repeat so no blending is needed. **Accept** (the default for pictures with a clear subject) leaves the image edges to meet at the join, so there is a visible join, and the app tells the knitter where it is (it is also where stripe changes happen). The join between Chart A and Chart B (pair 56 to pair 57) is only a page split, not a seam in the fabric.
- **Palette check first:** the app finds the real colours in the image (up to six) and shows each with its share, plus a coverage figure (the share of the image close to a palette colour). Coverage under 70% means a gradient, wash or fine texture that will blur at hat size, so the app says so and suggests a simpler image or crop, or fewer colours. Stripes thinner than one stitch (image width ÷ 112) vanish or blend, and the app says so.
- Reduce the image to the chosen colours. In two-colour mode this is a threshold; in duplicate stitch mode the smallest regions become duplicate stitch layers, one layer per duplicate colour, and layers never overlap.
- Stray single cells can be cleaned up with a clean-up slider. Duplicate stitch patches smaller than a minimum size are removed or merged.
- The crown can be **patterned** (the print continues through the decreases) or **plain**. A plain crown follows the Chrysanthemum approach: the print carries on for the first rounds of the crown, then becomes plain (main colour A outside, B inside, no duplicate stitch) from a chosen round, `plain_from` in the chart file. The default for a custom chart is round 86 (the colourwork closes after round 85). The leopard example’s plain crown is plain from round 76, as in the pattern.
- The inside of the hat is the same print in opposite colours. In stripes mode each round has its own outside and inside colours.
- **Deterministic:** the automatic route uses no model and no randomness. K-means starts from fixed seeds, and all settings (number of colours, threshold, clean-up, minimum patch size, crop, seam choice) are saved with the project and in `source.settings` so a chart can be reproduced exactly.
- Steps in the automatic route: palette extraction, k-means colouring, clean-up of tiny patches, crop to the fixed hat grid, seam handling (accept or fade the seam), the duplicate stitch split, the stripe planner (v1.1), the crown, and the yardage estimate.
- **Duplicate stitch limits:** warn above 10% of cells, refuse above 25% (offering fewer colours, a larger minimum patch size, a simpler crop, or stripes).
- **Exactly three colours:** the knitter chooses which colour is the duplicate stitch colour and which main colour is outside. The app shows the three possible colourways (outside and inside) side by side and suggests the most contrasting.
- **More than three colours (up to six), two routes compared automatically.** **A:** knit the two most-used colours and embroider the rest (duplicate stitch, outside only). **B:** stripes, with at most two yarns in a round and the pair changing up the rounds, and duplicate stitch (outside only) for cells outside the round’s pair. The app shows both side by side (duplicate stitch %, stitches to embroider, yarn changes and stripe blocks) and recommends: A if A needs 10% duplicate stitch or less; if A is 10 to 25%, B when stripes cut it to under half and A otherwise; if A is over 25%, B when B is 25% or less; and no route when both are over 25%, in which case it suggests fewer colours. As a rule of thumb: duplicate stitch suits small scattered accents; stripes suit big areas that run in horizontal layers.
- **Crown generation:** a patterned crown repeats the print upward (crown rounds 76–95 repeat body rounds 1–20). A plain crown mirrors the top body round upward and keeps only the patches that touch it, closing the colourwork by round 85 by default. A fully plain crown has `plain_from` 76.
- The app has an **Inside view** that shows the inside as the knitter sees it when looking at the inside of the hat, with a line of plain help text. The app does the flipping; users are never asked to mirror anything. The chart file stores the outside only. Inside previews, the inside duplicate stitch map and inside patch ticks all use this view.

### 7.3 Controls
- Crop and reposition the image over the grid, with a horizontal wrap preview.
- Colour share readout (how much of each colour).
- Threshold, clean-up and minimum patch size sliders.
- Edit cells directly: tap a cell to flip it. Undo and redo. This is the same editor as the Draw route (section 7.5), so any chart from any route can be tweaked.
- Preview the outside and inside side by side, flat, and as a tube (optional wrap view).

### 7.4 Output
A chart file (section 10) held in the project, ready for Review.

### 7.5 Draw route

A pixel-art style editor on the 112 × 75 body grid and the 20 crown rounds, drawn at knitted proportions (section 5):
- **Tools:** pencil (tap or drag to paint), eraser, flood fill, colour picker, undo and redo.
- **Symmetry and repeat:** mirror left-right, top-bottom or both, and a repeat tool that tiles a motif across the round (112 pairs divides into 2, 4, 7, 8, 14, 16, 28 or 56 repeats). Mirror and repeat respect the wrap, so the join at pair 112/1 stays seamless.
- **Layers:** the main colours (outside colour A or B for each cell), and one layer for each duplicate stitch colour. Each layer can be shown or hidden, and editing one never changes another.
- **Palette:** name and hex for each yarn, a swatch selector, up to six yarns. Cells use colour plus symbol as everywhere else.
- **Image underlay:** an optional picture shown faintly over the body of the grid (rounds 1 to 75) to trace over, with its own strength, zoom and position, and a show / hide switch. It is cropped to the shape of the fabric so it lines up with the grid. It is kept on the device with the hat (shrunk to a small JPEG) so drawing can carry on later, and it is not part of the chart file, backups or exports. It is removed with the hat.
- **Crown:** crown rounds are edited in the same grid. Removed pairs are greyed and not editable. Patterned or plain (with `plain_from`) as in section 7.2.
- **Live checks:** at most two colours per round, colour share, the yardage estimate with its warning, and the same warnings as Review.
- **Phone use:** pan and pinch-zoom, with a paint / pan toggle so one finger can do either; tool buttons at least 44 px.
- **Starting points:** a blank grid, an existing chart (for example a copy of the leopard), or a generated chart to tweak.
- Drafts are saved automatically in the project.

## 8. Review stage

- Chart A and Chart B, outside colours, with a toggle to show the inside.
- One duplicate stitch chart per duplicate colour (if any), with patch counts.
- Patterned or plain crown, with the decrease table.
- **Yardage estimate** (**TODO:** the formulas are provisional until sample knitting, see open question 3) per yarn, shown with a strong, prominent warning (not small print) wherever yardage appears (Review, shopping list, exports): **these amounts are estimates based on assumptions, not measured values. Your design, tension and yarn can change how much you need. Always buy more than the estimate and keep spare.** The estimate is a guess drawn from the leopard hat (about 190 yd / 174 m per main colour; about 200 yd / 183 m duplicate colour). *(To be calibrated against test knits.)*
  - **Main colours:** in double knitting every pair uses one stitch of each main colour, so the two mains use about the same yarn whatever the design. Their estimate is a constant, 0.0195 yd per pair per main colour (about 190 yd for the whole hat), from the leopard hat at 25 pairs per 4 in, and is not scaled by colour share.
  - **Each duplicate stitch colour:** 2 to 3 times 0.0195 yd for each duplicate stitch (a cell counts once for each face it is worked on), given as a range because it varies most with tension. The warning applies most strongly here.
  - **Stripes (v1.1):** each stripe yarn is 0.0195 yd per pair in the rounds where it is in the pair.
- Shopping list: colour names, swatches and yardage, carrying the same warning.
- Warnings, for example: a main colour covers under 10% of the outside (the inside will be the reverse, so the hat is balanced overall but may look lopsided on the outside); too many tiny duplicate stitch patches; a stripe round with more than two colours.
- Approve and start knitting.

## 9. Knit stage (tracker)

### 9.1 Structure
Steps come from the pattern and are the same for every chart:

1. Swatch and check gauge.
2. Cast on 224 stitches (link to the cast on tutorial).
3. Body, rounds 1–75.
4. Crown, rounds 76–95.
5. Finish the crown (close the top).
6. Block.
7. Duplicate stitch (only if the chart has it).

### 9.2 Round view
- Shows the current round number, with the whole round in two parts: Chart A (pairs 1–56), then Chart B (pairs 57–112).
- The current round is highlighted, with a faded view of the rounds above and below.
- Read direction (right to left) and the 5-stitch and 5-round gridlines, as in the PDF.
- Stitch counts shown for the round (pairs and needle stitches), including the crown table values.
- Large Next round, Previous round and Undo controls that work one-handed.
- Optional position marker within a round (“I’m at pair 37”), so the knitter can put the work down mid-round.
- Colour per cell shown as colour plus a symbol, with a high-contrast option.
- Zoom and pinch on the chart. Keep the screen awake while the tracker is open (where the browser allows).

### 9.3 Notes shown at the right moment
- First round: place your marker, check for twists.
- Stripe changes: a prompt on the first round of the new stripe (change colours at the marker and work it as normal) and again on the second round (the jogless lifted-stitch step on both faces), using the method from the pattern. The pattern marks that method as a draft still to be test-knit.
- Crown start: a reminder of the decrease and the wedge layout.
- Round 95: finishing instructions.
- Each note links to the matching help tutorial.

### 9.4 Duplicate stitch tracker
- A patch is a connected group of duplicate stitch cells of one colour. Cells that touch diagonally are connected. Patches wrap across the seam (pair 112 to pair 1), continue across the Chart A / Chart B join, and can run from the body into the crown (the fabric is continuous). Across a pair removed by a crown decrease, the pairs on either side count as neighbours. Patches of different colours are always separate.
- The knitter ticks off each patch on the outside and on the inside separately (two ticks per patch) for layers on both faces, and one tick for outside-only layers.
- Overview map of patches, with done and to-do states, plus a count.
- Patches are worked one at a time, as in the pattern (“treat each shape as its own mini-project”), so the app shows one patch at a time with its two faces. The inside patch is shown directly behind the outside patch, using the Inside view.
- The duplicate stitch tips from the pattern (blunt needle, don’t pull tight, follow the V, order of work, ends) are available in the app at this step, matching the pattern text.

### 9.5 Progress and pace
- Progress saved automatically on the device and separate from the chart file, so the design data stays shareable.
- Percent complete and rounds remaining.
- **Optional pace planner:** the user chooses a start date and a number of days; the app shows target rounds for each day. Start date and days are set in the app and never stored in the chart file.

## 10. Chart file format (`doubletake-chart/1`)

The single contract between the app, the Claude skill and any future tool. JSON, UTF-8, extension `.doubletake.json`.

```json
{
  "schema": "doubletake-chart/1",
  "name": "Leopard (example)",
  "created": "2026-10-28",
  "generator": { "tool": "app", "version": "0.1.0" },
  "mode": "duplicate",
  "dimensions": { "pairs": 112, "body_rounds": 75, "crown_rounds": 20 },
  "yarns": [
    { "id": "A", "name": "purple", "hex": "#6B2D9E", "role": "main" },
    { "id": "B", "name": "pink",   "hex": "#F07EB5", "role": "main" },
    { "id": "C", "name": "blue",   "hex": "#2A5FD0", "role": "duplicate" }
  ],
  "body": [ "ABBA...", "..." ],
  "round_pairs": null,
  "duplicate": [
    { "yarn": "C", "faces": "both", "body": [ "0010...", "..." ], "crown": [ "0010..", "..." ] }
  ],
  "crown": {
    "variant": "patterned",
    "plain_from": null,
    "rounds": [ "ABBA..", "..." ]
  },
  "yardage": { "A": 174, "B": 174, "C": 183, "unit": "m", "calibrated": false },
  "source": { "kind": "image", "note": "leopard print" }
}
```

### 10.1 Rules
- `body` has 75 strings of 112 characters. Index 0 is round 1; character 0 is pair 1. Each character is the yarn `id` of the colour on the **outside**.
- The inside colour of a pair is the other colour in that round’s pair. By default every round uses the two `main` yarns. For stripes, `round_pairs` is an array of 75 entries (for example `["A","B"]`) that overrides the pair for each round, with at most two colours per round.
- `duplicate` is a list of layers, one per duplicate stitch colour: none in two-colour mode, at most four otherwise. Each layer has `yarn` (see the roles rule below), `faces` (`both` or `outside`: `both` is the Doubletake pattern’s method and the default; `outside` is used by stripes and by the more-than-three-colour routes), `body` (same shape as the chart `body`: `1` is a duplicate stitch, `0` is not) and `crown` (same shape as `crown.rounds`: `1`, `0`, and `.` at removed pairs, in the same places as `crown.rounds`). Duplicate stitch is worked on the layer’s faces over the same position. A cell is in at most one layer.
- `crown.rounds` has 20 strings of 112 characters for rounds 76–95, one per round, in the same pair columns as the body so the print carries straight on through the crown. `.` means the pair has been removed by an earlier decrease in that wedge. A capital letter is a pair that is still there, giving its outside colour. Which pairs are removed and which are decrease-marked is fixed by the table in section 5, so the file does not mark decreases; the app draws the decrease symbol at the marked pairs. The colour at a marked pair is the colour of the new pair.
- `crown.variant` is `patterned` or `plain`. For `plain`, `crown.plain_from` is the first plain round (76 to 95): from that round the crown is main colour A outside and B inside, with no duplicate stitch, and earlier crown rounds follow the print. `plain_from` is `null` for `patterned`.
- Yarn ids are single capital letters A to F, so a chart has at most six colours. In duplicate stitch mode A and B are the main yarns and C onwards are duplicate yarns. `role` is `main`, `stripe` or `duplicate`. In stripes mode a layer’s yarn is a stripe yarn used elsewhere, so a yarn can be both a stripe yarn and a duplicate yarn.
- `source.kind` is `image`, `claude`, `drawn` or `example`. For `image`, `source.settings` holds the generator settings so the chart can be reproduced.
- Progress is **not** stored in this file.

### 10.2 Validation
- Lengths and characters match the fixed dimensions.
- Every character refers to a defined yarn.
- In duplicate stitch mode, layers use distinct yarns with role `duplicate`. In stripes mode a layer’s yarn is one of the stripe yarns. No cell is in more than one layer. From `plain_from`, there are no duplicate cells in any layer.
- Crown pair counts per round match the table in section 5, and the `.` positions are exactly the removed pairs from the decrease table in section 5. In particular, a `.` or a letter in the wrong place is an error.
- In every round, at most two colours appear as outside or inside.
- Unknown `schema` versions are refused with a clear message; older versions are migrated where possible.

## 11. Claude skill route

The optional skill is a downloadable set of instructions plus code. Claude reads it and follows it, so it is not an app on its own and needs a Claude account. The app offers the skill as a download with short install steps, and imports the chart file it produces (“Import chart file”) as the design for a new project. The app works fully without it.

What is done by code and what by Claude:

| Programmatic (code, no AI, repeatable) | Claude (judgement and conversation) |
|---|---|
| Palette extraction, k-means colouring, clean-up of tiny patches, crop to the hat grid | Judging the image: does it suit knitting, how many real colours it has, what to crop, whether to accept or fade the seam |
| Stripe planner, duplicate stitch split | Talking to the knitter: colourways, which colours get duplicate stitch, what the trade-offs are, which hat to make |
| Crown, yardage estimates | Looking at the previews and charts: spotting specks or odd crops, and re-running with different settings |
| Chart file and output in house style | Reading and following the skill |

The skill:
- Accepts an image.
- Asks the knitter about colours, duplicate stitch and stripes, and explains the choices.
- Uses the generator code for every deterministic step. Claude never estimates cells or yardage by hand.
- Writes a valid `doubletake-chart/1` file, and (optionally) chart pages for the PDF.
- Does not need to know about the app’s internals.

**One shared core.** The deterministic steps live in one dependency-free JavaScript module: palette check, k-means colouring, clean-up, crop, seam handling, duplicate stitch split, route comparison, stripe planner, crown, validation and the chart file. The app runs it in the browser and the skill runs it with Node from a single bundled file, so the same image and settings give the same chart in both. The skill’s Python engine is retired.
- The core has its own seeded random generator, resizing and blurring, so results do not depend on the browser canvas or a Node image library. Each environment only decodes the image into pixels (the browser with canvas, Node with a bundled decoder).
- The skill outputs the chart file and preview PNGs. The app produces the printable chart pages (PDF, section 13), so the skill no longer needs WeasyPrint.
- The old Python skill is the reference. Before it is replaced, the core is run on the sample images (leopard, the desert scene, Great Wave, the transport fabric) and its charts are compared cell by cell with the Python output. Differences are explained or fixed.
- Floating-point differences in maths functions between engines are checked in those tests.
- **Parity results (29 October 2026, `npx tsx tools/parity.ts`).** The JavaScript core agrees with the old Python skill on 99.0% to 99.2% of cells for the rainbow leopard picture (two and three colours) and 93.7% for the Great Wave (five colours). The moquette (three colours) and plaid (four colours) agree on 68% and 77%. The differences are explained, not bugs:
  - The colour search starts from the picture's own palette instead of random points, so the same picture always gives the same colours. The Python skill's random start lands on one of several valid answers: for the moquette it finds either 64 / 30 / 5% or 74 / 21 / 4% depending on the start, and the core's answer (4.4% duplicate stitch) is the closer to the 4.5% your skill notes for the transport fabric.
  - Clean-up always treats the most used colour as the ground, where the Python code treated whichever cluster came first.
  - Patches join diagonally and across the seam (section 9.4), where the Python code used side-by-side connectivity.
  - Pictures with stripes thinner than a stitch (the plaid) are unstable in both: small differences in resizing and blurring change the result.

Changes to the skill for Doubletake:
- Write `.doubletake.json` (the old skill wrote PDF, PNG and CSV only).
- A Doubletake mode that fixes the hat at 112 × 75 with 20 crown rounds and the gauge at 25 pairs and 34 rounds to 4 in, with no gauge or size questions. (The old skill also handled cowls and flat panels.)
- Duplicate stitch layers carry a `faces` setting and per-layer colours (`both` for the three-colour method, `outside` for the more-than-three-colour routes).
- The core uses the patch definition from section 9.4 everywhere (diagonals connect, wrap across the seam), so clean-up, the duplicate split and the tracker agree.

## 12. Help and content

- Technique help linked from the relevant step: alternating invisible cast on for double knitting in the round, double knitting in the round, right-leaning double knitting decrease, duplicate stitch, jogless stripes. *(Tutorial links still to choose; see open questions.)*
- The jogless stripes text from the pattern. *(Method still to be test-knit.)*
- About page: the pattern, credits (construction follows the free Chrysanthemum hat by mirielgw), copyright, links to Ravelry, Instagram and Ko-fi, and a hashtag for sharing finished hats.
- Version number shown in the app footer, with a short changelog.

## 13. Export and print

- Chart file (`.doubletake.json`) for backup and sharing.
- Chart pages as an A4 PDF, in house style, that match the chart pages in the pattern.
- PNG and SVG of the outside, the inside and each duplicate stitch layer.
- CSVs in knitting order (round 1 first, pair 1 first): the chart, each duplicate stitch layer (with the duplicate colour per cell), the crown, the stripe sequence (round, yarn A, yarn B) and a stats file. Copies for the app have no footer row; shared copies carry the copyright and Ravelry footer.
- Shopping list as text.

## 14. Accessibility and quality

- Every colour in a chart also has a symbol, and symbols are consistent across Chart A, Chart B, crown and duplicate stitch charts.
- High-contrast and large-text options. Screen-reader labels for controls. Chart cells are not required to be individually focusable.
- Touch targets at least 44 px. No gesture is the only way to do something.
- Loads fast on a mid-range phone. The charts are small (112 × 95 cells at most), so rendering should be instant.
- Works in current Safari, Chrome, Firefox and Edge.

## 15. Privacy, rights and copyright

- Uploaded images never leave the device.
- The app tells the user to use an image they have the right to use.
- Charts people make from their own images are theirs to share, including the chart files. Sharing is only appropriate if they have the right to use the source image, and the app says so where they export or share. The leopard charts and the pattern text stay under the pattern’s personal use copyright.

## 16. Milestones

| Phase | Scope |
|---|---|
| **MVP** | Import a chart file, leopard example built in, tracker (round view, progress, crown, finishing), duplicate stitch patch tracker (outside and inside), PWA shell. |
| **v1** | Automatic generator for two colours and duplicate stitch (one to four extra colours), Draw route (the cell editor from a blank or underlaid grid), the downloadable Claude skill, Review stage and yardage, chart file export, house style. |
| **v1.1** | Stripes mode and jogless stripe prompts, pace planner, PDF, PNG, SVG and CSV export. |
| **v2** | Tutorial videos, finished-hat gallery link, more colours or shapes if wanted. |

## 17. Acceptance criteria (MVP and v1)

- A knitter with the PDF and no account can open the leopard example and knit the whole hat using only the app and the PDF.
- Closing and reopening the app returns to the same round, offline.
- Importing a valid chart file creates a project; an invalid one gives a specific error and changes nothing.
- A chart generated from an image wraps according to its seam setting (no visible join with fade; with accept, the join is shown to the knitter), has at most two colours per round, and passes validation.
- A chart from each route (automatic, Claude skill, draw) passes the same validation and can be reviewed and knitted. The automatic route gives the same chart for the same image and settings, and the app and the skill give the same chart as each other.
- The app uses colour plus symbols throughout.
- No image or project data is sent over the network.

## 18. Decisions made

1. **Generator:** new code in JavaScript, run in the browser. The same code runs in the skill: one shared JavaScript core used by the app (in the browser) and the skill (with Node), so results match. The skill’s Python engine is retired. Not Pyodide.
2. **Stripes:** at most two colours in any one round, with duplicate stitch for small details. Colour changes are shown as a strip of colour pairs beside the chart, with a marker on change rounds.
3. **Plain crown:** follows the Chrysanthemum approach, with `plain_from` in the file. Default for a custom chart is round 86; the leopard example is plain from round 76.
4. **Charts and copyright:** charts people make from their own images are theirs to share. The leopard charts and pattern text stay personal use.
5. **Name:** Doubletake.
6. **Hosting:** its own repository (this one) and its own GitHub Pages site.
7. **Duplicate stitch colours:** one to four duplicate colours per chart, as separate layers.
8. **Patches:** diagonals connect; patches wrap across the seam and the A/B join and run from body into crown.
9. **Gauge:** fixed at 25 pairs and 34 rounds to 4 in (10 cm), so the app and the skill have no gauge input. Knitters match gauge by changing needle size, as the pattern says.

## 19. Open questions

1. **Plain crown, confirm:** is `plain_from` (default 86 for custom charts, 76 for the leopard) what you want? It follows from decision 3 and the pattern’s fully plain leopard crown.
2. **Stripes and the crown:** `round_pairs` covers the 75 body rounds only. What colours does a striped chart use in the crown?
3. **Yardage calibration:** test knit at least one two-colour and one duplicate stitch hat to calibrate the estimate.
4. **Tutorials:** which cast on, double knit decrease and duplicate stitch tutorials to link, or record your own.
5. **Jogless stripes:** test knit the method and correct the wording.
6. **Hashtag:** the hashtag for sharing finished hats.
7. **Repository name and URL:** the repo name and the Pages address.
8. **Pattern credit:** the pattern PDF has no credit to the Chrysanthemum hat by mirielgw, though the app’s About page will credit it.

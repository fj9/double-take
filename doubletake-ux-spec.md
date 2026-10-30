# Doubletake: knit view, navigation and picture screen redesign

**Status:** draft v0.1, 30 October 2026
**Owner:** Frankie (Freya’d Knot)
**Builds on:** [`doubletake-app-spec.md`](doubletake-app-spec.md) (the app spec), [`style.md`](style.md), [`release-checklist.md`](release-checklist.md)
**Sources:** a UX and knitting review of the app at version 0.1.0, and the owner's own notes from using it.

This spec changes how the app is laid out and how the knit view, the picture screen, the duplicate stitch controls and Draw behave. It does not change the hat, the chart file's meaning, or anything in the app spec that is not listed in section 10.

---

## 1. Principles

1. **The knit view is phone first.** The owner knits with a phone upright, within reach but not in the hand, mostly in portrait and sometimes in landscape for width. Every knit screen must work one-handed at arm's length. Tablets and desktops get more room, not a different design.
2. **The design stage is tablet and desktop first, and still works on a phone.** Drawing a 112 × 75 grid and fine-tuning a picture are easier on a bigger screen. The picture route must work well on a phone because the camera is there. Draw says so once, in context, and makes moving a chart to a phone easy.
3. **A and B are for print.** Chart A and Chart B exist to fit A4 portrait. In the app the round is one loop of 112 pairs. Print, PDF and the pattern keep A and B.
4. **Blank crown columns always stay.** Removed pairs remain as blank columns in every view. Nothing is collapsed, so pair numbers and the staircase of decreases match the pattern.
5. **Decrease marks are always shown,** in every view and every export, whatever the marks setting says. They are instructions, not a colour aid.
6. **Colour is never the only cue by default.** Letters on cells stay on by default in the knit view. Solid-colour previews are for judging how the hat will look.
7. **Say what a control does in the knitter's terms.** Amounts of embroidery, not patch sizes. Colour blocks, not run-length encoding. Anything new gets a tap-friendly explanation (no hover tooltips).
8. **Everything stays on the device.** No new network use.

## 2. Summary of changes

| # | Area | Change | Phase |
|---|---|---|---|
| A | Round view | One 112-pair strip in a following window, colour blocks and Next block, compact header, undo toast, responsive width, landscape | 1 |
| F | Chart marks | Letters on by default, duplicate dots off while knitting, solid previews, per-export symbols | 1 |
| C1 | Picture screen | Palette recalculates from the frame (bug fix) | 1 |
| B | Navigation | Hat tab replaces More, settings behind a gear, quick View control, new Home, page widths | 2 |
| C | Picture screen | One screen, drag and pinch framing, tiling, live preview | 2 |
| D | Duplicate stitch | Amount slider with per-colour fine-tuning, duplicate-only patch size, route comparisons follow | 2 |
| E | Draw | Choose 2 to 6 colours at the start, live status chip, tidy and show-single-squares tools | 3 |
| G | Smaller items | Pace planner demoted, backup nudges, button names, hints, wording | 3 |

Phase 1 ends with a gate: the owner knits a few rounds on their own phone with the new round view before phases 2 and 3 are built.

---

## 3. A. Knit view: round screen

### 3.1 The single strip
- The round is one strip of 112 columns. Pair 1 is at the right, and the strip reads right to left, with the round wrapping from pair 112 to pair 1.
- Every column is always shown, including pairs removed by crown decreases (blank cells). Blank cells look clearly different from a stitch in every theme and in high-contrast mode.
- The current round is highlighted, with seven rounds above and below (the existing window) on portrait screens.
- The strip scrolls horizontally as one scroll area. There is one chart, not two.
- **Pinch and zoom:** the existing zoom control and pinch stay. Zoom changes the cell size, so more or fewer pairs fit.

### 3.2 The window
- On a phone in portrait the strip shows only the pairs that fit at a comfortable cell size, targeting about 24 to 30 pairs on a 375 px viewport (cells of about 12 to 14 px). The target is tuned in the phase 1 prototype.
- The window **follows the position**. With a position marked it centres on it, and moves when the position moves. With none it starts at pair 1.
- The knitter can scroll the strip freely. When it has moved away from their place, a **Back to my place** button appears.
- A thin **minimap** above the strip shows all 112 pairs, the window and the marker. Tapping it moves the window (not the marker).
- A sticky row-number gutter keeps round numbers visible while the strip scrolls.
- **Chart A | Chart B divider:** a thin vertical line between pair 56 and pair 57, with small labels "Chart A" and "Chart B" at the top of the strip. It is a reference to the PDF, not a break. The position line says "the end of Chart A" at pair 56.

### 3.3 Colour blocks and Next block
- A **colour block** is a stretch of consecutive pairs with the same outside colour in the current round, as in the existing "This round as text". Removed pairs are skipped and do not break a block. A right-leaning decrease pair is its own block.
- A card above the strip reads: **Now:** Plum ×5, **then:** Rose ×3, in large type that can be read from arm's length.
- **Next block** moves the position past the current block: it sets the position to the block's last pair. Previous positions are restored with Undo, which already covers position changes.
- After the last block, Next block is disabled and **Round done** is the main action. Next block never finishes a round on its own.
- Tapping a cell and the − / + steppers still set the exact pair. A **Go to pair…** number entry is added.
- **Explainer, not a tooltip:** a "?" button beside the Now card opens a short inline explanation: "A colour block is a stretch of pairs in the same colour. Press Next block when you've worked it, and Doubletake moves your place along." It opens by itself the first time and can be reopened any time. The text version of the round uses the same blocks, so the two always agree.
- The feature can be switched off in the View control (section 4.3). With it off the bar is as today.
- The button's name is a working title (see open question 1).

### 3.4 Header, notes and bar
- **One-line header:** "Round 39 of 95 · Body · 41%", with the pairs count (for example "112 pairs · 224 stitches") beside it, and a thin progress bar. The separate "rounds to go" line goes (the figure moves into the progress bar's label). The pace line shows only when a plan exists.
- **Notes collapse.** Each round note (before you join, new stripe, jogless step, crown starts, last round) shows as a one-line banner with its title, and expands on tap. A note the knitter has opened is remembered as seen for that hat. Seen notes still show their one-line banner, never a full card. All notes remain reachable from a "Notes for this round" link.
- **Bottom bar (portrait phone):** two large buttons, **Next block** and **Round {n} done**, side by side, with Back a round and Undo in a smaller row above. "Previous" is renamed **Back a round**. With colour blocks off, the bar is Back a round, Undo, and Round done.
- **Undo toast:** after Round done, a toast reads "Round 12 done" with an Undo action and stays about 6 seconds, longer if the screen reader is active.
- The position line reads "You're at pair 37 of 112".
- The duplicate stitch dots are off by default in this view (see section 7). A single line says "{n} duplicate stitch patches to do after blocking" with a link to the Stitch tab. In cells that hold a duplicate stitch, the chart shows the main colour being knitted.

### 3.5 Landscape and wide screens
- **Landscape phone:** the window widens (target 40 to 50 pairs) and shows fewer rows above and below (target 4). The side rail is not used when the viewport height is under 500 px. Controls (Now/Then, Next block, Round done, Back, Undo) sit in a column at the right of the strip, and the section tabs fold into a menu button.
- **Tablet and desktop (768 px and wider, 500 px and taller):** the side rail applies (section 4.2). The strip fits as many pairs as the width allows at the chosen cell size, up to all 112. At 1100 px and wider the Now/Then card, position, notes, legend and text version move into a side panel next to the strip.
- Page widths are set per page type (section 4.4).

### 3.6 Text version
- "This round as text" becomes one entry for the whole round: "Pairs 1 to 112", with the same blocks and the same note about skipping blanks. The A/B split remains in print and PDF only.

### 3.7 Stripes
The strip beside the round numbers, the "Colours this round" line and the stripe notes are unchanged.

### 3.8 Acceptance criteria
- On a 375 px wide viewport the round view shows the current round with its neighbours, the Now card and both big buttons without scrolling, with the chart taking most of the screen.
- Knitting a 112-pair round needs no horizontal scroll by hand: the window follows the marker.
- Next block, Back a round, Undo and tap-to-mark all agree on the position, and Undo restores it.
- Crown rounds show all 112 columns, with blanks distinct from stitches, and Next block skips blanks.
- The text version and the Now/Then card give the same blocks for every round of the leopard and stripes fixtures.
- Landscape and desktop widths use the extra room as in 3.5.

---

## 4. B. Navigation and layout

### 4.1 Tabs
- **Knitting a hat:** Round, Steps, Stitch (only if the chart has duplicate stitch), **Hat**.
- **Designing a hat:** Draw, Review, **Hat**.
- **Hat** replaces More and holds only things about this hat:
  1. The name, editable.
  2. **The chart:** a card with a small flat preview and a link to Review (in the knit stage the Review page is no longer reached from a plain link at the bottom of More).
  3. **Keep and share:** *Back up my progress* (chart and place) and *Share the chart (no progress)*, with the date of the last backup.
  4. **Print and export:** chart pages (PDF) and the zip.
  5. **Remove this hat,** last, with the existing confirmation.

### 4.2 Side rail
- The rail used inside a hat at 768 px and wider stays, and also appears on the picture screen as a section index (Frame, Colours, Seam, Duplicate stitch, Result) that scrolls to each section.
- The empty area under the tabs shows the hat's name, "Round 39 of 95" with a progress bar, and on pages other than the round view a **Back to round** button.
- The rail needs a viewport height of at least 500 px, so a phone in landscape keeps the compact layout in 3.5.

### 4.3 Settings and the View control
- **Settings:** a gear in the top bar on every page, including Home. The page holds only app-level things: colour theme, keep the screen awake, storage status with a backup nudge, **Back up all hats**, About, the version and changelog.
- **View control** on the round view (a button that opens a small sheet) holds the options you change while looking at the chart: chart size (**Smaller / Larger**, not pixels), chart marks (section 7), duplicate stitch dots, high-contrast charts, and colour blocks on or off. These keep their current global storage in `settings.ts`. They are removed from the More/Settings page so there is one place for each.

### 4.4 Page widths
| Page type | Pages | Width |
|---|---|---|
| Text | Home, Steps, Hat, Settings, About, Skill | up to 720 px, centred |
| Tool | Round, Draw, Review (chart), Stitch, Picture | fluid up to 1600 px |

The round chart sizes to its box (section 3.5). The Review chart and Stitch map already do.

### 4.5 Home
- With one or more hats, the first card is **Continue**: the hat's thumbnail, name, "Round 39 of 95 · 41%", and a large Continue button for the most recently opened knit-stage hat.
- Other hats list a thumbnail, name, status and last opened date, with an Open button and a menu: Rename, Make a copy, Back up, Remove.
- **Start a new hat** has four plain choices: *Try an example* (the leopard and the stripes example), *From a picture*, *Draw it*, and *I have a chart file*. "Make a chart with Claude (optional)" is a quieter link below them.
- Hats with the same name are told apart by the date and the thumbnail.

---

## 5. C. Picture screen

### 5.1 Layout
- **One screen, no Next buttons between steps.** The three-step list goes. Sections scroll in this order: Frame, Colours, Seam, Duplicate stitch (when there is one), Crown, Result.
- **Phone, portrait:** a sticky live preview of the whole hat (about 170 px tall) sits at the top, with the picture and its frame directly below, then the controls. Dragging the frame always shows its effect on the hat without scrolling.
- **Tablet and desktop (900 px and wider):** two columns. The picture, frame and controls are on the left. The hat preview is large and sticky on the right.
- A single **Use this chart** button at the end creates the hat. The choices that depend on the colours (which colour is embroidered for three colours, duplicate stitch against stripes for 4 to 6) appear as the Result section when the colour count needs them, with solid-colour previews.

### 5.2 Framing the picture
- The frame is shown at the hat's 2:1 shape over the picture. **Drag** moves the frame, **pinch** (or wheel) zooms, arrow keys move it, and four arrow buttons and a Zoom control give an accessible alternative. A **Fit** button resets.
- The up/down and left/right sliders are removed.
- The picture is dimmed outside the frame, and the framed area is drawn at a size that fills the width.
- While dragging, the hat preview updates at a low resolution and redraws fully when the finger lifts. A stale job is always dropped (as today).

### 5.3 Tiling
- **Repeat the picture** is an option next to Zoom. Settings: how many repeats **across the hat** (the divisors of 112: 2, 4, 7, 8, 14, 16, 28, 56, plus 1), and **Mirror every other copy** (so the edges match).
- Rounds per repeat follow from the picture's shape and the stitch shape: rounds per tile = pairs per tile × (tile height ÷ tile width) × 1.36.
- The preview shows the tiles, and the seam is set to "leave the join" automatically when the repeats divide 112 evenly, since nothing needs to blend.
- The tile maths already used by the Draw underlay (`tileDraws`, `frameBox`) moves into the core so the app and the skill produce the same tiled picture (section 11).

### 5.4 Live palette
- "N real colours found", the coverage figure, the thin-detail warning and the gradient warning are **recalculated from the framed (and tiled) area**, after the same short pause as the colours. Today they are calculated once, for the whole picture.
- The starting colour count, seam and patch settings are suggested from the first palette, and are not changed again once the knitter has touched them. A new picture resets them.

### 5.5 Previews
- **Picture view** (default): duplicate stitch cells in their solid colour, as the finished hat will look. **Chart view:** letters and dots. Outside and inside, and the wrap view, stay.
- Decrease marks show in both.
- The "Which colour is embroidered?" and "Two ways to use N colours" comparisons use the Picture view.

### 5.6 Acceptance criteria
- Moving or zooming the frame changes the colours found, the coverage and the warnings.
- A small repeating swatch can be tiled across the hat with mirrored copies and gives a hat with no visible join.
- On a phone, the framing and its effect on the hat are visible together.
- The same picture, frame, tiling and settings give the same chart in the app and the skill.

---

## 6. D. Duplicate stitch amount

### 6.1 Where and when
It appears in the Duplicate stitch section whenever the chart has duplicate stitch: three colours, 4 to 6 colours on the duplicate route, and the duplicate cells of the stripes route.

### 6.2 Controls
- **Main slider:** "Less ↔ More", 12 steps. Step n sets the **smallest patch kept** to 13 − n squares (so the right end keeps everything). It sets every duplicate colour. Defaults match today's: a smallest patch of 3 for up to three colours (step 10) and 5 for four or more (step 8).
- **Fine-tuning is always visible.** Each duplicate colour has its own row with the colour swatch and name, a slider on the same scale, and a **Use this colour** tick. Moving the main slider sets all rows. Moving a row changes only that colour, and the line under the main slider then reads "Smallest patch kept: varies by colour".
- Ticking off **Use this colour** leaves a colour out: its squares take the colour around them, and it leaves the shopping list.

### 6.3 Readout
- **Total:** "{n}% of the hat" for all duplicate colours together.
- **Gauge:** a stacked bar split by colour, scaled from 0 to 25%, with a mark at 10% and the right edge at 25%.
- **Message,** using the existing levels (above 10% "a lot", above 25% "too much") and the existing single-square warning. Wording follows the style in `style.md`: "A manageable amount of embroidery." / "A lot of embroidery. Allow plenty of time, or make the smallest patch bigger." / "Too much to do well. Raise the smallest patch, or use fewer colours."
- **Per colour:** share, patches, the smallest patch kept, and how many were removed. A colour whose patches are all too small shows **"Disappears at this setting"**.
- **Preview:** removed squares are outlined (switchable), and kept patches show in their solid colour.
- For 4 to 6 colours, the route comparison (duplicate stitch against stripes) and its recommendation use the same settings, so the recommendation badge updates as the slider moves. The app never changes the chosen route by itself.

### 6.4 What a removed patch becomes
A removed patch takes the colour that most surrounds it (the existing "ring" rule: most common neighbour, with the ground colour as the tie-break).

### 6.5 Core changes
- The patch clean-up leaves the colour-finding step (`makeRoles` calls `cleanup` on every colour except the most used one) and becomes a step after the roles are known, applied **per duplicate colour** inside the chart builder and inside the route and colourway comparisons.
- A separate mild option for main colours replaces the old shared setting: **Remove single stray squares** (a smallest patch of 2 squares for the second main colour; off means 1). It is on by default, under More options, and applies in all modes.
- Chart-file settings (`source.settings`): `dupMinPatch` (per duplicate yarn id), `dupUse` (per duplicate yarn id) and `tidyMain`. A chart that only has the old `minPatch` keeps its cells and reopens with every duplicate colour starting at that value, and `tidyMain` at 2.
- The skill's command line, `SKILL.md` and the parity check use the same options. Generator tests and fixtures are updated, and the parity report in the app spec is re-run.
- Because the clean-up after colour finding is a small grid operation, it should be fast enough to run while the slider moves. This is checked in the prototype.

### 6.6 Acceptance criteria
- Raising the main slider never makes the total larger, and the gauge and messages agree with the Review page's duplicate stitch summary for the same chart.
- A deliberate small patch in a **main** colour survives the duplicate slider at any setting.
- On the busy-print fixture, the slider (or the "use fewer colours" message) can take the chart from over 25% to under it, or says clearly that it can't. If the 1 to 12 range does not reach, it is extended (open question 3).
- The route recommendation changes with the slider and is never applied automatically.

---

## 7. F. Chart marks

- **Two view settings:** *Chart marks* (None or Letters) and *Duplicate stitch dots* (on or off). In the round view the defaults are Letters on and dots off. Both live in the View control.
- **Decrease marks** (the slash on a right-leaning decrease) are always shown in every view and export.
- **Close colours:** when the two main yarns are too close together (using the colour distance the app already computes for colourways), the app says so where the yarns are chosen, and turns Letters on with the note "On because your two colours are close". The knitter can still switch them off in the View control. The threshold is tuned on examples (open question 4).
- **Previews** (picture screen, Review's "hat laid flat") default to the solid-colour Picture view with a *Show marks* switch.
- **Downloads:** PDF, PNG and SVG exports offer **Include symbols**, ticked by default for the PDF (many people print in greyscale).
- The accessibility note and the release checklist change to say "charts show a letter in each cell by default, and it can be switched off".

---

## 8. E. Draw

- **Start:** the home card is replaced by a **How many colours?** choice (2 to 6) with the line "Two colours are knitted. Any more are added afterwards with duplicate stitch." Yarn names and colours are chosen inside the editor, not on the home screen.
- **Layers are visible,** not inside a collapsed section: swatches, the layer picker, Show toggles and *Add a duplicate stitch colour* sit beside the palette. The collapsed section keeps the crown notes.
- **Status chip:** a sticky chip over or under the grid, "Duplicate stitch 7.2% · 3 colours · 34 patches", turns amber above 10% and red above 25%. Tapping opens the same gauge and per-colour rows as section 6.3 (read only).
- **Advice** when it is a lot or too much matches the photo route: fewer colours, bigger areas, or stripes, with the rule of thumb that duplicate stitch suits small scattered accents and stripes suit big horizontal layers.
- **Show single squares:** a button highlights every single-square duplicate patch on the grid with a count, and a **Remove them** action (with Undo).
- **Tidy duplicate stitch:** remove duplicate patches smaller than N squares, for one colour or all, with a count preview and Undo.
- **Faces:** layers are created as "both faces" (as today, `edit.ts`). A per-layer **Worked on: both faces / outside only** option is added (open question 5).
- **Wide screens:** at 768 px and wider the tools sit in a vertical strip at the left of the grid.
- The existing checks section stays as the full list.
- **Phones:** Draw shows one line in context, "Drawing is easier on a tablet or computer. Make the chart there and bring it to your phone", with a **Save the chart file** and an **Import** reminder.

---

## 9. G. Smaller items

- **Pace planner** is kept for knit-alongs but demoted: it moves to the bottom of Steps as a collapsed "Plan your pace (optional)", so the steps come first and nobody sees a date form unless they open it. It is not offered during the swatch step and has no rest days. The round view shows its line only when a plan exists, as now. The standing text is reviewed so it never reads as blame.
- **Backups:** a gentle prompt at milestones (cast on done, round 75, round 95), and "Last backed up" on the Hat page. Buttons are renamed as in 4.1.
- **Hints:** a single tap-to-open hint component (not hover) for pair, colour block, wedge, seam and Chart A/B, closed by tap or Escape.
- **Footer:** the Ko-fi line shows only on Home, About, Settings and Hat.
- **Review wording:** "Check everything before you cast on" only in the design stage. In the knit stage the page reads "The chart for {name}".

---

## 10. Changes to the app spec

| Section | Change |
|---|---|
| 7.1 to 7.3 | Picture inputs and controls: one screen, direct framing, tiling, live palette (section 5). The "clean-up slider" becomes the duplicate-only amount control and the optional main-colour tidy (section 6). |
| 7.2 | "Duplicate stitch patches smaller than a minimum size are removed" applies per duplicate colour after the roles are chosen. The "Stray single cells" clean-up applies to main colours as an option. |
| 7.5 | Draw: start with a colour count, visible layers, status chip, tidy tools, tools strip (section 8). |
| 8 | Review reached from the Hat tab in the knit stage. Wording per stage. |
| 9.2 | Round view rewritten per section 3. The A and B parts are print only. |
| 13 | Print and export lives on the Hat tab. Include symbols option. |
| 14 | "Every colour also has a symbol" becomes "a letter in each cell by default, switchable, with decrease marks always shown". |
| 16 | Milestones: this work is v1.2, in the three phases of this spec. |
| 18 | Add decisions 14 to 19 (below). |

**Decisions to add to the app spec (section 18):**
14. The knit view is phone first; design stages are tablet and desktop first.
15. Chart A and B are print only; the app shows one 112-pair strip in a following window.
16. Crown blank columns are never collapsed.
17. Decrease marks are always shown.
18. The duplicate stitch amount control sets the smallest patch kept, per duplicate colour, with fine-tuning always visible.
19. Chart marks default to letters on and dots off while knitting, with a per-export symbols option.

---

## 11. Data, core and tests

- **Core:** tile maths (`frameBox`, `tileDraws`, a `tilePixels` helper) moves from `app/src/lib/crop.ts` into the core. The duplicate clean-up moves after role choice. New settings fields per 6.5. The chart file stays `doubletake-chart/1`: the new fields are inside `source.settings`, which older readers ignore.
- **Progress:** adds `notesSeen` (note ids seen per hat) and `lastBackupAt`. Older progress loads with both empty.
- **Settings:** adds `marks` (none or letters), `colourBlocks` (on or off), and keeps `showDuplicate`, `zoom` and `highContrast`.
- **Tests to update:** `tracker.spec` (round view), `a11y.spec` (marks and rail), `make.spec` (picture screen), `draw.spec`, `export.spec` (symbols option), `release.spec`, plus core generator tests, `skill/test/cli.test.ts` and `tools/parity.ts`. New tests: colour blocks match the text version on every round of both fixtures, window following, undo toast, duplicate slider monotonic and per-colour behaviour, tiling gives a seamless chart for divisors of 112.
- **Fixtures:** add a busy-print picture (more than 25% duplicate stitch at the old defaults) and a small repeating swatch.

### 11.1 Real-device checks to add to the release checklist
1. Knit three rounds on a phone in portrait with Next block, one round in landscape.
2. Drag the frame on a real phone, with the hat preview visible.
3. Use the duplicate stitch sliders with three duplicate colours on a phone.
4. Check the Hat tab and Settings gear on a phone and a tablet.

---

## 12. Phasing and gate

| Phase | Contents | Done when |
|---|---|---|
| **1** | A (round view), F (marks), C1 (live palette fix), page width and view control needed by the round view | The owner has knitted a few rounds on their phone and it works. This is the gate. |
| **2** | B (navigation, Home), C (picture screen, tiling), D (duplicate stitch amount, core change) | Acceptance criteria in 5.6 and 6.6 pass, parity is re-run. |
| **3** | E (Draw), G (smaller items) | Draw and G pass their checks. |

---

## 13. Open questions

1. **Name for Next block:** keep it, or use "Next colour", "Block done" or similar?
2. **Main-colour tidy default:** is removing single stray squares (smallest patch 2) the right default? Check on the leopard and two photographs before settling.
3. **Slider range:** is 1 to 12 squares enough to bring a busy picture under 25%? Test on the busy-print fixture, then extend (for example to 30) if not.
4. **Close-colours threshold:** the colour distance at which letters are switched on automatically. Tune on a few yarn pairs.
5. **Draw layer faces:** is the "outside only" option wanted in Draw, or should Draw stay both-faces?
6. **Window size:** the 24 to 30 pairs (portrait) and 40 to 50 (landscape) targets are guesses until the phone prototype.
7. **Carried over from the app spec:** yardage calibration, tutorial links, the jogless stripes method, the pattern PDF credit and links.

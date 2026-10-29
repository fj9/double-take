# Doubletake: build plan

Draft v0.1, 29 October 2026. Builds the app in `doubletake-app-spec.md` using the tokens in `style.md`.

## 0. Things to settle before starting

| # | Item | Why it blocks | My recommendation |
|---|---|---|---|
| 1 | ~~App name in the UI~~ | | **Decided:** Doubletake, one word (wordmark `doubletake`, `double` 300 and `take` 700). `style.md` updated to match |
| 2 | ~~Stack~~ | | **Decided:** Vite + TypeScript + Preact + Workbox (vite-plugin-pwa) + Vitest + Playwright |
| 3 | ~~Leopard source data~~ | | **Done:** converted from the old skill's CSVs to `fixtures/leopard/leopard.doubletake.json` by `tools/convert_leopard.py`; all checks pass. There is now one standard crown, which is not stored in the chart file |
| 4 | **Sample images and old skill outputs** (leopard photo, desert, Great Wave, transport fabric). | Parity tests for the new core | Needed before the generator is ported |
| 5 | Labels: the style guide has a `Front` / `Back` switch, the pattern says outside / inside. | Review and tracker UI | Outside / Inside, to match the pattern |
| 6 | Chart cell style: gridline weight, symbol set (open item in `style.md`). | Chart renderer | I propose a set in step 2.1 and you approve it |

## 1. Shape of the repo

```
core/      dependency-free TypeScript: constants, schema, validation, crown, patches,
           yardage (stub), generator steps. Runs in browser and Node. No DOM.
app/       the PWA (Vite). Imports core.
skill/     SKILL.md + one bundled JS file built from core (esbuild) + Node CLI wrapper.
fixtures/  leopard chart file, sample images, old-skill (Python) reference outputs.
```

Rules: `core` has no dependencies and no DOM or Node APIs. Each environment only decodes an image into raw pixels (browser: canvas; Node: a bundled decoder).

## 2. Phases

### Phase 1: core foundations (small, do first)
1. Hat constants and the crown table as data (pairs per round, decrease positions by wedge position).
2. Chart file types, parser and validation (spec 10.1 and 10.2), with specific error messages.
3. Patch finder: diagonals connect, wraps at pair 112/1, crosses body to crown, skips removed pairs.
4. Convert the leopard to `doubletake-chart/1` and store it as a fixture.
5. Tests: crown pair counts match the table (104 … 16), `.` positions match the decrease table, invalid files fail with the right error, patch cases (seam, diagonal, crown).

**Done when:** the leopard file validates, and every rule in 10.2 has a failing and a passing test.

### Phase 2: MVP app (the tracker)
1. Scaffold, tokens and fonts from `style.md` (bundled Josefin Sans, light and dark), PWA shell, GitHub Actions to test and deploy to Pages.
2. Chart renderer (canvas): cells at the knitted 1.36 : 1 proportion, colour plus symbol, 5-stitch and 5-round lines, removed pairs, decrease symbol, high-contrast option, zoom and pan.
3. Storage: projects and progress in IndexedDB, progress kept apart from the chart; request persistent storage.
4. Start screen, example (leopard), Import with validation (invalid file changes nothing).
5. Knit stage: steps list, round view (A then B, highlight, faded neighbours), counts, next / previous / undo, position marker, wake lock, notes at the right moment (9.3 except stripes).
6. Duplicate stitch tracker: patch list and map, one patch at a time, outside and inside (Inside view), ticks, count.
7. Progress and percent; About, footer and credits; text alternative for charts (row-by-row).
8. Offline: service worker, "update available" prompt that never reloads mid-round.

**Done when:** the MVP acceptance criteria in spec 17 pass in Playwright (offline reopen lands on the same round, bad import changes nothing, no network calls with an image or project), plus a manual run on iPhone and Android.

### Phase 3: v1 design routes (three tracks, can run in parallel after Phase 1)
- **3a. Editor, Draw and Review.** Editor on the 112 × 75 grid and crown (pencil, eraser, fill, picker, undo / redo, mirror and repeat that respect the wrap, layers, palette, underlay, live checks), project list, Review stage (charts, duplicate charts, crown, warnings, shopping list, yardage placeholder with its warning), chart file export.
- **3b. Generator port in core.** Palette check, k-means, clean-up, crop, seam (fade or accept), duplicate split, route A vs B comparison, stripe planner, crown generation, colourways. Seeded random generator, own resize and blur. **Parity tests** against the old Python outputs on the sample images, cell by cell.
- **3c. Generator UI.** Upload or camera, palette check screen, mode and colourway choice, route comparison table, sliders, crop with wrap preview, outside / inside / tube preview. Needs 3b and the editor from 3a.

### Phase 4: the Claude skill (done 29 October 2026)
1. Bundle `core` into one JS file with esbuild; a small Node CLI that decodes an image, calls core and writes the chart file and preview PNGs.
2. New `SKILL.md` for Doubletake (fixed hat, fixed gauge, no cowl or panel, no gauge questions), keeping the judging and talking workflow from the old skill.
3. Re-run the parity tests through the CLI, then retire the Python engine.
4. Package a download for the app's "Get the Claude skill" page.

### Phase 5: v1.1
Stripes mode in the UI and round view, jogless prompts, pace planner, PDF / PNG / SVG / CSV export (PDF from a print stylesheet).

### Phase 6: release
Hashtag and URL, About and changelog, Lighthouse and axe checks, 200% text and reduced-motion passes, device test list, test knits feeding yardage and the stripe wording.

## 3. Order and what can run together

```
Phase 1 ──┬─ Phase 2 (tracker, MVP) ───────────────┐
          ├─ 3a (editor, Draw, Review) ────────────┼─ 3c ─ Phase 4 (skill) ─ Phase 5 ─ Phase 6
          └─ 3b (generator port + parity) ─────────┘
```

Writers on the same files must not overlap: Phase 2 owns `app/` screens for tracking, 3a owns the editor and Review, 3b owns `core/generator`.

## 4. Testing

- **Unit (Vitest):** core rules, crown, patches, validation, generator steps.
- **Golden / parity:** old Python outputs for the sample images, compared cell by cell. Differences are explained or fixed before the Python is retired.
- **End to end (Playwright):** the MVP acceptance list, offline mode, invalid import, no network traffic with an image or project.
- **Accessibility:** axe in CI; manual screen-reader, 200% text, dark mode, reduced motion.
- **Manual:** install as a PWA on iPhone and Android; wake lock; camera capture; real knitting of a few rounds.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Safari can clear site data for sites not used for a while, which would lose a project mid-hat | Request persistent storage, prompt to install, regular "Back up your project" export, restore from file |
| Wake lock and camera behave differently between browsers and installed PWAs | Treat both as optional; test on devices early |
| Parity of the new core with the Python skill (seeds, resize, blur, floating point) | Own seeded random generator and resampling in core; parity suite from the start of 3b |
| Users stuck on an old version mid-hat | Update prompt, never reload mid-round, schema versioning and migration in the chart and progress files |
| Yardage numbers are guesses | Provisional constants behind one function, strong warning everywhere, calibrate after sample knitting |
| Drawing a 112 × 75 grid on a phone | Paint / pan toggle, big zoom, test on small screens in 3a before building more on it |

## 6. Not in the plan yet (waiting on you)

Yardage calibration (sample knitting), tutorial links, jogless stripes test knit, hashtag, repo name and URL, pattern credit, confirming the standard crown.

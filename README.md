# Doubletake

A free, installable web app for the **Doubletake** reversible double-knit beanie by [Freya'd Knot](https://www.ravelry.com/people/freyadknot). It makes a chart for the hat, checks it, and keeps your place while you knit. Everything stays on your device: there is no account, no server and no tracking.

- **Make a chart:** from a picture, by drawing on a pixel grid (with a picture to trace over), or with the Claude skill.
- **Review it:** the hat laid flat (outside and inside), duplicate stitch, the crown, and a shopping list.
- **Knit it:** round by round with the right chart half on screen, a duplicate stitch tracker, stripes with jogless prompts, a pace planner, and offline use.
- **Print and export:** A4 chart pages in house style, plus pictures (PNG, SVG), spreadsheets (CSV) and a shopping list.

The hat is one fixed design: 112 stitch pairs round, 75 body rounds and a 20-round crown, at 25 pairs and 34 rounds to 4 in (10 cm).

## Documents

| File | What it is |
|---|---|
| [`doubletake-app-spec.md`](doubletake-app-spec.md) | What the app does, the chart file format, and the decisions made |
| [`style.md`](style.md) | The interface style: colours, type, components, accessibility |
| [`build-plan.md`](build-plan.md) | How it was built, in phases |
| [`release-checklist.md`](release-checklist.md) | What is done and what is left before sharing it |

## How it is organised

```
core/      the shared engine (TypeScript, no dependencies): the hat, the chart file and its
           validation, the patch finder, the picture-to-chart generator, edits and checks
app/       the web app (Vite, Preact), using the core
skill/     the Claude skill: the core and a command line in one script, plus SKILL.md
fixtures/  the leopard example and a striped example
tools/     the leopard converter, the old Python engine (reference only) and a parity check
```

The app and the skill use the same core, so a picture gives the same chart in both.

## Running it

You need Node 20 or later.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. To build it (this also builds the Claude skill and its zip):

```bash
npm run build
```

## Testing

```bash
npm test
```

runs the unit tests for the core, the app and the skill. The end-to-end tests (a real browser: tracker, drawing, pictures, printing, offline use, accessibility) are:

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

## Deploying

The app is static and uses a hash for its pages, so it works from any folder on GitHub Pages with no setup beyond switching Pages on (Settings, Pages, Source: GitHub Actions). From a repository called `double-take` under `fj9` it is served at https://fj9.github.io/double-take/. `.github/workflows/ci.yml` tests every push and deploys `app/dist` from `main`.

## Licence, credits and copyright

The code is [MIT licensed](LICENSE). The leopard charts, the pattern text, and the Doubletake and Freya'd Knot names and branding are **not** covered by that licence: the leopard charts and the pattern are © Freya'd Knot, for personal use only (see [`fixtures/leopard/NOTICE.md`](fixtures/leopard/NOTICE.md)). The hat's construction follows the free Chrysanthemum hat by mirielgw.

Share your finished hat with **#doubletakehat**.

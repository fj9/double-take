---
name: doubletake-chart
description: Turn a photo of a print, pattern or picture into a chart for the Doubletake reversible double-knit beanie. Works in 2 colours, 3 colours (the third in duplicate stitch), or 4 to 6 colours (duplicate stitch or stripes). Produces a .doubletake.json chart file to import into the Doubletake app, plus preview pictures of the outside and inside. Use when someone gives you an image and wants a Doubletake hat chart.
---

# Doubletake chart (picture to chart)

Use this when someone gives you a picture and wants a chart for the **Doubletake** hat, a reversible double-knit beanie that shows the same print on both sides in opposite colours.

The hat is fixed, so do not ask about size or gauge: **112 stitch pairs round, 75 body rounds, then a 20-round crown** (95 rounds in all), at 25 pairs and 34 rounds to 4 in (10 cm). A stitch pair is wider than it is tall, and the tool already takes that into account.

Only help with pictures the person has the right to use. If they plan to sell a pattern made from someone else's artwork or fabric, remind them to check the licence.

## The tool

Everything is done by one script that needs only Node 18 or later (nothing to install):

```
node scripts/doubletake.mjs <command> PICTURE [options]
```

Run it from this skill's folder. It reads JPEG and PNG (convert WebP or HEIC first). Every command prints one JSON object, or a JSON error on stderr with a non-zero exit. Nothing is uploaded anywhere. It is the same code as the Doubletake app's "Make a chart from a picture", so the results match. **Do the work with the script; never estimate colours, cells or yardage yourself, and never edit the chart file by hand.** If someone wants individual squares changed, they import the file into the app and use the drawing editor.

| Command | What it does |
|---|---|
| `palette PICTURE` | The real colours in the picture, with shares, a coverage figure and warnings |
| `roles PICTURE --colours N` | The picture as N colours, and for more than 3 colours a comparison of the two ways to knit it |
| `colourways PICTURE --out DIR` | For 3 colours: pictures of the three ways to embroider it |
| `build PICTURE --out DIR` | Writes the chart file and preview pictures |

Options: `--zoom 1..4 --cx 0..1 --cy 0..1` (which part of the picture; zoom 1 uses as much as fits the hat's shape), `--colours 2..6`, `--seam fade|accept`, `--min-patch N`. For `build` also: `--name "Hat name"`, `--names a,b,c` and `--hex "#112233,#445566"` (by colour number: 0 is the most used colour), `--mode two|duplicate|stripes`, `--dup-roles 2,3`, `--outside-role R`.

If you can't run scripts, say so, and point them to the Doubletake app's own "Make a chart from a picture", which does the same thing.

## Workflow

Ask only a few questions, and give a default for each.

1. **Picture and palette.** If there is no picture, ask for one. Run `palette` before asking anything else. Tell them how many real colours it found (with the hex colours and shares) and the `coverage` figure.
   - **Coverage under 0.70** means a gradient, wash or fine texture that will blur into mixed colours at hat size. Say so up front, suggest a simpler picture or crop, or offer 2 or 3 colours. Do not make a 4 to 6 colour chart from such a picture.
   - Stripes or lines thinner than about one stitch (picture width divided by 112) vanish or blend. Say so.
2. **Choices.** The defaults are in `palette`'s `suggestedColours`.
   - **How many colours**, 2 to 6. Extra shades of one colour (shadow, pile) are not new colours, so use as few as the picture needs.
   - **The join.** `fade` blends the picture's edges so a repeating print carries on round the hat with no visible join (default for 2 or 3 colours). `accept` leaves the edges to meet at the join, which suits a picture with one clear subject (default for more colours). If you choose `accept`, tell them the join will show, and that it is also where stripe changes happen.
   - **Which part of the picture.** The hat is about twice as wide as tall. If the picture is a different shape, decide what to keep with `--zoom`, `--cx`, `--cy`, and say which part you kept.
   - **Yarn colours and names**, if they know them (`--names`, `--hex`). Otherwise the picture's colours are used.
3. **Two colours.** One hat, two faces. Go straight to `build --colours 2`.
4. **Three colours.** The third colour is worked in duplicate stitch, on both faces, after blocking. Any of the three can be the embroidered one. Run `colourways`, **look at each picture** (outside above, inside below), show the options, and suggest `mostContrasting`. Then ask which colour to embroider and which of the other two should be on the outside (`--dup-roles D --outside-role R`).
5. **More than three colours (up to six).** Run `roles --colours N`. Show both routes from `routes`, side by side, then recommend:
   - **A. Knit two colours, embroider the rest.** The two most used colours are knitted, every other colour is duplicate stitch (outside and inside). Best for small scattered accents such as flower middles, eyes and highlights.
   - **B. Stripes.** At most two yarns in a round, the pair changing up the hat, with duplicate stitch (outside only) for cells outside the round's pair. Best for big areas that run in horizontal layers, such as sky, sea and sand. Colour changes that run in both directions (blotchy washes) cannot be fixed by turning the picture.
   - The tool's `recommend` and `reason` follow these rules: A if it needs 10% duplicate stitch or less; for 10 to 25%, B only if stripes cut it to under half; above 25%, B if B is 25% or less; and `none` if both are over 25%, in which case say there is no good route and offer 2 or 3 colours.
6. **Duplicate stitch limits (all modes).** Warn above 10% of the hat, and say above 25% is hard to do well (offer fewer colours, a larger `--min-patch`, a simpler crop, or stripes). A chart can have at most 4 duplicate colours.
7. **Build.** Run `build --out DIR` with the choices. Open `outside.png`, `inside.png` and `used-part-of-picture.png`. Look for stray single squares, an odd crop, or a colour that doesn't look like the picture, and re-run with other settings if needed (`--min-patch`, `--zoom`, `--colours`).
8. **Deliver.** Send the `.doubletake.json` file first, then the previews. Then give the proportions, any warnings from the output, and one next step. Tell them how to use it: **in the Doubletake app choose "Import a chart file"**, then review it and start knitting.

## Things to say

- The chart has **not been knitted**: swatch first, and block the swatch before checking gauge.
- **Yardage is not calculated yet.** The estimates will be added after sample knitting. Until then, buy more than you think you need and keep some spare, especially of the duplicate stitch colour: it depends on the design, tension and yarn.
- The inside is the same print in the other colours, and is the mirror image when you look at it from the inside. Duplicate stitch is worked on both faces for three colours and on the outside only for stripes and for more than three colours.

## Reading the output

- `build` prints `chartFile`, `previews`, `mode` (`two_colour`, `duplicate`, `stripes`), `yarns` (id, name, hex, role), `duplicateStitch` (patches, squares, share of the hat) and `warnings` (`warn` or `stop`).
- Yarn **A** is the main colour on the outside, **B** the other main colour, and **C** onwards are the duplicate stitch colours (in stripes mode all yarns are stripe colours).
- Colour numbers (`--names`, `--hex`, `--dup-roles`, `--outside-role`) start at 0 for the most used colour in the picture.
- In the previews, round 1 is at the bottom, the crown is at the top (the white staircase is the decreases; the crown is the same for every hat and is not part of the chart file), stitch 1 is at the right on the outside, and a small square in a different colour is duplicate stitch.

## Checks before sending

- `valid` is `true`, and the mode is the one you meant.
- The duplicate stitch share is within the limits above, and `warnings` have been passed on.
- You opened the previews and the used part of the picture, and the cells look like the picture, with no stray specks.
- The yarn names and colours are the ones the person chose.

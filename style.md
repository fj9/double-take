# Doubletake style

Version 0.1 · 28 October 2026

The style guide for **Doubletake**, a Freya’d Knot app. It builds on the [Freya’d Knot house style](../style/freyad-knot-house-style.md) (midnight ink, one coral accent, Josefin Sans headings) and adds what an interactive app needs: screens, states, dark mode and motion. Where this file is silent, the house style applies.

**Status:** draft for a new app. Nothing here is built yet. Change the tokens first, then the components.

## 1. Principles

- **Two sides, one piece.** The name nods to double knitting, where every stitch shows one colour on the front and the other on the back. The UI leans on that pairing: midnight and coral, light and dark, front and back. Use it as a motif, not a gimmick.
- **Midnight leads, coral points.** Midnight carries text, buttons and structure. Coral marks the one thing to look at or do next.
- **Calm and legible.** People use this while their hands are busy. Big targets, high contrast, nothing that moves unexpectedly.
- **Never colour alone.** Every state also has a word, shape or icon.
- **Friendly but plain.** Warm, second person, knitter’s words, no filler.

## 2. Name and voice

| Item | Rule |
|---|---|
| App name | **Doubletake**, one word, capital D. Never `Doubletake`, `DoubleTake` or `Double-Take` in UI copy. Code and URLs may use `double-take` |
| Wordmark | `doubletake` in Josefin Sans, lowercase, `double` weight 300 and `take` weight 700, midnight. Same split-weight idea as pattern titles |
| Byline | `Made by Freya’d Knot` in the footer and the About screen, Josefin Sans bold, tracked `.06em`, muted |
| Tone | Second person, short, no jargon. “Add your colours”, not “Configure colour parameters” |
| Errors | Say what happened and what to do. “Couldn’t save. Check your connection and try again.” |
| Empty states | One friendly line and one button. “Nothing here yet. Start a new chart.” |

## 3. Colour

Same tokens as the house style, plus app-only roles. Light mode first, dark mode in section 4.

| Token | Hex | Use | Contrast on `--bg` |
|---|---|---|---|
| `--ink` | `#1b2a41` | Headings, links, primary buttons, active tab | 14.4:1 |
| `--coral` | `#f26b5b` | Accent: focus ring, selection edge, progress, highlights | 3.0:1 (non-text only) |
| `--text` | `#111111` | Body text | 18.9:1 |
| `--muted` | `#59616e` | Secondary text, captions | 6.3:1 |
| `--line` | `#d6dae1` | Dividers, card borders, dashed stitch lines | non-text |
| `--wash` | `#eef0f4` | Quiet fills, selected rows, placeholders | n/a |
| `--bg` | `#ffffff` | Screen background | n/a |
| `--card` | `#ffffff` | Cards and sheets (with a `--line` border) | n/a |
| `--error` | `#b3261e` | Errors and “behind” states, always with words | 6.5:1 |
| `--success` | `#1f7a4d` | Saved, complete, always with words | 5.4:1 |

### Yarn colours

The two yarn colours a person picks in the app are **content**, not brand. They can be any colour, so:

- Never tint the interface with the chosen yarn colours. Show them only in swatches, charts and previews.
- Give every swatch a 1 px `--line` outline (`--ink` at 40% in dark mode) so pale colours stay visible on pale backgrounds.
- Label the two yarns **Colour A** and **Colour B** (or the names the user gave them) everywhere. Never rely on the swatch alone.

### Rules

- Coral is never body or label text on white (3.0:1). No white text on coral. If a coral fill is needed, put midnight text on it (4.8:1).
- Coral is not an error colour. Use `--error` for problems.
- Text contrast at least 4.5:1, interface edges and icons at least 3:1.

```css
:root {
  --ink: #1b2a41;
  --coral: #f26b5b;
  --text: #111111;
  --muted: #59616e;
  --line: #d6dae1;
  --wash: #eef0f4;
  --bg: #ffffff;
  --card: #ffffff;
  --error: #b3261e;
  --success: #1f7a4d;
  --coral-wash: color-mix(in srgb, var(--coral) 12%, #fff);
  --focus: 3px solid var(--coral);
  --stitch: 0.3mm dashed var(--line);
}
```

## 4. Dark mode

Follow the system setting by default, with a manual override in Settings (System, Light, Dark). Dark mode is the “other side” of the same piece, so keep the same structure and swap the tokens.

| Token | Dark value | Check |
|---|---|---|
| `--bg` | `#0f1826` | |
| `--card` | `#16233a` | |
| `--ink` (headings, links) | `#e8edf5` | 15.2:1 on `--bg` |
| `--text` | `#f2f4f8` | 16.5:1 on `--bg` |
| `--muted` | `#9aa6b8` | 7.2:1 on `--bg`, 6.4:1 on `--card` |
| `--line` | `#2a3a55` | non-text, dividers only |
| `--wash` | `#1d2c46` | |
| `--coral` | `#f26b5b` | 6.0:1 on `--bg`, so it may also be used for text in dark mode |
| `--error` | `#f2867d` | 6.8:1 on `--bg` |
| `--success` | `#5cc08a` | 8.0:1 on `--bg` |
| Primary button | fill `#e8edf5`, text `#0f1826` | 15.2:1 |

## 5. Typography

| Role | Font | Weight | Size | Notes |
|---|---|---|---|---|
| Wordmark | Josefin Sans | 300 + 700 | 28 px in the header, 48 px on the welcome screen | Lowercase, split weight |
| Screen title (h1) | Josefin Sans | 700 | 28 px / 1.15 | Sentence case |
| Section heading (h2) | Josefin Sans | 700 | 20 px / 1.2 | Sentence case |
| Subheading (h3) | Josefin Sans | 700 | 16 px / 1.25 | Sentence case |
| Body | System UI | 400 | 16 px / 1.5 | Never below 16 px for text people read while knitting |
| Secondary | System UI | 400 | 14 px / 1.45 | Muted |
| Button | Josefin Sans | 700 | 16 px | Sentence case |
| Numbers (row, stitch count) | System UI, tabular numerals | 700 | 18 px or larger | `font-variant-numeric: tabular-nums` |
| Legal and captions | System UI | 400 | 12 px | Muted, never for essential information |

```css
:root {
  --font-display: "Josefin Sans", "Avenir Next", "Century Gothic", system-ui, sans-serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- Josefin Sans is SIL Open Font License, so it can be bundled. Install with `npm i @fontsource/josefin-sans` (weights 300, 400, 700) and ship the files with the app. Do not load fonts from a CDN.
- Use sentence case for all interface text. The lowercase display style is for the wordmark only.
- Respect the user’s text-size setting. Layouts must survive 200% scaling without clipping.

## 6. Layout and spacing

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px. Nothing between steps.
- **Screen padding:** 16 px on phones, 24 px on tablets, content max width 720 px and centred.
- **Radius:** 8 px for inputs and buttons, 12 px for cards and sheets, 99 px for pills and chips.
- **Touch targets:** at least 44 × 44 px, with 8 px between neighbours.
- **Elevation:** use borders (`1px solid var(--line)`), not shadows. One soft shadow is allowed on sheets that overlay content.
- **Navigation:** a bottom tab bar on phones, a left rail on tablets and desktop. Four tabs at most.
- **Footer:** on every screen except full-screen tools. See section 9.

## 7. Components

| Component | Spec |
|---|---|
| Primary button | Midnight fill, white text, 48 px high, 8 px radius, full width on phones. One per screen |
| Secondary button | White fill, 1.5 px midnight border, midnight text |
| Text button | Midnight, bold, underlined with a coral line (2 px, offset 3 px) |
| Destructive button | `--error` text and border on white. Always confirm with a sheet that names what will be lost |
| Focus ring | 3 px coral outline with 2 px offset on every interactive element. Never remove it |
| Card | `--card` fill, 1 px `--line` border, 12 px radius, 16 px padding |
| Dashed divider | `0.3mm dashed var(--line)` between list rows. This is the stitching motif, use it for lists and not for decoration |
| Pill | 99 px radius, 1.5 px midnight outline, white fill, 12 px bold. Used for state labels such as `Front` and `Back` |
| Selected item | `--wash` fill with a 4 px coral left edge and a tick icon. The tick and the word “Selected” are in the accessible name |
| Colour swatch | 40 px circle, 1 px outline, with the colour’s name beside it. Selected swatch gets a 3 px coral ring |
| Front and back switch | Two-segment control labelled `Front` and `Back`. The active segment is midnight with white text |
| Progress bar | 8 px high, `--wash` track, midnight fill, with the figure written out (“Row 24 of 60”) |
| Input | 48 px high, 1.5 px `--line` border, midnight border and coral focus ring on focus. Label above, never placeholder-only |
| Toast | Bottom, `--ink` fill, white text, 4 seconds, with an Undo button for anything destructive |
| Empty state | Centred line of text, one primary button, optional line drawing in `--line` and `--ink` |

## 8. Motion and feedback

- Keep it short: 150 ms for state changes, 250 ms for sheets and screens, ease-out.
- A flip between `Front` and `Back` may use a 250 ms horizontal flip. Fade instead when the user has reduced motion on.
- Respect `prefers-reduced-motion`: no flips, slides or parallax, only fades.
- Never auto-play or loop animation.
- Confirm saves quietly (a tick and “Saved” in `--success`), not with a modal.
- Haptics, where available, only for completing a row and for errors.

## 9. Links and footer

Use the canonical Freya’d Knot URLs. Show the footer on every screen except full-screen tools.

| Platform | URL | Shown as |
|---|---|---|
| Ravelry | https://www.ravelry.com/people/freyadknot | Ravelry |
| Instagram | https://www.instagram.com/freyaj9/ | Instagram |
| GitHub | https://github.com/fj9 | GitHub |
| Ko-fi | https://ko-fi.com/fjnine | Ko-fi |

- Order: About, Ravelry, Instagram, GitHub, Ko-fi. Footer line: `Made by Freya’d Knot`.
- Tip jar copy, without apology: `Enjoying Doubletake? Tips on Ko-fi are always appreciated.`
- No Twitter/X anywhere.

## 10. Accessibility

- WCAG 2.2 AA as the floor.
- Every control has an accessible name. Icons that stand alone get a text label or `aria-label`.
- Colour is never the only signal: pair it with a word, icon or shape (see yarn colours above).
- Full keyboard and screen-reader support. Focus order follows reading order.
- Charts have a text alternative: row-by-row instructions, not just an image.
- Language `en-GB`. Dates as `28 October 2026`.
- Test at 200% text size, in dark mode and with reduced motion on.

## 11. Using this in prompts

Paste this block into a prompt or skill when asking Claude to build Doubletake screens:

```text
Follow the Doubletake style in style.md, which builds on the Freya’d Knot house style.
- App name: Doubletake. Wordmark "doubletake" lowercase, Josefin Sans, "double" 300 and "take" 700.
- Colours: midnight #1b2a41 for text, buttons and links; coral #f26b5b only as an accent (focus ring, selection edge, progress), never as text on white; separate red #b3261e for errors.
- Fonts: Josefin Sans for headings and buttons, system UI for body at 16 px minimum. Sentence case.
- Midnight and coral are the "two sides" motif. Yarn colours are content and never tint the interface.
- Cards have a 1 px border and no shadow. Dashed dividers between list rows. 44 px touch targets.
- Support light and dark mode, reduced motion and 200% text size.
- Footer: About, Ravelry, Instagram, GitHub, Ko-fi, then "Made by Freya’d Knot". No Twitter/X.
- Tone: warm, plain, second person.
```

## Open items

- Confirm what Doubletake does (this draft assumes a double-knitting chart and row tracker).
- App icon and splash screen.
- Chart grid style: cell size, gridline weight, symbol set.
- Whether the welcome screen shows the Freya’d Knot name beyond the footer.

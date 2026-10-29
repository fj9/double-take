# Doubletake: release checklist

Status on 29 October 2026. Everything marked **Done** is built and tested. The rest needs you, or a real device.

## Done and tested

- [x] **Works offline** once loaded, and reopens on the same round (tested with the network switched off).
- [x] **Installable:** manifest, icons (192, 512, maskable, Apple touch icon) and a service worker (tested).
- [x] **Private:** nothing is sent to any other site on any screen, with or without a picture (tested). No analytics, no account.
- [x] **Safe updates:** a new version waits until you choose to update, and never reloads mid-round.
- [x] **No lost taps:** progress and unsaved drawings are saved at once, so a quick reload or closing the app can't lose the last change (tested).
- [x] **Accessibility (WCAG 2.2 AA):** automated checks on every screen in light and dark mode; every control reachable by keyboard with a visible focus ring; touch targets at least 44 px; reduced motion removes all animation; 200% text size with no sideways scrolling; charts have a text version.
- [x] **Brand and voice:** Josefin Sans bundled (no font CDN), midnight and coral, sentence case, the Freya'd Knot footer on every screen but the tools.
- [x] **Print:** A4 chart pages print one chart to a page (tested by printing to PDF).
- [x] **Claude skill:** builds into one script, works from a fresh unzip, and matches the app cell for cell.
- [x] **Decisions:** name Doubletake; hashtag #doubletakehat; repository `double-take`; code under MIT; leopard charts and pattern stay personal use.

## Needs you

- [ ] **Yardage.** Sample-knit one two-colour and one duplicate stitch hat, then give me the real yarn used so the estimates can be added. Until then the app says "Yardage isn't calculated yet. Buy more than you think you need."
- [ ] **Tutorial links.** Choose a tutorial for each (cast on, double knitting in the round, right-leaning decrease, duplicate stitch, jogless stripes) and send me the addresses. They go in `HELP` in `app/src/content.ts`; a "Watch the tutorial" link appears wherever one is filled in.
- [ ] **Jogless stripes.** Test-knit the lifted-stitch method and correct the wording. The app labels it "a draft that is still to be test-knit" until then.
- [ ] **Pattern PDF.** It has no credit to the Chrysanthemum hat by mirielgw. The app's About page and chart pages do.
- [ ] **Pattern PDF links.** The "make your chart" section still says "[Link to the app and chart skill to come]". The addresses will be https://fj9.github.io/double-take/ and https://fj9.github.io/double-take/#/skill once it's published.
- [ ] **Pattern PDF yardage line.** It says "have a little extra" of the duplicate stitch colour. The app says to buy more than you think you need. You may want to match them.
- [ ] **App icon.** The icon is a placeholder (two overlapping discs). Replace the files in `app/public` (and `app/scripts/make-icons.mjs` if you want to regenerate them).
- [ ] **Update the pattern PDF for the standard crown.** There is now one crown, with no patterned or plain choice: use `pattern-editor-prompt.md`.
- [ ] **Confirm the crown.** It is yarn A outside and B inside from round 76, as in your pattern's plain crown. Say if you would rather it carry a little of the print first.

## Test on real phones (about 20 minutes)

I can't do these from here. Please try them on an iPhone (Safari) and an Android phone (Chrome).

**Install and open**
1. Open the web address, then add it to the home screen (iPhone: Share, Add to Home Screen; Android: the browser's Install app).
2. Open it from the home screen. It should open full screen with no browser bars, and the icon and name should look right.
3. Switch on aeroplane mode, close the app, and open it again. It should still load.

**Knit**
4. Start the leopard example. Tap **Round 1 done, next** a few times. Close the app completely, reopen it: you should be on the same round.
5. Is the chart readable at the default size? Try the zoom buttons and a two-finger pinch.
6. Tap a square to mark where you are. Does the marker land where you tapped?
7. Leave the screen alone for a minute while on the round view. Does the screen stay awake?
8. Is the bottom bar (Previous, Undo, Round done) comfortable to use one-handed?
9. Open the **Stitch** tab. Pick a patch, switch to Inside view, mark both faces done.

**Make**
10. On **Make a chart from a picture**, tap **Take a photo** and take a picture of a pattern. Do the colours look right? Try a photo taken in portrait (it should come out the right way up).
11. On **Draw your own chart**, paint with a finger in **Draw** mode, then switch to **Move around** and scroll. Does painting feel accurate? Is the Draw / Move around toggle clear?
12. Add a picture to trace over and zoom it out to repeat it.

**Print and share**
13. Open **More**, then **Chart pages (PDF)**, then **Print or save as PDF**. Can you save a PDF, and does each chart fit one page?
14. **Download everything (zip)**. Can you open the zip on the phone?
15. Switch the phone to dark mode and to a larger text size. Is everything still readable?

Write down anything that felt wrong, with the model of phone.

## Publish (when you're ready)

Nothing here has been run for you: publishing is outward-facing, so tell me when to go.

```bash
gh repo create fj9/double-take --public --source=. --remote=origin
```

```bash
git push -u origin main
```

Then, in the repository on GitHub: **Settings, Pages, Source: GitHub Actions**. The workflow in `.github/workflows/ci.yml` runs the tests and deploys. After a minute the app is at https://fj9.github.io/double-take/. Open it on a phone and install it.

Before pushing, check that no personal files are in the repository (`git status` and `git log --stat`). The `skill/dist` and `app/public/skill` folders are generated and are ignored.

## After launch

- Add the real tutorial links and yardage estimates, and bump the version in `app/src/content.ts` (with a line in `CHANGELOG`).
- Put the app address in the pattern PDF and on Ravelry.
- Share the Claude skill zip from the app's **Get the Claude skill** page.

# Prompt for the pattern editor: the crown fades to one colour

Paste everything inside the box into your pattern editor (the Claude session that works on `freyad-knot-patterns/double-take/pattern.md` and `charts.pdf`).

```text
I'm changing how the Doubletake hat's crown works, and I need the pattern updated to match. Please read this whole message first, then make the changes, then tell me exactly what you changed.

WHAT CHANGED

The hat no longer has a choice of crowns. There is no "patterned crown" and no "plain crown" any more. There is just "the crown", and it works the same way for every chart:

- Rounds 76 to 95, 20 rounds, in eight identical wedges of 14 pairs, with the same right-leaning decreases as before. The decrease table (pairs and needle stitches by round) does not change.
- The print carries on into the first rounds of the crown, but it fades out. It thins out round by round and is gone by round 85. From round 85 to round 95 the crown is one colour: the first main colour (purple in the leopard example) on the outside and the second (pink) on the inside. The leopard's last print is in round 82.
- If the chart has duplicate stitch, the duplicate stitch stops where the print stops, so any duplicate stitch in the crown is in rounds 76 to 84 only.
- If a chart has stripes, the crown is one colour from round 76, in the two colours of the top stripe.
- A knitter who designs their own chart can draw print up to the very top of the crown if they want to. This makes the knitting more complicated, because the rounds are short and the decreases move across the pattern, but it can be done. The chart pages show whatever the chart has.
- The word "plain" should not be used for the crown anywhere. Do not describe the crown as an option or as the "standard" one. It is simply the crown.

The Doubletake app has been updated the same way. Its chart pages are: a "how to read the charts" page, then Chart A, Chart B, Duplicate stitch A, Duplicate stitch B, Crown A, Crown B, Crown duplicate stitch A, Crown duplicate stitch B (the last two only when the chart has duplicate stitch in the crown, which the leopard does).

WHAT TO DO IN pattern.md

1. In the front matter, change charts.pages from the current seven (Chart A, Chart B, Duplicate stitch A, Duplicate stitch B, Patterned crown, "Patterned crown: duplicate stitch", Plain crown) to eight: Chart A, Chart B, Duplicate stitch A, Duplicate stitch B, Crown A, Crown B, Crown duplicate stitch A, Crown duplicate stitch B. Keep the same builder conventions for titles and page numbers.

2. In the "crown" instructions section, replace this:
   "Work the crown charts that go with your chart, rounds 76–95. Work the crown charts the same way as the body."
   and this:
   "The example has a choice of two crowns: the patterned crown (the leopard print carries on through the decreases) or the plain crown (purple outside, pink inside)."
   with a single short paragraph in the same voice, along these lines:
   "Work Crown A then Crown B for each round, from round 76 to round 95, the same way as the body. The print carries on into the first rounds of the crown and fades out, so from round 85 the crown is one colour: your first main colour (purple in the example) on the outside and your second (pink) on the inside. Work any duplicate stitch in the crown after blocking, with the rest. If your chart has stripes, the crown is one colour in the two colours of the top stripe."
   Keep the note box about the / decrease symbol, the blank space, and the eight wedges, and keep the decrease table exactly as it is.

3. In "good to know", after the sentence about every chart having the same size, add: "The crown is the same shape for every chart."

4. In the "duplicate stitch" section, add one sentence: "The print fades out over the crown, so duplicate stitch stops by round 84." Check that it doesn't say the crown has none, and that it doesn't mention a "patterned crown" or "plain crown".

5. Search the whole file for "patterned", "plain crown", "crown charts", "two crowns" and "plain", and remove or reword anything left over so that no sentence describes a choice of crowns. Check the alt text and captions for the two preview photos as well.

6. Check that the intro paragraphs still read correctly. The leopard example is still a three-colour print: purple and pink knitted, with the blue spot centres added in duplicate stitch after knitting.

WHAT TO DO FOR THE CHARTS AND IMAGES

7. Replace charts.pdf with the new chart pages exported from the Doubletake app (More, then "Chart pages (PDF)", then Print, then Save as PDF, for the Leopard example). Use its pages for Chart A, Chart B, Duplicate stitch A, Duplicate stitch B, Crown A, Crown B, Crown duplicate stitch A and Crown duplicate stitch B, and leave out its first "how to read the charts" page, because the pattern has its own. Make sure the page numbers in charts.pages match, and that the footer handling (wipe_old_footer_mm) still works with the new pages.

8. Replace img/outside.png and img/inside.png with the ones from the app's "Download everything (zip)" for the Leopard example, because the top of the hat has changed: the leopard print now fades out over the crown.

9. Rebuild the PDF. Check the page count, that no page is blank or split, that every chart page shows its page number, that the Ravelry, Instagram and Ko-fi links still work on every page, and that nothing is cut off at the edge of a chart.

IMPORTANT

- Do not change anything that isn't listed here. Keep the existing voice, headings and house style.
- If anything in the builder stops you from doing this exactly, stop and tell me, rather than working around it.
- When you finish, give me a list of every sentence you changed (old and new), the new page order, and anything you weren't sure about.

OPTIONAL: only do these if I say yes afterwards, and list them separately

a. The "make your chart" section still has a placeholder link. Once the app is published it will be at https://fj9.github.io/double-take/ (with the Claude skill page at https://fj9.github.io/double-take/#/skill) and the hashtag for sharing is #doubletakehat. Draft the one or two sentences that use these, and show me before changing the file.
b. "Yardages are estimates... have a little extra of that colour" is softer than the app, which says "Buy more than you think you need and keep some spare". Suggest wording that matches.
c. The intro says "Use the Freya'd Knot chart skill". The app and the skill are now called Doubletake. Suggest wording that matches.
d. The pattern has no credit to the free Chrysanthemum hat by mirielgw, which the hat's construction follows. Suggest where a credit could go.
```

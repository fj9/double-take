import { LAST_ROUND, yarnsInRound } from "@doubletake/core";
import type { Chart } from "@doubletake/core";

/** Tutorial links. Left empty until the tutorials are chosen (spec open question 4): empty means no link is shown. */
export const HELP: Record<"caston" | "doubleknit" | "decrease" | "duplicate" | "jogless", string | null> = {
  caston: null,
  doubleknit: null,
  decrease: null,
  duplicate: null,
  jogless: null,
};

export const LINKS = [
  { name: "Ravelry", url: "https://www.ravelry.com/people/freyadknot" },
  { name: "Instagram", url: "https://www.instagram.com/freyaj9/" },
  { name: "GitHub", url: "https://github.com/fj9" },
  { name: "Ko-fi", url: "https://ko-fi.com/fjnine" },
];

export interface Note {
  id: string;
  title: string;
  body: string;
  help?: keyof typeof HELP;
}

const yarnName = (chart: Chart, id: string) => chart.yarns.find((y) => y.id === id)?.name ?? id;
const samePair = (a: [string, string], b: [string, string]) => a[0] === b[0] && a[1] === b[1];

/**
 * Notes for a striped chart. A stripe changes at the start of a round, at the marker. On the first round of
 * the new stripe it is worked as normal; on the second round, the jogless step hides the step at the join.
 */
export function stripeNotes(chart: Chart, round: number): Note[] {
  if (chart.mode !== "stripes" || round < 2 || round > 75) return [];
  const pair = yarnsInRound(chart, round);
  const before = yarnsInRound(chart, round - 1);
  const notes: Note[] = [];
  if (!samePair(pair, before)) {
    const [a, b] = pair.map((id) => `${yarnName(chart, id)} (${id})`);
    notes.push({
      id: "stripe-change",
      title: "New stripe",
      body: `Change colours at the start of the round, at the marker. This stripe uses ${a} and ${b}. Work the round as normal, including the first stitch pair. Weave in ends between the layers later.`,
      help: "jogless",
    });
  }
  const twoBack = round >= 3 ? yarnsInRound(chart, round - 2) : null;
  if (twoBack && samePair(before, pair) && !samePair(twoBack, before)) {
    notes.push({
      id: "stripe-jogless",
      title: "Jogless step (second round of the stripe)",
      body: "Before you work the first stitch pair, lift the old-colour stitch from the round below, on the knit face, and knit it together with the first knit stitch. Do the same on the purl face: lift the stitch below, on the purl face, and purl it together with the first purl stitch. Then work the rest of the round as normal. Tighten the first few stitches a little. Your stitch count does not change. This method is a draft that is still to be test-knit.",
      help: "jogless",
    });
  }
  return notes;
}

/** Notes shown at the right moment while knitting (spec 9.3). */
export function notesForRound(round: number, chart?: Chart): Note[] {
  const notes: Note[] = chart ? stripeNotes(chart, round) : [];
  if (round === 1) {
    notes.push({
      id: "first-round",
      title: "Before you join",
      body: "Place your marker for the start of the round and check the stitches aren’t twisted before you join. Slip the marker at the start of every round.",
      help: "caston",
    });
  }
  if (round === 76) {
    notes.push({
      id: "crown-start",
      title: "The crown starts",
      body: "A square marked / is a right-leaning decrease. Work it over that pair and the pair just before it (the blank space on its right). The new pair takes the colour shown. A blank space means there is no stitch there. The crown is eight identical wedges of 14 pairs, each decreasing in the same places.",
      help: "decrease",
    });
  }
  if (round === LAST_ROUND) {
    notes.push({
      id: "last-round",
      title: "Last round",
      body: "After this round there are 16 stitch pairs (32 stitches) left. Next, finish the crown.",
    });
  }
  return notes;
}

export const FINISHING_TEXT =
  "Break both yarns, leaving 8 in (20 cm) tails. Thread one tail through all the knit stitches (outside) and slip them off the needle. Thread the other tail through all the purl stitches (inside) and slip them off. Pull both tails to close the crown, then weave in the ends separately.";

export const BLOCKING_TEXT =
  "Wash gently, then block flat, smoothing the hat and shaping the crown by hand. Leave to dry completely.";

export const DUPLICATE_TIPS = [
  { title: "Needle and tension", body: "Use a blunt tapestry needle so it glides under the loops without splitting the yarn. Don’t pull too tight: duplicate stitch sits on top of your live stitches, and pulling it taut squashes them and puckers the motif." },
  { title: "Follow the V", body: "Bring the needle up from the back at the base of the V, between the two legs of the stitch below. Pass it horizontally behind both legs of the stitch above. Go back down through the same hole where you started." },
  { title: "Order of work", body: "Work in straight rows or columns, row by row is usually the most intuitive. Treat each separate shape as its own mini-project: finish a small shape with one strand, or weave your starting and ending tails in between the layers behind that motif before you move on. Don’t carry yarn across blank spaces." },
  { title: "Ends", body: "Leave a few inches of tail and weave them in between the layers, following matching colours. Avoid knots, which make bumps. If you run out of yarn, finish the current stitch, weave the tail in securely, and start the new strand fresh from between the layers." },
];

export const DUPLICATE_INTRO =
  "Work this after blocking. Thread a blunt needle with about 20 in (50 cm) of the duplicate stitch colour. Cover each square of a patch with a duplicate stitch over the stitch in the same position. Keep the needle within the layer you are working on and do not catch the other side. Finish one patch at a time and weave the ends in between the layers.";

export const APP_VERSION = "0.1.0";
export const CHANGELOG = [{ version: "0.1.0", date: "29 October 2026", notes: "First version: the leopard example, chart import, the round-by-round tracker and the duplicate stitch tracker." }];
export const HASHTAG: string | null = null; // to be chosen (spec open question)

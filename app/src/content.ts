import { LAST_ROUND } from "@doubletake/core";

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

/** Notes shown at the right moment while knitting (spec 9.3). Stripe notes come with stripes mode. */
export function notesForRound(round: number): Note[] {
  const notes: Note[] = [];
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

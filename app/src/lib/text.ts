import { CHART_A_LAST_PAIR, PAIRS, crownLayout, outsideAt, FIRST_CROWN_ROUND } from "@doubletake/core";
import type { Chart } from "@doubletake/core";

export interface RoundText {
  /** “Chart A, pairs 1–56” */
  heading: string;
  /** “purple × 5, pink × 3, pink (decrease) × 1 …” in the order worked. */
  runs: string;
}

/** A text version of one half of a round, in the order it is worked, for people who can’t use the chart image. */
export function roundText(chart: Chart, round: number, part: "A" | "B"): RoundText {
  const lo = part === "A" ? 1 : CHART_A_LAST_PAIR + 1;
  const hi = part === "A" ? CHART_A_LAST_PAIR : PAIRS;
  const marked = round >= FIRST_CROWN_ROUND ? crownLayout(round).marked : null;
  const runs: { label: string; n: number }[] = [];
  for (let pair = lo; pair <= hi; pair++) {
    const id = outsideAt(chart, round, pair);
    if (id === null) continue; // removed by a decrease: no stitch
    const yarn = chart.yarns.find((y) => y.id === id)?.name ?? id;
    const label = marked?.[pair - 1] ? `${yarn} (right-leaning decrease)` : yarn;
    const last = runs[runs.length - 1];
    if (last && last.label === label && !marked?.[pair - 1]) last.n++;
    else runs.push({ label, n: 1 });
  }
  const worked = runs.reduce((n, r) => n + r.n, 0);
  return {
    heading: `Chart ${part}, pairs ${lo}–${hi}`,
    runs:
      runs.map((r) => `${r.label} × ${r.n}`).join(", ") +
      (worked < hi - lo + 1 ? ` (${hi - lo + 1 - worked} pairs here are already decreased away: skip the blanks)` : ""),
  };
}

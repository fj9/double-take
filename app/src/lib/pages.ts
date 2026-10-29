import { BODY_ROUNDS, CHART_A_LAST_PAIR, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { chartSvg } from "./svg";

export interface PrintPage {
  id: string;
  /** Lowercase heading in house style. */
  title: string;
  meta: string;
  legend: { hex?: string; letter?: string; text: string }[];
  svg: string;
}

const descending = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i);
const A_COLS = descending(CHART_A_LAST_PAIR, 1);
const B_COLS = descending(PAIRS, CHART_A_LAST_PAIR + 1);
const BODY_ROWS = descending(BODY_ROUNDS, 1);
const CROWN_ROWS = descending(LAST_ROUND, FIRST_CROWN_ROUND);

const ys = (chart: Chart) => chart.yarns.filter((y) => y.role !== "duplicate");

function anyDuplicate(rows: string[]): boolean {
  return rows.some((r) => r.includes("1"));
}

/** The chart pages, as in the pattern: body A and B, duplicate stitch A and B, then the crown the same way. */
export function chartPages(chart: Chart): PrintPage[] {
  const pages: PrintPage[] = [];
  const read = "Read every round from right to left, starting at round 1 at the bottom. Heavy lines mark every 5th stitch and round.";
  const mainKey = ys(chart).map((y) => ({ hex: y.hex, letter: y.id, text: `${y.name}: knit ${y.name}, purl the other` }));
  const stripeKey = ys(chart).map((y) => ({ hex: y.hex, letter: y.id, text: y.name }));
  const key = chart.mode === "stripes" ? stripeKey : mainKey.slice(0, 2).map((k, i) => ({ ...k, text: `${(ys(chart)[i] as { name: string }).name} on the outside` }));
  const dupKey = (li: number) => {
    const l = chart.duplicate[li];
    const y = chart.yarns.find((yy) => yy.id === l?.yarn);
    return [{ hex: y?.hex, letter: y?.id, text: `Duplicate stitch in ${y?.name ?? ""}, ${l?.faces === "outside" ? "outside only" : "both faces"}` }, { text: "Leave as knitted" }];
  };

  const body = (part: "A" | "B") => {
    const cols = part === "A" ? A_COLS : B_COLS;
    const lo = part === "A" ? 1 : CHART_A_LAST_PAIR + 1;
    const hi = part === "A" ? CHART_A_LAST_PAIR : PAIRS;
    return {
      id: `body-${part}`,
      title: `chart ${part}`,
      meta: `Rounds 1–${BODY_ROUNDS}, stitches ${lo}–${hi}. ${read}${part === "B" ? " Work after Chart A." : ""}`,
      legend: key,
      svg: chartSvg({ chart, cols, rows: BODY_ROWS, label: `Chart ${part}, rounds 1 to ${BODY_ROUNDS}, stitches ${lo} to ${hi}` }),
    } satisfies PrintPage;
  };
  pages.push(body("A"), body("B"));

  chart.duplicate.forEach((layer, li) => {
    if (!anyDuplicate(layer.body)) return;
    const name = chart.yarns.find((y) => y.id === layer.yarn)?.name ?? layer.yarn;
    for (const part of ["A", "B"] as const) {
      const cols = part === "A" ? A_COLS : B_COLS;
      pages.push({
        id: `dup-${li}-${part}`,
        title: `duplicate stitch ${part}`,
        meta: `${name}, rounds 1–${BODY_ROUNDS}, stitches ${part === "A" ? "1–56" : "57–112"}. Cover each coloured square ${layer.faces === "outside" ? "on the outside" : "on both faces"}.`,
        legend: dupKey(li),
        svg: chartSvg({ chart, cols, rows: BODY_ROWS, onlyLayer: li, label: `Duplicate stitch in ${name}, chart ${part}` }),
      });
    }
  });

  const crownMeta = (part: "A" | "B") => `Rounds ${FIRST_CROWN_ROUND}–${LAST_ROUND}, stitches ${part === "A" ? "1–56" : "57–112"}. Work ${part === "A" ? "A then B" : "after A"} each round. The small grey number is the number of stitch pairs left at the end of that round.`;
  const crownKey = [...key, { letter: "/", text: "right-leaning decrease: work over this pair and the pair just before it (the blank space on its right)" }];
  for (const part of ["A", "B"] as const) {
    pages.push({
      id: `crown-${part}`,
      title: `${chart.crown.variant === "plain" ? "plain" : "patterned"} crown ${part}`,
      meta: crownMeta(part),
      legend: crownKey,
      svg: chartSvg({ chart, cols: part === "A" ? A_COLS : B_COLS, rows: CROWN_ROWS, counts: true, label: `Crown, chart ${part}, rounds ${FIRST_CROWN_ROUND} to ${LAST_ROUND}` }),
    });
  }
  chart.duplicate.forEach((layer, li) => {
    if (!anyDuplicate(layer.crown)) return;
    const name = chart.yarns.find((y) => y.id === layer.yarn)?.name ?? layer.yarn;
    for (const part of ["A", "B"] as const) {
      pages.push({
        id: `crown-dup-${li}-${part}`,
        title: `crown duplicate stitch ${part}`,
        meta: `${name}, rounds ${FIRST_CROWN_ROUND}–${LAST_ROUND}, stitches ${part === "A" ? "1–56" : "57–112"}.`,
        legend: dupKey(li),
        svg: chartSvg({ chart, cols: part === "A" ? A_COLS : B_COLS, rows: CROWN_ROWS, onlyLayer: li, counts: true, label: `Crown duplicate stitch in ${name}, chart ${part}` }),
      });
    }
  });
  return pages;
}

/** For a striped chart: which two yarns are used in which rounds. */
export function stripeBlocks(chart: Chart): { from: number; to: number; yarns: [string, string] }[] {
  if (!chart.round_pairs) return [];
  const blocks: { from: number; to: number; yarns: [string, string] }[] = [];
  chart.round_pairs.forEach((pair, i) => {
    const last = blocks[blocks.length - 1];
    if (last && last.yarns[0] === pair[0] && last.yarns[1] === pair[1]) last.to = i + 1;
    else blocks.push({ from: i + 1, to: i + 1, yarns: [pair[0], pair[1]] });
  });
  return blocks;
}

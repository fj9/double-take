import { FIRST_CROWN_ROUND, PAIRS, crownLayout, outsideAt } from "@doubletake/core";
import type { Chart } from "@doubletake/core";

/**
 * A colour block is a stretch of consecutive pairs with the same outside colour in one round. Pairs removed by a
 * crown decrease are skipped and do not break a block. A right-leaning decrease is always a block of its own.
 */
export interface ColourBlock {
  yarn: string;
  name: string;
  hex: string;
  /** First and last pair of the block (pair 1 is worked first). */
  from: number;
  to: number;
  /** Stitch pairs in the block (removed pairs inside it are not counted). */
  count: number;
  decrease: boolean;
}

export function blocksFor(chart: Chart, round: number): ColourBlock[] {
  const marked = round >= FIRST_CROWN_ROUND ? crownLayout(round).marked : null;
  const out: ColourBlock[] = [];
  for (let pair = 1; pair <= PAIRS; pair++) {
    const id = outsideAt(chart, round, pair);
    if (id === null) continue;
    const decrease = !!marked?.[pair - 1];
    const last = out[out.length - 1];
    if (last && !decrease && !last.decrease && last.yarn === id) {
      last.to = pair;
      last.count++;
      continue;
    }
    const yarn = chart.yarns.find((y) => y.id === id);
    out.push({ yarn: id, name: yarn?.name ?? id, hex: yarn?.hex ?? "#cccccc", from: pair, to: pair, count: 1, decrease });
  }
  return out;
}

/** The block being worked: the first one that ends after the last pair worked. -1 when the round's blocks are all done. */
export function currentBlockIndex(blocks: ColourBlock[], pair: number | null): number {
  return blocks.findIndex((b) => b.to > (pair ?? 0));
}

/** The pair to mark once the current block is worked, or null when there is none left. */
export function pairAfterBlock(blocks: ColourBlock[], pair: number | null): number | null {
  const i = currentBlockIndex(blocks, pair);
  return i < 0 ? null : (blocks[i] as ColourBlock).to;
}

/** The pair a step of one stitch moves to, skipping pairs the crown has removed. null before the first pair. */
export function stepPair(chart: Chart, round: number, pair: number | null, direction: 1 | -1): number | null {
  const present = (p: number) => outsideAt(chart, round, p) !== null;
  if (direction === 1) {
    for (let p = (pair ?? 0) + 1; p <= PAIRS; p++) if (present(p)) return p;
    return pair;
  }
  for (let p = (pair ?? 0) - 1; p >= 1; p--) if (present(p)) return p;
  return null;
}

/** The whole round as text, in the order worked: the same blocks the Now card shows. */
export function wholeRoundText(chart: Chart, round: number): { heading: string; runs: string } {
  const blocks = blocksFor(chart, round);
  const worked = blocks.reduce((n, b) => n + b.count, 0);
  const runs = blocks.map((b) => `${b.name}${b.decrease ? " (right-leaning decrease)" : ""} × ${b.count}`).join(", ");
  return {
    heading: `Pairs 1–${PAIRS}`,
    runs: runs + (worked < PAIRS ? ` (${PAIRS - worked} pairs here are already decreased away: skip the blanks)` : ""),
  };
}

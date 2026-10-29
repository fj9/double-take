import type { Chart, DuplicateLayer } from "./chart";
import { BODY_ROUNDS, PAIRS } from "./hat";

export interface Cell {
  /** 1 to 75. */
  round: number;
  /** 1 to 112. */
  pair: number;
}

export interface Patch {
  /** Position in the list: patches are numbered from the bottom of the hat upwards. */
  index: number;
  /** The layer's yarn. */
  yarn: string;
  faces: "both" | "outside";
  /** Sorted by round, then pair. */
  cells: Cell[];
}

const wrap = (i: number) => ((i % PAIRS) + PAIRS) % PAIRS;

/** Cells next to a cell (spec 9.4): the eight surrounding cells, wrapping across the seam (pair 112 next to pair 1). */
function neighbours(round: number, i: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const r = round + dr;
    if (r < 1 || r > BODY_ROUNDS) continue;
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      out.push([r, wrap(i + dc)]);
    }
  }
  return out;
}

function layerCells(layer: DuplicateLayer): Set<number> {
  const cells = new Set<number>(); // round * PAIRS + index
  layer.body.forEach((row, r) => {
    for (let i = 0; i < PAIRS; i++) if (row[i] === "1") cells.add((r + 1) * PAIRS + i);
  });
  return cells;
}

/** The patches of one duplicate layer, numbered from the bottom of the hat upwards. */
export function findPatches(layer: DuplicateLayer): Patch[] {
  const cells = layerCells(layer);
  const seen = new Set<number>();
  const patches: Patch[] = [];
  for (const start of [...cells].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const found: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const key = stack.pop() as number;
      found.push(key);
      const round = Math.floor(key / PAIRS);
      for (const [r, q] of neighbours(round, key % PAIRS)) {
        const k = r * PAIRS + q;
        if (cells.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    found.sort((a, b) => a - b);
    patches.push({
      index: patches.length,
      yarn: layer.yarn,
      faces: layer.faces,
      cells: found.map((k) => ({ round: Math.floor(k / PAIRS), pair: (k % PAIRS) + 1 })),
    });
  }
  return patches;
}

/** All patches in a chart, layer by layer, each layer numbered from the bottom upwards. */
export function findAllPatches(chart: Chart): Patch[][] {
  return chart.duplicate.map(findPatches);
}

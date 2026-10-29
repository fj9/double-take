import type { Chart, DuplicateLayer } from "./chart";
import { BODY_ROUNDS, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS, crownLayout } from "./hat";

export interface Cell {
  /** 1 to 95. */
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

/** Which pairs exist in each round, index 1 to 95. */
function presenceByRound(): boolean[][] {
  const rows: boolean[][] = [[]];
  for (let r = 1; r <= LAST_ROUND; r++) {
    rows[r] = r <= BODY_ROUNDS ? new Array<boolean>(PAIRS).fill(true) : [...crownLayout(r).present];
  }
  return rows;
}

const PRESENT = presenceByRound();

const wrap = (i: number) => ((i % PAIRS) + PAIRS) % PAIRS;

/**
 * Cells next to a cell (spec 9.4): the eight surrounding cells, wrapping across the seam (pair 112 next
 * to pair 1), running from the body into the crown, and reaching across a pair removed by a decrease.
 */
function neighbours(round: number, i: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const r = round + dr;
    if (r < 1 || r > LAST_ROUND) continue;
    const row = PRESENT[r] as boolean[];
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const q = wrap(i + dc);
      if (row[q]) {
        out.push([r, q]);
        continue;
      }
      // A hole left by a decrease: the nearest pair beyond it counts as the neighbour.
      for (const dir of dc === 0 ? [-1, 1] : [dc]) {
        let k = q;
        for (let step = 0; step < PAIRS; step++) {
          k = wrap(k + dir);
          if (row[k]) {
            out.push([r, k]);
            break;
          }
        }
      }
    }
  }
  return out;
}

function layerCells(layer: DuplicateLayer): Set<number> {
  const cells = new Set<number>(); // round * PAIRS + index
  layer.body.forEach((row, r) => {
    for (let i = 0; i < PAIRS; i++) if (row[i] === "1") cells.add((r + 1) * PAIRS + i);
  });
  layer.crown.forEach((row, r) => {
    for (let i = 0; i < PAIRS; i++) if (row[i] === "1") cells.add((FIRST_CROWN_ROUND + r) * PAIRS + i);
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

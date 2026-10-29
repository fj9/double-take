import type { Patch } from "@doubletake/core";
import { LAST_ROUND, PAIRS } from "@doubletake/core";

export interface PatchWindow {
  /** Pair numbers left to right as seen from the outside (stitch 1 at the right). */
  outsideCols: number[];
  /** The same pairs left to right as seen from the inside: the mirror image. */
  insideCols: number[];
  /** Round numbers top to bottom, with a one-round margin where there is room. */
  rows: number[];
  /** Round range of the patch itself. */
  firstRound: number;
  lastRound: number;
}

const wrapPair = (n: number) => ((((n - 1) % PAIRS) + PAIRS) % PAIRS) + 1;

/**
 * The part of the hat to show for a patch. A patch that crosses the seam (pair 112 to pair 1) is shown as
 * one piece by finding the shortest arc of pairs that holds it.
 */
export function patchWindow(patch: Patch, margin = 1): PatchWindow {
  const pairs = [...new Set(patch.cells.map((c) => c.pair))].sort((a, b) => a - b);
  let startIdx = 0;
  let width = pairs.length === 0 ? 0 : (pairs[pairs.length - 1] as number) - (pairs[0] as number) + 1;
  if (pairs.length > 1) {
    // The arc starts just after the largest circular gap between occupied pairs.
    let bestGap = -1;
    let gapAt = 0;
    pairs.forEach((p, i) => {
      const next = pairs[(i + 1) % pairs.length] as number;
      const gap = (next - p + PAIRS) % PAIRS;
      if (gap > bestGap) {
        bestGap = gap;
        gapAt = i;
      }
    });
    startIdx = (gapAt + 1) % pairs.length;
    width = PAIRS - bestGap + 1;
  }
  const first = (pairs[startIdx] as number) - margin;
  const total = Math.min(PAIRS, width + margin * 2);
  const ascending = Array.from({ length: total }, (_, i) => wrapPair(first + i));
  const rounds = patch.cells.map((c) => c.round);
  const firstRound = Math.min(...rounds);
  const lastRound = Math.max(...rounds);
  const lo = Math.max(1, firstRound - margin);
  const hi = Math.min(LAST_ROUND, lastRound + margin);
  return {
    insideCols: ascending,
    outsideCols: [...ascending].reverse(),
    rows: Array.from({ length: hi - lo + 1 }, (_, i) => hi - i),
    firstRound,
    lastRound,
  };
}

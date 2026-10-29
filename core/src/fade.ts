import { yarnsInRound } from "./chart";
import type { Chart } from "./chart";
import { CROWN_ROUNDS, FIRST_CROWN_ROUND, PAIRS } from "./hat";
import { components } from "./generate/grid";

/**
 * The print fades out over the first rounds of the crown and is gone by round 85: rounds 76 to 84 carry what is
 * left of it, and rounds 85 to 95 are one colour.
 */
export const FADE_ROUNDS = 9;

const W = PAIRS;

/**
 * Which cells of the first `rows` crown rounds keep their print (row 0 is round 76). `printed(i, p)` says whether
 * row i has print at pair p (0-based). A cell survives in row i while it is further than 0.6 * i cells from the
 * nearest unprinted cell, so thin shapes go first and every shape shrinks as the rows go up. Anything left of fewer
 * than three cells is dropped, so the fade doesn't leave single stitches to embroider.
 */
export function fadeMask(rows: number, printed: (i: number, p: number) => boolean): Uint8Array {
  const keep = new Uint8Array(Math.max(1, rows) * W);
  if (rows === 0) return keep;
  const dist = new Int16Array(rows * W).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let p = 0; p < W; p++) {
      if (!printed(i, p)) {
        dist[i * W + p] = 0;
        queue.push(i * W + p);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as number;
    const i = Math.floor(at / W);
    const p = at % W;
    for (let di = -1; di <= 1; di++) {
      for (let dp = -1; dp <= 1; dp++) {
        const ni = i + di;
        if (ni < 0 || ni >= rows) continue;
        const n = ni * W + ((p + dp + W) % W);
        if (dist[n] === -1) {
          dist[n] = (dist[at] as number) + 1;
          queue.push(n);
        }
      }
    }
  }
  const mask = new Uint8Array(rows * W);
  for (let i = 0; i < rows; i++) for (let p = 0; p < W; p++) mask[i * W + p] = printed(i, p) && (dist[i * W + p] as number) > 0.6 * i ? 1 : 0;
  const { labels, count } = components(mask, W, rows, true);
  const size = new Array<number>(count + 1).fill(0);
  for (const label of labels) if (label) size[label]!++;
  for (let q = 0; q < labels.length; q++) keep[q] = labels[q] && (size[labels[q] as number] as number) >= 3 ? 1 : 0;
  return keep;
}

const setChar = (s: string, i: number, ch: string) => s.slice(0, i) + ch + s.slice(i + 1);

/**
 * Fade the print out of the crown: what is left is gone by round 85 and the rest of the crown is one colour (the
 * first yarn of the round's pair outside, no duplicate stitch). Changes the chart it is given.
 */
export function fadeCrown(chart: Chart): void {
  const printed = (i: number, p: number) => {
    const round = FIRST_CROWN_ROUND + i;
    const ch = chart.crown.rounds[i]?.[p];
    return ch !== undefined && ch !== "." && (ch !== yarnsInRound(chart, round)[0] || chart.duplicate.some((l) => l.crown[i]?.[p] === "1"));
  };
  const keep = fadeMask(Math.min(FADE_ROUNDS, CROWN_ROUNDS), printed);
  for (let i = 0; i < CROWN_ROUNDS; i++) {
    const ground = yarnsInRound(chart, FIRST_CROWN_ROUND + i)[0];
    for (let p = 0; p < W; p++) {
      if (i < FADE_ROUNDS && keep[i * W + p]) continue;
      if (chart.crown.rounds[i]?.[p] === ".") continue;
      chart.crown.rounds[i] = setChar(chart.crown.rounds[i] as string, p, ground);
      for (const layer of chart.duplicate) if (layer.crown[i]?.[p] === "1") layer.crown[i] = setChar(layer.crown[i] as string, p, "0");
    }
  }
}

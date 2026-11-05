import { rgbToLab } from "@doubletake/core";
import type { Chart } from "@doubletake/core";

/** Two main yarns closer than this (CIE76 distance) can look alike on a phone, so cell letters are switched on. Tune on real yarn pairs. */
export const CLOSE_COLOURS = 30;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** How different two #rrggbb colours look (CIE76 distance). */
export function colourDistance(a: string, b: string): number {
  const x = rgbToLab(...rgb(a));
  const y = rgbToLab(...rgb(b));
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** The smallest distance between the two yarns worked together in any round, or null when it can't be told. */
export function closestPair(chart: Chart): number | null {
  const pairs: [string, string][] = [];
  if (chart.round_pairs) {
    for (const p of chart.round_pairs) if (!pairs.some((q) => q[0] === p[0] && q[1] === p[1])) pairs.push([p[0], p[1]]);
  } else {
    const mains = chart.yarns.filter((y) => y.role === "main");
    if (mains.length >= 2) pairs.push([(mains[0] as { id: string }).id, (mains[1] as { id: string }).id]);
  }
  let best: number | null = null;
  for (const [a, b] of pairs) {
    const ya = chart.yarns.find((y) => y.id === a);
    const yb = chart.yarns.find((y) => y.id === b);
    if (!ya || !yb) continue;
    const d = colourDistance(ya.hex, yb.hex);
    if (best === null || d < best) best = d;
  }
  return best;
}

/** True when the two colours are close enough that letters should be on whatever the setting says. */
export function coloursAreClose(chart: Chart): boolean {
  const d = closestPair(chart);
  return d !== null && d < CLOSE_COLOURS;
}

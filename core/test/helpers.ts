import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Chart, DuplicateLayer } from "../src";
import { newBlankChart } from "../src";

export function loadLeopard(): Chart {
  const path = fileURLToPath(new URL("../../fixtures/leopard/leopard.doubletake.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8")) as Chart;
}

export const clone = <T>(v: T): T => structuredClone(v);

/** Replace one character of a row. */
export function setChar(row: string, index: number, ch: string): string {
  return row.slice(0, index) + ch + row.slice(index + 1);
}

/** A blank duplicate-stitch layer for yarn C (all zeros, dots at removed pairs copied from the chart's crown). */
export function emptyLayer(chart: Chart, yarn = "C", faces: "both" | "outside" = "both"): DuplicateLayer {
  return {
    yarn,
    faces,
    body: chart.body.map((r) => "0".repeat(r.length)),
    crown: chart.crown.rounds.map((r) => [...r].map((ch) => (ch === "." ? "." : "0")).join("")),
  };
}

/** A valid duplicate-mode chart with no duplicate cells set yet, built from the blank chart. */
export function blankDuplicateChart(layers = 1): Chart {
  const chart = newBlankChart("test");
  chart.mode = "duplicate";
  const ids = ["C", "D", "E", "F"];
  for (let i = 0; i < layers; i++) {
    chart.yarns.push({ id: ids[i] as string, name: `dup ${i}`, hex: "#2A5FD0", role: "duplicate" });
    chart.duplicate.push(emptyLayer(chart, ids[i]));
  }
  return chart;
}

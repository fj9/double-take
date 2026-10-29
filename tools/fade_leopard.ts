/**
 * Fades the print out of the leopard example's crown (run after tools/convert_leopard.py):
 *   npx tsx tools/fade_leopard.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { analyse, crownPrint, fadeCrown, validateChart } from "../core/src/index.ts";
import type { Chart } from "../core/src/index.ts";

const path = "fixtures/leopard/leopard.doubletake.json";
const chart = JSON.parse(readFileSync(path, "utf-8")) as Chart;
fadeCrown(chart);
const valid = validateChart(chart);
if (!valid.ok) throw new Error(valid.errors[0]?.message);
writeFileSync(path, JSON.stringify(chart, null, 1) + "\n");
const a = analyse(chart);
console.log("crown print:", crownPrint(chart), "| duplicate:", a.duplicate.map((d) => `${d.yarn}: ${d.patches} patches, ${d.cells} squares`).join("; "), "| share", Math.round(a.duplicateShare * 1000) / 10 + "%");

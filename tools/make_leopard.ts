/**
 * Makes the leopard example chart (fixtures/leopard/leopard.doubletake.json) from the leopard sample picture, at the
 * current hat size. It does what the Claude skill's `build` command does, with the colours of the example hat:
 *
 *   npx tsx tools/make_leopard.ts
 *
 * The dark rosette outlines are pink, the cream ground is purple, and the tan centres are blue duplicate stitch.
 * Small duplicate stitch patches are dropped (under 30 squares) so the hat stays under the 25% duplicate stitch limit.
 * The crown fades out as it does for every generated chart, and any speck of fewer than three squares that is left is removed.
 */
import { writeFileSync } from "node:fs";
import { BODY_ROUNDS, FIRST_CROWN_ROUND, analyse, applyTidy, buildChart, cropBox, extractPalette, findAllPatches, makeRoles, validateChart } from "../core/src/index.ts";
import { loadPicture } from "../skill/src/decode.ts";

const PICTURE = "app/public/samples/leopard.jpg";
const OUT = "fixtures/leopard/leopard.doubletake.json";
const DUP_MIN = 30;

const pixels = loadPicture(PICTURE);
const box = cropBox(pixels.width, pixels.height, { zoom: 1, cx: 0.5, cy: 0.5 });
extractPalette(pixels, { cap: 6, crop: box });
const roles = makeRoles(pixels, { colours: 3, seam: "fade", minPatch: 3, crop: box });
// Role 0 is the most used colour (dark), 1 the cream ground, 2 the tan centres.
const tidied = applyTidy(roles, [undefined, undefined, { min: DUP_MIN }]).roles;
const chart = buildChart(tidied, { kind: "duplicate", dupRoles: [2], outsideRole: 1 }, {
  name: "Leopard (example)",
  yarnNames: ["pink", "purple", "blue"],
  yarnHex: ["#F07EB5", "#6B2D9E", "#2A5FD0"],
});
// The decreases can cut what is left of the faded print into specks in the first crown rounds. Leave no patch of
// fewer than three squares in the example.
const [layer] = chart.duplicate;
const [patches] = findAllPatches(chart);
const setZero = (row: string, i: number) => row.slice(0, i) + "0" + row.slice(i + 1);
for (const patch of patches ?? []) {
  if (patch.cells.length >= 3 || !layer) continue;
  for (const { round, pair } of patch.cells) {
    if (round <= BODY_ROUNDS) layer.body[round - 1] = setZero(layer.body[round - 1] as string, pair - 1);
    else layer.crown[round - FIRST_CROWN_ROUND] = setZero(layer.crown[round - FIRST_CROWN_ROUND] as string, pair - 1);
  }
}
chart.created = new Date().toISOString().slice(0, 10);
chart.generator = { tool: "tools/make_leopard.ts", version: "0.2.0" };
chart.source = { kind: "example", note: "leopard print, made from the leopard sample picture at 32 pairs and 44 rounds to 4 in" };

const valid = validateChart(chart);
if (!valid.ok) throw new Error(valid.errors[0]?.message);
writeFileSync(OUT, JSON.stringify(chart, null, 1) + "\n");
const a = analyse(chart);
console.log(
  chart.yarns.map((y) => `${y.id} ${y.name} ${y.hex} (${y.role})`).join(", "),
  "| duplicate:",
  a.duplicate.map((d) => `${d.yarn}: ${d.patches} patches, ${d.cells} squares`).join("; "),
  "| share",
  Math.round(a.duplicateShare * 1000) / 10 + "%",
  "| warnings:",
  a.warnings.map((w) => w.level).join(",") || "none",
);

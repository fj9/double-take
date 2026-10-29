/**
 * Makes a small striped chart for tests: four bands of colour (sky, cloud, grass, sand) as a striped hat.
 *   npx tsx tools/make_stripes_fixture.ts
 */
import { writeFileSync } from "node:fs";
import { buildChart, makeRoles, validateChart } from "../core/src/index.ts";

const w = 320;
const h = 160;
const data = new Uint8ClampedArray(w * h * 4);
const bands = [[30, 90, 200], [240, 235, 215], [60, 150, 70], [225, 190, 110]];
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    // a few small details so a round isn't always exactly one colour
    const band = bands[Math.min(3, Math.floor(y / 40))] as number[];
    const dot = (x % 64) < 6 && (y % 40) > 12 && (y % 40) < 20 ? [200, 50, 50] : band;
    data.set([...dot, 255], (y * w + x) * 4);
  }
}
const roles = makeRoles({ width: w, height: h, data }, { colours: 4 });
const chart = buildChart(roles, { kind: "stripes" }, { name: "Bands (stripes example)", yarnNames: ["sand", "grass", "sky", "cloud"] });
if (!validateChart(chart).ok) throw new Error("not valid");
writeFileSync(new URL("../fixtures/stripes/bands.doubletake.json", import.meta.url), JSON.stringify(chart, null, 1));
console.log(chart.mode, chart.yarns.map((y) => `${y.id} ${y.name} ${y.hex}`).join(", "));
const blocks: string[] = [];
let start = 1;
(chart.round_pairs ?? []).forEach((p, i, all) => {
  const next = all[i + 1];
  if (!next || next[0] !== p[0] || next[1] !== p[1]) { blocks.push(`${start}-${i + 1}: ${p.join("+")}`); start = i + 2; }
});
console.log("stripe blocks:", blocks.join(" | "), " duplicate layers:", chart.duplicate.length);

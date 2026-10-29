/**
 * Run the JavaScript core on the sample images and compare with the old Python skill, cell by cell.
 *
 *   npx tsx tools/parity.ts
 *
 *   npx tsx tools/parity.ts --cli     the same, but through the bundled skill script (run `npm run build:skill` first)
 *
 * The images stay where they are (not committed); the Python results are in tools/reference/out.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { buildChart, compareRoutes, extractPalette, makeRoles, validateChart, analyse } from "../core/src/index.ts";
import type { Pixels } from "../core/src/index.ts";

const OUT = new URL("./reference/out/", import.meta.url).pathname;
const DOWNLOADS = join(homedir(), "Downloads");

function decode(path: string): Pixels {
  const buf = readFileSync(path);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const d = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { width: d.width, height: d.height, data: d.data };
  }
  const p = PNG.sync.read(buf);
  return { width: p.width, height: p.height, data: p.data };
}

/** The best agreement over every way of renaming the JS roles to the Python ones. */
function bestAgreement(a: ArrayLike<number>, b: ArrayLike<number>, k: number) {
  const identity = (() => {
    let same = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
    return same / a.length;
  })();
  const perms: number[][] = [];
  const rec = (cur: number[], rest: number[]) => (rest.length === 0 ? perms.push(cur) : rest.forEach((r, i) => rec([...cur, r], rest.filter((_, j) => j !== i))));
  rec([], [...Array(k).keys()]);
  let best = 0;
  let bestPerm: number[] = [];
  for (const perm of perms) {
    let same = 0;
    for (let i = 0; i < a.length; i++) if (perm[a[i] as number] === b[i]) same++;
    if (same / a.length > best) {
      best = same / a.length;
      bestPerm = perm;
    }
  }
  return { identity, best, bestPerm };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const files = readdirSync(OUT).filter((f) => f.endsWith(".json")).sort();
let worst = 1;
for (const f of files) {
  const ref = JSON.parse(readFileSync(join(OUT, f), "utf-8"));
  const path = join(DOWNLOADS, ref.image);
  let img: Pixels;
  try {
    img = decode(path);
  } catch {
    console.log(`${f}: image ${ref.image} not found in Downloads, skipped`);
    continue;
  }
  const seam = f.includes("leopard") || f.includes("moquette") || f.includes("plaid") ? "fade" : "accept";
  const t0 = Date.now();
  const pal = extractPalette(img, { cap: 6 });
  let roles = makeRoles(img, { colours: ref.colours, seam, minPatch: 4 });
  if (process.argv.includes("--cli")) {
    // The same thing through the skill's one-file script: it must give the same cells
    const dump = join(mkdtempSync(join(tmpdir(), "parity-")), "roles.json");
    const script = new URL("../skill/dist/doubletake-chart/scripts/doubletake.mjs", import.meta.url).pathname;
    execFileSync("node", [script, "roles", path, "--colours", String(ref.colours), "--seam", seam, "--min-patch", "4", "--dump", dump]);
    const d = JSON.parse(readFileSync(dump, "utf-8")) as { roles: number[][] };
    const viaCli = Int32Array.from(d.roles.flat());
    const same = viaCli.every((v, i) => v === roles.grid.data[i]);
    console.log(`  skill script gives the same cells as the core: ${same}`);
    roles = { ...roles, grid: { ...roles.grid, data: viaCli } };
  }
  const ms = Date.now() - t0;
  const k = Math.max(ref.role_shares.length, roles.centres.length);
  const refFlat = Int32Array.from((ref.roles as number[][]).flat());
  const { identity, best, bestPerm } = bestAgreement(roles.grid.data, refFlat, k);
  worst = Math.min(worst, best);
  console.log(`\n${f}  (${img.width}×${img.height}, ${ms} ms)`);
  console.log(`  palette: JS ${pal.palette.length} colours, coverage ${pct(pal.coverage)} | Python ${ref.palette.length} colours, coverage ${pct(ref.coverage)}`);
  console.log(`  role shares  JS ${roles.shares.map(pct).join(" ")} | Python ${ref.role_shares.map((s: number) => pct(s)).join(" ")}`);
  console.log(`  cells identical: ${pct(identity)} as numbered, ${pct(best)} after renaming roles ${JSON.stringify(bestPerm)}`);
  if (ref.colours > 3) {
    const cmp = compareRoutes(roles.grid);
    console.log(`  route: JS recommends ${cmp.recommend} (A ${pct(cmp.a.duplicateShare)}, B ${pct(cmp.b.duplicateShare)}) | Python recommends ${ref.compare.recommend} (A ${pct(ref.compare.A.ds_share)}, B ${pct(ref.compare.B.ds_share)})`);
  }
  // Does it make a valid chart?
  const choice = ref.colours === 2 ? ({ kind: "two" } as const) : ref.colours === 3 ? ({ kind: "duplicate" } as const) : ({ kind: "duplicate" } as const);
  const chart = buildChart(roles, choice, { name: f });
  const a = analyse(chart);
  console.log(`  chart: ${chart.mode}, valid ${validateChart(chart).ok}, duplicate ${pct(a.duplicateShare)} in ${a.duplicate.reduce((n, d) => n + d.patches, 0)} patches`);
}
console.log(`\nWorst agreement after renaming roles: ${pct(worst)}`);

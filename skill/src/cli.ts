import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyse, buildChart, BuildError, compareRoutes, cropBox, extractPalette, makeRoles, rgbToLab, validateChart } from "@doubletake/core";
import type { Chart, Choice, CropSettings, RoleResult } from "@doubletake/core";
import { loadPicture } from "./decode";
import { renderChart, stack, usedRegion, writePng } from "./preview";

/** The command line behind the Doubletake chart skill. Every command prints one JSON object. */

const USAGE = `Doubletake chart maker

  palette PICTURE                  find the real colours in a picture
  roles PICTURE --colours N        turn it into N colours, and compare ways to knit it
  colourways PICTURE --out DIR     three colours: pictures of the three ways to embroider it
  build PICTURE --out DIR          make the chart file and preview pictures

Shared options
  --zoom Z --cx X --cy Y     which part of the picture to use (zoom 1 to 4; cx, cy 0 to 1)
  --colours N                2 to 6 (default: what the picture has)
  --seam fade|accept         blend the join round the hat, or leave it
  --min-patch N              remove patches smaller than N squares
build options
  --name "Hat name"   --names a,b,c   --hex "#112233,#445566"   (by colour number, 0 = most used)
  --mode two|duplicate|stripes   --dup-roles 2,3   --outside-role R
`;

type Flags = Record<string, string | true>;

function parse(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith("--")) flags[a.slice(2)] = argv[++i] as string;
    else flags[a.slice(2)] = true;
  }
  return { positional, flags };
}

const num = (f: Flags, key: string): number | undefined => {
  const v = f[key];
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${key} needs a number.`);
  return n;
};
const list = (f: Flags, key: string): string[] | undefined => (typeof f[key] === "string" ? (f[key] as string).split(",").map((s) => s.trim()) : undefined);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const hexOf = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

function cropFrom(f: Flags, w: number, h: number) {
  const c: CropSettings = { zoom: num(f, "zoom") ?? 1, cx: num(f, "cx") ?? 0.5, cy: num(f, "cy") ?? 0.5 };
  if (c.zoom < 1 || c.zoom > 4) throw new Error("--zoom is between 1 and 4.");
  return cropBox(w, h, c);
}

function suggested(palette: ReturnType<typeof extractPalette>): number {
  const n = Math.max(2, Math.min(6, palette.palette.length));
  return palette.coverage < 0.7 ? Math.min(n, 3) : n;
}

function makeRolesFrom(path: string, f: Flags) {
  const pixels = loadPicture(path);
  const box = cropFrom(f, pixels.width, pixels.height);
  const colours = num(f, "colours") ?? suggested(extractPalette(pixels, { cap: 6, crop: box }));
  const seam = (f.seam as "fade" | "accept" | undefined) ?? (colours <= 3 ? "fade" : "accept");
  if (seam !== "fade" && seam !== "accept") throw new Error("--seam is fade or accept.");
  const roles = makeRoles(pixels, { colours, seam, minPatch: num(f, "min-patch") ?? (colours <= 3 ? 3 : 5), crop: box });
  return { pixels, box, roles, colours };
}

function describeRoles(roles: RoleResult) {
  return roles.centres.map((c, role) => ({ role, hex: hexOf(c), share: round(roles.shares[role] as number) }));
}

function choiceFrom(f: Flags, roles: RoleResult): Choice {
  const k = roles.centres.length;
  const mode = (f.mode as string | undefined) ?? (k === 2 ? "two" : k === 3 ? "duplicate" : compareRoutes(roles.grid).recommend === "B" ? "stripes" : "duplicate");
  if (mode === "two") return { kind: "two" };
  if (mode === "stripes") return { kind: "stripes" };
  if (mode !== "duplicate") throw new Error("--mode is two, duplicate or stripes.");
  const dupRoles = list(f, "dup-roles")?.map(Number);
  const outsideRole = num(f, "outside-role");
  return { kind: "duplicate", ...(dupRoles ? { dupRoles } : {}), ...(outsideRole !== undefined ? { outsideRole } : {}) };
}

function optionsFrom(f: Flags) {
  const names = list(f, "names");
  const hex = list(f, "hex");
  return {
    name: typeof f.name === "string" ? f.name : "My hat",
    ...(names ? { yarnNames: names } : {}),
    ...(hex ? { yarnHex: hex } : {}),
  } as const;
}

function summary(chart: Chart) {
  const a = analyse(chart);
  return {
    mode: chart.mode,
    yarns: chart.yarns.map((y) => ({ id: y.id, name: y.name, hex: y.hex, role: y.role })),
    duplicateStitch: a.duplicate.map((d) => ({ yarn: d.yarn, patches: d.patches, squares: d.cells, shareOfHat: round(d.share) })),
    duplicateShare: round(a.duplicateShare),
    warnings: a.warnings.map((w) => ({ level: w.level, message: w.message })),
  };
}

function command(cmd: string, positional: string[], f: Flags): unknown {
  const picture = positional[0];
  if (!picture) throw new Error(`${cmd} needs a picture file.\n\n${USAGE}`);

  if (cmd === "palette") {
    const pixels = loadPicture(picture);
    const box = cropFrom(f, pixels.width, pixels.height);
    const p = extractPalette(pixels, { cap: 6, crop: box });
    return {
      picture: { width: pixels.width, height: pixels.height },
      colours: p.palette.map((c, i) => ({ hex: hexOf(c), share: round(p.shares[i] as number) })),
      coverage: round(p.coverage),
      suggestedColours: suggested(p),
      warnings: p.warnings,
    };
  }

  if (cmd === "roles") {
    const { roles, colours } = makeRolesFrom(picture, f);
    const out: Record<string, unknown> = { colours, seam: roles.seam, roles: describeRoles(roles) };
    if (colours === 3) {
      out.note = "With three colours any one can be embroidered. Run `colourways` to see all three.";
    }
    if (colours > 3) {
      const c = compareRoutes(roles.grid);
      out.routes = {
        recommend: c.recommend,
        reason: c.reason,
        A: { name: "knit two colours, embroider the rest", duplicateShare: round(c.a.duplicateShare), bandLike: c.a.bandLike },
        B: { name: "stripes", duplicateShare: round(c.b.duplicateShare), yarnChanges: c.b.yarnChanges, stripeBlocks: c.b.blocks, roundsWithThreeOrMoreColours: c.b.roundsWithThreePlus },
      };
    }
    if (typeof f.dump === "string") writeFileSync(f.dump, JSON.stringify({ width: roles.grid.width, height: roles.grid.height, roles: Array.from({ length: roles.grid.height }, (_, y) => Array.from(roles.grid.data.subarray(y * roles.grid.width, (y + 1) * roles.grid.width))), centres: roles.centres }));
    return out;
  }

  const outDir = typeof f.out === "string" ? f.out : "doubletake-out";
  mkdirSync(outDir, { recursive: true });

  if (cmd === "colourways") {
    const { roles, colours } = makeRolesFrom(picture, { ...f, colours: "3" });
    if (colours !== 3) throw new Error("colourways is for three colours.");
    const lab = (r: number) => rgbToLab(...(roles.centres[r] as [number, number, number]));
    const options = [0, 1, 2].map((d) => {
      const rest = [0, 1, 2].filter((r) => r !== d);
      const [a, b] = [lab(rest[0] as number), lab(rest[1] as number)];
      const contrast = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const chart = buildChart(roles, { kind: "duplicate", dupRoles: [d] }, { ...optionsFrom(f), name: `embroider colour ${d + 1}` });
      const file = join(outDir, `colourway-embroider-colour-${d}.png`);
      writePng(file, stack(renderChart(chart), renderChart(chart, { inside: true })));
      const s = summary(chart);
      return { embroiderRole: d, embroiderHex: hexOf(roles.centres[d] as number[]), knittedHex: rest.map((r) => hexOf(roles.centres[r] as number[])), contrast: round(contrast, 1), duplicateShare: s.duplicateShare, patches: s.duplicateStitch[0]?.patches ?? 0, file };
    });
    const best = options.reduce((x, y) => (y.contrast > x.contrast ? y : x));
    return { roles: describeRoles(roles), options, mostContrasting: best.embroiderRole, note: "Each picture shows the outside above the inside (the inside is the mirror image in the other colours)." };
  }

  if (cmd === "build") {
    const { pixels, box, roles } = makeRolesFrom(picture, f);
    const choice = choiceFrom(f, roles);
    const chart = buildChart(roles, choice, optionsFrom(f));
    const valid = validateChart(chart);
    if (!valid.ok) throw new Error(valid.errors[0]?.message ?? "The chart isn't valid.");
    const base = slug(chart.name);
    const chartFile = join(outDir, `${base}.doubletake.json`);
    writeFileSync(chartFile, JSON.stringify(chart, null, 1));
    const outside = join(outDir, "outside.png");
    const inside = join(outDir, "inside.png");
    const used = join(outDir, "used-part-of-picture.png");
    writePng(outside, renderChart(chart));
    writePng(inside, renderChart(chart, { inside: true }));
    writePng(used, usedRegion(pixels, box));
    return { chartFile, previews: { outside, inside, usedPartOfPicture: used }, valid: true, ...summary(chart) };
  }

  throw new Error(`Unknown command "${cmd}".\n\n${USAGE}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "help" || cmd === "--help") {
  process.stdout.write(USAGE);
} else {
  try {
    const { positional, flags } = parse(rest);
    process.stdout.write(JSON.stringify(command(cmd, positional, flags), null, 2) + "\n");
  } catch (e) {
    const message = e instanceof BuildError || e instanceof Error ? e.message : String(e);
    process.stderr.write(JSON.stringify({ error: message }) + "\n");
    process.exitCode = 1;
  }
}

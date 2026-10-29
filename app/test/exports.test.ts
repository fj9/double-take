import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyse, buildChart, crownLayout, makeRoles, newBlankChart } from "@doubletake/core";
import type { Chart, Pixels } from "@doubletake/core";
import { chartCsv, compressFiles, crc32, duplicateCsv, makeZip, shoppingList, stripesCsv, yarnsCsv } from "../src/lib/exports";
import { chartPages, stripeBlocks } from "../src/lib/pages";
import { chartSvg } from "../src/lib/svg";

const leopard = (): Chart => JSON.parse(readFileSync(new URL("../../fixtures/leopard/leopard-patterned.doubletake.json", import.meta.url), "utf-8")) as Chart;

function stripedChart(): Chart {
  const w = 320;
  const h = 160;
  const data = new Uint8ClampedArray(w * h * 4);
  const cols = [[30, 60, 190], [240, 230, 200], [40, 150, 60], [220, 180, 30]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...(cols[Math.floor(y / 40)] as number[]), 255], (y * w + x) * 4);
  const img: Pixels = { width: w, height: h, data };
  return buildChart(makeRoles(img, { colours: 4 }), { kind: "stripes" });
}

describe("spreadsheets (CSV)", () => {
  const lines = (s: string) => s.trimEnd().split("\n");

  it("the chart is in knitting order: round 1 first, pair 1 first", () => {
    const rows = lines(chartCsv(leopard()));
    expect(rows).toHaveLength(96); // header and rounds 1 to 95
    expect(rows[0]?.split(",")).toHaveLength(113);
    expect(rows[0]?.startsWith("Round,P1,P2")).toBe(true);
    const c = leopard();
    expect(rows[1]?.split(",")[1]).toBe(c.body[0]?.[0]);
    expect(rows[1]?.split(",")[112]).toBe(c.body[0]?.[111]);
  });

  it("removed pairs are blank and every decrease is marked with a slash", () => {
    const rows = lines(chartCsv(leopard()));
    const round76 = (rows[76] as string).split(",");
    expect(round76[0]).toBe("76");
    expect(round76[1]).toBe(""); // pair 1 is removed in round 76
    const slashes = rows.slice(1).flatMap((r) => r.split(",").slice(1)).filter((c) => c.endsWith("/")).length;
    let expected = 0;
    for (let r = 76; r <= 95; r++) expected += crownLayout(r).marked.filter(Boolean).length;
    expect(expected).toBe(96);
    expect(slashes).toBe(96);
  });

  it("each duplicate stitch layer lists exactly its squares", () => {
    const rows = lines(duplicateCsv(leopard(), 0));
    const ones = rows.slice(1).flatMap((r) => r.split(",").slice(1)).filter((c) => c === "1").length;
    expect(ones).toBe(2011);
  });

  it("a striped chart has a stripes sheet, and others don't", () => {
    expect(stripesCsv(leopard())).toBeNull();
    const rows = lines(stripesCsv(stripedChart()) as string);
    expect(rows).toHaveLength(76);
    expect(rows[0]).toBe("Round,Yarn 1,Yarn 2,Name 1,Name 2");
  });

  it("lists the yarns with their share of the outside", () => {
    const rows = lines(yarnsCsv(leopard()));
    expect(rows).toHaveLength(4);
    expect(rows[1]).toMatch(/^A,purple,#6B2D9E,main,\d+(\.\d)?%$/);
  });

  it("the shopping list names every yarn and says yardage isn't calculated", () => {
    const t = shoppingList(leopard(), "Leopard");
    for (const y of leopard().yarns) expect(t).toContain(y.name);
    expect(t).toContain("Yardage isn't calculated yet");
  });
});

describe("chart pictures (SVG)", () => {
  const cols = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i);

  it("draws one square for every pair that exists", () => {
    const svg = chartSvg({ chart: newBlankChart("t"), cols: cols(56, 1), rows: cols(75, 1), label: "x" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(56 * 75);
  });

  it("leaves the removed crown pairs blank and marks each decrease", () => {
    const svg = chartSvg({ chart: newBlankChart("t"), cols: cols(56, 1), rows: cols(95, 76), counts: true, label: "x" });
    let present = 0;
    let marked = 0;
    for (let r = 76; r <= 95; r++) {
      const l = crownLayout(r);
      present += l.present.slice(0, 56).filter(Boolean).length;
      marked += l.marked.slice(0, 56).filter(Boolean).length;
    }
    expect((svg.match(/<rect /g) ?? []).length).toBe(present);
    expect((svg.match(/stroke-width="0.2"\/>/g) ?? []).length).toBe(marked);
    expect(svg).toContain(">pairs<");
  });

  it("shows only one duplicate layer in colour when asked", () => {
    const c = leopard();
    const svg = chartSvg({ chart: c, cols: cols(56, 1), rows: cols(75, 1), onlyLayer: 0, label: "x" });
    expect((svg.match(/fill-opacity="0.18"/g) ?? []).length).toBeGreaterThan(1000);
    expect(svg).toContain(`fill="#2A5FD0"`);
  });

  it("escapes text in the label", () => {
    const svg = chartSvg({ chart: newBlankChart("t"), cols: [1], rows: [1], label: 'a <b> & "c"' });
    expect(svg).toContain("a &lt;b&gt; &amp; &quot;c&quot;");
  });
});

describe("chart pages", () => {
  it("has body, duplicate stitch and crown pages in A then B order", () => {
    expect(chartPages(leopard()).map((p) => p.id)).toEqual(["body-A", "body-B", "dup-0-A", "dup-0-B", "crown-A", "crown-B", "crown-dup-0-A", "crown-dup-0-B"]);
  });
  it("a two-colour chart has no duplicate stitch pages", () => {
    expect(chartPages(newBlankChart("t")).map((p) => p.id)).toEqual(["body-A", "body-B", "crown-A", "crown-B"]);
  });
  it("groups a striped chart's rounds into blocks", () => {
    const blocks = stripeBlocks(stripedChart());
    expect(blocks[0]?.from).toBe(1);
    expect(blocks[blocks.length - 1]?.to).toBe(75);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]?.from).toBe((blocks[i - 1]?.to as number) + 1);
  });
});

describe("zip files", () => {
  it("computes the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("makes a zip that unzip accepts, with the contents unchanged", () => {
    const enc = new TextEncoder();
    const bin = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 255);
    const zip = makeZip([
      { name: "hat/chart.csv", data: enc.encode("Round,P1\n1,A\n") },
      { name: "hat/pic.bin", data: bin },
      { name: "hat/empty.txt", data: new Uint8Array(0) },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, zip);
    expect(execFileSync("unzip", ["-tq", file], { encoding: "utf-8" })).toContain("No errors");
    expect(execFileSync("unzip", ["-l", file], { encoding: "utf-8" })).toContain("hat/pic.bin");
    expect(execFileSync("unzip", ["-p", file, "hat/chart.csv"], { encoding: "utf-8" })).toBe("Round,P1\n1,A\n");
    expect(Uint8Array.from(execFileSync("unzip", ["-p", file, "hat/pic.bin"]))).toEqual(bin);
  });
});

describe("compressed zip files", () => {
  it("squeezes big files, and unzip reads them back unchanged", async () => {
    const big = new TextEncoder().encode("<rect fill=\"#6b2d9e\"/>".repeat(20000));
    const small = new TextEncoder().encode("hi");
    const files = await compressFiles([
      { name: "a/big.svg", data: big },
      { name: "a/small.txt", data: small },
    ]);
    expect(files[0]?.deflated).toBeDefined();
    expect((files[0]?.deflated as Uint8Array).length).toBeLessThan(big.length / 10);
    expect(files[1]?.deflated).toBeUndefined(); // too small to bother
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "c.zip");
    writeFileSync(file, makeZip(files));
    expect(execFileSync("unzip", ["-tq", file], { encoding: "utf-8" })).toContain("No errors");
    expect(execFileSync("unzip", ["-p", file, "a/big.svg"], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 })).toBe(new TextDecoder().decode(big));
    expect(execFileSync("unzip", ["-p", file, "a/small.txt"], { encoding: "utf-8" })).toBe("hi");
  });
});

it("analysis still agrees with the numbers the exports quote", () => {
  expect(analyse(leopard()).duplicate[0]?.cells).toBe(2011);
});

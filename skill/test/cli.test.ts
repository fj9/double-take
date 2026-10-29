import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { crownPrint, parseChartJson } from "@doubletake/core";
import { exifOrientation } from "../src/exif";

const here = new URL(".", import.meta.url).pathname;
const script = join(here, "../dist/doubletake-chart/scripts/doubletake.mjs");
const dir = mkdtempSync(join(tmpdir(), "doubletake-skill-"));

type Rgb = [number, number, number];
function png(name: string, w: number, h: number, colour: (x: number, y: number) => Rgb): string {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = colour(x, y);
      p.data.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  const path = join(dir, name);
  writeFileSync(path, PNG.sync.write(p));
  return path;
}

function run(args: string[]) {
  const r = spawnSync("node", [script, ...args], { encoding: "utf-8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const json = (args: string[]) => {
  const r = run(args);
  expect(r.err, r.err).toBe("");
  expect(r.code).toBe(0);
  return JSON.parse(r.out);
};

const RED: Rgb = [200, 40, 40];
const BLUE: Rgb = [30, 60, 190];
const CREAM: Rgb = [240, 230, 200];
const GREEN: Rgb = [40, 150, 60];
const GOLD: Rgb = [220, 180, 30];
const spots = (name: string) =>
  png(name, 320, 160, (x, y) => {
    const cx = (x % 40) - 20;
    const cy = (y % 40) - 20;
    const d = cx * cx + cy * cy;
    return d < 16 ? BLUE : d < 121 ? RED : CREAM;
  });

beforeAll(() => {
  execFileSync("node", [join(here, "../build.mjs")], { stdio: "pipe" });
});

describe("the command line", () => {
  it("is one file you can run, and it explains itself", () => {
    expect(existsSync(script)).toBe(true);
    const r = run(["help"]);
    expect(r.out).toContain("palette PICTURE");
    expect(r.out).toContain("build PICTURE");
  });

  it("finds the colours in a picture", () => {
    const p = json(["palette", spots("spots.png")]);
    expect(p.colours).toHaveLength(3);
    expect(p.coverage).toBeGreaterThan(0.9);
    expect(p.suggestedColours).toBe(3);
    expect(p.picture).toEqual({ width: 320, height: 160 });
  });

  it("builds a valid three-colour chart with previews", () => {
    const out = join(dir, "three");
    const b = json(["build", spots("a.png"), "--colours", "3", "--name", "Red spots", "--names", "cream,red,blue", "--out", out]);
    expect(b.valid).toBe(true);
    expect(b.mode).toBe("duplicate");
    expect(b.yarns.map((y: { name: string }) => y.name).sort()).toEqual(["blue", "cream", "red"]);
    const chart = parseChartJson(readFileSync(b.chartFile, "utf-8"));
    expect(chart.ok).toBe(true);
    for (const f of [b.previews.outside, b.previews.inside]) {
      const img = PNG.sync.read(readFileSync(f));
      expect(img.width).toBe(112 * 8);
      expect(img.height).toBe(95 * 6);
    }
    expect(existsSync(b.previews.usedPartOfPicture)).toBe(true);
  });

  it("gives the same chart every time", () => {
    const pic = spots("same.png");
    const a = json(["build", pic, "--colours", "3", "--out", join(dir, "r1")]);
    const b = json(["build", pic, "--colours", "3", "--out", join(dir, "r2")]);
    expect(readFileSync(b.chartFile, "utf-8")).toBe(readFileSync(a.chartFile, "utf-8"));
  });

  it("makes a two-colour chart whose crown is one colour from round 85", () => {
    const b = json(["build", spots("two.png"), "--colours", "2", "--out", join(dir, "two")]);
    expect(b.mode).toBe("two_colour");
    const parsed = parseChartJson(readFileSync(b.chartFile, "utf-8"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(crownPrint(parsed.chart)?.lastRound ?? 0).toBeLessThan(85);
  });

  it("compares the two ways to use more than three colours, and builds stripes", () => {
    const bands = png("bands.png", 320, 160, (_x, y) => (y < 40 ? BLUE : y < 80 ? CREAM : y < 120 ? GREEN : GOLD));
    const r = json(["roles", bands, "--colours", "4"]);
    expect(r.routes.recommend).toBe("B");
    expect(r.routes.B.duplicateShare).toBeLessThan(r.routes.A.duplicateShare);
    const b = json(["build", bands, "--colours", "4", "--out", join(dir, "stripes")]);
    expect(b.mode).toBe("stripes");
    expect(parseChartJson(readFileSync(b.chartFile, "utf-8")).ok).toBe(true);
  });

  it("shows the three ways to embroider three colours", () => {
    const c = json(["colourways", spots("cw.png"), "--out", join(dir, "cw")]);
    expect(c.options).toHaveLength(3);
    expect([0, 1, 2]).toContain(c.mostContrasting);
    for (const o of c.options) {
      expect(existsSync(o.file)).toBe(true);
      const img = PNG.sync.read(readFileSync(o.file));
      expect(img.width).toBe(112 * 8);
      expect(img.height).toBeGreaterThan(95 * 6 * 2);
    }
  });

  it("uses the part of the picture you choose", () => {
    const left = json(["roles", png("halves.png", 320, 160, (x) => (x < 160 ? RED : BLUE)), "--colours", "2", "--zoom", "2", "--cx", "0", "--cy", "0.5"]);
    expect(left.roles).toHaveLength(2);
  });
});

describe("mistakes", () => {
  it("says what went wrong, as JSON, with a non-zero exit", () => {
    const missing = run(["palette", join(dir, "nope.png")]);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.err).error).toContain("Can't open");
    const notPicture = join(dir, "notes.txt");
    writeFileSync(notPicture, "hello");
    expect(JSON.parse(run(["palette", notPicture]).err).error).toContain("JPEG or PNG");
    expect(JSON.parse(run(["palette", spots("z.png"), "--zoom", "9"]).err).error).toContain("--zoom");
    expect(run(["nonsense", spots("y.png")]).code).toBe(1);
    expect(run(["palette"]).code).toBe(1);
  });

  it("explains why a choice can't be made", () => {
    const noise = png("noise.png", 320, 160, (x, y) => [RED, BLUE, CREAM, GREEN, GOLD, [120, 20, 140] as Rgb][(Math.floor(x / 20) * 5 + Math.floor(y / 20) * 3) % 6] as Rgb);
    const r = run(["build", noise, "--colours", "3", "--mode", "two", "--out", join(dir, "bad")]);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.err).error).toContain("two colours");
  });
});

describe("phone photos", () => {
  /** A JPEG with an EXIF note saying it must be turned: orientation 6 means clockwise. */
  function sidewaysJpeg(): string {
    const w = 80;
    const h = 40;
    const data = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([200, 40, 40, 255], i * 4);
    const raw = jpeg.encode({ data, width: w, height: h }, 90).data;
    const exif = Buffer.from([0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
    const len = exif.length + 2;
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 0xff]), exif]);
    const path = join(dir, "sideways.jpg");
    writeFileSync(path, Buffer.concat([raw.subarray(0, 2), app1, raw.subarray(2)]));
    return path;
  }

  it("reads the orientation note", () => {
    expect(exifOrientation(readFileSync(sidewaysJpeg()))).toBe(6);
    expect(exifOrientation(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(1);
    expect(exifOrientation(Buffer.from("not a jpeg"))).toBe(1);
  });

  it("turns the picture the right way up before using it", () => {
    const p = json(["palette", sidewaysJpeg()]);
    expect(p.picture).toEqual({ width: 40, height: 80 }); // it was 80 × 40, stored sideways
  });
});

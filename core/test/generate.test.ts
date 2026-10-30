import { describe, expect, it } from "vitest";
import { analyse, applyOrientation, buildChart, compareRoutes, crownPrint, extractPalette, FABRIC_ASPECT, makeGrid, makeRoles, mergeRoles, outsideAt, planPairs, shrinkPixels, tidyRoles, tilePixels, TILE_WIDTH, validateChart } from "../src";
import type { Pixels } from "../src";

type Rgb = [number, number, number];

function image(width: number, height: number, colour: (x: number, y: number) => Rgb): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colour(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

const RED: Rgb = [200, 40, 40];
const BLUE: Rgb = [30, 60, 190];
const CREAM: Rgb = [240, 230, 200];
const GREEN: Rgb = [40, 150, 60];
const GOLD: Rgb = [220, 180, 30];

/** Big soft spots on a plain ground, 640 × 320 (the shape of the fabric). */
const spots = (spot: Rgb, ground: Rgb) =>
  image(640, 316, (x, y) => {
    const cx = (x % 80) - 40;
    const cy = (y % 80) - 40;
    return cx * cx + cy * cy < 22 * 22 ? spot : ground;
  });

describe("fabric shape", () => {
  it("is about twice as wide as it is tall (cells are wider than tall)", () => {
    expect(FABRIC_ASPECT).toBeCloseTo(2.03, 2);
  });
});

describe("palette check", () => {
  it("finds three real colours in a flat picture, with full coverage", () => {
    const img = image(300, 200, (x) => (x < 100 ? RED : x < 200 ? CREAM : BLUE));
    const p = extractPalette(img);
    expect(p.palette).toHaveLength(3);
    expect(p.coverage).toBeGreaterThan(0.95);
    expect(p.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("warns that a smooth gradient will blur", () => {
    const img = image(300, 200, (x, y) => [Math.round((x / 300) * 255), Math.round((y / 200) * 255), Math.round(((x + y) / 500) * 255)]);
    const p = extractPalette(img);
    expect(p.coverage).toBeLessThan(0.7);
    expect(p.warnings.join(" ")).toContain("gradients");
  });

  it("keeps a small but very different accent", () => {
    const img = image(400, 400, (x, y) => (x < 8 && y < 80 ? RED : CREAM)); // 0.4% red
    const p = extractPalette(img);
    expect(p.palette.length).toBe(2);
  });
});

describe("turning a picture into colour roles", () => {
  it("makes a 112 × 75 grid, most used colour first", () => {
    const r = makeRoles(spots(RED, CREAM), { colours: 2 });
    expect(r.grid.width).toBe(112);
    expect(r.grid.height).toBe(75);
    expect(r.shares[0]).toBeGreaterThan(r.shares[1] as number);
    expect(r.shares[0]! + r.shares[1]!).toBeCloseTo(1, 6);
  });

  it("gives the same answer every time", () => {
    const a = makeRoles(spots(RED, CREAM), { colours: 2 });
    const b = makeRoles(spots(RED, CREAM), { colours: 2 });
    expect([...b.grid.data]).toEqual([...a.grid.data]);
    expect(b.centres).toEqual(a.centres);
  });

  it("puts the picture’s top left at round 75, pair 112", () => {
    // A blue block in the top left corner of an otherwise cream picture
    const img = image(640, 316, (x, y) => (x < 80 && y < 40 ? BLUE : CREAM));
    const roles = makeRoles(img, { colours: 2, seam: "accept" });
    const chart = buildChart(roles, { kind: "two" });
    const blue = chart.yarns.find((y) => y.hex === "#" + BLUE.map((v) => v.toString(16).padStart(2, "0")).join(""));
    const minor = roles.shares[1] as number;
    expect(minor).toBeLessThan(0.2);
    // the cell in the top left of the picture is round 75, pair 112, and it is the small colour
    const small = chart.yarns[1]!.id;
    expect(outsideAt(chart, 75, 112)).toBe(small);
    expect(outsideAt(chart, 1, 1)).toBe(chart.yarns[0]!.id);
    void blue;
  });

  it("fade makes the picture tile round the hat; accept leaves a seam", () => {
    // Red on the left half, blue on the right: the right edge meets the left edge badly
    const img = image(640, 316, (x) => (x < 320 ? RED : BLUE));
    const seamMismatch = (seam: "fade" | "accept") => {
      const g = makeRoles(img, { colours: 2, seam }).grid;
      let diff = 0;
      for (let y = 0; y < g.height; y++) if (g.data[y * g.width] !== g.data[y * g.width + g.width - 1]) diff++;
      return diff / g.height;
    };
    expect(seamMismatch("accept")).toBeGreaterThan(0.9);
    // with fade the left and right edges carry the same blend, so they match
    expect(seamMismatch("fade")).toBeLessThan(0.1);
  });

  it("removes stray specks, and keeps a real shape", () => {
    // Two one-pixel specks: at most a few cells at worst, never a scatter of single stitches
    const specks = image(640, 316, (x, y) => ((x === 100 && y === 100) || (x === 400 && y === 200) ? BLUE : CREAM));
    const r = makeRoles(specks, { colours: 2, seam: "accept" });
    expect(r.shares[1]).toBeLessThanOrEqual(4 / 8400);
    // A block of 40 × 40 pixels (about 7 × 9 cells) survives
    const block = image(640, 316, (x, y) => (x > 200 && x < 240 && y > 100 && y < 140 ? BLUE : CREAM));
    expect(makeRoles(block, { colours: 2, seam: "accept" }).shares[1]).toBeGreaterThan(0.005);
  });
});

describe("charts", () => {
  it("a two-colour picture makes a valid two-colour chart", () => {
    const chart = buildChart(makeRoles(spots(RED, CREAM), { colours: 2 }), { kind: "two" }, { name: "Spots" });
    expect(validateChart(chart).ok).toBe(true);
    expect(chart.mode).toBe("two_colour");
    expect(chart.duplicate).toEqual([]);
    expect(chart.yarns.map((y) => y.name)).toEqual(["colour 1", "colour 2"]);
  });

  it("a three-colour picture embroiders the smallest colour", () => {
    const img = image(640, 316, (x, y) => {
      const cx = (x % 80) - 40;
      const cy = (y % 80) - 40;
      if (cx * cx + cy * cy < 8 * 8) return BLUE; // small centres
      return cx * cx + cy * cy < 22 * 22 ? RED : CREAM;
    });
    const roles = makeRoles(img, { colours: 3 });
    const chart = buildChart(roles, { kind: "duplicate" });
    expect(validateChart(chart).ok).toBe(true);
    expect(chart.mode).toBe("duplicate");
    expect(chart.duplicate).toHaveLength(1);
    expect(chart.duplicate[0]?.faces).toBe("both");
    const a = analyse(chart);
    expect(a.duplicateShare).toBeGreaterThan(0.01);
    expect(a.duplicateShare).toBeLessThan(0.15);
    // The knitted colours are the two biggest roles, and the embroidered one the smallest
    expect(roles.shares[2]).toBeLessThan(roles.shares[1] as number);
  });

  it("any of the three colours can be the embroidered one, and either main colour can be outside", () => {
    const roles = makeRoles(spots(RED, CREAM), { colours: 3, start: "random" });
    for (const dup of [0, 1, 2]) {
      const chart = buildChart(roles, { kind: "duplicate", dupRoles: [dup] });
      expect(validateChart(chart).ok, `dup ${dup}`).toBe(true);
    }
    const swapped = buildChart(roles, { kind: "duplicate", outsideRole: 1 });
    expect(swapped.yarns[0]?.name).toBe("colour 2");
  });

  it("the print fades out over the crown and is one colour from round 85", () => {
    const roles = makeRoles(spots(RED, CREAM), { colours: 2 });
    const chart = buildChart(roles, { kind: "two" });
    expect(validateChart(chart).ok).toBe(true);
    expect(crownPrint(chart)?.lastRound ?? 0).toBeLessThan(85);
    for (let r = 85; r <= 95; r++) for (let p = 1; p <= 112; p++) expect([null, "A"]).toContain(outsideAt(chart, r, p));
    // the fade only ever removes print, so the rounds next to the body are as printed as the body's top rounds
    const printedIn = (r: number) => Array.from({ length: 112 }, (_, p) => outsideAt(chart, r, p + 1)).filter((v) => v !== null && v !== "A").length;
    expect(printedIn(76)).toBeGreaterThanOrEqual(printedIn(82));
  });

  it("a duplicate stitch chart has no duplicate stitch from round 85", () => {
    const img = image(640, 316, (x, y) => {
      const cx = (x % 80) - 40;
      const cy = (y % 80) - 40;
      if (cx * cx + cy * cy < 8 * 8) return BLUE;
      return cx * cx + cy * cy < 22 * 22 ? RED : CREAM;
    });
    const chart = buildChart(makeRoles(img, { colours: 3 }), { kind: "duplicate" });
    expect(validateChart(chart).ok).toBe(true);
    for (const layer of chart.duplicate) for (let i = 85 - 76; i < 20; i++) expect(layer.crown[i]).not.toContain("1");
  });

  it("refuses a two-colour chart from three colours", () => {
    expect(() => buildChart(makeRoles(spots(RED, CREAM), { colours: 3 }), { kind: "two" })).toThrow(/two colours/);
  });
});

describe("more than three colours", () => {
  // Four horizontal bands of colour, like a sky, a sea and a shore
  const bands = image(640, 316, (_x, y) => (y < 79 ? BLUE : y < 158 ? CREAM : y < 237 ? GREEN : GOLD));

  it("stripes suit big areas that run in layers", () => {
    const roles = makeRoles(bands, { colours: 4 });
    const cmp = compareRoutes(roles.grid);
    expect(cmp.a.duplicateShare).toBeGreaterThan(0.4);
    expect(cmp.b.duplicateShare).toBeLessThan(0.05);
    expect(cmp.recommend).toBe("B");
    expect(cmp.b.blocks).toBeGreaterThanOrEqual(3);
  });

  it("plans two yarns for every round", () => {
    const pairs = planPairs(makeRoles(bands, { colours: 4 }).grid);
    expect(pairs).toHaveLength(75);
    for (const p of pairs) expect(p[0]).not.toBe(p[1]);
  });

  it("builds a valid striped chart with the pairs recorded for each round", () => {
    const chart = buildChart(makeRoles(bands, { colours: 4 }), { kind: "stripes" });
    expect(validateChart(chart).ok).toBe(true);
    expect(chart.mode).toBe("stripes");
    expect(chart.round_pairs).toHaveLength(75);
    expect(chart.yarns.every((y) => y.role === "stripe")).toBe(true);
    expect(crownPrint(chart)).toBeNull();
  });

  it("small scattered accents suit duplicate stitch (route A)", () => {
    const img = image(640, 316, (x, y) => {
      const cx = (x % 80) - 40;
      const cy = (y % 80) - 40;
      if (cx * cx + cy * cy < 5 * 5) return GOLD;
      if (cx * cx + cy * cy < 9 * 9 && (x + y) % 3 === 0) return GREEN;
      return cx * cx + cy * cy < 22 * 22 ? RED : CREAM;
    });
    const roles = makeRoles(img, { colours: 4 });
    const cmp = compareRoutes(roles.grid);
    expect(cmp.recommend).not.toBe("none");
    const chart = buildChart(roles, { kind: "duplicate" });
    expect(validateChart(chart).ok).toBe(true);
    expect(chart.duplicate.length).toBeGreaterThanOrEqual(1);
    expect(chart.duplicate.length).toBeLessThanOrEqual(2);
  });

  it("says there is no good route when both need too much embroidery", () => {
    // Six colours in a patchwork: every round holds all six, so neither route works
    const cols: Rgb[] = [RED, BLUE, CREAM, GREEN, GOLD, [120, 20, 140]];
    const noise = image(640, 316, (x, y) => cols[(Math.floor(x / 40) * 5 + Math.floor(y / 40) * 3) % 6] as Rgb);
    const roles = makeRoles(noise, { colours: 6 });
    expect(compareRoutes(roles.grid).recommend).toBe("none");
  });
});

describe("big pictures and real yarn colours", () => {
  it("shrinks a big picture so its longer side fits, and leaves a small one alone", () => {
    const big = image(4000, 3000, () => RED);
    const small = shrinkPixels(big, 2048);
    expect(Math.max(small.width, small.height)).toBe(2048);
    expect(small.width / small.height).toBeCloseTo(4 / 3, 2);
    expect(small.data[0]).toBe(200);
    const tiny = image(100, 50, () => RED);
    expect(shrinkPixels(tiny, 2048)).toBe(tiny);
  });

  it("uses the yarn colours and names you give it", () => {
    const roles = makeRoles(spots(RED, CREAM), { colours: 2 });
    const chart = buildChart(roles, { kind: "two" }, { yarnNames: ["navy", "coral"], yarnHex: ["#112233", "#ff6655"] });
    expect(chart.yarns.map((y) => [y.name, y.hex])).toEqual([["navy", "#112233"], ["coral", "#ff6655"]]);
    const ignored = buildChart(roles, { kind: "two" }, { yarnHex: ["blue", "#ff6655"] });
    expect(ignored.yarns[0]?.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(ignored.yarns[1]?.hex).toBe("#ff6655");
  });
});

describe("turning a sideways photo the right way up", () => {
  // A 3 × 2 picture: top row 1 2 3, bottom row 4 5 6 (the number is the red value)
  const small = (): Pixels => {
    const data = new Uint8ClampedArray(3 * 2 * 4);
    for (let i = 0; i < 6; i++) data.set([i + 1, 0, 0, 255], i * 4);
    return { width: 3, height: 2, data };
  };
  const reds = (p: Pixels) => Array.from({ length: p.width * p.height }, (_, i) => p.data[i * 4]);

  it("leaves a normal photo alone", () => {
    expect(applyOrientation(small(), 1)).toEqual(small());
  });
  it("turns each of the eight orientations the way the EXIF note says", () => {
    expect(reds(applyOrientation(small(), 2))).toEqual([3, 2, 1, 6, 5, 4]); // mirrored left to right
    expect(reds(applyOrientation(small(), 3))).toEqual([6, 5, 4, 3, 2, 1]); // upside down
    expect(reds(applyOrientation(small(), 4))).toEqual([4, 5, 6, 1, 2, 3]); // mirrored top to bottom
    const six = applyOrientation(small(), 6); // needs turning clockwise
    expect([six.width, six.height]).toEqual([2, 3]);
    expect(reds(six)).toEqual([4, 1, 5, 2, 6, 3]);
    const eight = applyOrientation(small(), 8); // needs turning anticlockwise
    expect(reds(eight)).toEqual([3, 6, 2, 5, 1, 4]);
    expect(reds(applyOrientation(small(), 5))).toEqual([1, 4, 2, 5, 3, 6]); // transpose
    expect(reds(applyOrientation(small(), 7))).toEqual([6, 3, 5, 2, 4, 1]); // transverse
  });
});

describe("tidying patches colour by colour", () => {
  const grid = (rows: string[]) => {
    const g = makeGrid(rows[0]!.length, rows.length);
    rows.forEach((r, y) => [...r].forEach((c, x) => (g.data[y * g.width + x] = Number(c))));
    return g;
  };
  const rows = ["0000000000", "0100000220", "0000000220", "0000000000", "0300000000"];

  it("removes only the small patches of the chosen colour, and leaves the others alone", () => {
    const g = grid(rows);
    const { grid: out, stats } = tidyRoles(g, 4, [undefined, { min: 2 }, undefined, undefined], false);
    expect(out.data[1 * 10 + 1]).toBe(0); // the single 1 is gone
    expect(out.data[1 * 10 + 7]).toBe(2); // the 2×2 patch of colour 2 is untouched
    expect(out.data[4 * 10 + 1]).toBe(3); // a single 3 is not being tidied, so it stays
    expect(stats[1]).toEqual({ keptPatches: 0, keptCells: 0, smallest: null, removedPatches: 1, removedCells: 1 });
  });

  it("can leave a colour out altogether, and reports how much each colour kept", () => {
    const g = grid(rows);
    const { grid: out, stats } = tidyRoles(g, 4, [undefined, undefined, { min: 1, leave: true }, undefined], false);
    expect([...out.data].includes(2)).toBe(false);
    expect(stats[2]?.removedCells).toBe(4);
    const kept = tidyRoles(g, 4, [undefined, undefined, { min: 4 }, undefined], false).stats[2];
    expect(kept).toMatchObject({ keptPatches: 1, keptCells: 4, smallest: 4, removedPatches: 0 });
  });

  it("never gives more duplicate stitch as the smallest patch grows", () => {
    const g = makeGrid(40, 20);
    let seed = 1;
    for (let i = 0; i < g.data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      g.data[i] = seed % 7 === 0 ? 1 : 0;
    }
    let last = Infinity;
    for (let min = 1; min <= 12; min++) {
      const cells = tidyRoles(g, 2, [undefined, { min }], true).stats[1]!.keptCells;
      expect(cells).toBeLessThanOrEqual(last);
      last = cells;
    }
  });
});

describe("tiling a picture across the hat", () => {
  const picture = (w: number, h: number): Pixels => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([(x * 255) / w, (y * 255) / h, (x * y) % 255, 255], (y * w + x) * 4);
    return { width: w, height: h, data };
  };

  it("makes a picture the shape of the fabric", () => {
    const out = tilePixels(picture(40, 30), { across: 4, mirror: true });
    expect(out.width).toBe(TILE_WIDTH);
    expect(out.width / out.height).toBeCloseTo(FABRIC_ASPECT, 1);
  });

  it("joins up round the hat when the copies are mirrored", () => {
    for (const across of [2, 4, 8, 14]) {
      const out = tilePixels(picture(40, 30), { across, mirror: true });
      for (let y = 0; y < out.height; y += 7) {
        const left = [...out.data.slice(y * out.width * 4, y * out.width * 4 + 4)];
        const right = [...out.data.slice((y * out.width + out.width - 1) * 4, (y * out.width + out.width) * 4)];
        expect(right).toEqual(left);
      }
    }
  });
});

describe("mergeRoles", () => {
  it("joins one colour into another and drops it", () => {
    const grid = makeGrid(4, 1);
    grid.data.set([0, 0, 1, 2]);
    const roles = { grid, centres: [[0, 0, 0], [255, 0, 0], [0, 255, 0]] as [number, number, number][], shares: [0.5, 0.25, 0.25], seam: "accept" as const };
    const { roles: out, order } = mergeRoles(roles, 2, 1);
    expect(out.centres).toHaveLength(2);
    expect(out.centres[1]).toEqual([255, 0, 0]);
    expect(Array.from(out.grid.data)).toEqual([0, 0, 1, 1]);
    expect(order).toEqual([0, 1]);
  });
});

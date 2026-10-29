import { describe, expect, it } from "vitest";
import {
  NO_SYMMETRY,
  REPEATS,
  addDuplicateLayer,
  analyse,
  crownLayout,
  floodFill,
  newBlankChart,
  outsideAt,
  paintCell,
  removeDuplicateLayer,
  setDuplicate,
  setOutside,
  setYarnLook,
  symmetricCells,
  validateChart,
} from "../src";
import type { Chart } from "../src";
import { loadLeopard } from "./helpers";

const valid = (c: Chart) => {
  const r = validateChart(c);
  return r.ok ? [] : r.errors.map((e) => e.message);
};

describe("painting", () => {
  it("sets the outside yarn of a pair", () => {
    const c = newBlankChart("t");
    expect(setOutside(c, 10, 20, "B")).toBe(true);
    expect(outsideAt(c, 10, 20)).toBe("B");
    expect(setOutside(c, 10, 20, "B")).toBe(false); // already B
  });

  it("refuses a yarn that isn’t one of the round’s two yarns", () => {
    const c = newBlankChart("t");
    expect(setOutside(c, 10, 20, "C")).toBe(false);
  });

  it("can’t paint the crown: it is the same for every hat", () => {
    const c = newBlankChart("t");
    expect(setOutside(c, 76, 2, "B")).toBe(false);
    expect(setOutside(c, 90, 5, "B")).toBe(false);
    expect(setOutside(c, 75, 2, "B")).toBe(true);
    expect(outsideAt(c, 80, 5)).toBe("A");
  });
});

describe("duplicate stitch layers", () => {
  it("adds a layer, which turns the chart into a duplicate stitch chart", () => {
    const c = newBlankChart("t");
    const i = addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    expect(i).toBe(0);
    expect(c.mode).toBe("duplicate");
    expect(c.yarns.map((y) => y.id)).toEqual(["A", "B", "C"]);
    expect(valid(c)).toEqual([]);
  });

  it("allows four layers and no more", () => {
    const c = newBlankChart("t");
    for (let i = 0; i < 4; i++) expect(addDuplicateLayer(c, { name: `d${i}`, hex: "#112233" })).toBe(i);
    expect(addDuplicateLayer(c, { name: "x", hex: "#112233" })).toBeNull();
    expect(valid(c)).toEqual([]);
  });

  it("removing the last layer goes back to two colours", () => {
    const c = newBlankChart("t");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    expect(removeDuplicateLayer(c, 0)).toBe(true);
    expect(c.mode).toBe("two_colour");
    expect(c.yarns).toHaveLength(2);
    expect(valid(c)).toEqual([]);
  });

  it("a cell is in only one layer", () => {
    const c = newBlankChart("t");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    addDuplicateLayer(c, { name: "gold", hex: "#d0a02a" });
    expect(setDuplicate(c, 0, 5, 5, true)).toBe(true);
    expect(setDuplicate(c, 1, 5, 5, true)).toBe(true);
    expect(c.duplicate[0]!.body[4]![4]).toBe("0");
    expect(c.duplicate[1]!.body[4]![4]).toBe("1");
    expect(valid(c)).toEqual([]);
  });

  it("changes a yarn’s name and colour, but only to a real colour", () => {
    const c = newBlankChart("t");
    setYarnLook(c, "A", { name: "navy", hex: "#112233" });
    setYarnLook(c, "B", { hex: "pink" });
    expect(c.yarns[0]).toMatchObject({ name: "navy", hex: "#112233" });
    expect(c.yarns[1]?.hex).toBe("#f26b5b");
  });
});

describe("fill", () => {
  it("fills a region and stops at a different colour", () => {
    const c = newBlankChart("t");
    for (let r = 1; r <= 75; r++) setOutside(c, r, 30, "B"); // a wall at pair 30
    const changed = floodFill(c, { kind: "main" }, 10, 31, "B");
    expect(changed.length).toBeGreaterThan(0);
    expect(outsideAt(c, 10, 31)).toBe("B");
    expect(outsideAt(c, 10, 29)).toBe("B"); // the wall itself was B, and the fill wraps all the way round
  });

  it("wraps across the seam", () => {
    const c = newBlankChart("t");
    // A ring of B around a block that crosses the seam (pairs 110 to 112 and 1 to 3, rounds 20 to 22)
    const ring: [number, number][] = [];
    for (const r of [19, 23]) for (let p = 109; p <= 116; p++) ring.push([r, ((p - 1) % 112) + 1]);
    for (const r of [20, 21, 22]) ring.push([r, 109], [r, 4]);
    ring.forEach(([r, p]) => setOutside(c, r, p, "B"));
    const changed = floodFill(c, { kind: "main" }, 21, 112, "B");
    expect(changed).toHaveLength(3 * 6); // rounds 20-22 by pairs 110,111,112,1,2,3
    expect(outsideAt(c, 21, 1)).toBe("B");
  });

  it("fills a duplicate layer", () => {
    const c = newBlankChart("t");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    for (let r = 10; r <= 14; r++) for (let p = 10; p <= 14; p++) paintCell(c, { kind: "duplicate", index: 0 }, r, p, "1");
    const changed = floodFill(c, { kind: "duplicate", index: 0 }, 12, 12, "0");
    expect(changed).toHaveLength(25);
  });

  it("does nothing if the cell already has the value", () => {
    const c = newBlankChart("t");
    expect(floodFill(c, { kind: "main" }, 5, 5, "A")).toEqual([]);
  });
});

describe("symmetry", () => {
  it("mirror across the seam pairs 1 with 112 and 56 with 57", () => {
    const cells = symmetricCells(10, 1, { ...NO_SYMMETRY, mirrorX: true });
    expect(cells.map((c) => c.pair).sort((a, b) => a - b)).toEqual([1, 112]);
    const mid = symmetricCells(10, 56, { ...NO_SYMMETRY, mirrorX: true });
    expect(mid.map((c) => c.pair).sort((a, b) => a - b)).toEqual([56, 57]);
  });

  it("mirror top to bottom pairs round 1 with 75", () => {
    expect(symmetricCells(1, 5, { ...NO_SYMMETRY, mirrorY: true }).map((c) => c.round).sort((a, b) => a - b)).toEqual([1, 75]);
  });

  it("repeats evenly round the hat", () => {
    for (const n of REPEATS) {
      const cells = symmetricCells(10, 3, { ...NO_SYMMETRY, repeat: n });
      expect(cells).toHaveLength(n);
      expect(new Set(cells.map((c) => c.pair)).size).toBe(n);
    }
    expect(symmetricCells(10, 3, { ...NO_SYMMETRY, repeat: 4 }).map((c) => c.pair).sort((a, b) => a - b)).toEqual([3, 31, 59, 87]);
  });

  it("combines all three, and never reaches into the crown", () => {
    expect(symmetricCells(10, 3, { mirrorX: true, mirrorY: true, repeat: 4 })).toHaveLength(4 * 2 * 2);
    expect(symmetricCells(76, 2, { ...NO_SYMMETRY, repeat: 8 })).toHaveLength(0);
    expect(symmetricCells(75, 2, { mirrorX: false, mirrorY: true, repeat: 1 }).map((c) => c.round).sort((a, b) => a - b)).toEqual([1, 75]);
  });
});

describe("any sequence of edits leaves the chart valid", () => {
  it("2,000 random edits", () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const c = newBlankChart("fuzz");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    addDuplicateLayer(c, { name: "gold", hex: "#d0a02a" });
    for (let i = 0; i < 2000; i++) {
      const round = 1 + rnd(95);
      const pair = 1 + rnd(112);
      const kind = rnd(5);
      if (kind === 0) setOutside(c, round, pair, rnd(2) ? "A" : "B");
      else if (kind === 1) setDuplicate(c, rnd(2), round, pair, rnd(2) === 1);
      else if (kind === 2) floodFill(c, { kind: "main" }, round, pair, rnd(2) ? "A" : "B");
      else if (kind === 3) floodFill(c, { kind: "duplicate", index: rnd(2) }, round, pair, rnd(2) ? "1" : "0");
      else for (const cell of symmetricCells(round, pair, { mirrorX: rnd(2) === 1, mirrorY: rnd(2) === 1, repeat: REPEATS[rnd(REPEATS.length)] as number })) setOutside(c, cell.round, cell.pair, "B");
    }
    expect(valid(c)).toEqual([]);
  });
});

describe("analysis", () => {
  it("warns about a hat that is one colour so far", () => {
    const a = analyse(newBlankChart("t"));
    expect(a.warnings.map((w) => w.code)).toContain("one_colour");
    expect(a.totalCells).toBe(8400);
  });

  it("the leopard has about 21% duplicate stitch, which gets a warning", () => {
    const a = analyse(loadLeopard());
    expect(a.duplicate[0]?.cells).toBe(1758);
    expect(a.duplicate[0]?.patches).toBe(31);
    expect(a.duplicateShare).toBeCloseTo(0.2093, 3);
    expect(a.warnings.map((w) => w.code)).toContain("duplicate_a_lot");
    expect(a.warnings.some((w) => w.level === "stop")).toBe(false);
  });

  it("stops above 25% duplicate stitch", () => {
    const c = newBlankChart("t");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    for (let r = 1; r <= 30; r++) for (let p = 1; p <= 112; p++) setDuplicate(c, 0, r, p, true);
    const a = analyse(c);
    expect(a.warnings.find((w) => w.level === "stop")?.code).toBe("duplicate_too_much");
  });

  it("warns about several single-square patches", () => {
    const c = newBlankChart("t");
    addDuplicateLayer(c, { name: "blue", hex: "#2a5fd0" });
    for (const p of [5, 15, 25]) setDuplicate(c, 0, 10, p, true);
    expect(analyse(c).warnings.map((w) => w.code)).toContain("duplicate_specks");
  });

  it("shares of the outside add up to 1", () => {
    const a = analyse(loadLeopard());
    const total = Object.values(a.outsideShare).reduce((x, y) => x + y, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

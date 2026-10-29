import { describe, expect, it } from "vitest";
import type { Patch } from "@doubletake/core";
import { patchWindow } from "../src/lib/patchView";

const patch = (cells: [number, number][]): Patch => ({
  index: 0,
  yarn: "C",
  faces: "both",
  cells: cells.map(([round, pair]) => ({ round, pair })),
});

describe("patchWindow", () => {
  it("shows a margin around a simple patch, outside from the right", () => {
    const w = patchWindow(patch([[10, 20], [10, 21], [11, 21]]));
    expect(w.outsideCols).toEqual([22, 21, 20, 19]);
    expect(w.insideCols).toEqual([19, 20, 21, 22]);
    expect(w.rows).toEqual([12, 11, 10, 9]);
    expect([w.firstRound, w.lastRound]).toEqual([10, 11]);
  });

  it("the inside is the mirror image of the outside", () => {
    const w = patchWindow(patch([[5, 40], [5, 45]]));
    expect([...w.outsideCols].reverse()).toEqual(w.insideCols);
  });

  it("keeps a patch that crosses the seam in one piece", () => {
    const w = patchWindow(patch([[20, 111], [20, 112], [20, 1], [20, 2]]));
    expect(w.insideCols).toEqual([110, 111, 112, 1, 2, 3]);
    expect(w.outsideCols).toEqual([3, 2, 1, 112, 111, 110]);
  });

  it("doesn’t go below round 1 or above round 75, the top of the body", () => {
    expect(patchWindow(patch([[1, 5]])).rows).toEqual([2, 1]);
    expect(patchWindow(patch([[75, 5]])).rows).toEqual([75, 74]);
  });

  it("copes with a single cell", () => {
    const w = patchWindow(patch([[30, 56]]));
    expect(w.insideCols).toEqual([55, 56, 57]);
  });
});

import { describe, expect, it } from "vitest";
import { crownLayout, findAllPatches, findPatches } from "../src";
import type { Cell, DuplicateLayer } from "../src";
import { blankDuplicateChart, loadLeopard, setChar } from "./helpers";

/** A layer with duplicate stitch at the given (round, pair) cells. */
function layerWith(cells: [number, number][]): DuplicateLayer {
  const chart = blankDuplicateChart(1);
  const layer = chart.duplicate[0] as DuplicateLayer;
  for (const [round, pair] of cells) {
    if (round <= 75) layer.body[round - 1] = setChar(layer.body[round - 1] as string, pair - 1, "1");
    else layer.crown[round - 76] = setChar(layer.crown[round - 76] as string, pair - 1, "1");
  }
  return layer;
}

const keys = (cells: Cell[]) => cells.map((c) => `${c.round}:${c.pair}`);

describe("patch rules", () => {
  it("side-by-side cells join", () => {
    expect(findPatches(layerWith([[5, 10], [5, 11], [6, 11]]))).toHaveLength(1);
  });

  it("diagonal cells join", () => {
    expect(findPatches(layerWith([[5, 10], [6, 11]]))).toHaveLength(1);
  });

  it("cells with a gap are separate patches", () => {
    expect(findPatches(layerWith([[5, 10], [5, 12]]))).toHaveLength(2);
  });

  it("wraps across the seam: pair 112 joins pair 1", () => {
    const patches = findPatches(layerWith([[20, 112], [20, 1]]));
    expect(patches).toHaveLength(1);
    expect(patches[0]?.cells).toHaveLength(2);
  });

  it("joins diagonally across the seam", () => {
    expect(findPatches(layerWith([[20, 112], [21, 1]]))).toHaveLength(1);
  });

  it("joins across the Chart A / Chart B split at pair 56/57", () => {
    expect(findPatches(layerWith([[30, 56], [30, 57]]))).toHaveLength(1);
  });

  it("runs from the body into the crown", () => {
    expect(findPatches(layerWith([[75, 30], [76, 30]]))).toHaveLength(1);
  });

  it("joins across a pair removed by a decrease", () => {
    // Round 76 removes pair 1 of each wedge (pairs 1, 15, ...), so pairs 112 and 2 sit either side of pair 1.
    expect(crownLayout(76).present[0]).toBe(false);
    expect(findPatches(layerWith([[76, 112], [76, 2]]))).toHaveLength(1);
  });

  it("does not join cells that only touch through a longer gap", () => {
    expect(findPatches(layerWith([[76, 112], [76, 4]]))).toHaveLength(2);
  });

  it("numbers patches from the bottom of the hat and sorts their cells", () => {
    const patches = findPatches(layerWith([[40, 5], [10, 50], [10, 51], [10, 49]]));
    expect(patches.map((p) => p.index)).toEqual([0, 1]);
    expect(keys(patches[0]?.cells ?? [])).toEqual(["10:49", "10:50", "10:51"]);
    expect(keys(patches[1]?.cells ?? [])).toEqual(["40:5"]);
  });

  it("carries the layer’s yarn and faces", () => {
    const [patch] = findPatches(layerWith([[3, 3]]));
    expect(patch?.yarn).toBe("C");
    expect(patch?.faces).toBe("both");
  });

  it("an empty layer has no patches", () => {
    expect(findPatches(layerWith([]))).toEqual([]);
  });
});

describe("the leopard", () => {
  it("has 39 patches and 2,011 duplicate cells under the spec rules", () => {
    // 40 if pairs removed by a decrease are treated as a break; 39 once patches join across them (spec 9.4).
    // Both figures were confirmed with an independent Python check.
    const [layer] = findAllPatches(loadLeopard());
    expect(layer).toHaveLength(39);
    expect(layer?.reduce((n, p) => n + p.cells.length, 0)).toBe(2011);
  });

  it("its smallest patch is one cell and its largest is 95", () => {
    const [layer] = findAllPatches(loadLeopard());
    const sizes = (layer ?? []).map((p) => p.cells.length);
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBe(95);
  });

  it("no cell is in two patches", () => {
    const [layer] = findAllPatches(loadLeopard());
    const all = (layer ?? []).flatMap((p) => keys(p.cells));
    expect(new Set(all).size).toBe(all.length);
  });
});

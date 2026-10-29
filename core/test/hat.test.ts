import { describe, expect, it } from "vitest";
import {
  CELL_ASPECT,
  CROWN_PAIRS_PER_ROUND,
  NEEDLE_STITCHES,
  PAIRS,
  crownLayout,
  pairsInRound,
  wedgeDecrease,
} from "../src";

describe("the fixed hat", () => {
  it("has the constants from the spec", () => {
    expect(PAIRS).toBe(112);
    expect(NEEDLE_STITCHES).toBe(224);
    expect(CELL_ASPECT).toBeCloseTo(1.36, 5);
  });

  it("the crown layout matches the pairs-per-round table for every round", () => {
    CROWN_PAIRS_PER_ROUND.forEach((expected, i) => {
      expect(crownLayout(76 + i).pairs).toBe(expected);
    });
  });

  it("there are 16 pairs (32 stitches) left after round 95", () => {
    expect(pairsInRound(95)).toBe(16);
    expect(pairsInRound(95) * 2).toBe(32);
  });

  it("body rounds all have 112 pairs", () => {
    expect(pairsInRound(1)).toBe(112);
    expect(pairsInRound(75)).toBe(112);
  });

  it("every decrease removes the pair just before the marked pair, in all eight wedges", () => {
    for (let round = 76; round <= 95; round++) {
      const dec = wedgeDecrease(round);
      if (!dec) continue;
      const before = round === 76 ? undefined : crownLayout(round - 1);
      const after = crownLayout(round);
      dec.marked.forEach((w, k) => {
        const removedW = dec.removed[k] as number;
        for (let wedge = 0; wedge < 8; wedge++) {
          const marked = wedge * 14 + w - 1;
          const removed = wedge * 14 + removedW - 1;
          expect(after.marked[marked]).toBe(true);
          expect(after.present[marked]).toBe(true);
          expect(after.present[removed]).toBe(false);
          if (before) expect(before.present[removed]).toBe(true);
        }
      });
    }
  });

  it("decrease rounds are 76, 78 … 92, then 94 and 95", () => {
    const rounds = Array.from({ length: 20 }, (_, i) => 76 + i).filter((r) => wedgeDecrease(r));
    expect(rounds).toEqual([76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 95]);
  });

  it("rejects rounds outside the crown", () => {
    expect(() => crownLayout(75)).toThrow(RangeError);
    expect(() => crownLayout(96)).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";
import {
  BODY_ROUNDS,
  CELL_ASPECT,
  CHART_A_LAST_PAIR,
  CROWN_ROUNDS,
  GAUGE,
  WEDGE_PAIRS,
  CROWN_PAIRS_PER_ROUND,
  NEEDLE_STITCHES,
  PAIRS,
  crownLayout,
  pairsInRound,
  wedgeDecrease,
} from "../src";

describe("the fixed hat", () => {
  it("has the constants from the spec", () => {
    expect(PAIRS).toBe(136);
    expect(NEEDLE_STITCHES).toBe(272);
    expect(BODY_ROUNDS).toBe(95);
    expect(CROWN_ROUNDS).toBe(26);
    expect(GAUGE).toEqual({ pairs: 32, rounds: 44, overInches: 4 });
    expect(CELL_ASPECT).toBeCloseTo(1.375, 5);
    expect(WEDGE_PAIRS).toBe(17);
    expect(CHART_A_LAST_PAIR).toBe(68);
  });

  it("the crown layout matches the pairs-per-round table for every round", () => {
    CROWN_PAIRS_PER_ROUND.forEach((expected, i) => {
      expect(crownLayout(96 + i).pairs).toBe(expected);
    });
  });

  it("there are 16 pairs (32 stitches) left after round 121", () => {
    expect(pairsInRound(121)).toBe(16);
    expect(pairsInRound(121) * 2).toBe(32);
  });

  it("body rounds all have 136 pairs", () => {
    expect(pairsInRound(1)).toBe(136);
    expect(pairsInRound(95)).toBe(136);
  });

  it("every decrease removes the pair just before the marked pair, in all eight wedges", () => {
    for (let round = 96; round <= 121; round++) {
      const dec = wedgeDecrease(round);
      if (!dec) continue;
      const before = round === 96 ? undefined : crownLayout(round - 1);
      const after = crownLayout(round);
      dec.marked.forEach((w, k) => {
        const removedW = dec.removed[k] as number;
        for (let wedge = 0; wedge < 8; wedge++) {
          const marked = wedge * 17 + w - 1;
          const removed = wedge * 17 + removedW - 1;
          expect(after.marked[marked]).toBe(true);
          expect(after.present[marked]).toBe(true);
          expect(after.present[removed]).toBe(false);
          if (before) expect(before.present[removed]).toBe(true);
        }
      });
    }
  });

  it("decrease rounds are 96, 98 … 118, then 120 and 121", () => {
    const rounds = Array.from({ length: 26 }, (_, i) => 96 + i).filter((r) => wedgeDecrease(r));
    expect(rounds).toEqual([96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 121]);
  });

  it("rejects rounds outside the crown", () => {
    expect(() => crownLayout(95)).toThrow(RangeError);
    expect(() => crownLayout(122)).toThrow(RangeError);
  });
});

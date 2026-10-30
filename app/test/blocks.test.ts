import { describe, expect, it } from "vitest";
import { LAST_ROUND, newBlankChart, outsideAt } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { blocksFor, currentBlockIndex, pairAfterBlock, stepPair, wholeRoundText } from "../src/lib/blocks";
import { coloursAreClose } from "../src/lib/marks";
import leopard from "../../fixtures/leopard/leopard.doubletake.json";
import stripes from "../../fixtures/stripes/bands.doubletake.json";

const plain = () => {
  const chart = newBlankChart("t", [{ name: "navy", hex: "#112233" }, { name: "coral", hex: "#ff6655" }]);
  chart.body[0] = "A".repeat(10) + "B".repeat(5) + "A".repeat(97);
  return chart;
};

describe("colour blocks", () => {
  it("splits a round into runs in the order worked", () => {
    const blocks = blocksFor(plain(), 1);
    expect(blocks.map((b) => [b.name, b.count, b.from, b.to])).toEqual([
      ["navy", 10, 1, 10],
      ["coral", 5, 11, 15],
      ["navy", 97, 16, 112],
    ]);
  });

  it("moves the marker one block at a time and stops after the last", () => {
    const blocks = blocksFor(plain(), 1);
    expect(currentBlockIndex(blocks, null)).toBe(0);
    expect(pairAfterBlock(blocks, null)).toBe(10);
    expect(pairAfterBlock(blocks, 10)).toBe(15);
    expect(pairAfterBlock(blocks, 12)).toBe(15); // part way through a block: it finishes that block
    expect(pairAfterBlock(blocks, 15)).toBe(112);
    expect(pairAfterBlock(blocks, 112)).toBeNull();
  });

  it("skips pairs the crown removed, and gives each decrease its own block", () => {
    const chart = newBlankChart("t");
    const blocks = blocksFor(chart, 76);
    expect(blocks.some((b) => b.decrease)).toBe(true);
    expect(blocks.every((b) => b.count >= 1)).toBe(true);
    expect(blocks[0]?.from).toBeGreaterThan(1); // pair 1 is removed in round 76
    expect(wholeRoundText(chart, 76).runs).toContain("skip the blanks");
  });

  it("steps a stitch at a time but never lands on a removed pair", () => {
    const chart = newBlankChart("t");
    expect(outsideAt(chart, 76, 1)).toBeNull();
    const first = stepPair(chart, 76, null, 1) as number;
    expect(outsideAt(chart, 76, first)).not.toBeNull();
    expect(stepPair(chart, 76, first, -1)).toBeNull();
  });

  it("covers every present pair exactly once, on every round of both examples", () => {
    for (const chart of [leopard, stripes] as unknown as Chart[]) {
      for (let round = 1; round <= LAST_ROUND; round++) {
        const seen: (string | null)[] = [];
        for (const b of blocksFor(chart, round)) for (let i = 0; i < b.count; i++) seen.push(b.yarn);
        const expected: string[] = [];
        for (let pair = 1; pair <= 112; pair++) {
          const id = outsideAt(chart, round, pair);
          if (id !== null) expected.push(id);
        }
        expect(seen).toEqual(expected);
      }
    }
  });
});

describe("close colours", () => {
  it("flags two near-identical yarns and not two clear ones", () => {
    const close = newBlankChart("t", [{ name: "navy", hex: "#101a40" }, { name: "black", hex: "#0c0c10" }]);
    const clear = newBlankChart("t", [{ name: "navy", hex: "#112233" }, { name: "coral", hex: "#ff6655" }]);
    expect(coloursAreClose(close)).toBe(true);
    expect(coloursAreClose(clear)).toBe(false);
  });
});

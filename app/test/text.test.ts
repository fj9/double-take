import { describe, expect, it } from "vitest";
import { newBlankChart, outsideAt } from "@doubletake/core";
import { roundText } from "../src/lib/text";

describe("roundText", () => {
  it("describes a plain round in runs, in the order worked", () => {
    const chart = newBlankChart("t", [{ name: "navy", hex: "#112233" }, { name: "coral", hex: "#ff6655" }]);
    chart.body[0] = "A".repeat(10) + "B".repeat(5) + "A".repeat(97);
    const a = roundText(chart, 1, "A");
    expect(a.heading).toBe("Chart A, pairs 1–56");
    expect(a.runs).toBe("navy × 10, coral × 5, navy × 41");
    expect(roundText(chart, 1, "B").runs).toBe("navy × 56");
  });

  it("marks decreases and skips removed pairs in the crown", () => {
    const chart = newBlankChart("t");
    expect(outsideAt(chart, 76, 1)).toBeNull(); // pair 1 is removed in round 76
    const a = roundText(chart, 76, "A");
    expect(a.runs).toContain("(right-leaning decrease)");
    expect(a.runs).toContain("skip the blanks");
  });
});

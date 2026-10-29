import { describe, expect, it } from "vitest";
import { crownGround, crownLayout, insideAt, newBlankChart, outsideAt, parseChartJson, validateChart } from "../src";
import type { Chart } from "../src";
import { readFileSync } from "node:fs";
import { blankDuplicateChart, clone, loadLeopard, setChar } from "./helpers";

function codes(chart: unknown): string[] {
  const result = validateChart(chart);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe("valid charts", () => {
  it("the leopard example is valid", () => {
    const result = validateChart(loadLeopard());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("a blank chart is valid", () => {
    expect(validateChart(newBlankChart("blank")).ok).toBe(true);
  });

  it("an older file with crown fields still loads: the crown is ignored", () => {
    const old = { ...loadLeopard(), crown: { variant: "patterned", plain_from: null, rounds: ["x"] } } as unknown;
    expect(validateChart(old).ok).toBe(true);
  });

  it("parses the leopard from JSON text", () => {
    expect(parseChartJson(JSON.stringify(loadLeopard())).ok).toBe(true);
  });
});

describe("files that are not charts", () => {
  it("text that isn’t JSON gives a clear error", () => {
    const result = parseChartJson("hello");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe("not_json");
  });

  it("an unknown schema version is refused with a clear message", () => {
    const chart = { ...loadLeopard(), schema: "doubletake-chart/2" };
    const result = validateChart(chart);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("schema_version");
      expect(result.errors[0]?.message).toContain("doubletake-chart/2");
    }
  });

  it("other JSON is not a chart", () => {
    expect(codes({ hello: 1 })).toEqual(["not_a_chart"]);
    expect(codes([1, 2])).toEqual(["not_a_chart"]);
    expect(codes(null)).toEqual(["not_a_chart"]);
    expect(codes({ schema: "something-else" })).toEqual(["not_a_chart"]);
  });
});

describe("shape and dimensions", () => {
  it("rejects different dimensions", () => {
    const c = loadLeopard();
    c.dimensions.pairs = 100;
    expect(codes(c)).toContain("dimensions");
  });

  it("rejects a body with the wrong number of rounds", () => {
    const c = loadLeopard();
    c.body.pop();
    expect(codes(c)).toContain("shape");
  });

  it("names the round when a row is the wrong length", () => {
    const c = loadLeopard();
    c.body[11] = (c.body[11] as string).slice(0, 111);
    const result = validateChart(c);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toContain("Round 12");
  });

});

describe("yarns and the two-colours-per-round rule", () => {
  it("rejects a character that isn’t a defined yarn", () => {
    const c = loadLeopard();
    c.body[3] = setChar(c.body[3] as string, 10, "F");
    expect(codes(c)).toContain("undefined_yarn");
  });

  it("rejects a yarn that isn’t one of the round’s two yarns", () => {
    const c = loadLeopard();
    c.body[3] = setChar(c.body[3] as string, 10, "C"); // C is the duplicate yarn, not worked in the body
    expect(codes(c)).toContain("not_in_pair");
  });

  it("rejects bad yarn ids, colours and duplicates", () => {
    const c = loadLeopard();
    c.yarns[0]!.id = "Z";
    expect(codes(c)).toContain("yarn_id");
    const d = loadLeopard();
    d.yarns[1]!.hex = "pink";
    expect(codes(d)).toContain("yarn_hex");
    const e = loadLeopard();
    e.yarns[1]!.id = "A";
    expect(codes(e)).toContain("yarn_id");
  });

  it("rejects a two-colour chart with a duplicate layer", () => {
    const c = newBlankChart("x");
    c.duplicate.push({ yarn: "A", faces: "both", body: c.body });
    expect(codes(c)).toContain("duplicate");
  });

  it("only striped charts have round_pairs", () => {
    const c = loadLeopard();
    c.round_pairs = [["A", "B"]];
    expect(codes(c)).toContain("round_pairs");
  });
});

describe("the crown", () => {
  it("is the same for every hat: yarn A outside, the other colour inside, with the decreases' blank pairs", () => {
    const c = newBlankChart("t");
    expect(crownGround(c)).toBe("A");
    expect(outsideAt(c, 76, 2)).toBe("A");
    expect(insideAt(c, 76, 2)).toBe("B");
    expect(crownLayout(76).present[0]).toBe(false);
    expect(outsideAt(c, 76, 1)).toBeNull();
    expect(insideAt(c, 76, 1)).toBeNull();
    expect(outsideAt(c, 95, 14)).toBe("A"); // pairs 12 and 14 of each wedge are the last to go
    expect(outsideAt(c, 95, 3)).toBeNull(); // pair 3 of the wedge was removed by round 78
  });

  it("does not depend on the print in the body, even if the top rounds are the other colour", () => {
    const c = newBlankChart("t");
    c.body[74] = "B".repeat(112);
    expect(outsideAt(c, 80, 5)).toBe("A");
  });

  it("in a striped hat it is the first yarn of the top round's pair", () => {
    const c = JSON.parse(readFileSync(new URL("../../fixtures/stripes/bands.doubletake.json", import.meta.url), "utf-8"));
    expect(crownGround(c)).toBe(c.round_pairs[74][0]);
    expect(insideAt(c, 90, 14)).toBe(c.round_pairs[74][1]);
  });
});

describe("duplicate stitch layers", () => {
  it("rejects a cell in two layers", () => {
    const c: Chart = blankDuplicateChart(2);
    c.duplicate[0]!.body[5] = setChar(c.duplicate[0]!.body[5] as string, 7, "1");
    c.duplicate[1]!.body[5] = setChar(c.duplicate[1]!.body[5] as string, 7, "1");
    expect(codes(c)).toContain("duplicate_overlap");
  });

  it("rejects characters other than 0 and 1", () => {
    const c = clone(loadLeopard());
    c.duplicate[0]!.body[0] = setChar(c.duplicate[0]!.body[0] as string, 0, "x");
    expect(codes(c)).toContain("duplicate_char");
  });

  it("rejects an unknown faces value", () => {
    const c = loadLeopard();
    (c.duplicate[0] as { faces: string }).faces = "inside";
    expect(codes(c)).toContain("faces");
  });

  it("allows up to four layers and refuses five", () => {
    expect(validateChart(blankDuplicateChart(4)).ok).toBe(true);
    const five = blankDuplicateChart(4);
    five.yarns.push({ id: "A", name: "x", hex: "#000000", role: "duplicate" });
    expect(validateChart(five).ok).toBe(false);
  });

  it("a duplicate stitch chart needs at least one layer", () => {
    const c = blankDuplicateChart(1);
    c.duplicate = [];
    expect(codes(c)).toContain("duplicate");
  });
});

it("reports at most 50 errors", () => {
  const c = loadLeopard();
  c.body = c.body.map((r) => r.replaceAll("A", "F"));
  const result = validateChart(c);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.length).toBeLessThanOrEqual(50);
});

import { describe, expect, it } from "vitest";
import { crownLayout, newBlankChart, parseChartJson, validateChart, withPlainCrown } from "../src";
import type { Chart } from "../src";
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

  it("the leopard with a fully plain crown is valid", () => {
    const plain = withPlainCrown(loadLeopard(), 76);
    const result = validateChart(plain);
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(plain.crown.variant).toBe("plain");
  });

  it("a crown that is plain from round 86 keeps the print before it", () => {
    const leopard = loadLeopard();
    const plain = withPlainCrown(leopard, 86);
    expect(validateChart(plain).ok).toBe(true);
    expect(plain.crown.rounds[0]).toBe(leopard.crown.rounds[0]);
    expect(new Set(plain.crown.rounds[10]!.replaceAll(".", ""))).toEqual(new Set(["A"]));
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

  it("rejects a crown with the wrong number of rounds", () => {
    const c = loadLeopard();
    c.crown.rounds.pop();
    expect(codes(c)).toContain("shape");
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
    c.duplicate.push({ yarn: "A", faces: "both", body: c.body, crown: c.crown.rounds });
    expect(codes(c)).toContain("duplicate");
  });

  it("only striped charts have round_pairs", () => {
    const c = loadLeopard();
    c.round_pairs = [["A", "B"]];
    expect(codes(c)).toContain("round_pairs");
  });
});

describe("the crown", () => {
  it("rejects a letter where a pair has been removed", () => {
    const c = loadLeopard();
    const removedAt = crownLayout(76).present.indexOf(false); // pair 1
    c.crown.rounds[0] = setChar(c.crown.rounds[0] as string, removedAt, "A");
    expect(codes(c)).toContain("crown_layout");
  });

  it("rejects a dot where a pair should still exist", () => {
    const c = loadLeopard();
    c.crown.rounds[0] = setChar(c.crown.rounds[0] as string, 40, ".");
    expect(codes(c)).toContain("crown_layout");
  });

  it("rejects a pair that comes back after being removed", () => {
    const c = loadLeopard();
    const i = crownLayout(76).present.indexOf(false);
    c.crown.rounds[10] = setChar(c.crown.rounds[10] as string, i, "A");
    expect(codes(c)).toContain("crown_layout");
  });

  it("a patterned crown must have plain_from null", () => {
    const c = loadLeopard();
    c.crown.plain_from = 80;
    expect(codes(c)).toContain("plain_from");
  });

  it("a plain crown needs plain_from, and its plain rounds must be yarn A", () => {
    const c = loadLeopard();
    c.crown.variant = "plain";
    expect(codes(c)).toContain("plain_from");
    c.crown.plain_from = 76;
    expect(codes(c)).toContain("plain_crown"); // the print is still there
  });
});

describe("duplicate stitch layers", () => {
  it("rejects a duplicate cell on a removed pair", () => {
    const c = loadLeopard();
    const removed = crownLayout(76).present.indexOf(false);
    const layer = c.duplicate[0]!;
    layer.crown[0] = setChar(layer.crown[0] as string, removed, "1");
    expect(codes(c)).toContain("crown_layout");
  });

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

  it("rejects duplicate stitch in the plain part of a crown", () => {
    const c = withPlainCrown(loadLeopard(), 80);
    const layer = c.duplicate[0]!;
    const i = crownLayout(85).present.indexOf(true);
    layer.crown[85 - 76] = setChar(layer.crown[85 - 76] as string, i, "1");
    expect(codes(c)).toContain("plain_crown");
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

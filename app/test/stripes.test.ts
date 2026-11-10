import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "@doubletake/core";
import { notesForRound, stripeNotes } from "../src/content";
import { geometry, stripeWidth } from "../src/lib/render";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf-8")) as Chart;
const bands = read("stripes/bands.doubletake.json"); // rounds 1-48 A+B, 49-71 A+D, 72-95 A+C
const leopard = read("leopard/leopard.doubletake.json");

const ids = (round: number) => stripeNotes(bands, round).map((n) => n.id);

describe("notes for a striped hat", () => {
  it("says nothing in the middle of a stripe, or on the first round", () => {
    expect(ids(1)).toEqual([]);
    expect(ids(2)).toEqual([]);
    expect(ids(20)).toEqual([]);
  });

  it("marks the first round of a new stripe, then the jogless step on the second", () => {
    expect(ids(49)).toEqual(["stripe-change"]);
    expect(ids(50)).toEqual(["stripe-jogless"]);
    expect(ids(51)).toEqual([]);
    expect(ids(72)).toEqual(["stripe-change"]);
    expect(ids(73)).toEqual(["stripe-jogless"]);
  });

  it("names the colours of the new stripe", () => {
    const n = stripeNotes(bands, 49)[0];
    expect(n?.body).toContain("sand (A)");
    expect(n?.body).toContain("cloud (D)");
    expect(n?.body).toContain("at the marker");
  });

  it("says the jogless method is a draft, and gives the lifted-stitch steps for both faces", () => {
    const n = stripeNotes(bands, 50)[0];
    expect(n?.body).toContain("knit face");
    expect(n?.body).toContain("purl face");
    expect(n?.caveat).toContain("draft");
  });

  it("has no stripe notes in the crown, or for a hat that isn't striped", () => {
    for (let r = 96; r <= 121; r++) expect(stripeNotes(bands, r)).toEqual([]);
    for (let r = 1; r <= 121; r++) expect(stripeNotes(leopard, r)).toEqual([]);
  });

  it("still gives the usual notes as well", () => {
    expect(notesForRound(1, bands).map((n) => n.id)).toEqual(["first-round"]);
    expect(notesForRound(96, bands).map((n) => n.id)).toEqual(["crown-start"]);
    expect(notesForRound(49, bands).map((n) => n.id)).toEqual(["stripe-change"]);
  });
});

describe("the colour strip beside a striped chart", () => {
  it("makes room for the strip only when asked", () => {
    const plain = geometry({ cols: [1, 2, 3], rows: [1, 2], cellW: 14 });
    const striped = geometry({ cols: [1, 2, 3], rows: [1, 2], cellW: 14, stripes: true });
    expect(striped.width - plain.width).toBe(stripeWidth(14));
    expect(striped.right).toBeGreaterThan(plain.right);
  });
});

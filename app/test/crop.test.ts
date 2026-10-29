import { describe, expect, it } from "vitest";
import { FABRIC_ASPECT } from "@doubletake/core";
import { DEFAULT_CROP, cropBox } from "../src/lib/crop";

describe("cropBox", () => {
  it("is always the shape of the fabric", () => {
    for (const [w, h] of [[1920, 1080], [1000, 1500], [800, 800], [3000, 600]] as const) {
      const b = cropBox(w, h, { zoom: 1.7, cx: 0.3, cy: 0.8 });
      expect(b.width / b.height).toBeCloseTo(FABRIC_ASPECT, 5);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w + 1e-6);
      expect(b.y + b.height).toBeLessThanOrEqual(h + 1e-6);
    }
  });

  it("a square picture shows the full width, from the middle", () => {
    const b = cropBox(800, 800, DEFAULT_CROP);
    expect(b.width).toBe(800);
    expect(b.height).toBeCloseTo(800 / FABRIC_ASPECT, 5);
    expect(b.y + b.height / 2).toBeCloseTo(400, 5);
  });

  it("zooming in makes the frame smaller, and moving keeps it inside the picture", () => {
    const wide = cropBox(1000, 1000, { zoom: 1, cx: 0.5, cy: 0.5 });
    const zoomed = cropBox(1000, 1000, { zoom: 2, cx: 0.5, cy: 0.5 });
    expect(zoomed.width).toBeCloseTo(wide.width / 2, 5);
    const corner = cropBox(1000, 1000, { zoom: 2, cx: 0, cy: 0 });
    expect([corner.x, corner.y]).toEqual([0, 0]);
  });
});

import { frameBox, tileDraws } from "../src/lib/crop";

describe("tiling when zoomed out", () => {
  it("zoom 1 and above is a single piece that fills the frame", () => {
    const t = tileDraws(1000, 1000, { zoom: 1, cx: 0.5, cy: 0.5 }, false);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ nx: 0, ny: 0, nw: 1, nh: 1, flipX: false, flipY: false });
  });

  it("zooming out repeats the picture, and the pieces always fill the frame exactly", () => {
    for (const zoom of [0.9, 0.5, 0.33, 0.2]) {
      for (const [cx, cy] of [[0.5, 0.5], [0, 0], [1, 1], [0.27, 0.8]] as const) {
        const t = tileDraws(640, 480, { zoom, cx, cy }, false);
        const area = t.reduce((a, p) => a + p.nw * p.nh, 0);
        expect(area).toBeCloseTo(1, 6);
        for (const p of t) {
          expect(p.sx).toBeGreaterThanOrEqual(-1e-9);
          expect(p.sx + p.sw).toBeLessThanOrEqual(640 + 1e-9);
          expect(p.sy + p.sh).toBeLessThanOrEqual(480 + 1e-9);
        }
      }
    }
    expect(tileDraws(640, 480, { zoom: 0.2, cx: 0.5, cy: 0.5 }, false).length).toBeGreaterThan(4);
  });

  it("the frame below zoom 1 is bigger than the picture and the same shape as the fabric", () => {
    const f = frameBox(400, 400, { zoom: 0.5, cx: 0.5, cy: 0.5 });
    expect(f.width).toBeCloseTo(800, 6);
    expect(f.width / f.height).toBeCloseTo(FABRIC_ASPECT, 6);
  });

  it("mirroring flips every other copy, so the neighbouring edges meet", () => {
    const t = tileDraws(500, 500, { zoom: 0.5, cx: 0.5, cy: 0.5 }, true);
    const row = t.filter((p) => Math.abs(p.ny - t[0]!.ny) < 1e-9).sort((a, b) => a.nx - b.nx);
    expect(row.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < row.length; i++) expect(row[i]!.flipX).not.toBe(row[i - 1]!.flipX);
    expect(tileDraws(500, 500, { zoom: 0.5, cx: 0.5, cy: 0.5 }, false).every((p) => !p.flipX && !p.flipY)).toBe(true);
  });
});

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

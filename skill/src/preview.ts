import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { CELL_ASPECT, FIRST_CROWN_ROUND, LAST_ROUND, hasDuplicate, insideAt, outsideAt, crop as cropRgb, toRgb, thumbnail } from "@doubletake/core";
import type { Chart, CropBox, Pixels } from "@doubletake/core";

export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/**
 * The chart laid flat as a picture: crown at the top, round 1 at the bottom. Outside has stitch 1 at the right;
 * inside is the mirror image, as you see it looking at the inside. Duplicate stitch shows as a square in its colour.
 */
export function renderChart(chart: Chart, opts: { inside?: boolean; cellW?: number } = {}): Raster {
  const cellW = opts.cellW ?? 8;
  const cellH = Math.max(2, Math.round(cellW / CELL_ASPECT));
  const width = 112 * cellW;
  const height = LAST_ROUND * cellH;
  const data = new Uint8Array(width * height * 4).fill(255);
  const colour = new Map(chart.yarns.map((y) => [y.id, rgb(y.hex)] as const));
  const fill = (x0: number, y0: number, w: number, h: number, c: [number, number, number]) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * width + x) * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = 255;
      }
    }
  };
  for (let round = 1; round <= LAST_ROUND; round++) {
    const y = (LAST_ROUND - round) * cellH;
    for (let col = 0; col < 112; col++) {
      const pair = opts.inside ? col + 1 : 112 - col;
      const id = opts.inside ? insideAt(chart, round, pair) : outsideAt(chart, round, pair);
      if (id === null) continue;
      const c = colour.get(id);
      if (!c) continue;
      fill(col * cellW, y, cellW, cellH, c);
      for (const layer of chart.duplicate) {
        if (opts.inside && layer.faces === "outside") continue;
        if (!hasDuplicate(layer, round, pair)) continue;
        const d = colour.get(layer.yarn);
        if (d) fill(col * cellW + 1, y + 1, Math.max(1, cellW - 2), Math.max(1, cellH - 2), d);
      }
    }
  }
  // A line where the crown starts
  fill(0, (LAST_ROUND - FIRST_CROWN_ROUND + 1) * cellH, width, 1, [27, 42, 65]);
  return { width, height, data };
}

/** Two rasters one above the other with a gap, on white. */
export function stack(a: Raster, b: Raster, gap = 16): Raster {
  const width = Math.max(a.width, b.width);
  const height = a.height + gap + b.height;
  const data = new Uint8Array(width * height * 4).fill(255);
  const put = (r: Raster, y0: number) => {
    for (let y = 0; y < r.height; y++) data.set(r.data.subarray(y * r.width * 4, (y + 1) * r.width * 4), ((y0 + y) * width) * 4);
  };
  put(a, 0);
  put(b, a.height + gap);
  return { width, height, data };
}

export function writePng(path: string, r: Raster): void {
  const png = new PNG({ width: r.width, height: r.height });
  png.data = Buffer.from(r.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** The part of the picture that was used, no wider than `maxWidth`, so it can be compared with the chart. */
export function usedRegion(pixels: Pixels, box: CropBox, maxWidth = 640): Raster {
  const part = thumbnail(cropRgb(toRgb(pixels), box), maxWidth);
  const data = new Uint8Array(part.width * part.height * 4);
  for (let i = 0; i < part.width * part.height; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(part.data[i * 3 + c] as number);
    data[i * 4 + 3] = 255;
  }
  return { width: part.width, height: part.height, data };
}

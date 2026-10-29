import { FABRIC_ASPECT, cropBox, DEFAULT_CROP } from "@doubletake/core";
import type { CropBox, CropSettings } from "@doubletake/core";

export { cropBox, DEFAULT_CROP };
export type { CropSettings };

/**
 * The frame to use on a picture, in the picture's own pixels. From zoom 1 up it stays inside the picture.
 * Below 1 the frame is bigger than the picture, so it takes in repeated copies and can sit anywhere.
 */
export function frameBox(width: number, height: number, c: CropSettings): CropBox {
  if (c.zoom >= 1) return cropBox(width, height, c);
  const w = Math.min(width, height * FABRIC_ASPECT) / Math.max(0.05, c.zoom);
  const h = w / FABRIC_ASPECT;
  return { x: c.cx * width - w / 2, y: c.cy * height - h / 2, width: w, height: h };
}

/** One piece of the picture to draw, with where it goes as a share (0 to 1) of the frame. */
export interface TileDraw {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  nx: number;
  ny: number;
  nw: number;
  nh: number;
  flipX: boolean;
  flipY: boolean;
}

/**
 * The pieces to draw to fill the frame with repeated copies of the picture. With `mirror`, every other copy is
 * flipped, so neighbouring edges match and no seam shows.
 */
export function tileDraws(width: number, height: number, c: CropSettings, mirror: boolean): TileDraw[] {
  const f = frameBox(width, height, c);
  const out: TileDraw[] = [];
  const ix0 = Math.floor(f.x / width);
  const ix1 = Math.ceil((f.x + f.width) / width) - 1;
  const iy0 = Math.floor(f.y / height);
  const iy1 = Math.ceil((f.y + f.height) / height) - 1;
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const x0 = Math.max(f.x, ix * width);
      const x1 = Math.min(f.x + f.width, (ix + 1) * width);
      const y0 = Math.max(f.y, iy * height);
      const y1 = Math.min(f.y + f.height, (iy + 1) * height);
      if (x1 <= x0 || y1 <= y0) continue;
      const flipX = mirror && Math.abs(ix % 2) === 1;
      const flipY = mirror && Math.abs(iy % 2) === 1;
      const u0 = x0 - ix * width;
      const u1 = x1 - ix * width;
      const v0 = y0 - iy * height;
      const v1 = y1 - iy * height;
      out.push({
        sx: flipX ? width - u1 : u0,
        sy: flipY ? height - v1 : v0,
        sw: u1 - u0,
        sh: v1 - v0,
        nx: (x0 - f.x) / f.width,
        ny: (y0 - f.y) / f.height,
        nw: (x1 - x0) / f.width,
        nh: (y1 - y0) / f.height,
        flipX,
        flipY,
      });
    }
  }
  return out;
}

import { GAUGE, BODY_ROUNDS, PAIRS } from "../hat";
import { FABRIC_ASPECT } from "./crop";
import { resizeLanczos, toRgb } from "./image";
import type { Pixels } from "./image";

/** How many copies fit evenly round the 112 pairs (the divisors of 112 above 1). */
export const TILE_ACROSS = [2, 4, 7, 8, 14, 16, 28, 56] as const;

export interface TileOptions {
  /** Copies of the picture across the hat. */
  across: number;
  /** Flip every other copy, so neighbouring edges match and no join shows. */
  mirror: boolean;
}

/** Width in pixels of the picture made by `tilePixels`. */
export const TILE_WIDTH = PAIRS * 8;

/**
 * Repeat a picture to cover the whole hat. A copy is `across` to a round, and it keeps the picture's own shape on the
 * fabric: a pair is wider than a round is tall, so the height in rounds follows from the width in pairs and the stitch
 * shape. The result is the shape of the hat's fabric, so it can go straight into the colour finder with no crop.
 */
export function tilePixels(img: Pixels, opts: TileOptions): Pixels {
  const ow = TILE_WIDTH;
  const oh = Math.max(1, Math.round(ow / FABRIC_ASPECT));
  const tw = ow / opts.across;
  const rounds = (PAIRS / opts.across) * (img.height / img.width) * (GAUGE.rounds / GAUGE.pairs);
  const th = Math.max(1, (rounds / BODY_ROUNDS) * oh);
  const tileW = Math.max(1, Math.round(tw));
  const tileH = Math.max(1, Math.round(th));
  const tile = resizeLanczos(toRgb(img), tileW, tileH);
  const out = new Uint8ClampedArray(ow * oh * 4);
  const mod2 = (n: number) => ((n % 2) + 2) % 2;
  for (let y = 0; y < oh; y++) {
    const v = (y - oh / 2) / th + 0.5;
    const iy = Math.floor(v);
    let sy = Math.min(tileH - 1, Math.max(0, Math.floor((v - iy) * tileH)));
    if (opts.mirror && mod2(iy) === 1) sy = tileH - 1 - sy;
    for (let x = 0; x < ow; x++) {
      const u = x / tw;
      const ix = Math.floor(u);
      let sx = Math.min(tileW - 1, Math.floor((u - ix) * tileW));
      if (opts.mirror && mod2(ix) === 1) sx = tileW - 1 - sx;
      const from = (sy * tileW + sx) * 3;
      const to = (y * ow + x) * 4;
      out[to] = tile.data[from] as number;
      out[to + 1] = tile.data[from + 1] as number;
      out[to + 2] = tile.data[from + 2] as number;
      out[to + 3] = 255;
    }
  }
  return { width: ow, height: oh, data: out };
}

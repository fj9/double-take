import { PAIRS, BODY_ROUNDS } from "../hat";
import { DEFAULT_CROP, FABRIC_ASPECT, cropBox } from "./crop";
import { kmeans, kmeansFrom, nearest, sample } from "./colour";
import type { Rgb } from "./colour";
import { cleanup, makeGrid, rankByShare, tidyRoles } from "./grid";
import type { Grid, RoleTidy, TidyStat } from "./grid";
import { crop, cropToAspect, gaussianBlur, resizeLanczos, seamless, toRgb } from "./image";
import type { CropBox, Pixels } from "./image";
import { extractPalette } from "./palette";

export interface RoleOptions {
  /** How many colours the chart uses (2 to 6). */
  colours: number;
  /** `fade` makes the print tile round the hat; `accept` leaves the picture's edges to meet at the join. */
  seam?: "fade" | "accept";
  /** Groups of fewer cells than this are absorbed into their surroundings. */
  minPatch?: number;
  crop?: CropBox;
  /** Start from the picture's palette (the default) or from random starting points. */
  start?: "palette" | "random";
  seed?: number;
}

export interface RoleResult {
  /** One role per cell in image order: row 0 is the top round (75), column 0 is the picture's left edge (pair 112). 0 is the most used colour. */
  grid: Grid;
  /** The colour of each role, RGB. */
  centres: Rgb[];
  /** Share of cells in each role. */
  shares: number[];
  seam: "fade" | "accept";
}

/** Subsamples per cell, along each side, when deciding which colour a cell is. */
const WORK = 4;

/**
 * Turn a picture into the 112 × 75 body as colour roles: crop to the shape of the fabric, optionally make it
 * tile round the hat, shrink to the grid, find the colours, give each cell its colour, and tidy up specks.
 */
export function makeRoles(img: Pixels, opts: RoleOptions): RoleResult {
  const k = Math.max(2, Math.min(6, Math.round(opts.colours)));
  const seam = opts.seam ?? (k <= 3 ? "fade" : "accept");
  const minPatch = opts.minPatch ?? (k <= 3 ? 3 : 5);

  // The part of the picture that is used. The colours are found from this part only, so asking for the middle
  // of the picture and not asking at all give the same chart.
  const box = opts.crop ?? cropBox(img.width, img.height, DEFAULT_CROP);
  let rgb = cropToAspect(crop(toRgb(img), box), FABRIC_ASPECT);
  if (seam === "fade") rgb = seamless(rgb);
  rgb = gaussianBlur(resizeLanczos(rgb, PAIRS * WORK, BODY_ROUNDS * WORK), WORK * 0.6);

  const sub = sample(rgb.data, 30000);
  let centres: Float64Array;
  const palette = opts.start === "random" ? null : extractPalette(img, { cap: k, crop: box });
  if (palette && palette.palette.length >= k) {
    centres = kmeansFrom(sub, Float64Array.from(palette.palette.slice(0, k).flat()), 25);
  } else {
    centres = kmeans(sub, k, 25, opts.seed ?? 0);
  }

  // Which colour each sub-pixel is nearest to, then the most common one in each cell's block
  const grid = makeGrid(PAIRS, BODY_ROUNDS);
  const counts = new Int32Array(k);
  for (let y = 0; y < BODY_ROUNDS; y++) {
    for (let x = 0; x < PAIRS; x++) {
      counts.fill(0);
      for (let sy = 0; sy < WORK; sy++) {
        for (let sx = 0; sx < WORK; sx++) {
          const p = (y * WORK + sy) * PAIRS * WORK + x * WORK + sx;
          const j = nearest(rgb.data, p, centres);
          counts[j] = (counts[j] as number) + 1;
        }
      }
      let best = 0;
      for (let j = 1; j < k; j++) if ((counts[j] as number) > (counts[best] as number)) best = j;
      grid.data[y * PAIRS + x] = best;
    }
  }

  const cleaned = cleanup(grid, k, minPatch, seam === "fade");
  const { grid: ranked, order } = rankByShare(cleaned, k);
  const shares = new Array<number>(k).fill(0);
  for (const v of ranked.data) shares[v] = (shares[v] as number) + 1 / ranked.data.length;
  const out: Rgb[] = order.map((old) => [centres[old * 3] as number, centres[old * 3 + 1] as number, centres[old * 3 + 2] as number]);
  return { grid: ranked, centres: out, shares, seam };
}

/**
 * Tidy chosen colours' patches after the colours have been given jobs (which are knitted and which are embroidered).
 * Returns new roles with the grid and shares updated, and what each tidied colour kept and lost.
 */
export function applyTidy(roles: RoleResult, settings: (RoleTidy | undefined)[]): { roles: RoleResult; stats: (TidyStat | undefined)[] } {
  const k = roles.centres.length;
  const { grid, stats } = tidyRoles(roles.grid, k, settings, roles.seam === "fade");
  const shares = new Array<number>(k).fill(0);
  for (const v of grid.data) shares[v] = (shares[v] as number) + 1 / grid.data.length;
  return { roles: { ...roles, grid, shares }, stats };
}

/**
 * Merge one colour into another: every cell of `from` becomes `into`, which keeps its own colour. The colours are
 * numbered again by how much they cover. `order[newRole]` is the role it had before, so names can follow.
 */
export function mergeRoles(roles: RoleResult, from: number, into: number): { roles: RoleResult; order: number[] } {
  const k = roles.centres.length;
  if (from === into || from < 0 || into < 0 || from >= k || into >= k || k <= 2) return { roles, order: [...Array(k).keys()] };
  const moved = makeGrid(roles.grid.width, roles.grid.height);
  for (let i = 0; i < moved.data.length; i++) {
    const v = roles.grid.data[i] as number;
    moved.data[i] = v === from ? into : v;
  }
  const { grid, order } = rankByShare(moved, k);
  // The merged-away colour has no cells left, so it ranks last and is dropped
  const kept = order.slice(0, k - 1);
  const shares = new Array<number>(k - 1).fill(0);
  for (const v of grid.data) shares[v] = (shares[v] as number) + 1 / grid.data.length;
  return { roles: { ...roles, grid, centres: kept.map((old) => roles.centres[old] as Rgb), shares }, order: kept };
}

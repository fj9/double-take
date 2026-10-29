import { kmeans, rgbToLab, sample } from "./colour";
import type { Rgb } from "./colour";
import { crop, cropToAspect, median3, thumbnail, toRgb } from "./image";
import type { CropBox, Pixels } from "./image";

export interface PaletteCheck {
  /** The real colours found, most used first, RGB 0 to 255. */
  palette: Rgb[];
  /** Share of the picture each colour covers, adding up to about 1. */
  shares: number[];
  /** The share of pixels within 15 Lab units of a palette colour. Under 0.70 means a gradient or fine texture. */
  coverage: number;
  warnings: string[];
}

export interface PaletteOptions {
  /** The most colours to report. */
  cap?: number;
  crop?: CropBox;
  mergeDistance?: number;
  minShare?: number;
  rareShare?: number;
  rareDistance?: number;
  /** How many clusters to start with before merging. */
  over?: number;
  /** Longest side of the working copy. */
  size?: number;
}

interface Cluster {
  lab: Rgb;
  rgb: Rgb;
  n: number;
}

const labDist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function mergeClusters(a: Cluster, b: Cluster): Cluster {
  const n = a.n + b.n;
  const mix = (x: Rgb, y: Rgb): Rgb => [(x[0] * a.n + y[0] * b.n) / n, (x[1] * a.n + y[1] * b.n) / n, (x[2] * a.n + y[2] * b.n) / n];
  return { lab: mix(a.lab, b.lab), rgb: mix(a.rgb, b.rgb), n };
}

/**
 * Find the real colours in a picture. Works in Lab, so colours that look alike are merged: it starts with many
 * clusters, merges the close ones, drops tiny ones (unless they are a small but very different accent), then
 * merges down to `cap`, keeping big, distinct colours.
 */
export function extractPalette(img: Pixels, opts: PaletteOptions = {}): PaletteCheck {
  const { cap = 6, mergeDistance = 18, minShare = 0.01, rareShare = 0.004, rareDistance = 35, over = 14, size = 320 } = opts;
  let rgbImg = toRgb(img);
  if (opts.crop) rgbImg = crop(rgbImg, opts.crop);
  const small = median3(thumbnail(rgbImg, size));
  const n = small.width * small.height;

  const labs = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const l = rgbToLab(small.data[i * 3] as number, small.data[i * 3 + 1] as number, small.data[i * 3 + 2] as number);
    labs[i * 3] = l[0];
    labs[i * 3 + 1] = l[1];
    labs[i * 3 + 2] = l[2];
  }
  const k0 = Math.min(over, n);
  const centres = kmeans(sample(labs, 20000), k0, 30, 0);
  const sums = Array.from({ length: k0 }, () => ({ lab: [0, 0, 0] as Rgb, rgb: [0, 0, 0] as Rgb, n: 0 }));
  for (let i = 0; i < n; i++) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < k0; j++) {
      const d = (labs[i * 3] as number - (centres[j * 3] as number)) ** 2 + (labs[i * 3 + 1] as number - (centres[j * 3 + 1] as number)) ** 2 + (labs[i * 3 + 2] as number - (centres[j * 3 + 2] as number)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    const s = sums[best] as Cluster;
    for (let c = 0; c < 3; c++) {
      s.lab[c] = (s.lab[c] as number) + (labs[i * 3 + c] as number);
      s.rgb[c] = (s.rgb[c] as number) + (small.data[i * 3 + c] as number);
    }
    s.n++;
  }
  let clusters: Cluster[] = sums
    .filter((s) => s.n > 0)
    .map((s) => ({ lab: s.lab.map((v) => v / s.n) as Rgb, rgb: s.rgb.map((v) => v / s.n) as Rgb, n: s.n }));

  // Merge clusters that look alike
  for (;;) {
    let best = { d: Infinity, i: 0, j: 1 };
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = labDist((clusters[i] as Cluster).lab, (clusters[j] as Cluster).lab);
        if (d < best.d) best = { d, i, j };
      }
    }
    if (clusters.length < 2 || best.d >= mergeDistance) break;
    clusters[best.i] = mergeClusters(clusters[best.i] as Cluster, clusters[best.j] as Cluster);
    clusters.splice(best.j, 1);
  }

  // Drop tiny clusters, unless small but very different from everything else
  const kept = clusters.filter((c) => {
    const share = c.n / n;
    if (share >= minShare) return true;
    if (share < rareShare) return false;
    return Math.min(...clusters.filter((o) => o !== c).map((o) => labDist(c.lab, o.lab))) >= rareDistance;
  });
  if (kept.length > 0) clusters = kept;

  // Merge down to the cap, cheapest merge first (Ward's cost)
  while (clusters.length > cap) {
    let best = { w: Infinity, i: 0, j: 1 };
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i] as Cluster;
        const b = clusters[j] as Cluster;
        const w = ((a.n * b.n) / (a.n + b.n)) * labDist(a.lab, b.lab) ** 2;
        if (w < best.w) best = { w, i, j };
      }
    }
    clusters[best.i] = mergeClusters(clusters[best.i] as Cluster, clusters[best.j] as Cluster);
    clusters.splice(best.j, 1);
  }
  clusters.sort((a, b) => b.n - a.n);

  let near = 0;
  for (let i = 0; i < n; i++) {
    const p: Rgb = [labs[i * 3] as number, labs[i * 3 + 1] as number, labs[i * 3 + 2] as number];
    if (Math.min(...clusters.map((c) => labDist(p, c.lab))) < 15) near++;
  }
  const coverage = near / n;
  const palette = clusters.map((c) => c.rgb);
  const shares = clusters.map((c) => c.n / n);

  const warnings: string[] = [];
  if (coverage < 0.7) {
    warnings.push(
      "This picture is mostly gradients or fine texture. At hat size it will blur into mixed colours. A simpler picture or crop works better, or use two or three colours.",
    );
  }
  const stripeWidth = Math.max(rgbImg.width, rgbImg.height) / 112;
  warnings.push(`Details thinner than about ${Math.round(stripeWidth)} pixels (one stitch across) will vanish or blend.`);
  return { palette, shares, coverage, warnings };
}

export { cropToAspect };

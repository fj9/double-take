import { makeRng } from "./rng";

export type Rgb = [number, number, number];

/** sRGB (0 to 255) to CIE Lab, so that "near" means "looks alike". */
export function rgbToLab(r: number, g: number, b: number): Rgb {
  const lin = (v: number) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export const dist2 = (a: ArrayLike<number>, ai: number, b: ArrayLike<number>, bi: number): number => {
  const d0 = (a[ai] as number) - (b[bi] as number);
  const d1 = (a[ai + 1] as number) - (b[bi + 1] as number);
  const d2 = (a[ai + 2] as number) - (b[bi + 2] as number);
  return d0 * d0 + d1 * d1 + d2 * d2;
};

/** An even, repeatable sample of at most `n` points, three numbers each. */
export function sample(points: Float64Array, n: number): Float64Array {
  const total = points.length / 3;
  if (total <= n) return points;
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = Math.floor((i * total) / n);
    out[i * 3] = points[j * 3] as number;
    out[i * 3 + 1] = points[j * 3 + 1] as number;
    out[i * 3 + 2] = points[j * 3 + 2] as number;
  }
  return out;
}

/** The index of the nearest centre to point `i`. Ties go to the lower index. */
export function nearest(points: ArrayLike<number>, i: number, centres: Float64Array): number {
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < centres.length / 3; j++) {
    const d = dist2(points, i * 3, centres, j * 3);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

function lloyd(points: Float64Array, centres: Float64Array, iters: number): Float64Array {
  const k = centres.length / 3;
  const n = points.length / 3;
  const c = Float64Array.from(centres);
  for (let it = 0; it < iters; it++) {
    const sum = new Float64Array(k * 3);
    const count = new Int32Array(k);
    for (let i = 0; i < n; i++) {
      const j = nearest(points, i, c);
      count[j] = (count[j] as number) + 1;
      for (let d = 0; d < 3; d++) sum[j * 3 + d] = (sum[j * 3 + d] as number) + (points[i * 3 + d] as number);
    }
    let moved = false;
    for (let j = 0; j < k; j++) {
      if (!count[j]) continue;
      for (let d = 0; d < 3; d++) {
        const v = (sum[j * 3 + d] as number) / (count[j] as number);
        if (Math.abs(v - (c[j * 3 + d] as number)) > 1e-9) moved = true;
        c[j * 3 + d] = v;
      }
    }
    if (!moved) break;
  }
  return c;
}

/** k-means from k-means++ starting points drawn with a seeded generator. Returns k centres, three numbers each. */
export function kmeans(points: Float64Array, k: number, iters = 25, seed = 0): Float64Array {
  const n = points.length / 3;
  const rng = makeRng(seed);
  const centres = new Float64Array(k * 3);
  const first = Math.min(n - 1, Math.floor(rng() * n));
  centres.set(points.subarray(first * 3, first * 3 + 3), 0);
  const d = new Float64Array(n).fill(Infinity);
  for (let j = 1; j < k; j++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const dd = dist2(points, i * 3, centres, (j - 1) * 3);
      if (dd < (d[i] as number)) d[i] = dd;
      total += d[i] as number;
    }
    let pick = n - 1;
    if (total > 0) {
      let r = rng() * total;
      for (let i = 0; i < n; i++) {
        r -= d[i] as number;
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    }
    centres.set(points.subarray(pick * 3, pick * 3 + 3), j * 3);
  }
  return lloyd(points, centres, iters);
}

/** k-means from centres you supply (for example a palette found earlier). */
export function kmeansFrom(points: Float64Array, start: Float64Array, iters = 25): Float64Array {
  return lloyd(points, start, iters);
}

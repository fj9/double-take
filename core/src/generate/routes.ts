import { DUPLICATE_STOP, DUPLICATE_WARN } from "../analyse";
import type { Grid } from "./grid";

export type Pair = [number, number];

export interface StripePlan {
  /** The two colour roles worked in each body round, round 1 first. */
  pairs: Pair[];
  /** Cells outside their round's pair, which become duplicate stitch. */
  duplicateCells: number;
  duplicateShare: number;
  yarnChanges: number;
  blocks: number;
  /** Rounds that hold three or more colours in the picture. */
  roundsWithThreePlus: number;
}

export interface RouteComparison {
  /** Route A: knit the two most used colours and embroider the rest. */
  a: { duplicateShare: number; colours: number; bandLike: Record<number, number> };
  /** Route B: stripes, with duplicate stitch for cells outside the round's pair. */
  b: StripePlan;
  recommend: "A" | "B" | "none";
  /** One line of plain advice on why. */
  reason: string;
}

const roleCount = (g: Grid) => {
  let k = 0;
  for (const v of g.data) if (v + 1 > k) k = v + 1;
  return k;
};

/**
 * Choose two yarns for each round, bottom to top, to keep as many cells as possible in the round's own two
 * yarns, without changing yarn too often. `lam` is the cost of each yarn change in cells.
 */
export function planPairs(g: Grid, lam = 25): Pair[] {
  const K = roleCount(g);
  const pairs: Pair[] = [];
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) pairs.push([a, b]);
  const H = g.height;
  const W = g.width;
  const total = new Float64Array(K);
  for (const v of g.data) total[v] = (total[v] as number) + 1;
  const share = Array.from(total, (t) => t / g.data.length);

  // need[row][pair]: cells in this row not in the pair, plus a tiny nudge towards common colours
  const need: Float64Array[] = [];
  for (let y = 0; y < H; y++) {
    const cnt = new Int32Array(K);
    for (let x = 0; x < W; x++) cnt[g.data[y * W + x] as number] = (cnt[g.data[y * W + x] as number] as number) + 1;
    need.push(Float64Array.from(pairs, ([a, b]) => W - (cnt[a] as number) - (cnt[b] as number) + 0.01 * (1 - ((share[a] as number) + (share[b] as number)))));
  }
  const trans = pairs.map((pa) => pairs.map((pb) => 2 - pa.filter((c) => pb.includes(c)).length));

  const rows = Array.from({ length: H }, (_, i) => H - 1 - i); // bottom to top
  let dp = Float64Array.from(need[rows[0] as number] as Float64Array);
  const back: Int32Array[] = [];
  for (let r = 1; r < rows.length; r++) {
    const nextDp = new Float64Array(pairs.length);
    const choice = new Int32Array(pairs.length);
    for (let j = 0; j < pairs.length; j++) {
      let best = Infinity;
      let from = 0;
      for (let i = 0; i < pairs.length; i++) {
        const v = (dp[i] as number) + lam * (trans[i] as number[])[j]!;
        if (v < best) {
          best = v;
          from = i;
        }
      }
      nextDp[j] = best + ((need[rows[r] as number] as Float64Array)[j] as number);
      choice[j] = from;
    }
    dp = nextDp;
    back.push(choice);
  }
  let p = 0;
  for (let i = 1; i < pairs.length; i++) if ((dp[i] as number) < (dp[p] as number)) p = i;
  const seq = [p];
  for (let b = back.length - 1; b >= 0; b--) {
    p = (back[b] as Int32Array)[p] as number;
    seq.push(p);
  }
  return seq.reverse().map((i) => pairs[i] as Pair);
}

/** What a stripe plan costs. `pairs` runs bottom to top, like the plan. */
export function summarise(g: Grid, pairs: Pair[]): StripePlan {
  const H = g.height;
  const W = g.width;
  let duplicateCells = 0;
  let roundsWithThreePlus = 0;
  pairs.forEach((pair, i) => {
    const y = H - 1 - i;
    const seen = new Set<number>();
    for (let x = 0; x < W; x++) {
      const v = g.data[y * W + x] as number;
      seen.add(v);
      if (!pair.includes(v)) duplicateCells++;
    }
    if (seen.size > 2) roundsWithThreePlus++;
  });
  let yarnChanges = 0;
  let blocks = 1;
  for (let i = 1; i < pairs.length; i++) {
    const a = pairs[i - 1] as Pair;
    const b = pairs[i] as Pair;
    yarnChanges += 2 - a.filter((c) => b.includes(c)).length;
    if (a[0] !== b[0] || a[1] !== b[1]) blocks++;
  }
  return { pairs, duplicateCells, duplicateShare: duplicateCells / g.data.length, yarnChanges, blocks, roundsWithThreePlus };
}

/** The share of a colour's cells that sit in rounds where it covers over half the round. High means it comes in horizontal layers. */
export function bandShare(g: Grid, role: number): number {
  let total = 0;
  let inBands = 0;
  for (let y = 0; y < g.height; y++) {
    let n = 0;
    for (let x = 0; x < g.width; x++) if (g.data[y * g.width + x] === role) n++;
    total += n;
    if (n / g.width > 0.5) inBands += n;
  }
  return total === 0 ? 0 : inBands / total;
}

/** Compare the two ways to use more than three colours, and recommend one (spec 7.2). */
export function compareRoutes(g: Grid, lam = 25): RouteComparison {
  const K = roleCount(g);
  const share = new Float64Array(K);
  for (const v of g.data) share[v] = (share[v] as number) + 1 / g.data.length;
  const aShare = 1 - ((share[0] as number) + ((share[1] as number) ?? 0));
  const bandLike: Record<number, number> = {};
  for (let c = 2; c < K; c++) bandLike[c] = Math.round(bandShare(g, c) * 100) / 100;
  const a = { duplicateShare: Math.max(0, aShare), colours: Math.max(0, K - 2), bandLike };
  const b = summarise(g, planPairs(g, lam));

  let recommend: "A" | "B" | "none";
  let reason: string;
  if (K <= 2 || a.duplicateShare <= DUPLICATE_WARN) {
    recommend = "A";
    reason = "Knitting two colours and embroidering the rest needs little duplicate stitch and no yarn changes.";
  } else if (a.duplicateShare > DUPLICATE_STOP && b.duplicateShare > DUPLICATE_STOP) {
    recommend = "none";
    reason = "Both ways need too much duplicate stitch. Try fewer colours or a simpler picture.";
  } else if (a.duplicateShare > DUPLICATE_STOP) {
    recommend = "B";
    reason = "Embroidering the extra colours would be too much, and stripes cut it down.";
  } else if (b.duplicateShare < a.duplicateShare / 2) {
    recommend = "B";
    reason = "Stripes cut the duplicate stitch to under half, which is worth the yarn changes.";
  } else {
    recommend = "A";
    reason = "Stripes would save only a few points of duplicate stitch, not enough to be worth the yarn changes.";
  }
  return { a, b, recommend, reason };
}

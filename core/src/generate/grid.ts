/** A grid of small whole numbers, row by row. Used for colour roles (0 = most used colour) in image order. */
export interface Grid {
  width: number;
  height: number;
  data: Int32Array;
}

export const makeGrid = (width: number, height: number, fill = 0): Grid => ({ width, height, data: new Int32Array(width * height).fill(fill) });
export const at = (g: Grid, x: number, y: number): number => g.data[y * g.width + x] as number;

/**
 * Label connected groups of cells where `mask` is set. Cells touch if they are side by side or diagonal, and the
 * left and right edges join up (the hat is a loop). Returns a label per cell (0 = not in a group) and the count.
 */
export function components(mask: Uint8Array, width: number, height: number, wrapX = true): { labels: Int32Array; count: number } {
  const labels = new Int32Array(width * height);
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    labels[start] = count;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const x = p % width;
      const y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          let xx = x + dx;
          if (wrapX) xx = (xx + width) % width;
          else if (xx < 0 || xx >= width) continue;
          const q = yy * width + xx;
          if (mask[q] && !labels[q]) {
            labels[q] = count;
            stack.push(q);
          }
        }
      }
    }
  }
  return { labels, count };
}

/** Cells touching a group but not in it (8 neighbours, wrapping left to right). */
export function ring(labels: Int32Array, label: number, width: number, height: number, wrapX = true): number[] {
  const seen = new Set<number>();
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] !== label) continue;
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        let xx = x + dx;
        if (wrapX) xx = (xx + width) % width;
        else if (xx < 0 || xx >= width) continue;
        const q = yy * width + xx;
        if (labels[q] !== label) seen.add(q);
      }
    }
  }
  return [...seen];
}

/** The most common value among some cells (the lowest on a tie), or `fallback` if there are none. */
export function mostCommon(values: number[], k: number, fallback: number): number {
  if (values.length === 0) return fallback;
  const counts = new Int32Array(k);
  for (const v of values) if (v >= 0 && v < k) counts[v] = (counts[v] as number) + 1;
  let best = 0;
  for (let i = 1; i < k; i++) if ((counts[i] as number) > (counts[best] as number)) best = i;
  return best;
}

/**
 * Absorb small groups of any colour but the most used one into whatever mostly surrounds them, so stray specks
 * don't become single stitches. Groups smaller than `minPatch` cells go.
 */
export function cleanup(g: Grid, k: number, minPatch: number, wrapX = true): Grid {
  const out = makeGrid(g.width, g.height);
  out.data.set(g.data);
  const counts = new Int32Array(k);
  for (const v of g.data) counts[v] = (counts[v] as number) + 1;
  let ground = 0;
  for (let i = 1; i < k; i++) if ((counts[i] as number) > (counts[ground] as number)) ground = i;
  for (let r = 0; r < k; r++) {
    if (r === ground) continue;
    const mask = new Uint8Array(g.data.length);
    for (let i = 0; i < g.data.length; i++) mask[i] = g.data[i] === r ? 1 : 0;
    const { labels, count } = components(mask, g.width, g.height, wrapX);
    const size = new Int32Array(count + 1);
    for (const l of labels) size[l] = (size[l] as number) + 1;
    for (let label = 1; label <= count; label++) {
      if ((size[label] as number) >= minPatch) continue;
      const around = ring(labels, label, g.width, g.height, wrapX).map((q) => g.data[q] as number);
      const into = mostCommon(around, k, ground);
      for (let p = 0; p < labels.length; p++) if (labels[p] === label) out.data[p] = into;
    }
  }
  return out;
}

/** Number the colours by how much of the grid they cover: 0 is the most used. Returns the new grid and the old index of each new role. */
export function rankByShare(g: Grid, k: number): { grid: Grid; order: number[] } {
  const counts = new Int32Array(k);
  for (const v of g.data) counts[v] = (counts[v] as number) + 1;
  const order = [...Array(k).keys()].sort((a, b) => (counts[b] as number) - (counts[a] as number) || a - b);
  const remap = new Int32Array(k);
  order.forEach((old, rank) => (remap[old] = rank));
  const out = makeGrid(g.width, g.height);
  for (let i = 0; i < g.data.length; i++) out.data[i] = remap[g.data[i] as number] as number;
  return { grid: out, order };
}

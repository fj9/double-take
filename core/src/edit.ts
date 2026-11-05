/**
 * Editing a chart cell by cell (spec 7.3 and 7.5). These functions change the chart they are given, and
 * only ever make changes that keep it valid: a removed pair can't be painted,
 * and a cell is in at most one duplicate layer.
 */
import { outsideAt, yarnsInRound } from "./chart";
import type { Chart, DuplicateLayer, YarnId } from "./chart";
import { findPatches } from "./patches";
import type { Patch } from "./patches";
import { BODY_ROUNDS, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS, crownLayout } from "./hat";

export interface CellRef {
  round: number;
  pair: number;
}

export const MAX_DUPLICATE_LAYERS = 4;
/** Ways to repeat a motif evenly round the 112 pairs (1 = no repeat). */
export const REPEATS = [1, 2, 4, 7, 8, 14, 16, 28, 56] as const;

export type EditLayer = { kind: "main" } | { kind: "duplicate"; index: number };

export interface Symmetry {
  /** Mirror across the seam and the Chart A / Chart B join: pair 1 with 112, 56 with 57. */
  mirrorX: boolean;
  /** Mirror the body top to bottom: round 1 with 75. The crown is not mirrored. */
  mirrorY: boolean;
  /** Repeat the motif this many times round the hat. */
  repeat: number;
}

export const NO_SYMMETRY: Symmetry = { mirrorX: false, mirrorY: false, repeat: 1 };

const wrapPair = (p: number) => ((((p - 1) % PAIRS) + PAIRS) % PAIRS) + 1;

export function isPresent(round: number, pair: number): boolean {
  if (round < 1 || round > LAST_ROUND || pair < 1 || pair > PAIRS) return false;
  return round <= BODY_ROUNDS || crownLayout(round).present[pair - 1] === true;
}

function setChar(s: string, i: number, ch: string): string {
  return s.slice(0, i) + ch + s.slice(i + 1);
}

function layerRow(layer: DuplicateLayer, round: number): string {
  return (round <= BODY_ROUNDS ? layer.body[round - 1] : layer.crown[round - FIRST_CROWN_ROUND]) as string;
}

function writeLayer(layer: DuplicateLayer, round: number, pair: number, ch: string): void {
  if (round <= BODY_ROUNDS) layer.body[round - 1] = setChar(layer.body[round - 1] as string, pair - 1, ch);
  else layer.crown[round - FIRST_CROWN_ROUND] = setChar(layer.crown[round - FIRST_CROWN_ROUND] as string, pair - 1, ch);
}

/** Does this duplicate layer cover this cell? */
export function hasDuplicate(layer: DuplicateLayer, round: number, pair: number): boolean {
  return layerRow(layer, round)[pair - 1] === "1";
}

/** Set the outside yarn of a pair. Returns true if anything changed. */
export function setOutside(chart: Chart, round: number, pair: number, yarn: string): boolean {
  if (!isPresent(round, pair)) return false;
  if (!yarnsInRound(chart, round).includes(yarn)) return false;
  if (outsideAt(chart, round, pair) === yarn) return false;
  if (round <= BODY_ROUNDS) chart.body[round - 1] = setChar(chart.body[round - 1] as string, pair - 1, yarn);
  else chart.crown.rounds[round - FIRST_CROWN_ROUND] = setChar(chart.crown.rounds[round - FIRST_CROWN_ROUND] as string, pair - 1, yarn);
  return true;
}

/** Turn duplicate stitch on or off for a cell in one layer. Turning it on takes the cell out of any other layer. */
export function setDuplicate(chart: Chart, layerIndex: number, round: number, pair: number, on: boolean): boolean {
  const layer = chart.duplicate[layerIndex];
  if (!layer || !isPresent(round, pair)) return false;
  if (hasDuplicate(layer, round, pair) === on) return false;
  if (on) {
    chart.duplicate.forEach((other, i) => {
      if (i !== layerIndex && hasDuplicate(other, round, pair)) writeLayer(other, round, pair, "0");
    });
  }
  writeLayer(layer, round, pair, on ? "1" : "0");
  return true;
}

function valueAt(chart: Chart, layer: EditLayer, round: number, pair: number): string {
  if (layer.kind === "main") return outsideAt(chart, round, pair) ?? "";
  const l = chart.duplicate[layer.index];
  return l && hasDuplicate(l, round, pair) ? "1" : "0";
}

/** Set one cell on a layer. For the main layer `value` is a yarn id; for a duplicate layer it is "1" or "0". */
export function paintCell(chart: Chart, layer: EditLayer, round: number, pair: number, value: string): boolean {
  return layer.kind === "main" ? setOutside(chart, round, pair, value) : setDuplicate(chart, layer.index, round, pair, value === "1");
}

/** Fill the connected region of same-valued cells that contains a cell. Joins across the seam and from body to crown. */
export function floodFill(chart: Chart, layer: EditLayer, round: number, pair: number, value: string): CellRef[] {
  if (!isPresent(round, pair) && value === "1") return [];
  const target = valueAt(chart, layer, round, pair);
  if (target === value) return [];
  const key = (r: number, p: number) => r * 256 + p;
  const seen = new Set<number>([key(round, pair)]);
  const stack: CellRef[] = [{ round, pair }];
  const found: CellRef[] = [];
  while (stack.length > 0) {
    const c = stack.pop() as CellRef;
    found.push(c);
    for (const [dr, dp] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const r = c.round + dr;
      const p = wrapPair(c.pair + dp);
      if (!isPresent(r, p) || seen.has(key(r, p))) continue;
      if (valueAt(chart, layer, r, p) !== target) continue;
      seen.add(key(r, p));
      stack.push({ round: r, pair: p });
    }
  }
  const changed: CellRef[] = [];
  for (const c of found) if (paintCell(chart, layer, c.round, c.pair, value)) changed.push(c);
  return changed;
}

/** All the cells a stroke on one cell also paints, given the symmetry settings. Includes the cell itself. */
export function symmetricCells(round: number, pair: number, sym: Symmetry): CellRef[] {
  const step = PAIRS / (REPEATS.includes(sym.repeat as (typeof REPEATS)[number]) ? sym.repeat : 1);
  const out = new Map<number, CellRef>();
  const add = (r: number, p: number) => {
    if (isPresent(r, p)) out.set(r * 256 + p, { round: r, pair: p });
  };
  for (let k = 0; k < PAIRS / step; k++) {
    const p = wrapPair(pair + k * step);
    add(round, p);
    if (sym.mirrorX) add(round, PAIRS + 1 - p);
    if (sym.mirrorY && round <= BODY_ROUNDS) {
      add(BODY_ROUNDS + 1 - round, p);
      if (sym.mirrorX) add(BODY_ROUNDS + 1 - round, PAIRS + 1 - p);
    }
  }
  return [...out.values()];
}

/** The next free letter for a new yarn, or null when all six are used. */
function nextYarnId(chart: Chart): string | null {
  const used = new Set(chart.yarns.map((y) => y.id));
  return ["C", "D", "E", "F"].find((id) => !used.has(id)) ?? null;
}

/** Add a duplicate stitch colour. Returns the new layer's index, or null if there is no room (or the chart is striped). */
export function addDuplicateLayer(chart: Chart, look: { name: string; hex: string }): number | null {
  if (chart.mode === "stripes" || chart.duplicate.length >= MAX_DUPLICATE_LAYERS) return null;
  const id = nextYarnId(chart);
  if (!id) return null;
  chart.yarns.push({ id, name: look.name, hex: look.hex, role: "duplicate" });
  chart.duplicate.push({
    yarn: id,
    faces: "both",
    body: chart.body.map((r) => "0".repeat(r.length)),
    crown: chart.crown.rounds.map((r) => [...r].map((ch) => (ch === "." ? "." : "0")).join("")),
  });
  chart.mode = "duplicate";
  return chart.duplicate.length - 1;
}

/** Remove a duplicate stitch layer and its yarn. With none left the chart goes back to two colours. */
export function removeDuplicateLayer(chart: Chart, index: number): boolean {
  const layer = chart.duplicate[index];
  if (!layer) return false;
  chart.duplicate.splice(index, 1);
  chart.yarns = chart.yarns.filter((y) => y.id !== layer.yarn);
  if (chart.duplicate.length === 0) chart.mode = "two_colour";
  return true;
}

export function setYarnLook(chart: Chart, id: string, look: { name?: string; hex?: string }): boolean {
  const yarn = chart.yarns.find((y) => y.id === id);
  if (!yarn) return false;
  if (look.name !== undefined && look.name.trim() !== "") yarn.name = look.name.trim();
  if (look.hex !== undefined && /^#[0-9a-fA-F]{6}$/.test(look.hex)) yarn.hex = look.hex;
  return true;
}

/** Duplicate stitch patches smaller than `min` squares, in one layer or (with null) in all of them. */
export function smallPatches(chart: Chart, layerIndex: number | null, min: number): Patch[] {
  const layers = layerIndex === null ? chart.duplicate : chart.duplicate.slice(layerIndex, layerIndex + 1);
  return layers.flatMap((layer) => findPatches(layer).filter((p) => p.cells.length < min));
}

/** Take out the patches smaller than `min` squares. Returns how many patches and squares went. */
export function removeSmallPatches(chart: Chart, layerIndex: number | null, min: number): { patches: number; cells: number } {
  const layers = layerIndex === null ? chart.duplicate : chart.duplicate.slice(layerIndex, layerIndex + 1);
  let patches = 0;
  let cells = 0;
  for (const layer of layers) {
    for (const patch of findPatches(layer).filter((p) => p.cells.length < min)) {
      patches++;
      for (const c of patch.cells) {
        writeLayer(layer, c.round, c.pair, "0");
        cells++;
      }
    }
  }
  return { patches, cells };
}

/** Work a duplicate layer on both faces, or on the outside only. */
export function setLayerFaces(chart: Chart, index: number, faces: "both" | "outside"): boolean {
  const layer = chart.duplicate[index];
  if (!layer || layer.faces === faces) return false;
  layer.faces = faces;
  return true;
}

// ---- Stripes ----
// In a striped chart the yarns of a round are its pair. A cell is knitted in one of them (the outside), and a cell
// whose colour is a third yarn is that yarn worked over the knitting in duplicate stitch, on the outside only.

/** The colour seen on the outside of a cell: its duplicate stitch yarn if it has one, else the knitted yarn. */
export function visibleYarnAt(chart: Chart, round: number, pair: number): YarnId | null {
  for (const layer of chart.duplicate) if (isPresent(round, pair) && hasDuplicate(layer, round, pair)) return layer.yarn;
  return outsideAt(chart, round, pair);
}

function blankLayer(chart: Chart, yarn: YarnId): DuplicateLayer {
  return {
    yarn,
    faces: "outside",
    body: chart.body.map((r) => "0".repeat(r.length)),
    crown: chart.crown.rounds.map((r) => [...r].map((ch) => (ch === "." ? "." : "0")).join("")),
  };
}

/** The duplicate layer for a stripe yarn, made if it isn't there yet. Null when all four layers are taken by other yarns. */
function stripeLayerFor(chart: Chart, yarn: YarnId): number | null {
  const found = chart.duplicate.findIndex((l) => l.yarn === yarn);
  if (found >= 0) return found;
  if (chart.duplicate.length >= MAX_DUPLICATE_LAYERS) return null;
  chart.duplicate.push(blankLayer(chart, yarn));
  return chart.duplicate.length - 1;
}

/** Paint a cell of a striped chart in any of the chart's yarns. Returns true if it changed. */
export function paintStripeCell(chart: Chart, round: number, pair: number, yarn: YarnId): boolean {
  if (chart.mode !== "stripes" || !isPresent(round, pair) || !chart.yarns.some((y) => y.id === yarn)) return false;
  if (visibleYarnAt(chart, round, pair) === yarn) return false;
  const inPair = yarnsInRound(chart, round).includes(yarn);
  const layer = inPair ? null : stripeLayerFor(chart, yarn);
  if (!inPair && layer === null) return false;
  for (const l of chart.duplicate) if (hasDuplicate(l, round, pair)) writeLayer(l, round, pair, "0");
  if (inPair) setOutside(chart, round, pair, yarn);
  else writeLayer(chart.duplicate[layer as number] as DuplicateLayer, round, pair, "1");
  return true;
}

/** Fill the connected area of one colour with another, in a striped chart. */
export function fillStripes(chart: Chart, round: number, pair: number, yarn: YarnId): CellRef[] {
  const target = visibleYarnAt(chart, round, pair);
  if (target === null || target === yarn) return [];
  const key = (r: number, p: number) => r * 256 + p;
  const seen = new Set<number>([key(round, pair)]);
  const stack: CellRef[] = [{ round, pair }];
  const found: CellRef[] = [];
  while (stack.length > 0) {
    const c = stack.pop() as CellRef;
    found.push(c);
    for (const [dr, dp] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const r = c.round + dr;
      const p = wrapPair(c.pair + dp);
      if (!isPresent(r, p) || seen.has(key(r, p)) || visibleYarnAt(chart, r, p) !== target) continue;
      seen.add(key(r, p));
      stack.push({ round: r, pair: p });
    }
  }
  return found.filter((c) => paintStripeCell(chart, c.round, c.pair, yarn));
}

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Change which two yarns each body round is worked in (the crown follows round 75). What is drawn keeps its colour:
 * where the colour is still in the round's pair it is knitted, and where it isn't it becomes duplicate stitch over the
 * nearest yarn of the pair. If all four duplicate layers are taken, that cell takes the nearest yarn instead.
 */
export function setRoundPairs(chart: Chart, pairs: [YarnId, YarnId][]): { moved: number; lost: number } {
  if (chart.mode !== "stripes" || pairs.length !== BODY_ROUNDS) return { moved: 0, lost: 0 };
  const hex = (id: YarnId) => rgbOf(chart.yarns.find((y) => y.id === id)?.hex ?? "#000000");
  const far = (a: YarnId, b: YarnId) => {
    const x = hex(a);
    const y = hex(b);
    return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
  };
  // What each cell looks like now, before anything changes
  const before = new Map<number, YarnId>();
  for (let round = 1; round <= LAST_ROUND; round++) {
    for (let p = 1; p <= PAIRS; p++) {
      const v = visibleYarnAt(chart, round, p);
      if (v !== null) before.set(round * 256 + p, v);
    }
  }
  chart.round_pairs = pairs.map(([a, b]) => [a, b]);
  for (const l of chart.duplicate) {
    l.body = l.body.map((r) => "0".repeat(r.length));
    l.crown = l.crown.map((r) => [...r].map((ch) => (ch === "." ? "." : "0")).join(""));
  }
  let moved = 0;
  let lost = 0;
  for (let round = 1; round <= LAST_ROUND; round++) {
    const [a, b] = pairs[Math.min(round, BODY_ROUNDS) - 1] as [YarnId, YarnId];
    for (let p = 1; p <= PAIRS; p++) {
      const v = before.get(round * 256 + p);
      if (v === undefined) continue;
      if (v === a || v === b) {
        setOutside(chart, round, p, v);
        continue;
      }
      const under = far(v, a) <= far(v, b) ? a : b;
      if (round <= BODY_ROUNDS) chart.body[round - 1] = setChar(chart.body[round - 1] as string, p - 1, under);
      else chart.crown.rounds[round - FIRST_CROWN_ROUND] = setChar(chart.crown.rounds[round - FIRST_CROWN_ROUND] as string, p - 1, under);
      const layer = stripeLayerFor(chart, v);
      if (layer === null) lost++;
      else {
        writeLayer(chart.duplicate[layer] as DuplicateLayer, round, p, "1");
        moved++;
      }
    }
  }
  // A layer with nothing in it only takes up one of the four
  chart.duplicate = chart.duplicate.filter((l) => [...l.body, ...l.crown].some((r) => r.includes("1")));
  return { moved, lost };
}

/** Add another stripe yarn (up to six). Returns its id, or null if there is no room. */
export function addStripeYarn(chart: Chart, look: { name: string; hex: string }): YarnId | null {
  if (chart.mode !== "stripes") return null;
  const id = ["A", "B", "C", "D", "E", "F"].find((c) => !chart.yarns.some((y) => y.id === c));
  if (!id) return null;
  chart.yarns.push({ id, name: look.name, hex: look.hex, role: "stripe" });
  return id;
}

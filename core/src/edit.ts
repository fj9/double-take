/**
 * Editing a chart cell by cell (spec 7.3 and 7.5). These functions change the chart they are given, and only
 * ever make changes that keep it valid. Only the 75 body rounds can be edited: the crown is the same for
 * every hat. A cell is in at most one duplicate layer.
 */
import { outsideAt, yarnsInRound } from "./chart";
import type { Chart, DuplicateLayer } from "./chart";
import { BODY_ROUNDS, PAIRS } from "./hat";

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
  /** Mirror the body top to bottom: round 1 with 75. */
  mirrorY: boolean;
  /** Repeat the motif this many times round the hat. */
  repeat: number;
}

export const NO_SYMMETRY: Symmetry = { mirrorX: false, mirrorY: false, repeat: 1 };

const wrapPair = (p: number) => ((((p - 1) % PAIRS) + PAIRS) % PAIRS) + 1;

/** True for a cell that can be edited: a pair in the body. The crown is fixed. */
export function isEditable(round: number, pair: number): boolean {
  return Number.isInteger(round) && Number.isInteger(pair) && round >= 1 && round <= BODY_ROUNDS && pair >= 1 && pair <= PAIRS;
}

function setChar(s: string, i: number, ch: string): string {
  return s.slice(0, i) + ch + s.slice(i + 1);
}

/** Does this duplicate layer cover this cell? */
export function hasDuplicate(layer: DuplicateLayer, round: number, pair: number): boolean {
  return round >= 1 && round <= BODY_ROUNDS && layer.body[round - 1]?.[pair - 1] === "1";
}

function writeLayer(layer: DuplicateLayer, round: number, pair: number, ch: string): void {
  layer.body[round - 1] = setChar(layer.body[round - 1] as string, pair - 1, ch);
}

/** Set the outside yarn of a pair. Returns true if anything changed. */
export function setOutside(chart: Chart, round: number, pair: number, yarn: string): boolean {
  if (!isEditable(round, pair)) return false;
  if (!yarnsInRound(chart, round).includes(yarn)) return false;
  if (outsideAt(chart, round, pair) === yarn) return false;
  chart.body[round - 1] = setChar(chart.body[round - 1] as string, pair - 1, yarn);
  return true;
}

/** Turn duplicate stitch on or off for a cell in one layer. Turning it on takes the cell out of any other layer. */
export function setDuplicate(chart: Chart, layerIndex: number, round: number, pair: number, on: boolean): boolean {
  const layer = chart.duplicate[layerIndex];
  if (!layer || !isEditable(round, pair)) return false;
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

/** Fill the connected region of same-valued cells that contains a cell. Joins across the seam. */
export function floodFill(chart: Chart, layer: EditLayer, round: number, pair: number, value: string): CellRef[] {
  if (!isEditable(round, pair)) return [];
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
      if (!isEditable(r, p) || seen.has(key(r, p))) continue;
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
    if (isEditable(r, p)) out.set(r * 256 + p, { round: r, pair: p });
  };
  for (let k = 0; k < PAIRS / step; k++) {
    const p = wrapPair(pair + k * step);
    add(round, p);
    if (sym.mirrorX) add(round, PAIRS + 1 - p);
    if (sym.mirrorY) {
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
  chart.duplicate.push({ yarn: id, faces: "both", body: chart.body.map((r) => "0".repeat(r.length)) });
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

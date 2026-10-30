import type { Chart } from "@doubletake/core";
import type { Pace } from "./pace";

/** Total rounds in the hat (body 1-75, crown 76-95). */
export const TOTAL_ROUNDS = 95;
export const MANUAL_STEPS = ["swatch", "caston", "finish", "block"] as const;
export type ManualStep = (typeof MANUAL_STEPS)[number];

export interface PatchTick {
  outside: boolean;
  inside: boolean;
}

export interface Progress {
  projectId: string;
  /** Rounds finished, 0 to 95. The round to work is completed + 1. */
  completed: number;
  /** Last pair worked in the current round ("I’m at pair 37"), or null. */
  pair: number | null;
  steps: Partial<Record<ManualStep, boolean>>;
  /** Keyed `${layer}:${patchIndex}`. */
  patches: Record<string, PatchTick>;
  /** An optional plan to spread the rounds over some days. It stays on this device and is never part of the chart. */
  pace?: Pace;
  /** Ids of round notes the knitter has opened, so unread ones can be marked. A setting: Undo leaves it alone. */
  notesSeen?: string[];
  /** What the last few changes replaced, newest last, so Undo can put things back. */
  history: Undo[];
  updatedAt: number;
}

export type Undo =
  | { kind: "round"; completed: number; pair: number | null }
  | { kind: "pair"; pair: number | null }
  | { kind: "step"; step: ManualStep; value: boolean }
  | { kind: "patch"; key: string; value: PatchTick | undefined };

export interface Project {
  id: string;
  name: string;
  /** Still being designed (drawing, then review) or being knitted. Missing means knitting. */
  stage?: "design" | "knit";
  chart: Chart;
  createdAt: number;
  updatedAt: number;
}

const HISTORY_LIMIT = 50;

export function newProgress(projectId: string, now = Date.now()): Progress {
  return { projectId, completed: 0, pair: null, steps: {}, patches: {}, history: [], updatedAt: now };
}

/** The round to work next, 1 to 95 (stays at 95 once every round is done). */
export function currentRound(p: Progress): number {
  return Math.min(p.completed + 1, TOTAL_ROUNDS);
}

export function allRoundsDone(p: Progress): boolean {
  return p.completed >= TOTAL_ROUNDS;
}

function withHistory(p: Progress, entry: Undo, patch: Partial<Progress>, now: number): Progress {
  return { ...p, ...patch, history: [...p.history, entry].slice(-HISTORY_LIMIT), updatedAt: now };
}

/** Finish the current round and move to the next one. */
export function nextRound(p: Progress, now = Date.now()): Progress {
  if (allRoundsDone(p)) return p;
  return withHistory(p, { kind: "round", completed: p.completed, pair: p.pair }, { completed: p.completed + 1, pair: null }, now);
}

/** Step back one round (the previous round becomes the current round again). */
export function previousRound(p: Progress, now = Date.now()): Progress {
  if (p.completed <= 0) return p;
  return withHistory(p, { kind: "round", completed: p.completed, pair: p.pair }, { completed: p.completed - 1, pair: null }, now);
}

export function setPair(p: Progress, pair: number | null, now = Date.now()): Progress {
  if (pair === p.pair) return p;
  return withHistory(p, { kind: "pair", pair: p.pair }, { pair }, now);
}

export function toggleStep(p: Progress, step: ManualStep, now = Date.now()): Progress {
  const value = !!p.steps[step];
  return withHistory(p, { kind: "step", step, value }, { steps: { ...p.steps, [step]: !value } }, now);
}

export function patchKey(layer: number, index: number): string {
  return `${layer}:${index}`;
}

/** Tick or untick one face of a duplicate stitch patch. */
export function togglePatchFace(p: Progress, key: string, face: "outside" | "inside", now = Date.now()): Progress {
  const before = p.patches[key];
  const next: PatchTick = { outside: before?.outside ?? false, inside: before?.inside ?? false };
  next[face] = !next[face];
  return withHistory(p, { kind: "patch", key, value: before }, { patches: { ...p.patches, [key]: next } }, now);
}

export function canUndo(p: Progress): boolean {
  return p.history.length > 0;
}

/** Put back whatever the last change replaced. */
export function undo(p: Progress, now = Date.now()): Progress {
  const last = p.history[p.history.length - 1];
  if (!last) return p;
  const history = p.history.slice(0, -1);
  const base = { ...p, history, updatedAt: now };
  switch (last.kind) {
    case "round":
      return { ...base, completed: last.completed, pair: last.pair };
    case "pair":
      return { ...base, pair: last.pair };
    case "step":
      return { ...base, steps: { ...p.steps, [last.step]: last.value } };
    case "patch": {
      const patches = { ...p.patches };
      if (last.value) patches[last.key] = last.value;
      else delete patches[last.key];
      return { ...base, patches };
    }
  }
}

/** Percent of the rounds finished, 0 to 100. */
export function percentComplete(p: Progress): number {
  return Math.round((Math.min(p.completed, TOTAL_ROUNDS) / TOTAL_ROUNDS) * 100);
}

export function patchesDone(p: Progress, keys: { key: string; faces: "both" | "outside" }[]): number {
  return keys.filter(({ key, faces }) => {
    const t = p.patches[key];
    return !!t && t.outside && (faces === "outside" || t.inside);
  }).length;
}

/** A project's backup file: everything needed to restore it on another device. */
export interface Backup {
  kind: "doubletake-backup/1";
  project: Project;
  progress: Progress;
}

/** Set or clear the pace plan. This is a setting, not a step, so Undo leaves it alone. */
export function setPace(p: Progress, pace: Pace | undefined, now = Date.now()): Progress {
  const { pace: _old, ...rest } = p;
  return pace ? { ...rest, pace, updatedAt: now } : { ...rest, updatedAt: now };
}

/** Remember that a round note has been opened. This is a setting, not a step, so Undo leaves it alone. */
export function markNoteSeen(p: Progress, id: string): Progress {
  if (p.notesSeen?.includes(id)) return p;
  return { ...p, notesSeen: [...(p.notesSeen ?? []), id] };
}

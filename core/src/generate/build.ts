import { SCHEMA } from "../chart";
import type { Chart, DuplicateLayer, Yarn } from "../chart";
import { BODY_ROUNDS, CROWN_ROUNDS, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS, crownLayout } from "../hat";
import { validateChart } from "../validate";
import type { Rgb } from "./colour";
import { components, ring } from "./grid";
import { planPairs } from "./routes";
import type { Pair } from "./routes";
import type { RoleResult } from "./roles";

export type Choice =
  /** Two colours, nothing embroidered. */
  | { kind: "two" }
  /** Two knitted colours, with the other colours embroidered on top. */
  | { kind: "duplicate"; dupRoles?: number[]; outsideRole?: number; faces?: "both" | "outside" }
  /** Stripes: two yarns a round, the pair changing up the hat, with duplicate stitch for cells outside the pair. */
  | { kind: "stripes"; lam?: number };

export interface BuildOptions {
  name?: string;
  yarnNames?: string[];
  /** Colours to use instead of the ones found in the picture (for example the real yarn colours), by colour role. */
  yarnHex?: string[];
  crown?: { variant: "patterned" | "plain"; plainFrom?: number };
  created?: string;
}

/** The choice can't be made into a chart. The message says why, for the knitter. */
export class BuildError extends Error {}

/** A plain crown closes the colourwork after round 85 unless told otherwise. */
export const DEFAULT_PLAIN_FROM = 86;

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const W = PAIRS;
const H = BODY_ROUNDS;
const hex = (c: Rgb) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/**
 * Build a chart file from the colour roles and a choice of how to knit them.
 * Throws a BuildError if the choice can't be made into a valid chart.
 */
export function buildChart(roles: RoleResult, choice: Choice, opts: BuildOptions = {}): Chart {
  const k = roles.centres.length;
  const centre = (r: number) => roles.centres[r] as Rgb;
  const names = (r: number) => opts.yarnNames?.[r]?.trim() || `colour ${r + 1}`;
  const colourOf = (r: number) => (opts.yarnHex?.[r] && /^#[0-9a-fA-F]{6}$/.test(opts.yarnHex[r] as string) ? (opts.yarnHex[r] as string) : hex(centre(r)));
  const body = (round: number, pair: number) => roles.grid.data[(H - round) * W + (W - pair)] as number; // round 1 at the bottom, pair 1 at the right

  // ---- the choice ----
  let knit: [number, number] = [0, 1];
  let dupRoles: number[] = [];
  let pairs: Pair[] | null = null;
  if (choice.kind === "two") {
    if (k !== 2) throw new BuildError("A two-colour chart needs exactly two colours.");
  } else if (choice.kind === "duplicate") {
    dupRoles = [...(choice.dupRoles ?? [...Array(k).keys()].filter((r) => r >= 2))].sort((a, b) => a - b);
    const rest = [...Array(k).keys()].filter((r) => !dupRoles.includes(r));
    if (rest.length !== 2) throw new BuildError("A duplicate stitch chart knits two colours and embroiders the rest.");
    if (dupRoles.length < 1 || dupRoles.length > 4) throw new BuildError("Duplicate stitch can use one to four extra colours.");
    const first = choice.outsideRole !== undefined && rest.includes(choice.outsideRole) ? choice.outsideRole : (rest[0] as number);
    knit = [first, rest.find((r) => r !== first) as number];
  } else {
    pairs = planPairs(roles.grid, choice.lam ?? 25);
  }
  const stripes = pairs !== null;
  const pairOf = (round: number): Pair => (pairs as Pair[])[Math.min(round, H) - 1] as Pair;

  const plainFrom = stripes ? FIRST_CROWN_ROUND : opts.crown?.variant === "plain" ? (opts.crown.plainFrom ?? DEFAULT_PLAIN_FROM) : null;
  if (plainFrom !== null && (!Number.isInteger(plainFrom) || plainFrom < FIRST_CROWN_ROUND || plainFrom > LAST_ROUND)) {
    throw new BuildError("A plain crown starts at a round from 76 to 95.");
  }
  const ground = stripes ? pairOf(H)[0] : knit[0];

  // ---- the real colour role of every cell in rounds 1 to 95 (-1 where a decrease has removed the pair) ----
  const real: number[][] = [[]];
  for (let r = 1; r <= H; r++) real[r] = Array.from({ length: W }, (_, i) => body(r, i + 1));
  // A plain crown mirrors the top rounds upward and keeps only the patches that touch the body's top round.
  const keepRows = plainFrom !== null && !stripes ? Math.max(0, Math.min(CROWN_ROUNDS, plainFrom - FIRST_CROWN_ROUND)) : 0;
  const keep = new Uint8Array(Math.max(1, keepRows) * W);
  if (keepRows > 0) {
    const mask = new Uint8Array(keepRows * W);
    for (let i = 0; i < keepRows; i++) for (let p = 0; p < W; p++) mask[i * W + p] = body(H - i, p + 1) !== ground ? 1 : 0;
    const { labels } = components(mask, W, keepRows, true);
    const touching = new Set<number>();
    for (let p = 0; p < W; p++) if (labels[p]) touching.add(labels[p] as number);
    for (let i = 0; i < labels.length; i++) keep[i] = touching.has(labels[i] as number) ? 1 : 0;
  }
  for (let r = FIRST_CROWN_ROUND; r <= LAST_ROUND; r++) {
    const { present } = crownLayout(r);
    const i = r - FIRST_CROWN_ROUND;
    real[r] = Array.from({ length: W }, (_, p) => {
      if (!present[p]) return -1;
      if (plainFrom === null) return body(r - H, p + 1); // the print carries on: rounds 76 to 95 repeat rounds 1 to 20
      return i < keepRows && keep[i * W + p] ? body(H - i, p + 1) : ground;
    });
  }

  // ---- which cells are embroidered ----
  const isDup = (round: number, p: number): boolean => {
    const role = (real[round] as number[])[p] as number;
    if (role < 0) return false;
    if (stripes) return round <= H && !pairOf(round).includes(role);
    return dupRoles.includes(role);
  };

  // ---- the colour knitted under every cell ----
  const under: number[][] = [[]];
  for (let r = 1; r <= LAST_ROUND; r++) {
    under[r] = (real[r] as number[]).map((role) => {
      if (role < 0) return -1;
      if (stripes) {
        const pr = pairOf(r);
        if (pr.includes(role)) return role;
        const d = (a: number) => centre(role).reduce((s, v, c) => s + (v - centre(a)[c]!) ** 2, 0);
        return d(pr[0]) <= d(pr[1]) ? pr[0] : pr[1];
      }
      return role;
    });
  }
  if (!stripes && dupRoles.length > 0) {
    // Each embroidered patch is knitted in whichever knitted colour mostly surrounds it
    const stacked = new Uint8Array(LAST_ROUND * W);
    for (let r = 1; r <= LAST_ROUND; r++) for (let p = 0; p < W; p++) stacked[(r - 1) * W + p] = isDup(r, p) ? 1 : 0;
    const { labels, count } = components(stacked, W, LAST_ROUND, true);
    for (let label = 1; label <= count; label++) {
      const counts = [0, 0];
      for (const q of ring(labels, label, W, LAST_ROUND, true)) {
        const v = (real[Math.floor(q / W) + 1] as number[])[q % W];
        if (v === knit[0]) counts[0]!++;
        else if (v === knit[1]) counts[1]!++;
      }
      const pick = (counts[1] as number) > (counts[0] as number) ? knit[1] : knit[0];
      for (let q = 0; q < labels.length; q++) if (labels[q] === label) (under[Math.floor(q / W) + 1] as number[])[q % W] = pick;
    }
  }

  // ---- yarns ----
  const yarns: Yarn[] = [];
  const knitId = new Map<number, string>();
  const dupId = new Map<number, string>();
  let layerRoles: number[] = [];
  if (choice.kind === "two" || choice.kind === "duplicate") {
    knit.forEach((role, i) => {
      knitId.set(role, LETTERS[i] as string);
      yarns.push({ id: LETTERS[i] as string, name: names(role), hex: colourOf(role), role: "main" });
    });
    if (choice.kind === "duplicate") {
      layerRoles = dupRoles;
      dupRoles.forEach((role, i) => {
        dupId.set(role, LETTERS[2 + i] as string);
        yarns.push({ id: LETTERS[2 + i] as string, name: names(role), hex: colourOf(role), role: "duplicate" });
      });
    }
  } else {
    roles.centres.forEach((_c, role) => {
      knitId.set(role, LETTERS[role] as string);
      dupId.set(role, LETTERS[role] as string);
      yarns.push({ id: LETTERS[role] as string, name: names(role), hex: colourOf(role), role: "stripe" });
    });
    const used = new Set<number>();
    for (let r = 1; r <= H; r++) for (let p = 0; p < W; p++) if (isDup(r, p)) used.add((real[r] as number[])[p] as number);
    layerRoles = [...used].sort((a, b) => a - b);
    if (layerRoles.length > 4) {
      throw new BuildError(`With stripes this picture needs ${layerRoles.length} different duplicate stitch colours, and a chart can have at most 4. Try fewer colours.`);
    }
  }

  // ---- strings ----
  const rowString = (round: number) => (under[round] as number[]).map((role) => (role < 0 ? "." : (knitId.get(role) as string))).join("");
  const layers: DuplicateLayer[] = layerRoles.map((role) => {
    const cell = (round: number, p: number) => ((real[round] as number[])[p] === role && isDup(round, p) ? "1" : "0");
    return {
      yarn: dupId.get(role) as string,
      faces: stripes ? "outside" : (choice as { faces?: "both" | "outside" }).faces ?? "both",
      body: Array.from({ length: H }, (_, i) => Array.from({ length: W }, (_, p) => cell(i + 1, p)).join("")),
      crown: Array.from({ length: CROWN_ROUNDS }, (_, i) => {
        const round = FIRST_CROWN_ROUND + i;
        return Array.from({ length: W }, (_, p) => ((real[round] as number[])[p] === -1 ? "." : cell(round, p))).join("");
      }),
    };
  });

  const chart: Chart = {
    schema: SCHEMA,
    name: opts.name ?? "My hat",
    ...(opts.created ? { created: opts.created } : {}),
    generator: { tool: "doubletake-core", version: "0.1.0" },
    mode: choice.kind === "two" ? "two_colour" : choice.kind === "duplicate" ? "duplicate" : "stripes",
    dimensions: { pairs: PAIRS, body_rounds: BODY_ROUNDS, crown_rounds: CROWN_ROUNDS },
    yarns,
    body: Array.from({ length: H }, (_, i) => rowString(i + 1)),
    round_pairs: stripes ? (pairs as Pair[]).map(([a, b]) => [LETTERS[a] as string, LETTERS[b] as string]) : null,
    duplicate: layers,
    crown: { variant: plainFrom === null ? "patterned" : "plain", plain_from: plainFrom, rounds: Array.from({ length: CROWN_ROUNDS }, (_, i) => rowString(FIRST_CROWN_ROUND + i)) },
    source: { kind: "image", settings: { colours: k, seam: roles.seam, choice } },
  };
  const result = validateChart(chart);
  if (!result.ok) throw new BuildError(`The chart didn't come out right: ${result.errors[0]?.message ?? "unknown problem"}`);
  return chart;
}

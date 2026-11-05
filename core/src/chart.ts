import {
  BODY_ROUNDS,
  CROWN_ROUNDS,
  FIRST_CROWN_ROUND,
  PAIRS,
  crownLayout,
} from "./hat";

/** The chart file format, `doubletake-chart/1` (spec section 10). */
export const SCHEMA = "doubletake-chart/1";

export type Mode = "two_colour" | "duplicate" | "stripes";
export type YarnRole = "main" | "stripe" | "duplicate";
export type YarnId = string;

export interface Yarn {
  id: YarnId;
  name: string;
  hex: string;
  role: YarnRole;
}

export interface DuplicateLayer {
  yarn: YarnId;
  faces: "both" | "outside";
  /** 75 strings of 112 characters, `1` = duplicate stitch, `0` = none. */
  body: string[];
  /** 20 strings of 112 characters: `1`, `0`, and `.` at removed pairs. */
  crown: string[];
}

export interface Crown {
  /** 20 strings of 112 characters: the outside yarn id, or `.` for a removed pair. */
  rounds: string[];
}

export interface Chart {
  schema: typeof SCHEMA;
  name: string;
  created?: string;
  generator?: { tool: string; version: string };
  mode: Mode;
  dimensions: { pairs: number; body_rounds: number; crown_rounds: number };
  yarns: Yarn[];
  /** 75 strings of 112 characters; character 0 is pair 1; each is the outside yarn id. */
  body: string[];
  /** For stripes: one [yarn, yarn] pair per body round. Null otherwise. */
  round_pairs: [YarnId, YarnId][] | null;
  duplicate: DuplicateLayer[];
  crown: Crown;
  yardage?: unknown;
  source?: { kind: "image" | "claude" | "drawn" | "example"; note?: string; settings?: unknown };
}

/** The 20 crown rows in one colour on the outside, with `.` where a decrease has removed the pair. */
export function solidCrownRounds(yarn: YarnId): string[] {
  return Array.from({ length: CROWN_ROUNDS }, (_, i) =>
    crownLayout(FIRST_CROWN_ROUND + i)
      .present.map((here) => (here ? yarn : "."))
      .join(""),
  );
}

/** 20 crown rows with no duplicate stitch. */
export function emptyDuplicateCrown(): string[] {
  return solidCrownRounds("0");
}

/**
 * Bring a chart from an older file up to date: a chart saved without a crown gets a solid one (the first yarn of
 * the top round's pair outside), a duplicate layer without crown rows gets empty ones, and the crown's old
 * `variant` and `plain_from` fields are dropped. Anything that isn't a chart is returned as it came.
 */
export function upgradeChart(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const chart = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...chart };
  const mode = chart.mode;
  const yarns = Array.isArray(chart.yarns) ? (chart.yarns as { id?: unknown; role?: unknown }[]) : [];
  const roundPairs = Array.isArray(chart.round_pairs) ? (chart.round_pairs as unknown[]) : null;
  const top = mode === "stripes" && roundPairs ? roundPairs[BODY_ROUNDS - 1] : undefined;
  const firstMain = yarns.find((y) => y.role === "main")?.id;
  const ground = Array.isArray(top) && typeof top[0] === "string" ? top[0] : typeof firstMain === "string" ? firstMain : "A";
  const crown = chart.crown;
  const rounds = typeof crown === "object" && crown !== null ? (crown as { rounds?: unknown }).rounds : undefined;
  out.crown = { rounds: Array.isArray(rounds) ? rounds : solidCrownRounds(ground) };
  if (Array.isArray(chart.duplicate)) {
    out.duplicate = (chart.duplicate as unknown[]).map((layer) =>
      typeof layer === "object" && layer !== null && !Array.isArray(layer) && !Array.isArray((layer as { crown?: unknown }).crown)
        ? { ...layer, crown: emptyDuplicateCrown() }
        : layer,
    );
  }
  return out;
}

/** The two yarns worked in a round. Rounds are 1 to 95. */
export function yarnsInRound(chart: Chart, round: number): [YarnId, YarnId] {
  if (chart.mode === "stripes" && chart.round_pairs) {
    // The crown follows the last body round's pair.
    const pair = chart.round_pairs[Math.min(round, BODY_ROUNDS) - 1];
    if (pair) return pair;
  }
  const mains = chart.yarns.filter((y) => y.role === "main");
  return [mains[0]?.id ?? "A", mains[1]?.id ?? "B"];
}

/** How much of the crown is not one colour: the last round that has print or duplicate stitch, and how many pairs. Null if it is one colour. */
export function crownPrint(chart: Chart): { lastRound: number; pairs: number } | null {
  let lastRound = 0;
  let pairs = 0;
  chart.crown.rounds.forEach((row, i) => {
    const round = FIRST_CROWN_ROUND + i;
    const ground = yarnsInRound(chart, round)[0];
    let here = 0;
    for (let p = 0; p < row.length; p++) {
      const ch = row[p] as string;
      if ((ch !== "." && ch !== ground) || chart.duplicate.some((l) => l.crown[i]?.[p] === "1")) here++;
    }
    if (here > 0) lastRound = round;
    pairs += here;
  });
  return pairs > 0 ? { lastRound, pairs } : null;
}

/** The yarn on the outside of a pair, or null for a pair removed by a decrease. */
export function outsideAt(chart: Chart, round: number, pair: number): YarnId | null {
  const row = round <= BODY_ROUNDS ? chart.body[round - 1] : chart.crown.rounds[round - FIRST_CROWN_ROUND];
  const ch = row?.[pair - 1];
  if (ch === undefined || ch === ".") return null;
  return ch;
}

/** The yarn on the inside of a pair: the other yarn in the round's pair. */
export function insideAt(chart: Chart, round: number, pair: number): YarnId | null {
  const outside = outsideAt(chart, round, pair);
  if (outside === null) return null;
  const [a, b] = yarnsInRound(chart, round);
  return outside === a ? b : a;
}

/** A valid, plain two-colour chart to start drawing on: yarn A outside everywhere. */
export function newBlankChart(
  name: string,
  yarns: { name: string; hex: string }[] = [
    { name: "colour A", hex: "#1b2a41" },
    { name: "colour B", hex: "#f26b5b" },
  ],
): Chart {
  const [a, b] = yarns;
  if (!a || !b) throw new RangeError("A chart needs two main yarns.");
  const body = Array.from({ length: BODY_ROUNDS }, () => "A".repeat(PAIRS));
  return {
    schema: SCHEMA,
    name,
    mode: "two_colour",
    dimensions: { pairs: PAIRS, body_rounds: BODY_ROUNDS, crown_rounds: CROWN_ROUNDS },
    yarns: [
      { id: "A", name: a.name, hex: a.hex, role: "main" },
      { id: "B", name: b.name, hex: b.hex, role: "main" },
    ],
    body,
    round_pairs: null,
    duplicate: [],
    crown: { rounds: solidCrownRounds("A") },
    source: { kind: "drawn" },
  };
}


const STRIPE_IDS = ["A", "B", "C", "D", "E", "F"];

/**
 * A plain striped chart to start drawing on: two to six stripe yarns, with the body split into even bands,
 * each band worked in a neighbouring pair of yarns (A and B, then B and C, and so on), and the outside in the pair's first yarn.
 */
export function newBlankStripesChart(name: string, yarns: { name: string; hex: string }[]): Chart {
  if (yarns.length < 2 || yarns.length > 6) throw new RangeError("A striped chart needs two to six yarns.");
  const bands = yarns.length - 1;
  const pairs: [string, string][] = Array.from({ length: BODY_ROUNDS }, (_, i) => {
    const band = Math.min(bands - 1, Math.floor((i * bands) / BODY_ROUNDS));
    return [STRIPE_IDS[band] as string, STRIPE_IDS[band + 1] as string];
  });
  const last = pairs[BODY_ROUNDS - 1] as [string, string];
  return {
    schema: SCHEMA,
    name,
    mode: "stripes",
    dimensions: { pairs: PAIRS, body_rounds: BODY_ROUNDS, crown_rounds: CROWN_ROUNDS },
    yarns: yarns.map((y, i) => ({ id: STRIPE_IDS[i] as string, name: y.name, hex: y.hex, role: "stripe" as const })),
    body: pairs.map(([first]) => first.repeat(PAIRS)),
    round_pairs: pairs,
    duplicate: [],
    crown: { rounds: solidCrownRounds(last[0]) },
    source: { kind: "drawn" },
  };
}

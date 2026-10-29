import {
  BODY_ROUNDS,
  CROWN_ROUNDS,
  FIRST_CROWN_ROUND,
  LAST_ROUND,
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
  variant: "patterned" | "plain";
  /** First plain round (76 to 95) for a plain crown, null for a patterned one. */
  plain_from: number | null;
  /** 20 strings of 112 characters: a yarn id, or `.` for a removed pair. */
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

/** The two yarns worked in a round. Rounds are 1 to 95. */
export function yarnsInRound(chart: Chart, round: number): [YarnId, YarnId] {
  if (chart.mode === "stripes" && chart.round_pairs) {
    // The crown follows the last body round's pair until the crown rules for stripes are settled.
    const pair = chart.round_pairs[Math.min(round, BODY_ROUNDS) - 1];
    if (pair) return pair;
  }
  const mains = chart.yarns.filter((y) => y.role === "main");
  return [mains[0]?.id ?? "A", mains[1]?.id ?? "B"];
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
  const rounds = Array.from({ length: CROWN_ROUNDS }, (_, i) =>
    crownLayout(FIRST_CROWN_ROUND + i)
      .present.map((here) => (here ? "A" : "."))
      .join(""),
  );
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
    crown: { variant: "patterned", plain_from: null, rounds },
    source: { kind: "drawn" },
  };
}

/**
 * The same chart with a plain crown from `plainFrom` (76 to 95): earlier crown rounds keep the print,
 * later rounds are the first main yarn outside, and no duplicate stitch from that round on.
 * (Generating a plain crown from an image is the generator's job; this applies the rule to a chart.)
 */
export function withPlainCrown(chart: Chart, plainFrom: number): Chart {
  if (!Number.isInteger(plainFrom) || plainFrom < FIRST_CROWN_ROUND || plainFrom > LAST_ROUND) {
    throw new RangeError(`A plain crown starts at a round from ${FIRST_CROWN_ROUND} to ${LAST_ROUND}.`);
  }
  const ground = chart.yarns.find((y) => y.role === "main")?.id ?? "A";
  const plain = (s: string, round: number, fill: (ch: string) => string) =>
    round >= plainFrom ? [...s].map((ch) => (ch === "." ? "." : fill(ch))).join("") : s;
  return {
    ...chart,
    crown: {
      variant: "plain",
      plain_from: plainFrom,
      rounds: chart.crown.rounds.map((s, i) => plain(s, FIRST_CROWN_ROUND + i, () => ground)),
    },
    duplicate: chart.duplicate.map((layer) => ({
      ...layer,
      crown: layer.crown.map((s, i) => plain(s, FIRST_CROWN_ROUND + i, () => "0")),
    })),
  };
}

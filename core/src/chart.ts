import { BODY_ROUNDS, PAIRS, crownLayout } from "./hat";

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
  /** 75 strings of 112 characters, `1` = duplicate stitch, `0` = none. The crown has no duplicate stitch. */
  body: string[];
  /** Kept only so older files still load; the crown has no duplicate stitch and this is ignored. */
  crown?: string[];
}

/**
 * A chart is the 75 body rounds. The crown is the same for every hat, so it is not stored: the main colour A on
 * the outside and the other colour on the inside (in a striped hat, the top stripe's colours).
 */
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
  yardage?: unknown;
  source?: { kind: "image" | "claude" | "drawn" | "example"; note?: string; settings?: unknown };
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

/** The yarn on the outside of every crown pair: the first yarn of the top round's pair (yarn A in a hat that isn't striped). */
export function crownGround(chart: Chart): YarnId {
  return yarnsInRound(chart, BODY_ROUNDS)[0];
}

/** The yarn on the outside of a pair, or null for a pair removed by a decrease. */
export function outsideAt(chart: Chart, round: number, pair: number): YarnId | null {
  if (round > BODY_ROUNDS) return crownLayout(round).present[pair - 1] ? crownGround(chart) : null;
  const ch = chart.body[round - 1]?.[pair - 1];
  return ch === undefined ? null : ch;
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
  return {
    schema: SCHEMA,
    name,
    mode: "two_colour",
    dimensions: { pairs: PAIRS, body_rounds: BODY_ROUNDS, crown_rounds: 20 },
    yarns: [
      { id: "A", name: a.name, hex: a.hex, role: "main" },
      { id: "B", name: b.name, hex: b.hex, role: "main" },
    ],
    body: Array.from({ length: BODY_ROUNDS }, () => "A".repeat(PAIRS)),
    round_pairs: null,
    duplicate: [],
    source: { kind: "drawn" },
  };
}

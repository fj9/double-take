import { SCHEMA, upgradeChart, yarnsInRound } from "./chart";
import type { Chart } from "./chart";
import {
  BODY_ROUNDS,
  CROWN_ROUNDS,
  FIRST_CROWN_ROUND,
  PAIRS,
  crownLayout,
} from "./hat";

export interface ChartError {
  code: string;
  /** Where in the file, for example `body[11]` or `duplicate[0].crown[3]`. */
  path: string;
  /** What happened, in words a knitter can act on. */
  message: string;
}

export type ValidationResult = { ok: true; chart: Chart } | { ok: false; errors: ChartError[] };

const MAX_ERRORS = 50;
const MODES = ["two_colour", "duplicate", "stripes"];
const ROLES = ["main", "stripe", "duplicate"];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse the text of a `.doubletake.json` file and validate it. Never throws. */
export function parseChartJson(text: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("not_json", "", "That file isn’t valid JSON, so it can’t be a Doubletake chart.");
  }
  return validateChart(data);
}

function fail(code: string, path: string, message: string): ValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}

/**
 * Check a chart against spec sections 10.1 and 10.2. Returns every problem found (up to 50). A chart from an
 * older file (no crown) is brought up to date first, and the chart in the result is the updated one.
 */
export function validateChart(raw: unknown): ValidationResult {
  const input = upgradeChart(raw);
  if (!isObject(input)) return fail("not_a_chart", "", "That file isn’t a Doubletake chart.");

  const schema = input.schema;
  if (typeof schema !== "string") {
    return fail("not_a_chart", "schema", "That file isn’t a Doubletake chart (it has no schema).");
  }
  if (schema !== SCHEMA) {
    return /^doubletake-chart\/\d+$/.test(schema)
      ? fail(
          "schema_version",
          "schema",
          `This chart is in a different format version (${schema}). This version of Doubletake reads ${SCHEMA}.`,
        )
      : fail("not_a_chart", "schema", "That file isn’t a Doubletake chart.");
  }

  const errors: ChartError[] = [];
  const err = (code: string, path: string, message: string) => {
    if (errors.length < MAX_ERRORS) errors.push({ code, path, message });
  };

  if (typeof input.name !== "string" || input.name.trim() === "") {
    err("name", "name", "The chart needs a name.");
  }
  const mode = typeof input.mode === "string" && MODES.includes(input.mode) ? input.mode : undefined;
  if (!mode) err("mode", "mode", "The chart’s mode must be two_colour, duplicate or stripes.");

  const dim = input.dimensions;
  if (
    !isObject(dim) ||
    dim.pairs !== PAIRS ||
    dim.body_rounds !== BODY_ROUNDS ||
    dim.crown_rounds !== CROWN_ROUNDS
  ) {
    err(
      "dimensions",
      "dimensions",
      `Doubletake charts are always ${PAIRS} stitch pairs, ${BODY_ROUNDS} body rounds and ${CROWN_ROUNDS} crown rounds.`,
    );
  }

  // ---- yarns ----
  const yarnRole = new Map<string, string>();
  if (!Array.isArray(input.yarns) || input.yarns.length < 2 || input.yarns.length > 6) {
    err("yarns", "yarns", "A chart needs between 2 and 6 yarns.");
  } else {
    input.yarns.forEach((y, i) => {
      const p = `yarns[${i}]`;
      if (!isObject(y)) return err("yarns", p, "Each yarn needs an id, name, hex colour and role.");
      if (typeof y.id !== "string" || !/^[A-F]$/.test(y.id)) {
        err("yarn_id", p, "Yarn ids are single capital letters from A to F.");
      } else if (yarnRole.has(y.id)) {
        err("yarn_id", p, `Yarn ${y.id} is defined twice.`);
      }
      if (typeof y.name !== "string" || y.name.trim() === "") err("yarn_name", p, "Each yarn needs a name.");
      if (typeof y.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(y.hex)) {
        err("yarn_hex", p, "Yarn colours are written like #6B2D9E.");
      }
      if (typeof y.role !== "string" || !ROLES.includes(y.role)) {
        err("yarn_role", p, "A yarn’s role must be main, stripe or duplicate.");
      } else if (typeof y.id === "string") {
        yarnRole.set(y.id, y.role);
      }
    });
    const count = (r: string) => [...yarnRole.values()].filter((v) => v === r).length;
    if (mode === "two_colour" && !(count("main") === 2 && yarnRole.size === 2)) {
      err("yarns", "yarns", "A two-colour chart has exactly two yarns, both main.");
    }
    if (mode === "duplicate" && !(count("main") === 2 && count("duplicate") >= 1 && count("duplicate") <= 4 && count("stripe") === 0)) {
      err("yarns", "yarns", "A duplicate stitch chart has two main yarns and one to four duplicate stitch yarns.");
    }
    if (mode === "stripes" && !(count("stripe") >= 2 && count("main") === 0 && count("duplicate") === 0)) {
      err("yarns", "yarns", "A striped chart has between 2 and 6 stripe yarns.");
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  // Everything below can rely on mode, dimensions and yarns being sound.
  const chart = input as unknown as Chart;
  const known = (id: string) => yarnRole.has(id);

  // ---- round_pairs ----
  if (mode === "stripes") {
    const rp = chart.round_pairs;
    if (!Array.isArray(rp) || rp.length !== BODY_ROUNDS) {
      err("round_pairs", "round_pairs", `A striped chart lists the yarn pair for each of the ${BODY_ROUNDS} body rounds.`);
    } else {
      rp.forEach((pair, i) => {
        const ok =
          Array.isArray(pair) && pair.length === 2 && pair[0] !== pair[1] && pair.every((id) => typeof id === "string" && known(id));
        if (!ok) err("round_pairs", `round_pairs[${i}]`, `Round ${i + 1} needs two different, defined yarns.`);
      });
    }
  } else if (chart.round_pairs !== null) {
    err("round_pairs", "round_pairs", "Only striped charts have round_pairs. Set it to null.");
  }
  if (errors.length > 0) return { ok: false, errors };

  const shapeOk = (rows: unknown, n: number, path: string, what: string): rows is string[] => {
    if (!Array.isArray(rows) || rows.length !== n) {
      err("shape", path, `${what} needs ${n} rows${Array.isArray(rows) ? `, but has ${rows.length}` : ""}.`);
      return false;
    }
    let good = true;
    rows.forEach((row, i) => {
      if (typeof row !== "string" || row.length !== PAIRS) {
        const round = path.startsWith("body") || path.endsWith("body") ? i + 1 : FIRST_CROWN_ROUND + i;
        err(
          "shape",
          `${path}[${i}]`,
          `Round ${round} has ${typeof row === "string" ? row.length : 0} stitch pairs in ${what}; every row needs ${PAIRS}.`,
        );
        good = false;
      }
    });
    return good;
  };

  // ---- body ----
  if (shapeOk(chart.body, BODY_ROUNDS, "body", "the chart")) {
    chart.body.forEach((row, i) => {
      const round = i + 1;
      const pair = yarnsInRound(chart, round);
      for (let p = 0; p < PAIRS; p++) {
        const ch = row[p] as string;
        if (!known(ch)) {
          err("undefined_yarn", `body[${i}]`, `Round ${round}, pair ${p + 1}: “${ch}” isn’t a yarn in this chart.`);
          break;
        }
        if (!pair.includes(ch)) {
          err("not_in_pair", `body[${i}]`, `Round ${round}, pair ${p + 1}: yarn ${ch} isn’t one of the two yarns worked in this round (${pair.join(" and ")}).`);
          break;
        }
      }
    });
  }

  // ---- crown ----
  const crown = chart.crown;
  if (!isObject(crown)) {
    err("crown", "crown", "The chart needs a crown.");
  } else {
    if (shapeOk(crown.rounds, CROWN_ROUNDS, "crown.rounds", "the crown")) {
      crown.rounds.forEach((row, i) => {
        const round = FIRST_CROWN_ROUND + i;
        const { present } = crownLayout(round);
        const pair = yarnsInRound(chart, round);
        for (let p = 0; p < PAIRS; p++) {
          const ch = row[p] as string;
          if (!present[p]) {
            if (ch !== ".") {
              err("crown_layout", `crown.rounds[${i}]`, `Round ${round}, pair ${p + 1} was removed by an earlier decrease, so it must be “.”, not “${ch}”.`);
              break;
            }
            continue;
          }
          if (ch === ".") {
            err("crown_layout", `crown.rounds[${i}]`, `Round ${round}, pair ${p + 1} should still be there, but it is “.”.`);
            break;
          }
          if (!known(ch) || !pair.includes(ch)) {
            err("not_in_pair", `crown.rounds[${i}]`, `Round ${round}, pair ${p + 1}: “${ch}” isn’t one of the two yarns worked in this round.`);
            break;
          }
        }
      });
    }
  }

  // ---- duplicate stitch layers ----
  const layers: unknown = chart.duplicate;
  if (!Array.isArray(layers)) {
    err("duplicate", "duplicate", "The chart needs a duplicate list (it can be empty).");
  } else {
    if (mode === "two_colour" && layers.length > 0) {
      err("duplicate", "duplicate", "A two-colour chart has no duplicate stitch layers.");
    }
    if (mode === "duplicate" && (layers.length < 1 || layers.length > 4)) {
      err("duplicate", "duplicate", "A duplicate stitch chart has one to four duplicate stitch layers.");
    }
    if (layers.length > 4) err("duplicate", "duplicate", "A chart has at most four duplicate stitch layers.");
    const claimed = new Map<string, number>(); // "round:pair" -> layer index
    const usedYarns = new Set<string>();
    layers.forEach((layer, li) => {
      const lp = `duplicate[${li}]`;
      if (!isObject(layer)) return err("duplicate", lp, "Each duplicate layer needs a yarn, faces, body and crown.");
      const yarn = layer.yarn;
      if (typeof yarn !== "string" || !known(yarn)) {
        err("undefined_yarn", `${lp}.yarn`, "A duplicate layer’s yarn isn’t one of the chart’s yarns.");
      } else {
        const role = yarnRole.get(yarn);
        if (mode === "duplicate" && role !== "duplicate") {
          err("duplicate", `${lp}.yarn`, `Yarn ${yarn} isn’t a duplicate stitch yarn.`);
        }
        if (mode === "stripes" && role !== "stripe") {
          err("duplicate", `${lp}.yarn`, `Yarn ${yarn} isn’t one of the stripe yarns.`);
        }
        if (usedYarns.has(yarn)) err("duplicate", `${lp}.yarn`, `Yarn ${yarn} is used by two duplicate layers; each layer needs its own yarn.`);
        usedYarns.add(yarn);
      }
      if (layer.faces !== "both" && layer.faces !== "outside") {
        err("faces", `${lp}.faces`, "A duplicate layer’s faces must be both or outside.");
      }
      const bodyOk = shapeOk(layer.body, BODY_ROUNDS, `${lp}.body`, "a duplicate layer");
      const crownOk = shapeOk(layer.crown, CROWN_ROUNDS, `${lp}.crown`, "a duplicate layer’s crown");
      const mark = (round: number, p: number) => {
        const key = `${round}:${p}`;
        const prev = claimed.get(key);
        if (prev !== undefined && prev !== li) {
          err("duplicate_overlap", lp, `Round ${round}, pair ${p + 1} is in duplicate layers ${prev + 1} and ${li + 1}. A cell can be in only one layer.`);
          return false;
        }
        claimed.set(key, li);
        return true;
      };
      if (bodyOk) {
        for (let i = 0; i < BODY_ROUNDS; i++) {
          const row = (layer.body as string[])[i] as string;
          for (let p = 0; p < PAIRS; p++) {
            const ch = row[p];
            if (ch !== "0" && ch !== "1") {
              err("duplicate_char", `${lp}.body[${i}]`, `Round ${i + 1}, pair ${p + 1}: duplicate layers use 1 and 0 only.`);
              break;
            }
            if (ch === "1" && !mark(i + 1, p)) break;
          }
        }
      }
      if (crownOk) {
        for (let i = 0; i < CROWN_ROUNDS; i++) {
          const round = FIRST_CROWN_ROUND + i;
          const { present } = crownLayout(round);
          const row = (layer.crown as string[])[i] as string;
          for (let p = 0; p < PAIRS; p++) {
            const ch = row[p];
            if (!present[p]) {
              if (ch !== ".") {
                err("crown_layout", `${lp}.crown[${i}]`, `Round ${round}, pair ${p + 1} was removed, so it must be “.” in the duplicate layer too.`);
                break;
              }
              continue;
            }
            if (ch !== "0" && ch !== "1") {
              err("duplicate_char", `${lp}.crown[${i}]`, `Round ${round}, pair ${p + 1}: duplicate layers use 1, 0 and “.” only.`);
              break;
            }
            if (ch === "1") {
              if (!mark(round, p)) break;
            }
          }
        }
      }
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, chart };
}

import type { Chart } from "./chart";
import { BODY_ROUNDS, CROWN_PAIRS_PER_ROUND, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS, crownLayout } from "./hat";
import { findPatches } from "./patches";

export interface Warning {
  /** `stop` asks the knitter to confirm before going on; `warn` is advice. */
  level: "warn" | "stop";
  code: string;
  message: string;
}

export interface Analysis {
  /** Cells in the body, 8,400: shares are of these. The crown is the same for every hat. */
  totalCells: number;
  /** Share of the outside of the body that each yarn covers, 0 to 1. */
  outsideShare: Record<string, number>;
  duplicate: { yarn: string; cells: number; share: number; patches: number; singles: number }[];
  duplicateShare: number;
  warnings: Warning[];
}

/** Duplicate stitch: warn above 10% of cells, stop above 25% (spec 7.2). */
export const DUPLICATE_WARN = 0.1;
export const DUPLICATE_STOP = 0.25;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function analyse(chart: Chart): Analysis {
  const totalCells = BODY_ROUNDS * PAIRS;
  const counts: Record<string, number> = {};
  for (const row of chart.body) for (const ch of row) counts[ch] = (counts[ch] ?? 0) + 1;
  const outsideShare: Record<string, number> = {};
  for (const y of chart.yarns) outsideShare[y.id] = (counts[y.id] ?? 0) / totalCells;

  const duplicate = chart.duplicate.map((layer) => {
    let cells = 0;
    for (const row of layer.body) for (const ch of row) if (ch === "1") cells++;
    const patches = findPatches(layer);
    return { yarn: layer.yarn, cells, share: cells / totalCells, patches: patches.length, singles: patches.filter((p) => p.cells.length === 1).length };
  });
  const duplicateShare = duplicate.reduce((n, d) => n + d.share, 0);

  const warnings: Warning[] = [];
  if (duplicateShare > DUPLICATE_STOP) {
    warnings.push({
      level: "stop",
      code: "duplicate_too_much",
      message: `Duplicate stitch covers ${pct(duplicateShare)} of the hat. That is a lot of embroidery. Over ${pct(DUPLICATE_STOP)} is hard to do well: try fewer or smaller duplicate areas.`,
    });
  } else if (duplicateShare > DUPLICATE_WARN) {
    warnings.push({
      level: "warn",
      code: "duplicate_a_lot",
      message: `Duplicate stitch covers ${pct(duplicateShare)} of the hat. It is a good deal of embroidery to do on both faces, so allow plenty of time.`,
    });
  }
  const singles = duplicate.reduce((n, d) => n + d.singles, 0);
  if (singles >= 3) {
    warnings.push({
      level: "warn",
      code: "duplicate_specks",
      message: `${singles} duplicate stitch patches are a single square. They are fiddly to work and easy to lose: you may want to remove or join some.`,
    });
  }
  if (chart.mode !== "stripes") {
    const mains = chart.yarns.filter((y) => y.role === "main");
    const shares = mains.map((y) => outsideShare[y.id] ?? 0);
    if (shares.length === 2 && Math.min(...shares) === 0) {
      warnings.push({ level: "warn", code: "one_colour", message: "The outside is all one colour so far. The inside will be all the other colour." });
    } else if (shares.length === 2 && Math.min(...shares) < 0.1) {
      warnings.push({
        level: "warn",
        code: "main_small",
        message: "One main colour covers under 10% of the outside. The inside is the reverse, so the hat is balanced overall, but the outside may look lopsided.",
      });
    }
  }
  return { totalCells, outsideShare, duplicate, duplicateShare, warnings };
}

/** Pairs left at the end of each crown round, for the decrease table. */
export function crownTable(): { round: number; pairs: number }[] {
  const rows: { round: number; pairs: number }[] = [];
  for (let r = FIRST_CROWN_ROUND; r <= LAST_ROUND; r++) rows.push({ round: r, pairs: crownLayout(r).pairs });
  return rows;
}

/** Total pairs knitted in the whole hat (body plus crown): 9,736. Kept for yardage work later. */
export const TOTAL_PAIRS = BODY_ROUNDS * PAIRS + CROWN_PAIRS_PER_ROUND.reduce((a, b) => a + b, 0);

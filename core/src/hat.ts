/** The fixed Doubletake hat (spec section 5). Everything here is a constant. */

export const PAIRS = 136;
export const BODY_ROUNDS = 95;
export const CROWN_ROUNDS = 26;
export const FIRST_CROWN_ROUND = BODY_ROUNDS + 1; // 96
export const LAST_ROUND = BODY_ROUNDS + CROWN_ROUNDS; // 121
export const WEDGES = 8;
export const WEDGE_PAIRS = PAIRS / WEDGES; // 17
export const CHART_A_LAST_PAIR = PAIRS / 2; // Chart A = pairs 1-68, Chart B = 69-136
export const NEEDLE_STITCHES = PAIRS * 2;

/** 32 pairs and 44 rounds to 4 in (10 cm), blocked. */
export const GAUGE = { pairs: 32, rounds: 44, overInches: 4 } as const;
/** A cell is this much wider than it is tall (1.375 rounds for every pair). */
export const CELL_ASPECT = GAUGE.rounds / GAUGE.pairs;

/** The first Doubletake charts were 112 pairs round, 75 body rounds and 20 crown rounds, at 25 pairs and 34 rounds to 4 in. */
export const OLD_GAUGE_DIMENSIONS = { pairs: 112, body_rounds: 75, crown_rounds: 20 } as const;

/** Pairs left at the end of each crown round, index 0 = round 96 (spec section 5). */
export const CROWN_PAIRS_PER_ROUND: readonly number[] = [
  128, 128, 120, 120, 112, 112, 104, 104, 96, 96, 88, 88, 80, 80, 72, 72, 64, 64, 56, 56, 48, 48, 40, 40, 24, 16,
];

/**
 * Decreases by pair position w within a wedge (1 = first worked, 17 = last worked).
 * The marked pair stays; the pair just before it (lower number) is removed.
 */
export interface WedgeDecrease {
  marked: readonly number[];
  removed: readonly number[];
}

function buildDecreases(): ReadonlyMap<number, WedgeDecrease> {
  const map = new Map<number, WedgeDecrease>();
  // One pair per wedge goes every other round (17 down to 5 pairs a wedge), then 5 to 3, then 3 to 2.
  for (let k = 0; k < 12; k++) map.set(FIRST_CROWN_ROUND + 2 * k, { marked: [2 + k], removed: [1 + k] });
  map.set(LAST_ROUND - 1, { marked: [17, 14], removed: [16, 13] });
  map.set(LAST_ROUND, { marked: [15], removed: [14] });
  return map;
}

const DECREASES = buildDecreases();

/** The decrease worked in a crown round, or undefined if the round has none. */
export function wedgeDecrease(round: number): WedgeDecrease | undefined {
  checkCrownRound(round);
  return DECREASES.get(round);
}

export interface CrownLayout {
  /** present[i] is true if pair i + 1 still exists at the end of this round. */
  present: readonly boolean[];
  /** marked[i] is true if pair i + 1 carries a decrease in this round. */
  marked: readonly boolean[];
  /** Number of pairs left. */
  pairs: number;
}

function checkCrownRound(round: number): void {
  if (!Number.isInteger(round) || round < FIRST_CROWN_ROUND || round > LAST_ROUND) {
    throw new RangeError(`Crown rounds are ${FIRST_CROWN_ROUND} to ${LAST_ROUND}, not ${round}.`);
  }
}

function buildLayouts(): CrownLayout[] {
  const layouts: CrownLayout[] = [];
  const removedW = new Set<number>();
  for (let round = FIRST_CROWN_ROUND; round <= LAST_ROUND; round++) {
    const dec = DECREASES.get(round);
    dec?.removed.forEach((w) => removedW.add(w));
    const present: boolean[] = [];
    const marked: boolean[] = [];
    for (let i = 0; i < PAIRS; i++) {
      const w = (i % WEDGE_PAIRS) + 1;
      const here = !removedW.has(w);
      present.push(here);
      marked.push(here && (dec?.marked.includes(w) ?? false));
    }
    layouts.push({ present, marked, pairs: present.filter(Boolean).length });
  }
  return layouts;
}

const LAYOUTS = buildLayouts();

/** Which pairs exist, and which carry a decrease, at the end of a crown round. */
export function crownLayout(round: number): CrownLayout {
  checkCrownRound(round);
  return LAYOUTS[round - FIRST_CROWN_ROUND] as CrownLayout;
}

/** Pairs in a round (body rounds always have 136). */
export function pairsInRound(round: number): number {
  if (!Number.isInteger(round) || round < 1 || round > LAST_ROUND) {
    throw new RangeError(`Rounds are 1 to ${LAST_ROUND}, not ${round}.`);
  }
  return round <= BODY_ROUNDS ? PAIRS : crownLayout(round).pairs;
}

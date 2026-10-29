import { describe, expect, it } from "vitest";
import {
  allRoundsDone,
  canUndo,
  currentRound,
  newProgress,
  nextRound,
  patchKey,
  patchesDone,
  percentComplete,
  previousRound,
  setPair,
  toggleStep,
  togglePatchFace,
  undo,
} from "../src/lib/model";

const fresh = () => newProgress("p1", 1000);

describe("rounds", () => {
  it("starts on round 1", () => {
    expect(currentRound(fresh())).toBe(1);
    expect(percentComplete(fresh())).toBe(0);
  });

  it("moves forward and back", () => {
    let p = nextRound(nextRound(fresh()));
    expect(currentRound(p)).toBe(3);
    p = previousRound(p);
    expect(currentRound(p)).toBe(2);
  });

  it("can’t go before round 1", () => {
    expect(previousRound(fresh())).toEqual(fresh());
  });

  it("stops at round 95 and reports done", () => {
    let p = fresh();
    for (let i = 0; i < 120; i++) p = nextRound(p);
    expect(currentRound(p)).toBe(95);
    expect(allRoundsDone(p)).toBe(true);
    expect(percentComplete(p)).toBe(100);
  });

  it("finishing a round clears the position marker", () => {
    let p = setPair(fresh(), 37);
    expect(p.pair).toBe(37);
    p = nextRound(p);
    expect(p.pair).toBeNull();
  });
});

describe("undo", () => {
  it("has nothing to undo at the start", () => {
    expect(canUndo(fresh())).toBe(false);
    expect(undo(fresh())).toEqual(fresh());
  });

  it("puts back the round and the position marker", () => {
    let p = setPair(nextRound(fresh()), 20);
    p = nextRound(p);
    expect(currentRound(p)).toBe(3);
    p = undo(p);
    expect(currentRound(p)).toBe(2);
    expect(p.pair).toBe(20);
    p = undo(p);
    expect(p.pair).toBeNull();
    p = undo(p);
    expect(currentRound(p)).toBe(1);
    expect(canUndo(p)).toBe(false);
  });

  it("undoes steps and patch ticks", () => {
    let p = toggleStep(fresh(), "swatch");
    expect(p.steps.swatch).toBe(true);
    p = undo(p);
    expect(p.steps.swatch).toBe(false);

    const key = patchKey(0, 3);
    p = togglePatchFace(fresh(), key, "outside");
    expect(p.patches[key]).toEqual({ outside: true, inside: false });
    p = undo(p);
    expect(p.patches[key]).toBeUndefined();
  });

  it("keeps only the last 50 changes", () => {
    let p = fresh();
    for (let i = 0; i < 80; i++) p = nextRound(p);
    expect(p.history).toHaveLength(50);
  });
});

describe("duplicate stitch patches", () => {
  it("counts a patch done when every face it needs is ticked", () => {
    const both = patchKey(0, 0);
    const outsideOnly = patchKey(0, 1);
    let p = togglePatchFace(fresh(), both, "outside");
    const keys = [
      { key: both, faces: "both" as const },
      { key: outsideOnly, faces: "outside" as const },
    ];
    expect(patchesDone(p, keys)).toBe(0);
    p = togglePatchFace(p, both, "inside");
    expect(patchesDone(p, keys)).toBe(1);
    p = togglePatchFace(p, outsideOnly, "outside");
    expect(patchesDone(p, keys)).toBe(2);
  });

  it("unticking a face puts the patch back to to-do", () => {
    const key = patchKey(0, 0);
    let p = togglePatchFace(togglePatchFace(fresh(), key, "outside"), key, "inside");
    p = togglePatchFace(p, key, "inside");
    expect(patchesDone(p, [{ key, faces: "both" }])).toBe(0);
  });
});

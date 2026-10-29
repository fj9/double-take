import { describe, expect, it } from "vitest";
import { addDays, dayIndex, doneByEndOfDay, formatDate, plan, standing, todayIso, validPace } from "../src/lib/pace";

const pace = { start: "2026-11-01", days: 10 };

describe("the pace planner", () => {
  it("spreads the 95 rounds over the days, with no gaps and no overlaps", () => {
    for (const days of [1, 2, 7, 10, 14, 30, 95, 120]) {
      const p = plan({ start: "2026-11-01", days });
      expect(p).toHaveLength(days);
      let next = 1;
      for (const d of p) {
        expect(d.from).toBe(next);
        expect(d.to).toBeGreaterThanOrEqual(d.from - 1); // a day with no rounds has to = from - 1
        next = d.to + 1;
      }
      expect(next).toBe(96);
    }
  });

  it("ten days is about ten rounds a day, finishing on round 95", () => {
    const p = plan(pace);
    expect(p[0]).toMatchObject({ day: 1, date: "2026-11-01", from: 1, to: 10 });
    expect(p[9]).toMatchObject({ day: 10, date: "2026-11-10", to: 95 });
  });

  it("more days than rounds gives some days with none", () => {
    const p = plan({ start: "2026-11-01", days: 120 });
    expect(p.some((d) => d.to < d.from)).toBe(true);
  });

  it("works out dates without time zone slips, across a month end and a clock change", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // the clocks go back in the UK on 25 October 2026
    expect(dayIndex({ start: "2026-10-24", days: 5 }, "2026-10-26")).toBe(2);
    expect(todayIso(new Date(2026, 10, 1, 23, 59))).toBe("2026-11-01");
  });

  it("writes dates the way the style guide does", () => {
    expect(formatDate("2026-10-28")).toBe("28 October 2026");
  });

  it("says how you are doing against the plan", () => {
    expect(standing(pace, 0, "2026-10-30").text).toBe("The plan starts in 2 days.");
    expect(standing(pace, 0, "2026-10-31").text).toBe("The plan starts tomorrow.");
    const day1 = standing(pace, 4, "2026-11-01");
    expect([day1.target, day1.diff]).toEqual([10, -6]);
    expect(day1.text).toBe("By the end of today, aim for round 10: 6 rounds behind.");
    expect(standing(pace, 10, "2026-11-01").text).toContain("on track");
    expect(standing(pace, 13, "2026-11-01").text).toContain("3 rounds ahead");
    expect(standing(pace, 11, "2026-11-01").text).toContain("1 round ahead");
    expect(standing(pace, 95, "2026-11-12").text).toBe("The plan is finished, and so are you.");
    expect(standing(pace, 80, "2026-11-12").text).toContain("The plan ended 2 days ago");
    expect(doneByEndOfDay(10, 11)).toBe(95); // never more than 95
  });

  it("only accepts a real date and a sensible number of days", () => {
    expect(validPace(pace)).toBe(true);
    expect(validPace({ start: "tomorrow", days: 10 })).toBe(false);
    expect(validPace({ start: "2026-11-01", days: 0 })).toBe(false);
    expect(validPace({ start: "2026-11-01", days: 2.5 })).toBe(false);
    expect(validPace({ start: "2026-11-01", days: 400 })).toBe(false);
  });
});

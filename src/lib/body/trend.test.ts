import { describe, expect, it } from "vitest";
import { changeOver, daysBetween, isoDaysAgo, niceTicks, since, sortByDate } from "./trend";

const pts = [
  { date: "2026-10-20", value: 81.2 },
  { date: "2026-10-01", value: 82.5 },
  { date: "2026-10-27", value: 80.4 },
];

describe("trend helpers", () => {
  it("sorts by date", () => {
    expect(sortByDate(pts).map((p) => p.date)).toEqual(["2026-10-01", "2026-10-20", "2026-10-27"]);
  });

  it("filters to a window", () => {
    expect(since(pts, "2026-10-15").map((p) => p.date).sort()).toEqual(["2026-10-20", "2026-10-27"]);
  });

  it("computes change between first and last point", () => {
    const c = changeOver(pts)!;
    expect(c.delta).toBeCloseTo(-2.1, 10);
    expect(c.from.date).toBe("2026-10-01");
    expect(c.to.date).toBe("2026-10-27");
  });

  it("needs two points for a change", () => {
    expect(changeOver([pts[0]])).toBeNull();
    expect(changeOver([])).toBeNull();
  });

  it("does date arithmetic on calendar days", () => {
    expect(isoDaysAgo("2026-03-01", 1)).toBe("2026-02-28");
    expect(isoDaysAgo("2026-01-05", 30)).toBe("2025-12-06");
    expect(daysBetween("2026-10-01", "2026-10-27")).toBe(26);
  });
});

describe("niceTicks", () => {
  it("covers the range with round steps", () => {
    const t = niceTicks(80.4, 82.5, 4);
    expect(t[0]).toBeLessThanOrEqual(80.4);
    expect(t.at(-1)).toBeGreaterThanOrEqual(82.5);
    expect(t).toEqual([80, 81, 82, 83]);
  });

  it("pads a flat series and handles bad input", () => {
    expect(niceTicks(80, 80).length).toBeGreaterThan(1);
    expect(niceTicks(Number.NaN, 1)).toEqual([]);
  });
});

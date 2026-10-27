import { describe, expect, it } from "vitest";
import { formatRepRange, formatTarget, parseRepRange, parseTargetSets } from "./targets";

describe("parseRepRange", () => {
  it("keeps blank as no target", () => {
    expect(parseRepRange("")).toEqual({ ok: true, value: { min: null, max: null } });
    expect(parseRepRange("  ")).toEqual({ ok: true, value: { min: null, max: null } });
  });

  it("parses single values and ranges", () => {
    expect(parseRepRange("10")).toEqual({ ok: true, value: { min: 10, max: 10 } });
    expect(parseRepRange("8-12")).toEqual({ ok: true, value: { min: 8, max: 12 } });
    expect(parseRepRange("8 – 12")).toEqual({ ok: true, value: { min: 8, max: 12 } });
    expect(parseRepRange("8 to 12")).toEqual({ ok: true, value: { min: 8, max: 12 } });
  });

  it("rejects inconsistent, zero, huge and malformed ranges", () => {
    for (const bad of ["12-8", "0", "0-5", "1001", "abc", "8-", "-8", "8.5", "8-12-15"]) {
      expect(parseRepRange(bad).ok, bad).toBe(false);
    }
  });
});

describe("parseTargetSets", () => {
  it("keeps blank as null and validates bounds", () => {
    expect(parseTargetSets("")).toEqual({ ok: true, value: null });
    expect(parseTargetSets("3")).toEqual({ ok: true, value: 3 });
    expect(parseTargetSets("0").ok).toBe(false);
    expect(parseTargetSets("51").ok).toBe(false);
    expect(parseTargetSets("2.5").ok).toBe(false);
  });
});

describe("formatting", () => {
  it("formats rep ranges", () => {
    expect(formatRepRange({ min: 8, max: 12 })).toBe("8–12");
    expect(formatRepRange({ min: 5, max: 5 })).toBe("5");
    expect(formatRepRange({ min: null, max: null })).toBe("");
  });

  it("formats targets compactly and shows nothing when no target", () => {
    expect(formatTarget(3, { min: 8, max: 12 })).toBe("3 × 8–12");
    expect(formatTarget(1, { min: null, max: null })).toBe("1 set");
    expect(formatTarget(4, { min: null, max: null })).toBe("4 sets");
    expect(formatTarget(null, { min: 10, max: 10 })).toBe("10 reps");
    expect(formatTarget(null, { min: null, max: null })).toBe("");
  });
});

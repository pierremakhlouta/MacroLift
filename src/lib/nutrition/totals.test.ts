import { describe, expect, it } from "vitest";
import { dayTotals, entryAmount, isMeasurableUnit, nutrientTotal, remainingFor, servingsFromAmount } from "./totals";

describe("entryAmount", () => {
  it("is nutrient per serving × quantity", () => {
    expect(entryAmount({ calories_kcal: 120, quantity: 1.5 }, "calories_kcal")).toBe(180);
    expect(entryAmount({ protein_g: 17, quantity: 2 }, "protein_g")).toBe(34);
  });

  it("keeps unknown as unknown (null), never zero", () => {
    expect(entryAmount({ calories_kcal: null, quantity: 2 }, "calories_kcal")).toBeNull();
    expect(entryAmount({ quantity: 2 }, "fat_g")).toBeNull();
    expect(entryAmount({ calories_kcal: 0, quantity: 2 }, "calories_kcal")).toBe(0);
  });
});

describe("nutrientTotal", () => {
  it("sums known entries", () => {
    const t = nutrientTotal([{ calories_kcal: 100, quantity: 1 }, { calories_kcal: 50, quantity: 2 }], "calories_kcal");
    expect(t).toEqual({ total: 200, known: 2, missing: 0, partial: false });
  });

  it("flags partial totals when some entries are missing data", () => {
    const t = nutrientTotal([{ calories_kcal: 100, quantity: 1 }, { calories_kcal: null, quantity: 1 }], "calories_kcal");
    expect(t).toEqual({ total: 100, known: 1, missing: 1, partial: true });
  });

  it("is unknown (null) when every entry is missing it", () => {
    expect(nutrientTotal([{ fiber_g: null, quantity: 1 }], "fiber_g")).toEqual({ total: null, known: 0, missing: 1, partial: true });
  });

  it("is an empty, non-partial zero-entry state for an empty day", () => {
    expect(nutrientTotal([], "calories_kcal")).toEqual({ total: null, known: 0, missing: 0, partial: false });
  });
});

describe("dayTotals", () => {
  it("covers every tracked nutrient", () => {
    const totals = dayTotals([{ calories_kcal: 250, protein_g: 20, carbs_g: 30, fat_g: 5, fiber_g: null, quantity: 2 }]);
    expect(totals.calories_kcal.total).toBe(500);
    expect(totals.protein_g.total).toBe(40);
    expect(totals.fiber_g.total).toBeNull();
  });
});

describe("remainingFor", () => {
  it("is target minus logged", () => {
    expect(remainingFor(2000, { total: 1500, known: 3, missing: 0, partial: false })).toEqual({ remaining: 500, over: false, uncertain: false });
  });

  it("can be negative (over target)", () => {
    expect(remainingFor(2000, { total: 2350, known: 5, missing: 0, partial: false })).toEqual({ remaining: -350, over: true, uncertain: false });
  });

  it("treats an empty day as nothing logged yet", () => {
    expect(remainingFor(2000, { total: null, known: 0, missing: 0, partial: false }).remaining).toBe(2000);
  });

  it("marks remaining as uncertain when logged data is partial", () => {
    expect(remainingFor(150, { total: 100, known: 2, missing: 1, partial: true })).toMatchObject({ remaining: 50, uncertain: true });
  });

  it("has no remaining without a target", () => {
    expect(remainingFor(null, { total: 100, known: 1, missing: 0, partial: false }).remaining).toBeNull();
  });
});

describe("servingsFromAmount", () => {
  it("converts an amount to servings", () => {
    expect(servingsFromAmount(150, 100)).toBe(1.5);
    expect(servingsFromAmount(40, 40)).toBe(1);
  });

  it("rejects invalid input", () => {
    expect(servingsFromAmount(0, 100)).toBeNull();
    expect(servingsFromAmount(50, 0)).toBeNull();
    expect(servingsFromAmount(Number.NaN, 100)).toBeNull();
  });

  it("knows which units are measurable", () => {
    expect(isMeasurableUnit("g")).toBe(true);
    expect(isMeasurableUnit(" ML ")).toBe(true);
    expect(isMeasurableUnit("scoop")).toBe(false);
  });
});

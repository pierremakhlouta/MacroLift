import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  cmToIn,
  feetInchesToCm,
  formatHeight,
  formatWeight,
  inToCm,
  kgToLb,
  lbToKg,
  parseDecimal,
  parseInteger,
  roundTo,
  weightFromKg,
  weightInputValue,
  weightToKg,
} from "./units";

describe("conversions", () => {
  it("uses the specified factors", () => {
    expect(kgToLb(1)).toBe(2.2046226218);
    expect(lbToKg(2.2046226218)).toBe(1);
    expect(inToCm(1)).toBe(2.54);
    expect(cmToIn(2.54)).toBe(1);
  });

  it("round-trips without drift", () => {
    for (const kg of [0.5, 20, 72.35, 100, 227.5]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 10);
    }
    for (const cm of [50, 172.7, 210]) {
      expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 10);
    }
  });

  it("converts common plate weights", () => {
    expect(roundTo(lbToKg(45), 2)).toBe(20.41);
    expect(roundTo(kgToLb(20), 1)).toBe(44.1);
  });

  it("maps display units to canonical kg", () => {
    expect(weightToKg(80, "metric")).toBe(80);
    expect(weightToKg(176.37, "imperial")).toBeCloseTo(80, 2);
    expect(weightFromKg(80, "imperial")).toBeCloseTo(176.37, 2);
  });
});

describe("roundTo", () => {
  it("rounds half away from zero, including float edge cases", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.5)).toBe(3);
    expect(roundTo(-2.5)).toBe(-3);
    expect(roundTo(-0.0001, 2)).toBe(0);
    expect(Object.is(roundTo(-0.0001, 2), -0)).toBe(false);
  });

  it("passes non-finite values through", () => {
    expect(roundTo(Number.NaN, 1)).toBeNaN();
  });
});

describe("parseDecimal", () => {
  it("treats blank as unknown, not zero", () => {
    expect(parseDecimal("")).toEqual({ ok: true, value: null });
    expect(parseDecimal("   ")).toEqual({ ok: true, value: null });
    expect(parseDecimal(undefined)).toEqual({ ok: true, value: null });
  });

  it("parses decimals with dot or comma", () => {
    expect(parseDecimal("72.5")).toEqual({ ok: true, value: 72.5 });
    expect(parseDecimal("72,5")).toEqual({ ok: true, value: 72.5 });
    expect(parseDecimal(".5")).toEqual({ ok: true, value: 0.5 });
    expect(parseDecimal("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects malformed and non-finite input", () => {
    for (const bad of ["abc", "1.2.3", "NaN", "Infinity", "1e999", "12kg", "--1", "1,2,3"]) {
      expect(parseDecimal(bad).ok, bad).toBe(false);
    }
  });
});

describe("parseInteger", () => {
  it("parses whole numbers and keeps blank as null", () => {
    expect(parseInteger("12")).toEqual({ ok: true, value: 12 });
    expect(parseInteger("")).toEqual({ ok: true, value: null });
  });

  it("rejects decimals and junk", () => {
    expect(parseInteger("8.5").ok).toBe(false);
    expect(parseInteger("ten").ok).toBe(false);
    expect(parseInteger("99999999999999999999").ok).toBe(false);
  });
});

describe("display formatting", () => {
  it("formats weights in the user's unit", () => {
    expect(formatWeight(80, "metric")).toBe("80 kg");
    expect(formatWeight(80, "imperial")).toBe("176.4 lb");
    expect(formatWeight(null, "metric")).toBe("—");
    expect(formatWeight(Number.NaN, "metric")).toBe("—");
  });

  it("produces input values without premature rounding of storage", () => {
    expect(weightInputValue(20.41166, "imperial")).toBe("45");
    expect(weightInputValue(null, "imperial")).toBe("");
  });

  it("formats heights in cm or ft/in", () => {
    expect(formatHeight(180, "metric")).toBe("180 cm");
    expect(formatHeight(180, "imperial")).toBe("5 ft 10.9 in");
    expect(formatHeight(undefined, "imperial")).toBe("—");
  });

  it("never shows 12 inches", () => {
    // 182.88 cm is exactly 6 ft; 182.87 rounds to 11.99.. -> 12.0 and must carry over.
    expect(cmToFeetInches(182.87)).toEqual({ feet: 6, inches: 0 });
    expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 10);
  });
});

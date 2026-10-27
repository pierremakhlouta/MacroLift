import { describe, expect, it } from "vitest";
import { ageInYears, isValidIsoDate, toLocalIsoDate } from "./dates";

describe("isValidIsoDate", () => {
  it("accepts real dates", () => {
    expect(isValidIsoDate("2026-10-27")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "26-10-27", "2026/10/27", "", "2026-10-27T00:00"]) {
      expect(isValidIsoDate(bad), bad).toBe(false);
    }
  });
});

describe("toLocalIsoDate", () => {
  it("uses local calendar parts", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("ageInYears", () => {
  it("counts birthdays correctly", () => {
    expect(ageInYears("1990-10-27", "2026-10-27")).toBe(36);
    expect(ageInYears("1990-10-28", "2026-10-27")).toBe(35);
    expect(ageInYears("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageInYears("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("has no age limit (young or old)", () => {
    expect(ageInYears("2020-01-01", "2026-10-27")).toBe(6);
    expect(ageInYears("1920-01-01", "2026-10-27")).toBe(106);
  });

  it("returns null for invalid or future birth dates", () => {
    expect(ageInYears("2027-01-01", "2026-10-27")).toBeNull();
    expect(ageInYears("not-a-date", "2026-10-27")).toBeNull();
  });
});

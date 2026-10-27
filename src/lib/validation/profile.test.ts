import { describe, expect, it } from "vitest";
import { bodyWeightKgSchema, emailSchema, passwordSchema, profileUpdateSchema } from "./profile";

describe("profileUpdateSchema", () => {
  it("accepts a partial update and nulls (skipped fields)", () => {
    expect(profileUpdateSchema.safeParse({ unit_system: "imperial" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ birth_date: null, height_cm: null, estimate_sex: null }).success).toBe(true);
  });

  it("offers exactly two estimate coefficients", () => {
    expect(profileUpdateSchema.safeParse({ estimate_sex: "male" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ estimate_sex: "female" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ estimate_sex: "other" }).success).toBe(false);
  });

  it("rejects invalid units, heights and dates", () => {
    expect(profileUpdateSchema.safeParse({ unit_system: "stone" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ height_cm: Number.NaN }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ height_cm: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ height_cm: 0 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ birth_date: "2026-02-30" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ birth_date: "3000-01-01" }).success).toBe(false);
  });

  it("has no age limit", () => {
    expect(profileUpdateSchema.safeParse({ birth_date: "2022-06-01" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ birth_date: "1920-06-01" }).success).toBe(true);
  });
});

describe("auth field schemas", () => {
  it("validates email", () => {
    expect(emailSchema.safeParse(" Me@Example.com ").data).toBe("me@example.com");
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });

  it("requires 8+ chars with letters and digits", () => {
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("a1").success).toBe(false);
  });
});

describe("bodyWeightKgSchema", () => {
  it("rejects non-finite and non-positive weights", () => {
    expect(bodyWeightKgSchema.safeParse(72.5).success).toBe(true);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1000]) {
      expect(bodyWeightKgSchema.safeParse(bad).success).toBe(false);
    }
  });
});

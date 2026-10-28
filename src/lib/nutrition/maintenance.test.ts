import { describe, expect, it } from "vitest";
import { kcalFromMacros, maintenanceEstimate, roundKcal } from "./maintenance";

describe("maintenanceEstimate", () => {
  it("uses the male constant (+5) only when chosen", () => {
    const r = maintenanceEstimate({ weightKg: 80, heightCm: 180, ageYears: 30, sex: "male", activity: "moderately_active" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restingKcal).toBe(1780); // 800 + 1125 − 150 + 5
    expect(r.factor).toBe(1.55);
    expect(r.maintenanceKcal).toBeCloseTo(2759, 6);
  });

  it("uses the female constant (−161) only when chosen", () => {
    const r = maintenanceEstimate({ weightKg: 60, heightCm: 165, ageYears: 25, sex: "female", activity: "sedentary" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.restingKcal).toBeCloseTo(1345.25, 6);
    expect(r.maintenanceKcal).toBeCloseTo(1614.3, 6);
  });

  it("differs by exactly 166 kcal resting between the two coefficients", () => {
    const base = { weightKg: 70, heightCm: 170, ageYears: 40, activity: "sedentary" as const };
    const m = maintenanceEstimate({ ...base, sex: "male" });
    const f = maintenanceEstimate({ ...base, sex: "female" });
    if (!m.ok || !f.ok) throw new Error("expected ok");
    expect(m.restingKcal - f.restingKcal).toBe(166);
  });

  it("never infers the coefficient: missing choice means no estimate", () => {
    const r = maintenanceEstimate({ weightKg: 70, heightCm: 170, ageYears: 40, sex: null, activity: "sedentary" });
    expect(r).toEqual({ ok: false, missing: ["coefficient"] });
  });

  it("lists every missing input", () => {
    expect(maintenanceEstimate({ weightKg: null, heightCm: null, ageYears: null, sex: null, activity: null })).toEqual({
      ok: false,
      missing: ["weight", "height", "age", "coefficient", "activity"],
    });
    expect(maintenanceEstimate({ weightKg: NaN, heightCm: 0, ageYears: -1, sex: "male", activity: "very_active" })).toEqual({
      ok: false,
      missing: ["weight", "height", "age"],
    });
  });

  it("applies no age limit", () => {
    for (const ageYears of [12, 17, 85, 101]) {
      expect(maintenanceEstimate({ weightKg: 60, heightCm: 160, ageYears, sex: "female", activity: "lightly_active" }).ok).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("rounds kcal to the nearest 10", () => {
    expect(roundKcal(2759)).toBe(2760);
    expect(roundKcal(1614.3)).toBe(1610);
  });

  it("computes macro energy at 4/4/9 and treats a missing macro as not set", () => {
    expect(kcalFromMacros({ protein_g: 150, carbs_g: 200, fat_g: 70 })).toBe(2030);
    expect(kcalFromMacros({ protein_g: 150, carbs_g: null, fat_g: null })).toBe(600);
    expect(kcalFromMacros({ protein_g: null, carbs_g: null, fat_g: null })).toBeNull();
  });
});

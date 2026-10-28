// Maintenance calorie estimate (Mifflin–St Jeor × activity factor). Informational only: it is
// shown next to the user's own target and never writes or suggests a target value.

import type { ActivityLevel, EstimateSex } from "@/lib/validation/profile";

/** Mifflin–St Jeor constant for the coefficient the user explicitly chose. Never inferred. */
export const SEX_CONSTANT: Record<EstimateSex, number> = { male: 5, female: -161 };

/** Common activity multipliers applied to the resting estimate. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export type EstimateInputs = {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: EstimateSex | null;
  activity: ActivityLevel | null;
};

export type MissingInput = "weight" | "height" | "age" | "coefficient" | "activity";

export type MaintenanceEstimate =
  | { ok: true; restingKcal: number; factor: number; maintenanceKcal: number; inputs: Required<{ [K in keyof EstimateInputs]: NonNullable<EstimateInputs[K]> }> }
  | { ok: false; missing: MissingInput[] };

const usable = (n: number | null): n is number => n != null && Number.isFinite(n);

/**
 * Resting energy = 10·kg + 6.25·cm − 5·years + constant; maintenance = resting × activity factor.
 * No age limit is applied. Values are unrounded; round only for display.
 */
export function maintenanceEstimate(i: EstimateInputs): MaintenanceEstimate {
  const missing: MissingInput[] = [];
  if (!usable(i.weightKg) || i.weightKg <= 0) missing.push("weight");
  if (!usable(i.heightCm) || i.heightCm <= 0) missing.push("height");
  if (!usable(i.ageYears) || i.ageYears < 0) missing.push("age");
  if (!i.sex) missing.push("coefficient");
  if (!i.activity) missing.push("activity");
  if (missing.length) return { ok: false, missing };

  const weightKg = i.weightKg!;
  const heightCm = i.heightCm!;
  const ageYears = i.ageYears!;
  const sex = i.sex!;
  const activity = i.activity!;
  const restingKcal = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + SEX_CONSTANT[sex];
  const factor = ACTIVITY_FACTORS[activity];
  return { ok: true, restingKcal, factor, maintenanceKcal: restingKcal * factor, inputs: { weightKg, heightCm, ageYears, sex, activity } };
}

/** Rounded to the nearest 10 kcal: the formula isn't precise enough to justify more. */
export const roundKcal = (kcal: number) => Math.round(kcal / 10) * 10;

/** Energy from macros at 4/4/9 kcal per gram. Null when no macro is set. Informational only. */
export function kcalFromMacros(m: { protein_g: number | null; carbs_g: number | null; fat_g: number | null }): number | null {
  if (m.protein_g == null && m.carbs_g == null && m.fat_g == null) return null;
  return (m.protein_g ?? 0) * 4 + (m.carbs_g ?? 0) * 4 + (m.fat_g ?? 0) * 9;
}

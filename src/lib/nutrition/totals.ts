// Nutrition math. NULL nutrient values mean "unknown", never zero. Exercise calories are
// never added to or subtracted from anything here.

export const NUTRIENT_KEYS = ["calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string; decimals: number }> = {
  calories_kcal: { label: "Calories", unit: "kcal", decimals: 0 },
  protein_g: { label: "Protein", unit: "g", decimals: 1 },
  carbs_g: { label: "Carbs", unit: "g", decimals: 1 },
  fat_g: { label: "Fat", unit: "g", decimals: 1 },
  fiber_g: { label: "Fiber", unit: "g", decimals: 1 },
};

export type NutrientValues = Partial<Record<NutrientKey, number | null>>;
export type LoggedEntry = NutrientValues & { quantity: number };

/** Amount eaten for one entry: per-serving value × servings, or null if unknown. */
export function entryAmount(entry: LoggedEntry, key: NutrientKey): number | null {
  const per = entry[key];
  if (per == null || !Number.isFinite(per) || !Number.isFinite(entry.quantity)) return null;
  return per * entry.quantity;
}

export type NutrientTotal = {
  /** Sum of known values; null when no entry has this nutrient. */
  total: number | null;
  /** Entries that contributed a value. */
  known: number;
  /** Entries where this nutrient is unknown. */
  missing: number;
  /** True when some entries are unknown: the real total is at least `total`. */
  partial: boolean;
};

export function nutrientTotal(entries: LoggedEntry[], key: NutrientKey): NutrientTotal {
  let total = 0;
  let known = 0;
  let missing = 0;
  for (const e of entries) {
    const v = entryAmount(e, key);
    if (v == null) missing += 1;
    else {
      total += v;
      known += 1;
    }
  }
  return { total: known > 0 ? total : null, known, missing, partial: missing > 0 };
}

export function dayTotals(entries: LoggedEntry[]): Record<NutrientKey, NutrientTotal> {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, nutrientTotal(entries, k)])) as Record<NutrientKey, NutrientTotal>;
}

export type Remaining = {
  /** target − logged; negative means over target. Null without a target. */
  remaining: number | null;
  over: boolean;
  /** Some logged items are missing this nutrient, so "remaining" is an upper bound. */
  uncertain: boolean;
};

/** Remaining = user target − logged amount. Never adjusted for exercise. */
export function remainingFor(target: number | null | undefined, t: NutrientTotal): Remaining {
  if (target == null || !Number.isFinite(target)) return { remaining: null, over: false, uncertain: t.partial };
  const logged = t.total ?? 0;
  const remaining = target - logged;
  return { remaining, over: remaining < 0, uncertain: t.partial };
}

/** Servings from an amount in the food's own unit (e.g. 150 g of a 100 g serving = 1.5). */
export function servingsFromAmount(amount: number, servingSize: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(servingSize) || servingSize <= 0 || amount <= 0) return null;
  return amount / servingSize;
}

/** Units for which "enter an amount" makes sense instead of a number of servings. */
export const MEASURABLE_UNITS = ["g", "ml", "oz", "fl oz"];
export const isMeasurableUnit = (unit: string) => MEASURABLE_UNITS.includes(unit.trim().toLowerCase());

import { NUTRIENT_LABELS, type NutrientKey } from "@/lib/nutrition/totals";
import { roundTo } from "@/lib/units";

/** "1,240 kcal" / "45.5 g"; unknown values read as "unknown", never 0. */
export function fmtNutrient(value: number | null | undefined, key: NutrientKey, withUnit = true): string {
  if (value == null || !Number.isFinite(value)) return withUnit ? "unknown" : "?";
  const { unit, decimals } = NUTRIENT_LABELS[key];
  const n = roundTo(value, decimals).toLocaleString(undefined, { maximumFractionDigits: decimals });
  return withUnit ? `${n} ${unit}` : n;
}

/** "1.5 × 170 g" or "2 × 1 scoop". */
export function fmtServing(quantity: number, servingSize: number, servingUnit: string): string {
  const q = roundTo(quantity, 2).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const s = roundTo(servingSize, 2).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${q} × ${s} ${servingUnit}`;
}

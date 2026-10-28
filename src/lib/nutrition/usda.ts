// Mapping USDA FoodData Central search results into MacroLift foods.
// FDC search results report nutrients per 100 g (or 100 ml for some branded drinks), so a
// mapped food uses a 100 g / 100 ml serving. Missing nutrients stay null (unknown).
// Data: USDA FoodData Central, public domain (CC0).

export type FdcNutrient = { nutrientId?: number; nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number };
export type FdcFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcNutrient[];
};

export type UsdaFood = {
  fdcId: string;
  name: string;
  brand: string | null;
  dataType: string | null;
  serving_size: number;
  serving_unit: "g" | "ml";
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  /** The label serving, for display only (e.g. "1 cup (240 ml)"). */
  labelServing: string | null;
};

// FDC nutrient ids (with legacy nutrient numbers as fallback).
const IDS = {
  energyKcal: { ids: [1008, 2047, 2048], numbers: ["208", "957", "958"] },
  protein: { ids: [1003], numbers: ["203"] },
  fat: { ids: [1004], numbers: ["204"] },
  carbs: { ids: [1005], numbers: ["205"] },
  fiber: { ids: [1079], numbers: ["291"] },
  sugar: { ids: [2000, 1063], numbers: ["269", "269.3"] },
  sodium: { ids: [1093], numbers: ["307"] },
};

function pick(nutrients: FdcNutrient[], spec: { ids: number[]; numbers: string[] }, unit: string): number | null {
  for (let i = 0; i < spec.ids.length; i++) {
    const n = nutrients.find(
      (x) => (x.nutrientId === spec.ids[i] || x.nutrientNumber === spec.numbers[i]) && (x.unitName ?? "").toUpperCase() === unit,
    );
    if (n && typeof n.value === "number" && Number.isFinite(n.value) && n.value >= 0) return n.value;
  }
  return null;
}

const titleCase = (s: string) =>
  s.length > 0 && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_, p, c) => p + c.toUpperCase()) : s;

export function mapFdcFood(f: FdcFood): UsdaFood {
  const n = f.foodNutrients ?? [];
  const unit = (f.servingSizeUnit ?? "").toLowerCase();
  const isMl = unit === "ml" || unit === "mlt";
  const brand = f.brandName || f.brandOwner || null;
  return {
    fdcId: String(f.fdcId),
    name: titleCase(f.description.trim()).slice(0, 120),
    brand: brand ? titleCase(brand.trim()).slice(0, 120) : null,
    dataType: f.dataType ?? null,
    serving_size: 100,
    serving_unit: isMl ? "ml" : "g",
    calories_kcal: pick(n, IDS.energyKcal, "KCAL"),
    protein_g: pick(n, IDS.protein, "G"),
    carbs_g: pick(n, IDS.carbs, "G"),
    fat_g: pick(n, IDS.fat, "G"),
    fiber_g: pick(n, IDS.fiber, "G"),
    sugar_g: pick(n, IDS.sugar, "G"),
    sodium_mg: pick(n, IDS.sodium, "MG"),
    labelServing:
      f.householdServingFullText && f.servingSize
        ? `${f.householdServingFullText} (${f.servingSize} ${isMl ? "ml" : "g"})`
        : f.servingSize
          ? `${f.servingSize} ${isMl ? "ml" : "g"}`
          : null,
  };
}

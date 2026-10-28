import { describe, expect, it } from "vitest";
import { exerciseSchema, routineNameSchema } from "./exercise";

describe("exerciseSchema", () => {
  const valid = { name: "Landmine Press", muscles: ["shoulders"], equipment: "barbell", load_type: "external" };

  it("accepts a valid exercise and trims the name", () => {
    expect(exerciseSchema.parse({ ...valid, name: "  Landmine Press " }).name).toBe("Landmine Press");
    expect(exerciseSchema.safeParse({ ...valid, equipment: null }).success).toBe(true);
  });

  it("rejects blank names, no muscles, unknown enums", () => {
    expect(exerciseSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...valid, muscles: [] }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...valid, muscles: ["wings"] }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...valid, load_type: "heavy" }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...valid, name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("routineNameSchema", () => {
  it("requires a non-blank name", () => {
    expect(routineNameSchema.safeParse("Push A").success).toBe(true);
    expect(routineNameSchema.safeParse("  ").success).toBe(false);
  });
});

import { foodSchema, quantitySchema } from "./food";

describe("foodSchema", () => {
  const valid = { name: "Protein shake", brand: null, serving_size: 1, serving_unit: "scoop", calories_kcal: 120, protein_g: 24, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null };

  it("accepts unknown (null) nutrients", () => {
    expect(foodSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative or non-finite nutrients and zero servings", () => {
    expect(foodSchema.safeParse({ ...valid, protein_g: -1 }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, calories_kcal: Number.NaN }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, serving_size: 0 }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, serving_unit: " " }).success).toBe(false);
  });

  it("validates quantities", () => {
    expect(quantitySchema.safeParse(1.5).success).toBe(true);
    expect(quantitySchema.safeParse(0).success).toBe(false);
    expect(quantitySchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { mapFdcFood } from "./usda";

describe("mapFdcFood", () => {
  it("maps an SR Legacy generic food per 100 g", () => {
    const f = mapFdcFood({
      fdcId: 171477,
      description: "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: "208", unitName: "KCAL", value: 165 },
        { nutrientId: 1062, nutrientNumber: "268", unitName: "kJ", value: 690 },
        { nutrientId: 1003, nutrientNumber: "203", unitName: "G", value: 31 },
        { nutrientId: 1004, nutrientNumber: "204", unitName: "G", value: 3.57 },
        { nutrientId: 1005, nutrientNumber: "205", unitName: "G", value: 0 },
        { nutrientId: 1093, nutrientNumber: "307", unitName: "MG", value: 74 },
      ],
    });
    expect(f).toMatchObject({
      fdcId: "171477",
      serving_size: 100,
      serving_unit: "g",
      calories_kcal: 165,
      protein_g: 31,
      fat_g: 3.57,
      carbs_g: 0,
      sodium_mg: 74,
      fiber_g: null, // not reported -> unknown, not zero
      sugar_g: null,
      brand: null,
    });
  });

  it("falls back to Atwater energy for Foundation foods", () => {
    const f = mapFdcFood({
      fdcId: 1,
      description: "Oats",
      dataType: "Foundation",
      foodNutrients: [{ nutrientId: 2047, nutrientNumber: "957", unitName: "KCAL", value: 380 }],
    });
    expect(f.calories_kcal).toBe(380);
  });

  it("maps branded drinks per 100 ml and tidies all-caps names", () => {
    const f = mapFdcFood({
      fdcId: 2,
      description: "CHOCOLATE MILK",
      dataType: "Branded",
      brandOwner: "ACME DAIRY CO.",
      servingSize: 240,
      servingSizeUnit: "MLT",
      householdServingFullText: "1 cup",
      foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: 79 }],
    });
    expect(f).toMatchObject({ name: "Chocolate Milk", brand: "Acme Dairy Co.", serving_unit: "ml", labelServing: "1 cup (240 ml)", calories_kcal: 79 });
  });

  it("ignores negative or non-finite values and wrong units", () => {
    const f = mapFdcFood({
      fdcId: 3,
      description: "Odd",
      foodNutrients: [
        { nutrientId: 1003, unitName: "G", value: -1 },
        { nutrientId: 1004, unitName: "MG", value: 5 },
        { nutrientId: 1005, unitName: "G", value: Number.NaN },
      ],
    });
    expect(f.protein_g).toBeNull();
    expect(f.fat_g).toBeNull();
    expect(f.carbs_g).toBeNull();
  });
});

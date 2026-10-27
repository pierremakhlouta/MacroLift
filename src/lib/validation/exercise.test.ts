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

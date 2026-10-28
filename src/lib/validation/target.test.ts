import { describe, expect, it } from "vitest";
import { targetSchema } from "./target";

const base = { effective_from: "2026-10-28", calories_kcal: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null };

describe("targetSchema", () => {
  it("accepts all-blank (no target from that date) and full targets", () => {
    expect(targetSchema.safeParse(base).success).toBe(true);
    expect(targetSchema.safeParse({ ...base, calories_kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, fiber_g: 30 }).success).toBe(true);
  });

  it("mirrors the database bounds", () => {
    expect(targetSchema.safeParse({ ...base, calories_kcal: 0 }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, calories_kcal: 20001 }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, protein_g: -1 }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, fiber_g: 501 }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, fat_g: Infinity }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, protein_g: 0 }).success).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(targetSchema.safeParse({ ...base, effective_from: "2026-02-30" }).success).toBe(false);
    expect(targetSchema.safeParse({ ...base, effective_from: "1899-12-31" }).success).toBe(false);
  });
});

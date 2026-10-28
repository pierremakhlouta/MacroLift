import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dayTotals, remainingFor } from "@/lib/nutrition/totals";
import { createSignedInUser, deleteUser, type TestUser } from "./env";

let user: TestUser;
let other: TestUser;
let yogurtId: string;

beforeAll(async () => {
  [user, other] = await Promise.all([createSignedInUser("n-user"), createSignedInUser("n-other")]);
  const { data } = await user.db
    .from("foods")
    .insert({ owner_id: user.id, name: "Greek Yogurt", serving_size: 170, serving_unit: "g", calories_kcal: 100, protein_g: 17, carbs_g: 6, fat_g: null })
    .select("id")
    .single();
  yogurtId = data!.id;
});
afterAll(async () => {
  await Promise.all([user, other].filter(Boolean).map((u) => deleteUser(u.id)));
});

describe("nutrition diary", () => {
  const day = "2026-10-28";
  const entryId = randomUUID();
  const quickId = randomUUID();

  it("logs foods with server-side snapshots, idempotently", async () => {
    const items = [
      { id: entryId, food_id: yogurtId, quantity: 1.5 },
      { id: quickId, food_name: "Latte", serving_size: 1, serving_unit: "cup", calories_kcal: 150, protein_g: 8, carbs_g: null, fat_g: 6, quantity: 1 },
    ];
    for (let i = 0; i < 2; i++) {
      const { error } = await user.db.rpc("add_diary_entries", { p_day: day, p_meal: "breakfast", p_items: items });
      expect(error).toBeNull();
    }
    const { data } = await user.db.from("diary_entries").select("*").order("position");
    expect(data).toHaveLength(2);
    expect(data![0]).toMatchObject({ food_name: "Greek Yogurt", serving_size: 170, calories_kcal: 100, fat_g: null, quantity: 1.5 });
  });

  it("computes totals with unknown values marked partial, and remaining against the user's target", async () => {
    await user.db.from("nutrition_targets").insert({ effective_from: "2026-10-01", calories_kcal: 2000, protein_g: 150 });
    const { data: entries } = await user.db.from("diary_entries").select("*");
    const totals = dayTotals(entries!.map((e) => ({ ...e, quantity: Number(e.quantity) })));
    expect(totals.calories_kcal).toMatchObject({ total: 300, partial: false });
    expect(totals.protein_g.total).toBe(33.5);
    expect(totals.fat_g).toMatchObject({ total: 6, partial: true, missing: 1 });
    expect(totals.carbs_g).toMatchObject({ total: 9, partial: true });

    const { data: target } = await user.db.from("nutrition_targets").select("*").lte("effective_from", day).order("effective_from", { ascending: false }).limit(1).single();
    expect(remainingFor(target!.calories_kcal, totals.calories_kcal)).toEqual({ remaining: 1700, over: false, uncertain: false });
  });

  it("keeps past entries unchanged when the food is edited", async () => {
    await user.db.from("foods").update({ calories_kcal: 999, name: "Yogurt v2" }).eq("id", yogurtId);
    const { data } = await user.db.from("diary_entries").select("food_name, calories_kcal").eq("id", entryId).single();
    expect(data).toEqual({ food_name: "Greek Yogurt", calories_kcal: 100 });
  });

  it("saves and logs a meal template", async () => {
    const templateId = randomUUID();
    const { error } = await user.db.rpc("save_meal_template", {
      p_id: templateId,
      p_name: "Yogurt bowl",
      p_notes: "",
      p_items: [{ id: randomUUID(), food_id: yogurtId, quantity: 2 }],
    });
    expect(error).toBeNull();
    const { data: t } = await user.db.from("meal_templates").select("id, items:meal_template_items(food_id, quantity)").eq("id", templateId).single();
    const items = t!.items.map((i) => ({ id: randomUUID(), food_id: i.food_id, quantity: Number(i.quantity), meal_template_id: templateId }));
    const log = await user.db.rpc("add_diary_entries", { p_day: "2026-10-29", p_meal: "snack", p_items: items });
    expect(log.error).toBeNull();
    const { data } = await user.db.from("diary_entries").select("meal, meal_template_id, calories_kcal, quantity").eq("meal_template_id", templateId);
    // Snapshot reflects the food as it is now (999 kcal after the edit above).
    expect(data).toEqual([{ meal: "snack", meal_template_id: templateId, calories_kcal: 999, quantity: 2 }]);
  });

  it("allows one active USDA copy per food per user", async () => {
    const row = { owner_id: user.id, source: "usda", source_ref: "171477", name: "Chicken breast", serving_size: 100, serving_unit: "g", calories_kcal: 165 };
    expect((await user.db.from("foods").insert(row)).error).toBeNull();
    expect((await user.db.from("foods").insert(row)).error?.code).toBe("23505");
    // Another user can import the same USDA food independently.
    expect((await other.db.from("foods").insert({ ...row, owner_id: other.id })).error).toBeNull();
  });

  it("is invisible to other accounts", async () => {
    for (const table of ["diary_entries", "nutrition_days", "meal_templates", "meal_template_items", "nutrition_targets"] as const) {
      const { data } = await other.db.from(table).select("id");
      expect(data, table).toEqual([]);
    }
    const foods = await other.db.from("foods").select("name").eq("id", yogurtId);
    expect(foods.data).toEqual([]);
  });
});

describe("body tracking", () => {
  it("upserts one weigh-in per day and keeps full precision", async () => {
    for (const kg of [80.1234, 79.98765]) {
      const { error } = await user.db.from("weight_entries").upsert({ measured_on: "2026-10-28", weight_kg: kg }, { onConflict: "user_id,measured_on" });
      expect(error).toBeNull();
    }
    const { data } = await user.db.from("weight_entries").select("weight_kg");
    expect(data).toEqual([{ weight_kg: 79.98765 }]);
  });

  it("upserts measurements per site and day", async () => {
    const rows = [
      { measured_on: "2026-10-28", site: "waist" as const, value_cm: 84.5 },
      { measured_on: "2026-10-28", site: "hips" as const, value_cm: 98 },
    ];
    expect((await user.db.from("body_measurements").upsert(rows, { onConflict: "user_id,measured_on,site" })).error).toBeNull();
    expect((await user.db.from("body_measurements").upsert([{ ...rows[0], value_cm: 84 }], { onConflict: "user_id,measured_on,site" })).error).toBeNull();
    const { data } = await user.db.from("body_measurements").select("site, value_cm");
    expect([...data!].sort((a, b) => a.site.localeCompare(b.site))).toEqual([
      { site: "hips", value_cm: 98 },
      { site: "waist", value_cm: 84 },
    ]);
  });

  it("is invisible to other accounts", async () => {
    expect((await other.db.from("weight_entries").select("id")).data).toEqual([]);
    expect((await other.db.from("body_measurements").select("id")).data).toEqual([]);
  });
});

import { expect, test, type Page } from "@playwright/test";
import { toLocalIsoDate } from "@/lib/dates";
import { expectNoA11yViolations, expectNoHorizontalScroll, signInAsNewUser } from "./helpers";

const daysAgo = (n: number) => toLocalIsoDate(new Date(Date.now() - n * 86_400_000));

async function createFood(page: Page, f: { name: string; size: string; unit: string; kcal?: string; protein?: string; carbs?: string; fat?: string }) {
  await page.goto("/nutrition/foods");
  await page.getByRole("button", { name: "New food" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Food name").fill(f.name);
  await d.getByLabel("Size").fill(f.size);
  await d.getByLabel("Unit", { exact: true }).fill(f.unit);
  if (f.kcal) await d.getByLabel("Calories").fill(f.kcal);
  if (f.protein) await d.getByLabel("Protein").fill(f.protein);
  if (f.carbs) await d.getByLabel("Carbs").fill(f.carbs);
  if (f.fat) await d.getByLabel("Fat", { exact: true }).fill(f.fat);
  await d.getByRole("button", { name: "Save food" }).click();
  await expect(d).toBeHidden();
}

test("log weight in imperial units, see the trend chart and table, edit and undo a delete", async ({ page }) => {
  const user = await signInAsNewUser(page, "pr-weight");
  await user.db.from("profiles").update({ unit_system: "imperial" }).eq("id", user.id);
  await user.db.from("weight_entries").insert([
    { measured_on: daysAgo(20), weight_kg: 82 },
    { measured_on: daysAgo(10), weight_kg: 81 },
  ]);

  await page.goto("/progress");
  await page.getByLabel("Weight", { exact: true }).fill("176.4");
  await page.getByRole("button", { name: "Save weigh-in" }).click();
  await expect(page.getByText(/Saved 176\.4 lb for/)).toBeVisible();

  const chart = page.getByRole("img", { name: /Body weight trend, 3 weigh-ins/ });
  await expect(chart).toBeVisible();
  // −4.4 lb: 82 kg → 80.01 kg (176.4 lb) over the last 30 days.
  await expect(page.getByText(/−4\.4 lb/).first()).toBeVisible();

  // Keyboard reads values from the chart (same as hover).
  await chart.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("status").filter({ hasText: "176.4 lb" }).filter({ hasNotText: "Saved" })).toBeVisible();

  const table = page.getByRole("table", { name: "Weigh-ins, newest first" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row").nth(1)).toContainText("176.4 lb");

  // Delete with undo.
  await table.getByRole("button", { name: /Delete weigh-in/ }).first().click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(table.getByRole("row")).toHaveCount(4);

  // Stored canonically in kg.
  const { data } = await user.db.from("weight_entries").select("weight_kg").eq("measured_on", daysAgo(0));
  expect(data![0].weight_kg).toBeCloseTo(80.0137, 3);
  // No BMI anywhere.
  await expect(page.getByText(/BMI/i)).toHaveCount(0);
  await user.cleanup();
});

test("log body measurements and view a per-site trend with a table", async ({ page }) => {
  const user = await signInAsNewUser(page, "pr-measure");
  await page.goto("/progress");
  await page.getByRole("button", { name: "Save measurements" }).click();
  await expect(page.getByText("Enter at least one measurement")).toBeVisible();

  await page.getByLabel("Waist").fill("84.5");
  await page.getByLabel("Hips").fill("98");
  await page.getByRole("button", { name: "Save measurements" }).click();
  await expect(page.getByText(/Saved 2 measurements/)).toBeVisible();

  await expect(page.getByLabel("Show trend for")).toHaveValue("waist");
  await expect(page.getByRole("table", { name: "Waist measurements, newest first" })).toContainText("84.5 cm");
  await page.getByLabel("Show trend for").selectOption("hips");
  await expect(page.getByRole("table", { name: "Hips measurements, newest first" })).toContainText("98 cm");
  await user.cleanup();
});

test("diary: create a food, log it by amount, quick add, partial totals vs target, edit, undo", async ({ page }) => {
  const user = await signInAsNewUser(page, "nu-diary");
  await user.db.from("nutrition_targets").insert({ effective_from: "2026-01-01", calories_kcal: 2000, protein_g: 150 });
  // Fat left blank: unknown, not zero.
  await createFood(page, { name: "Greek Yogurt", size: "170", unit: "g", kcal: "100", protein: "17", carbs: "6" });

  await page.goto("/nutrition");
  await expect(page.getByText("Today ·")).toBeVisible();
  await page.getByRole("button", { name: "Add food to Breakfast" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Search your foods").fill("yog");
  await d.getByRole("button", { name: /Greek Yogurt/ }).click();
  await expect(d.getByLabel("Amount in g")).toHaveValue("170");
  await d.getByLabel("Amount in g").fill("255");
  await expect(d.locator("dd").first()).toHaveText("150"); // live preview (kcal): 1.5 servings
  await d.getByRole("button", { name: "Add to Breakfast" }).click();
  await expect(d).toBeHidden();

  const breakfast = page.getByRole("region", { name: "Breakfast" });
  await expect(breakfast.getByRole("button", { name: "Edit Greek Yogurt" })).toContainText("1.5 × 170 g");
  await expect(page.getByText("150 / 2,000 kcal")).toBeVisible();
  await expect(page.getByText("1,850 kcal left")).toBeVisible();
  // Fat unknown for the only entry: shown as unknown, not 0.
  await expect(page.getByText(/Totals marked ≥ are partial/)).toBeVisible();

  // Quick add to lunch.
  await page.getByRole("button", { name: "Add food to Lunch" }).click();
  await d.getByRole("button", { name: "Quick add" }).click();
  await d.getByLabel("Description").fill("Cafeteria pasta");
  await d.getByLabel("Calories").fill("650");
  await d.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("800 / 2,000 kcal")).toBeVisible();

  // Edit quantity.
  await breakfast.getByRole("button", { name: "Edit Greek Yogurt" }).click();
  await d.getByLabel("Amount in g").fill("170");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("750 / 2,000 kcal")).toBeVisible();

  // Delete + undo.
  await page.getByRole("region", { name: "Lunch" }).getByRole("button", { name: "Edit Cafeteria pasta" }).click();
  await d.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByText("100 / 2,000 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("750 / 2,000 kcal")).toBeVisible();

  // Past days are separate.
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/\?date=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText("0 / 2,000 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Back to today" }).click();
  await expect(page.getByText("750 / 2,000 kcal")).toBeVisible();

  // Exercise never changes the budget; no USDA tab without a key.
  await expect(page.getByText("Exercise is never added to or subtracted from your calorie budget.")).toBeVisible();
  await page.getByRole("button", { name: "Add food to Dinner" }).click();
  await expect(d.getByRole("button", { name: "USDA" })).toHaveCount(0);
  await user.cleanup();
});

test("over target is shown with an icon and text, not colour alone", async ({ page }) => {
  const user = await signInAsNewUser(page, "nu-over");
  await user.db.from("nutrition_targets").insert({ effective_from: "2026-01-01", calories_kcal: 500 });
  await user.db.rpc("add_diary_entries", {
    p_day: toLocalIsoDate(new Date()),
    p_meal: "dinner",
    p_items: [{ id: crypto.randomUUID(), food_name: "Pizza", serving_size: 1, serving_unit: "slice", calories_kcal: 300, quantity: 2 }],
  });
  await page.goto("/nutrition");
  await expect(page.getByText("100 kcal over target")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Calories logged against your target" })).toHaveAttribute("aria-valuetext", /over target/);
  await user.cleanup();
});

test("save a meal from the diary and log it on another day", async ({ page }) => {
  const user = await signInAsNewUser(page, "nu-meal");
  await createFood(page, { name: "Oats", size: "40", unit: "g", kcal: "150", protein: "5", carbs: "27", fat: "3" });
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food to Breakfast" }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: /Oats/ }).click();
  await d.getByRole("button", { name: "Add to Breakfast" }).click();

  await page.getByRole("button", { name: "Save Breakfast as a meal" }).click();
  await d.getByLabel("Meal name").fill("Oat breakfast");
  await d.getByRole("button", { name: "Save meal" }).click();
  await expect(d.getByText("Meal saved.")).toBeVisible();
  await d.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Previous day" }).click();
  await page.getByRole("button", { name: "Add food to Breakfast" }).click();
  await d.getByRole("button", { name: "Meals" }).click();
  await d.getByRole("button", { name: "Log Oat breakfast" }).click();
  await expect(page.getByRole("region", { name: "Breakfast" }).getByRole("button", { name: "Edit Oats" })).toBeVisible();

  await page.goto("/nutrition/meals");
  await expect(page.getByRole("button", { name: "Edit meal Oat breakfast" })).toContainText("1 item · 150 kcal");
  await user.cleanup();
});

test("nutrition and progress pages are accessible and fit the viewport @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "nu-a11y");
  await user.db.from("weight_entries").insert([
    { measured_on: daysAgo(5), weight_kg: 70 },
    { measured_on: daysAgo(1), weight_kg: 69.5 },
  ]);
  await user.db.rpc("add_diary_entries", {
    p_day: toLocalIsoDate(new Date()),
    p_meal: "lunch",
    p_items: [{ id: crypto.randomUUID(), food_name: "Sandwich", serving_size: 1, serving_unit: "serving", calories_kcal: 450, protein_g: 20, quantity: 1 }],
  });
  for (const path of ["/progress", "/nutrition", "/nutrition/foods", "/nutrition/meals", "/dashboard"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  }
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food to Dinner" }).click();
  await expectNoA11yViolations(page);
  await page.getByRole("dialog").getByRole("button", { name: "Quick add" }).click();
  await expectNoA11yViolations(page);
  await user.cleanup();
});

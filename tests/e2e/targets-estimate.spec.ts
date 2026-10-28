import { expect, test } from "@playwright/test";
import { toLocalIsoDate } from "@/lib/dates";
import { expectNoA11yViolations, expectNoHorizontalScroll, signInAsNewUser } from "./helpers";

const daysAgo = (n: number) => toLocalIsoDate(new Date(Date.now() - n * 86_400_000));
/** A birth date that makes the user exactly `years` old today. */
const bornYearsAgo = (years: number) => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  d.setFullYear(d.getFullYear() - years);
  return toLocalIsoDate(d);
};

test("maintenance estimate shows its working, uses only the chosen coefficient, and never sets a target", async ({ page }) => {
  const user = await signInAsNewUser(page, "est");
  await page.goto("/nutrition/targets");
  const card = page.getByRole("region", { name: "Maintenance estimate", exact: true });
  await expect(card).toContainText("To see an estimate, add a weigh-in, your height, your date of birth, the formula coefficient and your activity level.");

  await user.db
    .from("profiles")
    .update({ birth_date: bornYearsAgo(30), height_cm: 180, estimate_sex: "male", activity_level: "moderately_active" })
    .eq("id", user.id);
  await user.db.from("weight_entries").insert({ measured_on: daysAgo(2), weight_kg: 80 });
  await page.reload();

  // 10×80 + 6.25×180 − 5×30 + 5 = 1,780 resting; × 1.55 = 2,759 → shown as ≈ 2,760.
  await expect(card).toContainText("≈ 2,760");
  await expect(card).toContainText("1,780 kcal");
  await expect(card).toContainText("Male (+5), as you chose");
  await expect(card).toContainText("Moderately active (× 1.55)");
  await expect(card).toContainText("It is not your target and never changes it.");
  // No way to turn the estimate into a target.
  await expect(card.getByRole("button")).toHaveCount(0);

  await user.db.from("profiles").update({ estimate_sex: "female" }).eq("id", user.id);
  await page.reload();
  // 1,780 − 166 = 1,614 resting; × 1.55 = 2,501.7 → ≈ 2,500.
  await expect(card).toContainText("≈ 2,500");
  await expect(card).toContainText("Female (−161), as you chose");

  // The diary still has no target: the estimate wrote nothing.
  const { count } = await user.db.from("nutrition_targets").select("*", { count: "exact", head: true });
  expect(count).toBe(0);
  await page.goto("/nutrition");
  await expect(page.getByText("No calorie target set for this day.")).toBeVisible();

  // Stale weigh-in warning.
  await user.db.from("weight_entries").update({ measured_on: daysAgo(45) }).eq("user_id", user.id);
  await page.goto("/profile");
  await expect(page.getByRole("region", { name: "Maintenance estimate", exact: true })).toContainText("Your latest weigh-in is from");
  await user.cleanup();
});

test("effective-dated targets: create, past days keep their target, edit warning, duplicate date, delete with undo", async ({ page }) => {
  const user = await signInAsNewUser(page, "tgt");
  await user.db.rpc("add_diary_entries", {
    p_day: daysAgo(10),
    p_meal: "lunch",
    p_items: [{ id: crypto.randomUUID(), food_name: "Rice bowl", serving_size: 1, serving_unit: "bowl", calories_kcal: 600, quantity: 1 }],
  });

  // From the diary's empty state.
  await page.goto("/nutrition");
  await page.getByRole("link", { name: "Set a target" }).click();
  await expect(page).toHaveURL(/\/nutrition\/targets$/);

  // Older target first: 1,800 kcal from 30 days ago.
  await page.getByRole("button", { name: "New target" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Starts on").fill(daysAgo(30));
  await d.getByLabel("Calories").fill("1800");
  await d.getByLabel("Protein").fill("120");
  await d.getByLabel("Carbs").fill("200");
  await d.getByLabel("Fat").fill("60");
  await expect(d.getByText(/Your macros add up to about 1,820 kcal/)).toBeVisible();
  await d.getByRole("button", { name: "Save target" }).click();
  await expect(d).toBeHidden();

  // New target from today.
  await page.getByRole("button", { name: "New target" }).click();
  await expect(d.getByLabel("Starts on")).toHaveValue(daysAgo(0));
  await d.getByLabel("Calories").fill("2000");
  await d.getByRole("button", { name: "Save target" }).click();
  await expect(d).toBeHidden();

  const list = page.getByRole("list", { name: "Targets, newest start date first" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText("In effect today");
  await expect(list.getByRole("listitem").nth(1)).toContainText("Earlier");

  // Today uses 2,000; ten days ago still uses 1,800.
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2,000 kcal")).toBeVisible();
  await page.goto(`/nutrition?date=${daysAgo(10)}`);
  await expect(page.getByText("600 / 1,800 kcal")).toBeVisible();
  await expect(page.getByText("1,200 kcal left")).toBeVisible();

  // Same start date twice is refused with a clear message.
  await page.goto("/nutrition/targets");
  await page.getByRole("button", { name: "New target" }).click();
  await d.getByLabel("Calories").fill("2100");
  await d.getByRole("button", { name: "Save target" }).click();
  await expect(d.getByText("You already have a target starting on this date. Edit that one instead.")).toBeVisible();
  await d.getByRole("button", { name: "Close" }).click();

  // Editing a target that covers past days warns first.
  await page.getByRole("button", { name: /Edit target From/ }).nth(1).click();
  await expect(d.getByText(/already applies to past days/)).toBeVisible();
  await d.getByLabel("Calories").fill("1900");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expect(d).toBeHidden();
  await expect(list.getByRole("listitem").nth(1)).toContainText("1,900 kcal");

  // Delete with undo.
  await page.getByRole("button", { name: /Edit target From/ }).first().click();
  await d.getByRole("button", { name: "Delete target" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByRole("listitem").first()).toContainText("In effect today");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);

  await page.goto("/nutrition");
  await expect(page.getByRole("link", { name: "Change targets" })).toBeVisible();
  await user.cleanup();
});

test("targets page and dialog are accessible and fit the viewport @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "tgt-a11y");
  await user.db.from("profiles").update({ birth_date: "1990-05-05", height_cm: 170, estimate_sex: "female", activity_level: "sedentary" }).eq("id", user.id);
  await user.db.from("weight_entries").insert({ measured_on: daysAgo(1), weight_kg: 65 });
  await user.db.from("nutrition_targets").insert({ effective_from: daysAgo(5), calories_kcal: 1900, protein_g: 130 });
  await page.goto("/nutrition/targets");
  await expect(page.getByText(/≈ \d/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: /Edit target From/ }).click();
  await expect(page.getByRole("dialog").getByText(/already applies to past days/)).toBeVisible();
  await expectNoA11yViolations(page);
  await user.cleanup();
});

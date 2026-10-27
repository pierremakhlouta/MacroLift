import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, signInAsNewUser } from "./helpers";

const results = (page: Page) => page.getByRole("list", { name: "Exercise results" });

test("exercise search matches partial names and muscle groups as you type", async ({ page }) => {
  const user = await signInAsNewUser(page, "search");
  await page.goto("/workouts/exercises");
  const search = page.getByLabel("Search exercises");

  await search.fill("ben");
  await expect(results(page).getByText("Barbell Bench Press", { exact: true })).toBeVisible();
  await expect(results(page).getByText("Lat Pulldown", { exact: true })).toHaveCount(0);

  await search.fill("lats");
  await expect(results(page).getByText("Lat Pulldown", { exact: true })).toBeVisible();

  await search.fill("back");
  await expect(results(page).getByText("Barbell Row", { exact: true })).toBeVisible();
  await expect(results(page).getByText("Romanian Deadlift", { exact: true })).toBeVisible();

  await search.fill("barbell back");
  await expect(results(page).getByText("Pull-Up", { exact: true })).toHaveCount(0);

  await search.fill("qwxz");
  await expect(page.getByText("No matches")).toBeVisible();
  await user.cleanup();
});

test("create, edit, archive and restore a custom exercise", async ({ page }) => {
  const user = await signInAsNewUser(page, "custom");
  await page.goto("/workouts/exercises");
  await page.getByRole("button", { name: "New exercise" }).click();
  const dialog = page.getByRole("dialog");

  // Validation: name and at least one muscle required.
  await dialog.getByRole("button", { name: "Create exercise" }).click();
  await expect(dialog.getByText("Enter a name")).toBeVisible();
  await expect(dialog.getByText("Choose at least one muscle group")).toBeVisible();

  await dialog.getByLabel("Exercise name").fill("Landmine Press");
  await dialog.getByRole("checkbox", { name: "Shoulders" }).check();
  await dialog.getByRole("checkbox", { name: "Chest" }).check();
  await dialog.getByLabel("Equipment (optional)").selectOption("barbell");
  await dialog.getByRole("button", { name: "Create exercise" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("Search exercises").fill("landmine");
  await expect(page.getByText("Landmine Press", { exact: true })).toBeVisible();
  await expect(page.getByText("Custom", { exact: true })).toBeVisible();

  // Searching by the muscle we chose finds it too.
  await page.getByLabel("Search exercises").fill("shoulders landmine");
  await expect(page.getByText("Landmine Press", { exact: true })).toBeVisible();

  await page.getByLabel("Search exercises").fill("landmine");
  await page.getByRole("button", { name: "Edit Landmine Press" }).click();
  await dialog.getByLabel("Exercise name").fill("Half-Kneeling Landmine Press");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Half-Kneeling Landmine Press", { exact: true })).toBeVisible();

  // Duplicate name is rejected with a clear message.
  await page.getByRole("button", { name: "New exercise" }).click();
  await dialog.getByLabel("Exercise name").fill("half-kneeling landmine press");
  await dialog.getByRole("checkbox", { name: "Shoulders" }).check();
  await dialog.getByRole("button", { name: "Create exercise" }).click();
  await expect(dialog.getByText("You already have an exercise with this name.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Edit Half-Kneeling Landmine Press" }).click();
  await dialog.getByRole("button", { name: "Archive exercise" }).click();
  await expect(page.getByText("No matches")).toBeVisible();
  await page.getByLabel("Show archived (1)").check();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Half-Kneeling Landmine Press" }).click();
  await dialog.getByRole("button", { name: "Restore exercise" }).click();
  await expect(page.getByText("Archived", { exact: true })).toHaveCount(0);
  await user.cleanup();
});

test("built-in exercises are read-only", async ({ page }) => {
  const user = await signInAsNewUser(page, "builtin");
  await page.goto("/workouts/exercises");
  await page.getByLabel("Search exercises").fill("barbell bench press");
  await expect(page.getByText("Built-in").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Barbell Bench Press" })).toHaveCount(0);
  await user.cleanup();
});

test("build, reorder, save, reload and delete a routine with optional targets", async ({ page }) => {
  const user = await signInAsNewUser(page, "routine");
  await page.goto("/workouts");
  await expect(page.getByText("No routines yet")).toBeVisible();
  await page.getByRole("link", { name: "New routine" }).click();

  // Name required.
  await page.getByRole("button", { name: "Save routine" }).click();
  await expect(page.getByText("Enter a routine name")).toBeVisible();
  await page.getByLabel("Routine name").fill("Push A");

  // Picker: focus starts in search, results filter live.
  await page.getByRole("button", { name: "Add exercise" }).click();
  const picker = page.getByRole("dialog", { name: "Add exercise" });
  await expect(picker.getByLabel("Search exercises")).toBeFocused();
  await page.keyboard.type("bench pr");
  await picker.getByRole("button", { name: /^Barbell Bench Press/ }).click();
  await expect(picker).toBeHidden();

  await page.getByRole("button", { name: "Add exercise" }).click();
  await picker.getByLabel("Search exercises").fill("pushdown");
  await picker.getByRole("button", { name: /^Triceps Pushdown/ }).click();

  // Targets: bench 3 × 8–12; pushdown left blank. Invalid range is caught.
  const benchCard = page.getByRole("region", { name: "1. Barbell Bench Press" });
  await benchCard.getByLabel("Target sets").fill("3");
  await benchCard.getByLabel("Target reps").fill("12-8");
  await page.getByRole("button", { name: "Save routine" }).click();
  await expect(benchCard.getByText("Put the lower number first, e.g. 8–12")).toBeVisible();
  await benchCard.getByLabel("Target reps").fill("8-12");

  // Reorder: move pushdown up; focus stays on the control.
  await page.getByRole("button", { name: "Move Triceps Pushdown up" }).click();
  await expect(page.getByRole("region", { name: "1. Triceps Pushdown" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move Triceps Pushdown up" })).toBeDisabled();

  await page.getByRole("button", { name: "Save routine" }).click();
  await page.waitForURL(/\/workouts\/routines\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // Reload: persisted, blank targets stay blank.
  await page.reload();
  await expect(page.getByLabel("Routine name")).toHaveValue("Push A");
  const first = page.getByRole("region", { name: "1. Triceps Pushdown" });
  await expect(first.getByLabel("Target sets")).toHaveValue("");
  await expect(first.getByLabel("Target reps")).toHaveValue("");
  const second = page.getByRole("region", { name: "2. Barbell Bench Press" });
  await expect(second.getByLabel("Target sets")).toHaveValue("3");
  await expect(second.getByLabel("Target reps")).toHaveValue("8–12");

  // List summary.
  await page.getByRole("link", { name: "Workouts" }).first().click();
  const card = page.getByRole("link", { name: /Push A/ });
  await expect(card).toContainText("2 exercises");
  await expect(card).toContainText("Triceps Pushdown, Barbell Bench Press (3 × 8–12)");

  // Remove an exercise and save.
  await card.click();
  await page.getByRole("button", { name: "Remove Triceps Pushdown" }).click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save routine" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // Delete with confirmation.
  await page.getByRole("button", { name: "Delete routine" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this routine?" });
  await confirm.getByRole("button", { name: "Delete routine" }).click();
  await page.waitForURL("**/workouts");
  await expect(page.getByText("No routines yet")).toBeVisible();
  await user.cleanup();
});

test("create a custom exercise from the picker when search finds nothing", async ({ page }) => {
  const user = await signInAsNewUser(page, "picker-create");
  await page.goto("/workouts/routines/new");
  await page.getByLabel("Routine name").fill("Legs");
  await page.getByRole("button", { name: "Add exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search exercises").fill("Zercher Squat");
  await expect(dialog.getByText("No matching exercise")).toBeVisible();
  await dialog.getByRole("button", { name: "Create “Zercher Squat”" }).click();
  await expect(dialog.getByLabel("Exercise name")).toHaveValue("Zercher Squat");
  await dialog.getByRole("checkbox", { name: "Quads" }).check();
  await dialog.getByRole("button", { name: "Create exercise" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "1. Zercher Squat" })).toBeVisible();
  await page.getByRole("button", { name: "Save routine" }).click();
  await page.waitForURL(/\/workouts\/routines\/[0-9a-f-]{36}$/);
  await user.cleanup();
});

test("Escape closes the picker and returns focus", async ({ page }) => {
  const user = await signInAsNewUser(page, "esc");
  await page.goto("/workouts/routines/new");
  const add = page.getByRole("button", { name: "Add exercise" });
  await add.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(add).toBeFocused();
  await user.cleanup();
});

test("workouts pages are accessible and fit the viewport @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "a11y-w");
  for (const path of ["/workouts", "/workouts/exercises", "/workouts/routines/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  }
  // Editor with an exercise and the picker open.
  await page.getByRole("button", { name: "Add exercise" }).click();
  await expectNoA11yViolations(page);
  await page.getByRole("dialog").getByLabel("Search exercises").fill("squat");
  await page.getByRole("dialog").getByRole("button", { name: /^Barbell Back Squat/ }).click();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);

  await page.goto("/workouts/exercises");
  await page.getByRole("button", { name: "New exercise" }).click();
  await expectNoA11yViolations(page);
  await user.cleanup();
});

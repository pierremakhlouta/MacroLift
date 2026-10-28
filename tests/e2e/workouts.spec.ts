import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, signInAsNewUser } from "./helpers";

const status = (page: Page) => page.getByRole("status").filter({ hasText: /Saved|Saving|Not synced|Needs your choice/ }).first();
const weight = (page: Page, exercise: string, n: number) => page.getByLabel(new RegExp(`^${exercise}, set ${n} (weight|\\+ weight|assist) in`));
const reps = (page: Page, exercise: string, n: number) => page.getByLabel(`${exercise}, set ${n} reps`);

async function startEmptyWithExercise(page: Page, exercise = "Barbell Bench Press", search = "bench pr") {
  await page.goto("/workouts");
  await page.getByRole("button", { name: "Start empty workout" }).click();
  await page.waitForURL("**/workouts/active");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("dialog").getByLabel("Search exercises").fill(search);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${exercise}`) }).click();
  await expect(reps(page, exercise, 1)).toBeVisible();
}

test("log sets in imperial units, autosave, and resume after a refresh", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-log");
  await user.db.from("profiles").update({ unit_system: "imperial" }).eq("id", user.id);
  await startEmptyWithExercise(page);

  await weight(page, "Barbell Bench Press", 1).fill("135");
  await reps(page, "Barbell Bench Press", 1).fill("8");
  await expect(status(page)).toHaveText(/Saved/);

  // New set carries the weight over; reps start blank.
  await page.getByRole("button", { name: "Add set to Barbell Bench Press" }).click();
  await expect(weight(page, "Barbell Bench Press", 2)).toHaveValue("135");
  await expect(reps(page, "Barbell Bench Press", 2)).toHaveValue("");
  await reps(page, "Barbell Bench Press", 2).fill("6");

  // Refresh immediately (before the debounced upload): nothing is lost.
  await page.reload();
  await expect(reps(page, "Barbell Bench Press", 2)).toHaveValue("6");
  await expect(weight(page, "Barbell Bench Press", 1)).toHaveValue("135");
  await expect(status(page)).toHaveText(/Saved/);

  const { data } = await user.db.from("workout_sets").select("reps, weight_kg").order("position");
  expect(data!.map((s) => s.reps)).toEqual([8, 6]);
  expect(data![0].weight_kg).toBeCloseTo(61.235, 3); // stored canonically in kg
  await user.cleanup();
});

test("invalid input is flagged and not saved; blank stays blank", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-invalid");
  await startEmptyWithExercise(page);
  await reps(page, "Barbell Bench Press", 1).fill("8.5");
  await expect(page.getByText("Enter a whole number")).toBeVisible();
  await weight(page, "Barbell Bench Press", 1).fill("-20");
  await expect(page.getByText("Can't be negative")).toBeVisible();
  await reps(page, "Barbell Bench Press", 1).fill("");
  await weight(page, "Barbell Bench Press", 1).fill("");
  await expect(status(page)).toHaveText(/Saved/);
  const { data } = await user.db.from("workout_sets").select("reps, weight_kg");
  expect(data).toEqual([{ reps: null, weight_kg: null }]);
  await user.cleanup();
});

test("keeps edits while offline and uploads them on reconnect", async ({ page, context }) => {
  const user = await signInAsNewUser(page, "wk-offline");
  await startEmptyWithExercise(page);
  await expect(status(page)).toHaveText(/Saved/);

  await context.setOffline(true);
  await weight(page, "Barbell Bench Press", 1).fill("80");
  await reps(page, "Barbell Bench Press", 1).fill("5");
  await expect(status(page)).toHaveText(/Not synced/);
  await expect(page.getByText(/You're offline\. Changes are kept on this device/)).toBeVisible();

  // Nothing claimed as saved while offline.
  let server = await user.db.from("workout_sets").select("reps");
  expect(server.data).toEqual([{ reps: null }]);

  await context.setOffline(false);
  await expect(status(page)).toHaveText(/Saved/, { timeout: 15_000 });
  server = await user.db.from("workout_sets").select("reps, weight_kg");
  expect(server.data).toEqual([{ reps: 5, weight_kg: 80 }]);
  await user.cleanup();
});

test("finish shows a summary, then history shows summaries with expandable details", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-finish");
  await startEmptyWithExercise(page);
  await page.getByLabel("Workout name").fill("Chest day");
  await weight(page, "Barbell Bench Press", 1).fill("60");
  await reps(page, "Barbell Bench Press", 1).fill("10");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("dialog").getByLabel("Search exercises").fill("pull-up");
  await page.getByRole("dialog").getByRole("button", { name: /^Pull-Up/ }).click();
  await reps(page, "Pull-Up", 1).fill("8");

  await page.getByRole("button", { name: "Finish workout" }).click();
  const dialog = page.getByRole("dialog", { name: "Finish workout?" });
  await expect(dialog.getByText("Sets logged")).toBeVisible();
  await dialog.getByRole("button", { name: "Finish workout" }).click();

  await page.waitForURL(/\/workouts\/history\/[0-9a-f-]{36}\?finished=1$/);
  await expect(page.getByText("Workout saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Chest day" })).toBeVisible();
  // Volume counts only the weighted exercise; bodyweight sets are reported separately.
  await expect(page.getByText("600 kg")).toBeVisible();
  await expect(page.getByText(/Includes 1 bodyweight\/assisted set, not counted in volume/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "60 kg × 10" })).toBeVisible();

  await page.goto("/workouts/history");
  const card = page.getByRole("article", { name: /Chest day/ });
  const toggle = card.getByRole("button", { name: /Chest day/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(card).toContainText("2 exercises · 2 sets · 600 kg");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(card.getByRole("cell", { name: "8 reps" })).toBeVisible();

  // No active workout remains.
  await page.goto("/workouts");
  await expect(page.getByRole("button", { name: "Start empty workout" })).toBeVisible();
  await user.cleanup();
});

test("start from a routine shows target snapshots and pre-filled blank sets", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-routine");
  const { data: ex } = await user.db.from("exercises").select("id").eq("name", "Barbell Back Squat").single();
  await user.db.rpc("save_routine", {
    p_id: randomUUID(),
    p_name: "Leg Day",
    p_notes: "",
    p_items: [{ id: randomUUID(), exercise_id: ex!.id, target_sets: 3, target_reps_min: 5, target_reps_max: 5, notes: null }],
  });
  await page.goto("/workouts");
  await page.getByRole("button", { name: "Start Leg Day" }).click();
  await page.waitForURL("**/workouts/active");
  await expect(page.getByText("Target 3 × 5")).toBeVisible();
  await expect(page.getByText(/from Leg Day/)).toBeVisible();
  for (const n of [1, 2, 3]) await expect(reps(page, "Barbell Back Squat", n)).toHaveValue("");

  // A second start is not possible while one is active: it resumes instead.
  await page.goto("/workouts");
  await expect(page.getByRole("button", { name: "Start Leg Day" })).toBeDisabled();
  await page.getByRole("link", { name: "Resume workout" }).click();
  await page.waitForURL("**/workouts/active");
  await user.cleanup();
});

test("undo a removed set and discard a workout", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-undo");
  await startEmptyWithExercise(page);
  await reps(page, "Barbell Bench Press", 1).fill("5");
  await page.getByRole("button", { name: "Add set to Barbell Bench Press" }).click();
  await reps(page, "Barbell Bench Press", 2).fill("4");

  await page.getByRole("button", { name: "Remove Barbell Bench Press, set 2" }).click();
  await expect(reps(page, "Barbell Bench Press", 2)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(reps(page, "Barbell Bench Press", 2)).toHaveValue("4");
  await expect(status(page)).toHaveText(/Saved/);
  const { count } = await user.db.from("workout_sets").select("id", { count: "exact", head: true });
  expect(count).toBe(2);

  await page.getByRole("button", { name: "Discard workout" }).click();
  await page.getByRole("dialog", { name: "Discard this workout?" }).getByRole("button", { name: "Discard workout" }).click();
  await page.waitForURL("**/workouts");
  await expect(page.getByRole("button", { name: "Start empty workout" })).toBeVisible();
  await expect.poll(async () => (await user.db.from("workout_sessions").select("id")).data?.length).toBe(0);
  await user.cleanup();
});

test("conflicting edits from another device are surfaced, not overwritten", async ({ page, browser }) => {
  const user = await signInAsNewUser(page, "wk-conflict");
  await startEmptyWithExercise(page);
  await expect(status(page)).toHaveText(/Saved/);

  // Second device: same account, separate browser context.
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageB = await other.newPage();
  await pageB.goto("/login");
  await pageB.getByLabel("Email").fill(user.email);
  await pageB.getByLabel("Password").fill(user.password);
  await pageB.getByRole("button", { name: "Sign in" }).click();
  await pageB.waitForURL("**/dashboard");
  await pageB.getByRole("link", { name: "Resume workout" }).click();
  await reps(pageB, "Barbell Bench Press", 1).fill("5");
  await expect(status(pageB)).toHaveText(/Saved/);

  await reps(page, "Barbell Bench Press", 1).fill("9");
  const dialog = page.getByRole("dialog", { name: "This workout changed somewhere else" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Nothing has been overwritten")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toHaveCount(0);
  let server = await user.db.from("workout_sets").select("reps");
  expect(server.data).toEqual([{ reps: 5 }]);

  await dialog.getByRole("button", { name: "Use the saved version" }).click();
  await expect(dialog).toBeHidden();
  await expect(reps(page, "Barbell Bench Press", 1)).toHaveValue("5");

  // Now the other direction: keep this device's version.
  await reps(pageB, "Barbell Bench Press", 1).fill("6");
  await expect(status(pageB)).toHaveText(/Saved/);
  await reps(page, "Barbell Bench Press", 1).fill("7");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep this device's version" }).click();
  await expect(status(page)).toHaveText(/Saved/);
  server = await user.db.from("workout_sets").select("reps");
  expect(server.data).toEqual([{ reps: 7 }]);

  await other.close();
  await user.cleanup();
});

test("workout pages are accessible and fit the viewport @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "wk-a11y");
  await startEmptyWithExercise(page);
  await weight(page, "Barbell Bench Press", 1).fill("100");
  await reps(page, "Barbell Bench Press", 1).fill("5");
  await expect(status(page)).toHaveText(/Saved/);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expectNoA11yViolations(page);
  await page.getByRole("dialog").getByRole("button", { name: "Finish workout" }).click();
  await page.waitForURL(/\/workouts\/history\//);
  await expect(page.getByText("Workout saved")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);

  await page.goto("/workouts/history");
  await page.getByRole("button", { name: /Barbell Bench Press|Workout/ }).first().click();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await user.cleanup();
});

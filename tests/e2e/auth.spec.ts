import { expect, test } from "@playwright/test";
import { createSignedInUser, deleteUser } from "../integration/env";
import { latestAuthLink, signInAsNewUser, uniqueEmail } from "./helpers";

test("sign up, confirm email, onboard with imperial units and estimate details", async ({ page }) => {
  const email = uniqueEmail("signup");
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("strongpass1");
  await page.getByLabel("Confirm password").fill("strongpass1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await latestAuthLink(email));
  await page.waitForURL("**/onboarding");

  await page.getByRole("radio", { name: /Imperial/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Maintenance estimate (optional)" })).toBeFocused();
  await page.getByRole("button", { name: "Add my details" }).click();

  await page.getByLabel("Date of birth").fill("1995-06-15");
  await page.getByLabel("Feet").fill("5");
  await page.getByLabel("Inches").fill("10");
  await page.getByLabel("Current body weight").fill("176.4");
  await page.getByLabel("Activity level").selectOption("moderately_active");
  await page.getByRole("radio", { name: "Female" }).check();
  await page.getByRole("button", { name: "Save and finish" }).click();

  await expect(page.getByText("Setup saved.")).toBeVisible();
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("176.4 lb")).toBeVisible();

  // Preferences persist and display in the chosen units.
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("radio", { name: /Imperial/ })).toBeChecked();
  await expect(page.getByLabel("Feet")).toHaveValue("5");
  await expect(page.getByLabel("Inches")).toHaveValue("10");
  await expect(page.getByRole("radio", { name: "Female" })).toBeChecked();

  // Switch to metric: the same stored weight shows converted.
  await page.getByRole("radio", { name: /Metric/ }).check();
  await expect(page.getByLabel("Current body weight")).toHaveValue("80");
});

test("skipping the estimate leaves details empty and never asks for the coefficient", async ({ page }) => {
  const user = await signInAsNewUser(page, "skip", { onboarded: false });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("radio", { name: "Male" })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Setup saved.")).toBeVisible();

  const { data } = await user.db.from("profiles").select("estimate_sex, birth_date, height_cm, onboarding_completed_at").single();
  expect(data).toMatchObject({ estimate_sex: null, birth_date: null, height_cm: null });
  expect(data?.onboarding_completed_at).not.toBeNull();
  await user.cleanup();
});

test("password reset by email", async ({ page }) => {
  const user = await createSignedInUser("reset");
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await latestAuthLink(user.email));
  await page.waitForURL("**/reset-password");
  await page.getByLabel("New password", { exact: true }).fill("brandnew42");
  await page.getByLabel("Confirm new password").fill("brandnew42");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL("**/login?reset=1");

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("brandnew42");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
  await deleteUser(user.id);
});

test("wrong password shows an error without revealing whether the account exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByLabel("Password").fill("whatever123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Email or password is incorrect.");
});

test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
  await page.goto("/profile");
  await page.waitForURL("**/login?next=%2Fprofile");
  const user = await createSignedInUser("next");
  await user.db.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/profile");
  await deleteUser(user.id);
});

test("sign-out clears account-specific local data", async ({ page }) => {
  const user = await signInAsNewUser(page, "signout");
  await page.evaluate((id) => localStorage.setItem(`macrolift:u:${id}:active-workout`, "{}"), user.id);
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login**");
  const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("macrolift:u:")));
  expect(leftovers).toEqual([]);
  await user.cleanup();
});

test("account switch in the same browser clears the previous account's local data", async ({ page }) => {
  const first = await signInAsNewUser(page, "switch-a");
  await page.evaluate((id) => localStorage.setItem(`macrolift:u:${id}:active-workout`, "{}"), first.id);
  // Simulate the session ending without a clean sign-out (e.g. expired), then a different user signs in.
  await page.context().clearCookies();
  const second = await signInAsNewUser(page, "switch-b");
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("macrolift:u:")));
  expect(keys.some((k) => k.includes(first.id))).toBe(false);
  await first.cleanup();
  await second.cleanup();
});

test("delete account removes access", async ({ page }) => {
  const user = await signInAsNewUser(page, "delete");
  await page.goto("/profile");
  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();
  await page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
  await del.click();
  await page.waitForURL("**/login?deleted=1");
  await expect(page.getByText("Your account and its data were deleted.")).toBeVisible();

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
});

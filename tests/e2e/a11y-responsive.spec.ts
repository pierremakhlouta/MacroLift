import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, signInAsNewUser } from "./helpers";

for (const path of ["/login", "/signup", "/forgot-password", "/privacy"]) {
  test(`public page ${path} is accessible and fits the viewport @responsive`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
}

test("signed-in pages are accessible and fit the viewport @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "a11y");
  for (const path of ["/dashboard", "/workouts", "/nutrition", "/progress", "/profile"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  }
  await user.cleanup();
});

test("onboarding is accessible @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "a11y-onb", { onboarded: false });
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Add my details" }).click();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await user.cleanup();
});

test("keyboard: skip link first, nav reachable, current page marked @responsive", async ({ page }) => {
  const user = await signInAsNewUser(page, "kbd");
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const current = page.locator('nav[aria-label="Main"] a[aria-current="page"]:visible');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(/Dashboard/);
  await user.cleanup();
});

test("focus indicator is visible on form controls", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").focus();
  await page.keyboard.press("Tab");
  const outline = await page.getByLabel("Password").evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

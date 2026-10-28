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
  for (const path of ["/dashboard", "/workouts", "/nutrition", "/nutrition/targets", "/progress", "/profile"]) {
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

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("installable: manifest, icons and iOS home-screen tags are served without sign-in", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "MacroLift", display: "standalone", start_url: "/dashboard" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(appleIcon!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "MacroLift");
  expect((await request.get("/icon.svg")).headers()["content-type"]).toContain("svg");
});

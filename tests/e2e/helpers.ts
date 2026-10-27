import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createSignedInUser, deleteUser } from "../integration/env";

const MAILPIT = "http://127.0.0.1:54324";

export const uniqueEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}@test.local`;

/** Poll the local Mailpit inbox for the newest email to `to` and return its first auth link. */
export async function latestAuthLink(to: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const match = /(http[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+)/.exec(msg.Text ?? "") ?? /href="([^"]+\/auth\/v1\/verify[^"]+)"/.exec(msg.HTML ?? "");
      if (match) return match[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No auth email for ${to}`);
}

/** Create a confirmed, onboarded user through the admin API and sign in through the UI. */
export async function signInAsNewUser(page: Page, label: string, { onboarded = true } = {}) {
  const user = await createSignedInUser(label);
  if (onboarded) {
    await user.db.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(onboarded ? "**/dashboard" : "**/onboarding");
  return { ...user, cleanup: () => deleteUser(user.id) };
}

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

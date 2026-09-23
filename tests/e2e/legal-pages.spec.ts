import { test, expect } from "@playwright/test";

// quickstart.md of 010-legal-pages, bloques 1-2. The operator's name and
// contact aren't asserted here: they come from whoever runs the suite's
// .env.local, and their fallbacks are covered by tests/unit/legal.test.ts.

const PRIVACY_SECTIONS = [
  "Who runs this instance",
  "Data we store",
  "How we use it",
  "Who can see it",
  "Service providers",
  "What we don't do",
  "Cookies",
  "Keeping and deleting your data",
  "Changes",
  "Contact",
];

test.describe("Legal pages", () => {
  test("the privacy policy is public and complete", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText(/^Last updated: \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    for (const section of PRIVACY_SECTIONS) {
      await expect(page.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
    }
  });

  test("the terms are public and cross-linked with the privacy policy", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveURL("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();

    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL("/privacy");
    await footer.getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL("/terms");

    // Signed out, "/" sends the visitor on to sign in (FR-008).
    await page.getByRole("link", { name: "← Back to Kanban" }).click();
    await expect(page).toHaveURL("/sign-in");
  });

  for (const screen of ["/sign-in", "/sign-up"]) {
    test(`${screen} links to both pages in a new tab`, async ({ page, context }) => {
      await page.goto(screen);
      for (const [name, url] of [
        ["Privacy Policy", "/privacy"],
        ["Terms of Service", "/terms"],
      ]) {
        const [tab] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name }).click()]);
        await tab.waitForLoadState();
        expect(new URL(tab.url()).pathname).toBe(url);
        await tab.close();
      }
    });
  }

  test("sign-up shows the consent notice and keeps the form after opening a legal page", async ({ page, context }) => {
    await page.goto("/sign-up");
    await expect(page.getByText(/By creating an account or continuing with Google, you agree/)).toBeVisible();

    await page.getByLabel("Name").fill("Legal Reader");
    await page.getByLabel("Email").fill("legal-reader@example.com");

    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "Terms of Service" }).click(),
    ]);
    await tab.close();

    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByLabel("Name")).toHaveValue("Legal Reader");
    await expect(page.getByLabel("Email")).toHaveValue("legal-reader@example.com");
  });
});

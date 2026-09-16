import { test, expect } from "@playwright/test";

// quickstart.md bloque 1, pasos 1-3. Google OAuth isn't exercised here —
// automating a real Google consent screen needs a dedicated test Google
// account and is out of scope for this suite; verify that path manually
// per quickstart.md.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test.describe("Accounts", () => {
  test("registers with email/password and can log back in", async ({ page }) => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/");

    // Sign out and back in with the same credentials (FR-003).
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
  });

  test("rejects a password under 8 characters", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("short1");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    await expect(page).toHaveURL("/sign-up");
  });

  test("rejects an invalid email format", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("a-valid-password-123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
    await expect(page).toHaveURL("/sign-up");
  });
});

import { test, expect } from "@playwright/test";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { user, verification } from "@/db/auth-schema";

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

  // Historia 5 de 001-accounts-invitations (T069). There's no real inbox in
  // this suite, so the reset token is read back from the `verification`
  // table Better Auth writes it to — the same value the emailed link would
  // carry as its `token` query param.
  test("resets a forgotten password and signs in with the new one", async ({ page }) => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("button", { name: "Creating account..." })).toBeHidden();

    const [dbUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!dbUser) throw new Error("Signed-up user not found.");

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible();

    const [verificationRow] = await db
      .select()
      .from(verification)
      .where(and(eq(verification.value, dbUser.id), like(verification.identifier, "reset-password:%")))
      .orderBy(desc(verification.createdAt))
      .limit(1);
    if (!verificationRow) throw new Error("Reset token was not created.");
    const token = verificationRow.identifier.replace("reset-password:", "");

    const newPassword = "a-brand-new-password-456";
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL("/sign-in");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("rejects an invalid or already-used reset link", async ({ page }) => {
    await page.goto("/reset-password?token=not-a-real-token");
    await page.getByLabel("New password").fill("whatever-password-123");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { signUpNewUser } from "./helpers";

// The user card at the bottom of the side panel opens the account page,
// where the user can rename themselves and sign out.
test.describe("Account page and sign out", () => {
  test("user card opens the account page; renaming sticks; sign out ends the session", async ({ page }) => {
    await signUpNewUser(page, "Ana");

    await page.getByRole("link", { name: "Account settings" }).click();
    await expect(page).toHaveURL(/\/settings\/account$/);
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

    await page.locator("#account-name").fill("Ana Renamed");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: "Account settings" })).toContainText("Ana Renamed");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // The session is really gone: a protected page sends us back to sign-in.
    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

import { test, expect } from "@playwright/test";
import { signUpNewUser } from "./helpers";

// quickstart.md bloque 2.

test.describe("Projects", () => {
  test("rejects creating a project without a name, accepts one with a name", async ({ page }) => {
    await signUpNewUser(page);

    await page.getByRole("button", { name: "New project" }).click();
    await page.getByRole("button", { name: "Create project" }).click();
    // Native <dialog> stays open; the Server Action returns NAME_REQUIRED.
    await expect(page.getByText(/name is required/i)).toBeVisible();

    await page.getByLabel("Name").fill("Demo Project");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/projects\/.+/);
  });

  test("lists projects under Personal, collapses/expands, and navigates to one", async ({ page }) => {
    await signUpNewUser(page);

    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Name").fill("Solo Project");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/.+/);

    const personalHeader = page.getByRole("button", { name: "Personal" });
    await expect(personalHeader).toBeVisible();
    const projectLink = page.getByRole("link", { name: "Solo Project" });
    await expect(projectLink).toBeVisible();

    // Collapse, then expand again.
    await personalHeader.click();
    await expect(projectLink).toBeHidden();
    await personalHeader.click();
    await expect(projectLink).toBeVisible();

    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/.+/);

    // "Shared" classification (2+ members) is exercised end-to-end together
    // with the invitation-accept flow — see the Phase 11 test in
    // invitations.spec.ts ("verifica reclasificación a Compartido").
  });
});

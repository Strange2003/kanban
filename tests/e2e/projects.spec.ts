import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi } from "./helpers";

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

  // quickstart.md bloque 2, paso 4 (T074).
  test("the owner renames a project and the new name shows everywhere", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Old Name");

    await page.goto(`${projectUrl}/settings`);
    await page.getByLabel("Name").fill("New Name");
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByRole("heading", { name: "New Name — Settings" })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: "New Name" })).toBeVisible();
  });

  // quickstart.md bloque 2, pasos 5 y 7 (T077).
  test("the owner deletes a project, removing it for everyone", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Disposable Project");

    await page.goto(`${projectUrl}/settings`);
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Disposable Project" })).toBeHidden();
  });

  // quickstart.md bloque 2, paso 3 (T080).
  test("the sidebar search filters projects and clearing it restores the full list", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Marketing Site");
    await page.goto("/");
    await createProjectViaUi(page, "Internal Tools");

    await page.getByLabel("Search projects").fill("marketing");
    await expect(page.getByRole("link", { name: "Marketing Site" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Internal Tools" })).toBeHidden();

    await page.getByLabel("Search projects").fill("");
    await expect(page.getByRole("link", { name: "Marketing Site" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Internal Tools" })).toBeVisible();
  });

  // Historia 7 de 002-project-spaces (T083).
  test("the owner removes a member, revoking access immediately; a non-owner can't", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    await signUpNewUser(ownerPage, "Owner");
    const projectUrl = await createProjectViaUi(ownerPage, "Team Project");
    const memberEmail = await signUpNewUser(memberPage, "Member");

    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite" }).click();
    await ownerPage.getByLabel("Email").fill(memberEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Close" }).click();

    await memberPage.goto("/");
    await memberPage.getByRole("button", { name: "Notifications" }).click();
    await memberPage.getByRole("button", { name: "Accept" }).click();
    await memberPage.reload();
    await expect(memberPage.getByRole("link", { name: "Team Project" })).toBeVisible();

    await ownerPage.reload();
    await expect(ownerPage.getByText("Member (member)")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Remove" }).click();
    await expect(ownerPage.getByText("Member (member)")).toBeHidden();

    // Access revoked immediately (FR-012).
    await memberPage.reload();
    await expect(memberPage.getByRole("link", { name: "Team Project" })).toBeHidden();

    await ownerContext.close();
    await memberContext.close();
  });
});

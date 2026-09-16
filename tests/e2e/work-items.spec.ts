import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi, dragWorkItemToColumn } from "./helpers";

// quickstart.md bloque 4.

async function addColumn(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "+ Add column" }).click();
  await page.getByPlaceholder("Column name").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

test.describe("Work Items", () => {
  test("rejects an empty title, then creates a Work Item with a readable id", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await page.getByRole("button", { name: "+ Add work item" }).click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();

    await page.getByPlaceholder("Title").fill("Design the login screen");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("Design the login screen")).toBeVisible();
    // FR-003 of 004-work-items: correlative per-project id, e.g. "TAB-1".
    await expect(page.getByText(/^[A-Z0-9]{1,4}-1$/)).toBeVisible();
  });

  test("dragging a Work Item to another column moves it, and it persists on reload", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addColumn(page, "Doing");

    await page.getByRole("button", { name: "+ Add work item" }).first().click();
    await page.getByPlaceholder("Title").fill("Design the login screen");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Design the login screen")).toBeVisible();

    await dragWorkItemToColumn(page, "Design the login screen", "Doing");

    const doingColumn = page.locator('[data-testid="stage-column"]', { hasText: "Doing" });
    await expect(doingColumn.getByText("Design the login screen")).toBeVisible();

    await page.reload();
    await expect(doingColumn.getByText("Design the login screen")).toBeVisible();
  });

  // quickstart.md bloque 4, paso 4 (T097).
  test("edits description/stakeholder, adds an existing and a brand-new tag, and logs both in activity", async ({
    page,
  }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await page.getByRole("button", { name: "+ Add work item" }).click();
    await page.getByPlaceholder("Title").fill("Design the login screen");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText("Design the login screen").click();

    await page.getByLabel("Description").fill("Match the new brand colors.");
    await page.getByLabel("Stakeholder").fill("Product team");
    await page.getByPlaceholder("Add a tag...").fill("design");
    await page.getByRole("button", { name: 'Create "design"' }).click();
    await page.getByRole("button", { name: "Save" }).click();

    // Tag is now in the project's catalog — reopen and add it to a second item too.
    await page.getByRole("button", { name: "+ Add work item" }).click();
    await page.getByPlaceholder("Title").fill("Another item");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText("Another item").click();
    await page.getByPlaceholder("Add a tag...").fill("design");
    await page.getByRole("button", { name: "design", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await page.getByText("Design the login screen").click();
    await expect(page.getByLabel("Description")).toHaveValue("Match the new brand colors.");
    await expect(page.getByText(/edited description/i)).toBeVisible();
    await expect(page.getByText(/edited tags/i)).toBeVisible();
  });

  // quickstart.md bloque 4, paso 5 (T100).
  test("deletes a Work Item, removing it from the board for everyone", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await page.getByRole("button", { name: "+ Add work item" }).click();
    await page.getByPlaceholder("Title").fill("Temporary item");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await page.getByText("Temporary item").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Temporary item")).toBeHidden();
  });
});

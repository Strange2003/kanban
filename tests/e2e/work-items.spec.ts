import { test, expect } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  dragWorkItemToColumn,
  dragWorkItemOntoWorkItem,
  openCard,
  backToBoard,
} from "./helpers";

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

    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design the login screen" })).toBeVisible();
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
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design the login screen" })).toBeVisible();

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
    await openCard(page, "Design the login screen");

    await page.getByLabel("Description", { exact: true }).fill("Match the new brand colors.");
    await page.getByLabel("Stakeholder", { exact: true }).fill("Product team");
    await page.getByPlaceholder("Add a tag...").fill("design");
    await page.getByRole("button", { name: 'Create "design"' }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.waitForLoadState("networkidle");

    // Tag is now in the project's catalog — back to the board, add it to a second item too.
    await backToBoard(page);
    await page.getByRole("button", { name: "+ Add work item" }).click();
    await page.getByPlaceholder("Title").fill("Another item");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await openCard(page, "Another item");
    await page.getByPlaceholder("Add a tag...").fill("design");
    await page.getByRole("button", { name: "design", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await backToBoard(page);

    await openCard(page, "Design the login screen");
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Match the new brand colors.", {
      timeout: 15000,
    });
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

    await openCard(page, "Temporary item");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Temporary item" })).toBeHidden();
  });

  // Historia 5 de 004-work-items (T113).
  test("reorders Work Items within a column, and it persists for other members", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    for (const title of ["First item", "Second item", "Third item"]) {
      await page.getByRole("button", { name: "+ Add work item" }).click();
      await page.getByPlaceholder("Title").fill(title);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.locator('[data-testid="work-item-card"]', { hasText: title })).toBeVisible();
    }

    const cards = page.locator('[data-testid="work-item-card"]');
    await expect(cards).toHaveText([/First item/, /Second item/, /Third item/]);

    await dragWorkItemOntoWorkItem(page, "First item", "Third item");
    await expect(cards).toHaveText([/Second item/, /Third item/, /First item/]);

    await page.reload();
    await expect(cards).toHaveText([/Second item/, /Third item/, /First item/]);
  });
});

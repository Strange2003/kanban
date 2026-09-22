import { test, expect } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  dragWorkItemToColumn,
  dragWorkItemOntoWorkItem,
  openCard,
  backToBoard,
  addColumn,
  addWorkItem,
  clickUntilVisible,
} from "./helpers";

// quickstart.md bloque 4.

test.describe("Work Items", () => {
  test("rejects an empty title, then creates a Work Item with a readable id", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await clickUntilVisible(page.getByRole("button", { name: "+ Add work item" }), page.getByPlaceholder("Title"));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();

    await page.getByPlaceholder("Title").fill("Design the login screen");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design the login screen" })).toBeVisible();
    // FR-003 of 004-work-items: correlative per-project id, e.g. "TAB-1". The prefix
    // gets a numeric suffix on collision ("TAB2", "TAB15"...), so its length varies.
    await expect(page.getByText(/^[A-Z0-9]+-1$/)).toBeVisible();
  });

  test("dragging a Work Item to another column moves it, and it persists on reload", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addColumn(page, "Doing");

    await addWorkItem(page, "Design the login screen");

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

    await addWorkItem(page, "Design the login screen");
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
    await addWorkItem(page, "Another item");
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
    // One save logs one "fields_edited" entry listing every changed field, e.g.
    // "Edited tags, description, stakeholder".
    await expect(page.getByText(/^Edited .*\bdescription\b/)).toBeVisible();
    await expect(page.getByText(/^Edited .*\btags\b/)).toBeVisible();
  });

  // quickstart.md bloque 4, paso 5 (T100).
  test("deletes a Work Item, removing it from the board for everyone", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await addWorkItem(page, "Temporary item");

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
      await addWorkItem(page, title);
    }

    const cards = page.locator('[data-testid="work-item-card"]');
    await expect(cards).toHaveText([/First item/, /Second item/, /Third item/]);

    await dragWorkItemOntoWorkItem(page, "First item", "Third item");
    await expect(cards).toHaveText([/Second item/, /Third item/, /First item/]);

    await page.reload();
    await expect(cards).toHaveText([/Second item/, /Third item/, /First item/]);
  });
});

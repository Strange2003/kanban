import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi } from "./helpers";

// quickstart.md bloque 3.

async function addColumn(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "+ Add column" }).click();
  await page.getByPlaceholder("Column name").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

/** Same pointer-sequence approach as dragWorkItemToColumn in helpers.ts — dnd-kit ignores native HTML5 drag events. */
async function dragColumn(page: import("@playwright/test").Page, columnName: string, targetColumnName: string) {
  const source = page.locator('[data-testid="stage-column"]', { hasText: columnName });
  const target = page.locator('[data-testid="stage-column"]', { hasText: targetColumnName });

  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Could not locate drag source/target.");

  await page.mouse.move(from.x + from.width / 2, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 15, { steps: 10 });
  await page.mouse.up();
}

test.describe("Kanban board", () => {
  test("a new project's board starts with no columns, and one can be added", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");

    // FR-010 of 003-kanban-board
    await expect(page.getByRole("button", { name: "+ Add column" })).toBeVisible();
    await expect(page.locator("h3")).toHaveCount(0);

    // Rejects an empty name.
    await page.getByRole("button", { name: "+ Add column" }).click();
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();

    // Accepts a real name.
    await page.getByPlaceholder("Column name").fill("To do");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("heading", { name: "To do", level: 3 })).toBeVisible();
  });

  // quickstart.md bloque 3, paso 3 (T087).
  test("reorders columns by dragging, and it persists for other members", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addColumn(page, "Doing");
    await addColumn(page, "Done");

    await dragColumn(page, "To do", "Done");

    const headings = page.getByRole("heading", { level: 3 });
    await expect(headings).toHaveText(["Doing", "Done", "To do"]);

    await page.reload();
    await expect(headings).toHaveText(["Doing", "Done", "To do"]);
  });

  // quickstart.md bloque 3, pasos 4-5 (T090).
  test("deletes an empty column, and blocks deleting a non-empty one", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "Empty column");
    await addColumn(page, "Busy column");

    await page.getByRole("button", { name: "+ Add work item" }).nth(1).click();
    await page.getByPlaceholder("Title").fill("Something to do");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Something to do")).toBeVisible();

    const busyColumn = page.locator('[data-testid="stage-column"]', { hasText: "Busy column" });
    await busyColumn.getByRole("button", { name: "Delete column" }).click();
    await expect(page.getByText(/move or delete/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Busy column", level: 3 })).toBeVisible();

    const emptyColumn = page.locator('[data-testid="stage-column"]', { hasText: "Empty column" });
    await emptyColumn.getByRole("button", { name: "Delete column" }).click();
    await expect(page.getByRole("heading", { name: "Empty column", level: 3 })).toBeHidden();
  });

  // Historia 5 de 003-kanban-board (T110).
  test("renames a column via double-click, and the new name shows for everyone", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "Old column name");

    await page.getByRole("heading", { name: "Old column name", level: 3 }).dblclick();
    const input = page.getByRole("textbox");
    await input.fill("New column name");
    await input.press("Enter");

    await expect(page.getByRole("heading", { name: "New column name", level: 3 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "New column name", level: 3 })).toBeVisible();
  });
});

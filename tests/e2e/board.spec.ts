import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi, addColumn, addWorkItem, clickUntilVisible, pointerDrag, stageColumn } from "./helpers";

// quickstart.md bloque 3.

/** Same pointer-sequence approach as dragWorkItemToColumn in helpers.ts — dnd-kit ignores native HTML5 drag events. */
async function dragColumn(page: import("@playwright/test").Page, columnName: string, targetColumnName: string) {
  const source = stageColumn(page, columnName);
  const target = stageColumn(page, targetColumnName);

  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Could not locate drag source/target.");

  await pointerDrag(page, { x: from.x + from.width / 2, y: from.y + 15 }, { x: to.x + to.width / 2, y: to.y + 15 });
}

test.describe("Kanban board", () => {
  test("a new project's board starts with no columns, and one can be added", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");

    // FR-010 of 003-kanban-board
    await expect(page.getByRole("button", { name: "+ Add column" })).toBeVisible();
    await expect(page.locator("h3")).toHaveCount(0);

    // Rejects an empty name.
    await clickUntilVisible(page.getByRole("button", { name: "+ Add column" }), page.getByPlaceholder("Column name"));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();

    // Accepts a real name.
    await page.getByPlaceholder("Column name").fill("To do");
    await page.getByRole("button", { name: "Add", exact: true }).click();
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

    const busyColumn = stageColumn(page, "Busy column");
    await busyColumn.getByRole("button", { name: "Delete column" }).click();
    await expect(page.getByText(/move or delete/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Busy column", level: 3 })).toBeVisible();

    const emptyColumn = stageColumn(page, "Empty column");
    await emptyColumn.getByRole("button", { name: "Delete column" }).click();
    await expect(page.getByRole("heading", { name: "Empty column", level: 3 })).toBeHidden();
  });

  // Historia 5 de 003-kanban-board (T110).
  test("renames a column via double-click, and the new name shows for everyone", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "Old column name");

    await page.getByRole("heading", { name: "Old column name", level: 3 }).dblclick();
    // Scoped to the column: the sidebar's project search is a textbox too.
    const input = page.locator('[data-testid="stage-column"]').getByRole("textbox");
    await input.fill("New column name");
    await input.press("Enter");

    await expect(page.getByRole("heading", { name: "New column name", level: 3 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "New column name", level: 3 })).toBeVisible();
  });

  test("offers visible controls to rename and move without dragging", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Accessible board");
    await addColumn(page, "To do");
    await addColumn(page, "Doing");
    await addWorkItem(page, "Review the layout");

    await page.getByRole("button", { name: "Rename column To do" }).click();
    await page.getByRole("textbox", { name: "Column name for To do" }).fill("Ready");
    await page.getByRole("textbox", { name: "Column name for To do" }).press("Enter");
    await expect(page.getByRole("heading", { name: "Ready", level: 3 })).toBeVisible();

    // Desktop moves cards by dragging, so the column picker only shows on phones.
    const card = page.locator('[data-testid="work-item-card"]', { hasText: "Review the layout" });
    const columnPicker = card.getByRole("combobox", { name: /Move .* to column/ });
    await expect(columnPicker).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await columnPicker.selectOption({ label: "Doing" });
    await expect(stageColumn(page, "Doing").getByTestId("work-item-card")).toContainText("Review the layout");
  });

  test("keeps the board usable with the mobile project drawer", async ({ page }) => {
    // Set up at desktop width — on a phone the sidebar (and its "New project") lives in the drawer.
    await signUpNewUser(page);
    await createProjectViaUi(page, "Mobile board");
    await addColumn(page, "To do");
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(page.getByRole("heading", { name: "Mobile board", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Open projects" }).click();
    const drawer = page.getByRole("dialog", { name: "Projects" });
    await expect(drawer.getByRole("link", { name: "Mobile board" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close projects" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { name: "To do", level: 3 })).toBeVisible();
  });
});

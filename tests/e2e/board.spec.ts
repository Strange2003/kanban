import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi } from "./helpers";

// quickstart.md bloque 3.

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
});

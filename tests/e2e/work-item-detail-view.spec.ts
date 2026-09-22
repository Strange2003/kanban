import { test, expect, type Page } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  selectRelationOption,
  clickUntilVisible,
  openCard,
  backToBoard,
} from "./helpers";

async function addColumn(page: Page, name: string) {
  await page.getByRole("button", { name: "+ Add column" }).click();
  await page.getByPlaceholder("Column name").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
}

async function addWorkItem(page: Page, title: string) {
  await page.getByRole("button", { name: "+ Add work item" }).first().click();
  await page.getByPlaceholder("Title").fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator('[data-testid="work-item-card"]', { hasText: title })).toBeVisible();
}

test.describe("Work Item Detail View", () => {
  // quickstart.md bloque 1.
  test("opens a Work Item in its own page, with a reloadable URL and a way back to the board", async ({ page }) => {
    await signUpNewUser(page);
    const boardUrl = await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Design login");

    await openCard(page, "Design login");
    await expect(page).toHaveURL(/\/work-items\/1$/);
    await expect(page.getByRole("heading", { name: /-1$/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /-1$/ })).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Design login");

    await backToBoard(page);
    await expect(page).toHaveURL(boardUrl);
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design login" })).toBeVisible();
  });

  // quickstart.md bloque 2.
  test("edits fields from the detail view, persisting across reload and back on the board", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Design login");

    await openCard(page, "Design login");
    await page.getByLabel("Description", { exact: true }).fill("Match the new brand colors.");
    await page.getByPlaceholder("Add a tag...").fill("urgent");
    await page.getByRole("button", { name: 'Create "urgent"' }).click();
    await page.getByRole("button", { name: "Save" }).click();
    // Wait for the save's round-trip (button re-enabled) *and* for the
    // background router.refresh() it triggers to settle, or reloading can
    // race a second request against the dev server while that one is still
    // in flight.
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Match the new brand colors.");

    await backToBoard(page);
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design login" })).toBeVisible();
  });

  // quickstart.md bloque 3.
  test("navigates between related Work Items with real URLs, and the browser back button works", async ({
    page,
  }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Design login");
    await addWorkItem(page, "Implement form");

    await openCard(page, "Design login");
    await selectRelationOption(page, "Convert into a child of", "Implement form");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByRole("link", { name: /Implement form/ })).toBeVisible({ timeout: 15000 });

    await page.getByRole("link", { name: /Implement form/ }).click();
    await expect(page).toHaveURL(/\/work-items\/2$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/work-items\/1$/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Design login");
  });

  // quickstart.md bloque 4.
  test("shows the activity log for a Work Item", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Design login");

    await openCard(page, "Design login");
    await page.getByLabel("Description", { exact: true }).fill("Match the new brand colors.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByText(/edited description/i)).toBeVisible();
  });

  // quickstart.md, edge case 1.
  test("shows a clear not-found state, with a way back, for a deleted Work Item's URL", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Temporary item");

    await openCard(page, "Temporary item");
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    const detailUrl = page.url();
    await clickUntilVisible(
      page.getByRole("button", { name: "Delete", exact: true }),
      page.getByRole("button", { name: "Confirm" }),
    );
    await page.getByRole("button", { name: "Confirm" }).click();
    // Wait for the delete + redirect back to the board to actually land
    // before navigating to the now-stale URL, or the goto below can race
    // ahead of the deletion actually committing.
    await expect(page).toHaveURL(/\/projects\/[^/]+$/);

    // A plain goto() to a URL still in this tab's history can occasionally
    // resolve to a cached render of the page from before the deletion
    // (browser-level, not app-level) — force a real reload past that.
    await page.goto(detailUrl);
    await page.reload();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await backToBoard(page);
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Temporary item" })).toBeHidden();
  });

  // quickstart.md, edge case 2.
  test("denies access to a Work Item's URL for a non-member", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");
    await addWorkItem(page, "Design login");
    await openCard(page, "Design login");
    const detailUrl = page.url();

    // A second, unrelated account never joined this project. It must never
    // reach the actual detail form (Next's generic 404 boundary and this
    // feature's own "could not be found" state both contain similar text,
    // so the unambiguous check is that the form itself never renders).
    await signUpNewUser(page);
    await page.goto(detailUrl);
    await expect(page.getByLabel("Title", { exact: true })).toBeHidden();
  });
});

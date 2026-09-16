import { expect, type Page } from "@playwright/test";

let counter = 0;

/** Registers a fresh account via email/password and leaves `page` signed in. Returns its email. */
export async function signUpNewUser(page: Page, namePrefix = "Test User"): Promise<string> {
  counter += 1;
  const email = `test-${Date.now()}-${counter}@example.com`;
  const password = "correct-horse-battery-staple";

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(namePrefix);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");

  return email;
}

/** Creates a project from the sidebar dialog and waits for the board to load. Returns its URL. */
export async function createProjectViaUi(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  return page.url();
}

/**
 * dnd-kit listens for pointer events, not native HTML5 drag events, so
 * Playwright's `locator.dragTo()` (which dispatches dragstart/drop) doesn't
 * trigger it — simulate the pointer sequence by hand instead.
 */
export async function dragWorkItemToColumn(page: Page, workItemTitle: string, columnName: string) {
  const card = page.locator('[data-testid="work-item-card"]', { hasText: workItemTitle });
  const column = page.locator('[data-testid="stage-column"]', { hasText: columnName });

  const from = await card.boundingBox();
  const to = await column.boundingBox();
  if (!from || !to) throw new Error("Could not locate drag source/target.");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

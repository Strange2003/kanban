import { expect, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";

let counter = 0;

/**
 * Registers a fresh account via email/password and leaves `page` signed in.
 * Returns its email.
 *
 * `requireEmailVerification: true` (FR-015 of 001-accounts-invitations)
 * means sign-up alone doesn't create a session — there's no real inbox in
 * this suite, so mark the account verified directly in the DB (exactly what
 * following the emailed link would flip) before signing in for real.
 */
export async function signUpNewUser(page: Page, namePrefix = "Test User"): Promise<string> {
  counter += 1;
  const email = `test-${Date.now()}-${counter}@example.com`;
  const password = "correct-horse-battery-staple";

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(namePrefix);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Creating account..." })).toBeHidden();

  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
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
 * Clicks `trigger` and waits for `target` to appear, retrying the click a
 * few times if it doesn't — a plain click can land microseconds before a
 * freshly client-navigated page finishes attaching React's event handler to
 * that exact node (the click fires on the DOM element, but nothing is
 * listening yet), silently swallowing the first click. Re-clicking is safe
 * here because every caller only uses this for idempotent state toggles
 * (e.g. opening a delete confirmation), never for a create/submit action.
 */
export async function clickUntilVisible(trigger: Locator, target: Locator, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await trigger.click();
    try {
      await target.waitFor({ state: "visible", timeout: 2000 });
      return;
    } catch {
      if (attempt === attempts) throw new Error(`"${target}" never became visible after ${attempts} clicks.`);
    }
  }
}

/**
 * Opens a Work Item card's dedicated detail view (006-work-item-detail-view)
 * by title, retrying the click if the URL doesn't change — a plain click()
 * can land microseconds before React finishes attaching the card's
 * `onClick` handler after it renders, silently losing the click and leaving
 * the caller stuck on the board (where a loosely-matched "Delete" button
 * would actually be the unrelated "Delete column" one — a confusing failure
 * mode if this isn't retried here).
 */
export async function openCard(page: Page, title: string) {
  const card = page.locator('[data-testid="work-item-card"]', { hasText: title });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await card.click();
    try {
      await page.waitForURL(/\/work-items\/\d+$/, { timeout: 2000 });
      return;
    } catch {
      if (attempt === 3) throw new Error(`Clicking the "${title}" card never navigated to its detail view.`);
    }
  }
}

/** Same hydration-timing retry as `openCard`, for the detail view's "Back to board" link. */
export async function backToBoard(page: Page) {
  const link = page.getByRole("link", { name: "Back to board" });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await link.click();
    try {
      await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 2000 });
      return;
    } catch {
      if (attempt === 3) throw new Error('Clicking "Back to board" never navigated back to the board.');
    }
  }
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

/**
 * Picks the option whose visible text contains `workItemTitle` in a
 * relations `<select>` (005-work-item-relationships) — options are labeled
 * `"<displayId> <title>"`, and the displayId prefix can vary between test
 * runs when several projects share a name (collision suffix, see
 * research.md § Identificadores públicos of 001), so selecting by title
 * substring instead of by the full label is what stays reliable.
 */
export async function selectRelationOption(scope: Page | Locator, selectLabel: string | RegExp, workItemTitle: string) {
  const select = scope.getByLabel(selectLabel);
  const value = await select.locator("option", { hasText: workItemTitle }).getAttribute("value");
  if (!value) throw new Error(`No option for "${workItemTitle}" found in the "${selectLabel}" select.`);
  await select.selectOption(value);
}

/** Drags one Work Item card onto another, for within-column reordering (FR-006 of 004-work-items). */
export async function dragWorkItemOntoWorkItem(page: Page, sourceTitle: string, targetTitle: string) {
  const source = page.locator('[data-testid="work-item-card"]', { hasText: sourceTitle });
  const target = page.locator('[data-testid="work-item-card"]', { hasText: targetTitle });

  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Could not locate drag source/target.");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

/**
 * Makes `inviteePage`'s account (already signed up as `inviteeEmail`) a member
 * of the project at `projectUrl`, through the real UI on both sides — the
 * owner sends an invitation from Settings and the invitee accepts it from the
 * notifications panel (same flow as tests/e2e/invitations.spec.ts). Leaves
 * `ownerPage` on the project's settings page. `role` is the one the inviter picks in the
 * invitation dialog (007-roles-permissions).
 */
export async function inviteAndAccept(
  ownerPage: Page,
  inviteePage: Page,
  projectUrl: string,
  inviteeEmail: string,
  role: "member" | "viewer" = "member",
) {
  await ownerPage.goto(`${projectUrl}/settings`);
  await ownerPage.getByRole("button", { name: "Invite" }).click();
  await ownerPage.getByLabel("Email").fill(inviteeEmail);
  // `exact`: the settings page behind the dialog also has "Role of <name>" selectors.
  await ownerPage.getByLabel("Role", { exact: true }).selectOption(role);
  await ownerPage.getByRole("button", { name: "Send invitation" }).click();
  await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();
  await ownerPage.getByRole("button", { name: "Close" }).click();

  await inviteePage.goto("/");
  await inviteePage.getByRole("button", { name: "Notifications" }).click();
  await inviteePage.getByRole("button", { name: "Accept" }).click();
  await expect(inviteePage.getByRole("button", { name: "Accept" })).toBeHidden();

  await ownerPage.reload();
}

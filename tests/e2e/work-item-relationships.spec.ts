import { test, expect, type Page } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  selectRelationOption,
  openCard,
  backToBoard,
  clickUntilVisible,
  clickLinkUntilUrl,
  addColumn,
  addWorkItem,
} from "./helpers";

// As of 006-work-item-detail-view, opening a Work Item navigates to its own
// dedicated page instead of a modal — these tests interact with `page`
// directly, with no dialog scoping needed anymore.
//
// Assertions right after a Set/Link/Confirm click use a generous explicit
// timeout instead of `clickUntilVisible`: those buttons call a real Server
// Action and disable themselves while it's in flight (`relationsBusy`), so
// re-clicking would just block on the disabled button until the first call
// resolves anyway — the fix for a slow round trip is patience, not a retry
// that could double-submit a non-idempotent request.
const LONG_TIMEOUT = 15000;

test.describe("Work Item Relationships", () => {
  // quickstart.md bloque 1.
  test("links a parent/child chain across levels, and rejects a cycle", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await addWorkItem(page, "Design login");
    await addWorkItem(page, "Implement form");
    await addWorkItem(page, "Write login tests");

    // "Implement form" becomes a child of "Design login".
    await openCard(page, "Implement form");
    await selectRelationOption(page, "Convert into a child of", "Design login");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    // FR-002: once it has a parent, the picker to set another one is gone.
    await expect(page.getByLabel("Convert into a child of")).toBeHidden();
    await backToBoard(page);

    // "Write login tests" becomes a child of "Implement form" — a 3-level
    // chain (anidación arbitraria, clarified in spec.md).
    await openCard(page, "Write login tests");
    await selectRelationOption(page, "Convert into a child of", "Implement form");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByRole("link", { name: /Implement form/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    // Closing the cycle: "Design login" (the root, still parentless) tries
    // to become a child of "Write login tests" (its own descendant).
    await openCard(page, "Design login");
    await selectRelationOption(page, "Convert into a child of", "Write login tests");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByText(/cycle/i)).toBeVisible({ timeout: LONG_TIMEOUT });
    await expect(page.getByLabel("Convert into a child of")).toBeVisible();
  });

  // quickstart.md bloque 2.
  test("links two Work Items as related symmetrically, without duplicating the link", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await addWorkItem(page, "Design login");
    await addWorkItem(page, "Document login API");

    await openCard(page, "Document login API");
    await selectRelationOption(page, "Relate to", "Design login");
    await page.getByRole("button", { name: "Link" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    // Repeating the same pair (fresh page visit) must not duplicate it.
    await openCard(page, "Document login API");
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible();
    await selectRelationOption(page, "Relate to", "Design login");
    await page.getByRole("button", { name: "Link" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("link", { name: /Design login/ })).toHaveCount(1);
    await backToBoard(page);

    // Symmetric: it must also show up from the other side, exactly once.
    await openCard(page, "Design login");
    await expect(page.getByRole("link", { name: /Document login API/ })).toHaveCount(1);
  });

  // quickstart.md bloque 3.
  test("shows a Work Item's parent, children, and related items, each navigable", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await addWorkItem(page, "Design login");
    await addWorkItem(page, "Implement form");
    await addWorkItem(page, "Document login API");
    await addWorkItem(page, "No relations here");

    await openCard(page, "Implement form");
    await selectRelationOption(page, "Convert into a child of", "Design login");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    await openCard(page, "Document login API");
    await selectRelationOption(page, "Relate to", "Design login");
    await page.getByRole("button", { name: "Link" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    await openCard(page, "Design login");
    await expect(page.getByText("Children", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Implement form/ })).toBeVisible();
    await expect(page.getByText("Related", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Document login API/ })).toBeVisible();

    // Navigate from the parent's page straight to its child — a real URL
    // change, not a content swap (006-work-item-detail-view).
    await clickLinkUntilUrl(page.getByRole("link", { name: /Implement form/ }), /\/work-items\/2$/);
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });

    // The browser back button returns to "Design login" (FR-006 of 006).
    await page.goBack();
    await expect(page).toHaveURL(/\/work-items\/1$/);

    await backToBoard(page);
    await openCard(page, "No relations here");
    await expect(page.getByText("No relations yet.")).toBeVisible();
  });

  // quickstart.md bloque 4.
  test("removes a relation without deleting either Work Item, and orphans children when the parent is deleted", async ({
    page,
  }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Tablero Demo");
    await addColumn(page, "To do");

    await addWorkItem(page, "Design login");
    await addWorkItem(page, "Implement form");
    await addWorkItem(page, "Document login API");

    // Related link created and then removed.
    await openCard(page, "Document login API");
    await selectRelationOption(page, "Relate to", "Design login");
    await page.getByRole("button", { name: "Link" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No relations yet.")).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    // Both Work Items are still on the board.
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Document login API" })).toBeVisible();
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design login" })).toBeVisible();

    // Parent/child created, then the parent is deleted entirely.
    await openCard(page, "Implement form");
    await selectRelationOption(page, "Convert into a child of", "Design login");
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByRole("link", { name: /Design login/ })).toBeVisible({ timeout: LONG_TIMEOUT });
    await backToBoard(page);

    await openCard(page, "Design login");
    // Delete → Confirm is a pure local state toggle (no Server Action), so
    // a missing "Confirm" means the click was lost to hydration timing, not
    // a slow request — clickUntilVisible's retry is the right tool here.
    await clickUntilVisible(
      page.getByRole("button", { name: "Delete", exact: true }),
      page.getByRole("button", { name: "Confirm" }),
    );
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.locator('[data-testid="work-item-card"]', { hasText: "Design login" })).toBeHidden({
      timeout: LONG_TIMEOUT,
    });

    // FR-012: the child survives, now without a parent (orphaned).
    await openCard(page, "Implement form");
    await expect(page.getByText("No relations yet.")).toBeVisible();
  });
});

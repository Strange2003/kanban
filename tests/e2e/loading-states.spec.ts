import { test, expect, type Page } from "@playwright/test";
import { signUpNewUser, createProjectViaUi, addColumn, addWorkItem, openCard, clickLinkUntilUrl } from "./helpers";

// quickstart.md of 015-loading-animations. Loading skeletons only show while a
// navigation is slow, which a test can't force against `next dev` without
// touching the app, so these checks watch the DOM during real navigations:
// what the board remembers, which skeleton ever appears, and whether the
// board's entrance animation runs.

/**
 * Starts recording, in the page, every loading skeleton that appears and —
 * when the board's entering container appears — the animation its first card
 * and column header are running at that moment.
 */
async function recordNavigation(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __kb: { skeletons: string[]; landing: string[] } };
    w.__kb = { skeletons: [], landing: [] };
    const scan = (root: Element) => {
      for (const el of root.querySelectorAll('[role="status"][aria-busy="true"]')) {
        const label = el.getAttribute("aria-label") ?? "";
        if (!w.__kb.skeletons.includes(label)) w.__kb.skeletons.push(label);
      }
      const entering = root.querySelector(".kb-board-entering");
      if (entering && w.__kb.landing.length === 0) {
        for (const el of entering.querySelectorAll("[data-kb-land]")) w.__kb.landing.push(getComputedStyle(el).animationName);
      }
    };
    new MutationObserver(() => scan(document.body)).observe(document.body, { childList: true, subtree: true });
  });
}

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __kb: { skeletons: string[]; landing: string[] } }).__kb);

async function boardWithFiveColumns(page: Page) {
  await signUpNewUser(page, "Loading Tester");
  const url = await createProjectViaUi(page, "Five columns");
  for (const name of ["Backlog", "To do", "Doing", "Review", "Done"]) await addColumn(page, name);
  await addWorkItem(page, "First card");
  return new URL(url).pathname;
}

test("the board remembers its column count for its loading skeleton", async ({ page }) => {
  const path = await boardWithFiveColumns(page);
  const publicId = path.split("/").pop();
  await expect
    .poll(() => page.evaluate((id) => localStorage.getItem(`kanban:board-columns:${id}`), publicId))
    .toBe("5");
});

test("the board lands once on arrival, and only the detail's own skeleton shows when opening a Work Item", async ({
  page,
}) => {
  const path = await boardWithFiveColumns(page);

  // Arriving from another page: the cards and headers run the landing animation.
  await clickLinkUntilUrl(page.getByRole("link", { name: "My work" }), /\/my-work$/);
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await recordNavigation(page);
  await clickLinkUntilUrl(page.getByRole("link", { name: "Five columns" }), new RegExp(`${path}$`));
  await expect(page.getByTestId("work-item-card")).toBeVisible();
  const arrival = await recorded(page);
  expect(arrival.landing.length).toBeGreaterThan(0);
  expect(new Set(arrival.landing)).toEqual(new Set(["kb-land"]));
  expect(arrival.skeletons.every((s) => s === "Loading board…")).toBe(true);

  // Once settled, a new card doesn't replay it.
  await expect(page.locator(".kb-board-entering")).toHaveCount(0);
  await addWorkItem(page, "Second card");
  const second = page.locator('[data-testid="work-item-card"]', { hasText: "Second card" });
  expect(await second.evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName))).not.toContain(
    "kb-land",
  );

  // Opening a Work Item never shows the board's skeleton (the reported bug).
  await recordNavigation(page);
  await openCard(page, "First card");
  await expect(page.getByLabel("Title")).toHaveValue("First card");
  const detail = await recorded(page);
  expect(detail.skeletons).not.toContain("Loading board…");
  expect(detail.skeletons.every((s) => s === "Loading Work Item…")).toBe(true);
});

test("with reduced motion the board appears without landing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const path = await boardWithFiveColumns(page);

  await clickLinkUntilUrl(page.getByRole("link", { name: "My work" }), /\/my-work$/);
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await recordNavigation(page);
  await clickLinkUntilUrl(page.getByRole("link", { name: "Five columns" }), new RegExp(`${path}$`));
  await expect(page.getByTestId("work-item-card")).toBeVisible();
  const arrival = await recorded(page);
  expect(arrival.landing.length).toBeGreaterThan(0);
  expect(new Set(arrival.landing)).toEqual(new Set(["none"]));
});

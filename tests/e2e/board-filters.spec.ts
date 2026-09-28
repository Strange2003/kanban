import { test, expect, type Page } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { projects, tags, workItems, workItemTags } from "@/db/schema";
import {
  signUpNewUser,
  createProjectViaUi,
  addColumn,
  addWorkItem,
  openCard,
  inviteAndAccept,
  stageColumn,
} from "./helpers";

// quickstart.md of 014-board-filters-mcp-catalogs, blocks 2 to 4.

const card = (page: Page, title: string) => page.locator('[data-testid="work-item-card"]', { hasText: title });
const visibleTitles = async (page: Page) =>
  (await page.getByTestId("work-item-card").locator("p.font-medium").allInnerTexts()).map((t) => t.trim());

async function pick(page: Page, filter: "Assignee" | "Tags", option: string) {
  const bar = page.getByTestId("board-filters");
  const panel = bar.getByRole("group", { name: `${filter} filter` });
  // Re-open until React has hydrated the button (same race as helpers' clickUntilVisible).
  await expect(async () => {
    if (!(await panel.isVisible())) await bar.getByRole("button", { name: new RegExp(`^${filter}`) }).click();
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass();
  await panel.getByLabel(option, { exact: true }).check();
  await page.keyboard.press("Escape");
}

/**
 * The board of one user with four Work Items in "To do", seeded straight into
 * the database (the UI paths for tags and assignees are covered by 011/013):
 *   Mine UI (me, UI) · Mine bug (me, Bug) · Loose bug (—, Bug) · Plain (—, —)
 * Tags UI (pink) and Bug (red), in that manual order.
 */
async function seedBoard(page: Page) {
  const email = await signUpNewUser(page, "Filter Owner");
  const projectUrl = await createProjectViaUi(page, "Filters Project");
  await addColumn(page, "To do");
  await addColumn(page, "Done");
  for (const title of ["Mine UI", "Mine bug", "Loose bug", "Plain"]) await addWorkItem(page, title);

  const publicId = projectUrl.split("/projects/")[1]!.split(/[?#/]/)[0]!;
  const [project] = await db.select().from(projects).where(eq(projects.publicId, publicId));
  const [me] = await db.select().from(user).where(eq(user.email, email));
  const created = await db
    .insert(tags)
    .values([
      { projectId: project!.id, name: "UI", color: "pink", position: 0 },
      { projectId: project!.id, name: "Bug", color: "red", position: 1 },
    ])
    .returning();
  const tagId = Object.fromEntries(created.map((t) => [t.name, t.id]));
  const items = await db.select().from(workItems).where(eq(workItems.projectId, project!.id));
  const idOf = (title: string) => items.find((wi) => wi.title === title)!.id;
  await db
    .update(workItems)
    .set({ assigneeUserId: me!.id })
    .where(and(eq(workItems.projectId, project!.id), inArray(workItems.id, [idOf("Mine UI"), idOf("Mine bug")])));
  await db.insert(workItemTags).values([
    { workItemId: idOf("Mine UI"), tagId: tagId.UI! },
    { workItemId: idOf("Mine bug"), tagId: tagId.Bug! },
    { workItemId: idOf("Loose bug"), tagId: tagId.Bug! },
  ]);
  await page.reload();
  return { projectUrl, email };
}

test.describe("Board filters (US1)", () => {
  test("filters by assignee and tags, with OR inside a filter and AND between them", async ({ page }) => {
    const { projectUrl } = await seedBoard(page);

    // The Tags panel lists the catalog in its manual order, with "None" last (FR-003).
    const bar = page.getByTestId("board-filters");
    await bar.getByRole("button", { name: /^Tags/ }).click();
    await expect(bar.getByRole("group", { name: "Tags filter" }).locator("label")).toHaveText(["UI", "Bug", "None"]);
    await page.keyboard.press("Escape");
    // The Assignee panel has "Assigned to me", each member and "Unassigned" (FR-002).
    await bar.getByRole("button", { name: /^Assignee/ }).click();
    await expect(bar.getByRole("group", { name: "Assignee filter" }).locator("label")).toHaveText([
      "Assigned to me",
      "Filter Owner",
      "Unassigned",
    ]);
    await page.keyboard.press("Escape");

    await pick(page, "Assignee", "Assigned to me");
    await expect(page).toHaveURL(/assignee=me/);
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI", "Mine bug"]);
    // Counts show visible/total; an emptied column stays and says why (FR-005, FR-006).
    await expect(stageColumn(page, "To do").getByTestId("stage-count")).toHaveText("2/4");
    await expect(stageColumn(page, "Done")).toBeVisible();

    await pick(page, "Tags", "Bug");
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine bug"]);

    // OR inside the Assignee filter: me or unassigned.
    await pick(page, "Assignee", "Unassigned");
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine bug", "Loose bug"]);

    await bar.getByRole("button", { name: "Remove Tag: Bug filter" }).click();
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI", "Mine bug", "Loose bug", "Plain"]);
    await pick(page, "Tags", "None");
    await expect.poll(() => visibleTitles(page)).toEqual(["Plain"]);

    await bar.getByRole("button", { name: "Clear filters" }).click();
    await expect.poll(() => visibleTitles(page)).toHaveLength(4);
    await expect(page).toHaveURL(new RegExp(`${projectUrl.split("?")[0]}$`));
  });

  test("a Viewer can filter too (FR-007)", async ({ page, browser }) => {
    const { projectUrl } = await seedBoard(page);
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    const viewerEmail = await signUpNewUser(viewerPage, "Filter Viewer");
    await inviteAndAccept(page, viewerPage, projectUrl, viewerEmail, "viewer");

    await viewerPage.goto(projectUrl);
    await pick(viewerPage, "Tags", "UI");
    await expect.poll(() => visibleTitles(viewerPage)).toEqual(["Mine UI"]);
    await viewerContext.close();
  });
});

test.describe("Board filters persist (US2)", () => {
  test("survive a reload, the detail view and a trip through the Table", async ({ page }) => {
    const { projectUrl } = await seedBoard(page);

    await pick(page, "Tags", "UI");
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI"]);
    await page.reload();
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI"]);

    // "Back to board" returns to the filtered board.
    await openCard(page, "Mine UI");
    await expect(async () => {
      await page.getByRole("link", { name: "Back to board" }).click();
      await page.waitForURL(/\/projects\/[^/]+\?tag=UI$/, { timeout: 2000 });
    }).toPass();
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI"]);

    // Board → Table keeps the tag; Table's own filters stay behind on the way back (FR-010).
    await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Table" }).click();
    await expect(page).toHaveURL(/\/table\?tag=UI$/);
    await page.goto(`${projectUrl}/table?tag=UI&priority=high`);
    await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Board" }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\?tag=UI$/);
    await expect.poll(() => visibleTitles(page)).toEqual(["Mine UI"]);

    // A value nobody matches any more doesn't break the board and can be removed (FR-011).
    await page.goto(`${projectUrl}?tag=Gone`);
    await expect.poll(() => visibleTitles(page)).toEqual([]);
    await expect(page.getByTestId("board-no-matches")).toBeVisible();
    await page.getByRole("button", { name: "Remove Tag: Gone filter" }).click();
    await expect.poll(() => visibleTitles(page)).toHaveLength(4);
  });
});

test.describe("Working with an active filter (US3)", () => {
  test("keyboard reorder steps over hidden cards and keeps their order; a hidden new item is announced", async ({
    page,
  }) => {
    await seedBoard(page);
    // To do: Mine UI, Mine bug, Loose bug, Plain. Unassigned shows Loose bug and Plain.
    await pick(page, "Assignee", "Unassigned");
    await expect.poll(() => visibleTitles(page)).toEqual(["Loose bug", "Plain"]);

    await card(page, "Plain").getByRole("button", { name: /Move .* up/ }).click();
    await expect.poll(() => visibleTitles(page)).toEqual(["Plain", "Loose bug"]);

    // The hidden cards kept their relative order (SC-004). The move is optimistic: reload until saved.
    await page.getByTestId("board-filters").getByRole("button", { name: "Clear filters" }).click();
    await expect(async () => {
      await page.reload();
      expect(await visibleTitles(page)).toEqual(["Mine UI", "Mine bug", "Plain", "Loose bug"]);
    }).toPass();

    // A new Work Item has no tags: with a tag filter on it's hidden, and the board says so (FR-014).
    await pick(page, "Tags", "Bug");
    const addButton = stageColumn(page, "To do").getByRole("button", { name: "+ Add work item" });
    await expect(async () => {
      await addButton.click();
      await expect(page.getByPlaceholder("Title")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByPlaceholder("Title").fill("Fresh one");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/was created but is hidden by the active filters/)).toBeVisible();
    await expect(card(page, "Fresh one")).toHaveCount(0);
  });
});

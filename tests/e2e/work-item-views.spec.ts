import { test, expect, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { iterations, projects, stages, workItems } from "@/db/schema";
import { signUpNewUser, createProjectViaUi, addColumn, addWorkItem, inviteAndAccept } from "./helpers";

// quickstart.md of 009-work-item-views. Projects, columns and Work Items are
// created through the UI; their 008 fields and parent links are then set
// straight in the (disposable) test database so each test stays fast and
// focused on the views themselves.

const views = (page: Page) => page.getByRole("navigation", { name: "Views" });
const tableRows = (page: Page) => page.getByTestId("table-row");
const sortHeader = (page: Page, name: string) => page.locator("thead").getByRole("button", { name });
const firstCells = async (page: Page) => (await tableRows(page).locator("td:nth-child(2)").allInnerTexts()).map((t) => t.trim());

function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function projectOf(projectUrl: string) {
  const publicId = projectUrl.split("/projects/")[1]!;
  const [project] = await db.select().from(projects).where(eq(projects.publicId, publicId));
  return project!;
}

/** Sets 008 fields / the parent of a Work Item by title, directly in the test DB. */
async function setFields(projectUrl: string, title: string, fields: Partial<typeof workItems.$inferInsert>) {
  const project = await projectOf(projectUrl);
  await db
    .update(workItems)
    .set(fields)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.title, title)));
  return project;
}

async function idOf(projectId: number, title: string) {
  const [row] = await db
    .select({ id: workItems.id })
    .from(workItems)
    .where(and(eq(workItems.projectId, projectId), eq(workItems.title, title)));
  return row!.id;
}

test.describe("Views — switching between board, list and table (US1)", () => {
  // quickstart.md bloques 1 y 5.
  test("switches views, keeps them on reload and back, and hides them from non-members", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const strangerContext = await browser.newContext();
    const page = await ownerContext.newPage();
    const stranger = await strangerContext.newPage();

    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Views Project");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Write docs");

    await expect(views(page).getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
    await views(page).getByRole("link", { name: "Table" }).click();
    await expect(page).toHaveURL(`${projectUrl}/table`);
    await expect(views(page).getByRole("link", { name: "Table" })).toHaveAttribute("aria-current", "page");
    await expect(tableRows(page)).toHaveCount(1);

    await page.reload();
    await expect(tableRows(page)).toHaveCount(1);

    // Open a Work Item from the table, then back to the table.
    await page.getByRole("link", { name: "Write docs" }).click();
    await page.waitForURL(/\/work-items\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(`${projectUrl}/table`);

    await views(page).getByRole("link", { name: "List" }).click();
    await expect(page).toHaveURL(`${projectUrl}/list`);
    await expect(page.getByTestId("list-item")).toHaveCount(1);

    // A non-member gets the same not-found as for the board (FR-004, SC-004).
    await signUpNewUser(stranger);
    for (const path of ["table", "list"]) {
      await stranger.goto(`${projectUrl}/${path}`);
      await expect(stranger.getByText(/not found|could not be found|404/i).first()).toBeVisible();
      await expect(stranger.getByText("Write docs")).toHaveCount(0);
    }

    await ownerContext.close();
    await strangerContext.close();
  });
});

test.describe("Views — sortable, filterable table (US2)", () => {
  // quickstart.md bloques 2 y 4.
  test("sorts, filters, counts, keeps the query in the address and on back, and works for a Viewer", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();
    const page = await ownerContext.newPage();
    const viewerPage = await viewerContext.newPage();

    await signUpNewUser(page, "Owner");
    const projectUrl = await createProjectViaUi(page, "Table Project");
    await addColumn(page, "To Do");
    await addColumn(page, "Doing");
    await addColumn(page, "Done");
    for (const title of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]) await addWorkItem(page, title);

    const project = await setFields(projectUrl, "Alpha", { priority: "low" });
    const [sprint] = await db.insert(iterations).values({ projectId: project.id, name: "Sprint 12" }).returning();
    const stageRows = await db.select().from(stages).where(eq(stages.projectId, project.id));
    const done = stageRows.find((s) => s.name === "Done")!;
    const doing = stageRows.find((s) => s.name === "Doing")!;
    await db.update(stages).set({ isClosing: true }).where(eq(stages.id, done.id));
    await setFields(projectUrl, "Bravo", { priority: "critical", iterationId: sprint!.id });
    await setFields(projectUrl, "Charlie", { priority: "critical", stageId: done.id, closedAt: new Date() });
    await setFields(projectUrl, "Delta", { targetDate: localDate(-1), stageId: doing.id });
    await setFields(projectUrl, "Echo", { priority: "high", iterationId: sprint!.id });

    await page.goto(`${projectUrl}/table`);
    await expect(tableRows(page)).toHaveCount(5);

    // Priority ascending: Critical, Critical, High, Low, then the empty one last.
    await sortHeader(page, "Priority").click();
    await expect.poll(() => firstCells(page)).toEqual(["Bravo", "Charlie", "Echo", "Alpha", "Delta"]);
    // Descending keeps the empty one last.
    await sortHeader(page, "Priority").click();
    await expect.poll(() => firstCells(page)).toEqual(["Alpha", "Echo", "Bravo", "Charlie", "Delta"]);
    await expect(page.locator("th[aria-sort='descending']")).toContainText("Priority");

    // Column follows the board's order (To Do, Doing, Done), not the alphabet.
    await sortHeader(page, "Column").click();
    await expect.poll(() => firstCells(page)).toEqual(["Alpha", "Bravo", "Echo", "Delta", "Charlie"]);

    // Open + Critical + Sprint 12 → only Bravo, and the count says so.
    await page.getByLabel("Status").selectOption("open");
    await page.getByTestId("view-filters").getByRole("button", { name: /^Priority/ }).click();
    await page.getByRole("group", { name: "Priority filter" }).getByLabel("Critical").check();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /More filters/ }).click();
    await page.getByTestId("view-filters").getByRole("button", { name: /^Iteration/ }).click();
    await page.getByRole("group", { name: "Iteration filter" }).getByLabel("Sprint 12").check();
    await page.keyboard.press("Escape");
    await expect.poll(() => firstCells(page)).toEqual(["Bravo"]);
    await expect(page.getByTestId("view-count")).toHaveText("1 of 5");

    // The address carries the query: reload keeps it, and so does "back" from the detail.
    await page.reload();
    await expect.poll(() => firstCells(page)).toEqual(["Bravo"]);
    const filteredUrl = page.url();
    expect(filteredUrl).toContain("status=open");
    await page.getByRole("link", { name: "Bravo" }).click();
    await page.waitForURL(/\/work-items\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(filteredUrl);
    await expect.poll(() => firstCells(page)).toEqual(["Bravo"]);

    // Overdue only → just Delta, with the same overdue mark as the board.
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(tableRows(page)).toHaveCount(5);
    await page.getByLabel("Overdue only").check();
    await expect.poll(() => firstCells(page)).toEqual(["Delta"]);
    await expect(tableRows(page).first().getByTestId("target-date-chip")).toHaveAttribute("data-overdue", "true");

    // Search by display id, lower-case.
    await page.getByLabel("Overdue only").uncheck();
    const deltaId = (await tableRows(page).filter({ hasText: "Delta" }).locator("td").first().innerText()).trim();
    await page.getByLabel("Search Work Items").fill(deltaId.toLowerCase());
    await expect.poll(() => firstCells(page)).toEqual(["Delta"]);

    // No matches → empty state with a way out.
    await page.getByLabel("Search Work Items").fill("zzz-nothing");
    await expect(page.getByTestId("table-no-results")).toBeVisible();
    await page.getByTestId("table-no-results").getByRole("button", { name: "Clear filters" }).click();
    await expect(tableRows(page)).toHaveCount(5);

    // Read only (FR-011): no inputs in the table body.
    await expect(page.getByTestId("work-items-table").locator("tbody input, tbody select")).toHaveCount(0);

    // A Viewer uses the table too, with the read-only notice.
    const viewerEmail = await signUpNewUser(viewerPage, "Carla");
    await inviteAndAccept(page, viewerPage, projectUrl, viewerEmail, "viewer");
    await viewerPage.goto(`${projectUrl}/table?status=closed`);
    await expect.poll(() => firstCells(viewerPage)).toEqual(["Charlie"]);
    await expect(viewerPage.getByText(/read-only for you/)).toBeVisible();

    await ownerContext.close();
    await viewerContext.close();
  });
});

test.describe("Views — hierarchical list (US3)", () => {
  // quickstart.md bloque 3.
  test("nests children at any depth, collapses, and shows filtered matches with their ancestors", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "List Project");
    await addColumn(page, "To Do");
    for (const title of ["Epic", "Child B", "Child A", "Loose", "Grandchild"]) await addWorkItem(page, title);

    const project = await projectOf(projectUrl);
    const epic = await idOf(project.id, "Epic");
    const childA = await idOf(project.id, "Child A");
    await setFields(projectUrl, "Child A", { parentWorkItemId: epic });
    await setFields(projectUrl, "Child B", { parentWorkItemId: epic });
    await setFields(projectUrl, "Grandchild", { parentWorkItemId: childA });

    await page.goto(`${projectUrl}/list`);
    // Each treeitem is named "<ID> <title>" (its own row, not its nested children).
    const item = (title: string) => page.getByRole("treeitem", { name: new RegExp(`^\\S+ ${title}$`) });

    // Tree shape: Epic and Loose at level 1; children at 2; grandchild at 3.
    await expect(item("Epic")).toHaveAttribute("aria-level", "1");
    await expect(item("Loose")).toHaveAttribute("aria-level", "1");
    await expect(item("Child A")).toHaveAttribute("aria-level", "2");
    await expect(item("Child B")).toHaveAttribute("aria-level", "2");
    await expect(item("Grandchild")).toHaveAttribute("aria-level", "3");

    // Collapse Epic: its three descendants disappear and it shows 2 direct children.
    const epicId = (await item("Epic").getAttribute("aria-label"))!.split(" ")[0];
    await page.getByRole("button", { name: `Collapse ${epicId}` }).click();
    await expect(page.getByTestId("list-item")).toHaveCount(2);
    await expect(item("Epic").getByTestId("child-count")).toHaveText("2");
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.getByTestId("list-item")).toHaveCount(5);
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.getByTestId("list-item")).toHaveCount(2);
    await page.getByRole("button", { name: "Expand all" }).click();

    // Searching "Grandchild" shows it with Child A and Epic as dimmed context.
    await page.getByLabel("Search Work Items").fill("Grandchild");
    await expect(page.getByTestId("list-item")).toHaveCount(3);
    await expect(item("Epic")).toHaveAttribute("data-context", "true");
    await expect(item("Child A")).toHaveAttribute("data-context", "true");
    await expect(item("Grandchild")).not.toHaveAttribute("data-context");
    await expect(item("Loose")).toHaveCount(0);

    // Switching to the table keeps the search.
    await views(page).getByRole("link", { name: "Table" }).click();
    await expect(page).toHaveURL(/\/table\?q=Grandchild$/);
    await expect.poll(() => firstCells(page)).toEqual(["Grandchild"]);

    // Opening a Work Item from the list still works.
    await views(page).getByRole("link", { name: "List" }).click();
    await page.getByRole("link", { name: "Grandchild", exact: true }).click();
    await page.waitForURL(/\/work-items\/\d+$/);
  });
});


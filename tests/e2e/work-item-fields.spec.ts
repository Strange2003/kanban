import { test, expect, type Page } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  addColumn,
  addWorkItem,
  openCard,
  backToBoard,
  dragWorkItemToColumn,
  inviteAndAccept,
  clickUntilVisible,
  stageColumn,
} from "./helpers";

// quickstart.md of 008-work-item-fields, one describe block per user story.

const card = (page: Page, title: string) => page.locator('[data-testid="work-item-card"]', { hasText: title });
const column = (page: Page, name: string) => stageColumn(page, name);

/** Saves the detail form and waits for the Server Action and the refresh after it. */
async function save(page: Page) {
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

/** The browser's local calendar date `offsetDays` from today, as "YYYY-MM-DD" (Playwright runs in the host's time zone). */
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Toggles a column's closing mark from its header and waits until the badge reflects it. */
async function setClosing(page: Page, columnName: string, closing: boolean) {
  const col = column(page, columnName);
  await col.getByRole("button", { name: closing ? "Mark as closing column" : "Unmark closing column" }).click();
  await expect(col.getByTestId("closing-column-badge")).toHaveCount(closing ? 1 : 0);
  await page.waitForLoadState("networkidle");
}

test.describe("Extended fields — priority and severity (US1)", () => {
  // quickstart.md bloque 1.
  test("sets priority and severity, shows only the priority on the card, and logs both", async ({ page }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Fields Project");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Fix checkout bug");

    await openCard(page, "Fix checkout bug");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Severity").selectOption("medium");
    await save(page);

    await page.reload();
    await expect(page.getByLabel("Priority")).toHaveValue("high");
    await expect(page.getByLabel("Severity")).toHaveValue("medium");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Priority: None → High")).toBeVisible();
    await expect(page.getByText(/Severity: None → Medium/)).toBeVisible();

    await backToBoard(page);
    await expect(card(page, "Fix checkout bug").getByTestId("priority-badge")).toHaveText("High");
    // FR-016: severity stays off the card.
    await expect(card(page, "Fix checkout bug")).not.toContainText("Medium");

    await openCard(page, "Fix checkout bug");
    await page.getByLabel("Priority").selectOption("");
    await page.getByLabel("Severity").selectOption("");
    await save(page);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText(/Priority: High → None/)).toBeVisible();
    await backToBoard(page);
    await expect(card(page, "Fix checkout bug").getByTestId("priority-badge")).toHaveCount(0);
  });
});

test.describe("Extended fields — dates and overdue (US2)", () => {
  // quickstart.md bloque 2.
  test("rejects an inverted range, marks a past target date as overdue, and shows Created/Last modified", async ({
    page,
  }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Dates Project");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Write release notes");

    await openCard(page, "Write release notes");
    await expect(page.getByTestId("dates-section")).toContainText("Created");
    await expect(page.getByTestId("dates-section")).toContainText("Last modified");
    await expect(page.getByTestId("work-item-status")).toHaveText("Open");

    await page.getByLabel("Start date").fill(localDate(5));
    await page.getByLabel("Target date").fill(localDate(2));
    await save(page);
    await expect(page.getByText("The target date can't be before the start date.")).toBeVisible();

    await page.getByLabel("Start date").fill("");
    await page.getByLabel("Target date").fill(localDate(-1));
    await save(page);
    await expect(page.getByTestId("detail-overdue")).toBeVisible();

    await backToBoard(page);
    const chip = card(page, "Write release notes").getByTestId("target-date-chip");
    await expect(chip).toHaveAttribute("data-overdue", "true");
    await expect(chip).toContainText("Overdue");
  });
});

test.describe("Extended fields — closing columns and Close (US3)", () => {
  // quickstart.md bloque 3, pasos 1-6 y 8.
  test("closing follows the column: drag in/out, Close button, (un)marking a column, creating in it", async ({
    page,
  }) => {
    await signUpNewUser(page);
    await createProjectViaUi(page, "Closing Project");
    await addColumn(page, "To Do");
    await addColumn(page, "Doing");
    await addColumn(page, "Done");
    await addWorkItem(page, "Late task");
    await addWorkItem(page, "Button task");

    // 1. No closing column yet: Close is disabled and says why.
    await openCard(page, "Late task");
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeDisabled();
    await expect(page.getByText("Mark a column as a closing column on the board to enable Close.")).toBeVisible();
    await page.getByLabel("Target date").fill(localDate(-1));
    await save(page);
    await backToBoard(page);
    await expect(card(page, "Late task").getByTestId("target-date-chip")).toHaveAttribute("data-overdue", "true");

    // 2. Mark "Done" as closing.
    await setClosing(page, "Done", true);

    // 3. Dragging into Done closes it: the overdue mark goes away at once.
    await dragWorkItemToColumn(page, "Late task", "Done");
    await expect(column(page, "Done")).toContainText("Late task");
    await expect(card(page, "Late task").getByTestId("target-date-chip")).not.toHaveAttribute("data-overdue");
    await openCard(page, "Late task");
    await expect(page.getByTestId("work-item-status")).toContainText("Closed on");
    await expect(page.getByTestId("work-item-status")).toContainText("Done");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Closed (moved to Done)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);

    // 4. Dragging it back out reopens it.
    await backToBoard(page);
    await dragWorkItemToColumn(page, "Late task", "Doing");
    await expect(card(page, "Late task").getByTestId("target-date-chip")).toHaveAttribute("data-overdue", "true");
    await openCard(page, "Late task");
    await expect(page.getByTestId("work-item-status")).toHaveText("Open");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Reopened (moved to Doing)")).toBeVisible();

    // 5. Close from the detail view: ends up in Done, closed.
    await backToBoard(page);
    await openCard(page, "Button task");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByTestId("work-item-status")).toContainText("Closed on");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Closed (moved to Done)")).toBeVisible();
    await backToBoard(page);
    await expect(column(page, "Done")).toContainText("Button task");

    // 6. Marking "Doing" (which holds "Late task") closes it; unmarking reopens it.
    await setClosing(page, "Doing", true);
    await openCard(page, "Late task");
    await expect(page.getByTestId("work-item-status")).toContainText("Closed on");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Closed: column Doing marked as closing")).toBeVisible();
    await backToBoard(page);
    await setClosing(page, "Doing", false);
    await openCard(page, "Late task");
    await expect(page.getByTestId("work-item-status")).toHaveText("Open");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Reopened: column Doing unmarked as closing")).toBeVisible();

    // 8. A Work Item created directly in Done is born closed.
    await backToBoard(page);
    const addInDone = column(page, "Done").getByRole("button", { name: "+ Add work item" });
    await clickUntilVisible(addInDone, page.getByPlaceholder("Title"));
    await page.getByPlaceholder("Title").fill("Born closed");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card(page, "Born closed")).toBeVisible();
    await openCard(page, "Born closed");
    await expect(page.getByTestId("work-item-status")).toContainText("Closed on");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Closed (created in Done)")).toBeVisible();
  });
});

test.describe("Extended fields — area and iteration (US4)", () => {
  // quickstart.md bloques 4 y 5.
  test("creates catalog values inline, reuses them case-insensitively, and keeps projects apart", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Catalog Project");
    await addColumn(page, "To Do");
    await addWorkItem(page, "First item");
    await addWorkItem(page, "Second item");

    await openCard(page, "First item");
    await page.getByLabel("Area", { exact: true }).fill("Frontend");
    await page.getByRole("button", { name: 'Create "Frontend"' }).click();
    await page.getByLabel("Iteration", { exact: true }).fill("Sprint 1");
    await page.getByRole("button", { name: 'Create "Sprint 1"' }).click();
    await save(page);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Area: None → Frontend")).toBeVisible();

    // Suggested in another Work Item of the same project; "FRONTEND" reuses it.
    await backToBoard(page);
    await openCard(page, "Second item");
    await page.getByLabel("Area", { exact: true }).fill("front");
    await expect(page.getByRole("button", { name: "Frontend", exact: true })).toBeVisible();
    await page.getByLabel("Area", { exact: true }).fill("FRONTEND");
    await expect(page.getByRole("button", { name: 'Create "FRONTEND"' })).toHaveCount(0);
    await page.getByLabel("Area", { exact: true }).press("Enter");
    await expect(page.getByRole("button", { name: "Remove area Frontend" })).toBeVisible();
    // Separate catalogs: the iteration "Sprint 1" is not an area.
    await page.getByLabel("Area", { exact: true }).fill("Sprint");
    await expect(page.getByRole("button", { name: "Sprint 1", exact: true })).toHaveCount(0);
    await page.getByLabel("Area", { exact: true }).fill("");
    await save(page);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Area: None → Frontend")).toBeVisible();

    // Removing the area logs it.
    await page.getByRole("tab", { name: "Details" }).click();
    await page.getByRole("button", { name: "Remove area Frontend" }).click();
    await save(page);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Area: Frontend → None")).toBeVisible();

    // Another project never sees this project's values (FR-021).
    await createProjectViaUi(page, "Other Project");
    expect(page.url()).not.toBe(projectUrl);
    await addColumn(page, "To Do");
    await addWorkItem(page, "Elsewhere");
    await openCard(page, "Elsewhere");
    await page.getByLabel("Area", { exact: true }).fill("Front");
    await expect(page.getByRole("button", { name: 'Create "Front"' })).toBeVisible();
    await expect(page.getByRole("button", { name: "Frontend", exact: true })).toHaveCount(0);
  });
});

test.describe("Extended fields — Viewer (FR-019)", () => {
  // quickstart.md bloque 6, pasos 2-3.
  test("a Viewer sees the new fields and closing columns but can't change them or Close", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const viewerPage = await viewerContext.newPage();

    await signUpNewUser(ownerPage, "Owner");
    const projectUrl = await createProjectViaUi(ownerPage, "Viewer Fields");
    await addColumn(ownerPage, "To Do");
    await addColumn(ownerPage, "Done");
    await addWorkItem(ownerPage, "Visible item");
    await setClosing(ownerPage, "Done", true);
    await openCard(ownerPage, "Visible item");
    await ownerPage.getByLabel("Priority").selectOption("critical");
    await ownerPage.getByLabel("Target date").fill(localDate(3));
    await save(ownerPage);

    const viewerEmail = await signUpNewUser(viewerPage, "Carla");
    await inviteAndAccept(ownerPage, viewerPage, projectUrl, viewerEmail, "viewer");

    await viewerPage.goto(projectUrl);
    await expect(card(viewerPage, "Visible item").getByTestId("priority-badge")).toHaveText("Critical");
    await expect(card(viewerPage, "Visible item").getByTestId("target-date-chip")).toBeVisible();
    await expect(column(viewerPage, "Done").getByTestId("closing-column-badge")).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: /closing column/ })).toHaveCount(0);

    await openCard(viewerPage, "Visible item");
    await expect(viewerPage.getByLabel("Priority")).toBeDisabled();
    await expect(viewerPage.getByLabel("Target date")).toBeDisabled();
    await expect(viewerPage.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);
    await expect(viewerPage.getByLabel("Area", { exact: true })).toHaveCount(0);

    await ownerContext.close();
    await viewerContext.close();
  });
});

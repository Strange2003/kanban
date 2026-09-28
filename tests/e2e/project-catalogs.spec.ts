import { test, expect, type Page } from "@playwright/test";
import {
  signUpNewUser,
  createProjectViaUi,
  addColumn,
  addWorkItem,
  openCard,
  backToBoard,
  createFromField,
} from "./helpers";

// quickstart.md of 013-project-catalogs, blocks 1-4 and 6.

const card = (page: Page, title: string) => page.locator('[data-testid="work-item-card"]', { hasText: title });
const section = (page: Page, id: "tags" | "areas" | "sizes") => page.locator(`section#${id}`);
const valueNames = async (page: Page, id: "tags" | "areas" | "sizes") =>
  (await section(page, id).getByTestId("catalog-value").allInnerTexts()).map((t) => t.split("\n")[0]!.trim());
const firstCells = async (page: Page) =>
  (await page.getByTestId("table-row").locator("td:nth-child(2)").allInnerTexts()).map((t) => t.trim());

async function save(page: Page) {
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.waitForLoadState("networkidle");
}

async function addValue(page: Page, id: "tags" | "areas" | "sizes", name: string) {
  const s = section(page, id);
  const add = s.getByRole("button", { name: "Add", exact: true });
  // Re-type until React has hydrated and enabled "Add" (same race as helpers' clickUntilVisible).
  await expect(async () => {
    await s.getByRole("textbox", { name: /^New / }).fill(name);
    await expect(add).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await add.click();
  await expect(s.getByTestId("catalog-value").filter({ hasText: name })).toBeVisible();
}

async function openCatalogs(page: Page) {
  // FR-002: "Tags" nested under the active project in the sidebar.
  await page.getByRole("navigation", { name: "Projects" }).getByRole("link", { name: "Tags" }).click();
  await expect(page).toHaveURL(/\/settings\/catalogs$/);
  await expect(page.getByRole("heading", { name: "Tags", level: 2 })).toBeVisible();
}

test.describe("Project catalogs — manage (US1)", () => {
  test("creates, reorders, renames and deletes values; the order drives the Table", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Catalogs Project");
    await addColumn(page, "To Do");
    for (const title of ["Small one", "Large one", "Big one", "No size"]) await addWorkItem(page, title);

    await openCatalogs(page);
    await expect(page.getByRole("heading", { name: "Areas", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Size", level: 2 })).toBeVisible();

    for (const name of ["S", "M", "XL", "L"]) await addValue(page, "sizes", name);
    await section(page, "sizes").getByRole("button", { name: "Move L up" }).click();
    await expect.poll(() => valueNames(page, "sizes")).toEqual(["S", "M", "L", "XL"]);
    await expect(section(page, "sizes").getByRole("alert")).toHaveCount(0);
    // The move is optimistic, so the save may still be in flight: reload until it shows.
    await expect(async () => {
      await page.reload();
      expect(await valueNames(page, "sizes")).toEqual(["S", "M", "L", "XL"]);
    }).toPass();

    // Duplicate names are rejected on rename (FR-004).
    await addValue(page, "areas", "Front");
    await addValue(page, "areas", "Backend");
    await section(page, "areas").getByRole("button", { name: "Rename Front" }).click();
    await section(page, "areas").getByRole("textbox", { name: "New name for Front" }).fill("backend");
    await section(page, "areas").getByRole("textbox", { name: "New name for Front" }).press("Enter");
    await expect(section(page, "areas").getByRole("alert")).toContainText("already exists");

    // Assign sizes; the Table sorts them by the manual order, empties last (FR-017).
    await page.goto(projectUrl);
    for (const [title, size] of [
      ["Small one", "S"],
      ["Large one", "L"],
      ["Big one", "XL"],
    ] as const) {
      await openCard(page, title);
      // The detail's Size field offers the catalog in its manual order.
      await page.getByLabel("Size", { exact: true }).fill(size);
      await page.getByLabel("Size", { exact: true }).press("Enter");
      await save(page);
      await backToBoard(page);
    }
    await page.goto(`${projectUrl}/table`);
    await page.locator("thead").getByRole("button", { name: "Size" }).click();
    await expect.poll(() => firstCells(page)).toEqual(["Small one", "Large one", "Big one", "No size"]);

    // Deleting a size in use: confirmation with the count, then history (FR-006).
    await page.goto(`${projectUrl}/settings/catalogs`);
    await section(page, "sizes").getByRole("button", { name: "Delete XL" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Used by 1 Work Item");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => valueNames(page, "sizes")).toEqual(["S", "M", "L"]);

    await page.goto(projectUrl);
    await openCard(page, "Big one");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Size: XL → None (value deleted)")).toBeVisible();
  });
});

test.describe("Project catalogs — tag colors (US2)", () => {
  test("shows the tags' colors as a line on the card and as chips in the detail", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Colors Project");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Colorful");
    await addWorkItem(page, "Plain");

    await openCatalogs(page);
    for (const [name, color] of [
      ["Backend", "Blue"],
      ["Bug", "Red"],
      ["UX", "Green"],
    ] as const) {
      await addValue(page, "tags", name);
      await section(page, "tags").getByRole("button", { name: `Change color of ${name}` }).click();
      await section(page, "tags").getByRole("radiogroup", { name: `Color of ${name}` }).getByRole("radio", { name: color }).click();
      await expect(section(page, "tags").getByTestId("tag-chip").filter({ hasText: name })).toHaveAttribute(
        "data-color",
        color.toLowerCase(),
      );
    }

    await page.goto(projectUrl);
    await openCard(page, "Colorful");
    for (const name of ["UX", "Backend", "Bug"]) {
      await page.getByRole("textbox", { name: "Add a tag" }).fill(name);
      await page.getByRole("textbox", { name: "Add a tag" }).press("Enter");
    }
    await save(page);
    const chips = page.getByRole("list", { name: "Selected tags" }).getByTestId("tag-chip");
    await expect(chips.filter({ hasText: "Bug" })).toHaveAttribute("data-color", "red");

    await backToBoard(page);
    // FR-010: one segment per tag, alphabetical (Backend, Bug, UX); none without tags.
    const segments = card(page, "Colorful").getByTestId("tag-color-bar").locator("span");
    await expect(segments).toHaveCount(3);
    expect(await segments.evaluateAll((els) => els.map((el) => el.getAttribute("data-color")))).toEqual([
      "blue",
      "red",
      "green",
    ]);
    await expect(card(page, "Colorful").getByRole("link")).toHaveAttribute("aria-label", /tags: Backend, Bug, UX/);
    await expect(card(page, "Plain").getByTestId("tag-color-bar")).toHaveCount(0);

    // Recoloring shows on the board after a reload.
    await page.goto(`${projectUrl}/settings/catalogs`);
    await section(page, "tags").getByRole("button", { name: "Change color of Bug" }).click();
    await section(page, "tags").getByRole("radiogroup", { name: "Color of Bug" }).getByRole("radio", { name: "Violet" }).click();
    await expect(section(page, "tags").getByTestId("tag-chip").filter({ hasText: "Bug" })).toHaveAttribute(
      "data-color",
      "violet",
    );
    // Optimistic recolor: reload the board until the save shows.
    await expect(async () => {
      await page.goto(projectUrl);
      await expect(card(page, "Colorful").getByTestId("tag-color-bar").locator("span").nth(1)).toHaveAttribute(
        "data-color",
        "violet",
        { timeout: 2000 },
      );
    }).toPass();
  });
});

test.describe("Project catalogs — create from the Work Item (US3)", () => {
  test("filters as you type and creates new values through the pop-up", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Quick Create");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Item");
    await openCard(page, "Item");

    const tagInput = page.getByRole("textbox", { name: "Add a tag" });
    await tagInput.fill("Backend");
    await createFromField(page, "Backend");
    await tagInput.fill("Bugs");
    await createFromField(page, "Bugs");

    // "ba" matches Backend only (Bugs doesn't contain "ba").
    await page.getByRole("button", { name: "Remove tag Backend" }).click();
    await tagInput.fill("ba");
    await expect(page.getByRole("button", { name: "Backend", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bugs", exact: true })).toHaveCount(0);
    // An exact match in another case is offered, never "Create new".
    await tagInput.fill("BACKEND");
    await expect(page.getByRole("button", { name: 'Create new "BACKEND"' })).toHaveCount(0);
    await tagInput.press("Enter");
    await expect(page.getByRole("button", { name: "Remove tag Backend" })).toBeVisible();

    // A new tag with a color.
    await tagInput.fill("Mobile");
    await createFromField(page, "Mobile", "Green");
    await expect(
      page.getByRole("list", { name: "Selected tags" }).getByTestId("tag-chip").filter({ hasText: "Mobile" }),
    ).toHaveAttribute("data-color", "green");

    // Cancelling creates nothing.
    await tagInput.fill("Nope");
    await page.getByRole("button", { name: 'Create new "Nope"' }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await tagInput.fill("");

    // Area and size: the pop-up only asks for the name.
    await page.getByLabel("Area", { exact: true }).fill("Frontend");
    await page.getByRole("button", { name: 'Create new "Frontend"' }).click();
    await expect(page.getByRole("dialog").getByRole("radiogroup")).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
    // The page behind a modal is inert: wait for the pop-up to close before typing.
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByLabel("Size", { exact: true }).fill("M");
    await createFromField(page, "M");
    await save(page);

    await page.goto(`${projectUrl}/settings/catalogs`);
    await expect.poll(() => valueNames(page, "tags")).toEqual(["Backend", "Bugs", "Mobile"]);
    await expect(section(page, "tags").getByTestId("tag-chip").filter({ hasText: "Mobile" })).toHaveAttribute(
      "data-color",
      "green",
    );
    await expect.poll(() => valueNames(page, "areas")).toEqual(["Frontend"]);
    await expect.poll(() => valueNames(page, "sizes")).toEqual(["M"]);
  });

  test("doesn't bring back a tag deleted while the Work Item was being edited", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const other = await context.newPage();

    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Concurrent");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Edited meanwhile");
    await openCard(page, "Edited meanwhile");
    await page.getByRole("textbox", { name: "Add a tag" }).fill("UX");
    await createFromField(page, "UX");
    await save(page);

    // Same user, second tab: delete the tag from the catalogs page.
    await other.goto(`${projectUrl}/settings/catalogs`);
    await section(other, "tags").getByRole("button", { name: "Delete UX" }).click();
    await other.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(section(other, "tags").getByTestId("catalog-value")).toHaveCount(0);

    // The first tab still shows UX selected; saving must not recreate it.
    await page.getByLabel("Title").fill("Edited meanwhile (renamed)");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText('"UX" no longer exists in this project.')).toBeVisible();
    await other.reload();
    await expect(section(other, "tags").getByTestId("catalog-value")).toHaveCount(0);
  });
});

test.describe("Project catalogs — Size replaces Iteration (US4)", () => {
  test("shows Size in the detail, the Table and the history, and never Iteration", async ({ page }) => {
    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Sizes");
    await addColumn(page, "To Do");
    await addWorkItem(page, "Sized");
    await openCard(page, "Sized");

    await expect(page.getByText("Iteration")).toHaveCount(0);
    await page.getByLabel("Size", { exact: true }).fill("M");
    await createFromField(page, "M");
    await save(page);
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Size: None → M")).toBeVisible();

    await page.goto(`${projectUrl}/table`);
    await expect(page.locator("thead").getByRole("button", { name: "Size" })).toBeVisible();
    await expect(page.getByText("Iteration")).toHaveCount(0);
    await expect(page.getByTestId("table-row").first()).toContainText("M");
  });
});

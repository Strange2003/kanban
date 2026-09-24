import { expect, test } from "@playwright/test";
import { addColumn, addWorkItem, createProjectViaUi, inviteAndAccept, openCard, signUpNewUser } from "./helpers";

test("owner saves an estimate, logs time, comments, and sees a separate history", async ({ page }) => {
  await signUpNewUser(page, "Ana");
  await createProjectViaUi(page, "Discussion Project");
  await addColumn(page, "To do");
  await addWorkItem(page, "Plan launch");
  await openCard(page, "Plan launch");

  await page.getByLabel("Estimate (hours)").fill("8");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByLabel("Log time (hours)").fill("1.5");
  await page.getByPlaceholder("Note (optional)").fill("Research");
  await page.getByRole("button", { name: "Add time" }).click();
  await expect(page.getByText("1h 30m", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Log time (hours)").fill("0.5");
  await page.getByRole("button", { name: "Add time" }).click();
  await expect(page.getByText("2h", { exact: true })).toBeVisible();

  await page.getByLabel("Add a comment").fill("I will share the draft tomorrow.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("I will share the draft tomorrow.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Estimate (hours)")).toHaveValue("8");
  await expect(page.getByText("2h", { exact: true })).toBeVisible();
  await expect(page.getByText("I will share the draft tomorrow.")).toBeVisible();
  await expect(page.getByText("Time logged")).toHaveCount(0);

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Time logged").first()).toBeVisible();
  await expect(page.getByText("I will share the draft tomorrow.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Details" }).click();

  await page.getByRole("button", { name: /Remove time entry/ }).first().click();
  await expect(page.getByText("30m", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("30m", { exact: true }).first()).toBeVisible();
});

test("a Viewer can comment while fields and time controls remain read-only", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const viewerPage = await viewerContext.newPage();

  await signUpNewUser(ownerPage, "Ana");
  const projectUrl = await createProjectViaUi(ownerPage, "Viewer Discussion");
  await addColumn(ownerPage, "To do");
  await addWorkItem(ownerPage, "Review draft");
  const viewerEmail = await signUpNewUser(viewerPage, "Beto");
  await inviteAndAccept(ownerPage, viewerPage, projectUrl, viewerEmail, "viewer");

  await viewerPage.goto(projectUrl);
  await openCard(viewerPage, "Review draft");
  await expect(viewerPage.getByLabel("Title")).toHaveAttribute("readonly", "");
  await expect(viewerPage.getByLabel("Log time (hours)")).toHaveCount(0);
  await viewerPage.getByLabel("Add a comment").fill("Reviewed — looks good.");
  await viewerPage.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(viewerPage.getByText("Reviewed — looks good.")).toBeVisible();

  await ownerPage.goto(projectUrl);
  await openCard(ownerPage, "Review draft");
  await expect(ownerPage.getByText("Reviewed — looks good.")).toBeVisible();

  await ownerContext.close();
  await viewerContext.close();
});

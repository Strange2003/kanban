import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi, inviteAndAccept, addColumn, addWorkItem, openCard, backToBoard } from "./helpers";

// quickstart.md § 1 of 011-agent-access-mcp: the Assignee field (Historia 1).
test.describe("Assignee (011-agent-access-mcp US1)", () => {
  test("assign a member, see it on the card and table, notify them, and unassign when they leave", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    await signUpNewUser(ownerPage, "Ana");
    const projectUrl = await createProjectViaUi(ownerPage, "UMG ASISTENCIA");
    const memberEmail = await signUpNewUser(memberPage, "Beto");
    await inviteAndAccept(ownerPage, memberPage, projectUrl, memberEmail);

    await ownerPage.goto(projectUrl);
    await addColumn(ownerPage, "To Do");
    await addWorkItem(ownerPage, "Daily attendance");
    await addWorkItem(ownerPage, "Weekly report");

    // No more Stakeholder; the Assignee picker lists the project's members.
    await openCard(ownerPage, "Daily attendance");
    await expect(ownerPage.getByLabel("Stakeholder")).toBeHidden();
    const picker = ownerPage.getByLabel("Assignee");
    await expect(picker.locator("option")).toHaveText(["Unassigned", "Ana", "Beto"]);
    await picker.selectOption({ label: "Beto" });
    await ownerPage.getByRole("button", { name: "Save" }).click();
    await expect(ownerPage.getByText(/Assigned to Beto — by Ana/)).toBeVisible();

    // Assigning yourself doesn't notify anyone.
    await backToBoard(ownerPage);
    await openCard(ownerPage, "Weekly report");
    await ownerPage.getByLabel("Assignee").selectOption({ label: "Ana" });
    await ownerPage.getByRole("button", { name: "Save" }).click();
    await expect(ownerPage.getByText(/Assigned to Ana — by Ana/)).toBeVisible();

    // The card shows the assignee.
    await backToBoard(ownerPage);
    await expect(ownerPage.getByRole("button", { name: /Daily attendance, assigned to Beto/ })).toBeVisible();

    // Beto gets exactly one notification, which opens the Work Item.
    await memberPage.goto("/");
    await memberPage.getByRole("button", { name: "Notifications" }).click();
    const notification = memberPage.getByTestId("assignment-notification");
    await expect(notification).toHaveCount(1);
    await expect(notification).toContainText("Ana assigned you");
    await expect(notification).toContainText("Daily attendance");
    await notification.getByRole("button", { name: /assigned you/ }).click();
    await expect(memberPage).toHaveURL(/\/work-items\/1$/);
    await memberPage.goto("/");
    await memberPage.getByRole("button", { name: "Notifications" }).click();
    await expect(memberPage.getByText("You're all caught up.")).toBeVisible();

    // The Table has an Assignee column and an "Assigned to me" filter kept in the address.
    await memberPage.goto(`${projectUrl}/table?assignee=me`);
    await expect(memberPage.getByRole("columnheader", { name: /Assignee/ })).toBeVisible();
    await expect(memberPage.getByTestId("view-count")).toHaveText("1 of 2");
    await expect(memberPage.getByRole("link", { name: "Daily attendance" })).toBeVisible();

    // Removing Beto unassigns their Work Items, with a history entry.
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("listitem").filter({ hasText: "Beto" }).getByRole("button", { name: "Remove" }).click();
    await expect(ownerPage.getByRole("listitem").filter({ hasText: "Beto" })).toBeHidden();
    await ownerPage.goto(`${projectUrl}/work-items/1`);
    await expect(ownerPage.getByLabel("Assignee")).toHaveValue("");
    await expect(ownerPage.getByText(/Unassigned \(Beto left the project\)/)).toBeVisible();

    await ownerContext.close();
    await memberContext.close();
  });
});

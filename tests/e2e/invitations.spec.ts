import { test, expect } from "@playwright/test";
import { signUpNewUser, createProjectViaUi } from "./helpers";

// quickstart.md bloque 1, paso 4 (T061) y pasos 5-6 (T066).

test.describe("Invitations", () => {
  test("invites a collaborator, rejects duplicate/already-member invites, and the invitee accepts into Shared", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    await signUpNewUser(ownerPage, "Owner");
    const projectUrl = await createProjectViaUi(ownerPage, "Shared Project");
    const inviteeEmail = await signUpNewUser(inviteePage, "Invitee");

    // Owner invites the not-yet-a-member invitee (FR-005/FR-006/FR-009).
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await ownerPage.getByLabel("Email").fill(inviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();

    // Sending it again while still pending is rejected (FR-012).
    await ownerPage.getByLabel("Email").fill(inviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText(/already has a pending invitation/i)).toBeVisible();
    await ownerPage.getByRole("button", { name: "Close" }).click();

    // Invitee sees and accepts the notification (US3).
    await inviteePage.goto("/");
    await inviteePage.getByRole("button", { name: "Notifications" }).click();
    await expect(inviteePage.getByText("Shared Project")).toBeVisible();
    await inviteePage.getByRole("button", { name: "Accept" }).click();
    // Resolved once the refreshed panel is empty — the button itself turns into "..." as
    // soon as it's clicked, so its disappearing doesn't mean the Server Action finished.
    await expect(inviteePage.getByText("You're all caught up.")).toBeVisible();

    // Project reclassifies to Shared for the invitee...
    await inviteePage.reload();
    await expect(inviteePage.getByRole("button", { name: "Shared" })).toBeVisible();
    await expect(inviteePage.getByRole("link", { name: "Shared Project" })).toBeVisible();

    // ...and for the owner too, without anyone editing that field manually.
    await ownerPage.reload();
    await expect(ownerPage.getByRole("button", { name: "Shared" })).toBeVisible();

    // Re-inviting the now-a-member invitee is rejected (FR-013).
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await ownerPage.getByLabel("Email").fill(inviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText(/already a member/i)).toBeVisible();

    await ownerContext.close();
    await inviteeContext.close();
  });

  // Historia 4 de 001-accounts-invitations (T104).
  test("the invitee rejects an invitation, and the inviter cancels another", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    await signUpNewUser(ownerPage, "Owner");
    const projectUrl = await createProjectViaUi(ownerPage, "Reject Cancel Project");
    const inviteeEmail = await signUpNewUser(inviteePage, "Invitee");

    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await ownerPage.getByLabel("Email").fill(inviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Close" }).click();

    // Invitee rejects (FR-010) — no longer pending, no membership created.
    await inviteePage.goto("/");
    await inviteePage.getByRole("button", { name: "Notifications" }).click();
    await inviteePage.getByRole("button", { name: "Reject" }).click();
    // Resolved once the refreshed panel is empty, i.e. the Server Action finished.
    await expect(inviteePage.getByText("You're all caught up.")).toBeVisible();
    await inviteePage.reload();
    await expect(inviteePage.getByRole("link", { name: "Reject Cancel Project" })).toBeHidden();

    // Owner sends a second invitation and cancels it before it's answered (FR-011).
    const secondInviteeEmail = await signUpNewUser(inviteePage, "Second Invitee");
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await ownerPage.getByLabel("Email").fill(secondInviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Close" }).click();

    await expect(ownerPage.getByText(secondInviteeEmail)).toBeVisible();
    await ownerPage.getByRole("button", { name: "Cancel" }).click();
    await expect(ownerPage.getByText(secondInviteeEmail)).toBeHidden();

    // The cancelled invitation no longer shows up for the invitee either.
    await inviteePage.goto("/");
    await inviteePage.getByRole("button", { name: "Notifications" }).click();
    await expect(inviteePage.getByText("Reject Cancel Project")).toBeHidden();

    await ownerContext.close();
    await inviteeContext.close();
  });
});

import { test, expect, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, projectMembers, projects } from "@/db/schema";
import { generatePublicId } from "@/lib/ids";
import {
  signUpNewUser,
  createProjectViaUi,
  inviteAndAccept,
  openCard,
  dragWorkItemToColumn,
  selectRelationOption,
  addColumn,
  addWorkItem,
  clickUntilVisible,
  stageColumn,
} from "./helpers";

// quickstart.md of 007-roles-permissions, one describe block per user story.

test.describe("Roles — the owner changes a member's role (US1)", () => {
  // quickstart.md bloque 1, pasos 1-5.
  test("the owner switches a member between Member and Viewer; a member can't", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    await signUpNewUser(ownerPage, "Owner");
    const projectUrl = await createProjectViaUi(ownerPage, "Roles Project");
    const memberEmail = await signUpNewUser(memberPage, "Beto");
    await inviteAndAccept(ownerPage, memberPage, projectUrl, memberEmail);

    // The owner sees the member with a role selector, and the owner's own row has none.
    const roleSelect = ownerPage.getByLabel("Role of Beto");
    await expect(roleSelect).toHaveValue("member");
    await expect(ownerPage.getByLabel("Role of Owner")).toBeHidden();
    await expect(ownerPage.getByText("Signed in as Owner.")).toBeVisible();

    // Member -> Viewer -> Member -> Viewer, each change reflected in the list.
    // The select shows the new role straight away (optimistically) and stays disabled
    // until the change is saved — wait for that before the next step reads the server.
    await roleSelect.selectOption("viewer");
    await expect(roleSelect).toHaveValue("viewer");
    await expect(roleSelect).toBeEnabled();
    await roleSelect.selectOption("member");
    await expect(roleSelect).toHaveValue("member");
    await expect(roleSelect).toBeEnabled();
    await roleSelect.selectOption("viewer");
    await expect(roleSelect).toBeEnabled();
    await ownerPage.reload();
    await expect(ownerPage.getByLabel("Role of Beto")).toHaveValue("viewer");

    // Back to Member so the next check compares against a plain member.
    await ownerPage.getByLabel("Role of Beto").selectOption("member");
    await expect(ownerPage.getByLabel("Role of Beto")).toHaveValue("member");
    await expect(ownerPage.getByLabel("Role of Beto")).toBeEnabled();

    // A member opens Settings: no role selector, but sees every role and their own.
    await memberPage.goto(`${projectUrl}/settings`);
    await expect(memberPage.getByText("Signed in as Member.")).toBeVisible();
    await expect(memberPage.getByLabel("Role of Beto")).toBeHidden();
    await expect(memberPage.getByLabel("Role of Owner")).toBeHidden();
    await expect(memberPage.getByRole("listitem").filter({ hasText: "Owner" })).toContainText("Owner");
    await expect(memberPage.getByRole("listitem").filter({ hasText: "Beto" })).toContainText("Member");

    await ownerContext.close();
    await memberContext.close();
  });
});

// ---------------------------------------------------------------------------
// US2 — a Viewer reads everything and can't change anything.

/** The owner sets a member's role from the settings page. */
async function setRole(ownerPage: Page, projectUrl: string, memberName: string, role: "member" | "viewer") {
  await ownerPage.goto(`${projectUrl}/settings`);
  const select = ownerPage.getByLabel(`Role of ${memberName}`);
  await select.selectOption(role);
  await expect(select).toHaveValue(role);
  await expect(select).toBeEnabled();
}

test.describe("Roles — a Viewer is read-only (US2)", () => {
  // quickstart.md bloque 2, pasos 1-3 y 6.
  test("a Viewer sees no edit controls, can't drag, still navigates relations, and can leave", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const viewerPage = await viewerContext.newPage();

    await signUpNewUser(ownerPage, "Ana");
    const projectUrl = await createProjectViaUi(ownerPage, "Read Only Project");
    await addColumn(ownerPage, "To do");
    await addColumn(ownerPage, "Doing");
    await addWorkItem(ownerPage, "Alpha task");
    await addWorkItem(ownerPage, "Beta task");

    // Relate the two Work Items so the Viewer has something to navigate.
    await openCard(ownerPage, "Alpha task");
    await selectRelationOption(ownerPage, "Relate to", "Beta task");
    await ownerPage.getByRole("button", { name: "Link" }).click();
    await expect(ownerPage.getByRole("link", { name: /Go to related .* Beta task/ })).toBeVisible();

    const viewerEmail = await signUpNewUser(viewerPage, "Carla");
    await inviteAndAccept(ownerPage, viewerPage, projectUrl, viewerEmail, "viewer");

    // --- Board: nothing to edit, and a visible explanation.
    await viewerPage.goto(projectUrl);
    await expect(viewerPage.locator('[data-testid="work-item-card"]', { hasText: "Alpha task" })).toBeVisible();
    // Filtered: dnd-kit adds its own (empty) role="status" live region to the board.
    await expect(viewerPage.getByRole("status").filter({ hasText: /read-only/i })).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "+ Add column" })).toBeHidden();
    await expect(viewerPage.getByRole("button", { name: "+ Add work item" })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Delete column" })).toHaveCount(0);

    // Dragging a card does nothing, and it's still where it was after a reload.
    await dragWorkItemToColumn(viewerPage, "Alpha task", "Doing", { waitForSave: false });
    await viewerPage.reload();
    const todoColumn = stageColumn(viewerPage, "To do");
    await expect(todoColumn.getByText("Alpha task")).toBeVisible();

    // Double-clicking a column name doesn't open the rename editor.
    await viewerPage.getByRole("heading", { name: "To do", level: 3 }).dblclick();
    await expect(viewerPage.locator('[data-testid="stage-column"]').getByRole("textbox")).toHaveCount(0);

    // --- Detail view: read-only fields, but the relation is still a real link.
    await openCard(viewerPage, "Alpha task");
    await expect(viewerPage.getByLabel("Title")).toHaveAttribute("readonly", "");
    // `exact`: the sidebar's (closed) "New project" dialog has a "Description (optional)".
    await expect(viewerPage.getByLabel("Description", { exact: true })).toHaveAttribute("readonly", "");
    await expect(viewerPage.getByRole("button", { name: "Save" })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await expect(viewerPage.getByLabel("Relate to")).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: /Remove related/ })).toHaveCount(0);

    await viewerPage.getByRole("link", { name: /Go to related .* Beta task/ }).click();
    await expect(viewerPage.getByLabel("Title")).toHaveValue("Beta task");
    await viewerPage.goBack();
    await expect(viewerPage.getByLabel("Title")).toHaveValue("Alpha task");

    // --- Settings: no owner controls, no invitations (FR-018), but they can leave.
    await viewerPage.goto(`${projectUrl}/settings`);
    await expect(viewerPage.getByText("Signed in as Viewer.")).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Invite", exact: true })).toHaveCount(0);
    await expect(viewerPage.getByText("Pending invitations")).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: "Delete project" })).toHaveCount(0);
    await clickUntilVisible(
      viewerPage.getByRole("button", { name: "Leave project" }),
      viewerPage.getByRole("button", { name: "Confirm" }),
    );
    await viewerPage.getByRole("button", { name: "Confirm" }).click();
    await viewerPage.waitForURL("/");
    await expect(viewerPage.getByRole("link", { name: "Read Only Project" })).toBeHidden();

    await ownerContext.close();
    await viewerContext.close();
  });

  // Historia 2, escenario 4: the role changes while the screen is already open.
  test("a Member downgraded with the board open is told why, the card snaps back, and the board turns read-only", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    await signUpNewUser(ownerPage, "Ana");
    const projectUrl = await createProjectViaUi(ownerPage, "Downgrade Project");
    await addColumn(ownerPage, "To do");
    await addColumn(ownerPage, "Doing");
    await addWorkItem(ownerPage, "Movable task");
    const memberEmail = await signUpNewUser(memberPage, "Beto");
    await inviteAndAccept(ownerPage, memberPage, projectUrl, memberEmail, "member");

    // Beto opens the board while still a Member...
    await memberPage.goto(projectUrl);
    await expect(memberPage.getByRole("button", { name: "+ Add column" })).toBeVisible();

    // ...then Ana downgrades him.
    await setRole(ownerPage, projectUrl, "Beto", "viewer");

    // His board is stale: it still offers editing. Trying to move a card is rejected server-side.
    await dragWorkItemToColumn(memberPage, "Movable task", "Doing");
    await expect(memberPage.getByText(/Your role in this project \(Viewer\) doesn't allow this action/)).toBeVisible();

    // The card is back in its column and the refreshed board is read-only.
    const todoColumn = stageColumn(memberPage, "To do");
    await expect(todoColumn.getByText("Movable task")).toBeVisible();
    await expect(memberPage.getByRole("button", { name: "+ Add column" })).toBeHidden();
    await expect(memberPage.getByRole("status").filter({ hasText: /read-only/i })).toBeVisible();

    await ownerContext.close();
    await memberContext.close();
  });
});

// ---------------------------------------------------------------------------
// US3 — invite choosing the role, and who may invite.

test.describe("Roles — inviting with a role (US3)", () => {
  // quickstart.md bloque 3, pasos 1, 3 y FR-016.
  test("the owner invites as Viewer, the invitee joins as Viewer, and the project becomes Shared", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    await signUpNewUser(ownerPage, "Ana");
    const projectUrl = await createProjectViaUi(ownerPage, "Invite Role Project");
    const inviteeEmail = await signUpNewUser(inviteePage, "Diego");

    // The role selector never offers Owner.
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(ownerPage.getByLabel("Role", { exact: true }).locator("option")).toHaveText(["Member", "Viewer"]);
    await ownerPage.getByRole("button", { name: "Close" }).click();

    await inviteAndAccept(ownerPage, inviteePage, projectUrl, inviteeEmail, "viewer");

    await expect(ownerPage.getByLabel("Role of Diego")).toHaveValue("viewer");
    // FR-016: an Owner + a Viewer is a Shared project — the role doesn't matter for that.
    await expect(ownerPage.getByRole("button", { name: "Shared" })).toBeVisible();
    await inviteePage.goto(projectUrl);
    await expect(inviteePage.getByRole("status").filter({ hasText: /read-only/i })).toBeVisible();

    await ownerContext.close();
    await inviteeContext.close();
  });

  // quickstart.md bloque 3, pasos 2 y 4.
  test("a Member can invite and cancel only their own invitations; the owner can cancel any", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();

    await signUpNewUser(ownerPage, "Ana");
    const projectUrl = await createProjectViaUi(ownerPage, "Who Invites Project");
    const memberEmail = await signUpNewUser(memberPage, "Beto");
    await inviteAndAccept(ownerPage, memberPage, projectUrl, memberEmail, "member");

    // The owner has a pending invitation of their own for a third person.
    const ownersInviteeEmail = await signUpNewUser(inviteePage, "Eva");
    await ownerPage.goto(`${projectUrl}/settings`);
    await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
    await ownerPage.getByLabel("Email").fill(ownersInviteeEmail);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(ownerPage.getByText("Invitation sent.")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Close" }).click();

    // Beto (a Member) invites someone else, as Member.
    const betosInviteeEmail = `beto-invitee-${Date.now()}@example.com`;
    await memberPage.goto(`${projectUrl}/settings`);
    await memberPage.getByRole("button", { name: "Invite", exact: true }).click();
    await memberPage.getByLabel("Email").fill(betosInviteeEmail);
    await memberPage.getByRole("button", { name: "Send invitation" }).click();
    await expect(memberPage.getByText("Invitation sent.")).toBeVisible();
    await memberPage.getByRole("button", { name: "Close" }).click();

    const ownersRowForMember = memberPage.getByRole("listitem").filter({ hasText: ownersInviteeEmail });
    const betosRow = memberPage.getByRole("listitem").filter({ hasText: betosInviteeEmail });
    await memberPage.reload();
    await expect(ownersRowForMember).toContainText("as Member");
    // Beto sees the owner's invitation but has no way to cancel it; he can cancel his own.
    await expect(ownersRowForMember.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await betosRow.getByRole("button", { name: "Cancel" }).click();
    await expect(betosRow).toHaveCount(0);

    // The owner can cancel any pending invitation.
    await ownerPage.reload();
    const ownersRow = ownerPage.getByRole("listitem").filter({ hasText: ownersInviteeEmail });
    await ownersRow.getByRole("button", { name: "Cancel" }).click();
    await expect(ownersRow).toHaveCount(0);

    await ownerContext.close();
    await memberContext.close();
    await inviteeContext.close();
  });
});

// ---------------------------------------------------------------------------
// US4 — transferring ownership.

test.describe("Roles — transferring ownership (US4)", () => {
  // quickstart.md bloque 4, pasos 1-4.
  test("no transfer in a Personal project; in a shared one the owner hands it over and can then leave", async ({
    browser,
  }) => {
    const anaContext = await browser.newContext();
    const betoContext = await browser.newContext();
    const anaPage = await anaContext.newPage();
    const betoPage = await betoContext.newPage();

    await signUpNewUser(anaPage, "Ana");
    const projectUrl = await createProjectViaUi(anaPage, "Transfer Project");

    // Personal project (a single member): nobody to hand it to.
    await anaPage.goto(`${projectUrl}/settings`);
    await expect(anaPage.getByRole("button", { name: /Make .* the owner/ })).toHaveCount(0);

    const betoEmail = await signUpNewUser(betoPage, "Beto");
    await inviteAndAccept(anaPage, betoPage, projectUrl, betoEmail, "member");

    // The confirmation warns about what Ana loses.
    await anaPage.getByRole("button", { name: "Make Beto the owner" }).click();
    await expect(anaPage.getByText(/You will lose the owner-only permissions/)).toBeVisible();
    await anaPage.getByRole("button", { name: "Transfer ownership", exact: true }).click();
    // The dialog closes and the page refreshes only once the transfer is saved.
    await expect(anaPage.getByText("Signed in as Member.")).toBeVisible();

    // Ana is now a Member: no owner controls, and she can leave; Beto is the owner.
    await anaPage.reload();
    await expect(anaPage.getByText("Signed in as Member.")).toBeVisible();
    await expect(anaPage.getByLabel("Role of Beto")).toHaveCount(0);
    await expect(anaPage.getByRole("button", { name: "Delete project" })).toHaveCount(0);

    await betoPage.goto(`${projectUrl}/settings`);
    await expect(betoPage.getByText("Signed in as Owner.")).toBeVisible();
    await expect(betoPage.getByLabel("Role of Ana")).toHaveValue("member");
    // Exactly one Owner in the list.
    await expect(betoPage.getByRole("listitem").filter({ hasText: /^\s*(Beto|Ana).*\bOwner\b/ })).toHaveCount(1);

    await clickUntilVisible(
      anaPage.getByRole("button", { name: "Leave project" }),
      anaPage.getByRole("button", { name: "Confirm" }),
    );
    await anaPage.getByRole("button", { name: "Confirm" }).click();
    await anaPage.waitForURL("/");

    await anaContext.close();
    await betoContext.close();
  });

  // quickstart.md bloque 4, paso 5.
  test("ownership can go to a Viewer, who then has every owner permission", async ({ browser }) => {
    const anaContext = await browser.newContext();
    const carlaContext = await browser.newContext();
    const anaPage = await anaContext.newPage();
    const carlaPage = await carlaContext.newPage();

    await signUpNewUser(anaPage, "Ana");
    const projectUrl = await createProjectViaUi(anaPage, "Viewer Owner Project");
    const carlaEmail = await signUpNewUser(carlaPage, "Carla");
    await inviteAndAccept(anaPage, carlaPage, projectUrl, carlaEmail, "viewer");

    await anaPage.getByRole("button", { name: "Make Carla the owner" }).click();
    await anaPage.getByRole("button", { name: "Transfer ownership", exact: true }).click();
    await expect(anaPage.getByText("Signed in as Member.")).toBeVisible();

    await carlaPage.goto(`${projectUrl}/settings`);
    await expect(carlaPage.getByText("Signed in as Owner.")).toBeVisible();
    await expect(carlaPage.getByRole("button", { name: "Delete project" })).toBeVisible();
    await carlaPage.goto(projectUrl);
    await expect(carlaPage.getByRole("button", { name: "+ Add column" })).toBeVisible();

    await anaContext.close();
    await carlaContext.close();
  });
});

// ---------------------------------------------------------------------------
// Database backstops — defence in depth beneath the application checks.

test.describe("Roles — database constraints (FR-002, SC-006)", () => {
  async function insertProjectWithOwner() {
    const [project] = await db
      .insert(projects)
      .values({ publicId: generatePublicId(), name: "Constraint Project", workItemPrefix: "CST", ownerId: "owner-user" })
      .returning();
    if (!project) throw new Error("Could not insert the test project.");
    await db.insert(projectMembers).values({ projectId: project.id, userId: "owner-user", role: "owner" });
    return project;
  }

  // drizzle wraps the driver error; the constraint name lives in the cause chain.
  function errorText(error: unknown): string {
    const parts: string[] = [];
    for (let e = error as { message?: string; constraint?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
      parts.push(String(e.message), String(e.constraint));
    }
    return parts.join(" | ");
  }

  test("a second owner row is rejected by project_members_one_owner_idx", async () => {
    const project = await insertProjectWithOwner();

    let failure: unknown;
    try {
      await db.insert(projectMembers).values({ projectId: project.id, userId: "second-owner", role: "owner" });
    } catch (error) {
      failure = error;
    }

    expect(failure, "inserting a second owner must fail").toBeDefined();
    expect(errorText(failure)).toContain("project_members_one_owner_idx");

    await db.delete(projects).where(eq(projects.id, project.id));
  });

  test("an invitation can't carry the owner role (invitations_role_not_owner_check)", async () => {
    const project = await insertProjectWithOwner();

    let failure: unknown;
    try {
      await db.insert(invitations).values({
        publicId: generatePublicId(),
        projectId: project.id,
        invitedEmail: "nobody@example.com",
        invitedByUserId: "owner-user",
        role: "owner",
      });
    } catch (error) {
      failure = error;
    }

    expect(failure, "an invitation granting owner must fail").toBeDefined();
    expect(errorText(failure)).toContain("invitations_role_not_owner_check");

    // The default keeps pre-existing invitations valid: no role given => member (FR-008/FR-015).
    const [legacy] = await db
      .insert(invitations)
      .values({
        publicId: generatePublicId(),
        projectId: project.id,
        invitedEmail: "legacy@example.com",
        invitedByUserId: "owner-user",
      })
      .returning();
    expect(legacy?.role).toBe("member");

    await db.delete(projects).where(eq(projects.id, project.id));
  });
});

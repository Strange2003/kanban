import { beforeEach, describe, expect, it, vi } from "vitest";

// SC-001/SC-002 of 007-roles-permissions: every mutating Server Action must
// reject a caller whose role lacks the permission, and must do so BEFORE
// writing anything. Playwright can't call a Server Action without going
// through the UI, so this is the "petición directa" case: the exported
// function is invoked directly with a signed-in session whose role in the
// project is the one under test (research.md § Cómo probar).
//
// The `db` mock answers `select().from(<table>)` with a canned row per table
// (looked up by table name) and makes every write method throw — so an action
// that wrongly gets past its permission check fails this test twice: it
// returns something other than ROLE_NOT_PERMITTED, and a write spy fires.
type Role = "owner" | "member" | "viewer";

const { mockGetSession, state, writes } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  state: { role: "viewer" as string },
  writes: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");

  const rowsFor = (table: string): unknown[] => {
    switch (table) {
      case "projects":
        return [{ id: 1, publicId: "proj-1", name: "P", workItemPrefix: "KAN", ownerId: "owner-1" }];
      case "project_members":
        return [{ projectId: 1, userId: "actor", role: state.role }];
      case "stages":
        return [{ id: 1, publicId: "stage-1", projectId: 1, name: "S", position: 0, isClosing: false }];
      case "invitations":
        return [
          {
            id: 1,
            publicId: "inv-1",
            projectId: 1,
            invitedEmail: "invitee@example.com",
            invitedByUserId: "someone-else",
            role: "member",
            status: "pending",
          },
        ];
      case "work_items":
        return [
          { id: 1, projectId: 1, displayNumber: 1, stageId: 1, title: "T", position: 0, parentWorkItemId: null },
        ];
      default:
        return [];
    }
  };

  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const method of ["innerJoin", "leftJoin", "where", "limit", "orderBy", "groupBy", "for"]) {
      chain[method] = () => chain;
    }
    chain.from = (source: Parameters<typeof getTableName>[0]) => {
      table = getTableName(source);
      return chain;
    };
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(rowsFor(table)).then(resolve, reject);
    return chain;
  }

  const forbidden = (spy: () => void) => () => {
    spy();
    throw new Error("A write was attempted by a caller who should have been rejected.");
  };

  return {
    db: {
      select,
      insert: forbidden(writes.insert),
      update: forbidden(writes.update),
      delete: forbidden(writes.delete),
      execute: forbidden(writes.execute),
      transaction: forbidden(writes.transaction),
    },
  };
});

import { createStage, reorderStages, renameStage, deleteStage, setStageClosing } from "@/lib/actions/board";
import {
  createWorkItem,
  moveWorkItem,
  reorderWorkItemsInStage,
  updateWorkItem,
  deleteWorkItem,
  closeWorkItem,
} from "@/lib/actions/work-items";
import {
  setWorkItemParent,
  removeWorkItemParent,
  linkRelatedWorkItems,
  unlinkRelatedWorkItems,
} from "@/lib/actions/work-item-relationships";
import {
  renameProject,
  updateProjectDescription,
  deleteProject,
  removeMember,
  changeMemberRole,
  transferOwnership,
  leaveProject,
} from "@/lib/actions/projects";
import { sendInvitation, cancelInvitation, listPendingInvitations } from "@/lib/actions/accounts-invitations";
import type { Result } from "@/lib/errors";

type Case = {
  /** Exported name, checked for completeness by the "every action is covered" test at the bottom. */
  action: string;
  permission: string;
  run: () => Promise<Result<unknown>>;
  /** Roles the matrix denies: the action must return `deniedCode` for each. */
  denied: Role[];
  /** Roles the matrix allows: the action must get past the permission check for each. */
  allowed: Role[];
  deniedCode?: string;
};

const P = "proj-1";
const READ_ONLY_DENIED: Role[] = ["viewer"];
const EDITORS: Role[] = ["owner", "member"];
const OWNER_ONLY_DENIED: Role[] = ["member", "viewer"];

export const CASES: Case[] = [
  // --- board:edit (lib/actions/board.ts)
  { action: "createStage", permission: "board:edit", run: () => createStage({ projectPublicId: P, name: "New" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "reorderStages", permission: "board:edit", run: () => reorderStages({ projectPublicId: P, orderedStageIds: ["stage-1"] }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "renameStage", permission: "board:edit", run: () => renameStage({ projectPublicId: P, stageId: "stage-1", name: "Renamed" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "deleteStage", permission: "board:edit", run: () => deleteStage({ projectPublicId: P, stageId: "stage-1" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  // 008-work-item-fields (FR-011): marking a closing column is a board edit.
  { action: "setStageClosing", permission: "board:edit", run: () => setStageClosing({ projectPublicId: P, stagePublicId: "stage-1", isClosing: true }), denied: READ_ONLY_DENIED, allowed: EDITORS },

  // --- workItem:edit (lib/actions/work-items.ts)
  { action: "createWorkItem", permission: "workItem:edit", run: () => createWorkItem({ stagePublicId: "stage-1", title: "New" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "moveWorkItem", permission: "workItem:edit", run: () => moveWorkItem({ workItemId: 1, toStageId: 1, toPosition: 0 }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "reorderWorkItemsInStage", permission: "workItem:edit", run: () => reorderWorkItemsInStage({ stageId: 1, orderedWorkItemIds: [1] }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "updateWorkItem", permission: "workItem:edit", run: () => updateWorkItem({ workItemId: 1, title: "Edited", tagNames: ["new-tag"], priority: "high", severity: "low", areaName: "Frontend", iterationName: "Sprint 1", startDate: "2026-10-01", targetDate: "2026-10-15" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "deleteWorkItem", permission: "workItem:edit", run: () => deleteWorkItem(1), denied: READ_ONLY_DENIED, allowed: EDITORS },
  // 008-work-item-fields (FR-014/FR-019): "Close" moves the Work Item, so it's a Work Item edit.
  { action: "closeWorkItem", permission: "workItem:edit", run: () => closeWorkItem(1), denied: READ_ONLY_DENIED, allowed: EDITORS },

  // --- relationship:edit (lib/actions/work-item-relationships.ts)
  { action: "setWorkItemParent", permission: "relationship:edit", run: () => setWorkItemParent({ workItemId: 1, parentWorkItemId: 2 }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "removeWorkItemParent", permission: "relationship:edit", run: () => removeWorkItemParent(1), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "linkRelatedWorkItems", permission: "relationship:edit", run: () => linkRelatedWorkItems({ workItemIdX: 1, workItemIdY: 2 }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  { action: "unlinkRelatedWorkItems", permission: "relationship:edit", run: () => unlinkRelatedWorkItems({ workItemIdX: 1, workItemIdY: 2 }), denied: READ_ONLY_DENIED, allowed: EDITORS },

  // --- owner-only project management (lib/actions/projects.ts)
  { action: "renameProject", permission: "project:edit", run: () => renameProject({ projectPublicId: P, name: "Renamed" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  { action: "updateProjectDescription", permission: "project:edit", run: () => updateProjectDescription({ projectPublicId: P, description: "d" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  { action: "deleteProject", permission: "project:delete", run: () => deleteProject(P), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  { action: "removeMember", permission: "member:remove", run: () => removeMember({ projectPublicId: P, userId: "someone" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  { action: "changeMemberRole", permission: "member:changeRole", run: () => changeMemberRole({ projectPublicId: P, userId: "someone", role: "viewer" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  // --- invitations (lib/actions/accounts-invitations.ts): the Owner and Members invite (FR-009)
  { action: "sendInvitation", permission: "invitation:send", run: () => sendInvitation({ projectPublicId: P, email: "new@example.com", role: "member" }), denied: READ_ONLY_DENIED, allowed: EDITORS },
  // The invitation in the mock was sent by someone else: only the owner may cancel it (FR-010),
  // so a plain Member is rejected too — cancelling their OWN invitations is covered in member-roles.test.ts.
  { action: "cancelInvitation", permission: "invitation:cancelOwn", run: () => cancelInvitation({ projectPublicId: P, invitationId: "inv-1" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  // Reads are gated too: pending invitations expose third parties' emails (FR-018).
  { action: "listPendingInvitations", permission: "invitation:viewPending", run: () => listPendingInvitations(P), denied: READ_ONLY_DENIED, allowed: EDITORS },

  { action: "transferOwnership", permission: "project:transferOwnership", run: () => transferOwnership({ projectPublicId: P, newOwnerUserId: "someone" }), denied: OWNER_ONLY_DENIED, allowed: ["owner"] },
  // The owner is the one role denied "project:leave"; it gets the specific OWNER_CANNOT_LEAVE code instead.
  { action: "leaveProject", permission: "project:leave", run: () => leaveProject(P), denied: ["owner"], allowed: ["member", "viewer"], deniedCode: "OWNER_CANNOT_LEAVE" },
];

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ user: { id: "actor" } });
  for (const spy of Object.values(writes)) spy.mockReset();
  // runAction logs unexpected errors; the "allowed" controls below hit the write-guard on purpose.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mutating Server Actions reject callers whose role lacks the permission", () => {
  for (const testCase of CASES) {
    for (const role of testCase.denied) {
      it(`${testCase.action} (${testCase.permission}) rejects a ${role} without writing anything`, async () => {
        state.role = role;

        const result = await testCase.run();

        expect(result).toMatchObject({ ok: false, error: { code: testCase.deniedCode ?? "ROLE_NOT_PERMITTED" } });
        for (const [method, spy] of Object.entries(writes)) {
          expect(spy, `db.${method} must not run for a rejected ${role}`).not.toHaveBeenCalled();
        }
      });
    }

    for (const role of testCase.allowed) {
      // Control: proves the mock isn't simply rejecting everything — an allowed role
      // must get past the permission check (whatever happens afterwards).
      it(`${testCase.action} lets a ${role} past the permission check`, async () => {
        state.role = role;

        const result = await testCase.run();

        expect(!result.ok && result.error.code === "ROLE_NOT_PERMITTED").toBe(false);
      });
    }
  }
});

// A new Server Action can't quietly skip the permission matrix: every function
// exported from lib/actions/*.ts must be either swept above, a read gated by
// membership alone, or an explicitly named exception. Exports of a "use server"
// module are potentially callable from a client, which is why this covers them all.
import * as accountsInvitationsModule from "@/lib/actions/accounts-invitations";
import * as boardModule from "@/lib/actions/board";
import * as projectsModule from "@/lib/actions/projects";
import * as workItemsModule from "@/lib/actions/work-items";
import * as workItemRelationshipsModule from "@/lib/actions/work-item-relationships";

// Reads gated by `requireProjectMember` alone (any member, a Viewer included, may read), or
// actions that aren't scoped to a project's role at all.
const MEMBERSHIP_ONLY_READS = [
  "getBoard",
  "getWorkItemByDisplayNumber",
  "listProjectTags",
  "getWorkItemTags",
  "listWorkItemActivity",
  "getWorkItemRelations",
  "listProjectWorkItems",
  "getWorkItemDetailData",
  "listProjectMembers",
  "listMyProjects", // only the caller's own projects
  "listMyNotifications", // only the caller's own notifications
  "createProject", // any signed-in user may create a project
  "respondToInvitation", // only the invited email may answer it (checked in the action)
];

describe("every exported Server Action is classified", () => {
  const exported = [
    accountsInvitationsModule,
    boardModule,
    projectsModule,
    workItemsModule,
    workItemRelationshipsModule,
  ].flatMap((module) => Object.entries(module).filter(([, value]) => typeof value === "function").map(([name]) => name));

  it("has no export missing from the permission sweep, the membership-only reads or the known exceptions", () => {
    const classified = new Set([...CASES.map((c) => c.action), ...MEMBERSHIP_ONLY_READS]);
    const unclassified = exported.filter((name) => !classified.has(name));

    expect(unclassified, "add each new action to CASES (mutations) or MEMBERSHIP_ONLY_READS (reads)").toEqual([]);
  });

  it("has no stale entry naming an action that no longer exists", () => {
    const stale = [...CASES.map((c) => c.action), ...MEMBERSHIP_ONLY_READS].filter(
      (name) => !exported.includes(name),
    );

    expect(stale).toEqual([]);
  });
});

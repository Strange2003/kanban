import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, projectMembers, workItems } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { logActivity } from "@/lib/activity";
import { getActor } from "@/lib/actor";
import { AppError } from "@/lib/errors";

/**
 * The Assignee field of 011-agent-access-mcp (FR-001..FR-013): who a Work Item
 * is assigned to, its audit trail and the assignee's in-app notification.
 * Shared by updateWorkItem, createWorkItems and the member-exit paths so the
 * rules live in one place.
 *
 * Server-only, not "use server": these take internal ids and do no access
 * check of their own — callers run requireProjectPermission first.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Person = { userId: string; name: string };

const ASSIGNEE_FK = "work_items_assignee_member_fk";

/** The composite FK firing (the person left meanwhile) is reported as NOT_A_MEMBER, not a 500. */
export function translateAssigneeFkError(error: unknown): unknown {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint?: string };
  if (pg?.code === "23503" && pg.constraint === ASSIGNEE_FK) {
    return new AppError("NOT_A_MEMBER", "That person isn't a member of this project.");
  }
  return error;
}

async function memberNames(tx: Tx, projectId: number, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await tx
    .select({ userId: projectMembers.userId, name: user.name })
    .from(projectMembers)
    .innerJoin(user, eq(user.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), inArray(projectMembers.userId, userIds)));
  return new Map(rows.map((r) => [r.userId, r.name]));
}

/**
 * Sets `assignee_user_id` inside the caller's transaction (FR-004..FR-006,
 * FR-009, FR-011..FR-013):
 * - `undefined` or an unchanged value does nothing;
 * - a new assignee must be a current member of the Work Item's project, else NOT_A_MEMBER
 *   (the composite FK backs this up against races — see translateAssigneeFkError);
 * - logs `assignee_changed` with both names;
 * - notifies the new assignee unless they assigned themselves (directly or via their own agent).
 *
 * Returns whether anything changed, so the caller can bump `updated_at`.
 */
export async function setAssigneeWithinTx(
  tx: Tx,
  args: {
    workItem: { id: number; projectId: number; assigneeUserId: string | null };
    assigneeUserId: string | null | undefined;
  },
): Promise<boolean> {
  const { workItem, assigneeUserId } = args;
  if (assigneeUserId === undefined || assigneeUserId === workItem.assigneeUserId) return false;

  const ids = [workItem.assigneeUserId, assigneeUserId].filter((id): id is string => id !== null);
  const names = await memberNames(tx, workItem.projectId, ids);
  if (assigneeUserId !== null && !names.has(assigneeUserId)) {
    throw new AppError("NOT_A_MEMBER", "That person isn't a member of this project.");
  }

  await tx.update(workItems).set({ assigneeUserId }).where(eq(workItems.id, workItem.id));

  const person = (id: string | null): Person | null =>
    id === null ? null : { userId: id, name: names.get(id) ?? "Former member" };
  await logActivity(tx, {
    workItemId: workItem.id,
    type: "assignee_changed",
    payload: { from: person(workItem.assigneeUserId), to: person(assigneeUserId) },
  });

  const actor = await getActor();
  if (assigneeUserId !== null && assigneeUserId !== actor?.userId) {
    await tx.insert(notifications).values({
      userId: assigneeUserId,
      type: "work_item_assigned",
      payload: {
        workItemId: workItem.id,
        projectId: workItem.projectId,
        assignedByUserId: actor?.userId ?? null,
        agentName: actor?.agent?.name ?? null,
      },
    });
  }
  return true;
}

/**
 * FR-006: before a member's `project_members` row is deleted (they leave or are
 * removed), log `assignee_changed` with reason "member_left" on each of their
 * Work Items in that project. The delete itself then nulls the assignee through
 * the composite FK's `ON DELETE SET NULL (assignee_user_id)`. No notification (FR-013).
 */
export async function logUnassignOnMemberExitWithinTx(
  tx: Tx,
  args: { projectId: number; userId: string },
): Promise<void> {
  const assigned = await tx
    .select({ id: workItems.id })
    .from(workItems)
    .where(and(eq(workItems.projectId, args.projectId), eq(workItems.assigneeUserId, args.userId)));
  if (assigned.length === 0) return;

  const names = await memberNames(tx, args.projectId, [args.userId]);
  const from: Person = { userId: args.userId, name: names.get(args.userId) ?? "Former member" };
  await logActivity(
    tx,
    assigned.map((row) => ({
      workItemId: row.id,
      type: "assignee_changed",
      payload: { from, to: null, reason: "member_left" },
    })),
  );
}

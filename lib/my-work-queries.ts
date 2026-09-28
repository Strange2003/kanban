import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMembers, projects, stages, workItems } from "@/db/schema";
import type { MyWorkRow } from "@/lib/my-work";

// Plain server-only helper (not a "use server" file: its export would be a
// public endpoint). The caller passes the signed-in user's id.

/**
 * Work Items assigned to `userId` across the projects where they are CURRENTLY
 * a member (Principle IV): the join through `project_members` is what keeps a
 * project the user left out, even if a stale assignee value were ever present.
 */
export async function listAssignedWorkItems(userId: string, includeClosed: boolean): Promise<MyWorkRow[]> {
  const rows = await db
    .select({
      id: workItems.id,
      displayNumber: workItems.displayNumber,
      title: workItems.title,
      priority: workItems.priority,
      targetDate: workItems.targetDate,
      stageName: stages.name,
      isClosed: stages.isClosing,
      projectPublicId: projects.publicId,
      projectName: projects.name,
      prefix: projects.workItemPrefix,
    })
    .from(workItems)
    .innerJoin(projectMembers, and(eq(projectMembers.projectId, workItems.projectId), eq(projectMembers.userId, userId)))
    .innerJoin(projects, eq(projects.id, workItems.projectId))
    .innerJoin(stages, eq(stages.id, workItems.stageId))
    .where(and(eq(workItems.assigneeUserId, userId), includeClosed ? undefined : isNull(workItems.closedAt)));

  return rows.map(({ prefix, ...row }) => ({ ...row, displayId: `${prefix}-${row.displayNumber}` }));
}

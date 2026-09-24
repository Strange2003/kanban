"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workItems, stages, areas, iterations, tags, workItemTags, projectMembers } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { requireProjectMember } from "@/lib/permissions";
import { runAction, type Result } from "@/lib/errors";
import { listCatalog } from "@/lib/work-item-catalogs";
import type { ProjectRole } from "@/lib/roles";
import type { WorkItemViewOptions, WorkItemViewRow } from "@/lib/work-item-view";

export type WorkItemsViewData = {
  rows: WorkItemViewRow[];
  options: WorkItemViewOptions;
  role: ProjectRole;
  projectName: string;
  totalCount: number;
  // Resolves the "Assigned to me" filter (011-agent-access-mcp FR-008).
  currentUserId: string;
};

/**
 * Everything the List and Table views of 009-work-item-views need, in one
 * read per page (no client-chained actions — 005 research.md § Hallazgo).
 * Membership only: every member, Viewers included, may read (FR-017). Every
 * query is scoped to this project (FR-004, SC-004), and no internal column or
 * catalog id leaves the server — columns go by publicId, catalogs by name.
 */
export async function getWorkItemsView(projectPublicId: string): Promise<Result<WorkItemsViewData>> {
  return runAction(async () => {
    const { actor, project, membership } = await requireProjectMember(projectPublicId);

    const itemRows = await db
      .select({
        item: workItems,
        stagePublicId: stages.publicId,
        stageName: stages.name,
        stagePosition: stages.position,
        isClosed: stages.isClosing,
        areaName: areas.name,
        iterationName: iterations.name,
        assigneeName: user.name,
        assigneeImage: user.image,
      })
      .from(workItems)
      .innerJoin(stages, eq(stages.id, workItems.stageId))
      .leftJoin(areas, eq(areas.id, workItems.areaId))
      .leftJoin(iterations, eq(iterations.id, workItems.iterationId))
      .leftJoin(user, eq(user.id, workItems.assigneeUserId))
      .where(eq(workItems.projectId, project.id))
      .orderBy(asc(workItems.displayNumber));

    const tagRows = await db
      .select({ workItemId: workItemTags.workItemId, name: tags.name })
      .from(workItemTags)
      .innerJoin(tags, eq(tags.id, workItemTags.tagId))
      .where(eq(tags.projectId, project.id));
    const tagsByItem = new Map<number, string[]>();
    for (const { workItemId, name } of tagRows) {
      tagsByItem.set(workItemId, [...(tagsByItem.get(workItemId) ?? []), name]);
    }

    const stageRows = await db
      .select({ publicId: stages.publicId, name: stages.name, isClosing: stages.isClosing })
      .from(stages)
      .where(eq(stages.projectId, project.id))
      .orderBy(asc(stages.position));

    const [catalogAreas, catalogIterations, catalogTags, memberRows] = await Promise.all([
      listCatalog("area", project.id),
      listCatalog("iteration", project.id),
      db
        .select({ name: tags.name })
        .from(tags)
        .where(eq(tags.projectId, project.id))
        .orderBy(asc(tags.name)),
      db
        .select({ userId: projectMembers.userId, name: user.name, image: user.image })
        .from(projectMembers)
        .innerJoin(user, eq(user.id, projectMembers.userId))
        .where(eq(projectMembers.projectId, project.id))
        .orderBy(asc(user.name)),
    ]);

    const rows: WorkItemViewRow[] = itemRows.map(({ item, ...joined }) => ({
      id: item.id,
      displayNumber: item.displayNumber,
      displayId: `${project.workItemPrefix}-${item.displayNumber}`,
      title: item.title,
      parentId: item.parentWorkItemId,
      stagePublicId: joined.stagePublicId,
      stageName: joined.stageName,
      stagePosition: joined.stagePosition,
      isClosed: joined.isClosed,
      priority: item.priority,
      severity: item.severity,
      areaName: joined.areaName,
      iterationName: joined.iterationName,
      tags: (tagsByItem.get(item.id) ?? []).sort((a, b) => a.localeCompare(b)),
      assignee:
        item.assigneeUserId !== null
          ? { userId: item.assigneeUserId, name: joined.assigneeName ?? "Unknown", image: joined.assigneeImage }
          : null,
      startDate: item.startDate,
      targetDate: item.targetDate,
      createdAt: item.createdAt,
      closedAt: item.closedAt,
    }));

    return {
      rows,
      options: {
        stages: stageRows,
        areas: catalogAreas,
        iterations: catalogIterations,
        tags: catalogTags.map((t) => t.name),
        members: memberRows,
      },
      role: membership.role,
      projectName: project.name,
      totalCount: rows.length,
      currentUserId: actor.userId,
    };
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { workItems, workItemRelatedLinks, workItemActivity } from "@/db/schema";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { AppError, runAction, type Result } from "@/lib/errors";
import type { ProjectRole } from "@/lib/roles";
import {
  getWorkItemAndProject,
  listProjectTags,
  getWorkItemTags,
  listWorkItemActivity,
} from "@/lib/actions/work-items";

// A Work Item reference as shown in a relations list — enough to render and
// navigate to it without an extra query (FR-009/FR-010 of 005-work-item-relationships).
// `displayNumber` is the segment used to build a link to that Work Item's
// detail view (006-work-item-detail-view) — `displayId` alone isn't enough
// since routes don't repeat the project's prefix (see that feature's research.md).
export type WorkItemRelationRef = {
  id: number;
  displayNumber: number;
  displayId: string;
  title: string;
};

export type WorkItemRelations = {
  parent: WorkItemRelationRef | null;
  children: WorkItemRelationRef[];
  related: WorkItemRelationRef[];
};

function toRef(
  project: { workItemPrefix: string },
  row: { id: number; displayNumber: number; title: string },
): WorkItemRelationRef {
  return {
    id: row.id,
    displayNumber: row.displayNumber,
    displayId: `${project.workItemPrefix}-${row.displayNumber}`,
    title: row.title,
  };
}

// "relacionado con" is symmetric — the pair (X, Y) and (Y, X) must resolve
// to the same row, so both sides always sort into the same order first.
function canonicalPair(x: number, y: number): [number, number] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Computes a Work Item's relations in one round trip. Every mutating action
 * below (`setWorkItemParent`, `removeWorkItemParent`, `linkRelatedWorkItems`,
 * `unlinkRelatedWorkItems`) returns the caller's fresh relations directly
 * from this same helper, instead of having the client make a *second*
 * Server Action call right after the mutation to re-fetch them — chaining
 * two Server Action requests back-to-back from the client turned out to
 * hang intermittently in this app's Next.js dev setup (Server Actions +
 * `revalidatePath`), so the fix is to not need that second round trip at
 * all, not to work around the hang client-side.
 */
async function computeWorkItemRelations(
  workItem: { id: number; parentWorkItemId: number | null },
  project: { workItemPrefix: string },
): Promise<WorkItemRelations> {
  let parent: WorkItemRelationRef | null = null;
  if (workItem.parentWorkItemId !== null) {
    const [parentRow] = await db
      .select({
        id: workItems.id,
        displayNumber: workItems.displayNumber,
        title: workItems.title,
      })
      .from(workItems)
      .where(eq(workItems.id, workItem.parentWorkItemId))
      .limit(1);
    if (parentRow) parent = toRef(project, parentRow);
  }

  const childRows = await db
    .select({
      id: workItems.id,
      displayNumber: workItems.displayNumber,
      title: workItems.title,
    })
    .from(workItems)
    .where(eq(workItems.parentWorkItemId, workItem.id))
    .orderBy(asc(workItems.displayNumber));

  const relatedRows = await db
    .select({
      id: workItems.id,
      displayNumber: workItems.displayNumber,
      title: workItems.title,
    })
    .from(workItemRelatedLinks)
    .innerJoin(
      workItems,
      or(
        and(
          eq(workItemRelatedLinks.workItemIdA, workItem.id),
          eq(workItems.id, workItemRelatedLinks.workItemIdB),
        ),
        and(
          eq(workItemRelatedLinks.workItemIdB, workItem.id),
          eq(workItems.id, workItemRelatedLinks.workItemIdA),
        ),
      ),
    )
    .orderBy(asc(workItems.displayNumber));

  return {
    parent,
    children: childRows.map((row) => toRef(project, row)),
    related: relatedRows.map((row) => toRef(project, row)),
  };
}

/**
 * Does `candidateAncestorId` appear in `descendantId`'s chain of ancestors
 * (its parent, grandparent, ...)? Used to reject a `setWorkItemParent` call
 * that would create a cycle (FR-004 of 005-work-item-relationships) —
 * anidación arbitraria means the chain can be any number of levels deep, so
 * this walks the whole thing via a recursive CTE rather than checking only
 * the direct parent (research.md § Detección de ciclos).
 */
export async function workItemIsAncestorOf(
  candidateAncestorId: number,
  descendantId: number,
): Promise<boolean> {
  const result = await db.execute<{ id: number }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT parent_work_item_id AS id FROM work_items WHERE id = ${descendantId}
      UNION ALL
      SELECT wi.parent_work_item_id AS id FROM work_items wi INNER JOIN ancestors a ON wi.id = a.id
    )
    SELECT id FROM ancestors WHERE id = ${candidateAncestorId}
  `);
  return result.rows.length > 0;
}

// FR-001/FR-002/FR-004/FR-007/FR-014 of 005-work-item-relationships
export async function setWorkItemParent(input: {
  workItemId: number;
  parentWorkItemId: number;
}): Promise<Result<WorkItemRelations>> {
  return runAction(async () => {
    if (input.workItemId === input.parentWorkItemId) {
      throw new AppError("SELF_PARENT", "A Work Item cannot be its own parent.");
    }

    const { workItem, project } = await getWorkItemAndProject(input.workItemId);
    const { workItem: parentWorkItem, project: parentProject } =
      await getWorkItemAndProject(input.parentWorkItemId);

    if (project.id !== parentProject.id) {
      throw new AppError(
        "DIFFERENT_PROJECT",
        "Both Work Items must belong to the same project.",
      );
    }

    await requireProjectPermission(project.publicId, "relationship:edit");

    if (workItem.parentWorkItemId !== null) {
      throw new AppError(
        "ALREADY_HAS_PARENT",
        "This Work Item already has a parent. Remove it first.",
      );
    }

    if (await workItemIsAncestorOf(workItem.id, parentWorkItem.id)) {
      throw new AppError(
        "CYCLE_DETECTED",
        "This would create a cycle in the parent/child hierarchy.",
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(workItems)
        .set({ parentWorkItemId: parentWorkItem.id, updatedAt: new Date() })
        .where(eq(workItems.id, workItem.id));

      // Estándares de Producto y Datos § Auditoría de la constitución.
      await tx.insert(workItemActivity).values({
        workItemId: workItem.id,
        type: "parent_linked",
        payload: { parentWorkItemId: parentWorkItem.id },
      });
    });

    revalidatePath(`/projects/${project.publicId}`);
    return computeWorkItemRelations(
      { id: workItem.id, parentWorkItemId: parentWorkItem.id },
      project,
    );
  });
}

// FR-008/FR-014 of 005-work-item-relationships (parent/child side)
export async function removeWorkItemParent(
  workItemId: number,
): Promise<Result<WorkItemRelations>> {
  return runAction(async () => {
    const { workItem, project } = await getWorkItemAndProject(workItemId);
    await requireProjectPermission(project.publicId, "relationship:edit");

    if (workItem.parentWorkItemId === null) {
      return computeWorkItemRelations(workItem, project);
    }

    const previousParentWorkItemId = workItem.parentWorkItemId;

    await db.transaction(async (tx) => {
      await tx
        .update(workItems)
        .set({ parentWorkItemId: null, updatedAt: new Date() })
        .where(eq(workItems.id, workItem.id));

      await tx.insert(workItemActivity).values({
        workItemId: workItem.id,
        type: "parent_unlinked",
        payload: { previousParentWorkItemId },
      });
    });

    revalidatePath(`/projects/${project.publicId}`);
    return computeWorkItemRelations({ id: workItem.id, parentWorkItemId: null }, project);
  });
}

// FR-005/FR-006/FR-007/FR-014 of 005-work-item-relationships
export async function linkRelatedWorkItems(input: {
  workItemIdX: number;
  workItemIdY: number;
}): Promise<Result<WorkItemRelations>> {
  return runAction(async () => {
    if (input.workItemIdX === input.workItemIdY) {
      throw new AppError("SELF_RELATION", "A Work Item cannot be related to itself.");
    }

    const { workItem: workItemX, project: projectX } = await getWorkItemAndProject(
      input.workItemIdX,
    );
    const { workItem: workItemY, project: projectY } = await getWorkItemAndProject(
      input.workItemIdY,
    );

    if (projectX.id !== projectY.id) {
      throw new AppError(
        "DIFFERENT_PROJECT",
        "Both Work Items must belong to the same project.",
      );
    }

    await requireProjectPermission(projectX.publicId, "relationship:edit");

    const [workItemIdA, workItemIdB] = canonicalPair(workItemX.id, workItemY.id);

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workItemRelatedLinks)
        .values({ workItemIdA, workItemIdB })
        .onConflictDoNothing({
          target: [workItemRelatedLinks.workItemIdA, workItemRelatedLinks.workItemIdB],
        })
        .returning();

      // No row created => the link already existed (FR-006) — don't log it again.
      if (!created) return;

      await tx.insert(workItemActivity).values([
        {
          workItemId: workItemIdA,
          type: "related_linked",
          payload: { relatedWorkItemId: workItemIdB },
        },
        {
          workItemId: workItemIdB,
          type: "related_linked",
          payload: { relatedWorkItemId: workItemIdA },
        },
      ]);
    });

    revalidatePath(`/projects/${projectX.publicId}`);
    return computeWorkItemRelations(workItemX, projectX);
  });
}

// FR-008/FR-014 of 005-work-item-relationships ("relacionado con" side)
export async function unlinkRelatedWorkItems(input: {
  workItemIdX: number;
  workItemIdY: number;
}): Promise<Result<WorkItemRelations>> {
  return runAction(async () => {
    const { workItem: workItemX, project } = await getWorkItemAndProject(
      input.workItemIdX,
    );
    await requireProjectPermission(project.publicId, "relationship:edit");

    const [workItemIdA, workItemIdB] = canonicalPair(
      input.workItemIdX,
      input.workItemIdY,
    );

    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(workItemRelatedLinks)
        .where(
          and(
            eq(workItemRelatedLinks.workItemIdA, workItemIdA),
            eq(workItemRelatedLinks.workItemIdB, workItemIdB),
          ),
        )
        .returning();

      if (deleted.length === 0) return;

      await tx.insert(workItemActivity).values([
        {
          workItemId: workItemIdA,
          type: "related_unlinked",
          payload: { relatedWorkItemId: workItemIdB },
        },
        {
          workItemId: workItemIdB,
          type: "related_unlinked",
          payload: { relatedWorkItemId: workItemIdA },
        },
      ]);
    });

    revalidatePath(`/projects/${project.publicId}`);
    return computeWorkItemRelations(workItemX, project);
  });
}

// FR-009/FR-010 of 005-work-item-relationships; also the data contract the
// future dedicated detail view will reuse (data-model.md § Datos expuestos).
export async function getWorkItemRelations(
  workItemId: number,
): Promise<Result<WorkItemRelations>> {
  return runAction(async () => {
    const { workItem, project } = await getWorkItemAndProject(workItemId);
    await requireProjectMember(project.publicId);

    return computeWorkItemRelations(workItem, project);
  });
}

// Supports the "set as parent" / "relate to" pickers in WorkItemDetailView
// — same role that listProjectTags plays for TagPicker in work-items.ts.
export async function listProjectWorkItems(
  projectPublicId: string,
  excludeWorkItemId?: number,
): Promise<Result<WorkItemRelationRef[]>> {
  return runAction(async () => {
    const { project } = await requireProjectMember(projectPublicId);

    const rows = await db
      .select({
        id: workItems.id,
        displayNumber: workItems.displayNumber,
        title: workItems.title,
      })
      .from(workItems)
      .where(eq(workItems.projectId, project.id))
      .orderBy(asc(workItems.displayNumber));

    return rows
      .filter((row) => row.id !== excludeWorkItemId)
      .map((row) => toRef(project, row));
  });
}

export type WorkItemDetailData = {
  catalogTags: string[];
  itemTags: string[];
  activity: (typeof workItemActivity.$inferSelect)[];
  relations: WorkItemRelations;
  pickableWorkItems: WorkItemRelationRef[];
  // The caller's current role in the project (FR-005 of 007-roles-permissions):
  // lets the detail view render read-only for a Viewer.
  role: ProjectRole;
};

/**
 * Everything `WorkItemDetailPanel` needs to render a Work Item, in a single
 * Server Action call. Opening the panel used to fire 5 separate Server
 * Actions at once from the client (`Promise.all`); that concurrent-calls
 * pattern is what turned out to hang intermittently in this app's Next.js
 * dev setup (see research.md § Hallazgo). The 5 underlying queries still run
 * concurrently here — that's fine, because inside one Server Action they're
 * just function calls in the same request, not separate client-server round
 * trips.
 */
export async function getWorkItemDetailData(
  workItemId: number,
  projectPublicId: string,
): Promise<Result<WorkItemDetailData>> {
  return runAction(async () => {
    const [
      { membership },
      catalogResult,
      itemTagsResult,
      activityResult,
      relationsResult,
      pickableResult,
    ] = await Promise.all([
      requireProjectMember(projectPublicId),
      listProjectTags(projectPublicId),
      getWorkItemTags(workItemId),
      listWorkItemActivity(workItemId),
      getWorkItemRelations(workItemId),
      listProjectWorkItems(projectPublicId, workItemId),
    ]);

    if (!catalogResult.ok)
      throw new AppError(catalogResult.error.code, catalogResult.error.message);
    if (!itemTagsResult.ok)
      throw new AppError(itemTagsResult.error.code, itemTagsResult.error.message);
    if (!activityResult.ok)
      throw new AppError(activityResult.error.code, activityResult.error.message);
    if (!relationsResult.ok)
      throw new AppError(relationsResult.error.code, relationsResult.error.message);
    if (!pickableResult.ok)
      throw new AppError(pickableResult.error.code, pickableResult.error.message);

    return {
      catalogTags: catalogResult.data.map((t) => t.name),
      itemTags: itemTagsResult.data.map((t) => t.name),
      activity: activityResult.data,
      relations: relationsResult.data,
      pickableWorkItems: pickableResult.data,
      role: membership.role,
    };
  });
}

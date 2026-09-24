"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stages, workItems } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { generatePublicId } from "@/lib/ids";
import { AppError, runAction, type Result } from "@/lib/errors";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import type { AssigneeView } from "@/lib/work-item-view";
import { user } from "@/db/auth-schema";

/** A Work Item on the board, with its assignee (FR-007 of 011-agent-access-mcp). */
export type BoardWorkItem = WorkItemWithDisplayId & { assignee: AssigneeView | null };
import type { ProjectRole } from "@/lib/roles";

export type StageWithCount = typeof stages.$inferSelect & { workItemCount: number };

// FR-001 of 003-kanban-board. Also returns the caller's current role in the
// project (FR-005 of 007-roles-permissions) so the page can render read-only
// for a Viewer; reading the board itself only needs membership.
export async function getBoard(
  projectPublicId: string,
): Promise<Result<{ stages: StageWithCount[]; workItems: BoardWorkItem[]; role: ProjectRole; projectName: string }>> {
  return runAction(async () => {
    const { project, membership } = await requireProjectMember(projectPublicId);

    const stageRows = await db
      .select({
        stage: stages,
        workItemCount: sql<number>`count(${workItems.id})`.mapWith(Number),
      })
      .from(stages)
      .leftJoin(workItems, eq(workItems.stageId, stages.id))
      .where(eq(stages.projectId, project.id))
      .groupBy(stages.id)
      .orderBy(asc(stages.position));

    const workItemRows = await db
      .select({ workItem: workItems, assigneeName: user.name, assigneeImage: user.image })
      .from(workItems)
      .leftJoin(user, eq(user.id, workItems.assigneeUserId))
      .where(eq(workItems.projectId, project.id))
      .orderBy(asc(workItems.position));

    return {
      stages: stageRows.map((r) => ({ ...r.stage, workItemCount: r.workItemCount })),
      workItems: workItemRows.map(({ workItem: wi, assigneeName, assigneeImage }) => ({
        ...wi,
        displayId: `${project.workItemPrefix}-${wi.displayNumber}`,
        assignee:
          wi.assigneeUserId !== null
            ? { userId: wi.assigneeUserId, name: assigneeName ?? "Unknown", image: assigneeImage }
            : null,
      })),
      role: membership.role,
      projectName: project.name,
    };
  });
}

const createStageSchema = z.object({
  name: z.string().trim().min(1, "Column name is required."),
});

// FR-002/FR-003/FR-004 of 003-kanban-board: creating a column creates its
// stage in the same operation — they're the same row (Principle III).
export async function createStage(input: {
  projectPublicId: string;
  name: string;
}): Promise<Result<typeof stages.$inferSelect>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "board:edit");

    const parsed = createStageSchema.safeParse({ name: input.name });
    if (!parsed.success) {
      throw new AppError("NAME_REQUIRED", parsed.error.issues[0]?.message ?? "Column name is required.");
    }

    const [maxRow] = await db
      .select({ maxPosition: sql<number | null>`max(${stages.position})` })
      .from(stages)
      .where(eq(stages.projectId, project.id));

    const [created] = await db
      .insert(stages)
      .values({
        publicId: generatePublicId(),
        projectId: project.id,
        name: parsed.data.name,
        position: (maxRow?.maxPosition ?? -1) + 1,
      })
      .returning();

    if (!created) throw new AppError("UNKNOWN_ERROR", "Could not create the column.");

    revalidatePath(`/projects/${input.projectPublicId}`);
    return created;
  });
}

// FR-005/FR-011 of 003-kanban-board
export async function reorderStages(input: {
  projectPublicId: string;
  orderedStageIds: string[];
}): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "board:edit");

    await db.transaction(async (tx) => {
      for (const [index, stagePublicId] of input.orderedStageIds.entries()) {
        await tx
          .update(stages)
          .set({ position: index })
          .where(and(eq(stages.publicId, stagePublicId), eq(stages.projectId, project.id)));
      }
    });

    revalidatePath(`/projects/${input.projectPublicId}`);
  });
}

const renameStageSchema = z.object({
  name: z.string().trim().min(1, "Column name is required."),
});

// FR-008 of 003-kanban-board
export async function renameStage(input: {
  projectPublicId: string;
  stageId: string;
  name: string;
}): Promise<Result<typeof stages.$inferSelect>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "board:edit");

    const parsed = renameStageSchema.safeParse({ name: input.name });
    if (!parsed.success) {
      throw new AppError("NAME_REQUIRED", parsed.error.issues[0]?.message ?? "Column name is required.");
    }

    const [updated] = await db
      .update(stages)
      .set({ name: parsed.data.name })
      .where(and(eq(stages.publicId, input.stageId), eq(stages.projectId, project.id)))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Column not found.");

    revalidatePath(`/projects/${input.projectPublicId}`);
    return updated;
  });
}

// FR-006/FR-007 of 003-kanban-board
export async function deleteStage(input: { projectPublicId: string; stageId: string }): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "board:edit");

    const [stage] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.publicId, input.stageId), eq(stages.projectId, project.id)))
      .limit(1);
    if (!stage) throw new AppError("NOT_FOUND", "Column not found.");

    const [itemCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workItems)
      .where(eq(workItems.stageId, stage.id));
    if ((itemCount?.count ?? 0) > 0) {
      throw new AppError("STAGE_NOT_EMPTY", "Move or delete this column's Work Items before deleting it.");
    }

    await db.delete(stages).where(eq(stages.id, stage.id));

    revalidatePath(`/projects/${input.projectPublicId}`);
  });
}

// FR-011/FR-013 of 008-work-item-fields: marking a column as closing closes
// every Work Item in it (closed_at = now), unmarking reopens them all. The
// stage row is locked FOR UPDATE so it serializes with moves into or out of
// it, which lock the same row FOR SHARE (research.md § Concurrencia) — no
// Work Item can end up on the wrong side of the closing invariant (SC-006).
export async function setStageClosing(input: {
  projectPublicId: string;
  stagePublicId: string;
  isClosing: boolean;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "board:edit");

    await db.transaction(async (tx) => {
      const [stage] = await tx
        .select()
        .from(stages)
        .where(and(eq(stages.publicId, input.stagePublicId), eq(stages.projectId, project.id)))
        .limit(1)
        .for("update");
      if (!stage) throw new AppError("NOT_FOUND", "Column not found.");
      // Idempotent: re-sending the current value writes nothing and logs nothing.
      if (stage.isClosing === input.isClosing) return;

      await tx.update(stages).set({ isClosing: input.isClosing }).where(eq(stages.id, stage.id));

      const now = new Date();
      const affected = await tx
        .update(workItems)
        .set({ closedAt: input.isClosing ? now : null, updatedAt: now })
        .where(eq(workItems.stageId, stage.id))
        .returning({ id: workItems.id });

      // Estándares de Producto y Datos § Auditoría: one event per Work Item, in one insert.
      if (affected.length > 0) {
        await logActivity(tx, 
          affected.map(({ id }) =>
            input.isClosing
              ? {
                  workItemId: id,
                  type: "closed",
                  payload: { closedAt: now.toISOString(), stageName: stage.name, via: "stage_marked" },
                }
              : { workItemId: id, type: "reopened", payload: { stageName: stage.name, via: "stage_unmarked" } },
          ),
        );
      }
    });

    revalidatePath(`/projects/${input.projectPublicId}`);
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { workItems, stages, projects, workItemActivity } from "@/db/schema";
import { requireProjectMember } from "@/lib/permissions";
import { AppError, runAction, type Result } from "@/lib/errors";

export type WorkItemWithDisplayId = typeof workItems.$inferSelect & { displayId: string };

async function getStageAndProject(stagePublicId: string) {
  const [stage] = await db.select().from(stages).where(eq(stages.publicId, stagePublicId)).limit(1);
  if (!stage) throw new AppError("NOT_FOUND", "Column not found.");

  const [project] = await db.select().from(projects).where(eq(projects.id, stage.projectId)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");

  return { stage, project };
}

const createWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
});

// FR-001/FR-002/FR-003/FR-004 of 004-work-items
export async function createWorkItem(input: {
  stagePublicId: string;
  title: string;
}): Promise<Result<WorkItemWithDisplayId>> {
  return runAction(async () => {
    const { stage, project } = await getStageAndProject(input.stagePublicId);
    await requireProjectMember(project.publicId);

    const parsed = createWorkItemSchema.safeParse({ title: input.title });
    if (!parsed.success) {
      throw new AppError("TITLE_REQUIRED", parsed.error.issues[0]?.message ?? "Title is required.");
    }

    const workItem = await db.transaction(async (tx) => {
      // Atomic per-project counter -> the human-readable displayId (e.g. "KAN-42").
      const [updatedProject] = await tx
        .update(projects)
        .set({ nextWorkItemNumber: sql`${projects.nextWorkItemNumber} + 1` })
        .where(eq(projects.id, project.id))
        .returning({ nextWorkItemNumber: projects.nextWorkItemNumber });

      if (!updatedProject) throw new AppError("UNKNOWN_ERROR", "Could not allocate a Work Item number.");

      const [maxRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${workItems.position})` })
        .from(workItems)
        .where(eq(workItems.stageId, stage.id));

      const [created] = await tx
        .insert(workItems)
        .values({
          projectId: project.id,
          stageId: stage.id,
          displayNumber: updatedProject.nextWorkItemNumber,
          title: parsed.data.title,
          position: (maxRow?.maxPosition ?? -1) + 1,
        })
        .returning();

      if (!created) throw new AppError("UNKNOWN_ERROR", "Could not create the Work Item.");
      return created;
    });

    revalidatePath(`/projects/${project.publicId}`);
    return { ...workItem, displayId: `${project.workItemPrefix}-${workItem.displayNumber}` };
  });
}

// FR-005 of 004-work-items
export async function moveWorkItem(input: {
  workItemId: number;
  toStageId: number;
  toPosition: number;
}): Promise<Result<void>> {
  return runAction(async () => {
    const [workItem] = await db.select().from(workItems).where(eq(workItems.id, input.workItemId)).limit(1);
    if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");

    const [project] = await db.select().from(projects).where(eq(projects.id, workItem.projectId)).limit(1);
    if (!project) throw new AppError("NOT_FOUND", "Project not found.");

    await requireProjectMember(project.publicId);

    const fromStageId = workItem.stageId;

    await db.transaction(async (tx) => {
      // Close the gap left behind in the origin stage.
      await tx
        .update(workItems)
        .set({ position: sql`${workItems.position} - 1` })
        .where(and(eq(workItems.stageId, fromStageId), gt(workItems.position, workItem.position)));

      // Make room at the target position in the destination stage.
      await tx
        .update(workItems)
        .set({ position: sql`${workItems.position} + 1` })
        .where(and(eq(workItems.stageId, input.toStageId), gte(workItems.position, input.toPosition)));

      await tx
        .update(workItems)
        .set({ stageId: input.toStageId, position: input.toPosition, updatedAt: new Date() })
        .where(eq(workItems.id, input.workItemId));

      // Estándares de Producto y Datos § Auditoría de la constitución.
      await tx.insert(workItemActivity).values({
        workItemId: input.workItemId,
        type: "stage_changed",
        payload: { fromStageId, toStageId: input.toStageId },
      });
    });

    revalidatePath(`/projects/${project.publicId}`);
  });
}

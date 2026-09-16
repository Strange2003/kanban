"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stages, workItems } from "@/db/schema";
import { requireProjectMember } from "@/lib/permissions";
import { generatePublicId } from "@/lib/ids";
import { AppError, runAction, type Result } from "@/lib/errors";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";

export type StageWithCount = typeof stages.$inferSelect & { workItemCount: number };

// FR-001 of 003-kanban-board
export async function getBoard(
  projectPublicId: string,
): Promise<Result<{ stages: StageWithCount[]; workItems: WorkItemWithDisplayId[] }>> {
  return runAction(async () => {
    const { project } = await requireProjectMember(projectPublicId);

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
      .select()
      .from(workItems)
      .where(eq(workItems.projectId, project.id))
      .orderBy(asc(workItems.position));

    return {
      stages: stageRows.map((r) => ({ ...r.stage, workItemCount: r.workItemCount })),
      workItems: workItemRows.map((wi) => ({
        ...wi,
        displayId: `${project.workItemPrefix}-${wi.displayNumber}`,
      })),
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
    const { project } = await requireProjectMember(input.projectPublicId);

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

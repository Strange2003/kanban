"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { workItems, stages, projects, workItemActivity, tags, workItemTags } from "@/db/schema";
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

async function getWorkItemAndProject(workItemId: number) {
  const [workItem] = await db.select().from(workItems).where(eq(workItems.id, workItemId)).limit(1);
  if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");

  const [project] = await db.select().from(projects).where(eq(projects.id, workItem.projectId)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");

  return { workItem, project };
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

// FR-006 of 004-work-items
export async function reorderWorkItemsInStage(input: {
  stageId: number;
  orderedWorkItemIds: number[];
}): Promise<Result<void>> {
  return runAction(async () => {
    const [stage] = await db.select().from(stages).where(eq(stages.id, input.stageId)).limit(1);
    if (!stage) throw new AppError("NOT_FOUND", "Column not found.");

    const [project] = await db.select().from(projects).where(eq(projects.id, stage.projectId)).limit(1);
    if (!project) throw new AppError("NOT_FOUND", "Project not found.");

    await requireProjectMember(project.publicId);

    await db.transaction(async (tx) => {
      for (const [index, workItemId] of input.orderedWorkItemIds.entries()) {
        await tx
          .update(workItems)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(workItems.id, workItemId), eq(workItems.stageId, input.stageId)));
      }
    });

    revalidatePath(`/projects/${project.publicId}`);
  });
}

const updateWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  description: z.string().optional(),
  stakeholder: z.string().optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
});

// FR-007/FR-008/FR-009/FR-012/FR-013 of 004-work-items
export async function updateWorkItem(input: {
  workItemId: number;
  title?: string;
  description?: string;
  stakeholder?: string;
  tagNames?: string[];
}): Promise<Result<WorkItemWithDisplayId>> {
  return runAction(async () => {
    const { workItem, project } = await getWorkItemAndProject(input.workItemId);
    await requireProjectMember(project.publicId);

    const parsed = updateWorkItemSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const updates: Partial<typeof workItems.$inferInsert> = {};

    if (parsed.data.title !== undefined && parsed.data.title !== workItem.title) {
      changedFields.title = { from: workItem.title, to: parsed.data.title };
      updates.title = parsed.data.title;
    }
    if (parsed.data.description !== undefined && parsed.data.description !== (workItem.description ?? "")) {
      changedFields.description = { from: workItem.description, to: parsed.data.description };
      updates.description = parsed.data.description || null;
    }
    if (parsed.data.stakeholder !== undefined && parsed.data.stakeholder !== (workItem.stakeholder ?? "")) {
      changedFields.stakeholder = { from: workItem.stakeholder, to: parsed.data.stakeholder };
      updates.stakeholder = parsed.data.stakeholder || null;
    }

    const updated = await db.transaction(async (tx) => {
      let current = workItem;
      if (Object.keys(updates).length > 0) {
        const [row] = await tx
          .update(workItems)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(workItems.id, workItem.id))
          .returning();
        if (!row) throw new AppError("UNKNOWN_ERROR", "Could not update the Work Item.");
        current = row;
      }

      // FR-012: reuse existing catalog tags (case-insensitive), create the rest.
      if (parsed.data.tagNames !== undefined) {
        const currentTagRows = await tx
          .select({ name: tags.name })
          .from(workItemTags)
          .innerJoin(tags, eq(tags.id, workItemTags.tagId))
          .where(eq(workItemTags.workItemId, workItem.id));
        const currentNames = currentTagRows.map((t) => t.name).sort();
        const nextNames = [...new Set(parsed.data.tagNames.map((n) => n.trim()).filter(Boolean))].sort();

        if (JSON.stringify(currentNames) !== JSON.stringify(nextNames)) {
          const resolvedTagIds: number[] = [];
          for (const name of nextNames) {
            const [existingTag] = await tx
              .select()
              .from(tags)
              .where(and(eq(tags.projectId, project.id), sql`lower(${tags.name}) = lower(${name})`))
              .limit(1);
            const tag =
              existingTag ?? (await tx.insert(tags).values({ projectId: project.id, name }).returning())[0];
            if (tag) resolvedTagIds.push(tag.id);
          }

          await tx.delete(workItemTags).where(eq(workItemTags.workItemId, workItem.id));
          if (resolvedTagIds.length > 0) {
            await tx
              .insert(workItemTags)
              .values(resolvedTagIds.map((tagId) => ({ workItemId: workItem.id, tagId })));
          }
          changedFields.tags = { from: currentNames, to: nextNames };
        }
      }

      // Estándares de Producto y Datos § Auditoría de la constitución.
      if (Object.keys(changedFields).length > 0) {
        await tx.insert(workItemActivity).values({
          workItemId: workItem.id,
          type: "fields_edited",
          payload: { fields: changedFields },
        });
      }

      return current;
    });

    revalidatePath(`/projects/${project.publicId}`);
    return { ...updated, displayId: `${project.workItemPrefix}-${updated.displayNumber}` };
  });
}

// Supports updateWorkItem's tag selector (FR-012 of 004-work-items).
export async function listProjectTags(projectPublicId: string): Promise<Result<(typeof tags.$inferSelect)[]>> {
  return runAction(async () => {
    const { project } = await requireProjectMember(projectPublicId);
    return db.select().from(tags).where(eq(tags.projectId, project.id)).orderBy(asc(tags.name));
  });
}

// The tags currently applied to one Work Item, for WorkItemDetailPanel/TagPicker.
export async function getWorkItemTags(workItemId: number): Promise<Result<(typeof tags.$inferSelect)[]>> {
  return runAction(async () => {
    const { project } = await getWorkItemAndProject(workItemId);
    await requireProjectMember(project.publicId);

    const rows = await db
      .select({ tag: tags })
      .from(workItemTags)
      .innerJoin(tags, eq(tags.id, workItemTags.tagId))
      .where(eq(workItemTags.workItemId, workItemId));
    return rows.map((r) => r.tag);
  });
}

// Estándares de Producto y Datos § Auditoría de la constitución.
export async function listWorkItemActivity(
  workItemId: number,
): Promise<Result<(typeof workItemActivity.$inferSelect)[]>> {
  return runAction(async () => {
    const { project } = await getWorkItemAndProject(workItemId);
    await requireProjectMember(project.publicId);

    return db
      .select()
      .from(workItemActivity)
      .where(eq(workItemActivity.workItemId, workItemId))
      .orderBy(desc(workItemActivity.createdAt));
  });
}

// FR-010/FR-011 of 004-work-items
export async function deleteWorkItem(workItemId: number): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await getWorkItemAndProject(workItemId);
    await requireProjectMember(project.publicId);

    await db.delete(workItems).where(eq(workItems.id, workItemId));

    revalidatePath(`/projects/${project.publicId}`);
  });
}

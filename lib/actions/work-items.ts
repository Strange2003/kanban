"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { workItems, stages, projects, workItemActivity, tags, workItemTags, areas, iterations } from "@/db/schema";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { AppError, runAction, type Result } from "@/lib/errors";
import { getWorkItemAndProject } from "@/lib/work-item-queries";
import { resolveCatalogValue, type CatalogKind } from "@/lib/work-item-catalogs";
import { WORK_ITEM_LEVELS, type WorkItemLevel } from "@/lib/work-item-fields";
import { nextClosedAt } from "@/lib/work-item-closing";

export type WorkItemWithDisplayId = typeof workItems.$inferSelect & { displayId: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StageRow = typeof stages.$inferSelect;
type WorkItemRow = typeof workItems.$inferSelect;

// Re-reads stage rows inside a transaction with FOR SHARE: setStageClosing takes
// FOR UPDATE on the stage it changes, so a move and a (un)mark of the same
// column serialize and the closing invariant can't be broken by a race
// (008-work-item-fields research.md § Concurrencia). Moves don't block each other.
async function lockStagesForShare(tx: Tx, stageIds: number[]): Promise<Map<number, StageRow>> {
  const rows = await tx.select().from(stages).where(inArray(stages.id, stageIds)).for("share");
  return new Map(rows.map((r) => [r.id, r]));
}

// Shared by moveWorkItem and closeWorkItem — NOT exported: every export of a
// "use server" file is a public endpoint (AGENTS.md). Moves the Work Item and
// keeps `closed_at` in line with its column through nextClosedAt (FR-012/FR-013),
// logging stage_changed plus closed/reopened when the state flips (FR-020).
async function moveWithinTx(
  tx: Tx,
  args: {
    workItem: WorkItemRow;
    fromStage: StageRow;
    toStage: StageRow;
    toPosition: number;
    via: "move" | "close_button";
  },
) {
  const { workItem, fromStage, toStage, toPosition, via } = args;
  const now = new Date();
  const transition = nextClosedAt({
    fromIsClosing: fromStage.isClosing,
    toIsClosing: toStage.isClosing,
    currentClosedAt: workItem.closedAt,
    now,
  });

  // Close the gap left behind in the origin stage.
  await tx
    .update(workItems)
    .set({ position: sql`${workItems.position} - 1` })
    .where(and(eq(workItems.stageId, fromStage.id), gt(workItems.position, workItem.position)));

  // Make room at the target position in the destination stage.
  await tx
    .update(workItems)
    .set({ position: sql`${workItems.position} + 1` })
    .where(and(eq(workItems.stageId, toStage.id), gte(workItems.position, toPosition)));

  await tx
    .update(workItems)
    .set({ stageId: toStage.id, position: toPosition, closedAt: transition.closedAt, updatedAt: now })
    .where(eq(workItems.id, workItem.id));

  // Estándares de Producto y Datos § Auditoría de la constitución.
  await tx.insert(workItemActivity).values({
    workItemId: workItem.id,
    type: "stage_changed",
    payload: { fromStageId: fromStage.id, toStageId: toStage.id },
  });
  if (transition.event === "closed") {
    await tx.insert(workItemActivity).values({
      workItemId: workItem.id,
      type: "closed",
      payload: { closedAt: transition.closedAt.toISOString(), stageName: toStage.name, via },
    });
  } else if (transition.event === "reopened") {
    await tx.insert(workItemActivity).values({
      workItemId: workItem.id,
      type: "reopened",
      payload: { stageName: toStage.name, via: "move" },
    });
  }
}

async function getStageAndProject(stagePublicId: string) {
  const [stage] = await db.select().from(stages).where(eq(stages.publicId, stagePublicId)).limit(1);
  if (!stage) throw new AppError("NOT_FOUND", "Column not found.");

  const [project] = await db.select().from(projects).where(eq(projects.id, stage.projectId)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");

  return { stage, project };
}

// Resolves the URL segment of the dedicated detail view (FR-001/FR-010/FR-011
// of 006-work-item-detail-view) — `displayNumber` is scoped by project, so a
// project a caller isn't a member of never leaks whether a given number
// exists there (requireProjectMember runs before the lookup).
export async function getWorkItemByDisplayNumber(
  projectPublicId: string,
  displayNumber: number,
): Promise<Result<WorkItemWithDisplayId>> {
  return runAction(async () => {
    const { project } = await requireProjectMember(projectPublicId);

    const [workItem] = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.projectId, project.id), eq(workItems.displayNumber, displayNumber)))
      .limit(1);
    if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");

    return { ...workItem, displayId: `${project.workItemPrefix}-${workItem.displayNumber}` };
  });
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
    await requireProjectPermission(project.publicId, "workItem:edit");

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

      // Born in a closing column → born closed (008-work-item-fields Edge Cases, FR-013).
      const lockedStage = (await lockStagesForShare(tx, [stage.id])).get(stage.id) ?? stage;
      const transition = nextClosedAt({
        fromIsClosing: null,
        toIsClosing: lockedStage.isClosing,
        currentClosedAt: null,
        now: new Date(),
      });

      const [created] = await tx
        .insert(workItems)
        .values({
          projectId: project.id,
          stageId: stage.id,
          displayNumber: updatedProject.nextWorkItemNumber,
          title: parsed.data.title,
          position: (maxRow?.maxPosition ?? -1) + 1,
          closedAt: transition.closedAt,
        })
        .returning();

      if (!created) throw new AppError("UNKNOWN_ERROR", "Could not create the Work Item.");
      if (transition.event === "closed") {
        await tx.insert(workItemActivity).values({
          workItemId: created.id,
          type: "closed",
          payload: { closedAt: transition.closedAt.toISOString(), stageName: lockedStage.name, via: "created" },
        });
      }
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

    await requireProjectPermission(project.publicId, "workItem:edit");

    // Principle IV: `toStageId` comes from the client, so it must be a column of
    // this Work Item's own project — the permission check above only covers the
    // Work Item's project (008-work-item-fields research.md § Hallazgo).
    const [toStage] = await db.select().from(stages).where(eq(stages.id, input.toStageId)).limit(1);
    if (!toStage || toStage.projectId !== workItem.projectId) {
      throw new AppError("NOT_FOUND", "Column not found.");
    }

    await db.transaction(async (tx) => {
      const locked = await lockStagesForShare(tx, [workItem.stageId, toStage.id]);
      const fromStage = locked.get(workItem.stageId);
      const lockedToStage = locked.get(toStage.id);
      if (!fromStage || !lockedToStage) throw new AppError("NOT_FOUND", "Column not found.");

      await moveWithinTx(tx, {
        workItem,
        fromStage,
        toStage: lockedToStage,
        toPosition: input.toPosition,
        via: "move",
      });
    });

    revalidatePath(`/projects/${project.publicId}`);
  });
}

// FR-014 of 008-work-item-fields: the "Close" button moves the Work Item to
// the end of the project's first closing column, which closes it exactly as
// dragging it there would. The server picks the column inside the transaction,
// so a mark changing meanwhile can't send it somewhere stale.
export async function closeWorkItem(workItemId: number): Promise<Result<void>> {
  return runAction(async () => {
    const { workItem, project } = await getWorkItemAndProject(workItemId);
    await requireProjectPermission(project.publicId, "workItem:edit");

    await db.transaction(async (tx) => {
      const [closingStage] = await tx
        .select()
        .from(stages)
        .where(and(eq(stages.projectId, project.id), eq(stages.isClosing, true)))
        .orderBy(asc(stages.position))
        .limit(1)
        .for("share");
      if (!closingStage) throw new AppError("NO_CLOSING_STAGE", "Mark a column as a closing column first.");

      const fromStage = (await lockStagesForShare(tx, [workItem.stageId])).get(workItem.stageId);
      if (!fromStage) throw new AppError("NOT_FOUND", "Column not found.");
      if (fromStage.isClosing) throw new AppError("ALREADY_CLOSED", "This Work Item is already closed.");

      const [maxRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${workItems.position})` })
        .from(workItems)
        .where(eq(workItems.stageId, closingStage.id));

      await moveWithinTx(tx, {
        workItem,
        fromStage,
        toStage: closingStage,
        toPosition: (maxRow?.maxPosition ?? -1) + 1,
        via: "close_button",
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

    await requireProjectPermission(project.publicId, "workItem:edit");

    await db.transaction(async (tx) => {
      for (const [index, workItemId] of input.orderedWorkItemIds.entries()) {
        await tx
          .update(workItems)
          // Not `updatedAt`: position within a column is board layout, not a
          // change to the Work Item — reordering used to bump "Last modified"
          // on every item in the column (008-work-item-fields research.md § `updated_at`).
          .set({ position: index })
          .where(and(eq(workItems.id, workItemId), eq(workItems.stageId, input.stageId)));
      }
    });

    revalidatePath(`/projects/${project.publicId}`);
  });
}

const levelSchema = z.enum(WORK_ITEM_LEVELS).nullable().optional();
const calendarDateSchema = z.iso.date("Dates must be valid calendar days (YYYY-MM-DD).").nullable().optional();
// "" or only spaces means "clear the value", same as sending null.
const catalogNameSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v?.trim() || null));

const updateWorkItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").optional(),
  description: z.string().optional(),
  stakeholder: z.string().optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
  // 008-work-item-fields: `undefined` leaves a field alone, `null` clears it.
  priority: levelSchema,
  severity: levelSchema,
  areaName: catalogNameSchema,
  iterationName: catalogNameSchema,
  startDate: calendarDateSchema,
  targetDate: calendarDateSchema,
});

// The Work Item's current area/iteration name, for the change check and the
// activity payload (which records names, not ids — data-model.md § Log de actividad).
async function catalogNameById(kind: CatalogKind, id: number | null): Promise<string | null> {
  if (id === null) return null;
  const table = kind === "area" ? areas : iterations;
  const [row] = await db.select({ name: table.name }).from(table).where(eq(table.id, id)).limit(1);
  return row?.name ?? null;
}

// FR-007/FR-008/FR-009/FR-012/FR-013 of 004-work-items, extended with the
// fields of 008-work-item-fields (FR-001..FR-009, FR-020). `closedAt` is
// deliberately not an input: only the closing transitions write it (FR-013).
export async function updateWorkItem(input: {
  workItemId: number;
  title?: string;
  description?: string;
  stakeholder?: string;
  tagNames?: string[];
  priority?: WorkItemLevel | null;
  severity?: WorkItemLevel | null;
  areaName?: string | null;
  iterationName?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}): Promise<Result<WorkItemWithDisplayId>> {
  return runAction(async () => {
    const { workItem, project } = await getWorkItemAndProject(input.workItemId);
    await requireProjectPermission(project.publicId, "workItem:edit");

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
    if (parsed.data.priority !== undefined && parsed.data.priority !== workItem.priority) {
      changedFields.priority = { from: workItem.priority, to: parsed.data.priority };
      updates.priority = parsed.data.priority;
    }
    if (parsed.data.severity !== undefined && parsed.data.severity !== workItem.severity) {
      changedFields.severity = { from: workItem.severity, to: parsed.data.severity };
      updates.severity = parsed.data.severity;
    }

    // FR-009: judged on the RESULTING pair, so changing only one date can't
    // leave the target before the start. The DB CHECK backs this up.
    const nextStartDate = parsed.data.startDate !== undefined ? parsed.data.startDate : workItem.startDate;
    const nextTargetDate = parsed.data.targetDate !== undefined ? parsed.data.targetDate : workItem.targetDate;
    if (nextStartDate && nextTargetDate && nextTargetDate < nextStartDate) {
      throw new AppError("INVALID_DATE_RANGE", "The target date can't be before the start date.");
    }
    if (parsed.data.startDate !== undefined && parsed.data.startDate !== workItem.startDate) {
      changedFields.startDate = { from: workItem.startDate, to: parsed.data.startDate };
      updates.startDate = parsed.data.startDate;
    }
    if (parsed.data.targetDate !== undefined && parsed.data.targetDate !== workItem.targetDate) {
      changedFields.targetDate = { from: workItem.targetDate, to: parsed.data.targetDate };
      updates.targetDate = parsed.data.targetDate;
    }

    const catalogChanges: { kind: CatalogKind; name: string | null }[] = [];
    for (const kind of ["area", "iteration"] as const) {
      const requested = kind === "area" ? parsed.data.areaName : parsed.data.iterationName;
      if (requested === undefined) continue;
      const current = await catalogNameById(kind, kind === "area" ? workItem.areaId : workItem.iterationId);
      // Same value in a different case ("FRONTEND" for "Frontend") is no change.
      if ((current ?? "").toLowerCase() === (requested ?? "").toLowerCase()) continue;
      catalogChanges.push({ kind, name: requested });
      changedFields[kind] = { from: current, to: requested };
    }

    const updated = await db.transaction(async (tx) => {
      // FR-006/FR-021: names are resolved (reused case-insensitively or created)
      // only within this Work Item's own project — never from a client-sent id.
      for (const { kind, name } of catalogChanges) {
        const value = name === null ? null : await resolveCatalogValue(tx, kind, project.id, name);
        if (kind === "area") updates.areaId = value?.id ?? null;
        else updates.iterationId = value?.id ?? null;
        // Log the catalog's own spelling when an existing value was reused.
        if (value) (changedFields[kind] as { to: unknown }).to = value.name;
      }

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

// The tags currently applied to one Work Item, for WorkItemDetailView/TagPicker.
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
    await requireProjectPermission(project.publicId, "workItem:edit");

    await db.delete(workItems).where(eq(workItems.id, workItemId));

    revalidatePath(`/projects/${project.publicId}`);
  });
}

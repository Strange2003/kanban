"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db/client";
import { workItemChecklistItems, workItems } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { AppError, runAction, type Result } from "@/lib/errors";
import { requireProjectPermission } from "@/lib/permissions";
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, type ChecklistItemView } from "@/lib/work-item-checklist";

// KAN-9: the Work Item checklist. Every action names the Work Item the way the
// URL does (project public id + display number) and addresses an item by its
// public id; the item is always re-read scoped to that Work Item, so an id from
// another Work Item or project is simply NOT_FOUND. Editing the checklist is a
// Work Item edit (`workItem:edit`); reading it needs only membership and comes
// with the detail data.

const targetSchema = z.object({
  projectPublicId: z.string().min(1).max(64),
  displayNumber: z.number().int().positive(),
});
const itemIdSchema = z.string().min(1).max(64);
const textSchema = z.string().trim().min(1).max(CHECKLIST_TEXT_MAX);

type Target = z.infer<typeof targetSchema>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toView(row: { publicId: string; text: string; done: boolean }): ChecklistItemView {
  return { publicId: row.publicId, text: row.text, done: row.done };
}

async function resolveTarget(target: Target) {
  const parsed = targetSchema.safeParse(target);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Work item not found.");
  const { project } = await requireProjectPermission(parsed.data.projectPublicId, "workItem:edit");
  const [workItem] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.displayNumber, parsed.data.displayNumber)))
    .limit(1);
  if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");
  return { project, workItem };
}

function detailPath(projectPublicId: string, displayNumber: number) {
  return `/projects/${projectPublicId}/work-items/${displayNumber}`;
}

// Locks the Work Item row so concurrent edits of one checklist (position
// numbering, item cap) run one after another.
async function lockWorkItem(tx: Tx, workItemId: number) {
  await tx.execute(sql`SELECT id FROM work_items WHERE id = ${workItemId} FOR UPDATE`);
}

async function findItem(tx: Tx, workItemId: number, itemPublicId: string) {
  if (!itemIdSchema.safeParse(itemPublicId).success) throw new AppError("NOT_FOUND", "Checklist item not found.");
  const [item] = await tx
    .select()
    .from(workItemChecklistItems)
    .where(and(eq(workItemChecklistItems.workItemId, workItemId), eq(workItemChecklistItems.publicId, itemPublicId)))
    .limit(1);
  if (!item) throw new AppError("NOT_FOUND", "Checklist item not found.");
  return item;
}

export async function addChecklistItem(input: Target & { text: string }): Promise<Result<ChecklistItemView>> {
  return runAction(async () => {
    const { project, workItem } = await resolveTarget(input);
    const text = textSchema.safeParse(input.text);
    if (!text.success) throw new AppError("INVALID_CHECKLIST_ITEM", `Write a step of up to ${CHECKLIST_TEXT_MAX} characters.`);

    const row = await db.transaction(async (tx) => {
      await lockWorkItem(tx, workItem.id);
      const [stats] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          maxPosition: sql<number | null>`max(${workItemChecklistItems.position})`,
        })
        .from(workItemChecklistItems)
        .where(eq(workItemChecklistItems.workItemId, workItem.id));
      if ((stats?.count ?? 0) >= CHECKLIST_MAX_ITEMS)
        throw new AppError("CHECKLIST_FULL", `A checklist can have up to ${CHECKLIST_MAX_ITEMS} steps.`);
      const [inserted] = await tx
        .insert(workItemChecklistItems)
        .values({
          publicId: nanoid(),
          workItemId: workItem.id,
          text: text.data,
          position: (stats?.maxPosition ?? -1) + 1,
        })
        .returning();
      if (!inserted) throw new AppError("UNKNOWN_ERROR", "Could not add the step.");
      await logActivity(tx, {
        workItemId: workItem.id,
        type: "checklist_item_added",
        payload: { itemPublicId: inserted.publicId, text: inserted.text },
      });
      return inserted;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return toView(row);
  });
}

export async function setChecklistItemDone(
  input: Target & { itemPublicId: string; done: boolean },
): Promise<Result<ChecklistItemView>> {
  return runAction(async () => {
    const { project, workItem } = await resolveTarget(input);
    if (typeof input.done !== "boolean") throw new AppError("INVALID_CHECKLIST_ITEM", "Invalid checklist state.");

    const row = await db.transaction(async (tx) => {
      await lockWorkItem(tx, workItem.id);
      const item = await findItem(tx, workItem.id, input.itemPublicId);
      if (item.done === input.done) return item;
      const [updated] = await tx
        .update(workItemChecklistItems)
        .set({ done: input.done })
        .where(eq(workItemChecklistItems.id, item.id))
        .returning();
      if (!updated) throw new AppError("NOT_FOUND", "Checklist item not found.");
      await logActivity(tx, {
        workItemId: workItem.id,
        type: input.done ? "checklist_item_checked" : "checklist_item_unchecked",
        payload: { itemPublicId: updated.publicId, text: updated.text },
      });
      return updated;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return toView(row);
  });
}

export async function editChecklistItemText(
  input: Target & { itemPublicId: string; text: string },
): Promise<Result<ChecklistItemView>> {
  return runAction(async () => {
    const { project, workItem } = await resolveTarget(input);
    const text = textSchema.safeParse(input.text);
    if (!text.success) throw new AppError("INVALID_CHECKLIST_ITEM", `Write a step of up to ${CHECKLIST_TEXT_MAX} characters.`);

    const row = await db.transaction(async (tx) => {
      await lockWorkItem(tx, workItem.id);
      const item = await findItem(tx, workItem.id, input.itemPublicId);
      if (item.text === text.data) return item;
      const [updated] = await tx
        .update(workItemChecklistItems)
        .set({ text: text.data })
        .where(eq(workItemChecklistItems.id, item.id))
        .returning();
      if (!updated) throw new AppError("NOT_FOUND", "Checklist item not found.");
      await logActivity(tx, {
        workItemId: workItem.id,
        type: "checklist_item_edited",
        payload: { itemPublicId: updated.publicId, from: item.text, to: updated.text },
      });
      return updated;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return toView(row);
  });
}

export async function removeChecklistItem(
  input: Target & { itemPublicId: string },
): Promise<Result<{ publicId: string }>> {
  return runAction(async () => {
    const { project, workItem } = await resolveTarget(input);

    const publicId = await db.transaction(async (tx) => {
      await lockWorkItem(tx, workItem.id);
      const item = await findItem(tx, workItem.id, input.itemPublicId);
      await tx.delete(workItemChecklistItems).where(eq(workItemChecklistItems.id, item.id));
      await logActivity(tx, {
        workItemId: workItem.id,
        type: "checklist_item_removed",
        payload: { itemPublicId: item.publicId, text: item.text },
      });
      return item.publicId;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return { publicId };
  });
}

// Reordering is deliberately NOT written to the history: it changes no content,
// only presentation, and a burst of moves would bury the entries that matter.
export async function moveChecklistItem(
  input: Target & { itemPublicId: string; direction: "up" | "down" },
): Promise<Result<ChecklistItemView[]>> {
  return runAction(async () => {
    const { project, workItem } = await resolveTarget(input);
    if (input.direction !== "up" && input.direction !== "down")
      throw new AppError("INVALID_CHECKLIST_ITEM", "Invalid direction.");

    const ordered = await db.transaction(async (tx) => {
      await lockWorkItem(tx, workItem.id);
      const items = await tx
        .select()
        .from(workItemChecklistItems)
        .where(eq(workItemChecklistItems.workItemId, workItem.id))
        .orderBy(asc(workItemChecklistItems.position), asc(workItemChecklistItems.id));
      const index = items.findIndex((item) => item.publicId === input.itemPublicId);
      if (index === -1) throw new AppError("NOT_FOUND", "Checklist item not found.");
      const target = input.direction === "up" ? index - 1 : index + 1;
      if (target >= 0 && target < items.length) {
        const [moved] = items.splice(index, 1);
        items.splice(target, 0, moved!);
        // Renumber the whole list so ties can never survive a move.
        for (const [position, item] of items.entries()) {
          if (item.position !== position)
            await tx.update(workItemChecklistItems).set({ position }).where(eq(workItemChecklistItems.id, item.id));
        }
      }
      return items;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return ordered.map(toView);
  });
}

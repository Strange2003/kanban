"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { workItemComments, workItemTimeEntries } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { AppError, runAction, type Result } from "@/lib/errors";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { getWorkItemAndProject } from "@/lib/work-item-queries";

export type WorkItemCommentView = {
  publicId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  authorImage: string | null;
  createdAt: Date;
};

export type WorkItemTimeEntryView = {
  publicId: string;
  minutes: number;
  note: string | null;
  authorUserId: string;
  authorName: string;
  authorImage: string | null;
  createdAt: Date;
};

export type WorkItemDiscussionData = {
  comments: WorkItemCommentView[];
  timeEntries: WorkItemTimeEntryView[];
  currentUserId: string;
};

const commentSchema = z.object({
  workItemId: z.number().int().positive(),
  body: z.string().trim().min(1).max(10000),
});

const timeEntrySchema = z.object({
  workItemId: z.number().int().positive(),
  minutes: z.number().int().min(1).max(600000),
  note: z.string().trim().max(500).optional(),
});

async function authorFor(userId: string) {
  const [author] = await db
    .select({ name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return { name: author?.name ?? "Unknown member", image: author?.image ?? null };
}

function detailPath(projectPublicId: string, displayNumber: number) {
  return `/projects/${projectPublicId}/work-items/${displayNumber}`;
}

// Read-only, but still a public endpoint. Resolve the Work Item's own project
// and check membership before selecting any child rows.
export async function getWorkItemDiscussionData(workItemId: number): Promise<Result<WorkItemDiscussionData>> {
  return runAction(async () => {
    if (!Number.isInteger(workItemId) || workItemId <= 0) throw new AppError("NOT_FOUND", "Work item not found.");
    const { project } = await getWorkItemAndProject(workItemId);
    const { actor } = await requireProjectMember(project.publicId);

    const [comments, timeEntries] = await Promise.all([
      db
        .select({
          publicId: workItemComments.publicId,
          body: workItemComments.body,
          authorUserId: workItemComments.authorUserId,
          authorName: workItemComments.authorName,
          authorImage: user.image,
          createdAt: workItemComments.createdAt,
        })
        .from(workItemComments)
        .leftJoin(user, eq(user.id, workItemComments.authorUserId))
        .where(eq(workItemComments.workItemId, workItemId))
        .orderBy(asc(workItemComments.createdAt), asc(workItemComments.id)),
      db
        .select({
          publicId: workItemTimeEntries.publicId,
          minutes: workItemTimeEntries.minutes,
          note: workItemTimeEntries.note,
          authorUserId: workItemTimeEntries.authorUserId,
          authorName: workItemTimeEntries.authorName,
          authorImage: user.image,
          createdAt: workItemTimeEntries.createdAt,
        })
        .from(workItemTimeEntries)
        .leftJoin(user, eq(user.id, workItemTimeEntries.authorUserId))
        .where(eq(workItemTimeEntries.workItemId, workItemId))
        .orderBy(asc(workItemTimeEntries.createdAt), asc(workItemTimeEntries.id)),
    ]);

    return { comments, timeEntries, currentUserId: actor.userId };
  });
}

export async function addWorkItemComment(input: { workItemId: number; body: string }): Promise<Result<WorkItemCommentView>> {
  return runAction(async () => {
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_COMMENT", "Write a comment of up to 10,000 characters.");
    const { workItem, project } = await getWorkItemAndProject(parsed.data.workItemId);
    const { actor } = await requireProjectPermission(project.publicId, "workItem:comment");
    const author = await authorFor(actor.userId);

    const comment = await db.transaction(async (tx) => {
      const [row] = await tx.insert(workItemComments).values({
        publicId: nanoid(),
        workItemId: workItem.id,
        authorUserId: actor.userId,
        authorName: author.name,
        body: parsed.data.body,
      }).returning();
      if (!row) throw new AppError("UNKNOWN_ERROR", "Could not post the comment.");
      await logActivity(tx, { workItemId: workItem.id, type: "comment_added", payload: { commentPublicId: row.publicId } });
      return row;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return {
      publicId: comment.publicId,
      body: comment.body,
      authorUserId: comment.authorUserId,
      authorName: comment.authorName,
      authorImage: author.image,
      createdAt: comment.createdAt,
    };
  });
}

export async function addWorkItemTimeEntry(input: { workItemId: number; minutes: number; note?: string }): Promise<Result<WorkItemTimeEntryView>> {
  return runAction(async () => {
    const parsed = timeEntrySchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_TIME_ENTRY", "Enter a positive duration and a note under 500 characters.");
    const { workItem, project } = await getWorkItemAndProject(parsed.data.workItemId);
    const { actor } = await requireProjectPermission(project.publicId, "workItem:edit");
    const author = await authorFor(actor.userId);

    const entry = await db.transaction(async (tx) => {
      const [row] = await tx.insert(workItemTimeEntries).values({
        publicId: nanoid(),
        workItemId: workItem.id,
        authorUserId: actor.userId,
        authorName: author.name,
        minutes: parsed.data.minutes,
        note: parsed.data.note || null,
      }).returning();
      if (!row) throw new AppError("UNKNOWN_ERROR", "Could not log the time.");
      await logActivity(tx, { workItemId: workItem.id, type: "time_entry_added", payload: { entryPublicId: row.publicId, minutes: row.minutes } });
      return row;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return {
      publicId: entry.publicId,
      minutes: entry.minutes,
      note: entry.note,
      authorUserId: entry.authorUserId,
      authorName: entry.authorName,
      authorImage: author.image,
      createdAt: entry.createdAt,
    };
  });
}

export async function removeWorkItemTimeEntry(entryPublicId: string): Promise<Result<{ publicId: string; minutes: number }>> {
  return runAction(async () => {
    if (!z.string().min(1).max(64).safeParse(entryPublicId).success)
      throw new AppError("NOT_FOUND", "Time entry not found.");
    const [entry] = await db.select().from(workItemTimeEntries).where(eq(workItemTimeEntries.publicId, entryPublicId)).limit(1);
    if (!entry) throw new AppError("NOT_FOUND", "Time entry not found.");
    const { workItem, project } = await getWorkItemAndProject(entry.workItemId);
    const { actor } = await requireProjectPermission(project.publicId, "workItem:edit");
    if (actor.userId !== entry.authorUserId) throw new AppError("NOT_AUTHOR", "Only the person who logged this time can remove it.");

    const deleted = await db.transaction(async (tx) => {
      const [row] = await tx.delete(workItemTimeEntries).where(and(
        eq(workItemTimeEntries.publicId, entryPublicId),
        eq(workItemTimeEntries.workItemId, workItem.id),
        eq(workItemTimeEntries.authorUserId, actor.userId),
      )).returning();
      if (!row) throw new AppError("NOT_FOUND", "Time entry not found.");
      await logActivity(tx, { workItemId: workItem.id, type: "time_entry_deleted", payload: { entryPublicId: row.publicId, minutes: row.minutes } });
      return row;
    });

    revalidatePath(detailPath(project.publicId, workItem.displayNumber));
    return { publicId: deleted.publicId, minutes: deleted.minutes };
  });
}

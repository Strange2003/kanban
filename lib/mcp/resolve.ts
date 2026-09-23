import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stages, workItems } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { requireProjectMember } from "@/lib/permissions";

/**
 * Translates the public identifiers an agent uses (contracts/mcp-tools.md §
 * Identificadores) into the internal rows the Server Actions take. Every
 * lookup runs AFTER requireProjectMember and is scoped to that project, so a
 * "KAN-12" or column id from another project is simply not found (Principle IV).
 *
 * Server-only, not "use server".
 */

/** "KAN-12" → { prefix: "KAN", number: 12 }. */
export function parseDisplayId(displayId: string): { prefix: string; number: number } {
  const match = /^\s*([A-Za-z0-9]+)-(\d+)\s*$/.exec(displayId ?? "");
  if (!match) {
    throw new AppError("VALIDATION_ERROR", `"${displayId}" isn't a Work Item ID — expected something like KAN-12.`);
  }
  return { prefix: match[1]!.toUpperCase(), number: Number(match[2]) };
}

export async function resolveWorkItem(projectPublicId: string, displayId: string) {
  const { actor, project, membership } = await requireProjectMember(projectPublicId);
  const { prefix, number } = parseDisplayId(displayId);
  if (prefix !== project.workItemPrefix.toUpperCase()) {
    throw new AppError("NOT_FOUND", `Work Item ${displayId} not found in this project.`);
  }
  const [workItem] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.displayNumber, number)))
    .limit(1);
  if (!workItem) throw new AppError("NOT_FOUND", `Work Item ${displayId} not found in this project.`);
  return { actor, project, membership, workItem };
}

export async function resolveColumn(projectPublicId: string, columnId: string) {
  const { actor, project, membership } = await requireProjectMember(projectPublicId);
  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.projectId, project.id), eq(stages.publicId, columnId)))
    .limit(1);
  if (!stage) throw new AppError("NOT_FOUND", `Column ${columnId} not found in this project.`);
  return { actor, project, membership, stage };
}

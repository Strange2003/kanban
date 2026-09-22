import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, workItems } from "@/db/schema";
import { AppError } from "@/lib/errors";

// Internal lookups shared by lib/actions/work-items.ts and
// lib/actions/work-item-relationships.ts. They take raw internal ids and do no
// session or membership check, so they must NOT live in a "use server" file
// (every export there is a public endpoint) — callers check access themselves.

export async function getWorkItemAndProject(workItemId: number) {
  const [workItem] = await db.select().from(workItems).where(eq(workItems.id, workItemId)).limit(1);
  if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");

  const [project] = await db.select().from(projects).where(eq(projects.id, workItem.projectId)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");

  return { workItem, project };
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

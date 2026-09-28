import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { areas, sizes, tags, workItems, workItemTags } from "@/db/schema";
import { DEFAULT_TAG_COLOR, type TagColor } from "@/lib/tag-colors";

// The per-project catalogs: tags (004-work-items), areas (008-work-item-fields)
// and sizes (013-project-catalogs, formerly 008's iterations). These take raw
// internal project ids and do no session or membership check, so they must
// NOT live in a "use server" file (every export there is a public endpoint) —
// callers check access themselves, same as lib/work-item-queries.ts.

export type CatalogKind = "tag" | "area" | "size";

export const CATALOG_KINDS = ["tag", "area", "size"] as const satisfies readonly CatalogKind[];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const catalogTable = (kind: CatalogKind) => (kind === "tag" ? tags : kind === "area" ? areas : sizes);

/** The catalog's value names for one project, in the user's manual order (FR-003a of 013). */
export async function listCatalog(kind: CatalogKind, projectId: number): Promise<string[]> {
  const table = catalogTable(kind);
  const rows = await db
    .select({ name: table.name })
    .from(table)
    .where(eq(table.projectId, projectId))
    .orderBy(asc(table.position), asc(table.id));
  return rows.map((r) => r.name);
}

/** The project's tags with their colors, in manual order. */
export async function listTagCatalog(projectId: number): Promise<{ name: string; color: TagColor }[]> {
  return db
    .select({ name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.projectId, projectId))
    .orderBy(asc(tags.position), asc(tags.id));
}

/**
 * The tags of some of a project's Work Items, with their colors, by Work Item
 * id — one query for all of them, alphabetical per Work Item like the board.
 * Scoped by `projectId`, so ids from another project return nothing (FR-017 of
 * 014-board-filters-mcp-catalogs: what an agent's write actually stored).
 */
export async function listWorkItemTags(
  projectId: number,
  workItemIds: number[],
): Promise<Map<number, { name: string; color: TagColor }[]>> {
  const byItem = new Map<number, { name: string; color: TagColor }[]>();
  if (workItemIds.length === 0) return byItem;
  const rows = await db
    .select({ workItemId: workItemTags.workItemId, name: tags.name, color: tags.color })
    .from(workItemTags)
    .innerJoin(tags, eq(tags.id, workItemTags.tagId))
    .where(and(eq(tags.projectId, projectId), inArray(workItemTags.workItemId, workItemIds)))
    .orderBy(asc(tags.name));
  for (const { workItemId, name, color } of rows) {
    byItem.set(workItemId, [...(byItem.get(workItemId) ?? []), { name, color }]);
  }
  return byItem;
}

/** How many Work Items use each value of a catalog, keyed by the value's internal id. */
export async function catalogUsage(kind: CatalogKind, projectId: number): Promise<Map<number, number>> {
  const rows =
    kind === "tag"
      ? await db
          .select({ id: workItemTags.tagId, count: sql<number>`count(*)`.mapWith(Number) })
          .from(workItemTags)
          .innerJoin(tags, eq(tags.id, workItemTags.tagId))
          .where(eq(tags.projectId, projectId))
          .groupBy(workItemTags.tagId)
      : await db
          .select({
            id: kind === "area" ? workItems.areaId : workItems.sizeId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(workItems)
          .where(eq(workItems.projectId, projectId))
          .groupBy(kind === "area" ? workItems.areaId : workItems.sizeId);
  const usage = new Map<number, number>();
  for (const row of rows) if (row.id !== null) usage.set(row.id, row.count);
  return usage;
}

/** Finds a value by name within the project, case-insensitively. */
export async function findCatalogValue(
  tx: Tx | typeof db,
  kind: CatalogKind,
  projectId: number,
  name: string,
  options: { forUpdate?: boolean } = {},
): Promise<{ id: number; name: string } | null> {
  const table = catalogTable(kind);
  const query = tx
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(and(eq(table.projectId, projectId), sql`lower(${table.name}) = lower(${name.trim()})`))
    .limit(1);
  const [row] = options.forUpdate ? await query.for("update") : await query;
  return row ?? null;
}

/**
 * Finds `name` in the project's catalog case-insensitively or, with `create`,
 * creates it at the end of the manual order — the reuse-or-create rule of
 * tags (FR-012 of 004-work-items). Always scoped by `projectId`, so a value
 * from another project can never be returned (FR-021 of 008, FR-020 of 013).
 * Without `create`, a missing name returns null (013 research.md § No recrear
 * en silencio un valor eliminado).
 */
export async function resolveCatalogValue(
  tx: Tx,
  kind: CatalogKind,
  projectId: number,
  name: string,
  options: { create?: boolean; color?: TagColor } = {},
): Promise<{ id: number; name: string } | null> {
  const { create = true } = options;
  const table = catalogTable(kind);
  const trimmed = name.trim();

  const existing = await findCatalogValue(tx, kind, projectId, trimmed);
  if (existing) return existing;
  if (!create) return null;

  // Two members creating at once may get the same position; reads break the
  // tie by id, so that race is harmless. Two members creating the SAME name:
  // the unique (project, lower(name)) index makes the loser's insert a no-op,
  // and it reads the winner's row.
  const position = sql`(select coalesce(max(${table.position}), -1) + 1 from ${table} where ${table.projectId} = ${projectId})`;
  const [created] =
    kind === "tag"
      ? await tx
          .insert(tags)
          .values({ projectId, name: trimmed, color: options.color ?? DEFAULT_TAG_COLOR, position })
          .onConflictDoNothing()
          .returning({ id: tags.id, name: tags.name })
      : await tx
          .insert(table)
          .values({ projectId, name: trimmed, position })
          .onConflictDoNothing()
          .returning({ id: table.id, name: table.name });
  if (created) return created;

  const raced = await findCatalogValue(tx, kind, projectId, trimmed);
  if (!raced) throw new Error(`Could not resolve ${kind} "${trimmed}".`);
  return raced;
}

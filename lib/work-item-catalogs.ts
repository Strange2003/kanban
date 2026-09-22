import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { areas, iterations } from "@/db/schema";

// Area and iteration catalogs of 008-work-item-fields (FR-005/FR-006/FR-021).
// These take raw internal project ids and do no session or membership check,
// so they must NOT live in a "use server" file (every export there is a public
// endpoint) — callers check access themselves, same as lib/work-item-queries.ts.

export type CatalogKind = "area" | "iteration";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const tableFor = (kind: CatalogKind) => (kind === "area" ? areas : iterations);

/** The catalog's value names for one project, alphabetically. */
export async function listCatalog(kind: CatalogKind, projectId: number): Promise<string[]> {
  const table = tableFor(kind);
  const rows = await db
    .select({ name: table.name })
    .from(table)
    .where(eq(table.projectId, projectId))
    .orderBy(asc(table.name));
  return rows.map((r) => r.name);
}

/**
 * Finds `name` in the project's catalog case-insensitively or creates it —
 * the same reuse-or-create rule as tags (FR-012 of 004-work-items). Always
 * scoped by `projectId`, so a value from another project can never be
 * returned (FR-021).
 */
export async function resolveCatalogValue(
  tx: Tx,
  kind: CatalogKind,
  projectId: number,
  name: string,
): Promise<{ id: number; name: string }> {
  const table = tableFor(kind);
  const trimmed = name.trim();
  const find = () =>
    tx
      .select({ id: table.id, name: table.name })
      .from(table)
      .where(and(eq(table.projectId, projectId), sql`lower(${table.name}) = lower(${trimmed})`))
      .limit(1);

  const [existing] = await find();
  if (existing) return existing;

  // Two members creating the same value at once: the unique (project, lower(name))
  // index makes the loser's insert a no-op, and it reads the winner's row.
  const [created] = await tx
    .insert(table)
    .values({ projectId, name: trimmed })
    .onConflictDoNothing()
    .returning({ id: table.id, name: table.name });
  if (created) return created;

  const [raced] = await find();
  if (!raced) throw new Error(`Could not resolve ${kind} "${trimmed}".`);
  return raced;
}

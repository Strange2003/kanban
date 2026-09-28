"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { tags, workItems, workItemTags } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { AppError, runAction, type Result } from "@/lib/errors";
import { TAG_COLORS, type TagColor } from "@/lib/tag-colors";
import {
  CATALOG_KINDS,
  catalogTable,
  catalogUsage,
  findCatalogValue,
  resolveCatalogValue,
  type CatalogKind,
} from "@/lib/work-item-catalogs";
import type { ProjectRole } from "@/lib/roles";

// 013-project-catalogs: manage a project's tags, areas and sizes
// (contracts/project-catalogs.md). Values are identified by name within the
// project — the catalog's unique key — so no internal id ever leaves the
// server (research.md § Identificar valores de catálogo por nombre).

export type CatalogValue = { name: string; usage: number };
export type TagCatalogValue = CatalogValue & { color: TagColor };

const kindSchema = z.enum(CATALOG_KINDS);
const existingNameSchema = z.string().trim().min(1, "Name is required.");
// Only new names are capped: existing longer values are kept (data-model.md § Reglas de validación).
const newNameSchema = existingNameSchema.max(50, "Names can be at most 50 characters.");
const colorSchema = z.enum(TAG_COLORS);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.");
  return parsed.data;
}

const KIND_LABEL: Record<CatalogKind, string> = { tag: "Tag", area: "Area", size: "Size" };

function notFound(kind: CatalogKind, name: string): AppError {
  return new AppError("NOT_FOUND", `${KIND_LABEL[kind]} "${name}" no longer exists.`);
}

function revalidateProject(projectPublicId: string) {
  revalidatePath(`/projects/${projectPublicId}`);
  revalidatePath(`/projects/${projectPublicId}/settings/catalogs`);
}

// FR-001/FR-007: the catalogs page. Membership only — a Viewer reads too.
export async function getProjectCatalogs(projectPublicId: string): Promise<
  Result<{ role: ProjectRole; projectName: string; tags: TagCatalogValue[]; areas: CatalogValue[]; sizes: CatalogValue[] }>
> {
  return runAction(async () => {
    const { project, membership } = await requireProjectMember(projectPublicId);

    const load = async (kind: CatalogKind) => {
      const table = catalogTable(kind);
      const [rows, usage] = await Promise.all([
        db
          .select({ id: table.id, name: table.name, color: kind === "tag" ? tags.color : sql<null>`null` })
          .from(table)
          .where(eq(table.projectId, project.id))
          .orderBy(table.position, table.id),
        catalogUsage(kind, project.id),
      ]);
      return rows.map((row) => ({ ...row, usage: usage.get(row.id) ?? 0 }));
    };
    const [tagRows, areaRows, sizeRows] = await Promise.all([load("tag"), load("area"), load("size")]);

    return {
      role: membership.role,
      projectName: project.name,
      tags: tagRows.map(({ name, color, usage }) => ({ name, color: color as TagColor, usage })),
      areas: areaRows.map(({ name, usage }) => ({ name, usage })),
      sizes: sizeRows.map(({ name, usage }) => ({ name, usage })),
    };
  });
}

// FR-003/FR-014: from the catalogs page or the Work Item's "Create new"
// pop-up. An existing name (case-insensitively) is returned as is, so the
// pop-up assigns it (FR-013); the page tells the user it already existed.
export async function createCatalogValue(input: {
  projectPublicId: string;
  kind: CatalogKind;
  name: string;
  color?: TagColor;
}): Promise<Result<{ name: string; color?: TagColor; created: boolean }>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "catalog:manage");
    const kind = parse(kindSchema, input.kind);
    const name = parse(newNameSchema, input.name);
    const color = input.color === undefined ? undefined : parse(colorSchema, input.color);
    if (color && kind !== "tag") throw new AppError("VALIDATION_ERROR", "Only tags have a color.");

    const result = await db.transaction(async (tx) => {
      const existing = await findCatalogValue(tx, kind, project.id, name);
      if (existing) return { name: existing.name, created: false };
      const value = await resolveCatalogValue(tx, kind, project.id, name, { create: true, color });
      return { name: value!.name, created: true };
    });

    let resolvedColor: TagColor | undefined;
    if (kind === "tag") {
      const [row] = await db
        .select({ color: tags.color })
        .from(tags)
        .where(and(eq(tags.projectId, project.id), eq(tags.name, result.name)))
        .limit(1);
      resolvedColor = row?.color;
    }

    revalidateProject(input.projectPublicId);
    return { ...result, color: resolvedColor };
  });
}

// FR-005: renaming changes the catalog, not each Work Item — no history.
export async function renameCatalogValue(input: {
  projectPublicId: string;
  kind: CatalogKind;
  name: string;
  newName: string;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "catalog:manage");
    const kind = parse(kindSchema, input.kind);
    const name = parse(existingNameSchema, input.name);
    const newName = parse(newNameSchema, input.newName);
    const table = catalogTable(kind);

    await db.transaction(async (tx) => {
      const value = await findCatalogValue(tx, kind, project.id, name, { forUpdate: true });
      if (!value) throw notFound(kind, name);
      const clash = await findCatalogValue(tx, kind, project.id, newName);
      // Changing only the case of the same value ("backend" → "Backend") is allowed.
      if (clash && clash.id !== value.id) {
        throw new AppError("CATALOG_NAME_TAKEN", `${KIND_LABEL[kind]} "${clash.name}" already exists.`);
      }
      await tx.update(table).set({ name: newName }).where(eq(table.id, value.id));
    });

    revalidateProject(input.projectPublicId);
  });
}

// FR-003 (tags only): recolor — a catalog change, no history.
export async function setTagColor(input: {
  projectPublicId: string;
  name: string;
  color: TagColor;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "catalog:manage");
    const name = parse(existingNameSchema, input.name);
    const color = parse(colorSchema, input.color);

    const value = await findCatalogValue(db, "tag", project.id, name);
    if (!value) throw notFound("tag", name);
    await db.update(tags).set({ color }).where(eq(tags.id, value.id));

    revalidateProject(input.projectPublicId);
  });
}

// FR-003a: the full list of names in the new order, like reorderStages. A
// stale list (someone added, renamed or deleted a value meanwhile) changes
// nothing and returns CONFLICT so the page reloads.
export async function reorderCatalog(input: {
  projectPublicId: string;
  kind: CatalogKind;
  orderedNames: string[];
}): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "catalog:manage");
    const kind = parse(kindSchema, input.kind);
    const orderedNames = parse(z.array(existingNameSchema), input.orderedNames);
    const table = catalogTable(kind);

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: table.id, name: table.name })
        .from(table)
        .where(eq(table.projectId, project.id))
        .for("update");
      const idByName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
      const requested = orderedNames.map((name) => name.toLowerCase());
      if (requested.length !== rows.length || new Set(requested).size !== rows.length || !requested.every((n) => idByName.has(n))) {
        throw new AppError("CONFLICT", "The list changed meanwhile. Reload and try again.");
      }
      for (const [index, name] of requested.entries()) {
        await tx.update(table).set({ position: index }).where(eq(table.id, idByName.get(name)!));
      }
    });

    revalidateProject(input.projectPublicId);
  });
}

// FR-006: removes the value from every Work Item that uses it and deletes it,
// in one transaction, with one `fields_edited` event per affected Work Item
// (research.md § Eliminar un valor en uso).
export async function deleteCatalogValue(input: {
  projectPublicId: string;
  kind: CatalogKind;
  name: string;
}): Promise<Result<{ affectedWorkItems: number }>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "catalog:manage");
    const kind = parse(kindSchema, input.kind);
    const name = parse(existingNameSchema, input.name);
    const table = catalogTable(kind);

    const affected = await db.transaction(async (tx) => {
      // Serializes against a concurrent rename or delete of the same value.
      const value = await findCatalogValue(tx, kind, project.id, name, { forUpdate: true });
      if (!value) throw notFound(kind, name);
      const now = new Date();
      let events: { workItemId: number; type: string; payload: unknown }[];

      if (kind === "tag") {
        const users = await tx
          .select({ workItemId: workItemTags.workItemId })
          .from(workItemTags)
          .where(eq(workItemTags.tagId, value.id));
        const ids = users.map((row) => row.workItemId);
        events = [];
        if (ids.length > 0) {
          const tagRows = await tx
            .select({ workItemId: workItemTags.workItemId, name: tags.name })
            .from(workItemTags)
            .innerJoin(tags, eq(tags.id, workItemTags.tagId))
            .where(inArray(workItemTags.workItemId, ids));
          const namesByItem = new Map<number, string[]>();
          for (const row of tagRows) namesByItem.set(row.workItemId, [...(namesByItem.get(row.workItemId) ?? []), row.name]);
          events = ids.map((workItemId) => {
            const from = (namesByItem.get(workItemId) ?? []).sort();
            return {
              workItemId,
              type: "fields_edited",
              payload: { fields: { tags: { from, to: from.filter((n) => n !== value.name) } }, reason: "catalog_value_deleted" },
            };
          });
          await tx.delete(workItemTags).where(eq(workItemTags.tagId, value.id));
          await tx.update(workItems).set({ updatedAt: now }).where(inArray(workItems.id, ids));
        }
      } else {
        const column = kind === "area" ? workItems.areaId : workItems.sizeId;
        const cleared = await tx
          .update(workItems)
          .set(kind === "area" ? { areaId: null, updatedAt: now } : { sizeId: null, updatedAt: now })
          .where(and(eq(workItems.projectId, project.id), eq(column, value.id)))
          .returning({ id: workItems.id });
        events = cleared.map(({ id }) => ({
          workItemId: id,
          type: "fields_edited",
          payload: { fields: { [kind]: { from: value.name, to: null } }, reason: "catalog_value_deleted" },
        }));
      }

      // Constitution, Estándares § Auditoría; FR-034 of 011 (who, and through which agent).
      await logActivity(tx, events);
      await tx.delete(table).where(eq(table.id, value.id));
      return events.length;
    });

    revalidateProject(input.projectPublicId);
    return { affectedWorkItems: affected };
  });
}

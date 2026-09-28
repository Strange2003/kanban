"use server";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMembers, projects, workItems } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AppError, runAction, type Result } from "@/lib/errors";

// KAN-10: global search (⌘K). Account-level like listMyProjects: it needs a
// browser session — deliberately NOT getActor(), so an AI agent can't reach it
// (MCP has its own search_work_items tool).
export type SearchResults = {
  projects: { publicId: string; name: string }[];
  workItems: { displayId: string; displayNumber: number; title: string; projectPublicId: string; projectName: string }[];
};

const MAX_QUERY_LENGTH = 100;
const MAX_PROJECTS = 5;
const MAX_WORK_ITEMS = 15;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchWorkspace(query: string): Promise<Result<SearchResults>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const q = (typeof query === "string" ? query : "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return { projects: [], workItems: [] };

    // Membership is resolved from the session here — the client sends only text.
    const myProjectIds = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));
    const pattern = `%${escapeLike(q)}%`;

    const idMatch = /^([a-z0-9]+)-(\d{1,9})$/i.exec(q);
    const exactId = idMatch
      ? and(
          sql`lower(${projects.workItemPrefix}) = ${idMatch[1]!.toLowerCase()}`,
          eq(workItems.displayNumber, Number(idMatch[2])),
        )
      : undefined;

    const [projectRows, workItemRows] = await Promise.all([
      db
        .select({ publicId: projects.publicId, name: projects.name })
        .from(projects)
        .where(and(inArray(projects.id, myProjectIds), ilike(projects.name, pattern)))
        .orderBy(desc(projects.updatedAt))
        .limit(MAX_PROJECTS),
      db
        .select({
          prefix: projects.workItemPrefix,
          displayNumber: workItems.displayNumber,
          title: workItems.title,
          projectPublicId: projects.publicId,
          projectName: projects.name,
        })
        .from(workItems)
        .innerJoin(projects, eq(projects.id, workItems.projectId))
        .where(and(inArray(workItems.projectId, myProjectIds), or(ilike(workItems.title, pattern), exactId)))
        // Exact ID match first. No placeholder otherwise: a bare `ORDER BY 0`
        // is read by Postgres as a (non-existent) select-list position.
        .orderBy(
          ...(exactId ? [sql`case when ${exactId} then 0 else 1 end`] : []),
          desc(workItems.updatedAt),
        )
        .limit(MAX_WORK_ITEMS),
    ]);

    return {
      projects: projectRows,
      workItems: workItemRows.map((row) => ({
        displayId: `${row.prefix}-${row.displayNumber}`,
        displayNumber: row.displayNumber,
        title: row.title,
        projectPublicId: row.projectPublicId,
        projectName: row.projectName,
      })),
    };
  });
}

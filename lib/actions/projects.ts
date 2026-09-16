"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, projectMembers } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getSession } from "@/lib/auth";
import { requireProjectMember, requireProjectOwner } from "@/lib/permissions";
import { generatePublicId, deriveWorkItemPrefix } from "@/lib/ids";
import { AppError, runAction, type Result } from "@/lib/errors";

export type ProjectWithMemberCount = typeof projects.$inferSelect & { memberCount: number };

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
  description: z.string().trim().optional(),
});

async function generateUniqueWorkItemPrefix(name: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = deriveWorkItemPrefix(name, attempt);
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.workItemPrefix, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new AppError("PREFIX_GENERATION_FAILED", "Could not generate a unique project prefix.");
}

// FR-001/FR-002/FR-003 of 002-project-spaces
export async function createProject(input: {
  name: string;
  description?: string;
}): Promise<Result<typeof projects.$inferSelect>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("NAME_REQUIRED", parsed.error.issues[0]?.message ?? "Project name is required.");
    }

    const publicId = generatePublicId();
    const workItemPrefix = await generateUniqueWorkItemPrefix(parsed.data.name);

    const project = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          publicId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          workItemPrefix,
          ownerId: session.user.id,
        })
        .returning();

      if (!created) throw new AppError("UNKNOWN_ERROR", "Could not create the project.");

      await tx.insert(projectMembers).values({
        projectId: created.id,
        userId: session.user.id,
        role: "owner",
      });

      return created;
    });

    revalidatePath("/");
    return project;
  });
}

// FR-004/FR-011 of 002-project-spaces: group the current user's projects by
// member count — 1 = Personal, 2+ = Shared. Classification is always
// derived here, never stored (Principle II of the constitution).
export async function listMyProjects(
  query: { search?: string } = {},
): Promise<Result<{ personal: ProjectWithMemberCount[]; shared: ProjectWithMemberCount[] }>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const myProjectIds = db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    const search = query.search?.trim();

    const rows = await db
      .select({
        project: projects,
        memberCount: sql<number>`count(${projectMembers.userId})`.mapWith(Number),
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(
        and(inArray(projects.id, myProjectIds), search ? ilike(projects.name, `%${search}%`) : undefined),
      )
      .groupBy(projects.id)
      .orderBy(desc(projects.updatedAt));

    const withCount: ProjectWithMemberCount[] = rows.map((r) => ({ ...r.project, memberCount: r.memberCount }));

    return {
      personal: withCount.filter((p) => p.memberCount === 1),
      shared: withCount.filter((p) => p.memberCount >= 2),
    };
  });
}

const renameProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
});

// FR-005/FR-008 of 002-project-spaces
export async function renameProject(input: {
  projectPublicId: string;
  name: string;
}): Promise<Result<typeof projects.$inferSelect>> {
  return runAction(async () => {
    await requireProjectOwner(input.projectPublicId);

    const parsed = renameProjectSchema.safeParse({ name: input.name });
    if (!parsed.success) {
      throw new AppError("NAME_REQUIRED", parsed.error.issues[0]?.message ?? "Project name is required.");
    }

    const [updated] = await db
      .update(projects)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(projects.publicId, input.projectPublicId))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Project not found.");

    revalidatePath(`/projects/${input.projectPublicId}`);
    revalidatePath(`/projects/${input.projectPublicId}/settings`);
    revalidatePath("/");
    return updated;
  });
}

// FR-009 of 002-project-spaces
export async function updateProjectDescription(input: {
  projectPublicId: string;
  description: string;
}): Promise<Result<typeof projects.$inferSelect>> {
  return runAction(async () => {
    await requireProjectOwner(input.projectPublicId);

    const [updated] = await db
      .update(projects)
      .set({ description: input.description.trim() || null, updatedAt: new Date() })
      .where(eq(projects.publicId, input.projectPublicId))
      .returning();
    if (!updated) throw new AppError("NOT_FOUND", "Project not found.");

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
    return updated;
  });
}

// FR-006/FR-007 of 002-project-spaces. Cascades to project_members,
// invitations, stages, work_items, tags via onDelete: cascade (Principle IV).
export async function deleteProject(projectPublicId: string): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectOwner(projectPublicId);

    await db.delete(projects).where(eq(projects.id, project.id));

    revalidatePath("/");
  });
}

// FR-012/FR-014/FR-015 of 002-project-spaces
export async function removeMember(input: { projectPublicId: string; userId: string }): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectOwner(input.projectPublicId);

    if (input.userId === project.ownerId) {
      throw new AppError("CANNOT_REMOVE_OWNER", "The project owner can't be removed.");
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, input.userId)));

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
    revalidatePath("/");
  });
}

export type ProjectMemberWithUser = {
  userId: string;
  role: "owner" | "member";
  name: string;
  email: string;
};

// Supports the members list in project settings (removeMember's UI).
export async function listProjectMembers(projectPublicId: string): Promise<Result<ProjectMemberWithUser[]>> {
  return runAction(async () => {
    const { project } = await requireProjectMember(projectPublicId);

    const rows = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        name: user.name,
        email: user.email,
      })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, project.id))
      .orderBy(desc(sql`${projectMembers.role} = 'owner'`), user.name);

    return rows;
  });
}

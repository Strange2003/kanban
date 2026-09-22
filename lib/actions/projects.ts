"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, projectMembers } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getSession } from "@/lib/auth";
import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, type AssignableRole, type ProjectRole } from "@/lib/roles";
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

// FR-005/FR-008 of 002-project-spaces; owner-only per FR-014 of 007-roles-permissions.
export async function renameProject(input: {
  projectPublicId: string;
  name: string;
}): Promise<Result<typeof projects.$inferSelect>> {
  return runAction(async () => {
    await requireProjectPermission(input.projectPublicId, "project:edit");

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
    await requireProjectPermission(input.projectPublicId, "project:edit");

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
    const { project } = await requireProjectPermission(projectPublicId, "project:delete");

    await db.delete(projects).where(eq(projects.id, project.id));

    revalidatePath("/");
  });
}

// FR-012/FR-014/FR-015 of 002-project-spaces
export async function removeMember(input: { projectPublicId: string; userId: string }): Promise<Result<void>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(input.projectPublicId, "member:remove");

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

// FR-013/FR-014 of 002-project-spaces
export async function leaveProject(projectPublicId: string): Promise<Result<void>> {
  return runAction(async () => {
    let context: Awaited<ReturnType<typeof requireProjectPermission>>;
    try {
      context = await requireProjectPermission(projectPublicId, "project:leave");
    } catch (error) {
      // The owner is the only role the matrix denies "project:leave" to. Keep
      // the specific OWNER_CANNOT_LEAVE code (002, FR-014) rather than the
      // generic ROLE_NOT_PERMITTED, because it says what to do instead.
      if (error instanceof AppError && error.code === "ROLE_NOT_PERMITTED") {
        throw new AppError("OWNER_CANNOT_LEAVE", "Transfer ownership or delete the project instead of leaving it.");
      }
      throw error;
    }
    const { session, project } = context;

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id)));

    revalidatePath("/");
  });
}

export type ProjectMemberWithUser = {
  userId: string;
  role: ProjectRole;
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * First step of every operation that changes roles (changeMemberRole,
 * transferOwnership): locks the project row so these operations run one at a
 * time per project, then re-verifies — with the lock held — that the actor is
 * still the owner. The permission check that ran before the transaction may be
 * stale by now (e.g. a concurrent transfer just demoted them), and this is
 * what makes that race fail cleanly instead of applying a role change on the
 * strength of an ownership that no longer exists (SC-006; research.md §
 * Invariante un solo owner y concurrencia).
 */
async function lockProjectAsOwner(tx: Tx, projectId: number, actorUserId: string) {
  const [locked] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1).for("update");
  if (!locked) throw new AppError("NOT_FOUND", "Project not found.");

  const [actor] = await tx
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, actorUserId)))
    .limit(1);
  if (!actor || actor.role !== "owner") {
    throw new AppError("ROLE_NOT_PERMITTED", "Your role in this project changed — only the owner can do this.");
  }

  return locked;
}

const changeMemberRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

// FR-002/FR-006 of 007-roles-permissions. Member <-> Viewer only: `owner` is
// never assignable here (it's only reachable through transferOwnership).
export async function changeMemberRole(input: {
  projectPublicId: string;
  userId: string;
  role: AssignableRole;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { session, project } = await requireProjectPermission(input.projectPublicId, "member:changeRole");

    const parsed = changeMemberRoleSchema.safeParse({ role: input.role });
    if (!parsed.success) {
      throw new AppError("INVALID_ROLE", "Choose either Member or Viewer.");
    }

    await db.transaction(async (tx) => {
      const locked = await lockProjectAsOwner(tx, project.id, session.user.id);

      const [target] = await tx
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, input.userId)))
        .limit(1);
      if (!target) throw new AppError("NOT_A_MEMBER", "That person is no longer a member of this project.");
      if (target.role === "owner" || input.userId === locked.ownerId) {
        throw new AppError(
          "CANNOT_CHANGE_OWNER_ROLE",
          "The owner's role can't be changed — transfer ownership to someone else instead.",
        );
      }

      // Conditional UPDATE: 0 rows means the member vanished (or became the
      // owner) since the read above, so reject instead of pretending it worked.
      const updated = await tx
        .update(projectMembers)
        .set({ role: parsed.data.role })
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, input.userId),
            ne(projectMembers.role, "owner"),
          ),
        )
        .returning({ userId: projectMembers.userId });
      if (updated.length === 0) {
        throw new AppError("NOT_A_MEMBER", "That person is no longer a member of this project.");
      }
    });

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
  });
}

// FR-002/FR-011/FR-012/FR-013 of 007-roles-permissions. Immediate, with no
// acceptance step (Clarifications 2026-09-18): the recipient becomes the owner
// and the previous owner becomes a Member, in ONE transaction, so the project
// is never left without an owner or with two.
export async function transferOwnership(input: {
  projectPublicId: string;
  newOwnerUserId: string;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { session, project } = await requireProjectPermission(input.projectPublicId, "project:transferOwnership");

    if (input.newOwnerUserId === session.user.id) {
      throw new AppError("CANNOT_TRANSFER_TO_SELF", "You are already the owner of this project.");
    }

    await db.transaction(async (tx) => {
      await lockProjectAsOwner(tx, project.id, session.user.id);

      // Demote BEFORE promoting: project_members_one_owner_idx allows only one
      // `owner` row per project, so promoting first would violate it midway.
      const demoted = await tx
        .update(projectMembers)
        .set({ role: "member" })
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, session.user.id),
            eq(projectMembers.role, "owner"),
          ),
        )
        .returning({ userId: projectMembers.userId });
      if (demoted.length === 0) {
        throw new AppError("ROLE_NOT_PERMITTED", "Your role in this project changed — only the owner can do this.");
      }

      // Any role can be promoted, a Viewer included (FR-011). 0 rows means the
      // recipient left or was removed meanwhile: throwing rolls the demotion
      // back too, so the original owner keeps the project (FR-012).
      const promoted = await tx
        .update(projectMembers)
        .set({ role: "owner" })
        .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, input.newOwnerUserId)))
        .returning({ userId: projectMembers.userId });
      if (promoted.length === 0) {
        throw new AppError("NOT_A_MEMBER", "That person is no longer a member of this project.");
      }

      // projects.owner_id must never disagree with the membership that has the owner role.
      await tx
        .update(projects)
        .set({ ownerId: input.newOwnerUserId, updatedAt: new Date() })
        .where(eq(projects.id, project.id));
    });

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
    revalidatePath("/");
  });
}

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMembers, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { ROLE_LABELS, can, type Permission } from "@/lib/roles";

/**
 * Principle IV of the constitution: every read/write touching a project
 * MUST verify the requesting user's membership first — never trust a
 * client-supplied project id alone.
 */
export async function requireProjectMember(projectPublicId: string) {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHENTICATED", "You must be signed in.");
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.publicId, projectPublicId))
    .limit(1);

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found.");
  }

  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id)))
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this project.");
  }

  return { session, project, membership };
}

/**
 * Membership check + the permission matrix of 007-roles-permissions
 * (lib/roles.ts). Every Server Action that MUTATES project data goes through
 * this, with the permission key for what it does — never an inline
 * `membership.role === ...` check.
 *
 * The role is read from `project_members` on every call and never cached in
 * the session, so a role change applies to the caller's very next action
 * without signing out (FR-003, SC-003).
 *
 * A caller who is a member but lacks the permission gets `ROLE_NOT_PERMITTED`,
 * deliberately not `FORBIDDEN`: pages turn `FORBIDDEN` ("not a member") into a
 * 404, and a rejected viewer of their own project must not see one.
 */
export async function requireProjectPermission(projectPublicId: string, permission: Permission) {
  const result = await requireProjectMember(projectPublicId);
  const { role } = result.membership;
  if (!can(role, permission)) {
    throw new AppError(
      "ROLE_NOT_PERMITTED",
      `Your role in this project (${ROLE_LABELS[role]}) doesn't allow this action.`,
    );
  }
  return result;
}

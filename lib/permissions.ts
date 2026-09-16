import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMembers, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";

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

export async function requireProjectOwner(projectPublicId: string) {
  const result = await requireProjectMember(projectPublicId);
  if (result.membership.role !== "owner") {
    throw new AppError("FORBIDDEN", "Only the project owner can do this.");
  }
  return result;
}

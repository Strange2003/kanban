"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { invitations, notifications, projectMembers, projects } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { getSession } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, can, type AssignableRole, type ProjectRole } from "@/lib/roles";
import { generatePublicId } from "@/lib/ids";
import { AppError, runAction, type Result } from "@/lib/errors";

const RATE_LIMIT_MAX_PER_HOUR = 20; // FR-017 of 001; see Manual Action #7 of plan.md to tune.

const sendInvitationSchema = z.object({
  email: z.email("Enter a valid email address."),
});

// `owner` is deliberately not part of this enum (FR-002 of 007-roles-permissions):
// an invitation can only grant Member or Viewer.
const invitationRoleSchema = z.enum(ASSIGNABLE_ROLES);

// FR-005/FR-006/FR-007/FR-012/FR-013/FR-017 of 001-accounts-invitations, as
// amended by FR-008/FR-009 of 007-roles-permissions: the Owner AND Members can
// invite (Viewers can't), and whoever invites picks the role the invitee gets.
export async function sendInvitation(input: {
  projectPublicId: string;
  email: string;
  role: AssignableRole;
}): Promise<Result<typeof invitations.$inferSelect>> {
  return runAction(async () => {
    const { actor, project } = await requireProjectPermission(input.projectPublicId, "invitation:send");

    const parsed = sendInvitationSchema.safeParse({ email: input.email });
    if (!parsed.success) {
      throw new AppError("INVALID_EMAIL", parsed.error.issues[0]?.message ?? "Enter a valid email address.");
    }
    const email = parsed.data.email;

    const parsedRole = invitationRoleSchema.safeParse(input.role);
    if (!parsedRole.success) {
      throw new AppError("INVALID_ROLE", "Choose either Member or Viewer for the invitation.");
    }
    const role = parsedRole.data;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(invitations)
      .where(and(eq(invitations.invitedByUserId, actor.userId), gte(invitations.createdAt, oneHourAgo)));
    if ((recentCount?.count ?? 0) >= RATE_LIMIT_MAX_PER_HOUR) {
      throw new AppError("RATE_LIMITED", "You've sent too many invitations. Try again in a bit.");
    }

    const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existingUser) {
      const [membership] = await db
        .select()
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, existingUser.id)))
        .limit(1);
      if (membership) throw new AppError("ALREADY_MEMBER", "This person is already a member of the project.");
    }

    const [existingInvite] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.projectId, project.id),
          eq(invitations.invitedEmail, email),
          eq(invitations.status, "pending"),
        ),
      )
      .limit(1);
    if (existingInvite) throw new AppError("ALREADY_INVITED", "This email already has a pending invitation.");

    const [created] = await db
      .insert(invitations)
      .values({
        publicId: generatePublicId(),
        projectId: project.id,
        invitedEmail: email,
        invitedByUserId: actor.userId,
        role,
        status: "pending",
      })
      .returning();
    if (!created) throw new AppError("UNKNOWN_ERROR", "Could not create the invitation.");

    // FR-007: only notify immediately if the account already exists and is verified —
    // otherwise applyPendingInvitationsForUser picks it up on signup/verification.
    if (existingUser?.emailVerified) {
      await db.insert(notifications).values({
        userId: existingUser.id,
        type: "invitation",
        payload: { invitationId: created.publicId, projectId: project.id },
      });
    }

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
    return created;
  });
}

// FR-008/FR-010 of 001-accounts-invitations
export async function respondToInvitation(input: {
  invitationId: string;
  action: "accept" | "reject";
}): Promise<Result<void>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.publicId, input.invitationId))
      .limit(1);
    if (!invitation) throw new AppError("NOT_FOUND", "Invitation not found.");
    if (invitation.invitedEmail !== session.user.email) {
      throw new AppError("FORBIDDEN", "This invitation isn't addressed to you.");
    }
    if (invitation.status !== "pending") {
      throw new AppError("INVITATION_NOT_PENDING", "This invitation has already been resolved.");
    }

    await db.transaction(async (tx) => {
      if (input.action === "accept") {
        await tx.insert(projectMembers).values({
          projectId: invitation.projectId,
          userId: session.user.id,
          // The role chosen by whoever invited (FR-008 of 007); invitations from
          // before that feature default to "member", so they behave as before.
          role: invitation.role,
        });
      }
      await tx
        .update(invitations)
        .set({ status: input.action === "accept" ? "accepted" : "rejected", respondedAt: new Date() })
        .where(eq(invitations.id, invitation.id));
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, session.user.id),
            eq(sql<string>`${notifications.payload}->>'invitationId'`, invitation.publicId),
          ),
        );
    });

    revalidatePath("/");
  });
}

// FR-011 of 001-accounts-invitations, as amended by FR-010 of 007-roles-permissions:
// the owner cancels any pending invitation; a Member only the ones they sent.
export async function cancelInvitation(input: {
  projectPublicId: string;
  invitationId: string;
}): Promise<Result<void>> {
  return runAction(async () => {
    const { actor, project, membership } = await requireProjectPermission(
      input.projectPublicId,
      "invitation:cancelOwn",
    );

    const [invitation] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.publicId, input.invitationId), eq(invitations.projectId, project.id)))
      .limit(1);
    if (!invitation) throw new AppError("NOT_FOUND", "Invitation not found.");
    if (invitation.invitedByUserId !== actor.userId && !can(membership.role, "invitation:cancelAny")) {
      throw new AppError("ROLE_NOT_PERMITTED", "Only the sender or the project owner can cancel this invitation.");
    }
    if (invitation.status !== "pending") {
      throw new AppError("INVITATION_NOT_PENDING", "This invitation has already been resolved.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({ status: "cancelled", respondedAt: new Date() })
        .where(eq(invitations.id, invitation.id));
      // Drop the invitee's notification too, if one was ever created (FR-011).
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(sql<string>`${notifications.payload}->>'invitationId'`, invitation.publicId));
    });

    revalidatePath(`/projects/${input.projectPublicId}/settings`);
  });
}

export type PendingInvitation = {
  publicId: string;
  invitedEmail: string;
  // FR-008/FR-010 of 007-roles-permissions: the role the invitee will get, and
  // who sent it (a Member can only cancel their own).
  role: ProjectRole;
  invitedByUserId: string;
  createdAt: Date;
};

// Supports the "Cancel" action on the settings page's pending-invitations list.
// FR-018 of 007-roles-permissions: a Viewer gets ROLE_NOT_PERMITTED and no rows —
// the list exposes third parties' emails they have no reason to see.
export async function listPendingInvitations(projectPublicId: string): Promise<Result<PendingInvitation[]>> {
  return runAction(async () => {
    const { project } = await requireProjectPermission(projectPublicId, "invitation:viewPending");

    return db
      .select({
        publicId: invitations.publicId,
        invitedEmail: invitations.invitedEmail,
        role: invitations.role,
        invitedByUserId: invitations.invitedByUserId,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(and(eq(invitations.projectId, project.id), eq(invitations.status, "pending")))
      .orderBy(desc(invitations.createdAt));
  });
}

export type NotificationWithInvitation = {
  id: number;
  createdAt: Date;
  invitationPublicId: string;
  projectPublicId: string;
  projectName: string;
  invitedByName: string;
};

// FR-006 of 001-accounts-invitations, US3
export async function listMyNotifications(): Promise<Result<NotificationWithInvitation[]>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const rows = await db
      .select({
        id: notifications.id,
        createdAt: notifications.createdAt,
        invitationPublicId: invitations.publicId,
        projectPublicId: projects.publicId,
        projectName: projects.name,
        invitedByName: user.name,
      })
      .from(notifications)
      .innerJoin(invitations, eq(invitations.publicId, sql<string>`${notifications.payload}->>'invitationId'`))
      .innerJoin(projects, eq(projects.id, invitations.projectId))
      .innerJoin(user, eq(user.id, invitations.invitedByUserId))
      .where(and(eq(notifications.userId, session.user.id), sql`${notifications.readAt} is null`))
      .orderBy(desc(notifications.createdAt));

    return rows;
  });
}

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, notifications } from "@/db/schema";

/**
 * Applies any pending invitation addressed to `email` to the now-verified
 * account `userId`, by creating an in-app notification for each one.
 * FR-007 / FR-015 of 001-accounts-invitations.
 *
 * Called from lib/auth.ts's `databaseHooks` after a user is created
 * (Google sign-up, verified immediately) or updated to `emailVerified: true`
 * (email/password sign-up, once the verification link is followed).
 *
 * Deliberately not in a "use server" file: it trusts its arguments, so it
 * must never be callable from the client.
 */
export async function applyPendingInvitationsForUser(userId: string, email: string) {
  const pending = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.invitedEmail, email), eq(invitations.status, "pending")));

  for (const invitation of pending) {
    await db.insert(notifications).values({
      userId,
      type: "invitation",
      payload: { invitationId: invitation.publicId, projectId: invitation.projectId },
    });
  }
}

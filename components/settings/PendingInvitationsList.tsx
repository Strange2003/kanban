"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelInvitation, type PendingInvitation } from "@/lib/actions/accounts-invitations";
import { isRolePermissionError } from "@/lib/errors";
import { ROLE_LABELS, can, type ProjectRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";

// FR-011 of 001-accounts-invitations; FR-008/FR-010 of 007-roles-permissions:
// each row shows the role the invitee will get, and "Cancel" only appears where
// the viewer's role allows it (the owner: any; a Member: only their own).
export function PendingInvitationsList({
  projectPublicId,
  invitations,
  role,
  currentUserId,
}: {
  projectPublicId: string;
  invitations: PendingInvitation[];
  role: ProjectRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleCancel(invitationId: string) {
    setError(null);
    setCancellingId(invitationId);
    const result = await cancelInvitation({ projectPublicId, invitationId });
    setCancellingId(null);

    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Pending invitations</h3>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {invitations.map((invitation) => (
          <li key={invitation.publicId} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>
              {invitation.invitedEmail}{" "}
              <span className="text-muted-foreground text-xs">as {ROLE_LABELS[invitation.role]}</span>
            </span>
            {(can(role, "invitation:cancelAny") ||
              (can(role, "invitation:cancelOwn") && invitation.invitedByUserId === currentUserId)) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCancel(invitation.publicId)}
                disabled={cancellingId === invitation.publicId}
              >
                {cancellingId === invitation.publicId ? "Cancelling..." : "Cancel"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

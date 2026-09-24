"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeMemberRole, removeMember, type ProjectMemberWithUser } from "@/lib/actions/projects";
import { isRolePermissionError } from "@/lib/errors";
import { ASSIGNABLE_ROLES, ROLE_LABELS, can, type AssignableRole, type ProjectRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { InviteMemberDialog } from "@/components/sidebar/InviteMemberDialog";
import { TransferOwnershipDialog } from "@/components/settings/TransferOwnershipDialog";

// FR-012/FR-014 of 002-project-spaces, the invite entry point (FR-005 of 001),
// and — FR-006/FR-007 of 007-roles-permissions — every member's role plus the
// owner's controls to change it. `role` is the signed-in user's own role: the
// controls only reflect it, the Server Actions enforce it.
export function MembersList({
  projectPublicId,
  members,
  role,
  currentUserId,
}: {
  projectPublicId: string;
  members: ProjectMemberWithUser[];
  role: ProjectRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  // The select is controlled by the server's value, so without an optimistic
  // copy it would snap back to the old role until router.refresh() lands. The
  // transition wraps the refresh too, so the optimistic role holds until the
  // new props arrive (or is dropped if the action fails).
  const [optimisticMembers, setOptimisticRole] = useOptimistic(
    members,
    (current, change: { userId: string; role: AssignableRole }) =>
      current.map((m) => (m.userId === change.userId ? { ...m, role: change.role } : m)),
  );
  const [changingRole, startRoleChange] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canChangeRole = can(role, "member:changeRole");
  const canRemove = can(role, "member:remove");
  const canTransfer = can(role, "project:transferOwnership");

  async function handleRemove(userId: string) {
    setError(null);
    setRemovingUserId(userId);
    const result = await removeMember({ projectPublicId, userId });
    setRemovingUserId(null);

    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    router.refresh();
  }

  function handleChangeRole(userId: string, nextRole: AssignableRole) {
    setError(null);
    startRoleChange(async () => {
      setOptimisticRole({ userId, role: nextRole });
      const result = await changeMemberRole({ projectPublicId, userId, role: nextRole });
      // On failure, NOT_A_MEMBER / ROLE_NOT_PERMITTED mean the list on screen is stale.
      if (!result.ok) setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Members</h2>
        {can(role, "invitation:send") && (
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ul className="divide-y divide-border rounded-md border border-border">
        {optimisticMembers.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>
              {member.name}
              {member.userId === currentUserId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {canChangeRole && member.role !== "owner" ? (
                <select
                  aria-label={`Role of ${member.name}`}
                  value={member.role}
                  onChange={(e) => handleChangeRole(member.userId, e.target.value as AssignableRole)}
                  disabled={changingRole}
                  className="border-input bg-background h-8 rounded-md border px-2 text-xs focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((assignable) => (
                    <option key={assignable} value={assignable}>
                      {ROLE_LABELS[assignable]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-muted-foreground text-xs">{ROLE_LABELS[member.role]}</span>
              )}
              {canTransfer && member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTransferTarget({ userId: member.userId, name: member.name })}
                  aria-label={`Make ${member.name} the owner`}
                >
                  Make owner
                </Button>
              )}
              {canRemove && member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(member.userId)}
                  disabled={removingUserId === member.userId}
                >
                  {removingUserId === member.userId ? "Removing..." : "Remove"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <InviteMemberDialog projectPublicId={projectPublicId} open={inviteOpen} onOpenChange={setInviteOpen} />
      {canTransfer && (
        <TransferOwnershipDialog
          projectPublicId={projectPublicId}
          member={transferTarget}
          onOpenChange={(open) => {
            if (!open) setTransferTarget(null);
          }}
        />
      )}
    </section>
  );
}

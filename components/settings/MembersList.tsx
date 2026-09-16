"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMember, type ProjectMemberWithUser } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { InviteMemberDialog } from "@/components/sidebar/InviteMemberDialog";

// FR-012/FR-014 of 002-project-spaces, plus the invite entry point (FR-005/FR-009 of 001)
export function MembersList({
  projectPublicId,
  members,
  isOwner,
}: {
  projectPublicId: string;
  members: ProjectMemberWithUser[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(userId: string) {
    setError(null);
    setRemovingUserId(userId);
    const result = await removeMember({ projectPublicId, userId });
    setRemovingUserId(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Members</h2>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ul className="divide-y divide-border rounded-md border border-border">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>
              {member.name} <span className="text-muted-foreground">({member.role})</span>
            </span>
            {isOwner && member.role !== "owner" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(member.userId)}
                disabled={removingUserId === member.userId}
              >
                {removingUserId === member.userId ? "Removing..." : "Remove"}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <InviteMemberDialog projectPublicId={projectPublicId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </section>
  );
}

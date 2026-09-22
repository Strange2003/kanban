"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendInvitation } from "@/lib/actions/accounts-invitations";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/roles";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// FR-005/FR-006 of 001-accounts-invitations, plus FR-008/FR-009 of
// 007-roles-permissions: the inviter picks the role the invitee gets (Member or
// Viewer — never Owner) and both the Owner and Members can invite.
const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  member: "Can edit the board, Work Items and relations, and invite others.",
  viewer: "Can see everything but can't change anything.",
};

// FR-005/FR-006/FR-009 of 001-accounts-invitations
export function InviteMemberDialog({
  projectPublicId,
  open,
  onOpenChange,
}: {
  projectPublicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    const result = await sendInvitation({ projectPublicId, email, role });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setEmail("");
    setRole("member");
    setSuccess(true);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setSuccess(false);
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogHeader>
        <DialogTitle>Invite a collaborator</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableRole)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-1"
          >
            {ASSIGNABLE_ROLES.map((assignable) => (
              <option key={assignable} value={assignable}>
                {ROLE_LABELS[assignable]}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">{ROLE_DESCRIPTIONS[role]}</p>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className="text-sm text-muted-foreground">Invitation sent.</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send invitation"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { transferOwnership } from "@/lib/actions/projects";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// FR-011 of 007-roles-permissions: the confirmation MUST warn the owner about
// what they lose. The transfer itself is one Server Action with no "pending
// acceptance" state (Clarifications 2026-09-18) — this dialog is the only
// safeguard, so it names the person and spells out the consequences.
export function TransferOwnershipDialog({
  projectPublicId,
  member,
  onOpenChange,
}: {
  projectPublicId: string;
  // The member being made owner; `null` keeps the dialog closed.
  member: { userId: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!member) return;
    setError(null);
    setSubmitting(true);
    const result = await transferOwnership({ projectPublicId, newOwnerUserId: member.userId });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      // NOT_A_MEMBER / ROLE_NOT_PERMITTED: what's on screen is stale.
      router.refresh();
      return;
    }
    onOpenChange(false);
    // One Server Action, then a refresh — the settings page re-renders for the
    // new role (this user is now a Member) without chaining a second action.
    router.refresh();
  }

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogHeader>
        <DialogTitle>Transfer ownership{member ? ` to ${member.name}` : ""}?</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <p>
          {member?.name} will become the owner of this project, and you will become a Member. This takes effect
          immediately and they don&apos;t need to accept.
        </p>
        <p className="text-muted-foreground">
          You will lose the owner-only permissions: renaming or deleting the project, removing members, changing
          roles, and transferring ownership. Only the new owner can give them back.
        </p>
        {error && <p className="text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Transferring..." : "Transfer ownership"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

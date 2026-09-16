"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendInvitation } from "@/lib/actions/accounts-invitations";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    const result = await sendInvitation({ projectPublicId, email });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setEmail("");
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

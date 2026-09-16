"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { respondToInvitation, type NotificationWithInvitation } from "@/lib/actions/accounts-invitations";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// FR-006/FR-008 of 001-accounts-invitations, US3
export function NotificationsPanelClient({ notifications }: { notifications: NotificationWithInvitation[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept(invitationPublicId: string) {
    setError(null);
    setAcceptingId(invitationPublicId);
    const result = await respondToInvitation({ invitationId: invitationPublicId });
    setAcceptingId(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>

        {error && <p className="text-destructive mb-2 text-sm">{error}</p>}

        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-sm">You&apos;re all caught up.</p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <strong>{notification.invitedByName}</strong> invited you to{" "}
                  <strong>{notification.projectName}</strong>
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAccept(notification.invitationPublicId)}
                  disabled={acceptingId === notification.invitationPublicId}
                >
                  {acceptingId === notification.invitationPublicId ? "Accepting..." : "Accept"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}

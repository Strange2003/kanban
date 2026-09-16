"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { respondToInvitation, type NotificationWithInvitation } from "@/lib/actions/accounts-invitations";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// FR-006/FR-008/FR-010 of 001-accounts-invitations, US3/US4
export function NotificationsPanelClient({ notifications }: { notifications: NotificationWithInvitation[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(invitationPublicId: string, action: "accept" | "reject") {
    setError(null);
    setRespondingId(invitationPublicId);
    const result = await respondToInvitation({ invitationId: invitationPublicId, action });
    setRespondingId(null);

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
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRespond(notification.invitationPublicId, "reject")}
                    disabled={respondingId === notification.invitationPublicId}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRespond(notification.invitationPublicId, "accept")}
                    disabled={respondingId === notification.invitationPublicId}
                  >
                    {respondingId === notification.invitationPublicId ? "..." : "Accept"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}

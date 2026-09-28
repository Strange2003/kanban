"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationRead, respondToInvitation, type NotificationItem } from "@/lib/actions/accounts-invitations";
import { formatNotificationTime, formatUnreadBadge, groupNotificationsByDay } from "@/lib/notification-inbox";
import { describeNotification } from "@/components/sidebar/notification-kinds";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const INVITATION_STATUS_LABELS = {
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
} as const;

// FR-006/FR-008/FR-010 of 001-accounts-invitations, US3/US4; assignment
// notifications of 011-agent-access-mcp (FR-011..FR-013). Inbox redesign: KAN-3.
export function NotificationsPanelClient({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const badge = formatUnreadBadge(unreadCount);

  // Opening a notification marks it read (if it wasn't) and follows its link.
  async function handleMarkRead(notification: NotificationItem, href: string | null) {
    setError(null);
    if (!notification.read) {
      setRespondingId(`n${notification.id}`);
      const result = await markNotificationRead(notification.id);
      setRespondingId(null);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
    }
    if (href) {
      setOpen(false);
      router.push(href);
    } else {
      router.refresh();
    }
  }

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

  function renderRow(notification: NotificationItem, now: Date) {
    const { icon: Icon, content, href } = describeNotification(notification);
    const busy = respondingId === `n${notification.id}`;
    const pendingInvitation = notification.type === "invitation" && notification.status === "pending";
    const testId = notification.type === "work_item_assigned" ? "assignment-notification" : "invitation-notification";
    return (
      <li
        key={notification.id}
        data-testid={testId}
        data-unread={!notification.read}
        className={`flex items-start gap-3 rounded-md px-2 py-2 text-sm ${notification.read ? "" : "bg-primary/5"}`}
      >
        <span className="relative mt-0.5 shrink-0">
          <Icon className={`h-4 w-4 ${notification.read ? "text-muted-foreground" : "text-primary"}`} />
          {!notification.read && (
            <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-primary" role="img" aria-label="Unread" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className={notification.read ? "text-muted-foreground" : ""}>
            {href ? (
              <button
                type="button"
                className="rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                onClick={() => handleMarkRead(notification, href)}
                disabled={busy}
              >
                {content}
              </button>
            ) : (
              <span>{content}</span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatNotificationTime(notification.createdAt, now)}
            {notification.type === "invitation" && notification.status !== "pending" && (
              <> · {INVITATION_STATUS_LABELS[notification.status]}</>
            )}
          </p>
          {notification.type === "invitation" && pendingInvitation && (
            <div className="mt-2 flex gap-2">
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
          )}
        </div>
        {!notification.read && !pendingInvitation && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => handleMarkRead(notification, null)}
            disabled={busy}
          >
            Mark as read
          </Button>
        )}
      </li>
    );
  }

  const now = new Date();

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
        {badge && (
          <span
            data-testid="unread-badge"
            aria-label={`${unreadCount} unread`}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-medium text-primary-foreground"
          >
            {badge}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen} dismissible>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>

        {/* Rendered only while open: day grouping and relative times depend on the
            browser's time zone, which the server render can't know. */}
        {open && (
          <>
            {error && <p className="text-destructive mb-2 text-sm">{error}</p>}

            {unreadCount === 0 && <p className="text-muted-foreground mb-2 text-sm">You&apos;re all caught up.</p>}

            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {groupNotificationsByDay(notifications, now).map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <h3 className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wide uppercase">
                    {group.label}
                  </h3>
                  <ul className="space-y-1">{group.items.map((notification) => renderRow(notification, now))}</ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}

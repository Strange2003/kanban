import type { ReactNode } from "react";
import { ClipboardList, UserPlus, type LucideIcon } from "lucide-react";
import type {
  AssignmentNotification,
  NotificationItem,
  NotificationWithInvitation,
} from "@/lib/actions/accounts-invitations";

// Registry of notification kinds (KAN-3). To add a kind: add its variant to
// `NotificationItem` (lib/actions/accounts-invitations.ts) and one entry here
// mapping it to an icon, its sentence and, optionally, the page it opens.
// The panel itself never branches on `type` to render a row's content.
export type NotificationView = {
  icon: LucideIcon;
  /** Who did what, at a glance. */
  content: ReactNode;
  /** Where clicking the row leads; null when there is nowhere to go. */
  href: string | null;
};

type Registry = {
  [K in NotificationItem["type"]]: (notification: Extract<NotificationItem, { type: K }>) => NotificationView;
};

function describeInvitation(n: NotificationWithInvitation): NotificationView {
  return {
    icon: UserPlus,
    content: (
      <>
        <strong>{n.invitedByName}</strong> invited you to <strong>{n.projectName}</strong>
      </>
    ),
    href: null,
  };
}

function describeAssignment(n: AssignmentNotification): NotificationView {
  if (!n.available) {
    return {
      icon: ClipboardList,
      content: (
        <>
          <strong>{n.assignedByName}</strong> assigned you a Work Item that is no longer available.
        </>
      ),
      href: null,
    };
  }
  return {
    icon: ClipboardList,
    content: (
      <>
        <strong>{n.assignedByName}</strong> assigned you{" "}
        <strong>
          {n.workItemDisplayId} {n.title}
        </strong>{" "}
        in <strong>{n.projectName}</strong>
        {n.agentName && <span className="text-muted-foreground"> via {n.agentName}</span>}
      </>
    ),
    href: `/projects/${n.projectPublicId}/work-items/${n.displayNumber}`,
  };
}

const registry: Registry = {
  invitation: describeInvitation,
  work_item_assigned: describeAssignment,
};

export function describeNotification(notification: NotificationItem): NotificationView {
  // TypeScript can't correlate the union with its entry; `Registry` guarantees it.
  return (registry[notification.type] as (n: NotificationItem) => NotificationView)(notification);
}

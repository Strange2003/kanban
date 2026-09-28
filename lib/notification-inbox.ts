// Pure helpers of the notifications inbox (KAN-3), shared with the client.
// Day boundaries use the runtime's local time zone, so call them in the
// browser (the panel renders its list only once opened, avoiding a
// server/client time-zone mismatch on hydration).

export type NotificationGroupKey = "today" | "earlier";

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroupKey, string> = {
  today: "Today",
  earlier: "Earlier",
};

/** Bell badge text: "" (hidden) for 0, the number up to 9, then "9+". */
export function formatUnreadBadge(count: number): string {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Splits items (already newest first) into "Today" and "Earlier" sections,
 * keeping their order and omitting empty sections.
 */
export function groupNotificationsByDay<T extends { createdAt: Date }>(
  items: T[],
  now: Date = new Date(),
): { key: NotificationGroupKey; label: string; items: T[] }[] {
  const todayStart = startOfLocalDay(now);
  const groups: Record<NotificationGroupKey, T[]> = { today: [], earlier: [] };
  for (const item of items) {
    groups[item.createdAt.getTime() >= todayStart ? "today" : "earlier"].push(item);
  }
  return (["today", "earlier"] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, label: NOTIFICATION_GROUP_LABELS[key], items: groups[key] }));
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", otherwise "Sep 21" (plus the year when it differs). */
export function formatNotificationTime(createdAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (createdAt.getTime() >= startOfLocalDay(now)) return `${Math.floor(minutes / 60)} h ago`;
  const yesterdayStart = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (createdAt.getTime() >= yesterdayStart) return "Yesterday";
  return createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(createdAt.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

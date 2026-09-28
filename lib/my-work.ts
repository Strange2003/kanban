/**
 * Grouping and sorting rules of the "My work" page (KAN-6). Deliberately pure —
 * no `db`, `next/*` or `lib/auth` imports — so the client can bucket rows by
 * the viewer's local "today" and the rules are unit-tested.
 */
import { WORK_ITEM_LEVELS, type WorkItemLevel } from "./work-item-fields";

/** One Work Item assigned to the current user, flattened for display. */
export type MyWorkRow = {
  id: number;
  displayId: string;
  displayNumber: number;
  title: string;
  projectPublicId: string;
  projectName: string;
  stageName: string;
  isClosed: boolean;
  priority: WorkItemLevel | null;
  targetDate: string | null;
};

export const MY_WORK_BUCKETS = ["overdue", "today", "thisWeek", "later", "noDate", "closed"] as const;
export type MyWorkBucket = (typeof MY_WORK_BUCKETS)[number];

export const BUCKET_LABELS: Record<MyWorkBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  thisWeek: "This week",
  later: "Later",
  noDate: "No date",
  closed: "Closed",
};

export type MyWorkGroup = { bucket: MyWorkBucket; label: string; rows: MyWorkRow[] };

/** "YYYY-MM-DD" plus `days`, computed in UTC so no time zone or DST shifts it. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/**
 * Which bucket a row belongs to, judged against `today` (the viewer's local
 * calendar day). "This week" is tomorrow through the next 6 days. Every closed
 * row goes to "closed" — a past target date only means overdue while open.
 */
export function bucketFor(row: Pick<MyWorkRow, "isClosed" | "targetDate">, today: string): MyWorkBucket {
  if (row.isClosed) return "closed";
  const date = row.targetDate;
  if (date === null) return "noDate";
  if (date < today) return "overdue";
  if (date === today) return "today";
  if (date <= addDays(today, 6)) return "thisWeek";
  return "later";
}

// Critical first; a Work Item without priority after every level.
function priorityRank(priority: WorkItemLevel | null): number {
  return priority === null ? WORK_ITEM_LEVELS.length : WORK_ITEM_LEVELS.indexOf(priority);
}

/** Priority (most urgent first, empty last), then target date (earliest first, empty last), then id. */
export function compareMyWork(a: MyWorkRow, b: MyWorkRow): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;
  if (a.targetDate !== b.targetDate) {
    if (a.targetDate === null) return 1;
    if (b.targetDate === null) return -1;
    return a.targetDate < b.targetDate ? -1 : 1;
  }
  return a.id - b.id;
}

/** Non-empty buckets in display order, each sorted by `compareMyWork`. */
export function groupMyWork(rows: MyWorkRow[], today: string): MyWorkGroup[] {
  const byBucket = new Map<MyWorkBucket, MyWorkRow[]>();
  for (const row of rows) {
    const bucket = bucketFor(row, today);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row]);
  }
  return MY_WORK_BUCKETS.filter((bucket) => byBucket.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    rows: [...byBucket.get(bucket)!].sort(compareMyWork),
  }));
}

/**
 * The fixed set of extended Work Item fields from 008-work-item-fields
 * (spec.md FR-002/FR-003/FR-004). Deliberately pure — no `db`, `next/*` or
 * `lib/auth` imports — so client components can use the labels and the
 * overdue rule, and db/schema.ts builds its Postgres enums from the same list.
 */

// Declaration order IS urgency order: Postgres sorts an enum by declaration,
// so `ORDER BY priority` already puts the most urgent first (research.md §
// Prioridad y severidad) — don't reorder these.
export const WORK_ITEM_LEVELS = ["critical", "high", "medium", "low"] as const;

/** A priority or severity value — both use the same four-level scale. */
export type WorkItemLevel = (typeof WORK_ITEM_LEVELS)[number];

export const LEVEL_LABELS: Record<WorkItemLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * FR-010: a Work Item is overdue when its target date is before `today` and it
 * isn't closed. Dates are calendar days ("YYYY-MM-DD"), so plain string
 * comparison is date comparison; `today` is the viewer's local date (Edge
 * Cases: a target date only counts as overdue from the following day on).
 */
export function isOverdue(targetDate: string | null, closedAt: Date | string | null, today: string): boolean {
  return targetDate !== null && closedAt == null && targetDate < today;
}

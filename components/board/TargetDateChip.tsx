"use client";

import { CalendarDays } from "lucide-react";
import { formatCalendarDate, useLocalToday } from "@/lib/dates";
import { isOverdue } from "@/lib/work-item-fields";
import { cn } from "@/lib/utils";

// FR-010/FR-016 of 008-work-item-fields: the target date on a card, marked as
// overdue by the VIEWER's local date. `today` is null on the server and during
// hydration, so the mark only appears once the browser knows its own date.
export function TargetDateChip({ targetDate, closedAt }: { targetDate: string; closedAt: Date | string | null }) {
  const today = useLocalToday();
  const overdue = today !== null && isOverdue(targetDate, closedAt, today);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap",
        overdue ? "bg-destructive/10 font-medium text-destructive" : "text-muted-foreground",
      )}
      data-testid="target-date-chip"
      data-overdue={overdue || undefined}
    >
      <CalendarDays className="h-3 w-3" aria-hidden />
      {formatCalendarDate(targetDate)}
      {overdue && <span>· Overdue</span>}
    </span>
  );
}

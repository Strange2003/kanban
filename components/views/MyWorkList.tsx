"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLocalToday, formatCalendarDate } from "@/lib/dates";
import { groupMyWork, type MyWorkRow } from "@/lib/my-work";
import { PriorityBadge } from "@/components/board/PriorityBadge";

// KAN-6. The buckets depend on the viewer's local date, so they only render
// once it's known on the client (same rule as the List and Table views).
export function MyWorkList({ rows, showClosed }: { rows: MyWorkRow[]; showClosed: boolean }) {
  const today = useLocalToday();
  const groups = today ? groupMyWork(rows, today) : [];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">My work</h1>
        <Link
          href={showClosed ? "/my-work" : "/my-work?closed=1"}
          className="text-muted-foreground hover:text-foreground text-sm hover:underline"
          data-testid="my-work-toggle-closed"
        >
          {showClosed ? "Hide closed" : "Show closed"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm" data-testid="my-work-empty">
          {showClosed ? "No Work Items are assigned to you." : "No open Work Items are assigned to you."}
        </p>
      ) : !today ? (
        <p className="text-muted-foreground p-6 text-center text-sm">Loading...</p>
      ) : (
        <div className="flex flex-col gap-6 p-4">
          {groups.map((group) => (
            <section key={group.bucket} aria-label={group.label} data-testid={`my-work-group-${group.bucket}`}>
              <h2 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                {group.label} ({group.rows.length})
              </h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "hover:bg-accent/40 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm",
                      row.isClosed && "text-muted-foreground",
                    )}
                    data-testid="my-work-row"
                  >
                    <span className="w-24 shrink-0 whitespace-nowrap">{row.displayId}</span>
                    <Link
                      href={`/projects/${row.projectPublicId}/work-items/${row.displayNumber}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {row.title}
                    </Link>
                    <span className="text-muted-foreground max-w-40 truncate">{row.projectName}</span>
                    <span className="whitespace-nowrap">{row.stageName}</span>
                    <span className="w-16">{row.priority ? <PriorityBadge level={row.priority} /> : null}</span>
                    <span className={cn("w-24 whitespace-nowrap", group.bucket === "overdue" && "text-destructive font-medium")}>
                      {row.targetDate ? formatCalendarDate(row.targetDate) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

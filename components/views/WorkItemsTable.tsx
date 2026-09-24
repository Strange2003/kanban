"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocalToday, formatCalendarDate } from "@/lib/dates";
import {
  DEFAULT_VIEW_QUERY,
  filterWorkItems,
  sortWorkItems,
  type SortKey,
  type WorkItemViewOptions,
  type WorkItemViewRow,
} from "@/lib/work-item-view";
import { LEVEL_LABELS } from "@/lib/work-item-fields";
import { PriorityBadge } from "@/components/board/PriorityBadge";
import { TargetDateChip } from "@/components/board/TargetDateChip";
import { LocalDate } from "@/components/ui/local-date";
import { Button } from "@/components/ui/button";
import { ViewFilters } from "@/components/views/ViewFilters";
import { useViewQuery } from "@/components/views/useViewQuery";
import { cn } from "@/lib/utils";

// FR-005: the columns, in order. `sort: null` = not sortable (tags, FR-006).
const COLUMNS: { label: string; sort: SortKey | null; className?: string }[] = [
  { label: "ID", sort: "id", className: "whitespace-nowrap" },
  { label: "Title", sort: "title", className: "min-w-56" },
  { label: "Column", sort: "stage" },
  { label: "Status", sort: "status" },
  { label: "Priority", sort: "priority" },
  { label: "Severity", sort: "severity" },
  { label: "Area", sort: "area" },
  { label: "Iteration", sort: "iteration" },
  { label: "Tags", sort: null },
  { label: "Stakeholder", sort: "stakeholder" },
  { label: "Start date", sort: "startDate" },
  { label: "Target date", sort: "targetDate" },
  { label: "Created", sort: "createdAt" },
  { label: "Closed", sort: "closedAt" },
];

const Empty = () => <span className="text-muted-foreground">—</span>;

// US2 of 009-work-item-views: a flat, read-only (FR-011) table of every Work
// Item, sorted and filtered in memory (research.md § Cargar todo el proyecto)
// with the query kept in the address (FR-009).
export function WorkItemsTable({
  projectPublicId,
  rows,
  options,
}: {
  projectPublicId: string;
  rows: WorkItemViewRow[];
  options: WorkItemViewOptions;
}) {
  const validStages = useMemo(() => new Set(options.stages.map((s) => s.publicId)), [options.stages]);
  const [query, setQuery] = useViewQuery("table", validStages);
  const today = useLocalToday();

  const visible = useMemo(
    () => sortWorkItems(filterWorkItems(rows, query, today), query.sort, query.dir),
    [rows, query, today],
  );
  const waitingForToday = query.overdue && today === null;

  function sortBy(key: SortKey) {
    // First click ascending, second descending; a new column starts ascending.
    const dir = query.sort === key && query.dir === "asc" ? "desc" : "asc";
    setQuery({ ...query, sort: key, dir });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ViewFilters
        query={query}
        onChange={setQuery}
        options={options}
        shownCount={visible.length}
        totalCount={rows.length}
      />
      <p className="px-4 pt-2 text-xs text-muted-foreground md:hidden">Scroll sideways to see every field.</p>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max w-full border-collapse text-sm" data-testid="work-items-table">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="border-b border-border">
              {COLUMNS.map((col) => {
                const active = col.sort !== null && query.sort === col.sort;
                return (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("px-3 py-2 text-left font-medium whitespace-nowrap", col.className, col.sort === "id" && "sticky left-0 z-20 bg-card")}
                  >
                    {col.sort ? (
                      <button
                        type="button"
                        onClick={() => sortBy(col.sort!)}
                        className="hover:text-foreground inline-flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {col.label}
                        {active &&
                          (query.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {waitingForToday ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-muted-foreground px-3 py-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center" data-testid="table-no-results">
                  <p className="text-sm">No Work Items match these filters.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setQuery({ ...DEFAULT_VIEW_QUERY, sort: query.sort, dir: query.dir })}
                  >
                    Clear filters
                  </Button>
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={row.id}
                  className={cn("border-b border-border hover:bg-accent/40", row.isClosed && "text-muted-foreground")}
                  data-testid="table-row"
                >
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 whitespace-nowrap">{row.displayId}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/projects/${projectPublicId}/work-items/${row.displayNumber}`}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.stageName}</td>
                  <td className="px-3 py-2">{row.isClosed ? "Closed" : "Open"}</td>
                  <td className="px-3 py-2">{row.priority ? <PriorityBadge level={row.priority} /> : <Empty />}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.severity ? LEVEL_LABELS[row.severity] : <Empty />}</td>
                  <td className="px-3 py-2">{row.areaName ?? <Empty />}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.iterationName ?? <Empty />}</td>
                  <td className="px-3 py-2">
                    {row.tags.length ? (
                      <span className="flex flex-wrap gap-1">
                        {row.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <Empty />
                    )}
                  </td>
                  <td className="px-3 py-2">{row.stakeholder || <Empty />}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.startDate ? formatCalendarDate(row.startDate) : <Empty />}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.targetDate ? <TargetDateChip targetDate={row.targetDate} closedAt={row.closedAt} /> : <Empty />}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <LocalDate value={row.createdAt} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.closedAt ? <LocalDate value={row.closedAt} /> : <Empty />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocalToday } from "@/lib/dates";
import {
  DEFAULT_VIEW_QUERY,
  buildWorkItemTree,
  filterWorkItems,
  hasActiveFilters,
  type WorkItemTreeNode,
  type WorkItemViewOptions,
  type WorkItemViewRow,
} from "@/lib/work-item-view";
import { PriorityBadge } from "@/components/board/PriorityBadge";
import { Avatar } from "@/components/ui/avatar";
import { TargetDateChip } from "@/components/board/TargetDateChip";
import { Button } from "@/components/ui/button";
import { ViewFilters } from "@/components/views/ViewFilters";
import { useViewQuery } from "@/components/views/useViewQuery";
import { cn } from "@/lib/utils";

function collectParentIds(nodes: WorkItemTreeNode[], into: number[] = []): number[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.row.id);
      collectParentIds(node.children, into);
    }
  }
  return into;
}

// US3 of 009-work-item-views: the project's backlog as a parent/child tree
// (FR-012), collapsible (FR-014), with the Table's filters (FR-015) and read
// only (FR-016). Collapsing is plain React state — not saved, not in the URL.
export function WorkItemsList({
  projectPublicId,
  rows,
  options,
  currentUserId,
}: {
  projectPublicId: string;
  rows: WorkItemViewRow[];
  options: WorkItemViewOptions;
  // Resolves the "Assigned to me" filter (FR-008 of 011-agent-access-mcp).
  currentUserId: string;
}) {
  const validStages = useMemo(() => new Set(options.stages.map((s) => s.publicId)), [options.stages]);
  const [query, setQuery] = useViewQuery("list", validStages);
  const today = useLocalToday();
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());

  const filtering = hasActiveFilters(query);
  const matches = useMemo(
    () => filterWorkItems(rows, query, today, currentUserId),
    [rows, query, today, currentUserId],
  );
  const tree = useMemo(
    () => buildWorkItemTree(rows, filtering ? new Set(matches.map((r) => r.id)) : null),
    [rows, filtering, matches],
  );
  const waitingForToday = query.overdue && today === null;

  function toggle(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNodes(nodes: WorkItemTreeNode[], level: number) {
    return nodes.map((node) => {
      const { row } = node;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(row.id);
      return (
        <li
          key={row.id}
          role="treeitem"
          // Its own name only — otherwise it'd be computed from every nested child too.
          aria-label={`${row.displayId} ${row.title}`}
          aria-level={level}
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          aria-selected={false}
          data-testid="list-item"
          data-context={node.isContext || undefined}
        >
          <div
            className={cn(
              "flex items-center gap-2 border-b border-border py-1.5 pr-4 text-sm",
              (node.isContext || row.isClosed) && "opacity-60",
            )}
            style={{ paddingLeft: `${(level - 1) * 1.25 + 0.5}rem` }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggle(row.id)}
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${row.displayId}`}
                className="hover:bg-accent inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded text-xs"
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {isCollapsed && <span data-testid="child-count">{node.childCount}</span>}
              </button>
            ) : (
              <span className="inline-block w-5" aria-hidden />
            )}
            <span className="text-muted-foreground w-16 shrink-0 text-xs">{row.displayId}</span>
            <Link
              href={`/projects/${projectPublicId}/work-items/${row.displayNumber}`}
              className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {row.title}
            </Link>
            {row.isClosed && <span className="text-xs">Closed</span>}
            <span className="text-muted-foreground hidden w-24 truncate text-xs sm:inline">{row.stageName}</span>
            <span className="w-16">{row.priority && <PriorityBadge level={row.priority} />}</span>
            <span className="hidden w-44 md:inline">
              {row.targetDate && <TargetDateChip targetDate={row.targetDate} closedAt={row.closedAt} />}
            </span>
            {/* FR-008 of 011-agent-access-mcp. */}
            <span className="flex w-6 justify-end">
              {row.assignee && <Avatar name={row.assignee.name} image={row.assignee.image} size="sm" />}
            </span>
          </div>
          {hasChildren && !isCollapsed && <ul role="group">{renderNodes(node.children, level + 1)}</ul>}
        </li>
      );
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ViewFilters
        query={query}
        onChange={setQuery}
        options={options}
        shownCount={filtering ? matches.length : rows.length}
        totalCount={rows.length}
      />
      <div className="flex items-center gap-1 px-4 py-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
          Expand all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(new Set(collectParentIds(tree)))}>
          Collapse all
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {waitingForToday ? (
          <p className="text-muted-foreground p-6 text-center text-sm">Loading...</p>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center" data-testid="list-no-results">
            <p className="text-sm">No Work Items match these filters.</p>
            <Button type="button" variant="link" size="sm" onClick={() => setQuery(DEFAULT_VIEW_QUERY)}>
              Clear filters
            </Button>
          </div>
        ) : (
          <ul role="tree" aria-label="Work Items backlog" data-testid="work-items-list">
            {renderNodes(tree, 1)}
          </ul>
        )}
      </div>
    </div>
  );
}

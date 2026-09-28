"use client";

import { Button } from "@/components/ui/button";
import { MultiSelectFilter, assigneeChoices, tagChoices } from "@/components/views/ViewFilters";
import { NONE, type ViewQuery, type WorkItemViewOptions } from "@/lib/work-item-view";

// 014-board-filters-mcp-catalogs FR-001..FR-006: the board's two filters,
// with the same multi-select panels, choices and rules as List/Table
// (components/views/ViewFilters.tsx). It only reports a new query; the board
// writes it to the address.
export function BoardFilters({
  query,
  onChange,
  members,
  tagCatalog,
}: {
  query: ViewQuery;
  onChange: (next: ViewQuery) => void;
  members: WorkItemViewOptions["members"];
  tagCatalog: WorkItemViewOptions["tags"];
}) {
  const assigneeOptions = assigneeChoices(members);
  const tagOptions = tagChoices(tagCatalog);
  // A value the address carries but nobody/no tag matches any more still
  // shows, with its raw text, so it can be removed (FR-011).
  const labelOf = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value.toLowerCase() === value.toLowerCase())?.label ?? value;

  const activeFilters = [
    ...query.assignees.map((value) => ({
      key: `assignee-${value}`,
      label: `Assignee: ${labelOf(assigneeOptions, value)}`,
      remove: () => onChange({ ...query, assignees: query.assignees.filter((v) => v !== value) }),
    })),
    ...query.tags.map((value) => ({
      key: `tag-${value}`,
      label: `Tag: ${value.toLowerCase() === NONE ? "None" : value}`,
      remove: () => onChange({ ...query, tags: query.tags.filter((v) => v !== value) }),
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2" data-testid="board-filters">
      <MultiSelectFilter
        label="Assignee"
        choices={assigneeOptions}
        selected={query.assignees}
        onChange={(assignees) => onChange({ ...query, assignees })}
      />
      <MultiSelectFilter
        label="Tags"
        choices={tagOptions}
        selected={query.tags}
        onChange={(tags) => onChange({ ...query, tags })}
      />
      {activeFilters.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={filter.remove}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Remove ${filter.label} filter`}
              >
                {filter.label}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...query, assignees: [], tags: [] })}
          >
            Clear filters
          </Button>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEVEL_LABELS, WORK_ITEM_LEVELS } from "@/lib/work-item-fields";
import {
  DEFAULT_VIEW_QUERY,
  NONE,
  hasActiveFilters,
  type ViewQuery,
  type WorkItemViewOptions,
} from "@/lib/work-item-view";
import { cn } from "@/lib/utils";

type Choice = { value: string; label: string };

// One multi-value filter (FR-007): a button that opens a small panel of
// checkboxes. Values inside it combine with OR; Escape or a click outside
// closes it and returns focus to its button.
function MultiSelectFilter({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: Choice[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const isSelected = (value: string) => selected.some((s) => s.toLowerCase() === value.toLowerCase());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(value: string) {
    onChange(isSelected(value) ? selected.filter((s) => s.toLowerCase() !== value.toLowerCase()) : [...selected, value]);
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(selected.length > 0 && "border-primary")}
      >
        {label}
        {selected.length > 0 && <span className="text-muted-foreground">({selected.length})</span>}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </Button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} filter`}
          className="absolute z-20 mt-1 max-h-64 min-w-44 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {choices.length === 0 && <p className="text-muted-foreground px-2 py-1 text-xs">No values yet.</p>}
          {choices.map((choice) => (
            <label
              key={choice.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <input type="checkbox" checked={isSelected(choice.value)} onChange={() => toggle(choice.value)} />
              {choice.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const withNone = (choices: Choice[]): Choice[] => [...choices, { value: NONE, label: "None" }];
const levelChoices = withNone(WORK_ITEM_LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] })));
const nameChoices = (names: string[]) => withNone(names.map((n) => ({ value: n, label: n })));

// FR-007/FR-008 of 009-work-item-views: the filter bar shared by the List and
// the Table. It only reports a new query; the caller writes it to the address.
export function ViewFilters({
  query,
  onChange,
  options,
  shownCount,
  totalCount,
}: {
  query: ViewQuery;
  onChange: (next: ViewQuery) => void;
  options: WorkItemViewOptions;
  shownCount: number;
  totalCount: number;
}) {
  const set = (patch: Partial<ViewQuery>) => onChange({ ...query, ...patch });
  // The search box keeps its own text so typing isn't reset by URL round trips.
  const [search, setSearch] = useState(query.q);
  const [prevQ, setPrevQ] = useState(query.q);
  if (query.q !== prevQ) {
    setPrevQ(query.q);
    setSearch(query.q);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2" data-testid="view-filters">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" aria-hidden />
        <Input
          aria-label="Search Work Items"
          placeholder="Search title or ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            set({ q: e.target.value.trim() });
          }}
          className="h-8 w-48 pl-7 text-sm"
        />
      </div>
      <select
        aria-label="Status"
        value={query.status ?? ""}
        onChange={(e) => set({ status: (e.target.value || null) as ViewQuery["status"] })}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>
      <MultiSelectFilter
        label="Column"
        choices={options.stages.map((s) => ({ value: s.publicId, label: s.name }))}
        selected={query.stages}
        onChange={(stages) => set({ stages })}
      />
      <MultiSelectFilter
        label="Priority"
        choices={levelChoices}
        selected={query.priorities}
        onChange={(v) => set({ priorities: v as ViewQuery["priorities"] })}
      />
      <MultiSelectFilter
        label="Severity"
        choices={levelChoices}
        selected={query.severities}
        onChange={(v) => set({ severities: v as ViewQuery["severities"] })}
      />
      <MultiSelectFilter label="Area" choices={nameChoices(options.areas)} selected={query.areas} onChange={(areas) => set({ areas })} />
      <MultiSelectFilter
        label="Iteration"
        choices={nameChoices(options.iterations)}
        selected={query.iterations}
        onChange={(iterations) => set({ iterations })}
      />
      <MultiSelectFilter label="Tag" choices={nameChoices(options.tags)} selected={query.tags} onChange={(tags) => set({ tags })} />
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={query.overdue} onChange={(e) => set({ overdue: e.target.checked })} />
        Overdue only
      </label>
      <span className="text-muted-foreground ml-auto text-xs" data-testid="view-count">
        {shownCount} of {totalCount}
      </span>
      {hasActiveFilters(query) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_VIEW_QUERY, sort: query.sort, dir: query.dir })}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

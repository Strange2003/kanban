/**
 * View models and rules for the List and Table views of 009-work-item-views
 * (data-model.md, research.md). Deliberately pure — no `db`, `next/*` or
 * `lib/auth` imports — so the client sorts, filters and builds the tree in
 * memory without a server round trip per click (Principle I), and the rules
 * that could silently go wrong (empties last, level order, stable ties, the
 * tree) are unit-tested table by table.
 */
import { WORK_ITEM_LEVELS, isOverdue, type WorkItemLevel } from "./work-item-fields";

/** One Work Item flattened for display (data-model.md § Fila de vista). */
export type WorkItemViewRow = {
  id: number;
  displayNumber: number;
  displayId: string;
  title: string;
  parentId: number | null;
  stagePublicId: string;
  stageName: string;
  stagePosition: number;
  // Closed ⇔ its column is a closing column (FR-012 of 008) — derived, not stored.
  isClosed: boolean;
  priority: WorkItemLevel | null;
  severity: WorkItemLevel | null;
  areaName: string | null;
  iterationName: string | null;
  tags: string[];
  stakeholder: string | null;
  startDate: string | null;
  targetDate: string | null;
  createdAt: Date;
  closedAt: Date | null;
};

/** Filter choices: the project's columns and its FULL catalogs (Edge Cases). */
export type WorkItemViewOptions = {
  stages: { publicId: string; name: string; isClosing: boolean }[];
  areas: string[];
  iterations: string[];
  tags: string[];
};

export const SORT_KEYS = [
  "id",
  "title",
  "stage",
  "status",
  "priority",
  "severity",
  "area",
  "iteration",
  "stakeholder",
  "startDate",
  "targetDate",
  "createdAt",
  "closedAt",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

/** A level filter value: a level, or "none" for an empty field. */
export type LevelFilter = WorkItemLevel | "none";

/** Filters + sort, kept in the page's address (FR-009) — never stored. */
export type ViewQuery = {
  status: "open" | "closed" | null;
  stages: string[];
  priorities: LevelFilter[];
  severities: LevelFilter[];
  // Names; "none" matches an empty field.
  areas: string[];
  iterations: string[];
  tags: string[];
  overdue: boolean;
  q: string;
  sort: SortKey;
  dir: SortDir;
};

export type WorkItemTreeNode = {
  row: WorkItemViewRow;
  children: WorkItemTreeNode[];
  // Only shown as an ancestor of a matching Work Item — rendered dimmed (FR-015).
  isContext: boolean;
  // Direct children in the whole project, even those a filter hides (FR-014).
  childCount: number;
};

export const NONE = "none";

export const DEFAULT_VIEW_QUERY: ViewQuery = {
  status: null,
  stages: [],
  priorities: [],
  severities: [],
  areas: [],
  iterations: [],
  tags: [],
  overdue: false,
  q: "",
  sort: "id",
  dir: "asc",
};

const LEVEL_VALUES: readonly string[] = [...WORK_ITEM_LEVELS, NONE];

// Multi-value filters use a repeated parameter (`tag=a&tag=b`), not a comma
// list: names are free text and may contain commas.
function list(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of params.getAll(key)) {
    const value = raw.trim();
    // Names dedupe case-insensitively, like the catalogs themselves.
    const k = value.toLowerCase();
    if (value && !seen.has(k)) {
      seen.add(k);
      out.push(value);
    }
  }
  return out;
}

/**
 * Parses the address into a ViewQuery. Anything invalid — an unknown status,
 * sort key, direction, level or column — is dropped silently and the rest
 * still applies (Edge Cases). Area/iteration/tag names aren't checked against
 * the catalog: an unknown name simply matches nothing.
 */
export function parseViewQuery(params: URLSearchParams, validStagePublicIds: ReadonlySet<string>): ViewQuery {
  const status = params.get("status");
  const sort = params.get("sort");
  const dir = params.get("dir");
  return {
    status: status === "open" || status === "closed" ? status : null,
    // Column ids are case-sensitive nanoids, so dedupe them exactly.
    stages: [...new Set(params.getAll("stage"))].filter((id) => validStagePublicIds.has(id)),
    priorities: list(params, "priority").filter((v) => LEVEL_VALUES.includes(v)) as LevelFilter[],
    severities: list(params, "severity").filter((v) => LEVEL_VALUES.includes(v)) as LevelFilter[],
    areas: list(params, "area"),
    iterations: list(params, "iteration"),
    tags: list(params, "tag"),
    overdue: params.get("overdue") === "1",
    q: (params.get("q") ?? "").trim(),
    sort: (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : DEFAULT_VIEW_QUERY.sort,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_VIEW_QUERY.dir,
  };
}

/**
 * The inverse of parseViewQuery, without the leading "?". Default values are
 * omitted so an unfiltered view has a clean address; the List has no sort, so
 * `sort`/`dir` are left out there.
 */
export function serializeViewQuery(query: ViewQuery, view: "list" | "table"): string {
  const params = new URLSearchParams();
  const appendAll = (key: string, values: string[]) => values.forEach((v) => params.append(key, v));
  if (query.status) params.set("status", query.status);
  appendAll("stage", query.stages);
  appendAll("priority", query.priorities);
  appendAll("severity", query.severities);
  appendAll("area", query.areas);
  appendAll("iteration", query.iterations);
  appendAll("tag", query.tags);
  if (query.overdue) params.set("overdue", "1");
  if (query.q) params.set("q", query.q);
  if (view === "table") {
    if (query.sort !== DEFAULT_VIEW_QUERY.sort) params.set("sort", query.sort);
    if (query.dir !== DEFAULT_VIEW_QUERY.dir) params.set("dir", query.dir);
  }
  return params.toString();
}

/** Any filter differs from its default (sort/dir don't count). */
export function hasActiveFilters(query: ViewQuery): boolean {
  return (
    query.status !== null ||
    query.stages.length > 0 ||
    query.priorities.length > 0 ||
    query.severities.length > 0 ||
    query.areas.length > 0 ||
    query.iterations.length > 0 ||
    query.tags.length > 0 ||
    query.overdue ||
    query.q !== ""
  );
}

// Values in one filter combine with OR; "none" matches an empty field.
function matchesName(selected: string[], value: string | null): boolean {
  if (selected.length === 0) return true;
  return selected.some((s) =>
    s.toLowerCase() === NONE ? value === null : value !== null && s.toLowerCase() === value.toLowerCase(),
  );
}

function matchesLevel(selected: LevelFilter[], value: WorkItemLevel | null): boolean {
  if (selected.length === 0) return true;
  return selected.some((s) => (s === NONE ? value === null : s === value));
}

/**
 * FR-007: filters combine with AND; values inside one filter with OR. With the
 * overdue filter on and `today` still unknown (server render / hydration),
 * nothing can be judged yet, so the result is empty and the UI shows a
 * loading state (research.md § "Vencido").
 */
export function filterWorkItems(rows: WorkItemViewRow[], query: ViewQuery, today: string | null): WorkItemViewRow[] {
  if (query.overdue && today === null) return [];
  const q = query.q.toLowerCase();
  const tagNone = query.tags.some((t) => t.toLowerCase() === NONE);
  const tagNames = query.tags.filter((t) => t.toLowerCase() !== NONE).map((t) => t.toLowerCase());

  return rows.filter((row) => {
    if (query.status === "open" && row.isClosed) return false;
    if (query.status === "closed" && !row.isClosed) return false;
    if (query.stages.length && !query.stages.includes(row.stagePublicId)) return false;
    if (!matchesLevel(query.priorities, row.priority)) return false;
    if (!matchesLevel(query.severities, row.severity)) return false;
    if (!matchesName(query.areas, row.areaName)) return false;
    if (!matchesName(query.iterations, row.iterationName)) return false;
    if (query.tags.length) {
      const rowTags = row.tags.map((t) => t.toLowerCase());
      const ok = (tagNone && rowTags.length === 0) || tagNames.some((t) => rowTags.includes(t));
      if (!ok) return false;
    }
    if (query.overdue && !isOverdue(row.targetDate, row.closedAt, today!)) return false;
    if (q && !row.title.toLowerCase().includes(q) && !row.displayId.toLowerCase().includes(q)) return false;
    return true;
  });
}

const levelRank = (level: WorkItemLevel | null) => (level === null ? null : WORK_ITEM_LEVELS.indexOf(level));
const time = (d: Date | null) => (d === null ? null : new Date(d).getTime());

// The value a row is sorted by; `null` means empty (always sorted last).
function sortValue(row: WorkItemViewRow, key: SortKey): string | number | null {
  switch (key) {
    case "id":
      return row.displayNumber;
    case "title":
      return row.title;
    case "stage":
      return row.stagePosition;
    case "status":
      return row.isClosed ? 1 : 0;
    case "priority":
      return levelRank(row.priority);
    case "severity":
      return levelRank(row.severity);
    case "area":
      return row.areaName;
    case "iteration":
      return row.iterationName;
    case "stakeholder":
      return row.stakeholder || null;
    case "startDate":
      return row.startDate;
    case "targetDate":
      return row.targetDate;
    case "createdAt":
      return time(row.createdAt);
    case "closedAt":
      return time(row.closedAt);
  }
}

const TEXT_KEYS: ReadonlySet<SortKey> = new Set(["title", "area", "iteration", "stakeholder"]);

/**
 * FR-006: priority/severity by level (Critical first in asc), the board
 * column by its position, empties ALWAYS last in both directions, and ties
 * broken by Work Item number ascending so the order is predictable (Edge
 * Cases). Returns a new array.
 */
export function sortWorkItems(rows: WorkItemViewRow[], sort: SortKey, dir: SortDir): WorkItemViewRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const cmp =
        TEXT_KEYS.has(sort) && typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb, undefined, { sensitivity: "base" })
          : va < vb
            ? -1
            : va > vb
              ? 1
              : 0;
      if (cmp !== 0) return cmp * sign;
    }
    return a.displayNumber - b.displayNumber;
  });
}

/**
 * The List's backlog tree (FR-012, FR-015). Roots are Work Items with no
 * parent — or, defensively, whose parent isn't in `rows`. Siblings go by
 * number. With `matchingIds`, only those Work Items plus all their ancestors
 * are kept, the ancestors flagged `isContext`. Every Work Item appears at most
 * once (SC-006); a visited set cuts any cycle 005 should have prevented.
 */
export function buildWorkItemTree(
  rows: WorkItemViewRow[],
  matchingIds: ReadonlySet<number> | null,
): WorkItemTreeNode[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenOf = new Map<number | null, WorkItemViewRow[]>();
  for (const row of rows) {
    const parentKey = row.parentId !== null && byId.has(row.parentId) ? row.parentId : null;
    const siblings = childrenOf.get(parentKey) ?? [];
    siblings.push(row);
    childrenOf.set(parentKey, siblings);
  }
  for (const siblings of childrenOf.values()) siblings.sort((a, b) => a.displayNumber - b.displayNumber);

  // Which Work Items to show: all, or the matches plus their ancestors.
  let visible: Set<number> | null = null;
  if (matchingIds) {
    visible = new Set();
    for (const id of matchingIds) {
      let current = byId.get(id);
      const seen = new Set<number>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        visible.add(current.id);
        current = current.parentId !== null ? byId.get(current.parentId) : undefined;
      }
    }
  }

  const placed = new Set<number>();
  const node = (row: WorkItemViewRow): WorkItemTreeNode => {
    placed.add(row.id);
    return {
      row,
      children: build(row.id),
      isContext: matchingIds !== null && !matchingIds.has(row.id),
      childCount: childrenOf.get(row.id)?.length ?? 0,
    };
  };
  function build(parentKey: number | null): WorkItemTreeNode[] {
    const nodes: WorkItemTreeNode[] = [];
    for (const row of childrenOf.get(parentKey) ?? []) {
      if (placed.has(row.id) || (visible && !visible.has(row.id))) continue;
      nodes.push(node(row));
    }
    return nodes;
  }

  const roots = build(null);
  // A cycle has no root to hang from; surface its members as roots so every
  // Work Item still appears exactly once.
  for (const row of [...rows].sort((a, b) => a.displayNumber - b.displayNumber)) {
    if (!placed.has(row.id) && (!visible || visible.has(row.id))) roots.push(node(row));
  }
  return roots;
}

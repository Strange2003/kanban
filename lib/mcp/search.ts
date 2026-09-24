import type { WorkItemViewRow } from "@/lib/work-item-view";

/**
 * search_work_items (FR-026 of 011-agent-access-mcp): text, assignee, column
 * and state filters combined with AND, then paginated so a large project is
 * never silently truncated. Pure, so the rules are unit-tested.
 */

export const DEFAULT_SEARCH_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 500;

export type SearchRow = WorkItemViewRow & { description: string | null };

export type SearchQuery = {
  text?: string;
  // memberId, "unassigned" or "me".
  assigneeIds?: string[];
  columnIds?: string[];
  state?: "open" | "closed";
  limit?: number;
  offset?: number;
};

export type SearchPage = { total: number; nextOffset: number | null; items: SearchRow[] };

export function searchRows(rows: SearchRow[], query: SearchQuery, currentUserId: string): SearchPage {
  const text = query.text?.trim().toLowerCase() ?? "";
  const assignees = query.assigneeIds ?? [];
  const columns = query.columnIds ?? [];

  const matches = rows.filter((row) => {
    if (query.state === "open" && row.isClosed) return false;
    if (query.state === "closed" && !row.isClosed) return false;
    if (columns.length > 0 && !columns.includes(row.stagePublicId)) return false;
    if (assignees.length > 0) {
      const userId = row.assignee?.userId ?? null;
      const ok = assignees.some((a) =>
        a === "unassigned" ? userId === null : a === "me" ? userId === currentUserId : userId === a,
      );
      if (!ok) return false;
    }
    if (
      text &&
      !row.title.toLowerCase().includes(text) &&
      !(row.description ?? "").toLowerCase().includes(text) &&
      row.displayId.toLowerCase() !== text
    ) {
      return false;
    }
    return true;
  });

  const limit = Math.min(Math.max(1, Math.floor(query.limit ?? DEFAULT_SEARCH_LIMIT)), MAX_SEARCH_LIMIT);
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const items = matches.slice(offset, offset + limit);
  const next = offset + items.length;
  return { total: matches.length, nextOffset: next < matches.length ? next : null, items };
}

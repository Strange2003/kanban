import { describe, expect, it } from "vitest";
import { MAX_SEARCH_LIMIT, searchRows, type SearchRow } from "@/lib/mcp/search";

// search_work_items (FR-026 of 011-agent-access-mcp): filters combine with AND,
// and pagination never silently truncates.
function row(n: number, over: Partial<SearchRow> = {}): SearchRow {
  return {
    id: n,
    displayNumber: n,
    displayId: `KAN-${n}`,
    title: `Item ${n}`,
    description: null,
    parentId: null,
    stagePublicId: "todo",
    stageName: "To Do",
    stagePosition: 0,
    isClosed: false,
    priority: null,
    severity: null,
    areaName: null,
    iterationName: null,
    tags: [],
    assignee: null,
    startDate: null,
    targetDate: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    closedAt: null,
    ...over,
  };
}
const ana = { userId: "u-ana", name: "Ana", image: null };
const ids = (page: { items: SearchRow[] }) => page.items.map((r) => r.displayId);

const rows = [
  row(1, { title: "Login page", assignee: ana }),
  row(2, { description: "Fix the LOGIN redirect", stagePublicId: "done", isClosed: true }),
  row(3, { title: "Signup", assignee: ana, stagePublicId: "done", isClosed: true }),
  row(4, { title: "Reports" }),
];

describe("searchRows", () => {
  it("matches text in the title or the description, case-insensitively, or an exact ID", () => {
    expect(ids(searchRows(rows, { text: "login" }, "u-me"))).toEqual(["KAN-1", "KAN-2"]);
    expect(ids(searchRows(rows, { text: "kan-4" }, "u-me"))).toEqual(["KAN-4"]);
  });

  it("filters by assignee: a member, 'unassigned' and 'me'", () => {
    expect(ids(searchRows(rows, { assigneeIds: ["u-ana"] }, "u-me"))).toEqual(["KAN-1", "KAN-3"]);
    expect(ids(searchRows(rows, { assigneeIds: ["unassigned"] }, "u-me"))).toEqual(["KAN-2", "KAN-4"]);
    expect(ids(searchRows(rows, { assigneeIds: ["me"] }, "u-ana"))).toEqual(["KAN-1", "KAN-3"]);
  });

  it("filters by column and by state, combining every filter with AND", () => {
    expect(ids(searchRows(rows, { columnIds: ["done"] }, "u-me"))).toEqual(["KAN-2", "KAN-3"]);
    expect(ids(searchRows(rows, { state: "open" }, "u-me"))).toEqual(["KAN-1", "KAN-4"]);
    expect(ids(searchRows(rows, { state: "closed", assigneeIds: ["u-ana"] }, "u-me"))).toEqual(["KAN-3"]);
  });

  it("paginates with total and nextOffset, and caps the page size", () => {
    const many = Array.from({ length: 7 }, (_, i) => row(i + 1));
    expect(searchRows(many, { limit: 3 }, "u")).toMatchObject({ total: 7, nextOffset: 3 });
    expect(ids(searchRows(many, { limit: 3, offset: 6 }, "u"))).toEqual(["KAN-7"]);
    expect(searchRows(many, { limit: 3, offset: 6 }, "u").nextOffset).toBeNull();

    const huge = Array.from({ length: MAX_SEARCH_LIMIT + 5 }, (_, i) => row(i + 1));
    const page = searchRows(huge, { limit: 10_000 }, "u");
    expect(page.items).toHaveLength(MAX_SEARCH_LIMIT);
    expect(page.nextOffset).toBe(MAX_SEARCH_LIMIT);
  });

  it("defaults to 100 per page", () => {
    const many = Array.from({ length: 150 }, (_, i) => row(i + 1));
    expect(searchRows(many, {}, "u")).toMatchObject({ total: 150, nextOffset: 100 });
  });
});

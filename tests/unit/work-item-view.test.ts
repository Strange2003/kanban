import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_QUERY,
  buildWorkItemTree,
  filterWorkItems,
  hasActiveFilters,
  parseViewQuery,
  serializeViewQuery,
  sortWorkItems,
  type ViewQuery,
  type WorkItemTreeNode,
  type WorkItemViewRow,
} from "@/lib/work-item-view";

// 009-work-item-views: the pure rules behind the List and Table views
// (research.md § Reglas de orden y de filtro, § El árbol de la Lista).

let nextId = 1;
function row(over: Partial<WorkItemViewRow> = {}): WorkItemViewRow {
  const n = over.displayNumber ?? nextId++;
  return {
    id: over.id ?? n,
    displayNumber: n,
    displayId: `KAN-${n}`,
    title: `Item ${n}`,
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
    stakeholder: null,
    startDate: null,
    targetDate: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    closedAt: null,
    ...over,
  };
}
const q = (over: Partial<ViewQuery> = {}): ViewQuery => ({ ...DEFAULT_VIEW_QUERY, ...over });
const numbers = (rows: WorkItemViewRow[]) => rows.map((r) => r.displayNumber);
const STAGES = new Set(["todo", "doing", "done"]);

describe("parseViewQuery / serializeViewQuery (FR-009)", () => {
  it("round-trips a full query", () => {
    const query = q({
      status: "open",
      stages: ["doing", "done"],
      priorities: ["critical", "none"],
      severities: ["low"],
      areas: ["Frontend"],
      iterations: ["Sprint 12"],
      tags: ["a, b", "none"],
      overdue: true,
      q: "login",
      sort: "priority",
      dir: "desc",
    });
    const serialized = serializeViewQuery(query, "table");
    expect(parseViewQuery(new URLSearchParams(serialized), STAGES)).toEqual(query);
  });

  it("omits every default, so an unfiltered view has a clean address", () => {
    expect(serializeViewQuery(DEFAULT_VIEW_QUERY, "table")).toBe("");
    expect(parseViewQuery(new URLSearchParams(""), STAGES)).toEqual(DEFAULT_VIEW_QUERY);
  });

  it("drops invalid values silently and keeps the rest (Edge Cases)", () => {
    const parsed = parseViewQuery(
      new URLSearchParams("sort=bogus&dir=up&status=maybe&priority=urgent&priority=high&stage=unknown&stage=doing"),
      STAGES,
    );
    expect(parsed).toEqual(q({ priorities: ["high"], stages: ["doing"] }));
  });

  it("dedupes repeated values (names case-insensitively) and trims the search", () => {
    const parsed = parseViewQuery(
      new URLSearchParams("tag=UI&tag=ui&priority=low&priority=low&stage=done&stage=done&q=%20%20hi%20"),
      STAGES,
    );
    expect(parsed.tags).toEqual(["UI"]);
    expect(parsed.priorities).toEqual(["low"]);
    expect(parsed.stages).toEqual(["done"]);
    expect(parsed.q).toBe("hi");
  });

  it("keeps names with commas and spaces intact (repeated params, not comma lists)", () => {
    const serialized = serializeViewQuery(q({ areas: ["Billing, EU", "Front end"] }), "table");
    expect(parseViewQuery(new URLSearchParams(serialized), STAGES).areas).toEqual(["Billing, EU", "Front end"]);
  });

  it("leaves sort/dir out of the List's address", () => {
    expect(serializeViewQuery(q({ sort: "title", dir: "desc", q: "x" }), "list")).toBe("q=x");
  });

  it("hasActiveFilters ignores sort and dir", () => {
    expect(hasActiveFilters(q({ sort: "title", dir: "desc" }))).toBe(false);
    expect(hasActiveFilters(q({ overdue: true }))).toBe(true);
    expect(hasActiveFilters(q({ q: "x" }))).toBe(true);
  });
});

describe("filterWorkItems (FR-007, FR-010)", () => {
  const today = "2026-09-22";
  const rows = [
    row({ displayNumber: 1, priority: "critical", iterationName: "Sprint 12", tags: ["ui"], stagePublicId: "todo" }),
    row({ displayNumber: 2, priority: "high", iterationName: "Sprint 12", isClosed: true, stagePublicId: "done" }),
    row({ displayNumber: 3, priority: null, areaName: "Frontend", targetDate: "2026-09-21" }),
    row({ displayNumber: 4, priority: "critical", iterationName: "Sprint 13", title: "Fix login" }),
    row({ displayNumber: 5, targetDate: "2026-09-21", isClosed: true, closedAt: new Date("2026-09-22T10:00:00Z") }),
  ];

  it("returns everything with no filters", () => {
    expect(numbers(filterWorkItems(rows, q(), today))).toEqual([1, 2, 3, 4, 5]);
  });

  it("filters by status", () => {
    expect(numbers(filterWorkItems(rows, q({ status: "open" }), today))).toEqual([1, 3, 4]);
    expect(numbers(filterWorkItems(rows, q({ status: "closed" }), today))).toEqual([2, 5]);
  });

  it("combines different filters with AND", () => {
    const result = filterWorkItems(rows, q({ status: "open", priorities: ["critical"], iterations: ["sprint 12"] }), today);
    expect(numbers(result)).toEqual([1]);
  });

  it("combines values of one filter with OR, including 'none'", () => {
    expect(numbers(filterWorkItems(rows, q({ priorities: ["high", "none"] }), today))).toEqual([2, 3, 5]);
    expect(numbers(filterWorkItems(rows, q({ areas: ["none"] }), today))).toEqual([1, 2, 4, 5]);
  });

  it("matches tags by name, and 'none' as having no tag at all", () => {
    expect(numbers(filterWorkItems(rows, q({ tags: ["UI"] }), today))).toEqual([1]);
    expect(numbers(filterWorkItems(rows, q({ tags: ["none"] }), today))).toEqual([2, 3, 4, 5]);
  });

  it("filters by column publicId", () => {
    expect(numbers(filterWorkItems(rows, q({ stages: ["done"] }), today))).toEqual([2]);
  });

  it("searches title and display id case-insensitively", () => {
    expect(numbers(filterWorkItems(rows, q({ q: "LOGIN" }), today))).toEqual([4]);
    expect(numbers(filterWorkItems(rows, q({ q: "kan-3" }), today))).toEqual([3]);
  });

  it("keeps only open Work Items with a past target date as overdue", () => {
    expect(numbers(filterWorkItems(rows, q({ overdue: true }), today))).toEqual([3]);
  });

  it("returns nothing for overdue while today is unknown (server render)", () => {
    expect(filterWorkItems(rows, q({ overdue: true }), null)).toEqual([]);
  });

  it("an unknown catalog name just matches nothing", () => {
    expect(filterWorkItems(rows, q({ areas: ["Gone"] }), today)).toEqual([]);
  });
});

describe("sortWorkItems (FR-006)", () => {
  const rows = [
    row({ displayNumber: 1, priority: "low", stagePosition: 2, stageName: "A", title: "banana" }),
    row({ displayNumber: 2, priority: null, stagePosition: 0, stageName: "Z", title: "Apple" }),
    row({ displayNumber: 3, priority: "critical", stagePosition: 1, stageName: "M", title: "cherry" }),
    row({ displayNumber: 4, priority: "critical", stagePosition: 0, stageName: "Z", title: "apple" }),
    row({ displayNumber: 5, priority: null, stagePosition: 1, stageName: "M", title: "date" }),
  ];

  it("orders priority by level, not alphabetically, with empties last", () => {
    expect(numbers(sortWorkItems(rows, "priority", "asc"))).toEqual([3, 4, 1, 2, 5]);
  });

  it("keeps empties last when descending too", () => {
    expect(numbers(sortWorkItems(rows, "priority", "desc"))).toEqual([1, 3, 4, 2, 5]);
  });

  it("orders the board column by its position, not its name", () => {
    expect(numbers(sortWorkItems(rows, "stage", "asc"))).toEqual([2, 4, 3, 5, 1]);
  });

  it("breaks ties by Work Item number ascending, in both directions", () => {
    // 2 and 4 tie on "apple" (case-insensitive): 2 before 4 either way.
    expect(numbers(sortWorkItems(rows, "title", "asc"))).toEqual([2, 4, 1, 3, 5]);
    expect(numbers(sortWorkItems(rows, "title", "desc"))).toEqual([5, 3, 1, 2, 4]);
  });

  it("sorts calendar dates and instants", () => {
    const dated = [
      row({ displayNumber: 1, targetDate: "2026-10-02", closedAt: new Date("2026-09-03T00:00:00Z") }),
      row({ displayNumber: 2, targetDate: null, closedAt: null }),
      row({ displayNumber: 3, targetDate: "2026-09-30", closedAt: new Date("2026-09-01T00:00:00Z") }),
    ];
    expect(numbers(sortWorkItems(dated, "targetDate", "asc"))).toEqual([3, 1, 2]);
    expect(numbers(sortWorkItems(dated, "closedAt", "desc"))).toEqual([1, 3, 2]);
  });

  it("puts open before closed for status ascending", () => {
    const mixed = [row({ displayNumber: 1, isClosed: true }), row({ displayNumber: 2 })];
    expect(numbers(sortWorkItems(mixed, "status", "asc"))).toEqual([2, 1]);
  });

  it("does not mutate its input", () => {
    const before = numbers(rows);
    sortWorkItems(rows, "priority", "desc");
    expect(numbers(rows)).toEqual(before);
  });
});

describe("buildWorkItemTree (FR-012, FR-015, SC-006)", () => {
  // Epic(1) → Child A(3) → Grandchild(5); Epic(1) → Child B(2); Loose(4).
  const epic = row({ id: 1, displayNumber: 1, title: "Epic" });
  const childB = row({ id: 2, displayNumber: 2, title: "Child B", parentId: 1 });
  const childA = row({ id: 3, displayNumber: 3, title: "Child A", parentId: 1 });
  const loose = row({ id: 4, displayNumber: 4, title: "Loose" });
  const grandchild = row({ id: 5, displayNumber: 5, title: "Grandchild", parentId: 3 });
  const rows = [grandchild, loose, childA, childB, epic];

  const shape = (nodes: WorkItemTreeNode[]): unknown =>
    nodes.map((n) => [n.row.title, n.isContext, n.childCount, shape(n.children)]);

  function flatten(nodes: WorkItemTreeNode[]): number[] {
    return nodes.flatMap((n) => [n.row.id, ...flatten(n.children)]);
  }

  it("nests children under their parent at any depth, siblings by number", () => {
    expect(shape(buildWorkItemTree(rows, null))).toEqual([
      ["Epic", false, 2, [["Child B", false, 0, []], ["Child A", false, 1, [["Grandchild", false, 0, []]]]]],
      ["Loose", false, 0, []],
    ]);
  });

  it("makes an orphan whose parent isn't in the project a root", () => {
    const orphan = row({ id: 9, displayNumber: 9, parentId: 999 });
    expect(buildWorkItemTree([orphan], null).map((n) => n.row.id)).toEqual([9]);
  });

  it("with a filter, shows the matches plus their ancestors as dimmed context", () => {
    expect(shape(buildWorkItemTree(rows, new Set([5])))).toEqual([
      ["Epic", true, 2, [["Child A", true, 1, [["Grandchild", false, 0, []]]]]],
    ]);
  });

  it("keeps childCount at the real number of children when a filter hides some", () => {
    const [epicNode] = buildWorkItemTree(rows, new Set([5]));
    expect(epicNode?.children).toHaveLength(1);
    expect(epicNode?.childCount).toBe(2);
  });

  it("survives a cycle and still shows each Work Item exactly once", () => {
    const a = row({ id: 1, displayNumber: 1, parentId: 2 });
    const b = row({ id: 2, displayNumber: 2, parentId: 1 });
    expect(flatten(buildWorkItemTree([a, b], null)).sort()).toEqual([1, 2]);
  });

  it("places 500 chained Work Items exactly once each", () => {
    const chain = Array.from({ length: 500 }, (_, i) =>
      row({ id: i + 1, displayNumber: i + 1, parentId: i === 0 ? null : i }),
    );
    const ids = flatten(buildWorkItemTree(chain, null));
    expect(ids).toHaveLength(500);
    expect(new Set(ids).size).toBe(500);
  });
});

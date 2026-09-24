import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, writes, mockGetSession } = vi.hoisted(() => ({
  state: {
    role: "viewer" as "owner" | "member" | "viewer" | null,
    entryAuthor: "actor",
    selectedTables: [] as string[],
  },
  writes: [] as { op: string; table: string; values?: unknown }[],
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");
  const tableName = (table: Parameters<typeof getTableName>[0]) => getTableName(table);
  const workItem = { id: 1, projectId: 2, displayNumber: 3, title: "Design", estimateMinutes: null };
  const project = { id: 2, publicId: "project-2", workItemPrefix: "DES" };
  const entry = { publicId: "time-1", workItemId: 1, authorUserId: "actor", authorName: "Alex", minutes: 90, note: "Planning", createdAt: new Date() };

  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    chain.from = (source: Parameters<typeof getTableName>[0]) => {
      table = tableName(source);
      state.selectedTables.push(table);
      return chain;
    };
    for (const method of ["where", "limit", "orderBy", "leftJoin", "innerJoin"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const rows: Record<string, unknown[]> = {
        work_items: [workItem],
        projects: [project],
        project_members: state.role ? [{ projectId: 2, userId: "actor", role: state.role }] : [],
        user: [{ id: "actor", name: "Alex", image: null }],
        work_item_comments: [],
        work_item_time_entries: [{ ...entry, authorUserId: state.entryAuthor }],
      };
      return Promise.resolve(rows[table] ?? []).then(resolve, reject);
    };
    return chain;
  }

  function write(op: string, source: Parameters<typeof getTableName>[0]) {
    const table = tableName(source);
    const record: { op: string; table: string; values?: unknown } = { op, table };
    writes.push(record);
    const chain: Record<string, unknown> = {};
    chain.values = (values: unknown) => { record.values = values; return chain; };
    chain.where = () => chain;
    chain.returning = () => {
      if (op === "delete") return Promise.resolve([{ ...entry, authorUserId: state.entryAuthor }]);
      if (table === "work_item_comments") return Promise.resolve([{ ...record.values as object, createdAt: new Date() }]);
      if (table === "work_item_time_entries") return Promise.resolve([{ ...record.values as object, createdAt: new Date() }]);
      return Promise.resolve([]);
    };
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve([]).then(resolve, reject);
    return chain;
  }

  const db: Record<string, unknown> = {
    select,
    insert: (table: Parameters<typeof getTableName>[0]) => write("insert", table),
    delete: (table: Parameters<typeof getTableName>[0]) => write("delete", table),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db };
});

import {
  addWorkItemComment,
  addWorkItemTimeEntry,
  getWorkItemDiscussionData,
  removeWorkItemTimeEntry,
} from "@/lib/actions/work-item-discussion";
import { formatMinutes, hoursToMinutes } from "@/lib/work-item-time";

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ user: { id: "actor" } });
  state.role = "viewer";
  state.entryAuthor = "actor";
  state.selectedTables = [];
  writes.length = 0;
});

describe("work item discussion", () => {
  it("rejects a non-member before reading comments or time", async () => {
    state.role = null;
    expect(await getWorkItemDiscussionData(1)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(state.selectedTables).not.toContain("work_item_comments");
    expect(state.selectedTables).not.toContain("work_item_time_entries");
  });

  it("lets a Viewer post a trimmed comment and audits the operation", async () => {
    const result = await addWorkItemComment({ workItemId: 1, body: "  Hello team  " });
    expect(result).toMatchObject({ ok: true, data: { body: "Hello team", authorName: "Alex" } });
    expect(writes.map((write) => write.table)).toEqual(["work_item_comments", "work_item_activity"]);
  });

  it("rejects empty comments and time entries before any write", async () => {
    expect(await addWorkItemComment({ workItemId: 1, body: "  " })).toMatchObject({ ok: false, error: { code: "INVALID_COMMENT" } });
    expect(await addWorkItemTimeEntry({ workItemId: 1, minutes: 0 })).toMatchObject({ ok: false, error: { code: "INVALID_TIME_ENTRY" } });
    expect(writes).toEqual([]);
  });

  it("rejects a Viewer's time entry", async () => {
    expect(await addWorkItemTimeEntry({ workItemId: 1, minutes: 30 })).toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
    expect(writes).toEqual([]);
  });

  it("logs time for an editor and allows that editor to remove only their own entry", async () => {
    state.role = "member";
    expect(await addWorkItemTimeEntry({ workItemId: 1, minutes: 90, note: "Planning" })).toMatchObject({ ok: true, data: { minutes: 90, note: "Planning" } });
    expect(writes.map((write) => write.table)).toEqual(["work_item_time_entries", "work_item_activity"]);
    writes.length = 0;
    expect(await removeWorkItemTimeEntry("time-1")).toMatchObject({ ok: true, data: { minutes: 90 } });
    expect(writes.map((write) => write.table)).toEqual(["work_item_time_entries", "work_item_activity"]);

    writes.length = 0;
    state.entryAuthor = "another-member";
    expect(await removeWorkItemTimeEntry("time-1")).toMatchObject({ ok: false, error: { code: "NOT_AUTHOR" } });
    expect(writes).toEqual([]);
  });
});

describe("time formatting", () => {
  it("converts decimal hours to whole minutes and derives a readable total", () => {
    expect(hoursToMinutes("1.5")).toBe(90);
    expect(hoursToMinutes("0.5")).toBe(30);
    expect(formatMinutes(90 + 30)).toBe("2h");
    expect(formatMinutes(30)).toBe("30m");
  });

  it("rejects negative, empty and excessive durations", () => {
    for (const value of ["", "-1", "0", "10001", "oops"]) expect(hoursToMinutes(value)).toBeNull();
    expect(hoursToMinutes("0", true)).toBe(0);
  });
});

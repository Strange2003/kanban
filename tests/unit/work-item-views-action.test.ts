import { beforeEach, describe, expect, it, vi } from "vitest";

// getWorkItemsView (009-work-item-views, FR-004/FR-017/SC-004). Same
// table-aware fake as tests/unit/board.test.ts: `select` answers by table name.
const { mockGetSession, fake } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  fake: {
    rows: {} as Record<string, unknown[]>,
    returning: {} as Record<string, unknown[][]>,
    writes: [] as { op: string; table: string; values?: unknown }[],
    selects: [] as string[],
  },
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");
  type Table = Parameters<typeof getTableName>[0];

  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "innerJoin", "leftJoin", "groupBy", "for"]) chain[m] = () => chain;
    chain.from = (t: Table) => ((table = getTableName(t)), fake.selects.push(table), chain);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(fake.rows[table] ?? []).then(res, rej);
    return chain;
  }

  function write(op: string, t: Table) {
    const table = getTableName(t);
    const entry: (typeof fake.writes)[number] = { op, table };
    fake.writes.push(entry);
    const result = () => Promise.resolve(fake.returning[table]?.shift() ?? []);
    const chain: Record<string, unknown> = {
      values: (v: unknown) => ((entry.values = v), chain),
      set: (v: unknown) => ((entry.values = v), chain),
      where: () => chain,
      returning: result,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => result().then(res, rej),
    };
    return chain;
  }

  const db = {
    select,
    insert: (t: Table) => write("insert", t),
    update: (t: Table) => write("update", t),
    delete: (t: Table) => write("delete", t),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});

import { getWorkItemsView } from "@/lib/actions/work-item-views";

const P = "proj-1";

beforeEach(() => {
  mockGetSession.mockResolvedValue({ user: { id: "u1" } });
  fake.selects = [];
  fake.writes = [];
  fake.rows = {
    projects: [{ id: 1, publicId: P, workItemPrefix: "KAN" }],
    project_members: [{ projectId: 1, userId: "u1", role: "viewer" }],
    work_items: [
      {
        item: {
          id: 10,
          displayNumber: 3,
          title: "Fix login",
          parentWorkItemId: null,
          priority: "high",
          severity: null,
          assigneeUserId: null,
          startDate: null,
          targetDate: "2026-10-01",
          createdAt: new Date("2026-09-01T00:00:00Z"),
          closedAt: new Date("2026-09-20T00:00:00Z"),
        },
        stagePublicId: "stage-done",
        stageName: "Done",
        stagePosition: 2,
        isClosed: true,
        areaName: "Frontend",
        iterationName: null,
      },
    ],
    work_item_tags: [
      { workItemId: 10, name: "ux" },
      { workItemId: 10, name: "auth" },
    ],
    stages: [{ publicId: "stage-done", name: "Done", isClosing: true }],
    areas: [{ name: "Frontend" }],
    iterations: [],
    tags: [{ name: "auth" }, { name: "ux" }],
  };
});

describe("getWorkItemsView", () => {
  it("rejects a signed-out caller before reading any Work Item", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(getWorkItemsView(P)).resolves.toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(fake.selects).not.toContain("work_items");
  });

  it("rejects a non-member with FORBIDDEN before reading any Work Item", async () => {
    fake.rows.project_members = [];

    await expect(getWorkItemsView(P)).resolves.toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(fake.selects).not.toContain("work_items");
  });

  it("gives any member — a Viewer here — flattened rows, filter options and the role", async () => {
    const result = await getWorkItemsView(P);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.role).toBe("viewer");
    expect(result.data.totalCount).toBe(1);
    expect(result.data.rows[0]).toMatchObject({
      id: 10,
      displayId: "KAN-3",
      stagePublicId: "stage-done",
      stageName: "Done",
      isClosed: true,
      areaName: "Frontend",
      iterationName: null,
      tags: ["auth", "ux"],
      assignee: null,
    });
    expect(result.data.options).toEqual({
      stages: [{ publicId: "stage-done", name: "Done", isClosing: true }],
      areas: ["Frontend"],
      iterations: [],
      tags: ["auth", "ux"],
      // The fake answers every project_members read with the same rows.
      members: fake.rows.project_members,
    });
    // 011-agent-access-mcp FR-008: resolves the "Assigned to me" filter.
    expect(result.data.currentUserId).toBe("u1");
    expect(fake.writes).toEqual([]);
  });
});

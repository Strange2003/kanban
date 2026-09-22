import { beforeEach, describe, expect, it, vi } from "vitest";

// setStageClosing (FR-011/FR-013 of 008-work-item-fields). Same table-aware
// fake as tests/unit/work-items.test.ts: `select` answers by table name and
// every write is recorded instead of executed.
const { mockGetSession, fake } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  fake: {
    rows: {} as Record<string, unknown[]>,
    returning: {} as Record<string, unknown[][]>,
    writes: [] as { op: string; table: string; values?: unknown }[],
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
    chain.from = (t: Table) => ((table = getTableName(t)), chain);
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

import { setStageClosing } from "@/lib/actions/board";

const P = "proj-1";
const doneStage = { id: 2, publicId: "stage-2", projectId: 1, name: "Done", position: 1, isClosing: false };

beforeEach(() => {
  mockGetSession.mockResolvedValue({ user: { id: "u1" } });
  fake.rows = {
    projects: [{ id: 1, publicId: P, workItemPrefix: "KAN" }],
    project_members: [{ projectId: 1, userId: "u1", role: "member" }],
    stages: [doneStage],
  };
  fake.returning = {};
  fake.writes = [];
});

describe("setStageClosing", () => {
  it("is idempotent: re-sending the current value writes and logs nothing", async () => {
    await expect(setStageClosing({ projectPublicId: P, stagePublicId: "stage-2", isClosing: false })).resolves.toMatchObject({
      ok: true,
    });
    expect(fake.writes).toEqual([]);
  });

  it("returns NOT_FOUND for a column that isn't in the project", async () => {
    fake.rows.stages = [];

    await expect(setStageClosing({ projectPublicId: P, stagePublicId: "other", isClosing: true })).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(fake.writes).toEqual([]);
  });

  it("marking closes every Work Item in the column and logs one `closed` event each, in one insert", async () => {
    fake.returning.work_items = [[{ id: 10 }, { id: 11 }]];

    await setStageClosing({ projectPublicId: P, stagePublicId: "stage-2", isClosing: true });

    expect(fake.writes.find((w) => w.table === "stages")?.values).toEqual({ isClosing: true });
    const closedAt = (fake.writes.find((w) => w.table === "work_items")?.values as { closedAt: Date }).closedAt;
    expect(closedAt).toBeInstanceOf(Date);
    const inserts = fake.writes.filter((w) => w.table === "work_item_activity");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values).toEqual([
      { workItemId: 10, type: "closed", payload: { closedAt: closedAt.toISOString(), stageName: "Done", via: "stage_marked" } },
      { workItemId: 11, type: "closed", payload: { closedAt: closedAt.toISOString(), stageName: "Done", via: "stage_marked" } },
    ]);
  });

  it("unmarking reopens every Work Item in the column", async () => {
    fake.rows.stages = [{ ...doneStage, isClosing: true }];
    fake.returning.work_items = [[{ id: 10 }]];

    await setStageClosing({ projectPublicId: P, stagePublicId: "stage-2", isClosing: false });

    expect(fake.writes.find((w) => w.table === "work_items")?.values).toMatchObject({ closedAt: null });
    expect(fake.writes.find((w) => w.table === "work_item_activity")?.values).toEqual([
      { workItemId: 10, type: "reopened", payload: { stageName: "Done", via: "stage_unmarked" } },
    ]);
  });
});

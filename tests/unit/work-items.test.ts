import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking pattern as tests/unit/permissions.test.ts — `db.select()` is a
// queue of chainable results (`.from().where().limit()`), since
// `requireProjectMember` (called first) and the work item lookup itself both
// go through this exact shape.
const { mockGetSession, mockSelect, fake } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
  // Table-aware fake for the 008-work-item-fields blocks below: `select` answers
  // by table name (a per-table queue first, then a default row list), and every
  // write is recorded instead of executed. Blocks that use it install it with
  // `useFakeDb()` in their beforeEach; the older blocks keep the plain queue.
  fake: {
    rows: {} as Record<string, unknown[]>,
    queue: {} as Record<string, unknown[][]>,
    returning: {} as Record<string, unknown[][]>,
    writes: [] as { op: "insert" | "update" | "delete"; table: string; values?: unknown }[],
  },
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");
  const nameOf = (t: Parameters<typeof getTableName>[0]) => getTableName(t);

  function write(op: "insert" | "update" | "delete", table: string) {
    const entry: (typeof fake.writes)[number] = { op, table };
    fake.writes.push(entry);
    const result = () => Promise.resolve(fake.returning[table]?.shift() ?? []);
    const chain: Record<string, unknown> = {
      values: (v: unknown) => ((entry.values = v), chain),
      set: (v: unknown) => ((entry.values = v), chain),
      where: () => chain,
      onConflictDoNothing: () => chain,
      returning: result,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => result().then(res, rej),
    };
    return chain;
  }

  const db = {
    select: mockSelect,
    insert: (t: Parameters<typeof getTableName>[0]) => write("insert", nameOf(t)),
    update: (t: Parameters<typeof getTableName>[0]) => write("update", nameOf(t)),
    delete: (t: Parameters<typeof getTableName>[0]) => write("delete", nameOf(t)),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});

async function fakeSelect() {
  const { getTableName } = await import("drizzle-orm");
  return () => {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "innerJoin", "leftJoin", "groupBy", "for"]) chain[m] = () => chain;
    chain.from = (t: Parameters<typeof getTableName>[0]) => ((table = getTableName(t)), chain);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(fake.queue[table]?.length ? fake.queue[table]!.shift() : (fake.rows[table] ?? [])).then(res, rej);
    return chain;
  };
}

async function useFakeDb(rows: Record<string, unknown[]>) {
  fake.rows = rows;
  fake.queue = {};
  fake.returning = {};
  fake.writes = [];
  mockGetSession.mockResolvedValue({ user: { id: "u1" } });
  mockSelect.mockImplementation(await fakeSelect());
}

const PROJECT = { id: 1, publicId: "proj-1", workItemPrefix: "KAN" };
const MEMBER = { projectId: 1, userId: "u1", role: "member" };
const baseWorkItem = {
  id: 10,
  projectId: 1,
  stageId: 1,
  displayNumber: 3,
  title: "T",
  description: null,
  stakeholder: null,
  position: 0,
  parentWorkItemId: null,
  priority: null,
  severity: null,
  areaId: null,
  iterationId: null,
  startDate: null,
  targetDate: null,
  closedAt: null,
};
const stage = (over: Partial<{ id: number; projectId: number; name: string; isClosing: boolean }> = {}) => ({
  id: 1,
  publicId: "stage-1",
  projectId: 1,
  name: "To Do",
  position: 0,
  isClosing: false,
  ...over,
});
const writesTo = (table: string) => fake.writes.filter((w) => w.table === table);

import { closeWorkItem, getWorkItemByDisplayNumber, moveWorkItem, updateWorkItem } from "@/lib/actions/work-items";

function chain(result: unknown[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(result) }) }) };
}

// FR-001/FR-010/FR-011 of 006-work-item-detail-view.
describe("getWorkItemByDisplayNumber", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSelect.mockReset();
  });

  it("returns NOT_FOUND when no Work Item has that display number in the project", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect
      .mockReturnValueOnce(chain([{ id: 1, publicId: "proj-1", workItemPrefix: "KAN" }])) // project lookup
      .mockReturnValueOnce(chain([{ projectId: 1, userId: "u1", role: "member" }])) // membership lookup
      .mockReturnValueOnce(chain([])); // work item lookup

    await expect(getWorkItemByDisplayNumber("proj-1", 999)).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns the Work Item with its computed displayId when found", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect
      .mockReturnValueOnce(chain([{ id: 1, publicId: "proj-1", workItemPrefix: "KAN" }]))
      .mockReturnValueOnce(chain([{ projectId: 1, userId: "u1", role: "member" }]))
      .mockReturnValueOnce(chain([{ id: 10, projectId: 1, displayNumber: 42, title: "Design login" }]));

    await expect(getWorkItemByDisplayNumber("proj-1", 42)).resolves.toMatchObject({
      ok: true,
      data: { displayId: "KAN-42", title: "Design login" },
    });
  });

  it("checks membership before ever looking up the Work Item (Principle IV)", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(getWorkItemByDisplayNumber("proj-1", 42)).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    // Only the membership check should have run — no query for the work item itself.
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

// Principle IV fix found while designing 008-work-item-fields (research.md § Hallazgo).
describe("moveWorkItem", () => {
  beforeEach(() => mockSelect.mockReset());

  it("rejects a destination column from another project with NOT_FOUND and writes nothing", async () => {
    await useFakeDb({
      work_items: [baseWorkItem],
      projects: [PROJECT],
      project_members: [MEMBER],
      stages: [stage({ id: 99, projectId: 2 })],
    });

    await expect(moveWorkItem({ workItemId: 10, toStageId: 99, toPosition: 0 })).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(fake.writes).toEqual([]);
  });
});

// 008-work-item-fields: the extended fields go through updateWorkItem and are
// audited in the same `fields_edited` event (FR-020).
describe("updateWorkItem — extended fields", () => {
  beforeEach(async () => {
    mockSelect.mockReset();
    await useFakeDb({ work_items: [baseWorkItem], projects: [PROJECT], project_members: [MEMBER] });
    fake.returning.work_items = [[baseWorkItem]];
  });

  const activityFields = () =>
    (writesTo("work_item_activity")[0]?.values as { payload: { fields: Record<string, unknown> } } | undefined)
      ?.payload.fields;

  it("rejects a priority outside the fixed scale with VALIDATION_ERROR and writes nothing (FR-002)", async () => {
    // @ts-expect-error — an invalid level, as a direct request could send
    const result = await updateWorkItem({ workItemId: 10, priority: "urgent" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(fake.writes).toEqual([]);
  });

  it("logs priority and severity with their previous and new values", async () => {
    const result = await updateWorkItem({ workItemId: 10, priority: "high", severity: "medium" });

    expect(result.ok).toBe(true);
    expect(writesTo("work_items")[0]?.values).toMatchObject({ priority: "high", severity: "medium" });
    expect(activityFields()).toEqual({
      priority: { from: null, to: "high" },
      severity: { from: null, to: "medium" },
    });
  });

  it("clears a priority with null", async () => {
    fake.rows.work_items = [{ ...baseWorkItem, priority: "critical" }];

    await updateWorkItem({ workItemId: 10, priority: null });

    expect(writesTo("work_items")[0]?.values).toMatchObject({ priority: null });
    expect(activityFields()).toEqual({ priority: { from: "critical", to: null } });
  });

  it("writes nothing when the value sent is the one already stored", async () => {
    fake.rows.work_items = [{ ...baseWorkItem, priority: "low" }];

    await updateWorkItem({ workItemId: 10, priority: "low" });

    expect(fake.writes).toEqual([]);
  });

  it("rejects a target date before the stored start date with INVALID_DATE_RANGE (FR-009)", async () => {
    fake.rows.work_items = [{ ...baseWorkItem, startDate: "2026-10-10" }];

    const result = await updateWorkItem({ workItemId: 10, targetDate: "2026-10-01" });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DATE_RANGE" } });
    expect(fake.writes).toEqual([]);
  });

  it("rejects moving only the start date past the stored target date", async () => {
    fake.rows.work_items = [{ ...baseWorkItem, targetDate: "2026-10-01" }];

    const result = await updateWorkItem({ workItemId: 10, startDate: "2026-10-05" });

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_DATE_RANGE" } });
  });

  it("accepts a target date with no start date and logs it as a calendar string", async () => {
    const result = await updateWorkItem({ workItemId: 10, targetDate: "2026-10-15" });

    expect(result.ok).toBe(true);
    expect(activityFields()).toEqual({ targetDate: { from: null, to: "2026-10-15" } });
  });

  it("rejects an impossible calendar date with VALIDATION_ERROR", async () => {
    const result = await updateWorkItem({ workItemId: 10, targetDate: "2026-13-40" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("does not accept closedAt as an input (FR-013)", async () => {
    // @ts-expect-error — not part of the contract
    await updateWorkItem({ workItemId: 10, closedAt: new Date() });

    expect(fake.writes).toEqual([]);
  });

  it("reuses an existing area case-insensitively instead of creating a duplicate (FR-006)", async () => {
    fake.queue.areas = [[{ id: 7, name: "Frontend" }]]; // the lower(name) lookup inside the transaction

    await updateWorkItem({ workItemId: 10, areaName: "FRONTEND" });

    expect(writesTo("areas")).toEqual([]);
    expect(writesTo("work_items")[0]?.values).toMatchObject({ areaId: 7 });
    // Logged by name, in the catalog's own spelling (data-model.md § Log de actividad).
    expect(activityFields()).toEqual({ area: { from: null, to: "Frontend" } });
  });

  it("creates a missing iteration in the Work Item's own project (FR-021)", async () => {
    fake.returning.iterations = [[{ id: 3, name: "Sprint 1" }]];

    await updateWorkItem({ workItemId: 10, iterationName: " Sprint 1 " });

    expect(writesTo("iterations")[0]?.values).toEqual({ projectId: 1, name: "Sprint 1" });
    expect(writesTo("work_items")[0]?.values).toMatchObject({ iterationId: 3 });
  });

  it("treats a blank area name as clearing the area", async () => {
    fake.rows.work_items = [{ ...baseWorkItem, areaId: 7 }];
    fake.rows.areas = [{ name: "Frontend" }];

    await updateWorkItem({ workItemId: 10, areaName: "   " });

    expect(writesTo("areas")).toEqual([]);
    expect(writesTo("work_items")[0]?.values).toMatchObject({ areaId: null });
    expect(activityFields()).toEqual({ area: { from: "Frontend", to: null } });
  });
});

// FR-014 of 008-work-item-fields.
describe("closeWorkItem", () => {
  beforeEach(async () => {
    mockSelect.mockReset();
    await useFakeDb({ work_items: [baseWorkItem], projects: [PROJECT], project_members: [MEMBER] });
  });

  it("returns NO_CLOSING_STAGE when the project has no closing column", async () => {
    fake.queue.stages = [[]]; // the "first closing column" lookup

    await expect(closeWorkItem(10)).resolves.toMatchObject({ ok: false, error: { code: "NO_CLOSING_STAGE" } });
    expect(fake.writes).toEqual([]);
  });

  it("returns ALREADY_CLOSED when the Work Item's column is already a closing one", async () => {
    fake.queue.stages = [[stage({ id: 2, name: "Done", isClosing: true })], [stage({ id: 1, isClosing: true })]];

    await expect(closeWorkItem(10)).resolves.toMatchObject({ ok: false, error: { code: "ALREADY_CLOSED" } });
    expect(fake.writes).toEqual([]);
  });

  it("moves an open Work Item to the end of the first closing column, closed, and logs it", async () => {
    fake.queue.stages = [[stage({ id: 2, name: "Done", isClosing: true })], [stage({ id: 1 })]];
    fake.queue.work_items = [[baseWorkItem], [{ maxPosition: 4 }]];

    await expect(closeWorkItem(10)).resolves.toMatchObject({ ok: true });

    const moved = writesTo("work_items").at(-1)?.values as { stageId: number; position: number; closedAt: Date };
    expect(moved).toMatchObject({ stageId: 2, position: 5 });
    expect(moved.closedAt).toBeInstanceOf(Date);
    const events = writesTo("work_item_activity").map((w) => (w.values as { type: string }).type);
    expect(events).toEqual(["stage_changed", "closed"]);
    expect(writesTo("work_item_activity")[1]?.values).toMatchObject({
      payload: { stageName: "Done", via: "close_button" },
    });
  });
});

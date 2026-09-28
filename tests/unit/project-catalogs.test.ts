import { beforeEach, describe, expect, it, vi } from "vitest";

// 013-project-catalogs. Same table-aware fake as tests/unit/work-items.test.ts:
// `select` answers by table name (a per-table queue first, then default rows),
// and every write is recorded instead of executed.
const { mockGetSession, fake } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
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
  type Table = Parameters<typeof getTableName>[0];

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

  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "innerJoin", "leftJoin", "groupBy", "for"]) chain[m] = () => chain;
    chain.from = (t: Table) => ((table = getTableName(t)), chain);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(fake.queue[table]?.length ? fake.queue[table]!.shift() : (fake.rows[table] ?? [])).then(res, rej);
    return chain;
  }

  const db = {
    select,
    insert: (t: Table) => write("insert", getTableName(t)),
    update: (t: Table) => write("update", getTableName(t)),
    delete: (t: Table) => write("delete", getTableName(t)),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});

import {
  createCatalogValue,
  deleteCatalogValue,
  renameCatalogValue,
  reorderCatalog,
  setTagColor,
} from "@/lib/actions/project-catalogs";

const P = "proj-1";
const writesTo = (table: string) => fake.writes.filter((w) => w.table === table);
const activity = () =>
  writesTo("work_item_activity").flatMap((w) => (Array.isArray(w.values) ? w.values : [w.values])) as {
    workItemId: number;
    type: string;
    payload: { fields: Record<string, { from: unknown; to: unknown }>; reason?: string };
  }[];

beforeEach(() => {
  fake.rows = {
    projects: [{ id: 1, publicId: P, name: "P", workItemPrefix: "KAN" }],
    project_members: [{ projectId: 1, userId: "u1", role: "member" }],
  };
  fake.queue = {};
  fake.returning = {};
  fake.writes = [];
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("createCatalogValue", () => {
  it("reuses an existing value case-insensitively without writing (FR-013)", async () => {
    fake.queue.areas = [[{ id: 4, name: "Backend" }]];

    const result = await createCatalogValue({ projectPublicId: P, kind: "area", name: "BACKEND" });

    expect(result).toEqual({ ok: true, data: { name: "Backend", created: false, color: undefined } });
    expect(fake.writes).toEqual([]);
  });

  it("creates a new tag with the chosen color at the end of the catalog (FR-003a, FR-014)", async () => {
    fake.queue.tags = [[], [], [{ color: "green" }]]; // exists? → resolve's lookup → color read-back
    fake.returning.tags = [[{ id: 9, name: "Mobile" }]];

    const result = await createCatalogValue({ projectPublicId: P, kind: "tag", name: " Mobile ", color: "green" });

    expect(result).toEqual({ ok: true, data: { name: "Mobile", created: true, color: "green" } });
    expect(writesTo("tags")[0]?.values).toMatchObject({ projectId: 1, name: "Mobile", color: "green" });
    expect(writesTo("tags")[0]?.values).toHaveProperty("position");
  });

  it("rejects a color for areas and sizes", async () => {
    const result = await createCatalogValue({ projectPublicId: P, kind: "size", name: "M", color: "blue" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("rejects a name longer than 50 characters", async () => {
    const result = await createCatalogValue({ projectPublicId: P, kind: "area", name: "x".repeat(51) });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(fake.writes).toEqual([]);
  });

  it("rejects a Viewer (FR-007)", async () => {
    fake.rows.project_members = [{ projectId: 1, userId: "u1", role: "viewer" }];
    const result = await createCatalogValue({ projectPublicId: P, kind: "tag", name: "UX" });
    expect(result).toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
  });
});

describe("renameCatalogValue", () => {
  it("rejects a name taken by another value (FR-004)", async () => {
    fake.queue.areas = [[{ id: 1, name: "Front" }], [{ id: 2, name: "Backend" }]];

    const result = await renameCatalogValue({ projectPublicId: P, kind: "area", name: "Front", newName: "backend" });

    expect(result).toMatchObject({ ok: false, error: { code: "CATALOG_NAME_TAKEN" } });
    expect(fake.writes).toEqual([]);
  });

  it("allows changing only the case, without history (FR-005)", async () => {
    fake.queue.tags = [[{ id: 3, name: "backend" }], [{ id: 3, name: "backend" }]];

    const result = await renameCatalogValue({ projectPublicId: P, kind: "tag", name: "backend", newName: "Backend" });

    expect(result.ok).toBe(true);
    expect(writesTo("tags")[0]).toMatchObject({ op: "update", values: { name: "Backend" } });
    expect(writesTo("work_item_activity")).toEqual([]);
  });

  it("returns NOT_FOUND for a name that isn't in this project (FR-020)", async () => {
    const result = await renameCatalogValue({ projectPublicId: P, kind: "size", name: "XL", newName: "XXL" });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("reorderCatalog", () => {
  beforeEach(() => {
    fake.rows.sizes = [
      { id: 1, name: "S" },
      { id: 2, name: "M" },
      { id: 3, name: "XL" },
      { id: 4, name: "L" },
    ];
  });

  it("writes the new positions in order (FR-003a)", async () => {
    const result = await reorderCatalog({ projectPublicId: P, kind: "size", orderedNames: ["S", "M", "L", "XL"] });

    expect(result.ok).toBe(true);
    expect(writesTo("sizes").map((w) => w.values)).toEqual([
      { position: 0 },
      { position: 1 },
      { position: 2 },
      { position: 3 },
    ]);
  });

  it("returns CONFLICT for a stale list and writes nothing", async () => {
    const result = await reorderCatalog({ projectPublicId: P, kind: "size", orderedNames: ["S", "M", "L"] });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(fake.writes).toEqual([]);
  });
});

describe("setTagColor", () => {
  it("rejects a color outside the palette", async () => {
    // @ts-expect-error — not a palette key
    const result = await setTagColor({ projectPublicId: P, name: "UX", color: "#00ff00" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("recolors an existing tag without history", async () => {
    fake.queue.tags = [[{ id: 3, name: "UX" }]];

    const result = await setTagColor({ projectPublicId: P, name: "ux", color: "violet" });

    expect(result.ok).toBe(true);
    expect(writesTo("tags")[0]).toMatchObject({ op: "update", values: { color: "violet" } });
    expect(writesTo("work_item_activity")).toEqual([]);
  });
});

describe("deleteCatalogValue (FR-006)", () => {
  it("clears a size from every Work Item, logs one event each, then deletes it", async () => {
    fake.queue.sizes = [[{ id: 5, name: "XL" }]];
    fake.returning.work_items = [[{ id: 10 }, { id: 11 }]];

    const result = await deleteCatalogValue({ projectPublicId: P, kind: "size", name: "xl" });

    expect(result).toEqual({ ok: true, data: { affectedWorkItems: 2 } });
    expect(writesTo("work_items")[0]?.values).toMatchObject({ sizeId: null });
    expect(activity()).toEqual([
      expect.objectContaining({
        workItemId: 10,
        type: "fields_edited",
        actorUserId: "u1",
        payload: { fields: { size: { from: "XL", to: null } }, reason: "catalog_value_deleted" },
      }),
      expect.objectContaining({ workItemId: 11 }),
    ]);
    // History first, the value last.
    const order = fake.writes.map((w) => `${w.op}:${w.table}`);
    expect(order.indexOf("insert:work_item_activity")).toBeLessThan(order.indexOf("delete:sizes"));
  });

  it("removes a tag from its Work Items and logs the remaining tags", async () => {
    fake.queue.tags = [[{ id: 7, name: "UX" }]];
    fake.queue.work_item_tags = [
      [{ workItemId: 10 }],
      [
        { workItemId: 10, name: "UX" },
        { workItemId: 10, name: "Backend" },
      ],
    ];

    const result = await deleteCatalogValue({ projectPublicId: P, kind: "tag", name: "UX" });

    expect(result).toEqual({ ok: true, data: { affectedWorkItems: 1 } });
    expect(writesTo("work_item_tags")[0]?.op).toBe("delete");
    expect(activity()[0]?.payload).toEqual({
      fields: { tags: { from: ["Backend", "UX"], to: ["Backend"] } },
      reason: "catalog_value_deleted",
    });
    expect(writesTo("tags").at(-1)?.op).toBe("delete");
  });

  it("deletes an unused value without history", async () => {
    fake.queue.areas = [[{ id: 2, name: "Ops" }]];

    const result = await deleteCatalogValue({ projectPublicId: P, kind: "area", name: "Ops" });

    expect(result).toEqual({ ok: true, data: { affectedWorkItems: 0 } });
    expect(writesTo("work_item_activity")).toEqual([]);
    expect(writesTo("areas").at(-1)?.op).toBe("delete");
  });

  it("returns NOT_FOUND for a value of another project", async () => {
    const result = await deleteCatalogValue({ projectPublicId: P, kind: "area", name: "Elsewhere" });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(fake.writes).toEqual([]);
  });
});

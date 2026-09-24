import { beforeEach, describe, expect, it, vi } from "vitest";

// FR-006/FR-013 of 011-agent-access-mcp: when someone leaves or is removed from
// a project, each of their Work Items there gets a "left the project" history
// entry BEFORE the membership row is deleted — the composite FK's
// `ON DELETE SET NULL (assignee_user_id)` then unassigns them. Nobody is notified.
const { mockGetSession, fake } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  fake: {
    queue: {} as Record<string, unknown[][]>,
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
      Promise.resolve(fake.queue[table]?.shift() ?? []).then(res, rej);
    return chain;
  }

  function write(op: string, t: Table) {
    const entry: (typeof fake.writes)[number] = { op, table: getTableName(t) };
    fake.writes.push(entry);
    const chain: Record<string, unknown> = {
      values: (v: unknown) => ((entry.values = v), chain),
      set: (v: unknown) => ((entry.values = v), chain),
      where: () => chain,
      returning: () => Promise.resolve([]),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve([]).then(res, rej),
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

import { leaveProject, removeMember } from "@/lib/actions/projects";

const PROJECT = { id: 1, publicId: "proj-1", name: "P", workItemPrefix: "KAN", ownerId: "owner-1" };

beforeEach(() => {
  fake.writes = [];
});

describe("a member leaving a project", () => {
  it("removeMember logs member_left on each of their Work Items, then deletes the membership", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "owner-1" } });
    fake.queue = {
      projects: [[PROJECT]],
      project_members: [[{ projectId: 1, userId: "owner-1", role: "owner" }], [{ userId: "u2", name: "Beto" }]],
      work_items: [[{ id: 10 }, { id: 11 }]],
    };

    const result = await removeMember({ projectPublicId: "proj-1", userId: "u2" });

    expect(result.ok).toBe(true);
    expect(fake.writes.map((w) => `${w.op}:${w.table}`)).toEqual([
      "insert:work_item_activity",
      "delete:project_members",
    ]);
    expect(fake.writes[0]?.values).toMatchObject([
      { workItemId: 10, type: "assignee_changed", payload: { from: { userId: "u2", name: "Beto" }, to: null, reason: "member_left" } },
      { workItemId: 11, type: "assignee_changed", payload: { reason: "member_left" } },
    ]);
    expect(fake.writes.some((w) => w.table === "notifications")).toBe(false);
  });

  it("leaveProject does the same for the caller, and skips the log when nothing is assigned to them", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u2" } });
    fake.queue = {
      projects: [[PROJECT]],
      project_members: [[{ projectId: 1, userId: "u2", role: "member" }]],
      work_items: [[]],
    };

    const result = await leaveProject("proj-1");

    expect(result.ok).toBe(true);
    expect(fake.writes.map((w) => `${w.op}:${w.table}`)).toEqual(["delete:project_members"]);
  });
});

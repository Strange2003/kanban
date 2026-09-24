import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/mcp/resolve.ts (011-agent-access-mcp § Identificadores): public ids are
// resolved only inside a project the user belongs to.
const { mockGetSession, queue } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  queue: {} as Record<string, unknown[][]>,
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");
  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "innerJoin", "leftJoin"]) chain[m] = () => chain;
    chain.from = (t: Parameters<typeof getTableName>[0]) => ((table = getTableName(t)), chain);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(queue[table]?.shift() ?? []).then(res, rej);
    return chain;
  }
  return { db: { select } };
});

import { parseDisplayId, resolveColumn, resolveWorkItem } from "@/lib/mcp/resolve";

const PROJECT = { id: 1, publicId: "proj-1", workItemPrefix: "KAN" };
const MEMBER = { projectId: 1, userId: "u1", role: "member" };

beforeEach(() => {
  mockGetSession.mockResolvedValue({ user: { id: "u1" } });
  for (const key of Object.keys(queue)) delete queue[key];
});

describe("parseDisplayId", () => {
  it("reads PREFIX-N case-insensitively", () => {
    expect(parseDisplayId("kan-12")).toEqual({ prefix: "KAN", number: 12 });
  });

  it("rejects anything else with VALIDATION_ERROR", () => {
    for (const bad of ["12", "KAN", "KAN-", "KAN-1a", ""]) {
      expect(() => parseDisplayId(bad)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    }
  });
});

describe("resolveWorkItem", () => {
  it("finds the Work Item by number within the caller's project", async () => {
    queue.projects = [[PROJECT]];
    queue.project_members = [[MEMBER]];
    queue.work_items = [[{ id: 10, projectId: 1, displayNumber: 12 }]];

    await expect(resolveWorkItem("proj-1", "KAN-12")).resolves.toMatchObject({ workItem: { id: 10 } });
  });

  it("treats an ID with another project's prefix as not found, without looking it up", async () => {
    queue.projects = [[PROJECT]];
    queue.project_members = [[MEMBER]];
    queue.work_items = [[{ id: 99 }]];

    await expect(resolveWorkItem("proj-1", "OTHER-12")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queue.work_items).toHaveLength(1);
  });

  it("checks membership first: a non-member gets FORBIDDEN before any Work Item lookup", async () => {
    queue.projects = [[PROJECT]];
    queue.project_members = [[]];
    queue.work_items = [[{ id: 10 }]];

    await expect(resolveWorkItem("proj-1", "KAN-12")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(queue.work_items).toHaveLength(1);
  });
});

describe("resolveColumn", () => {
  it("is NOT_FOUND for a column that isn't in this project", async () => {
    queue.projects = [[PROJECT]];
    queue.project_members = [[MEMBER]];
    queue.stages = [[]];

    await expect(resolveColumn("proj-1", "stage-of-another-project")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// 014-board-filters-mcp-catalogs (US4): list_catalogs, set_tag_color and tags
// with a color in create_work_items / update_work_item. The Server Actions are
// stubbed — what's tested is the tool layer: what it passes to the SAME
// actions the UI uses (FR-033 of 011) and what it answers the agent.
const { queue, actions } = vi.hoisted(() => ({
  queue: {} as Record<string, unknown[][]>,
  actions: {
    getProjectCatalogs: vi.fn(),
    setTagColor: vi.fn(),
    createWorkItems: vi.fn(),
    updateWorkItem: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: {}, getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/project-catalogs", () => ({
  getProjectCatalogs: actions.getProjectCatalogs,
  setTagColor: actions.setTagColor,
}));
vi.mock("@/lib/actions/work-items", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createWorkItems: actions.createWorkItems,
  updateWorkItem: actions.updateWorkItem,
}));
vi.mock("@/db/client", async () => {
  const { getTableName } = await import("drizzle-orm");
  type Table = Parameters<typeof getTableName>[0];
  function select() {
    let table = "";
    const chain: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy", "innerJoin", "leftJoin", "groupBy"]) chain[m] = () => chain;
    chain.from = (t: Table) => ((table = getTableName(t)), chain);
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(queue[table]?.shift() ?? []).then(res, rej);
    return chain;
  }
  const insert = () => {
    const chain: Record<string, unknown> = { values: () => chain, onConflictDoUpdate: () => Promise.resolve([]) };
    return chain;
  };
  return { db: { select, insert } };
});

import { createMcpRoute } from "@/lib/mcp/route-handler";
import { resetRateLimits } from "@/lib/mcp/rate-limit";

const claims = { sub: "u1", azp: "client-1" };
const verify = (request: Request, onVerified: (r: Request, c: Record<string, unknown>) => Promise<Response>) =>
  onVerified(request, claims);
const PROJECT = { id: 1, publicId: "p1", workItemPrefix: "KAN" };

async function call(name: string, args: Record<string, unknown>) {
  // The consent checks of the route (see mcp-route.test.ts), then the tool.
  queue.oauth_consent = [[{ id: "c1" }]];
  queue.user = [[{ id: "u1" }]];
  queue.oauth_client = [[{ name: "Claude" }]];
  const response = await createMcpRoute({ verify })(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  const text = await response.text();
  const line = text.split("\n").find((l) => l.startsWith("data: ")) ?? text;
  return JSON.parse(line.replace(/^data: /, "")).result;
}

// requireProjectMember: the project, then the caller's membership.
function asMember(role: "owner" | "member" | "viewer" = "member", times = 1) {
  queue.projects = Array.from({ length: times }, () => [PROJECT]);
  queue.project_members = Array.from({ length: times }, () => [{ projectId: 1, userId: "u1", role }]);
}

beforeEach(() => {
  for (const key of Object.keys(queue)) delete queue[key];
  resetRateLimits();
  for (const fn of Object.values(actions)) fn.mockReset();
});

describe("list_catalogs (FR-015)", () => {
  it("returns tags with colors, areas and sizes in the catalog's order, plus the palette", async () => {
    actions.getProjectCatalogs.mockResolvedValue({
      ok: true,
      data: {
        role: "viewer",
        projectName: "Kanban",
        tags: [
          { name: "UI", color: "pink", usage: 3 },
          { name: "Bug", color: "red", usage: 0 },
        ],
        areas: [{ name: "Frontend", usage: 1 }],
        sizes: [
          { name: "S", usage: 0 },
          { name: "M", usage: 2 },
        ],
      },
    });

    const result = await call("list_catalogs", { projectId: "p1" });

    expect(actions.getProjectCatalogs).toHaveBeenCalledWith("p1");
    expect(result.structuredContent).toEqual({
      tags: [
        { name: "UI", color: "pink", workItemCount: 3 },
        { name: "Bug", color: "red", workItemCount: 0 },
      ],
      areas: [{ name: "Frontend", workItemCount: 1 }],
      sizes: [
        { name: "S", workItemCount: 0 },
        { name: "M", workItemCount: 2 },
      ],
      colors: ["gray", "red", "orange", "amber", "green", "teal", "blue", "indigo", "violet", "pink"],
    });
  });

  it("hides a project the user doesn't belong to", async () => {
    actions.getProjectCatalogs.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN", message: "No." } });
    const result = await call("list_catalogs", { projectId: "theirs" });
    expect(result.structuredContent).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("set_tag_color (FR-018, FR-019)", () => {
  it("recolors through setTagColor and answers with the catalog's spelling", async () => {
    actions.setTagColor.mockResolvedValue({ ok: true, data: undefined });
    asMember();
    queue.tags = [[{ id: 5, name: "Mobile" }]];

    const result = await call("set_tag_color", { projectId: "p1", tag: "mobile", color: "blue" });

    expect(actions.setTagColor).toHaveBeenCalledWith({ projectPublicId: "p1", name: "mobile", color: "blue" });
    expect(result.structuredContent).toEqual({ name: "Mobile", color: "blue" });
  });

  it.each([
    ["a missing tag", "NOT_FOUND", 'Tag "Nope" no longer exists.'],
    ["a Viewer", "ROLE_NOT_PERMITTED", "Your role doesn't allow this."],
  ])("passes the action's rejection through for %s", async (_label, code, message) => {
    actions.setTagColor.mockResolvedValue({ ok: false, error: { code, message } });
    const result = await call("set_tag_color", { projectId: "p1", tag: "Nope", color: "blue" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code });
  });

  it("rejects a color outside the palette, listing the valid ones", async () => {
    const result = await call("set_tag_color", { projectId: "p1", tag: "UI", color: "purple" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("gray");
    expect(actions.setTagColor).not.toHaveBeenCalled();
  });
});

describe("tags with a color (FR-016, FR-017)", () => {
  it("update_work_item passes names plus the first color per new tag, and answers the stored tags", async () => {
    asMember();
    queue.work_items = [[{ id: 42, projectId: 1, displayNumber: 7 }]];
    queue.work_item_tags = [[
      { workItemId: 42, name: "Bug", color: "red" },
      { workItemId: 42, name: "Mobile", color: "green" },
    ]];
    actions.updateWorkItem.mockResolvedValue({ ok: true, data: { id: 42, displayId: "KAN-7", title: "Fix" } });

    const result = await call("update_work_item", {
      projectId: "p1",
      workItemId: "KAN-7",
      tags: ["Bug", { name: "Mobile", color: "green" }, { name: "mobile", color: "blue" }],
    });

    expect(actions.updateWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: 42,
        tagNames: ["Bug", "Mobile", "mobile"],
        newTagColors: { mobile: "green" },
      }),
    );
    expect(result.structuredContent).toEqual({
      workItemId: "KAN-7",
      title: "Fix",
      tags: [
        { name: "Bug", color: "red" },
        { name: "Mobile", color: "green" },
      ],
    });
  });

  it("plain names behave as before: no colors are sent", async () => {
    asMember();
    queue.work_items = [[{ id: 42, projectId: 1, displayNumber: 7 }]];
    actions.updateWorkItem.mockResolvedValue({ ok: true, data: { id: 42, displayId: "KAN-7", title: "Fix" } });

    await call("update_work_item", { projectId: "p1", workItemId: "KAN-7", tags: ["Bug"] });

    const input = actions.updateWorkItem.mock.calls[0]![0];
    expect(input.tagNames).toEqual(["Bug"]);
    expect(input.newTagColors).toBeUndefined();
  });

  it("create_work_items answers each Work Item's stored tags", async () => {
    asMember();
    queue.stages = [[{ id: 3, publicId: "c1", projectId: 1, name: "To do" }]];
    queue.work_item_tags = [[{ workItemId: 10, name: "Mobile", color: "green" }]];
    actions.createWorkItems.mockResolvedValue({
      ok: true,
      data: [
        { id: 10, displayId: "KAN-10", title: "A" },
        { id: 11, displayId: "KAN-11", title: "B" },
      ],
    });

    const result = await call("create_work_items", {
      projectId: "p1",
      columnId: "c1",
      items: [{ title: "A", tags: [{ name: "Mobile", color: "green" }] }, { title: "B" }],
    });

    expect(actions.createWorkItems.mock.calls[0]![0].items[0]).toMatchObject({
      title: "A",
      tagNames: ["Mobile"],
      newTagColors: { mobile: "green" },
    });
    expect(result.structuredContent).toEqual({
      created: [
        { workItemId: "KAN-10", title: "A", tags: [{ name: "Mobile", color: "green" }] },
        { workItemId: "KAN-11", title: "B", tags: [] },
      ],
    });
  });

  it("rejects an unknown field inside a tag object", async () => {
    const result = await call("update_work_item", {
      projectId: "p1",
      workItemId: "KAN-7",
      tags: [{ name: "Mobile", color: "green", icon: "phone" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("icon");
    expect(actions.updateWorkItem).not.toHaveBeenCalled();
  });
});

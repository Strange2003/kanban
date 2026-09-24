import { beforeEach, describe, expect, it, vi } from "vitest";

// POST /api/mcp (011-agent-access-mcp contracts/mcp-tools.md § Autorización and
// § Herramientas). The JWT check is swapped for a stub; what's tested is what
// this app adds on top: the consent must still exist on EVERY request (so
// revoking is immediate, FR-036), the tools run as the agent's user, and the
// tool list is exactly the contract's — nothing that administers projects (FR-023).
const { queue, mockGetSession } = vi.hoisted(() => ({
  queue: {} as Record<string, unknown[][]>,
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: {}, getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
    const chain: Record<string, unknown> = {
      values: () => chain,
      onConflictDoUpdate: () => Promise.resolve([]),
    };
    return chain;
  };
  return { db: { select, insert } };
});

import { createMcpRoute } from "@/lib/mcp/route-handler";
import { resetRateLimits } from "@/lib/mcp/rate-limit";

const EXPECTED_TOOLS = [
  "create_column",
  "create_work_items",
  "delete_column",
  "delete_work_item",
  "get_board",
  "get_work_item",
  "link_related",
  "list_members",
  "list_projects",
  "move_work_item",
  "rename_column",
  "reorder_columns",
  "search_work_items",
  "set_column_closing",
  "set_parent",
  "update_work_item",
];

const claims = { sub: "u1", azp: "client-1" };
const verifyAs =
  (c: Record<string, unknown>) =>
  (request: Request, onVerified: (r: Request, c: Record<string, unknown>) => Promise<Response>) =>
    onVerified(request, c);

function rpc(method: string, params: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

async function resultOf(response: Response) {
  const text = await response.text();
  const line = text.split("\n").find((l) => l.startsWith("data: ")) ?? text;
  return JSON.parse(line.replace(/^data: /, "")).result;
}

beforeEach(() => {
  for (const key of Object.keys(queue)) delete queue[key];
  resetRateLimits();
  mockGetSession.mockResolvedValue(null);
});

describe("POST /api/mcp", () => {
  it("answers 401 with a WWW-Authenticate challenge when the user's consent was revoked", async () => {
    queue.oauth_consent = [[]];
    queue.user = [[{ id: "u1" }]];
    queue.oauth_client = [[{ name: "Claude" }]];

    const response = await createMcpRoute({ verify: verifyAs(claims) })(rpc("tools/list"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("answers 401 when the account no longer exists", async () => {
    queue.oauth_consent = [[{ id: "c1" }]];
    queue.user = [[]];
    queue.oauth_client = [[{ name: "Claude" }]];

    const response = await createMcpRoute({ verify: verifyAs(claims) })(rpc("tools/list"));

    expect(response.status).toBe(401);
  });

  it("answers 401 for a token without a user or client", async () => {
    const response = await createMcpRoute({ verify: verifyAs({ sub: "u1" }) })(rpc("tools/list"));
    expect(response.status).toBe(401);
  });

  it("lists exactly the contract's tools, none of them administering projects or members", async () => {
    queue.oauth_consent = [[{ id: "c1" }]];
    queue.user = [[{ id: "u1" }]];
    queue.oauth_client = [[{ name: "Claude" }]];

    const response = await createMcpRoute({ verify: verifyAs(claims) })(rpc("tools/list"));

    expect(response.status).toBe(200);
    const { tools } = await resultOf(response);
    const names = tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOLS);
    expect(names.join(" ")).not.toMatch(/invite|role|member_remove|remove_member|transfer|project_(delete|rename)|leave/);

    const annotations = Object.fromEntries(tools.map((t: { name: string; annotations: unknown }) => [t.name, t.annotations]));
    for (const read of ["list_projects", "get_board", "search_work_items", "get_work_item", "list_members"]) {
      expect(annotations[read]).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    }
    for (const destructive of ["delete_work_item", "delete_column"]) {
      expect(annotations[destructive]).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
    expect(annotations.create_work_items).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it("runs tools as the agent's user: list_projects reads that user's memberships", async () => {
    queue.oauth_consent = [[{ id: "c1" }]];
    queue.user = [[{ id: "u1" }]];
    queue.oauth_client = [[{ name: "Claude" }]];
    // listMyProjects, then the roles lookup.
    queue.projects = [[{ project: { id: 1, publicId: "p1", name: "UMG", workItemPrefix: "UMG" }, memberCount: 2 }]];
    queue.project_members = [[{ projectId: 1, role: "member" }]];

    const response = await createMcpRoute({ verify: verifyAs(claims) })(
      rpc("tools/call", { name: "list_projects", arguments: {} }),
    );

    const result = await resultOf(response);
    expect(result.structuredContent).toEqual({
      projects: [{ projectId: "p1", name: "UMG", prefix: "UMG", kind: "shared", role: "member", memberCount: 2 }],
    });
    // The agent never needed a browser session.
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("hides another project behind NOT_FOUND", async () => {
    queue.oauth_consent = [[{ id: "c1" }]];
    queue.user = [[{ id: "u1" }]];
    queue.oauth_client = [[{ name: "Claude" }]];
    queue.projects = [[{ id: 7, publicId: "theirs", workItemPrefix: "OTH" }]];
    queue.project_members = [[]]; // not a member

    const response = await createMcpRoute({ verify: verifyAs(claims) })(
      rpc("tools/call", { name: "get_board", arguments: { projectId: "theirs" } }),
    );

    const result = await resultOf(response);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "NOT_FOUND" });
  });
});

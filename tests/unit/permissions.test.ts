import { beforeEach, describe, expect, it, vi } from "vitest";

// `db.select()` is mocked as a queue of chainable results — permissions.ts
// always calls it as `db.select().from(...).where(...).limit(...)` with no
// select-shape argument, so a single vi.fn() returning `{ from, where,
// limit }` covers both the project and membership lookups per test.
const { mockGetSession, mockSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("@/db/client", () => ({ db: { select: mockSelect } }));

import { requireProjectMember, requireProjectPermission } from "@/lib/permissions";

function chain(result: unknown[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(result) }) }) };
}

describe("requireProjectMember", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSelect.mockReset();
  });

  it("throws UNAUTHENTICATED when there's no session", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireProjectMember("proj-1")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws NOT_FOUND when the project doesn't exist", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect.mockReturnValueOnce(chain([]));

    await expect(requireProjectMember("proj-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when the user isn't a member of an existing project", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect.mockReturnValueOnce(chain([{ id: 1, publicId: "proj-1" }])).mockReturnValueOnce(chain([]));

    await expect(requireProjectMember("proj-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns the actor, project, and membership when the user is a member", async () => {
    const session = { user: { id: "u1" } };
    const project = { id: 1, publicId: "proj-1" };
    const membership = { projectId: 1, userId: "u1", role: "member" };
    mockGetSession.mockResolvedValue(session);
    mockSelect.mockReturnValueOnce(chain([project])).mockReturnValueOnce(chain([membership]));

    await expect(requireProjectMember("proj-1")).resolves.toEqual({ actor: { userId: "u1", agent: null }, project, membership });
  });
});

// FR-003/FR-004 of 007-roles-permissions.
describe("requireProjectPermission", () => {
  const session = { user: { id: "u1" } };
  const project = { id: 1, publicId: "proj-1" };

  beforeEach(() => {
    mockGetSession.mockReset();
    mockSelect.mockReset();
  });

  function asMember(role: string) {
    mockGetSession.mockResolvedValue(session);
    mockSelect.mockReturnValueOnce(chain([project])).mockReturnValueOnce(chain([{ projectId: 1, userId: "u1", role }]));
  }

  it("throws UNAUTHENTICATED when there's no session", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireProjectPermission("proj-1", "workItem:edit")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws NOT_FOUND when the project doesn't exist", async () => {
    mockGetSession.mockResolvedValue(session);
    mockSelect.mockReturnValueOnce(chain([]));

    await expect(requireProjectPermission("proj-1", "workItem:edit")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN — not ROLE_NOT_PERMITTED — for someone who isn't a member", async () => {
    mockGetSession.mockResolvedValue(session);
    mockSelect.mockReturnValueOnce(chain([project])).mockReturnValueOnce(chain([]));

    await expect(requireProjectPermission("proj-1", "workItem:edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws ROLE_NOT_PERMITTED, naming the role, when a viewer attempts an edit", async () => {
    asMember("viewer");

    await expect(requireProjectPermission("proj-1", "workItem:edit")).rejects.toMatchObject({
      code: "ROLE_NOT_PERMITTED",
      message: expect.stringContaining("Viewer"),
    });
  });

  it("throws ROLE_NOT_PERMITTED when a member attempts an owner-only action", async () => {
    asMember("member");

    await expect(requireProjectPermission("proj-1", "member:remove")).rejects.toMatchObject({
      code: "ROLE_NOT_PERMITTED",
    });
  });

  it("returns the actor, project and membership when the role has the permission", async () => {
    asMember("member");

    const result = await requireProjectPermission("proj-1", "board:edit");
    expect(result.actor).toEqual({ userId: session.user.id, agent: null });
    expect(result.project).toBe(project);
    expect(result.membership).toMatchObject({ role: "member" });
  });

  it("lets the owner do owner-only actions", async () => {
    asMember("owner");

    await expect(requireProjectPermission("proj-1", "project:transferOwnership")).resolves.toBeDefined();
  });
});

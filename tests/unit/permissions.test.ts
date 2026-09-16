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

import { requireProjectMember, requireProjectOwner } from "@/lib/permissions";

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

  it("returns the session, project, and membership when the user is a member", async () => {
    const session = { user: { id: "u1" } };
    const project = { id: 1, publicId: "proj-1" };
    const membership = { projectId: 1, userId: "u1", role: "member" };
    mockGetSession.mockResolvedValue(session);
    mockSelect.mockReturnValueOnce(chain([project])).mockReturnValueOnce(chain([membership]));

    await expect(requireProjectMember("proj-1")).resolves.toEqual({ session, project, membership });
  });
});

describe("requireProjectOwner", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSelect.mockReset();
  });

  it("throws FORBIDDEN when the member isn't the owner", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect
      .mockReturnValueOnce(chain([{ id: 1, publicId: "proj-1" }]))
      .mockReturnValueOnce(chain([{ role: "member" }]));

    await expect(requireProjectOwner("proj-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succeeds when the member is the owner", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    mockSelect
      .mockReturnValueOnce(chain([{ id: 1, publicId: "proj-1" }]))
      .mockReturnValueOnce(chain([{ role: "owner" }]));

    await expect(requireProjectOwner("proj-1")).resolves.toBeDefined();
  });
});

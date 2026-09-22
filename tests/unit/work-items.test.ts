import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking pattern as tests/unit/permissions.test.ts — `db.select()` is a
// queue of chainable results (`.from().where().limit()`), since
// `requireProjectMember` (called first) and the work item lookup itself both
// go through this exact shape.
const { mockGetSession, mockSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("@/db/client", () => ({ db: { select: mockSelect } }));

import { getWorkItemByDisplayNumber } from "@/lib/actions/work-items";

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

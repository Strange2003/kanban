import { beforeEach, describe, expect, it, vi } from "vitest";

// Rules of the role-changing actions of 007-roles-permissions, with the
// database mocked. Same idea as tests/unit/permissions.test.ts, but the
// query builders here are generic thenable chains — every method returns the
// chain itself and awaiting it resolves the next queued result — because
// changeMemberRole/transferOwnership run inside `db.transaction` and end their
// chains with different methods (`.limit()`, `.for("update")`, `.returning()`).
//
// The `select` queue is shared by `db.select` and the transaction's
// `tx.select`, in call order: first the two lookups of requireProjectPermission
// (project, membership), then whatever the action reads inside the transaction.
const { mockGetSession, mockSelect, mockUpdate, mockInsert, mockTransaction, state } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockTransaction: vi.fn(),
  state: {
    updateValues: [] as unknown[],
    updateResults: [] as unknown[][],
    insertValues: [] as unknown[],
    insertResults: [] as unknown[][],
  },
}));

vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/client", () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert, transaction: mockTransaction },
}));

import { changeMemberRole, transferOwnership } from "@/lib/actions/projects";
import { sendInvitation, respondToInvitation } from "@/lib/actions/accounts-invitations";

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "for", "set", "values", "returning", "innerJoin", "orderBy"]) {
    c[method] = () => c;
  }
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const OWNER_ID = "owner-1";
const project = { id: 1, publicId: "proj-1", ownerId: OWNER_ID };

/** Queues the two lookups requireProjectPermission makes for the caller. */
function actAs(userId: string, role: "owner" | "member" | "viewer") {
  mockGetSession.mockResolvedValue({ user: { id: userId } });
  mockSelect.mockReturnValueOnce(chain([project])).mockReturnValueOnce(chain([{ projectId: 1, userId, role }]));
}

/** Queues what the action reads inside the transaction, in order. */
function insideTransaction(...results: unknown[][]) {
  for (const result of results) mockSelect.mockReturnValueOnce(chain(result));
}

/** Queues the result of the next `tx.update(...).returning()`. */
function updateReturns(rows: unknown[]) {
  state.updateResults.push(rows);
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockSelect.mockReset();
  mockUpdate.mockReset();
  mockTransaction.mockReset();
  mockInsert.mockReset();
  state.updateValues = [];
  state.updateResults = [];
  state.insertValues = [];
  state.insertResults = [];

  mockInsert.mockImplementation(() => {
    const c = chain(state.insertResults.shift() ?? []);
    c.values = (values: unknown) => {
      state.insertValues.push(values);
      return c;
    };
    return c;
  });
  mockUpdate.mockImplementation(() => {
    const c = chain(state.updateResults.shift() ?? []);
    c.set = (values: unknown) => {
      state.updateValues.push(values);
      return c;
    };
    return c;
  });
  // `tx` is the same mocked builder surface as `db`.
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ select: mockSelect, update: mockUpdate, insert: mockInsert }),
  );
});

// FR-002, FR-006 of 007-roles-permissions.
describe("changeMemberRole", () => {
  const input = { projectPublicId: "proj-1", userId: "member-1", role: "viewer" as const };

  it("rejects `owner` (and any other value) with INVALID_ROLE, before touching anything", async () => {
    actAs(OWNER_ID, "owner");
    await expect(
      changeMemberRole({ ...input, role: "owner" as unknown as "viewer" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ROLE" } });

    actAs(OWNER_ID, "owner");
    await expect(
      changeMemberRole({ ...input, role: "admin" as unknown as "viewer" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ROLE" } });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(state.updateValues).toEqual([]);
  });

  it.each(["member", "viewer"] as const)("rejects a %s with ROLE_NOT_PERMITTED, without a transaction", async (role) => {
    actAs("someone", role);

    await expect(changeMemberRole(input)).resolves.toMatchObject({
      ok: false,
      error: { code: "ROLE_NOT_PERMITTED" },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects with CANNOT_CHANGE_OWNER_ROLE when the target is the owner — including the owner themselves", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }], [{ role: "owner" }]);

    await expect(changeMemberRole({ ...input, userId: OWNER_ID })).resolves.toMatchObject({
      ok: false,
      error: { code: "CANNOT_CHANGE_OWNER_ROLE" },
    });
    expect(state.updateValues).toEqual([]);
  });

  it("rejects with NOT_A_MEMBER when the target isn't in the project", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }], []);

    await expect(changeMemberRole(input)).resolves.toMatchObject({ ok: false, error: { code: "NOT_A_MEMBER" } });
    expect(state.updateValues).toEqual([]);
  });

  it("rejects with ROLE_NOT_PERMITTED when the actor lost ownership by the time the project is locked", async () => {
    actAs(OWNER_ID, "owner");
    // Inside the transaction the actor is already a plain member (a concurrent transfer won).
    insideTransaction([project], [{ role: "member" }]);

    await expect(changeMemberRole(input)).resolves.toMatchObject({
      ok: false,
      error: { code: "ROLE_NOT_PERMITTED" },
    });
    expect(state.updateValues).toEqual([]);
  });

  it("changes the role and writes nothing else on the happy path", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }], [{ role: "member" }]);
    updateReturns([{ userId: "member-1" }]);

    await expect(changeMemberRole(input)).resolves.toEqual({ ok: true, data: undefined });
    expect(state.updateValues).toEqual([{ role: "viewer" }]);
  });

  it("rejects with NOT_A_MEMBER when the conditional UPDATE matches no row (member vanished mid-flight)", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }], [{ role: "member" }]);
    updateReturns([]);

    await expect(changeMemberRole(input)).resolves.toMatchObject({ ok: false, error: { code: "NOT_A_MEMBER" } });
  });

  it("is idempotent: asking for the role someone already has succeeds", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }], [{ role: "viewer" }]);
    updateReturns([{ userId: "member-1" }]);

    await expect(changeMemberRole(input)).resolves.toMatchObject({ ok: true });
  });
});

// FR-002, FR-008, FR-009 of 007-roles-permissions.
describe("sendInvitation", () => {
  const input = { projectPublicId: "proj-1", email: "new@example.com", role: "viewer" as const };

  /** What sendInvitation reads after the permission check: rate-limit count, existing user, existing pending invite. */
  function passesChecks() {
    insideTransaction([{ count: 0 }], [], []);
  }

  it.each(["owner", "admin", undefined])("rejects role %s with INVALID_ROLE and writes nothing", async (role) => {
    actAs(OWNER_ID, "owner");

    await expect(sendInvitation({ ...input, role: role as unknown as "viewer" })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ROLE" },
    });
    expect(state.insertValues).toEqual([]);
  });

  it("rejects a Viewer with ROLE_NOT_PERMITTED — only the Owner and Members invite", async () => {
    actAs("someone", "viewer");

    await expect(sendInvitation(input)).resolves.toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
    expect(state.insertValues).toEqual([]);
  });

  it.each(["owner", "member"] as const)("lets a %s invite, storing the chosen role on the invitation", async (inviter) => {
    actAs("inviter", inviter);
    passesChecks();
    state.insertResults.push([{ id: 1, publicId: "inv-1", role: "viewer" }]);

    await expect(sendInvitation(input)).resolves.toMatchObject({ ok: true });
    expect(state.insertValues).toEqual([
      expect.objectContaining({ invitedEmail: "new@example.com", invitedByUserId: "inviter", role: "viewer" }),
    ]);
  });
});

describe("respondToInvitation", () => {
  const invitation = {
    id: 1,
    publicId: "inv-1",
    projectId: 1,
    invitedEmail: "invitee@example.com",
    status: "pending",
    role: "viewer",
  };

  function asInvitee() {
    mockGetSession.mockResolvedValue({ user: { id: "invitee", email: "invitee@example.com" } });
  }

  it("adds the invitee to the project with the role the invitation carries (FR-008)", async () => {
    asInvitee();
    mockSelect.mockReturnValueOnce(chain([invitation]));

    await expect(respondToInvitation({ invitationId: "inv-1", action: "accept" })).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(state.insertValues).toEqual([{ projectId: 1, userId: "invitee", role: "viewer" }]);
  });

  it("an invitation from before this feature (role defaults to member) still joins as a member (FR-015)", async () => {
    asInvitee();
    mockSelect.mockReturnValueOnce(chain([{ ...invitation, role: "member" }]));

    await respondToInvitation({ invitationId: "inv-1", action: "accept" });

    expect(state.insertValues).toEqual([{ projectId: 1, userId: "invitee", role: "member" }]);
  });

  it("rejecting an invitation adds no membership", async () => {
    asInvitee();
    mockSelect.mockReturnValueOnce(chain([invitation]));

    await respondToInvitation({ invitationId: "inv-1", action: "reject" });

    expect(state.insertValues).toEqual([]);
  });
});

// FR-002, FR-011, FR-012 of 007-roles-permissions.
describe("transferOwnership", () => {
  const input = { projectPublicId: "proj-1", newOwnerUserId: "member-1" };

  it("rejects transferring to yourself with CANNOT_TRANSFER_TO_SELF, before any transaction", async () => {
    actAs(OWNER_ID, "owner");

    await expect(transferOwnership({ ...input, newOwnerUserId: OWNER_ID })).resolves.toMatchObject({
      ok: false,
      error: { code: "CANNOT_TRANSFER_TO_SELF" },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each(["member", "viewer"] as const)("rejects a %s with ROLE_NOT_PERMITTED, without a transaction", async (role) => {
    actAs("someone", role);

    await expect(transferOwnership(input)).resolves.toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects with ROLE_NOT_PERMITTED, writing nothing, when the actor lost ownership by the time the project is locked", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "member" }]);

    await expect(transferOwnership(input)).resolves.toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
    expect(state.updateValues).toEqual([]);
  });

  it("demotes the previous owner BEFORE promoting the recipient, then syncs projects.owner_id", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }]);
    updateReturns([{ userId: OWNER_ID }]); // demotion
    updateReturns([{ userId: "member-1" }]); // promotion
    updateReturns([]); // projects.owner_id

    await expect(transferOwnership(input)).resolves.toEqual({ ok: true, data: undefined });

    // Order matters: project_members_one_owner_idx allows a single owner row at a time.
    expect(state.updateValues).toEqual([
      { role: "member" },
      { role: "owner" },
      { ownerId: "member-1", updatedAt: expect.any(Date) },
    ]);
  });

  it("promotes a Viewer too — the recipient's previous role doesn't limit them (FR-011)", async () => {
    actAs(OWNER_ID, "owner");
    // The action never reads the recipient's current role: it promotes whoever is a member.
    insideTransaction([project], [{ role: "owner" }]);
    updateReturns([{ userId: OWNER_ID }]);
    updateReturns([{ userId: "viewer-1" }]);
    updateReturns([]);

    await expect(transferOwnership({ ...input, newOwnerUserId: "viewer-1" })).resolves.toMatchObject({ ok: true });
    expect(state.updateValues[1]).toEqual({ role: "owner" });
  });

  it("rejects with NOT_A_MEMBER — and never touches projects.owner_id — when the recipient already left", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }]);
    updateReturns([{ userId: OWNER_ID }]); // demotion matched
    updateReturns([]); // promotion matched nobody

    await expect(transferOwnership(input)).resolves.toMatchObject({ ok: false, error: { code: "NOT_A_MEMBER" } });
    // The action throws inside the transaction, which is what rolls the demotion back in a real
    // database; what this mock can prove is that it stopped before the owner_id update.
    expect(state.updateValues).toEqual([{ role: "member" }, { role: "owner" }]);
  });

  it("rejects with ROLE_NOT_PERMITTED when the conditional demotion matches no row", async () => {
    actAs(OWNER_ID, "owner");
    insideTransaction([project], [{ role: "owner" }]);
    updateReturns([]);

    await expect(transferOwnership(input)).resolves.toMatchObject({ ok: false, error: { code: "ROLE_NOT_PERMITTED" } });
    expect(state.updateValues).toEqual([{ role: "member" }]);
  });
});

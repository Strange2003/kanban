import { beforeEach, describe, expect, it, vi } from "vitest";

// `workItemIsAncestorOf` is a thin wrapper around a single `db.execute` call
// (the recursive CTE from research.md § Detección de ciclos) — mocking that
// one call is enough to exercise every branch without a real database.
const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));

vi.mock("@/db/client", () => ({ db: { execute: mockExecute } }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { workItemIsAncestorOf } from "@/lib/actions/work-item-relationships";

describe("workItemIsAncestorOf", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  // FR-004 of 005-work-item-relationships: reject setting a Work Item's own
  // direct parent as its ancestor.
  it("returns true when the candidate is the immediate parent", async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: 1 }] });

    await expect(workItemIsAncestorOf(1, 2)).resolves.toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  // Anidación arbitraria (clarification of spec.md): the chain can be any
  // number of levels deep, so a grandparent (or further) must also count.
  it("returns true when the candidate is several levels up the chain", async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: 7 }] });

    await expect(workItemIsAncestorOf(7, 42)).resolves.toBe(true);
  });

  it("returns false when the candidate does not appear in the ancestor chain", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(workItemIsAncestorOf(99, 2)).resolves.toBe(false);
  });

  it("returns false for a Work Item with no parent at all (empty ancestor chain)", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    await expect(workItemIsAncestorOf(1, 2)).resolves.toBe(false);
  });
});

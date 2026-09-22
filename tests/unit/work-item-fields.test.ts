import { describe, expect, it } from "vitest";
import { WORK_ITEM_LEVELS, isOverdue } from "@/lib/work-item-fields";

// FR-010 of 008-work-item-fields and its Edge Cases entry on time zones.
describe("isOverdue", () => {
  const today = "2026-09-22";

  it("is false without a target date", () => {
    expect(isOverdue(null, null, today)).toBe(false);
  });

  it("is false when the target date is today — it only becomes overdue the day after", () => {
    expect(isOverdue("2026-09-22", null, today)).toBe(false);
  });

  it("is true for an open Work Item whose target date was yesterday", () => {
    expect(isOverdue("2026-09-21", null, today)).toBe(true);
  });

  it("is false once the Work Item is closed, whether closedAt is a Date or an ISO string", () => {
    expect(isOverdue("2026-09-21", new Date("2026-09-22T10:00:00Z"), today)).toBe(false);
    expect(isOverdue("2026-09-21", "2026-09-22T10:00:00.000Z", today)).toBe(false);
  });

  it("compares across month and year boundaries", () => {
    expect(isOverdue("2025-12-31", null, "2026-01-01")).toBe(true);
    expect(isOverdue("2026-10-01", null, "2026-09-30")).toBe(false);
  });
});

describe("WORK_ITEM_LEVELS", () => {
  it("is declared in urgency order, which is also the Postgres enum sort order", () => {
    expect(WORK_ITEM_LEVELS).toEqual(["critical", "high", "medium", "low"]);
  });
});

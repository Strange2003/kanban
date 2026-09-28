import { describe, expect, it } from "vitest";
import { BOARD_ARCHIVE_AFTER_DAYS, boardArchiveCutoff, isArchivedOnBoard } from "@/lib/work-item-closing";

// KAN-7: the board hides Work Items closed for more than 14 days.
const now = new Date("2026-09-28T12:00:00.000Z");
const daysAgo = (d: number, extraMs = 0) => new Date(now.getTime() - d * 86_400_000 - extraMs);

describe("isArchivedOnBoard", () => {
  it("uses a fixed 14-day window", () => {
    expect(BOARD_ARCHIVE_AFTER_DAYS).toBe(14);
    expect(boardArchiveCutoff(now)).toEqual(daysAgo(14));
  });

  it("never hides an open Work Item", () => {
    expect(isArchivedOnBoard(null, now)).toBe(false);
  });

  it("keeps items closed recently, and exactly 14 days ago", () => {
    expect(isArchivedOnBoard(now, now)).toBe(false);
    expect(isArchivedOnBoard(daysAgo(13), now)).toBe(false);
    expect(isArchivedOnBoard(daysAgo(14), now)).toBe(false);
  });

  it("hides items closed more than 14 days ago", () => {
    expect(isArchivedOnBoard(daysAgo(14, 1), now)).toBe(true);
    expect(isArchivedOnBoard(daysAgo(60), now)).toBe(true);
  });
});

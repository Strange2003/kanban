import { describe, expect, it } from "vitest";
import { formatNotificationTime, formatUnreadBadge, groupNotificationsByDay } from "@/lib/notification-inbox";

const now = new Date(2026, 8, 28, 15, 0, 0);

describe("formatUnreadBadge", () => {
  it("hides at zero and caps at 9+", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(9)).toBe("9");
    expect(formatUnreadBadge(10)).toBe("9+");
    expect(formatUnreadBadge(250)).toBe("9+");
  });
});

describe("groupNotificationsByDay", () => {
  it("splits on the local day boundary, keeping order and dropping empty groups", () => {
    const a = { id: 1, createdAt: new Date(2026, 8, 28, 0, 0, 1) };
    const b = { id: 2, createdAt: new Date(2026, 8, 27, 23, 59, 59) };
    const c = { id: 3, createdAt: new Date(2026, 7, 1) };
    const groups = groupNotificationsByDay([a, b, c], now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Today", [1]],
      ["Earlier", [2, 3]],
    ]);
    expect(groupNotificationsByDay([b], now).map((g) => g.key)).toEqual(["earlier"]);
    expect(groupNotificationsByDay([], now)).toEqual([]);
  });
});

describe("formatNotificationTime", () => {
  it("is relative today, then Yesterday, then a date", () => {
    expect(formatNotificationTime(new Date(2026, 8, 28, 14, 59, 30), now)).toBe("Just now");
    expect(formatNotificationTime(new Date(2026, 8, 28, 14, 55), now)).toBe("5 min ago");
    expect(formatNotificationTime(new Date(2026, 8, 28, 12, 0), now)).toBe("3 h ago");
    expect(formatNotificationTime(new Date(2026, 8, 27, 23, 0), now)).toBe("Yesterday");
    expect(formatNotificationTime(new Date(2026, 8, 21, 10, 0), now)).toBe("Sep 21");
    expect(formatNotificationTime(new Date(2025, 11, 25, 10, 0), now)).toBe("Dec 25, 2025");
  });
});

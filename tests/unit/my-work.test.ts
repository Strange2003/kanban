import { describe, expect, it } from "vitest";
import { addDays, bucketFor, groupMyWork, type MyWorkRow } from "@/lib/my-work";

function row(over: Partial<MyWorkRow> & { id: number }): MyWorkRow {
  return {
    displayId: `K-${over.id}`,
    displayNumber: over.id,
    title: `t${over.id}`,
    projectPublicId: "p",
    projectName: "P",
    stageName: "To do",
    isClosed: false,
    priority: null,
    targetDate: null,
    ...over,
  };
}

const TODAY = "2026-09-28";

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("bucketFor", () => {
  it("buckets by target date against today", () => {
    expect(bucketFor({ isClosed: false, targetDate: "2026-09-27" }, TODAY)).toBe("overdue");
    expect(bucketFor({ isClosed: false, targetDate: TODAY }, TODAY)).toBe("today");
    expect(bucketFor({ isClosed: false, targetDate: "2026-09-29" }, TODAY)).toBe("thisWeek");
    expect(bucketFor({ isClosed: false, targetDate: "2026-10-04" }, TODAY)).toBe("thisWeek");
    expect(bucketFor({ isClosed: false, targetDate: "2026-10-05" }, TODAY)).toBe("later");
    expect(bucketFor({ isClosed: false, targetDate: null }, TODAY)).toBe("noDate");
  });
  it("puts closed rows in closed, never overdue", () => {
    expect(bucketFor({ isClosed: true, targetDate: "2020-01-01" }, TODAY)).toBe("closed");
  });
});

describe("groupMyWork", () => {
  it("orders buckets, omits empty ones and sorts by priority then date", () => {
    const groups = groupMyWork(
      [
        row({ id: 1, targetDate: "2026-09-20", priority: "low" }),
        row({ id: 2, targetDate: "2026-09-25", priority: "critical" }),
        row({ id: 3, targetDate: "2026-09-10", priority: "low" }),
        row({ id: 4, targetDate: "2026-09-22", priority: null }),
        row({ id: 5 }),
        row({ id: 6, isClosed: true, targetDate: "2026-09-01" }),
        row({ id: 7, targetDate: TODAY }),
      ],
      TODAY,
    );
    expect(groups.map((g) => g.bucket)).toEqual(["overdue", "today", "noDate", "closed"]);
    expect(groups[0]!.rows.map((r) => r.id)).toEqual([2, 3, 1, 4]);
  });
  it("breaks full ties by id", () => {
    const [g] = groupMyWork([row({ id: 9 }), row({ id: 3 })], TODAY);
    expect(g!.rows.map((r) => r.id)).toEqual([3, 9]);
  });
});

import { describe, expect, it } from "vitest";
import { nextClosedAt } from "@/lib/work-item-closing";

// Every row of research.md § Estado de cierre derivado (008-work-item-fields,
// FR-012/FR-013/SC-006).
describe("nextClosedAt", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const earlier = new Date("2026-09-01T09:00:00Z");

  it("closes a Work Item moved from a regular column into a closing one", () => {
    expect(nextClosedAt({ fromIsClosing: false, toIsClosing: true, currentClosedAt: null, now })).toEqual({
      closedAt: now,
      event: "closed",
    });
  });

  it("reopens a Work Item moved from a closing column into a regular one", () => {
    expect(nextClosedAt({ fromIsClosing: true, toIsClosing: false, currentClosedAt: earlier, now })).toEqual({
      closedAt: null,
      event: "reopened",
    });
  });

  it("keeps the ORIGINAL closing date and emits nothing between two closing columns", () => {
    expect(nextClosedAt({ fromIsClosing: true, toIsClosing: true, currentClosedAt: earlier, now })).toEqual({
      closedAt: earlier,
      event: null,
    });
  });

  it("leaves a Work Item open and emits nothing between two regular columns", () => {
    expect(nextClosedAt({ fromIsClosing: false, toIsClosing: false, currentClosedAt: null, now })).toEqual({
      closedAt: null,
      event: null,
    });
  });

  it("creates a Work Item closed when it's born in a closing column", () => {
    expect(nextClosedAt({ fromIsClosing: null, toIsClosing: true, currentClosedAt: null, now })).toEqual({
      closedAt: now,
      event: "closed",
    });
  });

  it("creates a Work Item open, with no event, in a regular column", () => {
    expect(nextClosedAt({ fromIsClosing: null, toIsClosing: false, currentClosedAt: null, now })).toEqual({
      closedAt: null,
      event: null,
    });
  });
});

import { describe, expect, it } from "vitest";
import { describeWorkItemActivity } from "@/lib/work-item-activity";

const edited = (fields: Record<string, { from: unknown; to: unknown }>, reason?: string) => ({
  type: "fields_edited",
  payload: reason ? { fields, reason } : { fields },
});

describe("describeWorkItemActivity — 013-project-catalogs", () => {
  it("reads an old `iteration` change as Size (FR-016)", () => {
    expect(describeWorkItemActivity(edited({ iteration: { from: null, to: "Sprint 1" } }))).toBe("Size: None → Sprint 1");
  });

  it("describes a `size` change", () => {
    expect(describeWorkItemActivity(edited({ size: { from: "S", to: "M" } }))).toBe("Size: S → M");
  });

  it("marks an area or size removed because the value was deleted (FR-006)", () => {
    expect(describeWorkItemActivity(edited({ size: { from: "XL", to: null } }, "catalog_value_deleted"))).toBe(
      "Size: XL → None (value deleted)",
    );
    expect(describeWorkItemActivity(edited({ area: { from: "Backend", to: null } }, "catalog_value_deleted"))).toBe(
      "Area: Backend → None (value deleted)",
    );
  });

  it("names the tag removed because it was deleted", () => {
    expect(
      describeWorkItemActivity(edited({ tags: { from: ["Backend", "UX"], to: ["Backend"] } }, "catalog_value_deleted")),
    ).toBe("Tag removed: UX (value deleted)");
  });

  it("keeps the older summary for a plain tag edit", () => {
    expect(describeWorkItemActivity(edited({ tags: { from: [], to: ["UX"] } }))).toBe("Edited tags");
  });
});

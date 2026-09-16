import { describe, expect, it } from "vitest";
import { generatePublicId, deriveWorkItemPrefix } from "@/lib/ids";

describe("generatePublicId", () => {
  it("generates a 14-character id", () => {
    expect(generatePublicId()).toHaveLength(14);
  });

  it("only uses the unambiguous alphabet (no 0/O/1/I/l)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePublicId()).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
    }
  });

  it("does not repeat across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generatePublicId()));
    expect(ids.size).toBe(1000);
  });
});

// research.md § Identificadores públicos
describe("deriveWorkItemPrefix", () => {
  it("derives the first 3 letters, uppercased, with no attempt suffix", () => {
    expect(deriveWorkItemPrefix("Kanban App")).toBe("KAN");
  });

  it("strips non-alphanumeric characters before slicing", () => {
    expect(deriveWorkItemPrefix("my-cool_project!!")).toBe("MYC");
  });

  it("appends attempt + 1 as a numeric suffix on collision (attempt >= 1)", () => {
    expect(deriveWorkItemPrefix("Kanban App", 1)).toBe("KAN2");
    expect(deriveWorkItemPrefix("Kanban App", 2)).toBe("KAN3");
  });

  it("falls back to PRJ when the name has no letters or digits", () => {
    expect(deriveWorkItemPrefix("!!!")).toBe("PRJ");
    expect(deriveWorkItemPrefix("!!!", 1)).toBe("PRJ2");
  });

  it("keeps a short name as-is instead of padding it", () => {
    expect(deriveWorkItemPrefix("Ab")).toBe("AB");
  });
});

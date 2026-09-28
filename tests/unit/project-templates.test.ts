import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_TEMPLATE_KEY,
  PROJECT_TEMPLATES,
  getProjectTemplate,
  isProjectTemplateKey,
} from "@/lib/project-templates";

describe("project templates", () => {
  it("Simple has To Do, In Progress, Done in order, with only Done closing", () => {
    const simple = getProjectTemplate("simple");
    expect(simple.columns.map((c) => c.name)).toEqual(["To Do", "In Progress", "Done"]);
    expect(simple.columns.map((c) => c.isClosing ?? false)).toEqual([false, false, true]);
  });

  it("Blank has no columns", () => {
    expect(getProjectTemplate("blank").columns).toEqual([]);
  });

  it("validates keys and rejects anything else", () => {
    expect(isProjectTemplateKey("simple")).toBe(true);
    expect(isProjectTemplateKey("blank")).toBe(true);
    for (const bad of ["Simple", "", "kanban", undefined, null, 1, { key: "simple" }]) {
      expect(isProjectTemplateKey(bad)).toBe(false);
    }
  });

  it("has unique keys and a default that exists", () => {
    const keys = PROJECT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(isProjectTemplateKey(DEFAULT_PROJECT_TEMPLATE_KEY)).toBe(true);
  });
});

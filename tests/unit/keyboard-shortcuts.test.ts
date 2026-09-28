import { describe, expect, it } from "vitest";
import { SHORTCUTS, resolveShortcut, type KeyEventLike } from "@/lib/keyboard-shortcuts";

function event(overrides: Partial<KeyEventLike> & { key: string }): KeyEventLike {
  return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: { tagName: "BODY" }, ...overrides };
}
const free = { dialogOpen: false };

describe("resolveShortcut", () => {
  it("maps the bare keys", () => {
    expect(resolveShortcut(event({ key: "n" }), free)).toBe("newWorkItem");
    expect(resolveShortcut(event({ key: "/" }), free)).toBe("search");
    expect(resolveShortcut(event({ key: "?", shiftKey: true }), free)).toBe("help");
  });

  it("opens search with Ctrl+K or Cmd+K, even while typing", () => {
    const input = { tagName: "INPUT" };
    expect(resolveShortcut(event({ key: "k", metaKey: true, target: input }), free)).toBe("search");
    expect(resolveShortcut(event({ key: "K", ctrlKey: true, target: input }), free)).toBe("search");
    expect(resolveShortcut(event({ key: "k", ctrlKey: true, altKey: true }), free)).toBeNull();
  });

  it("ignores bare keys while typing in fields", () => {
    for (const target of [
      { tagName: "INPUT" },
      { tagName: "textarea" },
      { tagName: "SELECT" },
      { tagName: "DIV", isContentEditable: true },
    ]) {
      expect(resolveShortcut(event({ key: "n", target }), free)).toBeNull();
      expect(resolveShortcut(event({ key: "/", target }), free)).toBeNull();
      expect(resolveShortcut(event({ key: "?", shiftKey: true, target }), free)).toBeNull();
    }
  });

  it("ignores bare keys with modifiers, repeats, composition and handled events", () => {
    expect(resolveShortcut(event({ key: "n", ctrlKey: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "n", metaKey: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "n", altKey: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "N", shiftKey: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "n", repeat: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "n", isComposing: true }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "n", defaultPrevented: true }), free)).toBeNull();
  });

  it("does not fire bare keys while a dialog is open, but Ctrl+K still does", () => {
    expect(resolveShortcut(event({ key: "n" }), { dialogOpen: true })).toBeNull();
    expect(resolveShortcut(event({ key: "k", ctrlKey: true }), { dialogOpen: true })).toBe("search");
  });

  it("ignores other keys", () => {
    expect(resolveShortcut(event({ key: "x" }), free)).toBeNull();
    expect(resolveShortcut(event({ key: "Escape" }), free)).toBeNull();
  });

  it("documents every shortcut id in the help list", () => {
    const ids = SHORTCUTS.map((s) => s.id).filter(Boolean);
    expect(ids.sort()).toEqual(["help", "newWorkItem", "search"]);
  });
});

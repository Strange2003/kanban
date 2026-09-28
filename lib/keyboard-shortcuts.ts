// KAN-11: the single list of global keyboard shortcuts, and the pure rule that
// decides whether a key event triggers one. The provider in
// components/keyboard/ owns the one listener; the "?" help dialog renders
// SHORTCUTS, so a shortcut added here is documented automatically.

export type ShortcutId = "search" | "newWorkItem" | "help";

export type ShortcutDefinition = {
  // Display-only entries (Esc) have no id: the dialogs handle them natively.
  id: ShortcutId | null;
  keys: string[];
  description: string;
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "search", keys: ["Ctrl/⌘ K", "/"], description: "Search Work Items and projects" },
  { id: "newWorkItem", keys: ["N"], description: "New Work Item (on a board, if your role allows it)" },
  { id: "help", keys: ["?"], description: "Show this list of shortcuts" },
  { id: null, keys: ["Esc"], description: "Close the open dialog or panel" },
];

export type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target: { tagName?: string; isContentEditable?: boolean } | null;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: KeyEventLike["target"]): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return EDITABLE_TAGS.has((target.tagName ?? "").toUpperCase());
}

/**
 * Which shortcut (if any) a key event triggers. Ctrl/⌘+K works anywhere, even
 * while typing; every other shortcut is a bare key that must not fire while
 * typing in a field, with a modifier held, or while a dialog is open.
 * Shift is tolerated only where the character itself needs it ("?", and "/" on
 * layouts that produce it with Shift).
 */
export function resolveShortcut(event: KeyEventLike, context: { dialogOpen: boolean }): ShortcutId | null {
  if (event.defaultPrevented || event.isComposing || event.repeat) return null;

  if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
    return event.metaKey && event.ctrlKey ? null : "search";
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (isEditableTarget(event.target) || context.dialogOpen) return null;

  switch (event.key) {
    case "/":
      return "search";
    case "?":
      return "help";
    case "n":
      return event.shiftKey ? null : "newWorkItem";
    default:
      return null;
  }
}

// The provider tells the board's "add Work Item" control to open through this
// window event (KAN-11), so the shortcut reuses that control instead of
// duplicating it. A listener marks the event handled; no listener means the
// current page has no such control (or the role can't create).
export const NEW_WORK_ITEM_EVENT = "kanban:new-work-item";

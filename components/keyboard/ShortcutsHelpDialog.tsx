"use client";

import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible>
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
      </DialogHeader>
      <ul className="space-y-2 text-sm">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.description} className="flex items-center justify-between gap-4">
            <span>{shortcut.description}</span>
            <span className="flex shrink-0 gap-1">
              {shortcut.keys.map((key) => (
                <kbd key={key} className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

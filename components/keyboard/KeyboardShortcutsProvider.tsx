"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NEW_WORK_ITEM_EVENT, resolveShortcut, type KeyEventLike } from "@/lib/keyboard-shortcuts";
import { SearchPalette } from "@/components/keyboard/SearchPalette";
import { ShortcutsHelpDialog } from "@/components/keyboard/ShortcutsHelpDialog";

// KAN-10/KAN-11: the ONE global keydown listener, plus the two dialogs it opens.
type Controls = { openSearch: () => void; openHelp: () => void };

const ShortcutsContext = createContext<Controls | null>(null);

export function useShortcutControls(): Controls {
  const controls = useContext(ShortcutsContext);
  if (!controls) throw new Error("useShortcutControls must be used inside KeyboardShortcutsProvider.");
  return controls;
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchOpenRef = useRef(false);

  const openSearch = useCallback(() => {
    searchOpenRef.current = true;
    setHelpOpen(false);
    setSearchOpen(true);
  }, []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const controls = useMemo(() => ({ openSearch, openHelp }), [openSearch, openHelp]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = resolveShortcut(event as unknown as KeyEventLike, { dialogOpen: document.querySelector("dialog[open]") !== null });
      if (!shortcut) return;
      if (shortcut === "search") {
        event.preventDefault();
        if (!searchOpenRef.current) openSearch();
      } else if (shortcut === "help") {
        event.preventDefault();
        openHelp();
      } else if (shortcut === "newWorkItem") {
        const handled = { value: false };
        window.dispatchEvent(new CustomEvent(NEW_WORK_ITEM_EVENT, { detail: handled }));
        // Only swallow the key when a board control took it, so "n" isn't typed into its input.
        if (handled.value) event.preventDefault();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openSearch, openHelp]);

  return (
    <ShortcutsContext.Provider value={controls}>
      {children}
      <SearchPalette
        open={searchOpen}
        onOpenChange={(open) => {
          searchOpenRef.current = open;
          setSearchOpen(open);
        }}
      />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ShortcutsContext.Provider>
  );
}

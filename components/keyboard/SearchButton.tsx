"use client";

import { Search } from "lucide-react";
import { useShortcutControls } from "@/components/keyboard/KeyboardShortcutsProvider";

// KAN-10: header entry point for the ⌘K palette (touch users have no keyboard).
export function SearchButton() {
  const { openSearch } = useShortcutControls();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search"
      title="Search (Ctrl/⌘ K)"
      className="hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

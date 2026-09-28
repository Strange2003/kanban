"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { searchWorkspace, type SearchResults } from "@/lib/actions/search";

const DEBOUNCE_MS = 200;

type Row = { key: string; href: string; primary: string; secondary: string };

function toRows(results: SearchResults): Row[] {
  return [
    ...results.workItems.map((item) => ({
      key: `wi:${item.projectPublicId}:${item.displayNumber}`,
      href: `/projects/${item.projectPublicId}/work-items/${item.displayNumber}`,
      primary: `${item.displayId} ${item.title}`,
      secondary: item.projectName,
    })),
    ...results.projects.map((project) => ({
      key: `p:${project.publicId}`,
      href: `/projects/${project.publicId}`,
      primary: project.name,
      secondary: "Project",
    })),
  ];
}

// KAN-10: the ⌘K palette. The server resolves membership; this only sends text.
export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible panelClassName="w-[min(calc(100vw-2rem),36rem)]">
      {open && <PaletteBody onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [active, setActive] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Invalidate any in-flight search when the palette closes.
  useEffect(() => {
    const counter = requestId;
    return () => {
      counter.current++;
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    const id = ++requestId.current;
    if (!value.trim()) {
      setRows([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setTimeout(async () => {
      if (id !== requestId.current) return; // a newer keystroke superseded this one
      const result = await searchWorkspace(value);
      if (id !== requestId.current) return;
      if (result.ok) {
        setRows(toRows(result.data));
        setStatus("done");
      } else {
        setRows([]);
        setStatus("error");
      }
      setActive(0);
    }, DEBOUNCE_MS);
  }

  function go(row: Row | undefined) {
    if (!row) return;
    onClose();
    router.push(row.href);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      go(rows[active]);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search Work Items (KAN-12 or title) and projects"
        aria-label="Search"
        role="combobox"
        aria-expanded={rows.length > 0}
        aria-controls="search-results"
        aria-activedescendant={rows[active] ? `search-option-${active}` : undefined}
        autoComplete="off"
        className="mb-3 flex h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      />
      <ul id="search-results" role="listbox" aria-label="Search results" className="max-h-80 overflow-y-auto">
        {rows.map((row, index) => (
          <li
            key={row.key}
            id={`search-option-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseMove={() => setActive(index)}
            onClick={() => go(row)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
              index === active ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <span className="truncate">{row.primary}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{row.secondary}</span>
          </li>
        ))}
      </ul>
      {status === "idle" && <p className="text-muted-foreground px-1 text-xs">Type to search. Use ↑ ↓ and Enter.</p>}
      {status === "loading" && rows.length === 0 && <p className="text-muted-foreground px-1 text-xs">Searching...</p>}
      {status === "done" && rows.length === 0 && <p className="text-muted-foreground px-1 text-xs">No results.</p>}
      {status === "error" && <p className="text-destructive px-1 text-xs">Search failed. Try again.</p>}
    </div>
  );
}

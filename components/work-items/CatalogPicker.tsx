"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

// FR-005/FR-006 of 008-work-item-fields: picks ONE value from a project
// catalog (area or iteration), or creates a new one inline — the single-value
// counterpart of TagPicker. The server resolves the chosen name within the
// project, reusing an existing value case-insensitively.
export function CatalogPicker({
  id,
  label,
  catalog,
  value,
  onChange,
  disabled = false,
}: {
  // The <input>'s id, so the caller's <Label htmlFor> names it (accessibility).
  id: string;
  label: string;
  catalog: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const draftTrimmed = draft.trim();
  const suggestions = catalog.filter(
    (name) => name !== value && name.toLowerCase().includes(draftTrimmed.toLowerCase()),
  );
  const isNewName = draftTrimmed.length > 0 && !catalog.some((n) => n.toLowerCase() === draftTrimmed.toLowerCase());

  function choose(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Typing "FRONTEND" when "Frontend" exists picks the existing spelling.
    onChange(catalog.find((n) => n.toLowerCase() === trimmed.toLowerCase()) ?? trimmed);
    setDraft("");
  }

  if (disabled) {
    return (
      <p id={id} className="text-sm">
        {value ?? <span className="text-muted-foreground">None</span>}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {value && (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {value}
          <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${label.toLowerCase()} ${value}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      <div className="relative">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              choose(draft);
            }
          }}
          placeholder={value ? `Change ${label.toLowerCase()}...` : `Set ${label.toLowerCase()}...`}
        />
        {draftTrimmed && (suggestions.length > 0 || isNewName) && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => choose(name)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {name}
                </button>
              </li>
            ))}
            {isNewName && (
              <li>
                <button
                  type="button"
                  onClick={() => choose(draftTrimmed)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                >
                  Create &quot;{draftTrimmed}&quot;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

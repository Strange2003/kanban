"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// FR-008/FR-012 of 004-work-items: tags come from the project's catalog,
// but a new one can be created inline from this same picker.
export function TagPicker({
  catalog,
  selected,
  onChange,
  disabled = false,
}: {
  catalog: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  // Read-only mode (FR-005 of 007-roles-permissions): the tags are shown, but
  // nothing can be added, removed or created.
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const draftTrimmed = draft.trim();
  const suggestions = catalog.filter(
    (name) => !selected.includes(name) && name.toLowerCase().includes(draftTrimmed.toLowerCase()),
  );
  const isNewName = draftTrimmed.length > 0 && !catalog.some((n) => n.toLowerCase() === draftTrimmed.toLowerCase());

  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || selected.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
    setDraft("");
  }

  function removeTag(name: string) {
    onChange(selected.filter((t) => t !== name));
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {name}
              {!disabled && (
                <button type="button" onClick={() => removeTag(name)} aria-label={`Remove ${name}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {disabled && selected.length === 0 && <p className="text-muted-foreground text-xs">No tags.</p>}

      <div className={disabled ? "hidden" : "relative"}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="Add a tag..."
        />
        {draftTrimmed && (suggestions.length > 0 || isNewName) && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => addTag(name)}
                  className={cn("block w-full px-3 py-1.5 text-left text-sm hover:bg-accent")}
                >
                  {name}
                </button>
              </li>
            ))}
            {isNewName && (
              <li>
                <button
                  type="button"
                  onClick={() => addTag(draftTrimmed)}
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

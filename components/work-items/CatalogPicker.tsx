"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateCatalogValueDialog } from "@/components/work-items/CreateCatalogValueDialog";

// FR-005/FR-006 of 008-work-item-fields: picks ONE value from a project
// catalog (area or size) — the single-value counterpart of TagPicker. With
// 013-project-catalogs the options follow the catalog's manual order and
// filter by substring as you type (FR-012), and a name that doesn't exist is
// created through the "Create new" pop-up instead of on Enter (FR-013/FR-014).
export function CatalogPicker({
  id,
  label,
  kind,
  projectPublicId,
  catalog,
  value,
  onChange,
  onCatalogAdd,
  canCreate = true,
  disabled = false,
}: {
  // The <input>'s id, so the caller's <Label htmlFor> names it (accessibility).
  id: string;
  label: string;
  kind: "area" | "size";
  projectPublicId: string;
  catalog: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  // A value created in the pop-up, so the caller's catalog includes it.
  onCatalogAdd: (name: string) => void;
  canCreate?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);

  const draftTrimmed = draft.trim();
  const suggestions = catalog.filter(
    (name) => name !== value && name.toLowerCase().includes(draftTrimmed.toLowerCase()),
  );
  const exactMatch = catalog.find((n) => n.toLowerCase() === draftTrimmed.toLowerCase());
  const canOfferCreate = canCreate && draftTrimmed.length > 0 && !exactMatch;

  function choose(name: string) {
    onChange(name);
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
              // Typing "FRONTEND" when "Frontend" exists picks the existing spelling.
              if (exactMatch) choose(exactMatch);
              else if (canOfferCreate) setCreating(true);
            }
          }}
          placeholder={value ? `Change ${label.toLowerCase()}...` : `Set ${label.toLowerCase()}...`}
        />
        {draftTrimmed && (suggestions.length > 0 || canOfferCreate) && (
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
            {canOfferCreate && (
              <li>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                >
                  Create new &quot;{draftTrimmed}&quot;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <CreateCatalogValueDialog
        projectPublicId={projectPublicId}
        kind={kind}
        initialName={draftTrimmed}
        open={creating}
        onOpenChange={setCreating}
        onCreated={({ name }) => {
          if (!catalog.some((n) => n.toLowerCase() === name.toLowerCase())) onCatalogAdd(name);
          choose(name);
        }}
      />
    </div>
  );
}

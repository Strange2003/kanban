"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import { CreateCatalogValueDialog } from "@/components/work-items/CreateCatalogValueDialog";
import { DEFAULT_TAG_COLOR, TAG_COLOR_STYLES, type TagColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

export type TagOption = { name: string; color: TagColor };

// FR-008/FR-012 of 004-work-items: tags come from the project's catalog. With
// 013-project-catalogs they show their color (FR-011), the suggestions follow
// the catalog's manual order and filter by substring as you type (FR-012), and
// a name that doesn't exist is created through the "Create new" pop-up, with
// its color, instead of on Enter (FR-013/FR-014).
export function TagPicker({
  projectPublicId,
  catalog,
  selected,
  onChange,
  onCatalogAdd,
  canCreate = true,
  disabled = false,
}: {
  projectPublicId: string;
  catalog: TagOption[];
  selected: string[];
  onChange: (tags: string[]) => void;
  // A value created in the pop-up, so the caller's catalog includes it.
  onCatalogAdd: (tag: TagOption) => void;
  // `catalog:manage`; the same roles as editing a Work Item today.
  canCreate?: boolean;
  // Read-only mode (FR-005 of 007-roles-permissions): the tags are shown, but
  // nothing can be added, removed or created.
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);

  const colorOf = (name: string) =>
    catalog.find((t) => t.name.toLowerCase() === name.toLowerCase())?.color ?? DEFAULT_TAG_COLOR;
  const isSelected = (name: string) => selected.some((t) => t.toLowerCase() === name.toLowerCase());

  const draftTrimmed = draft.trim();
  const suggestions = catalog.filter(
    (tag) => !isSelected(tag.name) && tag.name.toLowerCase().includes(draftTrimmed.toLowerCase()),
  );
  const exactMatch = catalog.find((t) => t.name.toLowerCase() === draftTrimmed.toLowerCase());
  const canOfferCreate = canCreate && draftTrimmed.length > 0 && !exactMatch;

  function addTag(name: string) {
    if (isSelected(name)) return;
    onChange([...selected, name]);
    setDraft("");
  }

  function removeTag(name: string) {
    onChange(selected.filter((t) => t !== name));
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {selected.map((name) => (
            <li key={name}>
              <TagChip name={name} color={colorOf(name)} onRemove={disabled ? undefined : () => removeTag(name)} />
            </li>
          ))}
        </ul>
      )}

      {disabled && selected.length === 0 && <p className="text-muted-foreground text-xs">No tags.</p>}

      <div className={disabled ? "hidden" : "relative"}>
        <Input
          aria-label="Add a tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // An existing tag (in any case) is assigned with its own spelling;
              // anything else goes through the pop-up.
              if (exactMatch) addTag(exactMatch.name);
              else if (canOfferCreate) setCreating(true);
            }
          }}
          placeholder="Add a tag..."
        />
        {draftTrimmed && (suggestions.length > 0 || canOfferCreate) && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {suggestions.map((tag) => (
              <li key={tag.name}>
                <button
                  type="button"
                  onClick={() => addTag(tag.name)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", TAG_COLOR_STYLES[tag.color].swatch)} />
                  {tag.name}
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
        kind="tag"
        initialName={draftTrimmed}
        open={creating}
        onOpenChange={setCreating}
        onCreated={({ name, color }) => {
          if (!catalog.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            onCatalogAdd({ name, color: color ?? DEFAULT_TAG_COLOR });
          }
          addTag(name);
        }}
      />
    </div>
  );
}

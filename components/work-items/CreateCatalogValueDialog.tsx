"use client";

import { useState } from "react";
import { createCatalogValue } from "@/lib/actions/project-catalogs";
import type { CatalogKind } from "@/lib/work-item-catalogs";
import { DEFAULT_TAG_COLOR, type TagColor } from "@/lib/tag-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagColorPicker } from "@/components/ui/tag-color-picker";

const TITLES: Record<CatalogKind, string> = { tag: "New tag", area: "New area", size: "New size" };

// FR-014 of 013-project-catalogs: "Create new" from a Work Item's Tags, Area
// or Size field. Confirms the name (and, for a tag, its color) and creates the
// value in the project's catalog right away, without leaving the Work Item;
// the Work Item itself is still saved with its own "Save" button. Cancelling
// creates nothing. Rendered inside the detail's <form>, so it has no form of
// its own: Enter in the name field is handled here and never submits the Work Item.
export function CreateCatalogValueDialog({
  projectPublicId,
  kind,
  initialName,
  open,
  onOpenChange,
  onCreated,
}: {
  projectPublicId: string;
  kind: CatalogKind;
  initialName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (value: { name: string; color?: TagColor }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<TagColor>(DEFAULT_TAG_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Start from the typed text each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(initialName);
      setColor(DEFAULT_TAG_COLOR);
      setError(null);
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setError(null);
    setCreating(true);
    const result = await createCatalogValue({
      projectPublicId,
      kind,
      name: trimmed,
      ...(kind === "tag" ? { color } : {}),
    });
    setCreating(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onCreated({ name: result.data.name, color: result.data.color });
    onOpenChange(false);
  }

  const inputId = `new-${kind}-name`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible>
      <DialogHeader>
        <DialogTitle>{TITLES[kind]}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>Name</Label>
          <Input
            id={inputId}
            autoFocus
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
        </div>
        {kind === "tag" && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Color</p>
            <TagColorPicker value={color} onChange={setColor} />
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleCreate()} disabled={creating || !name.trim()}>
          {creating ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

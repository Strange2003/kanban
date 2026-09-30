"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkItem } from "@/lib/actions/work-items";
import { Button } from "@/components/ui/button";
import { isRolePermissionError } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { NEW_WORK_ITEM_EVENT } from "@/lib/keyboard-shortcuts";
import type { BoardFilterItem } from "@/lib/work-item-view";

export function AddWorkItemButton({
  stagePublicId,
  isHiddenByFilters,
  listenForNewShortcut = false,
}: {
  stagePublicId: string;
  // 014-board-filters-mcp-catalogs FR-014: a new Work Item has no assignee and
  // no tags, area or size; if the board's filters would hide it, say so instead of letting it vanish.
  // KAN-11: open the form when the "n" shortcut fires (first column only).
  listenForNewShortcut?: boolean;
  isHiddenByFilters?: (item: BoardFilterItem) => boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!listenForNewShortcut) return;
    function onShortcut(event: Event) {
      (event as CustomEvent<{ value: boolean }>).detail.value = true;
      setAdding(true);
    }
    window.addEventListener(NEW_WORK_ITEM_EVENT, onShortcut);
    return () => window.removeEventListener(NEW_WORK_ITEM_EVENT, onShortcut);
  }, [listenForNewShortcut]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createWorkItem({ stagePublicId, title });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      // The role changed under an open screen (FR-004 of 007-roles-permissions).
      if (isRolePermissionError(result)) router.refresh();
      return;
    }

    setTitle("");
    setAdding(false);
    if (isHiddenByFilters?.({ assigneeUserId: null, tagNames: [], areaName: null, sizeName: null })) {
      toast(`${result.data.displayId} was created but is hidden by the active filters.`);
    }
    router.refresh();
  }

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAdding(true)}>
        + Add work item
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        autoFocus
        onBlur={() => {
          if (!title) setAdding(false);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        {/* Keeps focus in the input: otherwise its onBlur closes the empty form before
            the submit fires, and the "name is required" error never shows. */}
        <Button type="submit" size="sm" disabled={submitting} onMouseDown={(e) => e.preventDefault()}>
          {submitting ? "Adding..." : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Palette, Pencil, Trash2 } from "lucide-react";
import {
  createCatalogValue,
  deleteCatalogValue,
  renameCatalogValue,
  reorderCatalog,
  setTagColor,
} from "@/lib/actions/project-catalogs";
import type { CatalogKind } from "@/lib/work-item-catalogs";
import { DEFAULT_TAG_COLOR, type TagColor } from "@/lib/tag-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagChip } from "@/components/ui/tag-chip";
import { TagColorPicker } from "@/components/ui/tag-color-picker";

export type CatalogSectionValue = { name: string; usage: number; color?: TagColor };

const NOUN: Record<CatalogKind, { one: string; many: string }> = {
  tag: { one: "tag", many: "tags" },
  area: { one: "area", many: "areas" },
  size: { one: "size", many: "sizes" },
};

const usedBy = (usage: number) =>
  usage === 0 ? "Not used by any Work Item." : `Used by ${usage} Work Item${usage === 1 ? "" : "s"}.`;

const iconButton =
  "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent";

// FR-001/FR-003/FR-003a/FR-006 of 013-project-catalogs: one catalog of the
// project (tags, areas or sizes), managed the same way — create, rename,
// reorder without dragging, delete with confirmation — plus the color of each
// tag. Renames, recolors and moves are optimistic and revert on failure,
// like the board. Without `canManage` (a Viewer) it's a read-only list.
export function CatalogSection({
  projectPublicId,
  kind,
  title,
  values: initialValues,
  canManage,
}: {
  projectPublicId: string;
  kind: CatalogKind;
  title: string;
  values: CatalogSectionValue[];
  canManage: boolean;
}) {
  const router = useRouter();
  const noun = NOUN[kind];
  const [values, setValues] = useState(initialValues);
  // Resync when the server sends a new list (after router.refresh()).
  const [prevInitial, setPrevInitial] = useState(initialValues);
  if (initialValues !== prevInitial) {
    setPrevInitial(initialValues);
    setValues(initialValues);
  }

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ name: string; draft: string } | null>(null);
  const [coloring, setColoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CatalogSectionValue | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  function fail(message: string, code?: string) {
    setError(message);
    // Someone else changed the catalog meanwhile: show the current state.
    if (code === "CONFLICT" || code === "NOT_FOUND") router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setError(null);
    setNotice(null);
    setAdding(true);
    const result = await createCatalogValue({ projectPublicId, kind, name });
    setAdding(false);
    if (!result.ok) return fail(result.error.message, result.error.code);
    setDraft("");
    if (!result.data.created) setNotice(`"${result.data.name}" already exists.`);
    else setValues((current) => [...current, { name: result.data.name, usage: 0, color: result.data.color }]);
    router.refresh();
  }

  async function handleRename() {
    if (!editing) return;
    const newName = editing.draft.trim();
    const oldName = editing.name;
    setEditing(null);
    if (!newName || newName === oldName) return;
    setError(null);
    const previous = values;
    setValues((current) => current.map((v) => (v.name === oldName ? { ...v, name: newName } : v)));
    const result = await renameCatalogValue({ projectPublicId, kind, name: oldName, newName });
    if (!result.ok) {
      setValues(previous);
      return fail(result.error.message, result.error.code);
    }
    router.refresh();
  }

  async function handleMove(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    setError(null);
    const previous = values;
    const next = [...values];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setValues(next);
    const result = await reorderCatalog({ projectPublicId, kind, orderedNames: next.map((v) => v.name) });
    if (!result.ok) {
      setValues(previous);
      return fail(result.error.message, result.error.code);
    }
    router.refresh();
  }

  async function handleColor(name: string, color: TagColor) {
    setError(null);
    const previous = values;
    setValues((current) => current.map((v) => (v.name === name ? { ...v, color } : v)));
    const result = await setTagColor({ projectPublicId, name, color });
    if (!result.ok) {
      setValues(previous);
      return fail(result.error.message, result.error.code);
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setError(null);
    setDeletingBusy(true);
    const result = await deleteCatalogValue({ projectPublicId, kind, name: deleting.name });
    setDeletingBusy(false);
    const name = deleting.name;
    setDeleting(null);
    if (!result.ok) return fail(result.error.message, result.error.code);
    setValues((current) => current.filter((v) => v.name !== name));
    router.refresh();
  }

  return (
    <section id={`${kind}s`} aria-labelledby={`${kind}s-heading`} className="space-y-3">
      <div>
        <h2 id={`${kind}s-heading`} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {kind === "tag"
            ? "Labels with a color, shown on the board cards."
            : kind === "area"
              ? "The part of the product or team a Work Item belongs to."
              : "How big a Work Item is. The order here is the order used to sort."}
        </p>
      </div>

      {values.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed border-border px-3 py-4 text-sm">
          No {noun.many} yet.{canManage && ` Add the first one below.`}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid={`catalog-${kind}`}>
          {values.map((value, index) => (
            <li key={value.name} className="px-3 py-2" data-testid="catalog-value">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  {editing?.name === value.name ? (
                    <Input
                      autoFocus
                      aria-label={`New name for ${value.name}`}
                      value={editing.draft}
                      maxLength={50}
                      onChange={(e) => setEditing({ name: value.name, draft: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      // Enter saves; leaving the field cancels, like Escape.
                      onBlur={() => setEditing(null)}
                      className="h-8"
                    />
                  ) : (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                      {kind === "tag" ? (
                        <TagChip name={value.name} color={value.color ?? DEFAULT_TAG_COLOR} />
                      ) : (
                        <span className="truncate text-sm font-medium">{value.name}</span>
                      )}
                      <span className="text-muted-foreground text-xs">{usedBy(value.usage)}</span>
                    </div>
                  )}
                </div>

                {canManage && editing?.name !== value.name && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {kind === "tag" && (
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={`Change color of ${value.name}`}
                        aria-expanded={coloring === value.name}
                        onClick={() => setColoring(coloring === value.name ? null : value.name)}
                      >
                        <Palette className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Rename ${value.name}`}
                      onClick={() => setEditing({ name: value.name, draft: value.name })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Move ${value.name} up`}
                      disabled={index === 0}
                      onClick={() => void handleMove(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Move ${value.name} down`}
                      disabled={index === values.length - 1}
                      onClick={() => void handleMove(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`${iconButton} hover:text-destructive`}
                      aria-label={`Delete ${value.name}`}
                      onClick={() => setDeleting(value)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </div>

              {kind === "tag" && canManage && coloring === value.name && (
                <div className="mt-2">
                  <TagColorPicker
                    label={`Color of ${value.name}`}
                    value={value.color ?? DEFAULT_TAG_COLOR}
                    onChange={(color) => void handleColor(value.name, color)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {notice && <p className="text-muted-foreground text-sm">{notice}</p>}

      {canManage && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            aria-label={`New ${noun.one}`}
            placeholder={`Add ${noun.one === "area" ? "an" : "a"} ${noun.one}…`}
            value={draft}
            maxLength={50}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={adding || !draft.trim()}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </form>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} dismissible>
        <DialogHeader>
          <DialogTitle>Delete &quot;{deleting?.name}&quot;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          {deleting && usedBy(deleting.usage)}
          {deleting && deleting.usage > 0 && ` It will be removed from ${deleting.usage === 1 ? "it" : "them"}, and each Work Item's history will say so.`}
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deletingBusy}>
            {deletingBusy ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  );
}

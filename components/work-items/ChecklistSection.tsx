"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckSquare, Pencil, Trash2 } from "lucide-react";
import {
  addChecklistItem,
  editChecklistItemText,
  moveChecklistItem,
  removeChecklistItem,
  setChecklistItemDone,
} from "@/lib/actions/work-item-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRolePermissionError, type Result } from "@/lib/errors";
import { CHECKLIST_TEXT_MAX, checklistProgress, type ChecklistItemView } from "@/lib/work-item-checklist";

// KAN-9. Rendered inside the detail view's <form>, so every button is
// type="button" and Enter in a text field is handled here instead of submitting.
export function ChecklistSection({
  projectPublicId,
  displayNumber,
  initialItems,
  canEdit,
}: {
  projectPublicId: string;
  displayNumber: number;
  initialItems: ChecklistItemView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  // The server's list is the source of truth after a router.refresh().
  const [prevInitial, setPrevInitial] = useState(initialItems);
  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    setItems(initialItems);
  }
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = { projectPublicId, displayNumber };
  const { done, total } = checklistProgress(items);

  // Runs one action at a time; on failure shows the message and, when the role
  // changed or the item vanished, reloads the server's view.
  async function run<T>(action: () => Promise<Result<T>>, onSuccess: (data: T) => void): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result) || result.error.code === "NOT_FOUND") router.refresh();
      return false;
    }
    onSuccess(result.data);
    return true;
  }

  async function handleAdd() {
    if (!newText.trim()) return;
    const added = await run(
      () => addChecklistItem({ ...target, text: newText }),
      (item) => setItems((list) => [...list, item]),
    );
    if (added) setNewText("");
  }

  async function handleSaveEdit(itemPublicId: string) {
    if (!editText.trim()) return;
    const saved = await run(
      () => editChecklistItemText({ ...target, itemPublicId, text: editText }),
      (item) => setItems((list) => list.map((current) => (current.publicId === item.publicId ? item : current))),
    );
    if (saved) setEditingId(null);
  }

  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 sm:p-6" aria-labelledby="wi-checklist-heading">
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-violet-300" aria-hidden />
        <h2 id="wi-checklist-heading" className="text-base font-semibold">Checklist</h2>
        {total > 0 && (
          <span
            data-testid="checklist-progress"
            className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            aria-label={`${done} of ${total} steps done`}
          >
            {done}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="h-full bg-violet-400 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{canEdit ? "No steps yet. Add the first one below." : "No steps yet."}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={item.publicId} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-secondary/40">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!canEdit || busy}
                onChange={(event) =>
                  run(
                    () => setChecklistItemDone({ ...target, itemPublicId: item.publicId, done: event.target.checked }),
                    (updated) => setItems((list) => list.map((current) => (current.publicId === updated.publicId ? updated : current))),
                  )
                }
                aria-label={`Mark "${item.text}" as done`}
                className="h-4 w-4 shrink-0 accent-violet-500"
              />
              {editingId === item.publicId ? (
                <>
                  <Input
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSaveEdit(item.publicId);
                      } else if (event.key === "Escape") setEditingId(null);
                    }}
                    maxLength={CHECKLIST_TEXT_MAX}
                    aria-label="Step text"
                    autoFocus
                    className="h-8"
                  />
                  <Button type="button" size="sm" onClick={() => handleSaveEdit(item.publicId)} disabled={busy || !editText.trim()}>Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className={item.done ? "min-w-0 flex-1 break-words text-sm text-muted-foreground line-through" : "min-w-0 flex-1 break-words text-sm"}>
                    {item.text}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || index === 0}
                        aria-label={`Move "${item.text}" up`}
                        onClick={() => run(() => moveChecklistItem({ ...target, itemPublicId: item.publicId, direction: "up" }), setItems)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || index === items.length - 1}
                        aria-label={`Move "${item.text}" down`}
                        onClick={() => run(() => moveChecklistItem({ ...target, itemPublicId: item.publicId, direction: "down" }), setItems)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Edit "${item.text}"`}
                        onClick={() => {
                          setEditingId(item.publicId);
                          setEditText(item.text);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Delete "${item.text}"`}
                        className="text-destructive"
                        onClick={() =>
                          run(
                            () => removeChecklistItem({ ...target, itemPublicId: item.publicId }),
                            ({ publicId }) => setItems((list) => list.filter((current) => current.publicId !== publicId)),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <Input
            value={newText}
            onChange={(event) => setNewText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
            maxLength={CHECKLIST_TEXT_MAX}
            placeholder="Add a step..."
            aria-label="New checklist step"
          />
          <Button type="button" onClick={handleAdd} disabled={busy || !newText.trim()}>Add</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

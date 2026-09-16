"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateWorkItem,
  deleteWorkItem,
  listProjectTags,
  getWorkItemTags,
  listWorkItemActivity,
  type WorkItemWithDisplayId,
} from "@/lib/actions/work-items";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/work-items/TagPicker";

type ActivityEntry = { id: number; type: string; payload: unknown; createdAt: Date };

function describeActivity(entry: ActivityEntry): string {
  if (entry.type === "stage_changed") return "Moved to a different column";
  if (entry.type === "fields_edited") {
    const payload = entry.payload as { fields?: Record<string, unknown> };
    const fields = payload.fields ? Object.keys(payload.fields) : [];
    return fields.length > 0 ? `Edited ${fields.join(", ")}` : "Edited";
  }
  return entry.type;
}

// FR-007/FR-008/FR-009/FR-010/FR-011/FR-012/FR-013 of 004-work-items
export function WorkItemDetailPanel({
  workItem,
  projectPublicId,
  open,
  onOpenChange,
}: {
  workItem: WorkItemWithDisplayId;
  projectPublicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(workItem.title);
  const [description, setDescription] = useState(workItem.description ?? "");
  const [stakeholder, setStakeholder] = useState(workItem.stakeholder ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [catalogTags, setCatalogTags] = useState<string[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset the form fields the moment the dialog opens (React's documented
  // render-time-adjustment pattern) — separate from the data fetch below,
  // which is genuine async I/O and belongs in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTitle(workItem.title);
      setDescription(workItem.description ?? "");
      setStakeholder(workItem.stakeholder ?? "");
      setError(null);
      setConfirmingDelete(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    void Promise.all([
      listProjectTags(projectPublicId),
      getWorkItemTags(workItem.id),
      listWorkItemActivity(workItem.id),
    ]).then(([catalogResult, itemTagsResult, activityResult]) => {
      if (catalogResult.ok) setCatalogTags(catalogResult.data.map((t) => t.name));
      if (itemTagsResult.ok) setSelectedTags(itemTagsResult.data.map((t) => t.name));
      if (activityResult.ok) setActivity(activityResult.data);
    });
  }, [open, workItem, projectPublicId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await updateWorkItem({
      workItemId: workItem.id,
      title,
      description,
      stakeholder,
      tagNames: selectedTags,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteWorkItem(workItem.id);
    setDeleting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{workItem.displayId}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSave} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="wi-title">Title</Label>
          <Input id="wi-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wi-description">Description</Label>
          <textarea
            id="wi-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wi-stakeholder">Stakeholder</Label>
          <Input id="wi-stakeholder" value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker catalog={catalogTags} selected={selectedTags} onChange={setSelectedTags} />
        </div>

        {activity.length > 0 && (
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <ul className="text-muted-foreground max-h-28 space-y-1 overflow-y-auto text-xs">
              {activity.map((entry) => (
                <li key={entry.id}>{describeActivity(entry)}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter className="justify-between">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Delete this Work Item?</span>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Confirm"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

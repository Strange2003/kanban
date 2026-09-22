"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateWorkItem, deleteWorkItem, type WorkItemWithDisplayId } from "@/lib/actions/work-items";
import {
  setWorkItemParent,
  removeWorkItemParent,
  linkRelatedWorkItems,
  unlinkRelatedWorkItems,
  type WorkItemDetailData,
  type WorkItemRelationRef,
} from "@/lib/actions/work-item-relationships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/work-items/TagPicker";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { isRolePermissionError } from "@/lib/errors";
import { can } from "@/lib/roles";

type ActivityEntry = { id: number; type: string; payload: unknown; createdAt: Date };

function describeActivity(entry: ActivityEntry): string {
  if (entry.type === "stage_changed") return "Moved to a different column";
  if (entry.type === "fields_edited") {
    const payload = entry.payload as { fields?: Record<string, unknown> };
    const fields = payload.fields ? Object.keys(payload.fields) : [];
    return fields.length > 0 ? `Edited ${fields.join(", ")}` : "Edited";
  }
  if (entry.type === "parent_linked") return "Linked to a parent Work Item";
  if (entry.type === "parent_unlinked") return "Unlinked from its parent Work Item";
  if (entry.type === "related_linked") return "Linked to a related Work Item";
  if (entry.type === "related_unlinked") return "Unlinked from a related Work Item";
  return entry.type;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function relationHref(projectPublicId: string, ref: WorkItemRelationRef): string {
  return `/projects/${projectPublicId}/work-items/${ref.displayNumber}`;
}

// FR-003/FR-004/FR-005/FR-006/FR-007/FR-008/FR-009 of 006-work-item-detail-view
// (reuses the exact behavior already defined for these fields/relations in
// 004-work-items and 005-work-item-relationships).
export function WorkItemDetailView({
  workItem,
  projectPublicId,
  initialDetail,
}: {
  workItem: WorkItemWithDisplayId;
  projectPublicId: string;
  // Fetched server-side by the page (research.md § Carga de datos de la
  // página) — no client-side fetch-on-mount, the page renders with this
  // data already in place.
  initialDetail: WorkItemDetailData;
}) {
  const router = useRouter();
  // 007-roles-permissions: derived from the role the server just read, so a
  // router.refresh() after a rejected action flips this screen to read-only.
  // The Server Actions enforce the same permissions; this only reflects them.
  const canEdit = can(initialDetail.role, "workItem:edit");
  const canEditRelations = can(initialDetail.role, "relationship:edit");
  const [title, setTitle] = useState(workItem.title);
  const [description, setDescription] = useState(workItem.description ?? "");
  const [stakeholder, setStakeholder] = useState(workItem.stakeholder ?? "");
  const [selectedTags, setSelectedTags] = useState(initialDetail.itemTags);
  const [catalogTags, setCatalogTags] = useState(initialDetail.catalogTags);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialDetail.activity);
  const [relations, setRelations] = useState(initialDetail.relations);
  const [pickableWorkItems, setPickableWorkItems] = useState(initialDetail.pickableWorkItems);
  const [parentPick, setParentPick] = useState("");
  const [relatedPick, setRelatedPick] = useState("");
  const [relationsBusy, setRelationsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // This component instance is reused across client-side transitions
  // between related Work Items' routes (Next.js doesn't remount it just
  // because a <Link> changed the URL) — reset every piece of state to the
  // new Work Item's server-fetched data the moment it arrives, same
  // render-time-adjustment pattern the old WorkItemDetailPanel used for its
  // open/close transition.
  const [prevWorkItemId, setPrevWorkItemId] = useState(workItem.id);
  if (workItem.id !== prevWorkItemId) {
    setPrevWorkItemId(workItem.id);
    setTitle(workItem.title);
    setDescription(workItem.description ?? "");
    setStakeholder(workItem.stakeholder ?? "");
    setSelectedTags(initialDetail.itemTags);
    setCatalogTags(initialDetail.catalogTags);
    setActivity(initialDetail.activity);
    setRelations(initialDetail.relations);
    setPickableWorkItems(initialDetail.pickableWorkItems);
    setParentPick("");
    setRelatedPick("");
    setError(null);
    setConfirmingDelete(false);
  }

  async function handleSetParent() {
    if (!parentPick) return;
    setRelationsBusy(true);
    setError(null);
    const result = await setWorkItemParent({ workItemId: workItem.id, parentWorkItemId: Number(parentPick) });
    setRelationsBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setParentPick("");
    setRelations(result.data);
    router.refresh();
  }

  async function handleRemoveParent() {
    setRelationsBusy(true);
    setError(null);
    const result = await removeWorkItemParent(workItem.id);
    setRelationsBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setRelations(result.data);
    router.refresh();
  }

  async function handleLinkRelated() {
    if (!relatedPick) return;
    setRelationsBusy(true);
    setError(null);
    const result = await linkRelatedWorkItems({ workItemIdX: workItem.id, workItemIdY: Number(relatedPick) });
    setRelationsBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setRelatedPick("");
    setRelations(result.data);
    router.refresh();
  }

  async function handleUnlinkRelated(relatedWorkItemId: number) {
    setRelationsBusy(true);
    setError(null);
    const result = await unlinkRelatedWorkItems({ workItemIdX: workItem.id, workItemIdY: relatedWorkItemId });
    setRelationsBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setRelations(result.data);
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Pressing Enter in a read-only field still submits the form; a Viewer has nothing to save.
    if (!canEdit) return;
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
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteWorkItem(workItem.id);
    setDeleting(false);

    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    router.push(`/projects/${projectPublicId}`);
  }

  const { parent, children, related } = relations;
  const hasNoRelations = !parent && children.length === 0 && related.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <Link
        href={`/projects/${projectPublicId}`}
        className="text-muted-foreground rounded text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        ← Back to board
      </Link>

      <h1 className="text-lg font-semibold">{workItem.displayId}</h1>

      {!canEdit && <ReadOnlyNotice role={initialDetail.role} />}

      <form onSubmit={handleSave} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="wi-title">Title</Label>
          <Input id="wi-title" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wi-description">Description</Label>
          <textarea
            id="wi-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            readOnly={!canEdit}
            className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wi-stakeholder">Stakeholder</Label>
          <Input
            id="wi-stakeholder"
            value={stakeholder}
            onChange={(e) => setStakeholder(e.target.value)}
            readOnly={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker catalog={catalogTags} selected={selectedTags} onChange={setSelectedTags} disabled={!canEdit} />
        </div>

        <div className="space-y-2">
          <Label>Relations</Label>

          {hasNoRelations ? (
            <p className="text-muted-foreground text-xs">No relations yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {parent && (
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={relationHref(projectPublicId, parent)}
                    className="rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`Go to parent ${parent.displayId} ${parent.title}`}
                  >
                    <span className="text-muted-foreground text-xs">Parent: </span>
                    {parent.displayId} {parent.title}
                  </Link>
                  {canEditRelations && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveParent}
                      disabled={relationsBusy}
                      aria-label={`Remove parent ${parent.displayId}`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}

              {children.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Children</span>
                  <ul className="space-y-1">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={relationHref(projectPublicId, child)}
                          className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label={`Go to child ${child.displayId} ${child.title}`}
                        >
                          {child.displayId} {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {related.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Related</span>
                  <ul className="space-y-1">
                    {related.map((relatedItem) => (
                      <li key={relatedItem.id} className="flex items-center justify-between gap-2">
                        <Link
                          href={relationHref(projectPublicId, relatedItem)}
                          className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label={`Go to related ${relatedItem.displayId} ${relatedItem.title}`}
                        >
                          {relatedItem.displayId} {relatedItem.title}
                        </Link>
                        {canEditRelations && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkRelated(relatedItem.id)}
                            disabled={relationsBusy}
                            aria-label={`Remove related ${relatedItem.displayId}`}
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {canEditRelations && !parent && pickableWorkItems.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Convert into a child of"
                value={parentPick}
                onChange={(e) => setParentPick(e.target.value)}
                className={selectClassName}
              >
                <option value="">Convert into a child of...</option>
                {pickableWorkItems.map((wi) => (
                  <option key={wi.id} value={wi.id}>
                    {wi.displayId} {wi.title}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={handleSetParent} disabled={!parentPick || relationsBusy}>
                Set
              </Button>
            </div>
          )}

          {canEditRelations && pickableWorkItems.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Relate to"
                value={relatedPick}
                onChange={(e) => setRelatedPick(e.target.value)}
                className={selectClassName}
              >
                <option value="">Relate to...</option>
                {pickableWorkItems.map((wi) => (
                  <option key={wi.id} value={wi.id}>
                    {wi.displayId} {wi.title}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={handleLinkRelated} disabled={!relatedPick || relationsBusy}>
                Link
              </Button>
            </div>
          )}
        </div>

        {activity.length > 0 && (
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <ul className="text-muted-foreground max-h-40 space-y-1 overflow-y-auto text-xs">
              {activity.map((entry) => (
                <li key={entry.id}>{describeActivity(entry)}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {canEdit && (
          <div className="flex items-center justify-between border-t border-border pt-4">
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

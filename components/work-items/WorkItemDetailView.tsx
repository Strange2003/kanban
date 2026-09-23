"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateWorkItem, deleteWorkItem, closeWorkItem, type WorkItemWithDisplayId } from "@/lib/actions/work-items";
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
import { CatalogPicker } from "@/components/work-items/CatalogPicker";
import { AssigneePicker } from "@/components/work-items/AssigneePicker";
import { LocalDate } from "@/components/ui/local-date";
import { formatCalendarDate, useLocalToday } from "@/lib/dates";
import { LEVEL_LABELS, WORK_ITEM_LEVELS, isOverdue, type WorkItemLevel } from "@/lib/work-item-fields";
import { describeWorkItemActivity, type WorkItemActivityEntryView } from "@/lib/work-item-activity";

type ActivityEntry = WorkItemActivityEntryView;

const describeActivity = (entry: ActivityEntry) => describeWorkItemActivity(entry, formatCalendarDate);

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
  // 011-agent-access-mcp FR-004 (replaces the free-text stakeholder).
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(workItem.assigneeUserId);
  // 008-work-item-fields "Planning" fields, saved with the same Save button.
  const [priority, setPriority] = useState<WorkItemLevel | null>(workItem.priority);
  const [severity, setSeverity] = useState<WorkItemLevel | null>(workItem.severity);
  const [area, setArea] = useState(initialDetail.itemArea);
  const [iteration, setIteration] = useState(initialDetail.itemIteration);
  const [startDate, setStartDate] = useState(workItem.startDate ?? "");
  const [targetDate, setTargetDate] = useState(workItem.targetDate ?? "");
  const [closing, setClosing] = useState(false);
  const today = useLocalToday();
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

  // After a router.refresh() (Save, Close, …) the server sends fresh detail
  // data: pick up the new activity entries right away (FR-020 of
  // 008-work-item-fields) — but only the activity, which the user can't edit,
  // so no unsaved field is ever overwritten.
  const [prevActivity, setPrevActivity] = useState(initialDetail.activity);
  if (initialDetail.activity !== prevActivity) {
    setPrevActivity(initialDetail.activity);
    setActivity(initialDetail.activity);
  }

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
    setAssigneeUserId(workItem.assigneeUserId);
    setPriority(workItem.priority);
    setSeverity(workItem.severity);
    setArea(initialDetail.itemArea);
    setIteration(initialDetail.itemIteration);
    setStartDate(workItem.startDate ?? "");
    setTargetDate(workItem.targetDate ?? "");
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
      // Only when it changed: an unchanged value must not re-notify or re-log (FR-013).
      ...(assigneeUserId !== workItem.assigneeUserId ? { assigneeUserId } : {}),
      tagNames: selectedTags,
      priority,
      severity,
      areaName: area,
      iterationName: iteration,
      startDate: startDate || null,
      targetDate: targetDate || null,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    router.refresh();
  }

  // FR-014 of 008-work-item-fields: the server moves the Work Item to the first
  // closing column. Then just refresh — no second Server Action chained from
  // the client (005 research.md § Hallazgo).
  async function handleClose() {
    setError(null);
    setClosing(true);
    const result = await closeWorkItem(workItem.id);
    setClosing(false);
    if (!result.ok) setError(result.error.message);
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
  // Closed ⇔ in a closing column (FR-012) — derived, never stored.
  const isClosed = initialDetail.stage.isClosing;
  const overdue = today !== null && isOverdue(workItem.targetDate, workItem.closedAt, today);
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
          <Label htmlFor="wi-assignee">Assignee</Label>
          <AssigneePicker
            id="wi-assignee"
            members={initialDetail.members}
            value={assigneeUserId}
            onChange={setAssigneeUserId}
            disabled={!canEdit}
            className={selectClassName}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagPicker catalog={catalogTags} selected={selectedTags} onChange={setSelectedTags} disabled={!canEdit} />
        </div>

        <fieldset className="space-y-3 rounded-md border border-border p-3" data-testid="planning-section">
          <legend className="px-1 text-sm font-medium">Planning</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wi-priority">Priority</Label>
              <select
                id="wi-priority"
                value={priority ?? ""}
                onChange={(e) => setPriority((e.target.value || null) as WorkItemLevel | null)}
                disabled={!canEdit}
                className={selectClassName}
              >
                <option value="">None</option>
                {WORK_ITEM_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-severity">Severity</Label>
              <select
                id="wi-severity"
                value={severity ?? ""}
                onChange={(e) => setSeverity((e.target.value || null) as WorkItemLevel | null)}
                disabled={!canEdit}
                className={selectClassName}
              >
                <option value="">None</option>
                {WORK_ITEM_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-area">Area</Label>
              <CatalogPicker
                id="wi-area"
                label="Area"
                catalog={initialDetail.catalogAreas}
                value={area}
                onChange={setArea}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-iteration">Iteration</Label>
              <CatalogPicker
                id="wi-iteration"
                label="Iteration"
                catalog={initialDetail.catalogIterations}
                value={iteration}
                onChange={setIteration}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-start-date">Start date</Label>
              <Input
                id="wi-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-target-date">
                Target date
                {overdue && (
                  <span className="ml-2 text-xs font-medium text-destructive" data-testid="detail-overdue">
                    Overdue
                  </span>
                )}
              </Label>
              <Input
                id="wi-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                readOnly={!canEdit}
                disabled={!canEdit}
              />
            </div>
          </div>
        </fieldset>

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

        {/* FR-008/FR-014 of 008-work-item-fields: system-managed, never editable. */}
        <div className="space-y-2" data-testid="dates-section">
          <Label>Dates</Label>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Created</dt>
            <dd>
              <LocalDate value={workItem.createdAt} />
            </dd>
            <dt className="text-muted-foreground">Last modified</dt>
            <dd>
              <LocalDate value={workItem.updatedAt} />
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd data-testid="work-item-status">
              {isClosed && workItem.closedAt ? (
                <>
                  Closed on <LocalDate value={workItem.closedAt} /> · {initialDetail.stage.name}
                </>
              ) : (
                "Open"
              )}
            </dd>
          </dl>
          {canEdit && !isClosed && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={!initialDetail.hasClosingStage || closing}
                aria-describedby={initialDetail.hasClosingStage ? undefined : "wi-close-hint"}
              >
                {closing ? "Closing..." : "Close"}
              </Button>
              {!initialDetail.hasClosingStage && (
                <p id="wi-close-hint" className="text-muted-foreground text-xs">
                  Mark a column as a closing column on the board to enable Close.
                </p>
              )}
            </div>
          )}
        </div>

        {activity.length > 0 && (
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <ul className="text-muted-foreground max-h-40 space-y-1 overflow-y-auto text-xs">
              {activity.map((entry) => (
                <li key={entry.id}>
                  {describeActivity(entry)}
                  {entry.actorName && (
                    <span className="text-muted-foreground/80">
                      {" "}
                      — by {entry.actorName}
                      {entry.agentName && ` via ${entry.agentName}`}
                    </span>
                  )}
                </li>
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

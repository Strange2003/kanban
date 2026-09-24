"use client";

import { useEffect, useRef, useState } from "react";
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
import { LocalDate } from "@/components/ui/local-date";
import { useToast } from "@/components/ui/toast";
import { formatCalendarDate, useLocalToday } from "@/lib/dates";
import { LEVEL_LABELS, WORK_ITEM_LEVELS, isOverdue, type WorkItemLevel } from "@/lib/work-item-fields";

type ActivityEntry = { id: number; type: string; payload: unknown; createdAt: Date };

// 008-work-item-fields (FR-020): these fields are shown with their previous
// and new value; the older ones keep the "Edited …" summary.
const FIELD_LABELS: Record<string, string> = {
  priority: "Priority",
  severity: "Severity",
  area: "Area",
  iteration: "Iteration",
  startDate: "Start date",
  targetDate: "Target date",
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "None";
  if (field === "priority" || field === "severity") return LEVEL_LABELS[value as WorkItemLevel] ?? String(value);
  if (field === "startDate" || field === "targetDate") return formatCalendarDate(String(value));
  return String(value);
}

function describeActivity(entry: ActivityEntry): string {
  if (entry.type === "stage_changed") return "Moved to a different column";
  if (entry.type === "fields_edited") {
    const payload = entry.payload as { fields?: Record<string, { from: unknown; to: unknown }> };
    const fields = payload.fields ?? {};
    const legacy = Object.keys(fields).filter((f) => !(f in FIELD_LABELS));
    const parts = [
      ...(legacy.length > 0 ? [`Edited ${legacy.join(", ")}`] : []),
      ...Object.entries(fields)
        .filter(([f]) => f in FIELD_LABELS)
        .map(([f, c]) => `${FIELD_LABELS[f]}: ${formatFieldValue(f, c.from)} → ${formatFieldValue(f, c.to)}`),
    ];
    return parts.length > 0 ? parts.join("; ") : "Edited";
  }
  if (entry.type === "closed") {
    const { stageName, via } = entry.payload as { stageName: string; via: string };
    if (via === "stage_marked") return `Closed: column ${stageName} marked as closing`;
    if (via === "created") return `Closed (created in ${stageName})`;
    return `Closed (moved to ${stageName})`;
  }
  if (entry.type === "reopened") {
    const { stageName, via } = entry.payload as { stageName: string; via: string };
    if (via === "stage_unmarked") return `Reopened: column ${stageName} unmarked as closing`;
    return `Reopened (moved to ${stageName})`;
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
  const { toast } = useToast();
  // 007-roles-permissions: derived from the role the server just read, so a
  // router.refresh() after a rejected action flips this screen to read-only.
  // The Server Actions enforce the same permissions; this only reflects them.
  const canEdit = can(initialDetail.role, "workItem:edit");
  const canEditRelations = can(initialDetail.role, "relationship:edit");
  const [title, setTitle] = useState(workItem.title);
  const [description, setDescription] = useState(workItem.description ?? "");
  const [stakeholder, setStakeholder] = useState(workItem.stakeholder ?? "");
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
  const [savedFields, setSavedFields] = useState(() => ({
    title: workItem.title,
    description: workItem.description ?? "",
    stakeholder: workItem.stakeholder ?? "",
    tags: initialDetail.itemTags,
    priority: workItem.priority,
    severity: workItem.severity,
    area: initialDetail.itemArea,
    iteration: initialDetail.itemIteration,
    startDate: workItem.startDate ?? "",
    targetDate: workItem.targetDate ?? "",
  }));
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
  const restoringHistory = useRef(false);
  const currentFields = {
    title,
    description,
    stakeholder,
    tags: selectedTags,
    priority,
    severity,
    area,
    iteration,
    startDate,
    targetDate,
  };
  const hasUnsavedChanges =
    canEdit && JSON.stringify(currentFields) !== JSON.stringify(savedFields);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const message = "You have unsaved changes. Leave this Work Item?";
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function onLinkClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (window.confirm(message))
        router.push(destination.pathname + destination.search + destination.hash);
    }
    function onPopState() {
      if (restoringHistory.current) {
        restoringHistory.current = false;
        return;
      }
      if (!window.confirm(message)) {
        restoringHistory.current = true;
        window.history.forward();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [hasUnsavedChanges, router]);


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
    setStakeholder(workItem.stakeholder ?? "");
    setPriority(workItem.priority);
    setSeverity(workItem.severity);
    setArea(initialDetail.itemArea);
    setIteration(initialDetail.itemIteration);
    setStartDate(workItem.startDate ?? "");
    setTargetDate(workItem.targetDate ?? "");
    setSelectedTags(initialDetail.itemTags);
    setSavedFields({
      title: workItem.title,
      description: workItem.description ?? "",
      stakeholder: workItem.stakeholder ?? "",
      tags: initialDetail.itemTags,
      priority: workItem.priority,
      severity: workItem.severity,
      area: initialDetail.itemArea,
      iteration: initialDetail.itemIteration,
      startDate: workItem.startDate ?? "",
      targetDate: workItem.targetDate ?? "",
    });
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
    const submittedFields = currentFields;
    setError(null);
    setSubmitting(true);
    const result = await updateWorkItem({
      workItemId: workItem.id,
      title,
      description,
      stakeholder,
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
    setSavedFields(submittedFields);
    toast("Work Item saved.");
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
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-0 sm:p-6 sm:pb-0">
      <Link
        href={`/projects/${projectPublicId}`}
        className="text-muted-foreground rounded text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        ← Back to board
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{workItem.displayId}</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{initialDetail.stage.name}</span>
        {hasUnsavedChanges && <span className="text-xs font-medium text-amber-500" role="status">Unsaved changes</span>}
      </div>

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

        <fieldset className="space-y-3 rounded-md border border-border p-3" data-testid="planning-section">
          <legend className="px-1 text-sm font-medium">Planning</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
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
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
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
                <li key={entry.id}>{describeActivity(entry)}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {canEdit && (
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
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
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground" role="status">{hasUnsavedChanges ? "Not saved yet" : "All changes saved"}</span>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </form>
      </div>
    </main>
  );
}

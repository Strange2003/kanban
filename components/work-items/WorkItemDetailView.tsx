"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock3, History, MessageSquare, Link2 } from "lucide-react";
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
import { isRolePermissionError } from "@/lib/errors";
import { can } from "@/lib/roles";
import { CatalogPicker } from "@/components/work-items/CatalogPicker";
import { AssigneePicker } from "@/components/work-items/AssigneePicker";
import { Avatar } from "@/components/ui/avatar";
import { LocalDate } from "@/components/ui/local-date";
import { useToast } from "@/components/ui/toast";
import { formatCalendarDate, useLocalToday } from "@/lib/dates";
import { LEVEL_LABELS, WORK_ITEM_LEVELS, isOverdue, type WorkItemLevel } from "@/lib/work-item-fields";
import { describeWorkItemActivity, type WorkItemActivityEntryView } from "@/lib/work-item-activity";
import {
  addWorkItemComment,
  addWorkItemTimeEntry,
  removeWorkItemTimeEntry,
  type WorkItemCommentView,
  type WorkItemTimeEntryView,
} from "@/lib/actions/work-item-discussion";
import { formatMinutes, hoursToMinutes, minutesToHoursInput } from "@/lib/work-item-time";

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
  const { toast } = useToast();
  // 007-roles-permissions: derived from the role the server just read, so a
  // router.refresh() after a rejected action flips this screen to read-only.
  // The Server Actions enforce the same permissions; this only reflects them.
  const canEdit = can(initialDetail.role, "workItem:edit");
  const canComment = can(initialDetail.role, "workItem:comment");
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
  const [estimateHours, setEstimateHours] = useState(minutesToHoursInput(workItem.estimateMinutes));
  const [closing, setClosing] = useState(false);
  const today = useLocalToday();
  const [selectedTags, setSelectedTags] = useState(initialDetail.itemTags);
  const [savedFields, setSavedFields] = useState(() => ({
    title: workItem.title,
    description: workItem.description ?? "",
    assigneeUserId: workItem.assigneeUserId,
    tags: initialDetail.itemTags,
    priority: workItem.priority,
    severity: workItem.severity,
    area: initialDetail.itemArea,
    iteration: initialDetail.itemIteration,
    startDate: workItem.startDate ?? "",
    targetDate: workItem.targetDate ?? "",
    estimateHours: minutesToHoursInput(workItem.estimateMinutes),
  }));
  const [catalogTags, setCatalogTags] = useState(initialDetail.catalogTags);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialDetail.activity);
  const [comments, setComments] = useState<WorkItemCommentView[]>(initialDetail.discussion.comments);
  const [timeEntries, setTimeEntries] = useState<WorkItemTimeEntryView[]>(initialDetail.discussion.timeEntries);
  const [commentDraft, setCommentDraft] = useState("");
  const [timeHoursDraft, setTimeHoursDraft] = useState("");
  const [timeNoteDraft, setTimeNoteDraft] = useState("");
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [loggingTime, setLoggingTime] = useState(false);
  const [removingTimeId, setRemovingTimeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
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
    assigneeUserId,
    tags: selectedTags,
    priority,
    severity,
    area,
    iteration,
    startDate,
    targetDate,
    estimateHours,
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
  const [prevDiscussion, setPrevDiscussion] = useState(initialDetail.discussion);
  if (initialDetail.discussion !== prevDiscussion) {
    setPrevDiscussion(initialDetail.discussion);
    setComments(initialDetail.discussion.comments);
    setTimeEntries(initialDetail.discussion.timeEntries);
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
    setEstimateHours(minutesToHoursInput(workItem.estimateMinutes));
    setSelectedTags(initialDetail.itemTags);
    setSavedFields({
      title: workItem.title,
      description: workItem.description ?? "",
      assigneeUserId: workItem.assigneeUserId,
      tags: initialDetail.itemTags,
      priority: workItem.priority,
      severity: workItem.severity,
      area: initialDetail.itemArea,
      iteration: initialDetail.itemIteration,
      startDate: workItem.startDate ?? "",
      targetDate: workItem.targetDate ?? "",
      estimateHours: minutesToHoursInput(workItem.estimateMinutes),
    });
    setCatalogTags(initialDetail.catalogTags);
    setActivity(initialDetail.activity);
    setComments(initialDetail.discussion.comments);
    setTimeEntries(initialDetail.discussion.timeEntries);
    setCommentDraft("");
    setTimeHoursDraft("");
    setTimeNoteDraft("");
    setDiscussionError(null);
    setTimeError(null);
    setActiveTab("details");
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
    const estimateMinutes = estimateHours.trim() === "" ? null : hoursToMinutes(estimateHours, true);
    if (estimateHours.trim() !== "" && estimateMinutes === null) {
      setError("Enter an estimate between 0 and 10,000 hours.");
      return;
    }
    const submittedFields = currentFields;
    setError(null);
    setSubmitting(true);
    const result = await updateWorkItem({
      workItemId: workItem.id,
      title,
      description,
      // Only when it changed: an unchanged value must not re-notify or re-log (FR-013).
      ...(assigneeUserId !== savedFields.assigneeUserId ? { assigneeUserId } : {}),
      tagNames: selectedTags,
      priority,
      severity,
      areaName: area,
      iterationName: iteration,
      startDate: startDate || null,
      targetDate: targetDate || null,
      estimateMinutes,
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

  async function handlePostComment() {
    if (!commentDraft.trim() || postingComment) return;
    setDiscussionError(null);
    setPostingComment(true);
    const result = await addWorkItemComment({ workItemId: workItem.id, body: commentDraft });
    setPostingComment(false);
    if (!result.ok) {
      setDiscussionError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setComments((items) => [...items, result.data]);
    setCommentDraft("");
    toast("Comment posted.");
  }

  async function handleLogTime() {
    if (loggingTime) return;
    const minutes = hoursToMinutes(timeHoursDraft);
    if (minutes === null) {
      setTimeError("Enter a positive duration, up to 10,000 hours.");
      return;
    }
    setTimeError(null);
    setLoggingTime(true);
    const result = await addWorkItemTimeEntry({ workItemId: workItem.id, minutes, note: timeNoteDraft });
    setLoggingTime(false);
    if (!result.ok) {
      setTimeError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setTimeEntries((items) => [...items, result.data]);
    setTimeHoursDraft("");
    setTimeNoteDraft("");
    toast("Time logged.");
  }

  async function handleRemoveTime(publicId: string) {
    setTimeError(null);
    setRemovingTimeId(publicId);
    const result = await removeWorkItemTimeEntry(publicId);
    setRemovingTimeId(null);
    if (!result.ok) {
      setTimeError(result.error.message);
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    setTimeEntries((items) => items.filter((item) => item.publicId !== publicId));
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
  const spentMinutes = timeEntries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background">
      <form onSubmit={handleSave} noValidate>
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pt-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link
              href={"/projects/" + projectPublicId}
              className="text-muted-foreground rounded text-sm hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              ← Back to board
            </Link>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <h1 className="font-semibold text-violet-300">{workItem.displayId}</h1>
                  <span className={isClosed ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300" : "rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-300"}>
                    {isClosed ? "Closed" : "Open"}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{initialDetail.stage.name}</span>
                </div>
                <Label htmlFor="wi-title" className="sr-only">Title</Label>
                <Input
                  id="wi-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  readOnly={!canEdit}
                  className="h-auto w-full min-w-0 border-0 bg-transparent px-0 py-0 text-xl font-semibold shadow-none focus-visible:ring-0 sm:text-2xl"
                />
                <p className="text-xs text-muted-foreground">
                  Created <LocalDate value={workItem.createdAt} /> · Updated <LocalDate value={workItem.updatedAt} />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && !isClosed && (
                  <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={!initialDetail.hasClosingStage || closing}>
                    {closing ? "Closing..." : "Close"}
                  </Button>
                )}
                {canEdit && (
                  <Button type="submit" size="sm" disabled={submitting} className="bg-violet-600 text-white hover:bg-violet-500">
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </div>
            {!canEdit && <p className="mt-3 text-xs text-muted-foreground" role="status">Work Item fields are read-only for your role. You can still join the discussion.</p>}
            {!initialDetail.hasClosingStage && canEdit && !isClosed && (
              <p className="mt-2 text-xs text-muted-foreground">Mark a column as a closing column on the board to enable Close.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Work Item sections" className="flex gap-1">
                <button
                  type="button"
                  role="tab"
                  id="wi-details-tab"
                  aria-controls="wi-details-panel"
                  aria-selected={activeTab === "details"}
                  onClick={() => setActiveTab("details")}
                  className={activeTab === "details" ? "border-b-2 border-violet-400 px-3 py-2 text-sm font-medium text-foreground" : "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}
                >
                  Details
                </button>
                <button
                  type="button"
                  role="tab"
                  id="wi-history-tab"
                  aria-controls="wi-history-panel"
                  aria-selected={activeTab === "history"}
                  onClick={() => setActiveTab("history")}
                  className={activeTab === "history" ? "border-b-2 border-violet-400 px-3 py-2 text-sm font-medium text-foreground" : "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}
                >
                  History
                </button>
              </div>
              <span className="pb-2 text-xs text-muted-foreground" role="status">
                {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
              </span>
            </div>
            {error && <p className="pb-3 text-sm text-destructive" role="alert">{error}</p>}
          </div>
        </header>

        {activeTab === "details" ? (
          <div id="wi-details-panel" role="tabpanel" aria-labelledby="wi-details-tab" className="mx-auto grid w-full max-w-7xl gap-5 p-4 pb-10 sm:p-6 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-8 lg:px-8">
            <aside className="order-2 min-w-0 space-y-4 lg:order-1" aria-label="Work Item details">
              <section className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
                <h2 className="text-sm font-semibold">People and labels</h2>
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
              </section>

              <fieldset className="space-y-4 rounded-xl border border-border bg-card/70 p-4" data-testid="planning-section">
                <legend className="sr-only">Planning</legend>
                <h2 className="text-sm font-semibold">Planning</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-priority">Priority</Label>
                  <select id="wi-priority" value={priority ?? ""} onChange={(event) => setPriority((event.target.value || null) as WorkItemLevel | null)} disabled={!canEdit} className={selectClassName}>
                    <option value="">None</option>
                    {WORK_ITEM_LEVELS.map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-severity">Severity</Label>
                  <select id="wi-severity" value={severity ?? ""} onChange={(event) => setSeverity((event.target.value || null) as WorkItemLevel | null)} disabled={!canEdit} className={selectClassName}>
                    <option value="">None</option>
                    {WORK_ITEM_LEVELS.map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-area">Area</Label>
                  <CatalogPicker id="wi-area" label="Area" catalog={initialDetail.catalogAreas} value={area} onChange={setArea} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-iteration">Iteration</Label>
                  <CatalogPicker id="wi-iteration" label="Iteration" catalog={initialDetail.catalogIterations} value={iteration} onChange={setIteration} disabled={!canEdit} />
                </div>
              </fieldset>

              <section className="space-y-4 rounded-xl border border-border bg-card/70 p-4" data-testid="dates-section">
                <h2 className="text-sm font-semibold">Dates</h2>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-start-date">Start date</Label>
                  <Input id="wi-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-target-date">Target date</Label>
                  <Input id="wi-target-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} disabled={!canEdit} />
                  {overdue && <p className="text-xs font-medium text-destructive" data-testid="detail-overdue">Overdue</p>}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
                  <dt className="text-muted-foreground">Created</dt><dd><LocalDate value={workItem.createdAt} /></dd>
                  <dt className="text-muted-foreground">Last modified</dt><dd><LocalDate value={workItem.updatedAt} /></dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd data-testid="work-item-status">
                    {isClosed && workItem.closedAt ? <>Closed on <LocalDate value={workItem.closedAt} /> · {initialDetail.stage.name}</> : "Open"}
                  </dd>
                </dl>
              </section>

              <section className="space-y-4 rounded-xl border border-border bg-card/70 p-4" aria-label="Time tracking">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-violet-300" aria-hidden />
                  <h2 className="text-sm font-semibold">Time tracking</h2>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wi-estimate">Estimate (hours)</Label>
                  <Input id="wi-estimate" type="number" min="0" max="10000" step="0.25" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} disabled={!canEdit} placeholder="No estimate" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-violet-500/10 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Time spent</span>
                  <strong>{formatMinutes(spentMinutes)}</strong>
                </div>
                {timeEntries.length > 0 && (
                  <ul className="space-y-2 border-t border-border pt-3">
                    {timeEntries.map((entry) => (
                      <li key={entry.publicId} className="flex items-start gap-2 text-xs">
                        <Avatar name={entry.authorName} image={entry.authorImage} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p><span className="font-semibold">{formatMinutes(entry.minutes)}</span> · {entry.authorName}</p>
                          <p className="text-muted-foreground"><LocalDate value={entry.createdAt} /></p>
                          {entry.note && <p className="mt-1 whitespace-pre-wrap break-words">{entry.note}</p>}
                        </div>
                        {canEdit && entry.authorUserId === initialDetail.discussion.currentUserId && (
                          <button type="button" onClick={() => handleRemoveTime(entry.publicId)} disabled={removingTimeId === entry.publicId} className="text-muted-foreground hover:text-destructive" aria-label={"Remove time entry " + entry.publicId}>Remove</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Label htmlFor="wi-time-hours">Log time (hours)</Label>
                    <Input id="wi-time-hours" type="number" min="0.01" max="10000" step="0.25" value={timeHoursDraft} onChange={(event) => setTimeHoursDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleLogTime(); } }} placeholder="e.g. 1.5" />
                    <Label htmlFor="wi-time-note" className="sr-only">Time note</Label>
                    <Input id="wi-time-note" value={timeNoteDraft} onChange={(event) => setTimeNoteDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleLogTime(); } }} maxLength={500} placeholder="Note (optional)" />
                    {timeError && <p className="text-xs text-destructive" role="alert">{timeError}</p>}
                    <Button type="button" variant="outline" size="sm" onClick={handleLogTime} disabled={loggingTime || !timeHoursDraft.trim()} className="w-full">
                      {loggingTime ? "Logging..." : "Add time"}
                    </Button>
                  </div>
                )}
              </section>

              {canEdit && (
                <section className="rounded-xl border border-border bg-card/70 p-4">
                  {confirmingDelete ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Delete this Work Item?</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Confirm"}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)} className="text-destructive">Delete</Button>
                  )}
                </section>
              )}
            </aside>

            <div className="order-1 min-w-0 space-y-5 lg:order-2">
              <section className="rounded-xl border border-border bg-card/70 p-5 sm:p-6">
                <h2 className="mb-4 text-base font-semibold">Description</h2>
                <Label htmlFor="wi-description" className="sr-only">Description</Label>
                <textarea
                  id="wi-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={7}
                  readOnly={!canEdit}
                  placeholder={canEdit ? "Describe the work to be done..." : "No description yet."}
                  className="min-h-40 w-full resize-y rounded-lg border border-input bg-background/70 px-4 py-3 text-sm leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
                />
              </section>

              <section className="rounded-xl border border-border bg-card/70 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-300" aria-hidden />
                  <h2 className="text-base font-semibold">Related work</h2>
                </div>
                {hasNoRelations ? <p className="text-sm text-muted-foreground">No relations yet.</p> : (
                  <div className="space-y-4 text-sm">
                    {parent && (
                      <div className="flex items-center justify-between gap-2">
                        <div><p className="text-xs text-muted-foreground">Parent</p><Link href={relationHref(projectPublicId, parent)} className="hover:underline" aria-label={"Go to parent " + parent.displayId + " " + parent.title}>{parent.displayId} {parent.title}</Link></div>
                        {canEditRelations && <Button type="button" variant="ghost" size="sm" onClick={handleRemoveParent} disabled={relationsBusy} aria-label={"Remove parent " + parent.displayId}>Remove</Button>}
                      </div>
                    )}
                    {children.length > 0 && (
                      <div><p className="mb-1 text-xs text-muted-foreground">Children ({children.length})</p><ul className="space-y-1">{children.map((child) => <li key={child.id}><Link href={relationHref(projectPublicId, child)} className="hover:underline" aria-label={"Go to child " + child.displayId + " " + child.title}>{child.displayId} {child.title}</Link></li>)}</ul></div>
                    )}
                    {related.length > 0 && (
                      <div><p className="mb-1 text-xs text-muted-foreground">Related ({related.length})</p><ul className="space-y-1">{related.map((item) => <li key={item.id} className="flex items-center justify-between gap-2"><Link href={relationHref(projectPublicId, item)} className="hover:underline" aria-label={"Go to related " + item.displayId + " " + item.title}>{item.displayId} {item.title}</Link>{canEditRelations && <Button type="button" variant="ghost" size="sm" onClick={() => handleUnlinkRelated(item.id)} disabled={relationsBusy} aria-label={"Remove related " + item.displayId}>Remove</Button>}</li>)}</ul></div>
                    )}
                  </div>
                )}
                {canEditRelations && pickableWorkItems.length > 0 && (
                  <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                    {!parent && <div className="flex min-w-0 gap-2"><select aria-label="Convert into a child of" value={parentPick} onChange={(event) => setParentPick(event.target.value)} className={selectClassName}><option value="">Convert into a child of...</option>{pickableWorkItems.map((item) => <option key={item.id} value={item.id}>{item.displayId} {item.title}</option>)}</select><Button type="button" size="sm" onClick={handleSetParent} disabled={!parentPick || relationsBusy}>Set</Button></div>}
                    <div className="flex min-w-0 gap-2"><select aria-label="Relate to" value={relatedPick} onChange={(event) => setRelatedPick(event.target.value)} className={selectClassName}><option value="">Relate to...</option>{pickableWorkItems.map((item) => <option key={item.id} value={item.id}>{item.displayId} {item.title}</option>)}</select><Button type="button" size="sm" onClick={handleLinkRelated} disabled={!relatedPick || relationsBusy}>Link</Button></div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card/70 p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-300" aria-hidden />
                  <h2 className="text-base font-semibold">Discussion</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{comments.length}</span>
                </div>
                {comments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No comments yet. Start the conversation below.</p>
                ) : (
                  <ol className="space-y-4">
                    {comments.map((comment) => (
                      <li key={comment.publicId} className="flex items-start gap-3">
                        <Avatar name={comment.authorName} image={comment.authorImage} />
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-x-2 text-sm"><strong>{comment.authorName}</strong><span className="text-xs text-muted-foreground"><LocalDate value={comment.createdAt} /></span></div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {canComment && (
                  <div className="mt-5 space-y-2 border-t border-border pt-5">
                    <Label htmlFor="wi-comment">Add a comment</Label>
                    <textarea id="wi-comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={10000} rows={4} placeholder="Write a comment..." className="w-full resize-y rounded-lg border border-input bg-background/70 px-4 py-3 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{commentDraft.length}/10,000</span>
                      <Button type="button" onClick={handlePostComment} disabled={postingComment || !commentDraft.trim()} className="bg-violet-600 text-white hover:bg-violet-500">{postingComment ? "Posting..." : "Comment"}</Button>
                    </div>
                    {discussionError && <p className="text-sm text-destructive" role="alert">{discussionError}</p>}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <section id="wi-history-panel" role="tabpanel" aria-labelledby="wi-history-tab" className="mx-auto w-full max-w-5xl p-4 pb-12 sm:p-6 lg:p-8">
            <div className="rounded-xl border border-border bg-card/70 p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <History className="h-4 w-4 text-violet-300" aria-hidden />
                <h2 className="text-base font-semibold">History</h2>
              </div>
              {activity.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : (
                <ol className="divide-y divide-border">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3 py-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p>{describeActivity(entry)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.actorName ?? "System"}{entry.agentName && " via " + entry.agentName} · <LocalDate value={entry.createdAt} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}
      </form>
    </main>
  );
}

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { cn } from "@/lib/utils";
import { useLocalToday } from "@/lib/dates";
import { LEVEL_LABELS, isOverdue } from "@/lib/work-item-fields";
import { PriorityBadge } from "@/components/board/PriorityBadge";
import { TargetDateChip } from "@/components/board/TargetDateChip";

export function WorkItemCard({
  workItem,
  projectPublicId,
  canEdit,
  stages,
  onMove,
  onReorder,
  canMoveUp,
  canMoveDown,
}: {
  workItem: WorkItemWithDisplayId;
  projectPublicId: string;
  // False for a Viewer (007-roles-permissions): the card stays clickable — they
  // can still open the detail view — but can't be dragged.
  canEdit: boolean;
  stages: { id: number; name: string }[];
  onMove: (workItemId: number, stageId: number) => void;
  onReorder: (workItemId: number, stageId: number, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  // Sortable (not just draggable) so it participates in both cross-column
  // moves (FR-005 of 004) and within-column reordering (FR-006 of 004) via
  // the same drag gesture.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `work-item:${workItem.id}`,
    data: { type: "work-item", workItemId: workItem.id, stageId: workItem.stageId },
    disabled: !canEdit,
  });
  // 008-work-item-fields (SC-002): screen readers hear the priority and the
  // overdue state that sighted users see on the card.
  const today = useLocalToday();
  const overdue =
    today !== null && isOverdue(workItem.targetDate, workItem.closedAt, today);
  const ariaLabel = [
    `${workItem.displayId}: ${workItem.title}`,
    workItem.priority && `priority ${LEVEL_LABELS[workItem.priority]}`,
    overdue && "overdue",
  ]
    .filter(Boolean)
    .join(", ");
  const openDetail = () =>
    router.push(`/projects/${projectPublicId}/work-items/${workItem.displayNumber}`);
  const detailHref = `/projects/${projectPublicId}/work-items/${workItem.displayNumber}`;

  // The card follows the pointer while dragged, so releasing it fires a click on
  // the card itself — without this, every drag would also open the detail view.
  // A pointer that travelled at least the sensor's activation distance
  // (`distance: 8` in Board.tsx) was a drag, not a click.
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);
  const handleClickCapture = (e: React.MouseEvent) => {
    const start = pointerDownAt.current;
    pointerDownAt.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 8) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={setNodeRef}
      onPointerDown={canEdit ? (event) => listeners?.onPointerDown?.(event) : undefined}
      // FR-002 of 006-work-item-detail-view: navigates to the dedicated
      // detail view instead of opening a modal — the `distance: 8` pointer
      // activation constraint on the sortable's sensor (Board.tsx) keeps a
      // plain click from being swallowed by a drag gesture, and handleClickCapture
      // keeps a drag from turning into a click.
      onPointerDownCapture={(e) => {
        pointerDownAt.current = { x: e.clientX, y: e.clientY };
      }}
      onClickCapture={handleClickCapture}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a, button, select")) openDetail();
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        "rounded-md border border-border bg-background p-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        canEdit
          ? "cursor-grab touch-auto active:cursor-grabbing md:touch-none"
          : "cursor-pointer",
      )}
      data-testid="work-item-card"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-muted-foreground text-xs">{workItem.displayId}</span>
        {canEdit && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={(event) => listeners?.onKeyDown?.(event)}
            aria-label={`Reorder ${workItem.displayId}. Press Space, then use arrow keys.`}
            className="touch-none rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title="Drag Work Item or use Space and arrow keys"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      <p className="font-medium">
        <Link
          href={detailHref}
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
          className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {workItem.title}
        </Link>
      </p>
      {/* FR-016 of 008: only priority and target date on the card — the rest lives in the detail view. */}
      {(workItem.priority || workItem.targetDate) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {workItem.priority && <PriorityBadge level={workItem.priority} />}
          {workItem.targetDate && (
            <TargetDateChip
              targetDate={workItem.targetDate}
              closedAt={workItem.closedAt}
            />
          )}
        </div>
      )}
      {canEdit && (stages.length > 1 || canMoveUp || canMoveDown) && (
        <div
          className="mt-2 flex items-center gap-1 border-t border-border pt-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {stages.length > 1 && (
            <select
              aria-label={`Move ${workItem.displayId} to column`}
              value={workItem.stageId}
              onChange={(e) => onMove(workItem.id, Number(e.target.value))}
              className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          )}
          {canMoveUp && (
            <button
              type="button"
              onClick={() => onReorder(workItem.id, workItem.stageId, -1)}
              aria-label={`Move ${workItem.displayId} up`}
              className="rounded p-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          {canMoveDown && (
            <button
              type="button"
              onClick={() => onReorder(workItem.id, workItem.stageId, 1)}
              aria-label={`Move ${workItem.displayId} down`}
              className="rounded p-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

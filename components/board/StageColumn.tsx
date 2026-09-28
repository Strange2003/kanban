"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { renameStage, type StageWithCount } from "@/lib/actions/board";
import type { BoardWorkItem } from "@/lib/actions/board";
import { WorkItemCard } from "@/components/board/WorkItemCard";
import { AddWorkItemButton } from "@/components/board/AddWorkItemButton";
import { DeleteStageButton } from "@/components/board/DeleteStageButton";
import { ClosingStageToggle } from "@/components/board/ClosingStageToggle";
import { Input } from "@/components/ui/input";
import { isRolePermissionError } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

// FR-008 of 003-kanban-board: double-click the column name to rename it in place.
function StageName({
  projectPublicId,
  stage,
  canEdit,
}: {
  projectPublicId: string;
  stage: StageWithCount;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.name) {
      setName(stage.name);
      setEditing(false);
      return;
    }
    setSubmitting(true);
    const result = await renameStage({
      projectPublicId,
      stageId: stage.publicId,
      name: trimmed,
    });
    setSubmitting(false);
    if (!result.ok) {
      setName(stage.name);
      toast(result.error.message, "destructive");
      // Role changed under an open board (FR-004 of 007-roles-permissions).
      if (isRolePermissionError(result)) router.refresh();
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit}>
        <Input
          autoFocus
          aria-label={`Column name for ${stage.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setName(stage.name);
              setEditing(false);
            }
          }}
          disabled={submitting}
          className="h-7 px-2 py-1 text-sm"
        />
      </form>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <h3
        className="truncate text-sm font-medium"
        title={stage.name}
        onDoubleClick={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {stage.name}
      </h3>
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Rename column ${stage.name}`}
          title="Rename column"
        >
          <Pencil className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function StageColumn({
  projectPublicId,
  canEdit,
  stage,
  stages,
  workItems,
  onToggleClosing,
  onMoveWorkItem,
  onReorderWorkItem,
  totalCount = workItems.length,
  filtersActive = false,
  isHiddenByFilters,
  listenForNewShortcut = false,
}: {
  projectPublicId: string;
  // False for a Viewer (007-roles-permissions): no dragging, renaming,
  // deleting the column or adding Work Items — they can still open cards.
  canEdit: boolean;
  // KAN-11: the first column's "add Work Item" control answers the "n" shortcut.
  listenForNewShortcut?: boolean;
  stage: StageWithCount;
  stages: { id: number; name: string }[];
  workItems: BoardWorkItem[];
  // 008-work-item-fields (FR-011): Board owns the optimistic update.
  onToggleClosing: (stage: StageWithCount) => void;
  onMoveWorkItem: (workItemId: number, stageId: number) => void;
  onReorderWorkItem: (workItemId: number, stageId: number, direction: -1 | 1) => void;
  // 014-board-filters-mcp-catalogs: `workItems` are only the cards the board's
  // filters let through; `totalCount` is every Work Item in the column (FR-005, FR-006).
  totalCount?: number;
  filtersActive?: boolean;
  isHiddenByFilters?: (item: { assigneeUserId: null; tagNames: string[] }) => boolean;
}) {
  // One sortable registration per stage serves double duty: it's both the
  // reorder-columns drag source/target (FR-005 of 003) and the drop target
  // for a Work Item dragged in from another column (FR-005 of 004) — two
  // separate droppable registrations on the same rect would leave dnd-kit's
  // collision detection to guess which one `over` resolves to.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isOver,
    isDragging,
  } = useSortable({
    id: `stage:${stage.id}`,
    data: { type: "stage", stageId: stage.id },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex max-h-full min-h-0 w-72 shrink-0 snap-start flex-col rounded-lg border border-border bg-card transition-colors",
        isOver && "border-primary/50 bg-accent/40",
        isDragging && "opacity-50",
      )}
      data-testid="stage-column"
    >
      <div
        onPointerDown={canEdit ? (event) => listeners?.onPointerDown?.(event) : undefined}
        className={cn(
          "flex items-center justify-between rounded-t-lg px-3 py-2",
          canEdit && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <StageName projectPublicId={projectPublicId} stage={stage} canEdit={canEdit} />
          {/* FR-011 of 008: visible to every role, Viewers included. */}
          {stage.isClosing && (
            <span
              className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] leading-none font-medium text-emerald-700 dark:text-emerald-400"
              title="Closing column: Work Items here are closed"
              data-testid="closing-column-badge"
            >
              Closing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {filtersActive ? (
            <span
              className="text-muted-foreground text-xs"
              aria-label={`${workItems.length} of ${totalCount} Work Items shown`}
              data-testid="stage-count"
            >
              {workItems.length}/{totalCount}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs" data-testid="stage-count">
              {workItems.length}
            </span>
          )}
          {canEdit && (
            <ClosingStageToggle
              isClosing={stage.isClosing}
              onToggle={() => onToggleClosing(stage)}
            />
          )}
          {canEdit && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              onKeyDown={(event) => listeners?.onKeyDown?.(event)}
              aria-label={`Reorder column ${stage.name}. Press Space, then use arrow keys.`}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              title="Drag column or use Space and arrow keys"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {canEdit && (
            <DeleteStageButton
              projectPublicId={projectPublicId}
              stagePublicId={stage.publicId}
              hasWorkItems={totalCount > 0}
            />
          )}
        </div>
      </div>
      {/* The card list scrolls inside the column so a long column never spills
          past its container; the add button follows the last card, and stays
          pinned under the list once it overflows. */}
      <div className="flex min-h-0 flex-initial flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={workItems.map((wi) => `work-item:${wi.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {workItems.map((workItem, index) => (
            <WorkItemCard
              key={workItem.id}
              workItem={workItem}
              projectPublicId={projectPublicId}
              canEdit={canEdit}
              stages={stages}
              onMove={onMoveWorkItem}
              onReorder={onReorderWorkItem}
              canMoveUp={index > 0}
              canMoveDown={index < workItems.length - 1}
            />
          ))}
        </SortableContext>
        {stage.hiddenClosedCount > 0 && (
          // KAN-7: closed for more than 14 days — still in List, Table and search.
          <p className="text-muted-foreground px-1 py-1 text-center text-xs" data-testid="archived-hint">
            {stage.hiddenClosedCount} older {stage.hiddenClosedCount === 1 ? "item" : "items"} hidden ·{" "}
            <Link
              href={`/projects/${projectPublicId}/list?stage=${encodeURIComponent(stage.publicId)}`}
              className="rounded underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              view in List
            </Link>
          </p>
        )}
        {workItems.length === 0 && totalCount > 0 && (
          <p className="text-muted-foreground px-1 py-2 text-center text-xs" data-testid="hidden-by-filters">
            Hidden by filters
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-col px-2 pb-2">
          <AddWorkItemButton
            stagePublicId={stage.publicId}
            isHiddenByFilters={isHiddenByFilters}
            listenForNewShortcut={listenForNewShortcut}
          />
        </div>
      )}
    </div>
  );
}

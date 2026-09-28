"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { reorderStages, setStageClosing, type StageWithCount } from "@/lib/actions/board";
import { moveWorkItem, reorderWorkItemsInStage } from "@/lib/actions/work-items";
import type { BoardWorkItem } from "@/lib/actions/board";
import { StageColumn } from "@/components/board/StageColumn";
import { WorkItemCardPreview } from "@/components/board/WorkItemCard";
import { isRolePermissionError } from "@/lib/errors";
import { can, type ProjectRole } from "@/lib/roles";
import { AddStageButton } from "@/components/board/AddStageButton";
import { useToast } from "@/components/ui/toast";
import { nextClosedAt } from "@/lib/work-item-closing";
import { BoardFilters } from "@/components/board/BoardFilters";
import { useViewQuery } from "@/components/views/useViewQuery";
import { matchesAssigneeAndTags, serializeViewQuery, type WorkItemViewOptions } from "@/lib/work-item-view";
import { boardQueryStorageKey } from "@/lib/board-query-storage";

// The board has no column filter, so no column id is ever "valid" in its query.
const NO_STAGES: ReadonlySet<string> = new Set();

export function Board({
  projectPublicId,
  role,
  initialStages,
  initialWorkItems,
  currentUserId,
  members,
  tagCatalog,
}: {
  projectPublicId: string;
  role: ProjectRole;
  initialStages: StageWithCount[];
  initialWorkItems: BoardWorkItem[];
  // 014-board-filters-mcp-catalogs: the Assignee and Tags filters' options.
  currentUserId: string;
  members: WorkItemViewOptions["members"];
  tagCatalog: WorkItemViewOptions["tags"];
}) {
  const { toast } = useToast();
  const router = useRouter();
  // 007-roles-permissions: a Viewer sees the board but can't change it. The
  // Server Actions enforce this too — this only removes the controls.
  const canEdit = can(role, "board:edit");
  const [stagesState, setStagesState] = useState(initialStages);
  const [workItemsState, setWorkItemsState] = useState(initialWorkItems);
  // The Work Item being dragged, rendered in a DragOverlay: each column's card
  // list scrolls on its own, so the card itself would be clipped the moment it
  // left its column.
  const [draggedWorkItemId, setDraggedWorkItemId] = useState<number | null>(null);

  // `initialStages`/`initialWorkItems` are fresh arrays every time the server
  // component re-renders (e.g. router.refresh() after creating a column or
  // work item). Adjust local state during render (React's documented pattern
  // for this) so those additions show up without a full page reload.
  const [prevInitialStages, setPrevInitialStages] = useState(initialStages);
  if (initialStages !== prevInitialStages) {
    setPrevInitialStages(initialStages);
    setStagesState(initialStages);
  }
  const [prevInitialWorkItems, setPrevInitialWorkItems] = useState(initialWorkItems);
  if (initialWorkItems !== prevInitialWorkItems) {
    setPrevInitialWorkItems(initialWorkItems);
    setWorkItemsState(initialWorkItems);
  }

  // 014-board-filters-mcp-catalogs: the filters live in the address, like
  // List/Table's (FR-009), and only hide cards — every column stays (FR-005).
  const [query, setQuery] = useViewQuery("board", NO_STAGES);
  const filtersActive = query.assignees.length > 0 || query.tags.length > 0;
  const isVisible = (item: { assigneeUserId: string | null; tagNames: string[] }) =>
    matchesAssigneeAndTags(item, query, currentUserId);
  const visibleIds = useMemo(
    () =>
      new Set(
        workItemsState
          .filter((wi) =>
            matchesAssigneeAndTags(
              { assigneeUserId: wi.assignee?.userId ?? null, tagNames: wi.tags.map((t) => t.name) },
              query,
              currentUserId,
            ),
          )
          .map((wi) => wi.id),
      ),
    [workItemsState, query, currentUserId],
  );

  // Remember this tab's board filters so the detail view's "Back to board"
  // returns to them (research.md § Volver del detalle al tablero). Storage can
  // be unavailable (private mode, blocked site data): the link is then clean.
  const boardQueryString = serializeViewQuery(query, "board");
  useEffect(() => {
    try {
      const key = boardQueryStorageKey(projectPublicId);
      if (boardQueryString) window.sessionStorage.setItem(key, boardQueryString);
      else window.sessionStorage.removeItem(key);
    } catch {
      // Ignore: remembering the filters is only a convenience.
    }
  }, [projectPublicId, boardQueryString]);

  // A small activation distance lets a plain click (opening a Work Item's
  // detail panel, or a column's delete button) fire normally, while a real
  // drag still activates past the threshold.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // FR-005/FR-011 of 003-kanban-board, same optimistic + revert-on-failure
  // pattern as moving a Work Item below (Principle I of the constitution).
  async function handleStageReorder(activeId: string, overId: string) {
    const fromIndex = stagesState.findIndex((s) => `stage:${s.id}` === activeId);
    const toIndex = stagesState.findIndex((s) => `stage:${s.id}` === overId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const previous = stagesState;
    const reordered = arrayMove(stagesState, fromIndex, toIndex);
    setStagesState(reordered);

    const result = await reorderStages({
      projectPublicId,
      orderedStageIds: reordered.map((s) => s.publicId),
    });
    if (!result.ok) {
      setStagesState(previous);
      toast(result.error.message, "destructive");
      // Role changed under an open board: refresh so it flips to read-only (FR-004).
      if (isRolePermissionError(result)) router.refresh();
    }
  }

  // FR-005 of 004-work-items, with the same optimistic + revert-on-failure
  // pattern already clarified for column reordering (FR-011 of
  // 003-kanban-board) — Principle I of the constitution.
  async function handleWorkItemMove(workItemId: number, toStageId: number) {
    const current = workItemsState.find((wi) => wi.id === workItemId);
    if (!current || current.stageId === toStageId) return;

    const previous = workItemsState;
    // 008-work-item-fields: same closing rule the server applies (nextClosedAt),
    // so moving into/out of a closing column flips "overdue" instantly.
    const fromStage = stagesState.find((s) => s.id === current.stageId);
    const toStage = stagesState.find((s) => s.id === toStageId);
    // KAN-7: positions are contiguous over visible + hidden (archived) items, so
    // "the end" also counts the archived ones the board doesn't hold.
    const toPosition =
      workItemsState.filter((wi) => wi.stageId === toStageId).length + (toStage?.hiddenClosedCount ?? 0);
    const { closedAt } = nextClosedAt({
      fromIsClosing: fromStage?.isClosing ?? false,
      toIsClosing: toStage?.isClosing ?? false,
      currentClosedAt: current.closedAt,
      now: new Date(),
    });

    setWorkItemsState((items) =>
      items.map((wi) =>
        wi.id === workItemId
          ? { ...wi, stageId: toStageId, position: toPosition, closedAt }
          : wi,
      ),
    );

    const result = await moveWorkItem({ workItemId, toStageId, toPosition });
    if (!result.ok) {
      setWorkItemsState(previous);
      toast(result.error.message, "destructive");
      if (isRolePermissionError(result)) router.refresh();
    }
  }

  // FR-011/FR-013 of 008-work-item-fields: marking a column closes all of its
  // Work Items and unmarking reopens them — applied optimistically to both the
  // column and its cards, reverted on failure (Principle I).
  async function handleToggleClosing(stage: StageWithCount) {
    const isClosing = !stage.isClosing;
    const previousStages = stagesState;
    const previousItems = workItemsState;
    const now = new Date();

    setStagesState((all) =>
      all.map((s) => (s.id === stage.id ? { ...s, isClosing } : s)),
    );
    setWorkItemsState((items) =>
      items.map((wi) =>
        wi.stageId === stage.id ? { ...wi, closedAt: isClosing ? now : null } : wi,
      ),
    );

    const result = await setStageClosing({
      projectPublicId,
      stagePublicId: stage.publicId,
      isClosing,
    });
    if (!result.ok) {
      setStagesState(previousStages);
      setWorkItemsState(previousItems);
      toast(result.error.message, "destructive");
      if (isRolePermissionError(result)) router.refresh();
      return;
    }
    // Pick up the server's exact closing timestamps.
    router.refresh();
  }

  // FR-006 of 004-work-items, same optimistic + revert-on-failure pattern.
  async function handleWorkItemReorder(
    workItemId: number,
    overWorkItemId: number,
    stageId: number,
  ) {
    if (workItemId === overWorkItemId) return;

    const stageItems = workItemsState
      .filter((wi) => wi.stageId === stageId)
      .sort((a, b) => a.position - b.position);
    const fromIndex = stageItems.findIndex((wi) => wi.id === workItemId);
    const toIndex = stageItems.findIndex((wi) => wi.id === overWorkItemId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const reorderedIds = arrayMove(stageItems, fromIndex, toIndex).map((wi) => wi.id);
    const previous = workItemsState;

    setWorkItemsState((items) =>
      items.map((wi) =>
        wi.stageId === stageId ? { ...wi, position: reorderedIds.indexOf(wi.id) } : wi,
      ),
    );

    const result = await reorderWorkItemsInStage({
      stageId,
      orderedWorkItemIds: reorderedIds,
    });
    if (!result.ok) {
      setWorkItemsState(previous);
      toast(result.error.message, "destructive");
      if (isRolePermissionError(result)) router.refresh();
    }
  }

  // FR-013 of 014-board-filters-mcp-catalogs: step to the neighbouring VISIBLE
  // card — swapping with a hidden one would change nothing the user can see.
  // handleWorkItemReorder then moves it within the full column, so hidden
  // cards keep their relative order (FR-012).
  function reorderWorkItemByStep(workItemId: number, stageId: number, direction: -1 | 1) {
    const siblings = workItemsState
      .filter((wi) => wi.stageId === stageId && visibleIds.has(wi.id))
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((wi) => wi.id === workItemId);
    const target = siblings[index + direction];
    if (target) void handleWorkItemReorder(workItemId, target.id, stageId);
  }

  function handleDragStart(event: DragStartEvent) {
    const workItemId = event.active.data.current?.workItemId as number | undefined;
    setDraggedWorkItemId(workItemId ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedWorkItemId(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    if (active.data.current?.type === "stage") {
      void handleStageReorder(String(active.id), String(over.id));
      return;
    }

    const workItemId = active.data.current?.workItemId as number | undefined;
    if (workItemId == null) return;

    if (over.data.current?.type === "work-item") {
      const overWorkItemId = over.data.current?.workItemId as number;
      const overStageId = over.data.current?.stageId as number;
      const current = workItemsState.find((wi) => wi.id === workItemId);
      if (current?.stageId === overStageId) {
        void handleWorkItemReorder(workItemId, overWorkItemId, overStageId);
        return;
      }
      void handleWorkItemMove(workItemId, overStageId);
      return;
    }

    const toStageId = over.data.current?.stageId as number | undefined;
    if (toStageId == null) return;
    void handleWorkItemMove(workItemId, toStageId);
  }

  if (stagesState.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <h2 className="text-lg font-semibold">Build your board</h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Start with a column for the first step in your workflow."
              : "An editor can add the first column to this board."}
          </p>
          {canEdit && <AddStageButton projectPublicId={projectPublicId} />}
        </div>
      </div>
    );
  }

  const draggedWorkItem =
    draggedWorkItemId === null
      ? undefined
      : workItemsState.find((wi) => wi.id === draggedWorkItemId);

  return (
    <DndContext
      id="board-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedWorkItemId(null)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <BoardFilters query={query} onChange={setQuery} members={members} tagCatalog={tagCatalog} />
        {filtersActive && visibleIds.size === 0 && (
          <p className="text-muted-foreground px-4 pt-2 text-sm" role="status" data-testid="board-no-matches">
            No Work Items match the filters.{" "}
            <button
              type="button"
              className="rounded underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => setQuery({ ...query, assignees: [], tags: [] })}
            >
              Clear filters
            </button>
          </p>
        )}
        {stagesState.length > 1 && (
          <p className="px-4 pt-2 text-xs text-muted-foreground md:hidden">
            Swipe sideways to see all {stagesState.length} columns.
          </p>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overflow-y-hidden p-4 md:snap-none">
          <SortableContext
            items={stagesState.map((s) => `stage:${s.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {stagesState.map((stage) => (
              <StageColumn
                key={stage.id}
                projectPublicId={projectPublicId}
                canEdit={canEdit}
                stage={stage}
                stages={stagesState.map((s) => ({ id: s.id, name: s.name }))}
                onToggleClosing={handleToggleClosing}
                onMoveWorkItem={(workItemId, stageId) =>
                  void handleWorkItemMove(workItemId, stageId)
                }
                onReorderWorkItem={reorderWorkItemByStep}
                workItems={workItemsState
                  .filter((wi) => wi.stageId === stage.id && visibleIds.has(wi.id))
                  .sort((a, b) => a.position - b.position)}
                totalCount={workItemsState.filter((wi) => wi.stageId === stage.id).length}
                filtersActive={filtersActive}
                isHiddenByFilters={filtersActive ? (item) => !isVisible(item) : undefined}
              />
            ))}
          </SortableContext>
          {canEdit && <AddStageButton projectPublicId={projectPublicId} />}
        </div>
      </div>
      {/* Empty while a column is dragged, so columns keep moving in place. */}
      <DragOverlay>
        {draggedWorkItem && <WorkItemCardPreview workItem={draggedWorkItem} />}
      </DragOverlay>
    </DndContext>
  );
}

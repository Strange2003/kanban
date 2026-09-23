"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { reorderStages, setStageClosing, type StageWithCount } from "@/lib/actions/board";
import { moveWorkItem, reorderWorkItemsInStage } from "@/lib/actions/work-items";
import type { BoardWorkItem } from "@/lib/actions/board";
import { StageColumn } from "@/components/board/StageColumn";
import { isRolePermissionError } from "@/lib/errors";
import { can, type ProjectRole } from "@/lib/roles";
import { AddStageButton } from "@/components/board/AddStageButton";
import { useToast } from "@/components/ui/toast";
import { nextClosedAt } from "@/lib/work-item-closing";

export function Board({
  projectPublicId,
  role,
  initialStages,
  initialWorkItems,
}: {
  projectPublicId: string;
  role: ProjectRole;
  initialStages: StageWithCount[];
  initialWorkItems: BoardWorkItem[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  // 007-roles-permissions: a Viewer sees the board but can't change it. The
  // Server Actions enforce this too — this only removes the controls.
  const canEdit = can(role, "board:edit");
  const [stagesState, setStagesState] = useState(initialStages);
  const [workItemsState, setWorkItemsState] = useState(initialWorkItems);

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

  // A small activation distance lets a plain click (opening a Work Item's
  // detail panel, or a column's delete button) fire normally, while a real
  // drag still activates past the threshold.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    const toPosition = workItemsState.filter((wi) => wi.stageId === toStageId).length;
    // 008-work-item-fields: same closing rule the server applies (nextClosedAt),
    // so moving into/out of a closing column flips "overdue" instantly.
    const fromStage = stagesState.find((s) => s.id === current.stageId);
    const toStage = stagesState.find((s) => s.id === toStageId);
    const { closedAt } = nextClosedAt({
      fromIsClosing: fromStage?.isClosing ?? false,
      toIsClosing: toStage?.isClosing ?? false,
      currentClosedAt: current.closedAt,
      now: new Date(),
    });

    setWorkItemsState((items) =>
      items.map((wi) => (wi.id === workItemId ? { ...wi, stageId: toStageId, position: toPosition, closedAt } : wi)),
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

    setStagesState((all) => all.map((s) => (s.id === stage.id ? { ...s, isClosing } : s)));
    setWorkItemsState((items) =>
      items.map((wi) => (wi.stageId === stage.id ? { ...wi, closedAt: isClosing ? now : null } : wi)),
    );

    const result = await setStageClosing({ projectPublicId, stagePublicId: stage.publicId, isClosing });
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
  async function handleWorkItemReorder(workItemId: number, overWorkItemId: number, stageId: number) {
    if (workItemId === overWorkItemId) return;

    const stageItems = workItemsState.filter((wi) => wi.stageId === stageId).sort((a, b) => a.position - b.position);
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

    const result = await reorderWorkItemsInStage({ stageId, orderedWorkItemIds: reorderedIds });
    if (!result.ok) {
      setWorkItemsState(previous);
      toast(result.error.message, "destructive");
      if (isRolePermissionError(result)) router.refresh();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
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

  return (
    <DndContext id="board-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          <SortableContext items={stagesState.map((s) => `stage:${s.id}`)} strategy={horizontalListSortingStrategy}>
            {stagesState.map((stage) => (
              <StageColumn
                key={stage.id}
                projectPublicId={projectPublicId}
                canEdit={canEdit}
                stage={stage}
                onToggleClosing={handleToggleClosing}
                workItems={workItemsState
                  .filter((wi) => wi.stageId === stage.id)
                  .sort((a, b) => a.position - b.position)}
              />
            ))}
          </SortableContext>
          {canEdit && <AddStageButton projectPublicId={projectPublicId} />}
        </div>
      </div>
    </DndContext>
  );
}

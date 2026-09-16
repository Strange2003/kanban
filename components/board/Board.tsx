"use client";

import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { reorderStages, type StageWithCount } from "@/lib/actions/board";
import { moveWorkItem, type WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { StageColumn } from "@/components/board/StageColumn";
import { AddStageButton } from "@/components/board/AddStageButton";

export function Board({
  projectPublicId,
  initialStages,
  initialWorkItems,
}: {
  projectPublicId: string;
  initialStages: StageWithCount[];
  initialWorkItems: WorkItemWithDisplayId[];
}) {
  const [stagesState, setStagesState] = useState(initialStages);
  const [workItemsState, setWorkItemsState] = useState(initialWorkItems);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    const result = await reorderStages({
      projectPublicId,
      orderedStageIds: reordered.map((s) => s.publicId),
    });
    if (!result.ok) {
      setStagesState(previous);
      setError(result.error.message);
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

    setWorkItemsState((items) =>
      items.map((wi) => (wi.id === workItemId ? { ...wi, stageId: toStageId, position: toPosition } : wi)),
    );
    setError(null);

    const result = await moveWorkItem({ workItemId, toStageId, toPosition });
    if (!result.ok) {
      setWorkItemsState(previous);
      setError(result.error.message);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "stage") {
      void handleStageReorder(String(active.id), String(over.id));
      return;
    }

    const workItemId = active.data.current?.workItemId as number | undefined;
    const toStageId = over.data.current?.stageId as number | undefined;
    if (workItemId == null || toStageId == null) return;
    void handleWorkItemMove(workItemId, toStageId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 flex-col">
        {error && <p className="text-destructive px-4 pt-2 text-sm">{error}</p>}
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          <SortableContext items={stagesState.map((s) => `stage:${s.id}`)} strategy={horizontalListSortingStrategy}>
            {stagesState.map((stage) => (
              <StageColumn
                key={stage.id}
                projectPublicId={projectPublicId}
                stage={stage}
                workItems={workItemsState.filter((wi) => wi.stageId === stage.id)}
              />
            ))}
          </SortableContext>
          <AddStageButton projectPublicId={projectPublicId} />
        </div>
      </div>
    </DndContext>
  );
}

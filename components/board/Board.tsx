"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import type { StageWithCount } from "@/lib/actions/board";
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
  const [workItemsState, setWorkItemsState] = useState(initialWorkItems);
  const [error, setError] = useState<string | null>(null);

  // `initialWorkItems` is a fresh array every time the server component
  // re-renders (e.g. router.refresh() after creating a work item). Adjust
  // local state during render (React's documented pattern for this) so
  // those additions show up without a full page reload.
  const [prevInitialWorkItems, setPrevInitialWorkItems] = useState(initialWorkItems);
  if (initialWorkItems !== prevInitialWorkItems) {
    setPrevInitialWorkItems(initialWorkItems);
    setWorkItemsState(initialWorkItems);
  }

  // FR-005 of 004-work-items, with the same optimistic + revert-on-failure
  // pattern already clarified for column reordering (FR-011 of
  // 003-kanban-board) — Principle I of the constitution.
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const workItemId = active.data.current?.workItemId as number | undefined;
    const toStageId = over.data.current?.stageId as number | undefined;
    if (workItemId == null || toStageId == null) return;

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

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-1 flex-col">
        {error && <p className="text-destructive px-4 pt-2 text-sm">{error}</p>}
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {initialStages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              workItems={workItemsState.filter((wi) => wi.stageId === stage.id)}
            />
          ))}
          <AddStageButton projectPublicId={projectPublicId} />
        </div>
      </div>
    </DndContext>
  );
}

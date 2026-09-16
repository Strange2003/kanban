"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { StageWithCount } from "@/lib/actions/board";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { WorkItemCard } from "@/components/board/WorkItemCard";
import { AddWorkItemButton } from "@/components/board/AddWorkItemButton";
import { DeleteStageButton } from "@/components/board/DeleteStageButton";

export function StageColumn({
  projectPublicId,
  stage,
  workItems,
}: {
  projectPublicId: string;
  stage: StageWithCount;
  workItems: WorkItemWithDisplayId[];
}) {
  // One sortable registration per stage serves double duty: it's both the
  // reorder-columns drag source/target (FR-005 of 003) and the drop target
  // for a Work Item dragged in from another column (FR-005 of 004) — two
  // separate droppable registrations on the same rect would leave dnd-kit's
  // collision detection to guess which one `over` resolves to.
  const { attributes, listeners, setNodeRef, transform, transition, isOver, isDragging } = useSortable({
    id: `stage:${stage.id}`,
    data: { type: "stage", stageId: stage.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card transition-colors",
        isOver && "border-primary/50 bg-accent/40",
        isDragging && "opacity-50",
      )}
      data-testid="stage-column"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing"
      >
        <h3 className="text-sm font-medium">{stage.name}</h3>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">{workItems.length}</span>
          <DeleteStageButton
            projectPublicId={projectPublicId}
            stagePublicId={stage.publicId}
            hasWorkItems={workItems.length > 0}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {workItems.map((workItem) => (
          <WorkItemCard key={workItem.id} workItem={workItem} projectPublicId={projectPublicId} />
        ))}
        <AddWorkItemButton stagePublicId={stage.publicId} />
      </div>
    </div>
  );
}

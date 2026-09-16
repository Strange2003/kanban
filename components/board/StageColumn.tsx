"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { StageWithCount } from "@/lib/actions/board";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { WorkItemCard } from "@/components/board/WorkItemCard";
import { AddWorkItemButton } from "@/components/board/AddWorkItemButton";

export function StageColumn({
  stage,
  workItems,
}: {
  stage: StageWithCount;
  workItems: WorkItemWithDisplayId[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { stageId: stage.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card transition-colors",
        isOver && "border-primary/50 bg-accent/40",
      )}
      data-testid="stage-column"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-medium">{stage.name}</h3>
        <span className="text-muted-foreground text-xs">{workItems.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {workItems.map((workItem) => (
          <WorkItemCard key={workItem.id} workItem={workItem} />
        ))}
        <AddWorkItemButton stagePublicId={stage.publicId} />
      </div>
    </div>
  );
}

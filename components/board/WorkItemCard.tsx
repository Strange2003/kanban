"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";

export function WorkItemCard({ workItem }: { workItem: WorkItemWithDisplayId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `work-item:${workItem.id}`,
    data: { workItemId: workItem.id, stageId: workItem.stageId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab touch-none rounded-md border border-border bg-background p-2 text-sm shadow-sm active:cursor-grabbing"
      data-testid="work-item-card"
    >
      <span className="text-muted-foreground text-xs">{workItem.displayId}</span>
      <p className="font-medium">{workItem.title}</p>
    </div>
  );
}

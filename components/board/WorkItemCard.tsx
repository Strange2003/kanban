"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { WorkItemDetailPanel } from "@/components/work-items/WorkItemDetailPanel";

export function WorkItemCard({
  workItem,
  projectPublicId,
}: {
  workItem: WorkItemWithDisplayId;
  projectPublicId: string;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `work-item:${workItem.id}`,
    data: { workItemId: workItem.id, stageId: workItem.stageId },
  });

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => setOpen(true)}
        style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
        className="cursor-grab touch-none rounded-md border border-border bg-background p-2 text-sm shadow-sm active:cursor-grabbing"
        data-testid="work-item-card"
      >
        <span className="text-muted-foreground text-xs">{workItem.displayId}</span>
        <p className="font-medium">{workItem.title}</p>
      </div>
      <WorkItemDetailPanel
        workItem={workItem}
        projectPublicId={projectPublicId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { renameStage, type StageWithCount } from "@/lib/actions/board";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { WorkItemCard } from "@/components/board/WorkItemCard";
import { AddWorkItemButton } from "@/components/board/AddWorkItemButton";
import { DeleteStageButton } from "@/components/board/DeleteStageButton";
import { Input } from "@/components/ui/input";

// FR-008 of 003-kanban-board: double-click the column name to rename it in place.
function StageName({ projectPublicId, stage }: { projectPublicId: string; stage: StageWithCount }) {
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
    const result = await renameStage({ projectPublicId, stageId: stage.publicId, name: trimmed });
    setSubmitting(false);
    if (!result.ok) {
      setName(stage.name);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit}>
        <Input
          autoFocus
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
    <h3
      className="text-sm font-medium"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {stage.name}
    </h3>
  );
}

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
        <StageName projectPublicId={projectPublicId} stage={stage} />
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
        <SortableContext
          items={workItems.map((wi) => `work-item:${wi.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {workItems.map((workItem) => (
            <WorkItemCard key={workItem.id} workItem={workItem} projectPublicId={projectPublicId} />
          ))}
        </SortableContext>
        <AddWorkItemButton stagePublicId={stage.publicId} />
      </div>
    </div>
  );
}

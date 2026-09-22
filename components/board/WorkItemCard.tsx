"use client";

import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkItemWithDisplayId } from "@/lib/actions/work-items";
import { cn } from "@/lib/utils";

export function WorkItemCard({
  workItem,
  projectPublicId,
  canEdit,
}: {
  workItem: WorkItemWithDisplayId;
  projectPublicId: string;
  // False for a Viewer (007-roles-permissions): the card stays clickable — they
  // can still open the detail view — but can't be dragged.
  canEdit: boolean;
}) {
  const router = useRouter();
  // Sortable (not just draggable) so it participates in both cross-column
  // moves (FR-005 of 004) and within-column reordering (FR-006 of 004) via
  // the same drag gesture.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `work-item:${workItem.id}`,
    data: { type: "work-item", workItemId: workItem.id, stageId: workItem.stageId },
    disabled: !canEdit,
  });
  const openDetail = () => router.push(`/projects/${projectPublicId}/work-items/${workItem.displayNumber}`);

  return (
    <div
      ref={setNodeRef}
      {...(canEdit ? listeners : {})}
      {...(canEdit
        ? attributes
        : {
            // No sortable attributes for a Viewer, so give the card the
            // button semantics + keyboard activation they normally provide.
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail();
              }
            },
          })}
      // FR-002 of 006-work-item-detail-view: navigates to the dedicated
      // detail view instead of opening a modal — the `distance: 8` pointer
      // activation constraint on the sortable's sensor (Board.tsx) already
      // keeps a plain click from being swallowed by a drag gesture.
      onClick={openDetail}
      aria-label={`${workItem.displayId}: ${workItem.title}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        "rounded-md border border-border bg-background p-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        canEdit ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
      )}
      data-testid="work-item-card"
    >
      <span className="text-muted-foreground text-xs">{workItem.displayId}</span>
      <p className="font-medium">{workItem.title}</p>
    </div>
  );
}

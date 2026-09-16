"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteStage } from "@/lib/actions/board";
import { Button } from "@/components/ui/button";

// FR-006/FR-007 of 003-kanban-board
export function DeleteStageButton({
  projectPublicId,
  stagePublicId,
  hasWorkItems,
}: {
  projectPublicId: string;
  stagePublicId: string;
  hasWorkItems: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    const result = await deleteStage({ projectPublicId, stageId: stagePublicId });
    setDeleting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete column"
        title={hasWorkItems ? "Move or delete this column's Work Items first" : "Delete column"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && (
        <p className="absolute top-full right-0 z-10 mt-1 w-48 rounded-md border border-border bg-popover p-2 text-xs text-destructive shadow-md">
          {error}
        </p>
      )}
    </div>
  );
}

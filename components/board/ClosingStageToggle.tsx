"use client";

import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// FR-011 of 008-work-item-fields: marks/unmarks a column as a closing column.
// The optimistic update and the Server Action call live in Board (it owns the
// stages and Work Items state that both change); this is only the control.
export function ClosingStageToggle({ isClosing, onToggle }: { isClosing: boolean; onToggle: () => void }) {
  const label = isClosing ? "Unmark closing column" : "Mark as closing column";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6", isClosing ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
      onClick={onToggle}
      aria-pressed={isClosing}
      aria-label={label}
      title={
        isClosing
          ? "Work Items in this column are closed. Click to unmark it (they reopen)."
          : "Mark as closing column: Work Items moved here are closed."
      }
    >
      <CircleCheck className="h-3.5 w-3.5" />
    </Button>
  );
}

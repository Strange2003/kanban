import { LEVEL_LABELS, type WorkItemLevel } from "@/lib/work-item-fields";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<WorkItemLevel, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  medium: "bg-secondary text-secondary-foreground",
  low: "border border-border text-muted-foreground",
};

// FR-016 of 008-work-item-fields: compact priority on the card. Always shows
// the level as text too, never color alone, so Critical stands out at a glance
// (SC-002) for everyone.
export function PriorityBadge({ level }: { level: WorkItemLevel }) {
  return (
    <span
      className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] leading-none font-medium", LEVEL_STYLES[level])}
      data-testid="priority-badge"
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

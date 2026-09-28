import { X } from "lucide-react";
import { TAG_COLOR_STYLES, type TagColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

// FR-011 of 013-project-catalogs: a tag shown with its color as background.
export function TagChip({
  name,
  color,
  onRemove,
  className,
}: {
  name: string;
  color: TagColor;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TAG_COLOR_STYLES[color].chip,
        className,
      )}
      data-testid="tag-chip"
      data-color={color}
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${name}`}
          className="rounded-full opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

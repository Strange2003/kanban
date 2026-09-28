"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { TAG_COLORS, TAG_COLOR_STYLES, type TagColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

// FR-008 of 013-project-catalogs: pick one color of the fixed palette. A radio
// group, so arrow keys move between colors and each swatch has a name.
export function TagColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Tag color",
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  disabled?: boolean;
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, delta: number) {
    const next = (from + delta + TAG_COLORS.length) % TAG_COLORS.length;
    onChange(TAG_COLORS[next]!);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((color, index) => {
        const checked = color === value;
        return (
          <button
            key={color}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={TAG_COLOR_STYLES[color].label}
            title={TAG_COLOR_STYLES[color].label}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(color)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(index, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
              TAG_COLOR_STYLES[color].swatch,
              checked && "ring-2 ring-foreground",
            )}
          >
            {checked && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

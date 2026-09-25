"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal dialog built on the native <dialog> element (free focus trap,
 * Escape-to-close, and backdrop) instead of pulling in a Radix dependency —
 * swap for shadcn/ui's real Dialog (`npx shadcn add dialog`) any time.
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  dismissible = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  // Adds a close (X) button and closes on a click outside the panel. Opt-in:
  // form dialogs would lose what was typed on a stray backdrop click.
  dismissible?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  // Only a press that both starts and ends on the backdrop closes it — a text
  // selection dragged out of the panel must not.
  const pressStartedOnBackdrop = React.useRef(false);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = dismissible && event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // The panel's inner div fills the <dialog>, so only the backdrop
        // reports the <dialog> itself as the target.
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onOpenChange(false);
        pressStartedOnBackdrop.current = false;
      }}
      className={cn(
        "m-auto rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50",
        className,
      )}
    >
      <div className="relative w-[min(calc(100vw-2rem),24rem)] p-5 sm:p-6">
        {dismissible && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="absolute top-3 right-3 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
        {children}
      </div>
    </dialog>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 space-y-1">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)}>{children}</div>;
}

"use client";

import * as React from "react";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

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
      className={cn(
        "m-auto rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50",
        className,
      )}
    >
      <div className="w-[min(calc(100vw-2rem),24rem)] p-5 sm:p-6">{children}</div>
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
